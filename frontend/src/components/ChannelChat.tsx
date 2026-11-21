import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { io, Socket } from 'socket.io-client';
import Settings from './Settings';
import { API, fileHref, useAuthFetch } from '../api';

type DriveStatus = 'pending' | 'ok' | 'failed' | null;
type Msg = {
  id: number; author: string; content: string; channelId: number;
  fileName?: string; fileUrl?: string; mimeType?: string; driveStatus?: DriveStatus;
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
    return () => { socket.off('connect', load); };
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

  const openChannel = (c: Channel) => {
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

  return (
    <div className="flex h-screen">
      {showSettings && <Settings authFetch={authFetch} driveResult={driveResult} onClose={() => setShowSettings(false)} />}
      <aside className="w-32 md:w-48 bg-gray-800 text-white p-2 flex flex-col">
        <div className="flex-1">
          {channels.map(c => {
            const n = c.id === active?.id ? 0 : unread[c.id] || 0;
            return (
              <button key={c.id} onClick={() => openChannel(c)}
                className={`flex w-full items-center justify-between gap-1 p-1 text-left hover:bg-gray-700 ${c.id === active?.id ? 'bg-gray-700' : ''} ${n > 0 ? 'font-bold' : 'text-gray-300'}`}>
                <span className="truncate"># {c.name}</span>
                {n > 0 && (
                  <span className="min-w-5 shrink-0 rounded-full bg-red-600 px-1.5 text-center text-xs font-bold text-white"
                    title={`${n} mensaje(s) sin leer`}>
                    {n > 99 ? '99+' : n}
                  </span>
                )}
              </button>
            );
          })}
          <input className="w-full mt-2 p-1 text-black" placeholder="nuevo canal" value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createChannel()} />
          <button className="w-full mt-1 border p-1" onClick={createChannel}>Crear canal</button>
        </div>
        <div className="mt-2 text-sm">
          {isAdmin && <button className="w-full mb-2 border border-yellow-400 p-1 text-yellow-300" onClick={onOpenAdmin}>🛡️ Administracion</button>}
          <button className="w-full mb-2 border p-1" onClick={() => setShowSettings(true)}>⚙️ Configuracion</button>
          <p className="truncate">{user?.nickname || user?.name}</p>
          <button className="w-full mt-1 border p-1"
            onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}>
            Cerrar sesion
          </button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col">
        {aviso && (
          <button className="bg-yellow-200 p-2 text-left" onClick={() => {
            const c = channels.find(ch => ch.id === aviso.channelId);
            if (c) openChannel(c);
            setAviso(null);
          }}>
            🔔 {aviso.text}
          </button>
        )}
        <div className="flex-1 overflow-y-auto p-2">
          {!active && <p className="text-gray-500">Elige un canal</p>}
          {messages.map(m => (
            <div key={m.id} className="mb-1">
              <b>{m.author}:</b> {m.content}
              {m.fileUrl && m.mimeType?.startsWith('image/') ? (
                <a href={fileHref(m.fileUrl)} target="_blank" rel="noreferrer" className="block mt-1">
                  <img src={fileHref(m.fileUrl)} alt={m.fileName} loading="lazy" className="max-h-64 max-w-xs rounded border" />
                </a>
              ) : (
                m.fileUrl && <a className="text-blue-600 underline" href={fileHref(m.fileUrl)} target="_blank" rel="noreferrer">📎 {m.fileName}</a>
              )}
              {m.fileUrl && m.driveStatus && <span className="block text-xs text-gray-500">{BACKUP_LABEL[m.driveStatus]}</span>}
            </div>
          ))}
        </div>
        <p className="h-6 px-3 text-sm italic text-gray-700">
          {typers.length > 0 && (
            <>
              <span className="mr-1 inline-block animate-pulse">✍️</span>
              <b>{typers.join(', ')}</b> {typers.length === 1 ? 'está' : 'están'} escribiendo…
            </>
          )}
        </p>
        <div className="flex p-2 gap-2">
          <label className="border px-3 cursor-pointer">
            📎
            <input type="file" className="hidden"
              onChange={e => { upload(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          <input className="flex-1 border p-1" value={text}
            onChange={e => onType(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()} />
          <button className="border px-3" onClick={send}>Enviar</button>
        </div>
      </main>
    </div>
  );
}
