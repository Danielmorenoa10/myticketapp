import React, { useEffect, useMemo, useState } from 'react';

const api = async (url, options = {}) => {
  const token = localStorage.getItem('mitickets_token');
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Ocurrió un error.');
  return data;
};

const roleLabel = role => role === 'Administrador' ? 'Administrador' : role === 'Agente de soporte' ? 'Agente de soporte' : 'Usuario';
const initials = name => (name || 'U').split(' ').slice(0, 2).map(x => x[0]).join('').toUpperCase();

function Login({ onLogin }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submit = async e => {
    e.preventDefault(); setError(''); setLoading(true);
    try { const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(form) }); localStorage.setItem('mitickets_token', data.token); localStorage.setItem('mitickets_user', JSON.stringify(data.user)); onLogin(data.user); }
    catch (err) { setError(err.message); } finally { setLoading(false); }
  };
  return <div className="auth-page">
    <div className="auth-decoration"><div className="orb orb-a"/><div className="orb orb-b"/><div className="auth-copy"><span className="brand-mark">M</span><h1>Soporte IT, seguimiento a tus requerimientos </h1><p>Centraliza solicitudes, asignaciones y seguimiento en un solo lugar.</p><div className="feature-list"><span>✓ Gestión de tickets</span><span>✓ Seguimiento por estados</span><span>✓ Atención por roles</span></div></div></div>
    <div className="auth-panel"><div className="mobile-brand"><span className="brand-mark small">M</span><b>Mitickets</b></div><div className="auth-box"><span className="eyebrow">PLATAFORMA DE SOPORTE</span><h2>Bienvenido de nuevo</h2><p className="muted">Ingresa para continuar a tu espacio de trabajo.</p>
      <form onSubmit={submit} className="form-stack"><label>Correo electrónico<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="tu@correo.com" required /></label><label>Contraseña<input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="••••••••" required /></label>{error && <div className="alert error">{error}</div>}<button className="btn primary full" disabled={loading}>{loading ? 'Ingresando…' : 'Iniciar sesión'}</button></form>
      <div className="demo-box"><b>Usuarios de prueba</b><span>admin@mytickets.com · Admin123*</span><span>agente@mytickets.com · Agente123*</span><span>usuario@mytickets.com · Usuario123*</span></div>
    </div></div>
  </div>;
}

function Layout({ user, page, setPage, children, onLogout }) {
  const nav = [
    ['dashboard','Dashboard','▦'],
    ['tickets','Tickets','▤'],
    ...(user.role !== 'Usuario' ? [['create','Crear ticket','＋']] : [['create','Nuevo ticket','＋']])
  ];
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand-mark">M</span><div><b>Mytickets</b><small>Soporte TI</small></div></div><nav>{nav.map(([id,label,icon])=><button key={id} className={page===id?'active':''} onClick={()=>setPage(id)}><span>{icon}</span>{label}</button>)}</nav><div className="sidebar-bottom"><div className="support-card"><span>●</span><div><b>Servicio activo</b><small>Centro de soporte</small></div></div><button className="logout" onClick={onLogout}>↪ Cerrar sesión</button></div></aside><main className="main"><header className="topbar"><div><span className="eyebrow">{roleLabel(user.role)}</span><h1>{page==='dashboard'?'Dashboard':page==='tickets'?'Tickets':'Crear ticket'}</h1></div><div className="user-menu"><div className="avatar">{initials(user.name)}</div><div><b>{user.name}</b><small>{user.email}</small></div></div></header>{children}</main></div>;
}

function Dashboard({ user, refreshKey, setPage }) {
  const [data,setData]=useState(null); const [error,setError]=useState('');
  useEffect(()=>{api('/api/dashboard').then(setData).catch(e=>setError(e.message));},[refreshKey]);
  const statusMap = { 'Abierto':'open','En proceso':'progress','Resuelto':'resolved','Cerrado':'closed' };
  return <section className="content"><div className="hero"><div><span className="eyebrow">RESUMEN DE ACTIVIDAD</span><h2>{user.role==='Administrador'?'Todo bajo control.':'Tus tickets, en un solo lugar.'}</h2><p>{user.role==='Administrador'?'Supervisa la operación completa de soporte.':'Consulta y gestiona las solicitudes que tienes a cargo.'}</p></div><button className="btn primary" onClick={()=>setPage('create')}>＋ Crear ticket</button></div>{error&&<div className="alert error">{error}</div>}<div className="stats-grid"><div className="stat-card featured"><span>Total de tickets</span><strong>{data?.total ?? '—'}</strong><small>Registros visibles para tu rol</small></div>{(data?.byStatus||[]).map(s=><div className="stat-card" key={s.status}><div className={`status-dot ${statusMap[s.status]||''}`}/><span>{s.status}</span><strong>{s.total}</strong></div>)}</div><div className="section-heading"><div><span className="eyebrow">OPERACIÓN</span><h3>Estado de los tickets</h3></div><button className="text-btn" onClick={()=>setPage('tickets')}>Ver tickets →</button></div><div className="status-board">{(data?.byStatus||[]).map(s=><div className="status-row" key={s.status}><div className={`status-dot ${statusMap[s.status]||''}`}/><b>{s.status}</b><div className="bar"><i style={{width:`${data?.total?Math.max(4,Number(s.total)/data.total*100):0}%`}}/></div><strong>{s.total}</strong></div>)}</div></section>;
}

function Tickets({ user, setSelected }) {
  const [tickets,setTickets]=useState([]); const [loading,setLoading]=useState(true); const [search,setSearch]=useState(''); const [filter,setFilter]=useState('Todos'); const [error,setError]=useState('');
  const load=()=>{setLoading(true);api('/api/tickets').then(setTickets).catch(e=>setError(e.message)).finally(()=>setLoading(false));};
  useEffect(load,[]);
  const filtered=useMemo(()=>tickets.filter(t=>(filter==='Todos'||t.status===filter)&&`${t.id} ${t.title} ${t.category} ${t.priority} ${t.status}`.toLowerCase().includes(search.toLowerCase())),[tickets,search,filter]);
  return <section className="content"><div className="toolbar"><div className="search"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar tickets..."/></div><select value={filter} onChange={e=>setFilter(e.target.value)}><option>Todos</option><option>Abierto</option><option>En proceso</option><option>Resuelto</option><option>Cerrado</option></select></div>{error&&<div className="alert error">{error}</div>}<div className="table-card"><div className="table-head"><b>Tickets</b><span>{filtered.length} resultado(s)</span></div>{loading?<div className="empty">Cargando tickets…</div>:filtered.length===0?<div className="empty">No hay tickets que coincidan con la búsqueda.</div>:<div className="table-wrap"><table><thead><tr><th>Ticket</th><th>Solicitante</th><th>Categoría</th><th>Prioridad</th><th>Estado</th><th>Agente</th><th></th></tr></thead><tbody>{filtered.map(t=><tr key={t.id}><td><button className="ticket-link" onClick={()=>setSelected(t.id)}>#{t.id} · {t.title}</button><small>{new Date(t.created_at).toLocaleString('es-CO')}</small></td><td>{t.requester}</td><td>{t.category}</td><td><span className={`pill priority-${t.priority.toLowerCase()}`}>{t.priority}</span></td><td><span className="status-pill">{t.status}</span></td><td>{t.agent||'Sin asignar'}</td><td><button className="icon-btn" onClick={()=>setSelected(t.id)}>→</button></td></tr>)}</tbody></table></div>}</div></section>;
}

function CreateTicket({ catalogs, onCreated, user }) {
  const [form,setForm]=useState({title:'',description:'',category_id:'',priority_id:''}); const [saving,setSaving]=useState(false); const [message,setMessage]=useState(null);
  const submit=async e=>{e.preventDefault();setSaving(true);setMessage(null);try{await api('/api/tickets',{method:'POST',body:JSON.stringify(form)});setForm({title:'',description:'',category_id:'',priority_id:''});setMessage({type:'success',text:'Ticket creado correctamente.'});onCreated();}catch(err){setMessage({type:'error',text:err.message});}finally{setSaving(false)}};
  return <section className="content narrow"><div className="form-card"><div className="card-title"><div><span className="eyebrow">NUEVA SOLICITUD</span><h2>Describe tu solicitud</h2><p>Cuentanos el problema con suficiente detalle para agilizar la atención.</p></div><div className="ticket-symbol">＋</div></div><form onSubmit={submit} className="form-grid"><label className="span-2">Asunto<input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Ej. Mi computador no inicia" required/></label><label>Categoría<select value={form.category_id} onChange={e=>setForm({...form,category_id:e.target.value})} required><option value="">Selecciona una categoría</option>{catalogs.categories.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></label><label>Prioridad<select value={form.priority_id} onChange={e=>setForm({...form,priority_id:e.target.value})} required><option value="">Selecciona prioridad</option>{catalogs.priorities.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></label><label className="span-2">Descripción<textarea rows="7" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Una pequeña descripción del problema que presentas" required/></label>{message&&<div className={`alert ${message.type} span-2`}>{message.text}</div>}<div className="form-actions span-2"><span>Solicitante: <b>{user.name}</b></span><button className="btn primary" disabled={saving}>{saving?'Creando…':'Crear ticket'}</button></div></form></div></section>;
}

function TicketDetail({ id, catalogs, user, onBack, onChanged }) {
  const [data,setData]=useState(null); const [comment,setComment]=useState(''); const [message,setMessage]=useState(null);
  const load=()=>api(`/api/tickets/${id}`).then(setData).catch(e=>setMessage({type:'error',text:e.message}));
  useEffect(load,[id]);
  if(!data) return <section className="content"><button className="text-btn" onClick={onBack}>← Volver</button><div className="empty">{message?.text||'Cargando ticket…'}</div></section>;
  const canManage=user.role!=='Usuario';
  const update=async(type,value)=>{try{await api(`/api/tickets/${id}/${type}`,{method:'PATCH',body:JSON.stringify(value)});await load();onChanged();}catch(e){setMessage({type:'error',text:e.message})}};
  const addComment=async e=>{e.preventDefault();if(!comment.trim())return;try{await api(`/api/tickets/${id}/comments`,{method:'POST',body:JSON.stringify({content:comment})});setComment('');await load();}catch(e){setMessage({type:'error',text:e.message})}};
  return <section className="content"><button className="text-btn back" onClick={onBack}>← Volver a tickets</button>{message&&<div className={`alert ${message.type}`}>{message.text}</div>}<div className="detail-grid"><div className="detail-main"><div className="detail-card"><div className="detail-top"><div><span className="eyebrow">TICKET #{data.ticket.id}</span><h2>{data.ticket.title}</h2><p>{data.ticket.description}</p></div><span className="status-pill large">{data.ticket.status}</span></div><div className="meta-grid"><div><small>Categoría</small><b>{data.ticket.category}</b></div><div><small>Prioridad</small><b>{data.ticket.priority}</b></div><div><small>Solicitante</small><b>{data.ticket.requester}</b></div><div><small>Agente</small><b>{data.ticket.agent||'Sin asignar'}</b></div></div></div><div className="detail-card"><div className="section-heading"><div><span className="eyebrow">CONVERSACIÓN</span><h3>Comentarios</h3></div></div>{data.comments.length===0?<div className="empty small">Todavía no hay comentarios.</div>:<div className="comments">{data.comments.map(c=><div className="comment" key={c.id}><div className="avatar mini">{initials(c.author)}</div><div><b>{c.author}</b><span>{c.role} · {new Date(c.created_at).toLocaleString('es-CO')}</span><p>{c.content}</p></div></div>)}</div>}<form className="comment-form" onSubmit={addComment}><textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="Escribe un comentario…" rows="3"/><button className="btn primary">Comentar</button></form></div></div><aside className="detail-side"><div className="detail-card"><span className="eyebrow">GESTIÓN</span><h3>Estado</h3>{canManage?<select value={catalogs.statuses.find(s=>s.name===data.ticket.status)?.id||''} onChange={e=>update('status',{status_id:Number(e.target.value)})}>{catalogs.statuses.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select>:<div className="readonly-status">{data.ticket.status}</div>}{canManage&&<><h3 className="side-label">Asignar agente</h3><select value={data.ticket.assigned_to||''} onChange={e=>e.target.value&&update('assign',{agent_id:Number(e.target.value)})}><option value="">Selecciona agente</option>{catalogs.agents.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select></>}</div><div className="detail-card"><span className="eyebrow">INFORMACIÓN</span><div className="info-line"><span>Creado</span><b>{new Date(data.ticket.created_at).toLocaleDateString('es-CO')}</b></div><div className="info-line"><span>Actualizado</span><b>{new Date(data.ticket.updated_at).toLocaleDateString('es-CO')}</b></div></div></aside></div></section>;
}

function App(){
  const [user,setUser]=useState(()=>JSON.parse(localStorage.getItem('mitickets_user')||'null')); const [page,setPage]=useState('dashboard'); const [selected,setSelected]=useState(null); const [catalogs,setCatalogs]=useState({categories:[],priorities:[],statuses:[],agents:[]}); const [refreshKey,setRefreshKey]=useState(0);
  useEffect(()=>{if(user) api('/api/catalogs').then(setCatalogs).catch(console.error)},[user]);
  const logout=()=>{localStorage.removeItem('mitickets_token');localStorage.removeItem('mitickets_user');setUser(null);};
  if(!user) return <Login onLogin={setUser}/>;
  const goTickets=()=>{setSelected(null);setPage('tickets');setRefreshKey(x=>x+1)};
  let view=page==='dashboard'?<Dashboard user={user} refreshKey={refreshKey} setPage={setPage}/>:selected?<TicketDetail id={selected} catalogs={catalogs} user={user} onBack={goTickets} onChanged={()=>setRefreshKey(x=>x+1)}/>:page==='tickets'?<Tickets user={user} setSelected={setSelected}/>:<CreateTicket catalogs={catalogs} user={user} onCreated={()=>setRefreshKey(x=>x+1)}/>;
  return <Layout user={user} page={page} setPage={p=>{setSelected(null);setPage(p)}} onLogout={logout}>{view}</Layout>;
}

export default App;
