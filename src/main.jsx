import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight, BadgeCheck, Car, Check, ChevronRight, Clock3, Copy, FileText,
  LockKeyhole, Menu, Minus, Plus, Search, ShieldCheck, Sparkles, Trophy, X
} from 'lucide-react';
import './styles.css';

const fmt = n => String(n).padStart(3, '0');
const money = cents => (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');

const api = async (url, options = {}) => {
  let response;
  try {
    response = await fetch(`${API_BASE}${url}`, options);
  } catch {
    throw new Error('Não foi possível conectar ao servidor. Confirme que a API está em execução.');
  }
  const contentType = response.headers.get('content-type') || '';
  const body = response.status === 204 ? null : contentType.includes('application/json') ? await response.json() : null;
  if (!contentType.includes('application/json') && !response.ok)
    throw new Error('A API administrativa não foi encontrada. Reinicie o projeto com npm run dev.');
  if (!response.ok) throw new Error(body?.error || 'Não foi possível concluir a operação.');
  return body;
};

function Logo({ dark = false }) {
  return <div className={`logo ${dark ? 'logo-dark' : ''}`}><div className="logo-mark"><Car size={23} /></div><div><b>RFCARS</b><span>BRASIL</span></div></div>;
}

function App() {
  const [raffle, setRaffle] = useState(null);
  const [winners, setWinners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [showNumbers, setShowNumbers] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [showMyNumbers, setShowMyNumbers] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [menu, setMenu] = useState(false);
  const [filter, setFilter] = useState('todos');
  const [quickQty, setQuickQty] = useState(10);
  const [photoIndex, setPhotoIndex] = useState(0);

  const loadPublicData = async () => {
    const [raffleData, winnersData] = await Promise.all([api('/api/raffle'), api('/api/winners')]);
    setRaffle(raffleData);
    setWinners(winnersData || []);
    setLoading(false);
  };

  useEffect(() => { loadPublicData().catch(() => setLoading(false)); }, []);
  useEffect(() => { setPhotoIndex(0); }, [raffle?.id]);

  const unavailable = useMemo(() => new Set(raffle?.unavailableNumbers || []), [raffle]);
  const sold = useMemo(() => new Set(raffle?.soldNumbers || []), [raffle]);
  const soldCount = raffle?.soldCount || 0;
  const progress = raffle ? Math.min(100, Math.round((soldCount / 1000) * 100)) : 0;
  const availableCount = Math.max(0, 1000 - soldCount);

  const toggle = n => !unavailable.has(n) && setSelected(s => s.includes(n) ? s.filter(x => x !== n) : [...s, n].sort((a, b) => a - b));
  const lucky = () => {
    const free = Array.from({ length: 1000 }, (_, i) => i).filter(n => !unavailable.has(n) && !selected.includes(n));
    setSelected(s => [...s, ...free.sort(() => Math.random() - .5).slice(0, quickQty)].sort((a, b) => a - b));
  };

  if (admin) return <Admin onBack={() => { setAdmin(false); loadPublicData(); }} />;

  return <div>
    <header>
      <Logo />
      <nav className={menu ? 'open' : ''}>
        <a href="#inicio">Início</a>
        <a href="#rifa">Rifa ativa</a>
        <a href="#ganhadores">Ganhadores</a>
        <a href="#regulamento">Regulamento</a>
        <button className="nav-admin" onClick={() => setShowMyNumbers(true)}><Search size={15} /> Meus números</button>
        <button className="nav-admin" onClick={() => setAdmin(true)}><LockKeyhole size={15} /> Área admin</button>
      </nav>
      <button className="menu" onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</button>
    </header>

    <main id="inicio">
      <section className="hero">
        <div className="hero-photo" style={{ backgroundImage: `linear-gradient(90deg,rgba(4,10,9,.94),rgba(4,10,9,.62) 48%,rgba(4,10,9,.08)),url(${raffle?.image || ''})` }} />
        <div className="hero-content">
          <div className="pill"><Sparkles size={14} /> SUA CHANCE DE ACELERAR</div>
          <h1>O carro dos seus<br />sonhos pode ser <em>seu.</em></h1>
          <p>Escolha seus números, pague via Pix e acompanhe tudo com transparência, sem dados fictícios.</p>
          <div className="hero-actions">
            {raffle?.status === 'active' && <a className="btn primary" href="#rifa">Quero participar <ArrowRight size={19} /></a>}
            <button className="btn ghost-dark" onClick={() => setShowMyNumbers(true)}>Consultar meus números</button>
          </div>
        </div>
      </section>

      <section className="trust">
        <div><ShieldCheck /><span><b>Compra segura</b><small>Dados protegidos</small></span></div>
        <div><BadgeCheck /><span><b>100% transparente</b><small>Resultado oficial informado no regulamento</small></span></div>
        <div><Clock3 /><span><b>Confirmação automática</b><small>Pagamento via Pix</small></span></div>
        <div><Trophy /><span><b>Dados verdadeiros</b><small>Sem participantes fictícios</small></span></div>
      </section>

      <section className="raffle-section" id="rifa">
        <div className="section-head">
          <div>
            <span className="eyebrow">RIFA ATUAL</span>
            <h2>{loading ? 'Carregando...' : raffle ? 'Sua próxima garagem começa aqui' : 'Nenhuma rifa cadastrada'}</h2>
            <p>{raffle ? 'Escolha seus números da sorte e participe.' : 'O administrador precisa cadastrar a primeira rifa.'}</p>
          </div>
          {raffle && <div className="live"><i /> {raffle.status === 'active' ? 'RIFA ATIVA' : 'RIFA PAUSADA'}</div>}
        </div>

        {raffle && <div className="raffle-card">
          <CarGallery raffle={raffle} photoIndex={photoIndex} setPhotoIndex={setPhotoIndex} />
          <div className="raffle-info">
            <div><span className="car-tag">RFCARS BRASIL</span><h2>{raffle.title}</h2><p>{raffle.subtitle}</p></div>
            <div className="price"><span>POR APENAS</span><b><small>R$</small> {(raffle.priceCents / 100).toFixed(2).replace('.', ',')}</b><em>por número</em></div>
            <SalesProgress soldCount={soldCount} progress={progress} availableCount={availableCount} />
            <div className="deadline"><Clock3 size={18} /><span><small>REGRA DO SORTEIO</small><b>{raffle.drawRule}</b></span></div>
            <button disabled={raffle.status !== 'active'} className="btn primary wide" onClick={() => setShowNumbers(true)}>Escolher meus números <ChevronRight /></button>
            <button className="btn secondary wide" onClick={() => setShowMyNumbers(true)}>Consultar compra já feita</button>
            <div className="payment-note"><ShieldCheck size={16} /> Pagamento processado por <b>Pagar.me</b></div>
          </div>
        </div>}
      </section>

      <section className="how" id="como">
        <div className="center"><span className="eyebrow">É MUITO FÁCIL</span><h2>Como participar</h2></div>
        <div className="steps">
          <article><i>01</i><div className="step-icon"><span>000</span></div><h3>Escolha seus números</h3><p>Selecione entre 000 e 999.</p></article>
          <article><i>02</i><div className="step-icon"><span>PIX</span></div><h3>Faça o pagamento</h3><p>O Pagar.me gera e confirma seu Pix.</p></article>
          <article><i>03</i><div className="step-icon"><Trophy /></div><h3>Acompanhe o resultado</h3><p>Confira a apuração conforme o regulamento da rifa.</p></article>
        </div>
      </section>

      <WinnersSection winners={winners} />
      <RulesSection />
    </main>

    <footer><Logo dark /><p>Realizando sonhos, uma chave por vez.</p><span>© 2026 RFCars Brasil • Participe com responsabilidade.</span></footer>

    {showNumbers && <NumbersModal raffle={raffle} unavailable={unavailable} sold={sold} selected={selected} setSelected={setSelected} toggle={toggle} quickQty={quickQty} setQuickQty={setQuickQty} lucky={lucky} filter={filter} setFilter={setFilter} onClose={() => setShowNumbers(false)} onCheckout={() => setCheckout(true)} />}
    {checkout && <Checkout raffle={raffle} selected={selected} onClose={() => setCheckout(false)} onCreated={() => { setCheckout(false); setShowNumbers(false); setSelected([]); loadPublicData(); }} />}
    {showMyNumbers && <MyNumbersModal onClose={() => setShowMyNumbers(false)} />}
  </div>;
}

function CarGallery({ raffle, photoIndex, setPhotoIndex }) {
  const images = raffle.images?.length ? raffle.images : [raffle.image].filter(Boolean);
  return <div className="car-gallery">
    <div className="car-image" style={{ backgroundImage: `url(${images[photoIndex] || raffle.image})` }}><span className="featured">PRÊMIO REAL</span></div>
    {images.length > 1 && <div className="gallery-thumbs">{images.map((image, index) => <button className={photoIndex === index ? 'active' : ''} onClick={() => setPhotoIndex(index)} key={`${image}-${index}`}><img src={image} alt={`${raffle.title} - foto ${index + 1}`} /></button>)}</div>}
  </div>;
}

function SalesProgress({ soldCount, progress, availableCount }) {
  return <div className="sales-progress" aria-label={`${soldCount} de 1000 números vendidos`}>
    <div className="sales-progress-head"><div><span>Vendidos</span><strong>{soldCount.toLocaleString('pt-BR')} de 1.000 números</strong></div><b>{progress}%</b></div>
    <div className="progress sales-bar"><i style={{ width: `${progress}%` }} /></div>
    <div className="sales-progress-foot"><span>{availableCount.toLocaleString('pt-BR')} números ainda disponíveis</span><span>Pagamentos confirmados</span></div>
  </div>;
}

function WinnersSection({ winners }) {
  return <section className="winners-section" id="ganhadores">
    <div className="section-head">
      <div><span className="eyebrow">HISTÓRICO REAL</span><h2>Ganhadores RFCars Brasil</h2><p>Os ganhadores aparecem aqui depois que o admin registra o número sorteado.</p></div>
    </div>
    <div className="winner-list">
      {!winners.length && <article className="empty-card"><Trophy /><h3>Nenhum ganhador registrado ainda</h3><p>Quando uma rifa for encerrada, o resultado fica público nesta área.</p></article>}
      {winners.map(winner => <article key={winner.id}>
        <span>NÚMERO SORTEADO</span>
        <strong>#{fmt(winner.number)}</strong>
        <h3>{winner.name}</h3>
        <p>{winner.raffleTitle}</p>
        {(winner.city || winner.state) && <small>{winner.city}{winner.city && winner.state ? ' - ' : ''}{winner.state}</small>}
      </article>)}
    </div>
  </section>;
}

function RulesSection() {
  return <section className="rules-section" id="regulamento">
    <div className="center"><span className="eyebrow">TRANSPARÊNCIA</span><h2>Regulamento básico</h2><p>Edite estes textos depois com os dados jurídicos oficiais da sua operação.</p></div>
    <div className="rules-grid">
      <article><FileText /><h3>Números e pagamento</h3><p>Cada rifa possui 1.000 números, de 000 a 999. O número só conta como vendido quando o pagamento estiver confirmado.</p></article>
      <article><Trophy /><h3>Apuração</h3><p>O ganhador deve ser definido conforme a regra cadastrada no painel da rifa, usando o número oficial informado no regulamento.</p></article>
      <article><ShieldCheck /><h3>Dados reais</h3><p>O site não cria participantes fictícios. Compras, números e ganhadores vêm dos pedidos registrados no servidor.</p></article>
    </div>
  </section>;
}

function NumbersModal({ raffle, unavailable, sold, selected, setSelected, toggle, quickQty, setQuickQty, lucky, filter, setFilter, onClose, onCheckout }) {
  return <div className="overlay"><div className="modal numbers-modal">
    <button className="close" onClick={onClose}><X /></button>
    <div className="modal-title"><span className="eyebrow">ESCOLHA SUA SORTE</span><h2>Números disponíveis</h2><p>Cada número custa {money(raffle.priceCents)}.</p></div>
    <div className="quick"><div><b>Surpresinha</b><span>Escolha aleatória apenas entre números livres</span></div><div className="qty"><button onClick={() => setQuickQty(Math.max(1, quickQty - 1))}><Minus /></button><b>{quickQty}</b><button onClick={() => setQuickQty(Math.min(50, quickQty + 1))}><Plus /></button></div><button className="btn lucky" onClick={lucky}><Sparkles /> Escolher</button></div>
    <div className="number-legend"><span><i /> Disponível</span><span><i className="chosen" /> Selecionado</span><span><i className="taken" /> Reservado/vendido</span><div className="filters">{['todos', 'disponíveis', 'meus'].map(f => <button className={filter === f ? 'active' : ''} onClick={() => setFilter(f)} key={f}>{f}</button>)}</div></div>
    <div className="grid">{Array.from({ length: 1000 }, (_, n) => {
      const blocked = unavailable.has(n), chosen = selected.includes(n);
      if (filter === 'disponíveis' && blocked) return null;
      if (filter === 'meus' && !chosen) return null;
      return <button key={n} disabled={blocked} title={sold.has(n) ? 'Pago' : blocked ? 'Reservado' : 'Disponível'} className={chosen ? 'chosen' : blocked ? 'taken' : ''} onClick={() => toggle(n)}>{chosen && <Check size={11} />} {fmt(n)}</button>;
    })}</div>
    <div className="cartbar"><div><span>{selected.length} número(s) selecionado(s)</span><b>Total: {money(selected.length * raffle.priceCents)}</b></div><button disabled={!selected.length} className="btn primary" onClick={onCheckout}>Continuar <ArrowRight /></button></div>
  </div></div>;
}

function Checkout({ raffle, selected, onClose, onCreated }) {
  const [pix, setPix] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState({ name: '', email: '', cpf: '', phone: '' });
  const pay = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      setPix((await api('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, numbers: selected }) })).pix);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  return <div className="overlay top"><div className="modal checkout">
    <button className="close" onClick={onClose}><X /></button>
    <Logo />
    <div className="checkout-head"><span>Checkout seguro</span><span><ShieldCheck /> Pagar.me</span></div>
    {!pix ? <><h2>Complete seus dados</h2><div className="order-summary"><div><b>{raffle.title}</b><span>Números: {selected.map(fmt).join(', ')}</span></div><b>{money(selected.length * raffle.priceCents)}</b></div><form onSubmit={pay}><label>Nome completo<input required value={data.name} onChange={e => setData({ ...data, name: e.target.value })} /></label><div className="form-row"><label>E-mail<input type="email" required value={data.email} onChange={e => setData({ ...data, email: e.target.value })} /></label><label>Celular<input required value={data.phone} onChange={e => setData({ ...data, phone: e.target.value })} /></label></div><label>CPF<input required value={data.cpf} onChange={e => setData({ ...data, cpf: e.target.value })} /></label>{error && <p className="error">{error}</p>}<button className="btn primary wide" disabled={loading}>{loading ? 'Conectando ao Pagar.me...' : 'Gerar Pix real'} <ArrowRight /></button></form></> : <div className="pix-success"><div className="check-big"><Check /></div><h2>Pix gerado pelo Pagar.me</h2><p>Pague antes do vencimento para reservar seus números.</p><div className="qr"><img src={pix.qr_code_url} alt="QR Code Pix" /></div><button className="copy" onClick={() => navigator.clipboard.writeText(pix.qr_code)}><Copy /> Copiar código Pix</button><button className="btn primary wide" onClick={onCreated}>Concluir</button></div>}
  </div></div>;
}

function MyNumbersModal({ onClose }) {
  const [form, setForm] = useState({ cpf: '', contact: '' });
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const search = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      setOrders((await api('/api/my-numbers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })).orders);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  return <div className="overlay top"><div className="modal lookup-modal">
    <button className="close" onClick={onClose}><X /></button>
    <Logo />
    <span className="eyebrow">ÁREA DO COMPRADOR</span>
    <h2>Consultar meus números</h2>
    <p>Use o CPF e o e-mail ou celular informado na compra.</p>
    <form onSubmit={search}>
      <label>CPF<input required value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" /></label>
      <label>E-mail ou celular<input required value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} placeholder="email@email.com ou celular" /></label>
      {error && <p className="error">{error}</p>}
      <button className="btn primary wide" disabled={loading}>{loading ? 'Buscando...' : 'Buscar meus números'} <Search size={17} /></button>
    </form>
    {orders && <div className="lookup-results">
      {!orders.length && <p>Nenhum pedido encontrado com esses dados.</p>}
      {orders.map(order => <article key={order.id}>
        <div><b>{order.raffleTitle}</b><small>{new Date(order.createdAt).toLocaleString('pt-BR')}</small></div>
        <span className={`status ${order.status}`}>{order.status === 'paid' ? 'Pago' : order.status === 'canceled' ? 'Cancelado' : 'Pendente'}</span>
        <p>{order.numbers.map(fmt).join(', ')}</p>
        <strong>{money(order.amount)}</strong>
      </article>)}
    </div>}
  </div></div>;
}

function Admin({ onBack }) {
  const blank = { title: '', subtitle: '', price: '', images: [''], drawRule: '', status: 'paused' };
  const [token, setToken] = useState(sessionStorage.getItem('rf_token') || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('Visão geral');
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [drawNumber, setDrawNumber] = useState('');
  const [drawRaffleId, setDrawRaffleId] = useState('');
  const [winner, setWinner] = useState(undefined);
  const [winnerPlace, setWinnerPlace] = useState({ city: '', state: '' });
  const [orderFilter, setOrderFilter] = useState('todos');
  const [orderSearch, setOrderSearch] = useState('');
  const headers = { Authorization: `Bearer ${token}` };

  const load = async currentToken => {
    const d = await api('/api/admin/dashboard', { headers: { Authorization: `Bearer ${currentToken || token}` } });
    setData(d);
    if (!drawRaffleId && d.raffles?.length) setDrawRaffleId(d.activeRaffleId || d.raffles[0].id);
  };

  useEffect(() => { if (token) load().catch(() => { sessionStorage.removeItem('rf_token'); setToken(''); }); }, []);

  const login = async e => {
    e.preventDefault();
    setError('');
    try {
      const r = await api('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      sessionStorage.setItem('rf_token', r.token);
      setToken(r.token);
      await load(r.token);
    } catch (e) {
      setError(e.message);
    }
  };

  const edit = raffle => {
    setEditingId(raffle.id);
    setForm({ title: raffle.title, subtitle: raffle.subtitle, price: raffle.priceCents / 100, images: raffle.images?.length ? raffle.images : [raffle.image || ''], drawRule: raffle.drawRule, status: raffle.status });
    setError('');
  };
  const create = () => { setEditingId(null); setForm(blank); setError(''); };
  const saveRaffle = async e => {
    e.preventDefault();
    setError('');
    try {
      await api(editingId ? `/api/admin/raffles/${editingId}` : '/api/admin/raffles', { method: editingId ? 'PUT' : 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      await load();
      create();
    } catch (e) { setError(e.message); }
  };
  const publish = async id => { setError(''); try { await api(`/api/admin/raffles/${id}/publish`, { method: 'POST', headers }); await load(); } catch (e) { setError(e.message); } };
  const removeRaffle = async raffle => {
    if (!window.confirm(`Excluir definitivamente a rifa "${raffle.title}"?`)) return;
    setError('');
    try {
      await api(`/api/admin/raffles/${raffle.id}`, { method: 'DELETE', headers });
      if (editingId === raffle.id) create();
      await load();
    } catch (e) { setError(e.message); }
  };
  const updateOrder = async (order, status) => {
    if (!window.confirm(`Alterar pedido ${order.code} para "${status}"?`)) return;
    setError('');
    try {
      await api(`/api/admin/orders/${order.id}`, { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      await load();
    } catch (e) { setError(e.message); }
  };
  const pull = async () => {
    setError('');
    setWinner(undefined);
    if (!drawRaffleId) return setError('Selecione uma rifa.');
    try { setWinner(await api(`/api/admin/raffles/${drawRaffleId}/winner/${drawNumber}`, { headers })); } catch (e) { setError(e.message); }
  };
  const registerWinner = async () => {
    setError('');
    try {
      await api(`/api/admin/raffles/${drawRaffleId}/winner`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ number: Number(drawNumber), ...winnerPlace }) });
      setWinner(undefined);
      setWinnerPlace({ city: '', state: '' });
      await load();
      setTab('Ganhadores');
    } catch (e) { setError(e.message); }
  };

  if (!token) return <div className="admin-login"><div><Logo /><span className="eyebrow">PAINEL ADMINISTRATIVO</span><h1>Acesso protegido</h1><form onSubmit={login}><label>Senha<input type="password" value={password} onChange={e => setPassword(e.target.value)} /></label>{error && <p className="error">{error}</p>}<button className="btn primary wide">Entrar <ArrowRight /></button></form><button className="back" onClick={onBack}>← Voltar ao site</button></div></div>;

  const stats = data?.stats || {};
  const tabs = ['Visão geral', 'Rifas', 'Pedidos', 'Puxa número', 'Ganhadores'];
  const orders = (data?.orders || []).filter(order => {
    const statusOk = orderFilter === 'todos' || order.status === orderFilter;
    const q = orderSearch.trim().toLowerCase();
    const searchOk = !q || `${order.name} ${order.email} ${order.code} ${order.numbers?.map(fmt).join(' ')}`.toLowerCase().includes(q);
    return statusOk && searchOk;
  });

  return <div className="admin">
    <aside><Logo /><div className="admin-user"><i>RF</i><span><b>Administrador</b><small>sessão autenticada</small></span></div>{tabs.map(t => <button className={tab === t ? 'active' : ''} onClick={() => setTab(t)} key={t}>{t === 'Puxa número' || t === 'Ganhadores' ? <Trophy /> : <span>●</span>}{t}</button>)}<button className="exit" onClick={() => { sessionStorage.removeItem('rf_token'); onBack(); }}>← Sair</button></aside>
    <section className="admin-main">
      <div className="admin-mobile-head"><Logo /><button onClick={() => { sessionStorage.removeItem('rf_token'); onBack(); }}>Sair</button></div>
      <div className="admin-mobile-nav">{tabs.map(t => <button className={tab === t ? 'active' : ''} onClick={() => setTab(t)} key={t}>{t}</button>)}</div>
      <div className="admin-top"><div><small>PAINEL ADMINISTRATIVO</small><h1>{tab}</h1></div><span>● Dados do servidor</span></div>

      {tab === 'Visão geral' && <><div className="stats"><article><span>Faturamento pago</span><b>{money(stats.revenue)}</b><small>Todas as rifas</small></article><article><span>Números pagos</span><b>{stats.sold || 0}</b><small>Todas as rifas</small></article><article><span>Participantes pagos</span><b>{stats.participants || 0}</b><small>CPFs únicos</small></article><article><span>Pix pendentes</span><b>{stats.pending || 0}</b><small>Reservas válidas</small></article></div><div className="empty-admin"><h3>{data?.raffle ? `Publicada: ${data.raffle.title}` : 'Nenhuma rifa publicada'}</h3><p>Você tem {data?.raffles?.length || 0} rifa(s) cadastrada(s).</p></div></>}

      {tab === 'Rifas' && <div className="raffles-manage"><div className="raffle-list"><div className="list-title"><h3>Suas rifas</h3><button className="btn primary" onClick={create}>+ Nova rifa</button></div>{error && <p className="error">{error}</p>}{!data?.raffles?.length && <p>Nenhuma rifa cadastrada.</p>}{data?.raffles?.map(r => <article className={editingId === r.id ? 'selected' : ''} key={r.id}><img src={r.image} alt="" /><div><b>{r.title}</b><span>{money(r.priceCents)} • {r.soldCount}/1.000 pagos</span><small>{r.id === data.activeRaffleId ? 'PUBLICADA' : r.status === 'completed' ? 'ENCERRADA' : 'NÃO PUBLICADA'}</small></div><div className="raffle-actions"><button onClick={() => edit(r)}>Editar</button>{r.id !== data.activeRaffleId && r.status !== 'completed' && <button className="publish" onClick={() => publish(r.id)}>Publicar</button>}<button className="delete" onClick={() => removeRaffle(r)}>Excluir</button></div></article>)}</div><RaffleForm form={form} setForm={setForm} editingId={editingId} saveRaffle={saveRaffle} error={error} /></div>}

      {tab === 'Pedidos' && <div className="orders-table"><div className="admin-tools"><input value={orderSearch} onChange={e => setOrderSearch(e.target.value)} placeholder="Buscar por cliente, e-mail, pedido ou número" /><select value={orderFilter} onChange={e => setOrderFilter(e.target.value)}><option value="todos">Todos</option><option value="paid">Pagos</option><option value="pending">Pendentes</option><option value="canceled">Cancelados</option></select></div>{error && <p className="error">{error}</p>}<div className="order-line head"><b>Cliente</b><b>Números</b><b>Valor</b><b>Status</b><b>Ações</b></div>{!orders.length && <p>Nenhum pedido encontrado.</p>}{orders.map(o => <div className="order-line" key={o.id}><span><b>{o.name}</b><small>{data.raffles?.find(r => r.id === o.raffleId)?.title || 'Rifa antiga'} • {o.email} • {o.code}</small></span><span>{o.numbers.map(fmt).join(', ')}</span><b>{money(o.amount)}</b><span className={`status ${o.status}`}>{o.status === 'paid' ? 'Pago' : o.status === 'canceled' ? 'Cancelado' : 'Pendente'}</span><div className="order-actions"><button onClick={() => updateOrder(o, 'paid')}>Pago</button><button onClick={() => updateOrder(o, 'pending')}>Pendente</button><button onClick={() => updateOrder(o, 'canceled')}>Cancelar</button></div></div>)}</div>}

      {tab === 'Puxa número' && <div className="draw-page"><div className="draw-card"><div className="draw-icon"><Trophy /></div><span className="eyebrow">CONSULTA POR RIFA</span><h2>Puxa número</h2><p>Selecione a rifa e informe o número apurado. A busca considera somente pagamentos confirmados nessa rifa.</p><label>Rifa<select value={drawRaffleId} onChange={e => { setDrawRaffleId(e.target.value); setWinner(undefined); }}><option value="">Selecione...</option>{data?.raffles?.map(r => <option value={r.id} key={r.id}>{r.title} ({r.status === 'completed' ? 'encerrada' : r.status})</option>)}</select></label><label>Número apurado<input maxLength="3" value={drawNumber} onChange={e => setDrawNumber(e.target.value.replace(/\D/g, ''))} placeholder="472" /></label>{error && <p className="error">{error}</p>}<button className="btn primary wide" onClick={pull}>Localizar titular nessa rifa</button></div>{winner !== undefined && <div className="draw-result"><span>NÚMERO CONSULTADO</span><strong>#{fmt(Number(drawNumber))}</strong>{winner ? <><div className="winner-mini"><i>{winner.name.split(' ').map(x => x[0]).slice(0, 2).join('')}</i><div><small>TITULAR PAGO</small><b>{winner.name}</b><span>{winner.email} • {winner.phone}</span></div><BadgeCheck /></div><div className="winner-register"><label>Cidade<input value={winnerPlace.city} onChange={e => setWinnerPlace({ ...winnerPlace, city: e.target.value })} /></label><label>UF<input maxLength="2" value={winnerPlace.state} onChange={e => setWinnerPlace({ ...winnerPlace, state: e.target.value })} /></label><button className="btn primary wide" onClick={registerWinner}>Registrar ganhador e encerrar rifa</button></div></> : <p>Nenhuma compra paga desse número foi encontrada na rifa selecionada.</p>}</div>}</div>}

      {tab === 'Ganhadores' && <div className="orders-table">{!(data?.winners || []).length && <p>Nenhum ganhador registrado.</p>}{(data?.winners || []).map(w => <div className="winner-admin-line" key={w.id}><strong>#{fmt(w.number)}</strong><span><b>{w.name}</b><small>{w.raffleTitle} • {w.city || 'Cidade não informada'} {w.state || ''}</small></span></div>)}</div>}
    </section>
  </div>;
}

function RaffleForm({ form, setForm, editingId, saveRaffle, error }) {
  return <form className="raffle-form" onSubmit={saveRaffle}>
    <h3>{editingId ? 'Editar rifa' : 'Cadastrar nova rifa'}</h3>
    <label>Nome do carro/prêmio<input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
    <label>Descrição, ano e versão<input required value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })} /></label>
    <div className="form-row"><label>Preço atual por número (R$)<input required type="number" min=".01" step=".01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></label><label>Status<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option value="paused">Pausada</option><option value="active">Ativa</option><option value="completed">Encerrada</option></select></label></div>
    <div className="image-fields"><div className="images-title"><b>Fotos da rifa</b><span>A primeira será usada como capa.</span></div>{form.images.map((image, index) => <div className="image-field" key={index}><input required type="url" value={image} onChange={e => setForm({ ...form, images: form.images.map((value, i) => i === index ? e.target.value : value) })} placeholder={`URL da foto ${index + 1}`} />{form.images.length > 1 && <button type="button" onClick={() => setForm({ ...form, images: form.images.filter((_, i) => i !== index) })}><X size={15} /></button>}</div>)}<button type="button" className="add-image" onClick={() => setForm({ ...form, images: [...form.images, ''] })}>+ Adicionar outra foto</button></div>
    <label>Regra/data do sorteio<input required value={form.drawRule} onChange={e => setForm({ ...form, drawRule: e.target.value })} /></label>
    <p className="form-note">Alterar o preço só afeta compras futuras. Pedidos anteriores preservam o valor pago.</p>
    {error && <p className="error">{error}</p>}
    <button className="btn primary">{editingId ? 'Salvar alterações' : 'Criar rifa'}</button>
  </form>;
}

createRoot(document.getElementById('root')).render(<App />);
