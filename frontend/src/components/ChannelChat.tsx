import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const API = import.meta.env.VITE_API_URL;
const socket = io(API);

type Msg = { id: number; author: string; content: string };
type Channel = { id: number; name: string };

export default function ChannelChat({ username }: { username: string }) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [active, setActive] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');

  useEffect(() => {
    fetch(`${API}/channels`).then(r => r.json()).then(setChannels);
  }, []);

  useEffect(() => {
    if (!active) return;
    const load = () => {
      fetch(`${API}/channels/${active.id}/messages`).then(r => r.json()).then(setMessages);
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
  }, [active]);

  const send = () => {
    if (!active || !text.trim()) return;
    socket.emit('message', { channelId: active.id, author: username, content: text });
    setText('');
  };

  return (
    <div className="flex h-screen">
      <aside className="w-32 md:w-48 bg-gray-800 text-white p-2">
        {channels.map(c => (
          <button key={c.id} onClick={() => setActive(c)} className="block w-full text-left p-1 hover:bg-gray-700">
            # {c.name}
          </button>
        ))}
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
