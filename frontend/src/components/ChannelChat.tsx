import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { io, Socket } from 'socket.io-client';

// En desarrollo apunta a http://localhost:3000 (ver .env).
// En produccion queda vacio: el backend sirve el frontend, asi que usa el mismo dominio.
const API: string = import.meta.env.VITE_API_URL || '';

type DriveStatus = 'pending' | 'ok' | 'failed' | null;
type Msg = {
  id: number; author: string; content: string; channelId: number;
  fileName?: string; fileUrl?: string; mimeType?: string; driveStatus?: DriveStatus;
};
type DriveInfo = { enabled: boolean; connected: boolean; email?: string | null };

// Con Supabase la URL ya viene completa (https://...); con disco local es relativa al backend.
const fileHref = (url: string) => (url.startsWith('http') ? url : `${API}${url}`);
const BACKUP_LABEL: Record<string, string> = {
  pending: '☁️ respaldando en tu Drive...',
  ok: '☁️ respaldado en tu Drive',
  failed: '⚠️ no se pudo respaldar en tu Drive',
};
type Channel = { id: number; name: string };
type Aviso = { text: string; channelId?: number };

export default function ChannelChat() {
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
  const [drive, setDrive] = useState<DriveInfo | null>(null);
  const lastTyping = useRef(0);

  // fetch que agrega el token de Auth0
  const authFetch = useCallback(async (path: string, init: RequestInit = {}) => {
    const token = await getAccessTokenSilently();
    return fetch(`${API}${path}`, {
      ...init,
      headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` },
    });
  }, [getAccessTokenSilently]);

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
        setActive(a => (a && list.some(c => c.id === a.id) ? a : null));
      })
      .catch(() => setChannels([]));
  }, [authFetch]);

  useEffect(() => { reload(); }, [reload]);

  // Estado de Google Drive de esta cuenta
  const loadDrive = useCallback(() => {
    authFetch('/drive/status')
      .then(r => (r.ok ? r.json() : null))
      .then(setDrive)
      .catch(() => setDrive(null));
  }, [authFetch]);

  useEffect(() => { loadDrive(); }, [loadDrive]);

  // Al volver de la pantalla de permisos de Google (?drive=ok | ?drive=error)
  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get('drive');
    if (!result) return;
    window.history.replaceState({}, '', window.location.pathname);
    setAviso({ text: result === 'ok' ? 'Google Drive conectado' : 'No se pudo conectar Google Drive' });
  }, []);

  const connectDrive = async () => {
    const res = await authFetch('/drive/auth-url');
    if (!res.ok) return setAviso({ text: 'Google Drive no esta disponible en este servidor' });
    const { url } = await res.json();
    window.location.href = url;
  };

  const disconnectDrive = async () => {
    if (!window.confirm('¿Desconectar tu Google Drive? Tus respaldos anteriores se quedan en tu Drive.')) return;
    await authFetch('/drive', { method: 'DELETE' });
    loadDrive();
  };

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
    socket.on('message', onMessage);
    socket.on('typing', onTyping);
    socket.on('message:backup', onBackup);
    return () => {
      socket.off('message', onMessage);
      socket.off('typing', onTyping);
      socket.off('message:backup', onBackup);
    };
  }, [socket, active, channels]);

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
      <aside className="w-32 md:w-48 bg-gray-800 text-white p-2 flex flex-col">
        <div className="flex-1">
          {channels.map(c => (
            <button key={c.id} onClick={() => openChannel(c)} className="block w-full text-left p-1 hover:bg-gray-700">
              # {c.name}
              {unread[c.id] > 0 && <span className="ml-1 rounded-full bg-red-600 px-2 text-xs">{unread[c.id]}</span>}
            </button>
          ))}
          <input className="w-full mt-2 p-1 text-black" placeholder="nuevo canal" value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createChannel()} />
          <button className="w-full mt-1 border p-1" onClick={createChannel}>Crear canal</button>
        </div>
        <div className="mt-2 text-sm">
          {drive?.enabled && (drive.connected ? (
            <div className="mb-2">
              <p className="truncate text-green-400" title={drive.email ?? ''}>☁️ Drive: {drive.email || 'conectado'}</p>
              <button className="w-full mt-1 border p-1 text-xs" onClick={disconnectDrive}>Desconectar Drive</button>
            </div>
          ) : (
            <button className="w-full mb-2 border p-1" onClick={connectDrive}>☁️ Conectar Google Drive</button>
          ))}
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
        <p className="px-2 text-sm text-gray-500 h-5">
          {typers.length > 0 && `${typers.join(', ')} ${typers.length === 1 ? 'esta' : 'estan'} escribiendo...`}
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
