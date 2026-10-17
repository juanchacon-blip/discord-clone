import { useCallback, useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { io, Socket } from 'socket.io-client';

// En desarrollo apunta a http://localhost:3000 (ver .env).
// En produccion queda vacio: el backend sirve el frontend, asi que usa el mismo dominio.
const API: string = import.meta.env.VITE_API_URL || '';

type Msg = { id: number; author: string; content: string };
type Channel = { id: number; name: string };

export default function ChannelChat() {
  const { getAccessTokenSilently, logout, user } = useAuth0();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [active, setActive] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [newName, setNewName] = useState('');

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

  useEffect(() => {
    authFetch('/channels')
      .then(r => (r.ok ? r.json() : []))
      .then(setChannels)
      .catch(() => setChannels([]));
  }, [authFetch]);

  useEffect(() => {
    if (!active || !socket) return;
    const load = () => {
      authFetch(`/channels/${active.id}/messages`)
        .then(r => (r.ok ? r.json() : []))
        .then(setMessages)
        .catch(() => setMessages([]));
      socket.emit('join', active.id);
    };
    load();
    const onMessage = (m: Msg) => setMessages(prev => [...prev, m]);
    socket.on('message', onMessage);
    socket.on('connect', load);
    return () => {
      socket.off('message', onMessage);
      socket.off('connect', load);
    };
  }, [active, socket, authFetch]);

  const send = () => {
    if (!active || !socket || !text.trim()) return;
    // El autor lo pone el servidor a partir del token.
    socket.emit('message', { channelId: active.id, content: text });
    setText('');
  };

  const createChannel = async () => {
    if (!newName.trim()) return;
    const res = await authFetch('/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (!res.ok) return;
    const created = await res.json();
    setChannels(prev => [...prev, created]);
    setNewName('');
  };

  return (
    <div className="flex h-screen">
      <aside className="w-32 md:w-48 bg-gray-800 text-white p-2 flex flex-col">
        <div className="flex-1">
          {channels.map(c => (
            <button key={c.id} onClick={() => setActive(c)} className="block w-full text-left p-1 hover:bg-gray-700">
              # {c.name}
            </button>
          ))}
          <input className="w-full mt-2 p-1 text-black" placeholder="nuevo canal" value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createChannel()} />
          <button className="w-full mt-1 border p-1" onClick={createChannel}>Crear canal</button>
        </div>
        <div className="mt-2 text-sm">
          <p className="truncate">{user?.nickname || user?.name}</p>
          <button className="w-full mt-1 border p-1"
            onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}>
            Cerrar sesion
          </button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-2">
          {messages.map(m => <p key={m.id}><b>{m.author}:</b> {m.content}</p>)}
        </div>
        <div className="flex p-2 gap-2">
          <input className="flex-1 border p-1" value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()} />
          <button className="border px-3" onClick={send}>Enviar</button>
        </div>
      </main>
    </div>
  );
}
