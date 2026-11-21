import { useCallback, useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { fileHref, useAuthFetch } from '../api';
import { Bento, useCountUp } from './ui';

type AdminChannel = { id: number; name: string; messages: number; files: number };
type AdminMsg = {
  id: number; author: string; content: string; channelId: number; createdAt: string;
  fileName?: string | null; fileUrl?: string | null; mimeType?: string | null;
};
type Notice = { kind: 'ok' | 'warn' | 'error'; text: string };

const NOTICE_STYLE = {
  ok: 'border-emerald-300/25 bg-emerald-400/15 text-emerald-100',
  warn: 'border-amber-300/25 bg-amber-400/15 text-amber-100',
  error: 'border-rose-300/25 bg-rose-500/15 text-rose-100',
};

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

  const totals = channels.reduce((t, c) => ({ messages: t.messages + c.messages, files: t.files + c.files }), { messages: 0, files: 0 });
  const nChannels = useCountUp(channels.length);
  const nMessages = useCountUp(totals.messages);
  const nFiles = useCountUp(totals.files);

  const visible = onlyFiles ? messages.filter(m => m.fileUrl) : messages;

  return (
    <div className="relative flex h-dvh flex-col gap-3 p-2 md:p-3">
      <header className="glass-deep flex items-center justify-between gap-3 rounded-3xl p-3 pl-4">
        <div>
          <h1 className="text-gradient text-xl font-extrabold">🛡️ Panel de administración</h1>
          <p className="text-xs text-violet-200/60">Sesión: {user?.nickname || user?.name}</p>
        </div>
        <button className="btn-ghost rounded-full px-5 py-2 text-sm font-medium" onClick={onExit}>← Volver al chat</button>
      </header>

      {notice && (
        <button className={`${NOTICE_STYLE[notice.kind]} animate-pop rounded-2xl border p-3 text-left text-sm`} onClick={() => setNotice(null)}>
          {notice.text} <span className="opacity-60">(clic para cerrar)</span>
        </button>
      )}

      <div className="grid grid-cols-3 gap-3">
        {[['Canales', nChannels], ['Mensajes', nMessages], ['Archivos', nFiles]].map(([label, value], i) => (
          <Bento key={label} className="animate-rise p-4" style={{ animationDelay: `${i * 70}ms` }}>
            <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-lavender">{label}</p>
            <p className="text-gradient text-3xl font-black tabular-nums md:text-4xl">{value}</p>
          </Bento>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-row">
        <aside className="glass max-h-56 overflow-y-auto rounded-3xl md:max-h-none md:w-80">
          <h2 className="p-4 pb-2 text-xs font-semibold uppercase tracking-[.18em] text-lavender">Canales ({channels.length})</h2>
          {channels.length === 0 && <p className="p-2 text-sm text-violet-300/50">No hay canales.</p>}
          {channels.map(c => (
            <div key={c.id} className={`mx-2 mb-1 flex items-center justify-between gap-2 rounded-2xl p-2 transition ${selected?.id === c.id ? 'bg-violet-500/20 shadow-[inset_0_0_0_1px_rgba(196,181,253,.3)]' : 'hover:bg-white/5'}`}>
              <button className="min-w-0 flex-1 text-left" onClick={() => setSelected(c)}>
                <span className="block truncate font-medium"># {c.name}</span>
                <span className="text-xs text-violet-200/60">{c.messages} mensajes · {c.files} archivos</span>
              </button>
              <button className="btn-danger rounded-xl px-3 py-1.5 text-sm"
                disabled={busy} onClick={() => deleteChannel(c)}>
                Eliminar
              </button>
            </div>
          ))}
        </aside>

        <main className="glass min-w-0 flex-1 overflow-y-auto rounded-3xl p-4">
          {!selected && <p className="text-violet-300/50">Elige un canal para revisar sus mensajes y archivos.</p>}
          {selected && (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-bold"># {selected.name}</h2>
                <label className="flex items-center gap-1 text-sm">
                  <input type="checkbox" className="accent-violet-500" checked={onlyFiles} onChange={e => setOnlyFiles(e.target.checked)} />
                  Solo mensajes con archivos
                </label>
              </div>
              {loading && messages.length === 0 && <p className="text-violet-300/50">Cargando...</p>}
              {!loading && visible.length === 0 && <p className="text-violet-300/50">No hay mensajes.</p>}
              {visible.map(m => (
                <div key={m.id} className="animate-rise mb-2 rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 break-words">
                      <b>{m.author}</b>{' '}
                      <span className="text-xs text-violet-300/50">{new Date(m.createdAt).toLocaleString()}</span>
                    </p>
                    <div className="flex gap-1">
                      {m.fileUrl && (
                        <button className="btn-ghost rounded-xl px-3 py-1 text-sm" disabled={busy} onClick={() => deleteFile(m)}>
                          Eliminar archivo
                        </button>
                      )}
                      <button className="btn-danger rounded-xl px-3 py-1 text-sm" disabled={busy} onClick={() => deleteMessage(m)}>
                        Eliminar mensaje
                      </button>
                    </div>
                  </div>
                  {m.content && <p className="mt-1 break-words">{m.content}</p>}
                  {m.fileUrl && m.mimeType?.startsWith('image/') && (
                    <a href={fileHref(m.fileUrl)} target="_blank" rel="noreferrer">
                      <img src={fileHref(m.fileUrl)} alt={m.fileName ?? ''} loading="lazy" className="mt-2 max-h-48 max-w-full rounded-xl border border-white/15" />
                    </a>
                  )}
                  {m.fileUrl && !m.mimeType?.startsWith('image/') && (
                    <a className="mt-2 block text-lavender underline" href={fileHref(m.fileUrl)} target="_blank" rel="noreferrer">📎 {m.fileName}</a>
                  )}
                </div>
              ))}
              {nextBefore !== null && (
                <button className="btn-ghost mt-2 w-full rounded-2xl p-2.5" disabled={loading} onClick={loadMore}>
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
