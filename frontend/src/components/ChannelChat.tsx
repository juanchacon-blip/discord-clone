import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { io, Socket } from 'socket.io-client';
import Home from './Home';
import Settings from './Settings';
import { Avatar, Logo } from './ui';
import { API, fileHref, useAuthFetch } from '../api';

type DriveStatus = 'pending' | 'ok' | 'failed' | null;
type Msg = {
  id: number; author: string; content: string; channelId: number;
  fileName?: string; fileUrl?: string; mimeType?: string; driveStatus?: DriveStatus; createdAt?: string;
};

const BACKUP_LABEL: Record<string, string> = {
  pending: '☁️ respaldando en tu Drive...',
  ok: '☁️ respaldado en tu Drive',
  failed: '⚠️ no se pudo respaldar en tu Drive',
};
type Channel = { id: number; name: string; unread?: number };
type Aviso = { text: string; channelId?: number };

export default function ChannelChat({ isAdmin, onOpenAdmin }: { isAdmin: boolean; onOpenAdmin: () => void }) {
  const { getAccessTokenSilently, logout, user } = useAuth0();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [active, setActive] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [newName, setNewName] = useState('');
  const [unread, setUnread] = useState<Record<number, number>>({});
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [typing, setTyping] = useState<Record<string, number>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [online, setOnline] = useState(false);
  // Panel lateral en movil: cerrado por defecto (en escritorio siempre esta visible)
  const [menuOpen, setMenuOpen] = useState(false);
  // Nombre que eligio la persona (null = aun no se ha cargado; se usa el de su cuenta)
  const [profileName, setProfileName] = useState<string | null>(null);
  // Si volvemos de Google (?drive=ok | ?drive=error), se abre Configuracion con el resultado.
  const [driveResult] = useState(() => new URLSearchParams(window.location.search).get('drive'));
  const lastTyping = useRef(0);

  const authFetch = useAuthFetch();

  // Conexion del socket: el token se pide en cada (re)conexion.
  useEffect(() => {
    const s = io(API || undefined, {
      auth: (cb) => {
        getAccessTokenSilently().then(token => cb({ token })).catch(() => cb({}));
      },
    });
    setSocket(s);
    s.on('connect', () => setOnline(true));
    s.on('disconnect', () => setOnline(false));
    return () => { s.disconnect(); };
  }, [getAccessTokenSilently]);

  // Lista de canales. Se vuelve a pedir cuando el servidor avisa de cambios.
  const reload = useCallback(() => {
    authFetch('/channels')
      .then(r => (r.ok ? r.json() : []))
      .then((list: Channel[]) => {
        setChannels(list);
        // El servidor es quien recuerda que leiste: asi la bolita sobrevive a recargar o cerrar la pestaña.
        setUnread(Object.fromEntries(list.map(c => [c.id, c.unread ?? 0])));
        setActive(a => (a && list.some(c => c.id === a.id) ? a : null));
      })
      .catch(() => setChannels([]));
  }, [authFetch]);

  useEffect(() => { reload(); }, [reload]);

  // Le dice al servidor que ya leiste el canal (solo si la pestaña esta a la vista).
  const markRead = useCallback((id: number) => {
    if (document.visibilityState !== 'visible') return;
    authFetch(`/channels/${id}/read`, { method: 'POST' }).catch(() => undefined);
  }, [authFetch]);

  // Al volver a la pestaña, lo del canal abierto cuenta como leido.
  useEffect(() => {
    const onVisible = () => { if (active) markRead(active.id); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [active, markRead]);

  // Total sin leer en el titulo de la pestaña: "(3) Discord Clone"
  const baseTitle = useRef(document.title);
  const totalUnread = channels.reduce((n, c) => n + (c.id === active?.id ? 0 : unread[c.id] || 0), 0);
  useEffect(() => {
    document.title = totalUnread > 0 ? `(${totalUnread}) ${baseTitle.current}` : baseTitle.current;
  }, [totalUnread]);
  useEffect(() => () => { document.title = baseTitle.current; }, []);

  // Limpia ?drive=... de la URL y abre Configuracion si venimos de Google
  useEffect(() => {
    if (!driveResult) return;
    window.history.replaceState({}, '', window.location.pathname);
    const t = setTimeout(() => setShowSettings(true), 0);
    return () => clearTimeout(t);
  }, [driveResult]);

  useEffect(() => {
    authFetch('/profile')
      .then(r => (r.ok ? r.json() : null))
      .then(p => { if (p?.name) setProfileName(p.name); })
      .catch(() => undefined);
  }, [authFetch]);

  useEffect(() => {
    if (!socket) return;
    socket.on('channels:changed', reload);
    return () => { socket.off('channels:changed', reload); };
  }, [socket, reload]);

  useEffect(() => {
    if (!active || !socket) { setMessages([]); return; }
    const load = () => {
      authFetch(`/channels/${active.id}/messages`)
        .then(r => (r.ok ? r.json() : []))
        .then(setMessages)
        .catch(() => setMessages([]));
    };
    load();
    socket.on('connect', load);
    socket.on('messages:refresh', load); // alguien cambio su nombre: se vuelve a pedir el historial
    return () => { socket.off('connect', load); socket.off('messages:refresh', load); };
  }, [active, socket, authFetch]);

  useEffect(() => {
    if (!socket) return;
    const onMessage = (m: Msg) => {
      if (m.channelId === active?.id) {
        setMessages(prev => [...prev, m]);
        // Quien acaba de enviar ya no esta "escribiendo".
        setTyping(prev => Object.fromEntries(Object.entries(prev).filter(([name]) => name !== m.author)));
        markRead(m.channelId);
        return;
      }
      setUnread(u => ({ ...u, [m.channelId]: (u[m.channelId] || 0) + 1 }));
      const name = channels.find(c => c.id === m.channelId)?.name;
      setAviso({ text: `${m.author} escribio en #${name}`, channelId: m.channelId });
    };
    const onTyping = (t: { channelId: number; name: string }) => {
      if (t.channelId !== active?.id) return;
      setTyping(prev => ({ ...prev, [t.name]: Date.now() + 3000 }));
    };
    // Solo llega a quien subio el archivo: como va su respaldo en Drive.
    const onBackup = (b: { id: number; driveStatus: DriveStatus }) =>
      setMessages(prev => prev.map(m => (m.id === b.id ? { ...m, driveStatus: b.driveStatus } : m)));
    // Un administrador borro un mensaje, o solo su archivo.
    const onDeleted = (d: { id: number }) => setMessages(prev => prev.filter(m => m.id !== d.id));
    const onUpdated = (u: Msg) => setMessages(prev => prev.map(m => (m.id === u.id ? u : m)));
    socket.on('message', onMessage);
    socket.on('typing', onTyping);
    socket.on('message:backup', onBackup);
    socket.on('message:deleted', onDeleted);
    socket.on('message:updated', onUpdated);
    return () => {
      socket.off('message', onMessage);
      socket.off('typing', onTyping);
      socket.off('message:backup', onBackup);
      socket.off('message:deleted', onDeleted);
      socket.off('message:updated', onUpdated);
    };
  }, [socket, active, channels, markRead]);

  // Los avisos y los "escribiendo..." desaparecen solos.
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 5000);
    return () => clearTimeout(t);
  }, [aviso]);

  useEffect(() => {
    const t = setInterval(() => {
      setTyping(prev => {
        const now = Date.now();
        const next = Object.fromEntries(Object.entries(prev).filter(([, until]) => until > now));
        return Object.keys(next).length === Object.keys(prev).length ? prev : next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const openChannel = (c: Channel) => {
    setMenuOpen(false);
    setActive(c);
    setTyping({});
    setUnread(u => ({ ...u, [c.id]: 0 }));
    markRead(c.id);
  };

  const send = () => {
    if (!active || !socket || !text.trim()) return;
    // El autor lo pone el servidor a partir del token.
    socket.emit('message', { channelId: active.id, content: text });
    setText('');
  };

  const onType = (value: string) => {
    setText(value);
    if (!active || !socket || Date.now() - lastTyping.current < 2000) return;
    lastTyping.current = Date.now();
    socket.emit('typing', active.id);
  };

  const upload = async (file?: File) => {
    if (!active || !file) return;
    const body = new FormData();
    body.append('file', file);
    const res = await authFetch(`/channels/${active.id}/files`, { method: 'POST', body });
    if (!res.ok) return setAviso({ text: 'No se pudo subir el archivo (maximo 10 MB)' });
    // El mensaje del archivo le llega al autor tambien por el socket, pero aqui trae
    // el estado del respaldo: lo usamos para mostrarlo ya mismo.
    const saved: Msg = await res.json();
    setMessages(prev => prev.map(m => (m.id === saved.id ? { ...m, driveStatus: saved.driveStatus } : m)));
  };

  const createChannel = async () => {
    if (!newName.trim()) return;
    const res = await authFetch('/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (!res.ok) return;
    setNewName('');
    reload();
  };

  const typers = Object.keys(typing);
  const me = profileName ?? (user?.nickname || user?.name || '').slice(0, 32);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages.length, active?.id]);
  const goHome = () => { setMenuOpen(false); setActive(null); setTyping({}); };

  return (
    <div className="relative flex h-dvh gap-2 overflow-hidden p-2 md:gap-3 md:p-3">
      {showSettings && <Settings authFetch={authFetch} driveResult={driveResult} onNameChange={setProfileName} onClose={() => setShowSettings(false)} />}

      {/* Fondo oscuro que cierra el panel al tocarlo (solo movil) */}
      {menuOpen && <div className="animate-fade fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setMenuOpen(false)} aria-hidden />}

      {/* ───────── Barra lateral: cajon deslizable en movil, fija desde md ───────── */}
      <aside id="sidebar"
        className={`glass-deep fixed inset-y-2 left-2 z-40 flex w-72 max-w-[85vw] flex-col rounded-3xl p-3 transition-[translate,visibility] duration-300 ease-out md:static md:z-auto md:w-64 md:max-w-none md:shrink-0 md:translate-x-0 md:visible ${menuOpen ? 'translate-x-0 visible' : '-translate-x-[110%] invisible'}`}>
        <button onClick={goHome} className="mb-4 flex items-center gap-3 rounded-2xl p-1 text-left transition hover:bg-white/5">
          <Logo size={38} />
          <span className="text-gradient text-xl font-extrabold tracking-tight">Nebula</span>
        </button>

        <button onClick={goHome}
          className={`mb-1 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${!active ? 'bg-violet-500/20 text-white shadow-[inset_0_0_0_1px_rgba(196,181,253,.3)]' : 'text-violet-200/70 hover:bg-white/5 hover:text-white'}`}>
          <span aria-hidden>◈</span> Inicio
        </button>
        <p className="mb-1 mt-4 px-3 text-[11px] font-semibold uppercase tracking-[.18em] text-violet-300/50">Canales</p>

        <nav className="-mx-1 flex-1 space-y-1 overflow-y-auto px-1">
          {channels.map(c => {
            const n = c.id === active?.id ? 0 : unread[c.id] || 0;
            const isActive = c.id === active?.id;
            return (
              <button key={c.id} onClick={() => openChannel(c)}
                className={`relative flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition-all duration-200 ${isActive ? 'bg-violet-500/20 text-white shadow-[inset_0_0_0_1px_rgba(196,181,253,.3)]' : 'hover:translate-x-0.5 hover:bg-white/5'} ${n > 0 ? 'font-bold text-white' : isActive ? 'font-semibold' : 'text-violet-200/70'}`}>
                {isActive && <span className="absolute -left-1 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-gradient-to-b from-violet-400 to-fuchsia-400 shadow-[0_0_10px_rgba(217,70,239,.9)]" />}
                <span className="truncate"><span className="text-violet-400/70">#</span> {c.name}</span>
                {n > 0 && (
                  <span className="animate-pop min-w-5 shrink-0 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 px-1.5 text-center text-xs font-bold text-white shadow-[0_0_14px_rgba(217,70,239,.65)]"
                    title={`${n} mensaje(s) sin leer`}>
                    {n > 99 ? '99+' : n}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="mt-3 flex gap-2">
          <input className="input-glass min-w-0 flex-1 rounded-xl px-3 py-2 text-sm" placeholder="Nuevo canal" value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createChannel()} />
          <button className="btn-glow grid h-9 w-9 shrink-0 place-items-center rounded-xl text-lg font-bold" onClick={createChannel} aria-label="Crear canal" title="Crear canal">+</button>
        </div>

        <div className="mt-3 border-t border-white/10 pt-3">
          <div className="mb-2 flex items-center gap-2">
            <Avatar name={me} />
            <p className="min-w-0 flex-1 truncate text-sm font-semibold">{me}</p>
          </div>
          <div className="grid gap-1.5 text-sm">
            {isAdmin && <button className="btn-ghost rounded-xl px-3 py-2 text-left !text-amber-200 !border-amber-300/30" onClick={() => { setMenuOpen(false); onOpenAdmin(); }}>🛡️ Administración</button>}
            <button className="btn-ghost rounded-xl px-3 py-2 text-left" onClick={() => { setMenuOpen(false); setShowSettings(true); }}>⚙️ Configuración</button>
            <button className="btn-ghost rounded-xl px-3 py-2 text-left"
              onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}>
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>

      {/* ───────── Zona principal ───────── */}
      <main className="glass relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-3xl">
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button className="btn-ghost relative grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl md:hidden"
              onClick={() => setMenuOpen(true)} aria-label="Abrir menú" aria-controls="sidebar" aria-expanded={menuOpen}>
              ☰
              {totalUnread > 0 && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-[0_0_10px_rgba(217,70,239,.9)]" aria-label="Hay mensajes sin leer" />}
            </button>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-500/20 text-lg font-bold text-lavender">{active ? '#' : '◈'}</span>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold leading-tight">{active ? active.name : 'Inicio'}</h1>
              <p className="truncate text-xs text-violet-200/60">{active ? 'Conversación en vivo' : 'Tu panel de Nebula'}</p>
            </div>
          </div>
          <span className={`flex shrink-0 items-center gap-2 text-xs ${online ? 'text-emerald-300' : 'text-amber-300'}`}>
            <span className="relative flex h-2 w-2">
              {online && <span className="animate-ping-soft absolute inset-0 rounded-full bg-emerald-400" />}
              <span className={`relative h-2 w-2 rounded-full ${online ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            </span>
            {online ? 'Conectado' : 'Reconectando…'}
          </span>
        </header>

        {aviso && (
          <button className="glass-deep animate-pop absolute inset-x-0 top-20 z-20 mx-auto w-fit max-w-[90%] rounded-full px-5 py-2.5 text-sm shadow-[0_10px_40px_-8px_rgba(168,85,247,.7)]" onClick={() => {
            const c = channels.find(ch => ch.id === aviso.channelId);
            if (c) openChannel(c);
            setAviso(null);
          }}>
            🔔 {aviso.text}
          </button>
        )}

        <div key={active?.id ?? 'inicio'} className="animate-fade flex min-h-0 flex-1 flex-col">
          {!active ? (
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              <Home name={me || 'viajero'} channels={channels} unread={unread} onOpen={openChannel}
                onOpenSettings={() => setShowSettings(true)} authFetch={authFetch} />
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-4 py-5 md:px-8">
                <div className="mx-auto flex max-w-3xl flex-col gap-4">
                  {messages.length === 0 && <p className="mt-16 text-center text-violet-200/50">Aún no hay mensajes. ¡Rompe el hielo! ✨</p>}
                  {messages.map(m => {
                    const mine = m.author === me;
                    return (
                      <div key={m.id} className={`animate-rise flex gap-3 ${mine ? 'flex-row-reverse' : ''}`}>
                        {!mine && <Avatar name={m.author} />}
                        <div className={`flex min-w-0 max-w-[82%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
                          <p className="mb-1 flex items-baseline gap-2 text-xs">
                            <b className="text-lavender">{mine ? 'Tú' : m.author}</b>
                            {m.createdAt && <span className="text-violet-300/40">{new Date(m.createdAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</span>}
                          </p>
                          {m.content && (
                            <p className={`break-words rounded-2xl px-4 py-2.5 text-left leading-relaxed ${mine ? 'rounded-tr-md bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-[0_8px_26px_-10px_rgba(192,38,211,.9)]' : 'glass rounded-tl-md'}`}>
                              {m.content}
                            </p>
                          )}
                          {m.fileUrl && m.mimeType?.startsWith('image/') ? (
                            <a href={fileHref(m.fileUrl)} target="_blank" rel="noreferrer"
                              className="group mt-1 block overflow-hidden rounded-2xl border border-white/15 shadow-[0_12px_40px_-14px_rgba(139,92,246,.8)]">
                              <img src={fileHref(m.fileUrl)} alt={m.fileName} loading="lazy"
                                className="max-h-72 max-w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
                            </a>
                          ) : (
                            m.fileUrl && <a className="btn-ghost mt-1 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm" href={fileHref(m.fileUrl)} target="_blank" rel="noreferrer">📎 {m.fileName}</a>
                          )}
                          {m.fileUrl && m.driveStatus && BACKUP_LABEL[m.driveStatus] && <span className="mt-1 text-[11px] text-violet-300/60">{BACKUP_LABEL[m.driveStatus]}</span>}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={endRef} />
                </div>
              </div>

              <div className="h-7 px-6 text-xs text-violet-200/80 md:px-10">
                {typers.length > 0 && (
                  <span className="animate-fade inline-flex items-center gap-2">
                    <span className="flex gap-1" aria-hidden>
                      {[0, 1, 2].map(i => <span key={i} className="animate-dot h-1.5 w-1.5 rounded-full bg-lavender" style={{ animationDelay: `${i * 0.16}s` }} />)}
                    </span>
                    <span><b>{typers.join(', ')}</b> {typers.length === 1 ? 'está' : 'están'} escribiendo…</span>
                  </span>
                )}
              </div>

              <div className="p-3 pt-0 md:p-4 md:pt-0">
                <div className="glass-deep mx-auto flex max-w-3xl items-center gap-2 rounded-full p-1.5 pl-2">
                  <label className="btn-ghost grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full text-lg" title="Adjuntar archivo">
                    📎
                    <input type="file" className="hidden"
                      onChange={e => { upload(e.target.files?.[0]); e.target.value = ''; }} />
                  </label>
                  <input className="min-w-0 flex-1 bg-transparent px-2 py-2 text-[15px] outline-none placeholder:text-violet-300/40"
                    placeholder={`Escribe en #${active.name}…`} value={text}
                    onChange={e => onType(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && send()} />
                  <button className="btn-glow rounded-full px-5 py-2.5 text-sm font-semibold" onClick={send}>Enviar</button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
