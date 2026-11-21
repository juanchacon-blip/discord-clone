import { useCallback, useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { fileHref, useAuthFetch } from '../api';

type AdminChannel = { id: number; name: string; messages: number; files: number };
type AdminMsg = {
  id: number; author: string; content: string; channelId: number; createdAt: string;
  fileName?: string | null; fileUrl?: string | null; mimeType?: string | null;
};
type Notice = { kind: 'ok' | 'warn' | 'error'; text: string };

const NOTICE_STYLE = { ok: 'bg-green-100', warn: 'bg-yellow-100', error: 'bg-red-100' };

export default function AdminPanel({ onExit }: { onExit: () => void }) {
  const authFetch = useAuthFetch();
  const { user } = useAuth0();
  const [channels, setChannels] = useState<AdminChannel[]>([]);
  const [selected, setSelected] = useState<AdminChannel | null>(null);
  const [messages, setMessages] = useState<AdminMsg[]>([]);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [onlyFiles, setOnlyFiles] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const loadChannels = useCallback(async () => {
    const res = await authFetch('/admin/channels');
    if (!res.ok) {
      setNotice({ kind: 'error', text: res.status === 403 ? 'Tu cuenta no es administradora.' : `No se pudieron cargar los canales (${res.status}).` });
      return;
    }
    const list: AdminChannel[] = await res.json();
    setChannels(list);
    setSelected(s => (s ? list.find(c => c.id === s.id) ?? null : s));
  }, [authFetch]);

  useEffect(() => { loadChannels().catch(() => setNotice({ kind: 'error', text: 'No se pudo conectar con el servidor.' })); }, [loadChannels]);

  // Carga la primera pagina de mensajes al elegir un canal o cambiar el filtro
  const channelId = selected?.id;
  useEffect(() => {
    if (channelId === undefined) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await authFetch(`/admin/channels/${channelId}/messages?onlyFiles=${onlyFiles ? 1 : 0}`);
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (cancelled) return;
        setMessages(data.messages);
        setNextBefore(data.nextBefore);
      } catch {
        if (!cancelled) setNotice({ kind: 'error', text: 'No se pudieron cargar los mensajes.' });
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [channelId, onlyFiles, authFetch]);

  const loadMore = async () => {
    if (!selected || nextBefore === null) return;
    setLoading(true);
    try {
      const res = await authFetch(`/admin/channels/${selected.id}/messages?before=${nextBefore}&onlyFiles=${onlyFiles ? 1 : 0}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setMessages(prev => [...prev, ...data.messages]);
      setNextBefore(data.nextBefore);
    } catch {
      setNotice({ kind: 'error', text: 'No se pudieron cargar mas mensajes.' });
    }
    setLoading(false);
  };

  // Ejecuta un DELETE y muestra el resultado
  const run = async (path: string, okText: string): Promise<Record<string, unknown> | null> => {
    setBusy(true);
    try {
      const res = await authFetch(path, { method: 'DELETE' });
      if (!res.ok) {
        const msg = res.status === 403 ? 'Tu cuenta no es administradora.' : res.status === 404 ? 'Ya no existe (alguien lo borro antes).' : `Error ${res.status}`;
        setNotice({ kind: 'error', text: msg });
        return null;
      }
      const data = (await res.json()) as Record<string, unknown>;
      const failed = Number(data.storageErrors ?? 0);
      setNotice(failed > 0
        ? { kind: 'warn', text: `${okText} Pero ${failed} archivo(s) no se pudieron borrar del almacenamiento; revisa los logs del servidor.` }
        : { kind: 'ok', text: okText });
      return data;
    } catch {
      setNotice({ kind: 'error', text: 'No se pudo conectar con el servidor.' });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const deleteChannel = async (c: AdminChannel) => {
    const typed = window.prompt(
      `Vas a ELIMINAR el canal #${c.name} con ${c.messages} mensajes y ${c.files} archivos.\n` +
      `Esto no se puede deshacer.\n\nEscribe el nombre del canal para confirmar:`,
    );
    if (typed === null) return;
    if (typed.trim() !== c.name) return setNotice({ kind: 'error', text: 'El nombre no coincide. No se elimino nada.' });
    if (await run(`/admin/channels/${c.id}`, `Canal #${c.name} eliminado.`)) {
      if (selected?.id === c.id) { setSelected(null); setMessages([]); }
      loadChannels();
    }
  };

  const deleteMessage = async (m: AdminMsg) => {
    if (!window.confirm(`¿Eliminar este mensaje de ${m.author}?${m.fileUrl ? '\nTambien se borrara su archivo.' : ''}`)) return;
    if (await run(`/admin/messages/${m.id}`, 'Mensaje eliminado.')) {
      setMessages(prev => prev.filter(x => x.id !== m.id));
      loadChannels();
    }
  };

  const deleteFile = async (m: AdminMsg) => {
    const keepsText = m.content.trim() !== '';
    if (!window.confirm(`¿Eliminar el archivo "${m.fileName}"?${keepsText ? '\nEl texto del mensaje se queda.' : '\nComo el mensaje no tiene texto, se eliminara completo.'}`)) return;
    const data = await run(`/admin/messages/${m.id}/file`, 'Archivo eliminado.');
    if (!data) return;
    setMessages(prev => (data.messageDeleted
      ? prev.filter(x => x.id !== m.id)
      : prev.map(x => (x.id === m.id ? { ...x, fileUrl: null, fileName: null, mimeType: null } : x))));
    loadChannels();
  };

  const visible = onlyFiles ? messages.filter(m => m.fileUrl) : messages;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between gap-2 bg-gray-900 p-3 text-white">
        <div>
          <h1 className="text-lg font-bold">🛡️ Panel de administracion</h1>
          <p className="text-xs text-gray-300">Sesion: {user?.nickname || user?.name}</p>
        </div>
        <button className="border px-3 py-1" onClick={onExit}>← Volver al chat</button>
      </header>

      {notice && (
        <button className={`${NOTICE_STYLE[notice.kind]} p-2 text-left text-sm`} onClick={() => setNotice(null)}>
          {notice.text} <span className="text-gray-500">(clic para cerrar)</span>
        </button>
      )}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="max-h-56 overflow-y-auto border-b md:max-h-none md:w-80 md:border-b-0 md:border-r">
          <h2 className="p-2 font-bold">Canales ({channels.length})</h2>
          {channels.length === 0 && <p className="p-2 text-sm text-gray-500">No hay canales.</p>}
          {channels.map(c => (
            <div key={c.id} className={`flex items-center justify-between gap-2 border-t p-2 ${selected?.id === c.id ? 'bg-gray-200' : ''}`}>
              <button className="min-w-0 flex-1 text-left" onClick={() => setSelected(c)}>
                <span className="block truncate font-medium"># {c.name}</span>
                <span className="text-xs text-gray-600">{c.messages} mensajes · {c.files} archivos</span>
              </button>
              <button className="border border-red-600 px-2 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                disabled={busy} onClick={() => deleteChannel(c)}>
                Eliminar
              </button>
            </div>
          ))}
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto p-3">
          {!selected && <p className="text-gray-500">Elige un canal para revisar sus mensajes y archivos.</p>}
          {selected && (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold"># {selected.name}</h2>
                <label className="flex items-center gap-1 text-sm">
                  <input type="checkbox" checked={onlyFiles} onChange={e => setOnlyFiles(e.target.checked)} />
                  Solo mensajes con archivos
                </label>
              </div>
              {loading && messages.length === 0 && <p className="text-gray-500">Cargando...</p>}
              {!loading && visible.length === 0 && <p className="text-gray-500">No hay mensajes.</p>}
              {visible.map(m => (
                <div key={m.id} className="mb-2 rounded border p-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 break-words">
                      <b>{m.author}</b>{' '}
                      <span className="text-xs text-gray-500">{new Date(m.createdAt).toLocaleString()}</span>
                    </p>
                    <div className="flex gap-1">
                      {m.fileUrl && (
                        <button className="border px-2 py-0.5 text-sm hover:bg-gray-100 disabled:opacity-50" disabled={busy} onClick={() => deleteFile(m)}>
                          Eliminar archivo
                        </button>
                      )}
                      <button className="border border-red-600 px-2 py-0.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50" disabled={busy} onClick={() => deleteMessage(m)}>
                        Eliminar mensaje
                      </button>
                    </div>
                  </div>
                  {m.content && <p className="mt-1 break-words">{m.content}</p>}
                  {m.fileUrl && m.mimeType?.startsWith('image/') && (
                    <a href={fileHref(m.fileUrl)} target="_blank" rel="noreferrer">
                      <img src={fileHref(m.fileUrl)} alt={m.fileName ?? ''} loading="lazy" className="mt-1 max-h-48 max-w-full rounded border" />
                    </a>
                  )}
                  {m.fileUrl && !m.mimeType?.startsWith('image/') && (
                    <a className="mt-1 block text-blue-600 underline" href={fileHref(m.fileUrl)} target="_blank" rel="noreferrer">📎 {m.fileName}</a>
                  )}
                </div>
              ))}
              {nextBefore !== null && (
                <button className="mt-2 w-full border p-2 hover:bg-gray-100 disabled:opacity-50" disabled={loading} onClick={loadMore}>
                  {loading ? 'Cargando...' : 'Cargar mas antiguos'}
                </button>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
