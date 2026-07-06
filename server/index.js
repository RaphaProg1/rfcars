import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const app = express();
const port = process.env.PORT || 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDirectory = process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname;
const dataFile = path.join(dataDirectory, 'data.json');
const sessions = new Map();
const digits = value => String(value || '').replace(/\D/g, '');
const emptyDb = () => ({ raffles: [], activeRaffleId: null, orders: [], audit: [] });
const read = () => {
  try {
    const raw = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    const db = { ...emptyDb(), ...raw };
    if (raw.raffle && !db.raffles.length) {
      db.raffles = [raw.raffle];
      db.activeRaffleId = raw.raffle.id;
      delete db.raffle;
      write(db);
    }
    return db;
  }
  catch { return emptyDb(); }
};
const write = data => {
  const temp = `${dataFile}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(data, null, 2));
  fs.renameSync(temp, dataFile);
};
const raffleWithStats = (db, raffle) => {
  if (!raffle) return null;
  const now = Date.now();
  const blocking = db.orders.filter(o => o.raffleId === raffle.id && (o.status === 'paid' || (o.status === 'pending' && new Date(o.expiresAt).getTime() > now)));
  const paid = db.orders.filter(o => o.raffleId === raffle.id && o.status === 'paid');
  return {
    ...raffle,
    images: raffle.images?.length ? raffle.images : [raffle.image].filter(Boolean),
    image: raffle.images?.[0] || raffle.image,
    unavailableNumbers: [...new Set(blocking.flatMap(o => o.numbers))],
    soldNumbers: [...new Set(paid.flatMap(o => o.numbers))],
    soldCount: new Set(paid.flatMap(o => o.numbers)).size
  };
};
const publicRaffle = db => raffleWithStats(db, db.raffles.find(r => r.id === db.activeRaffleId && r.status === 'active'));
const auth = (req, res, next) => {
  const token = String(req.headers.authorization || '').replace(/^Bearer /, '');
  const expires = sessions.get(token);
  if (!expires || expires < Date.now()) return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  next();
};

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = String(process.env.ALLOWED_ORIGIN || '').split(',').map(value => value.trim()).filter(Boolean);
  const isLocal = origin && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
  if (origin && (isLocal || allowedOrigins.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '1mb', verify: (req, res, buffer) => { req.rawBody = buffer; } }));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'RFCars Brasil API' }));
app.get('/api/raffle', (req, res) => res.json(publicRaffle(read())));

app.post('/api/admin/login', (req, res) => {
  const configured = process.env.ADMIN_PASSWORD;
  if (!configured) return res.status(503).json({ error: 'Defina ADMIN_PASSWORD no arquivo .env.' });
  const supplied = String(req.body?.password || '');
  const a = Buffer.from(supplied), b = Buffer.from(configured);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: 'Senha incorreta.' });
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + 8 * 60 * 60 * 1000);
  res.json({ token });
});

app.get('/api/admin/dashboard', auth, (req, res) => {
  const db = read();
  const raffle = publicRaffle(db);
  const orders = [...db.orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const paid = orders.filter(o => o.status === 'paid');
  res.json({
    raffle,
    raffles: db.raffles.map(r => raffleWithStats(db, r)),
    activeRaffleId: db.activeRaffleId,
    stats: {
      revenue: paid.reduce((sum, o) => sum + o.amount, 0),
      sold: db.raffles.reduce((sum, r) => sum + raffleWithStats(db, r).soldCount, 0),
      participants: new Set(paid.map(o => o.cpf)).size,
      pending: orders.filter(o => o.status === 'pending' && new Date(o.expiresAt) > new Date()).length
    },
    orders: orders.map(({ cpf, ...o }) => ({ ...o, cpf: cpf ? `***${cpf.slice(-4)}` : '' }))
  });
});

const saveRaffle = (req, res) => {
  const { title, subtitle, price, drawRule, status } = req.body || {};
  const images = [...new Set((Array.isArray(req.body?.images) ? req.body.images : [req.body?.image]).map(value => String(value || '').trim()).filter(Boolean))];
  const priceCents = Math.round(Number(price) * 100);
  if (!title || !subtitle || !images.length || !drawRule || !Number.isInteger(priceCents) || priceCents < 1)
    return res.status(400).json({ error: 'Preencha todos os campos da rifa corretamente.' });
  try { images.forEach(image => new URL(image)); } catch { return res.status(400).json({ error: 'Todas as fotos precisam ter URLs válidas.' }); }
  const db = read();
  const existing = req.params.id ? db.raffles.find(r => r.id === req.params.id) : null;
  if (req.params.id && !existing) return res.status(404).json({ error: 'Rifa não encontrada.' });
  const normalizedStatus = ['active', 'paused', 'completed'].includes(status) ? status : 'paused';
  const raffle = {
    id: existing?.id || crypto.randomUUID(), title, subtitle, image: images[0], images, drawRule,
    priceCents, status: normalizedStatus,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  if (existing) db.raffles[db.raffles.findIndex(r => r.id === existing.id)] = raffle;
  else db.raffles.push(raffle);
  if (normalizedStatus === 'active') {
    db.activeRaffleId = raffle.id;
    db.raffles = db.raffles.map(r => r.id === raffle.id ? r : (r.status === 'active' ? { ...r, status: 'paused' } : r));
  }
  if (normalizedStatus !== 'active' && db.activeRaffleId === raffle.id) db.activeRaffleId = null;
  db.audit.push({ at: new Date().toISOString(), action: existing ? 'raffle.updated' : 'raffle.created', raffleId: raffle.id });
  write(db);
  res.json(raffleWithStats(db, raffle));
};
app.post('/api/admin/raffles', auth, saveRaffle);
app.put('/api/admin/raffles/:id', auth, saveRaffle);
app.post('/api/admin/raffles/:id/publish', auth, (req, res) => {
  const db = read(), raffle = db.raffles.find(r => r.id === req.params.id);
  if (!raffle) return res.status(404).json({ error: 'Rifa não encontrada.' });
  db.raffles = db.raffles.map(r => r.id === raffle.id ? { ...r, status: 'active', updatedAt: new Date().toISOString() } : (r.status === 'active' ? { ...r, status: 'paused' } : r));
  db.activeRaffleId = raffle.id;
  db.audit.push({ at: new Date().toISOString(), action: 'raffle.published', raffleId: raffle.id });
  write(db);
  res.json(publicRaffle(db));
});

app.post('/api/orders', async (req, res) => {
  const db = read(), raffle = publicRaffle(db);
  if (!raffle || raffle.status !== 'active') return res.status(409).json({ error: 'Não existe uma rifa ativa no momento.' });
  if (!process.env.PAGARME_SECRET_KEY) return res.status(503).json({ error: 'Pagamento indisponível: configure PAGARME_SECRET_KEY no servidor.' });
  const { name, email, cpf, phone, numbers } = req.body || {};
  if (!name || !email || digits(cpf).length !== 11 || digits(phone).length < 10 || !Array.isArray(numbers) || !numbers.length)
    return res.status(400).json({ error: 'Confira seus dados e escolha ao menos um número.' });
  const unique = [...new Set(numbers)].filter(n => Number.isInteger(n) && n >= 0 && n <= 999);
  if (unique.length !== numbers.length) return res.status(400).json({ error: 'Há números inválidos ou repetidos.' });
  const unavailable = new Set(raffle.unavailableNumbers);
  const conflict = unique.find(n => unavailable.has(n));
  if (conflict !== undefined) return res.status(409).json({ error: `O número ${String(conflict).padStart(3, '0')} acabou de ser reservado. Escolha outro.` });

  const code = `RF-${Date.now()}`, amount = unique.length * raffle.priceCents;
  const phoneDigits = digits(phone), areaCode = phoneDigits.slice(0, 2), number = phoneDigits.slice(2);
  let response, provider;
  try {
    response = await fetch('https://api.pagar.me/core/v5/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(`${process.env.PAGARME_SECRET_KEY}:`).toString('base64')}` },
      body: JSON.stringify({
        code,
        items: [{ amount: raffle.priceCents, description: `Rifa ${raffle.title}`, quantity: unique.length }],
        customer: { name, email, type: 'individual', document: digits(cpf), phones: { mobile_phone: { country_code: '55', area_code: areaCode, number } } },
        payments: [{ payment_method: 'pix', pix: { expires_in: 1800, additional_information: [{ name: 'Números', value: unique.map(n => String(n).padStart(3, '0')).join(', ') }] } }],
        metadata: { raffle_id: raffle.id }
      })
    });
    provider = await response.json();
  } catch {
    return res.status(502).json({ error: 'Não foi possível conectar ao Pagar.me.' });
  }
  if (!response.ok) return res.status(502).json({ error: provider.message || 'O Pagar.me recusou a criação do pedido.' });
  const charge = provider.charges?.[0]?.last_transaction;
  if (!charge?.qr_code) return res.status(502).json({ error: 'O Pagar.me não retornou o QR Code Pix.' });
  const order = {
    id: crypto.randomUUID(), code, raffleId: raffle.id, status: 'pending', name, email,
    cpf: digits(cpf), phone: digits(phone), numbers: unique, amount, providerId: provider.id,
    chargeId: provider.charges?.[0]?.id || null, createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
  };
  db.orders.push(order);
  write(db);
  res.json({ orderId: order.id, pix: { qr_code: charge.qr_code, qr_code_url: charge.qr_code_url, expires_at: order.expiresAt } });
});

app.post('/api/webhooks/pagarme', (req, res) => {
  const db = read();
  const providerId = req.body?.data?.order?.id || req.body?.data?.id;
  const order = db.orders.find(o => o.providerId === providerId);
  if (order && ['order.paid', 'charge.paid'].includes(req.body?.type)) {
    order.status = 'paid';
    order.paidAt = new Date().toISOString();
    db.audit.push({ at: order.paidAt, action: 'order.paid', orderId: order.id, providerId });
    write(db);
  }
  res.sendStatus(200);
});

app.get('/api/admin/raffles/:raffleId/winner/:number', auth, (req, res) => {
  const number = Number(req.params.number);
  if (!Number.isInteger(number) || number < 0 || number > 999) return res.status(400).json({ error: 'Informe um número entre 000 e 999.' });
  const db = read();
  const raffle = db.raffles.find(r => r.id === req.params.raffleId);
  if (!raffle) return res.status(404).json({ error: 'Selecione uma rifa válida.' });
  const order = db.orders.find(o => o.raffleId === raffle.id && o.status === 'paid' && o.numbers.includes(number));
  db.audit.push({ at: new Date().toISOString(), action: 'winner.lookup', raffleId: raffle.id, number, orderId: order?.id || null });
  write(db);
  res.json(order ? { number, name: order.name, email: order.email, phone: order.phone, orderId: order.id, paidAt: order.paidAt } : null);
});

const dist = path.join(__dirname, '..', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res, next) => req.method === 'GET' ? res.sendFile(path.join(dist, 'index.html')) : next());
}
app.listen(port, '0.0.0.0', () => console.log(`RFCars Brasil API na porta ${port}`));
