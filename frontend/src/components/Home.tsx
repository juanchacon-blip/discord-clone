import { useEffect, useState } from 'react';
import { Bento, Ring, useCountUp } from './ui';

type Chan = { id: number; name: string };
type DriveInfo = { enabled: boolean; connected: boolean; images?: { total: number; ok: number; pending: number } };

type Props = {
  name: string;
  channels: Chan[];
  unread: Record<number, number>;
  onOpen: (c: Chan) => void;
  onOpenSettings: () => void;
  authFetch: (path: string, init?: RequestInit) => Promise<Response>;
};

const greeting = () => {
  const h = new Date().getHours();
  return h < 6 ? 'Buenas noches' : h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
};

/** Panel de inicio: Bento Grid animado con el resumen de tu cuenta y tus canales. */
export default function Home({ name, channels, unread, onOpen, onOpenSettings, authFetch }: Props) {
  const [drive, setDrive] = useState<DriveInfo | null>(null);

  useEffect(() => {
    let off = false;
    authFetch('/drive/status')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!off) setDrive(d); })
      .catch(() => undefined);
    return () => { off = true; };
  }, [authFetch]);

  const totalUnread = channels.reduce((n, c) => n + (unread[c.id] || 0), 0);
  const nChannels = useCountUp(channels.length);
  const nUnread = useCountUp(totalUnread);
  const img = drive?.images;
  const pct = img && img.total > 0 ? img.ok / img.total : 0;

  return (
    <div className="mx-auto grid max-w-5xl auto-rows-[9.75rem] grid-cols-2 gap-4 lg:grid-cols-4">
      {/* Bienvenida */}
      <Bento className="animate-rise col-span-2 row-span-2 flex flex-col justify-between p-6 md:p-8">
        <div className="animate-float pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-fuchsia-500/25 blur-3xl" />
        <p className="text-sm font-semibold uppercase tracking-[.2em] text-lavender">{greeting()}</p>
        <div>
          <h2 className="text-gradient break-words text-4xl font-black leading-tight md:text-5xl">{name}</h2>
          <p className="mt-3 max-w-sm text-violet-100/75">
            {totalUnread > 0
              ? `Tienes ${totalUnread} mensaje${totalUnread === 1 ? '' : 's'} esperándote.`
              : 'Estás al día. Elige un canal para empezar a conversar.'}
          </p>
        </div>
      </Bento>

      {/* Estadísticas */}
      <Bento className="animate-rise flex flex-col justify-between p-5" style={{ animationDelay: '80ms' }}>
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-lavender">Canales</p>
        <p className="text-5xl font-black tabular-nums">{nChannels}</p>
      </Bento>
      <Bento className="animate-rise flex flex-col justify-between p-5" style={{ animationDelay: '140ms' }}>
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-lavender">Sin leer</p>
        <div className="flex items-end justify-between">
          <p className={`text-5xl font-black tabular-nums ${totalUnread > 0 ? 'text-gradient' : ''}`}>{nUnread}</p>
          {totalUnread > 0 && (
            <span className="relative mb-2 grid h-3 w-3">
              <span className="animate-ping-soft absolute inset-0 rounded-full bg-fuchsia-500" />
              <span className="relative h-3 w-3 rounded-full bg-fuchsia-400" />
            </span>
          )}
        </div>
      </Bento>

      {/* Drive */}
      <Bento className="animate-rise col-span-2 flex items-center gap-5 p-5" style={{ animationDelay: '200ms' }}>
        {drive?.connected && img ? (
          <>
            <Ring value={pct} size={104}>
              <span className="text-xl font-extrabold tabular-nums">{Math.round(pct * 100)}%</span>
            </Ring>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[.18em] text-lavender">Respaldo en Drive</p>
              <p className="mt-1 font-semibold">{img.ok} de {img.total} imágenes</p>
              <p className="text-sm text-violet-200/60">{img.pending > 0 ? `⏳ ${img.pending} en proceso…` : 'Todo en orden ✨'}</p>
            </div>
          </>
        ) : (
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-lavender">Respaldo en Drive</p>
            {drive === null && <p className="mt-2 text-sm text-violet-200/60">Consultando…</p>}
            {drive && !drive.enabled && <p className="mt-2 text-sm text-violet-200/60">Aún no está configurado en el servidor.</p>}
            {drive?.enabled && !drive.connected && (
              <>
                <p className="mt-1 text-sm text-violet-100/80">Conecta tu Drive y guarda copia de todas las imágenes.</p>
                <button type="button" onClick={onOpenSettings} className="btn-glow mt-3 rounded-full px-5 py-2 text-sm font-semibold">
                  Conectar ahora
                </button>
              </>
            )}
          </div>
        )}
      </Bento>

      <h3 className="col-span-full -mb-1 mt-2 text-xs font-semibold uppercase tracking-[.2em] text-violet-300/60">Tus canales</h3>

      {channels.length === 0 && (
        <Bento className="animate-rise col-span-2 flex items-center p-6 text-violet-100/70">
          Aún no hay canales. Crea el primero desde la barra lateral.
        </Bento>
      )}
      {channels.map((c, i) => {
        const n = unread[c.id] || 0;
        return (
          <Bento key={c.id} onClick={() => onOpen(c)} className="animate-rise flex flex-col justify-between p-5" style={{ animationDelay: `${260 + i * 60}ms` }}>
            <div className="flex items-start justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/20 text-xl font-bold text-lavender transition group-hover:bg-violet-500/40">#</span>
              {n > 0 && (
                <span className="min-w-6 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 px-2 py-0.5 text-center text-xs font-bold shadow-[0_0_16px_rgba(217,70,239,.6)]">
                  {n > 99 ? '99+' : n}
                </span>
              )}
            </div>
            <div>
              <p className="truncate text-lg font-bold">{c.name}</p>
              <p className="text-sm text-violet-300/60 transition group-hover:translate-x-1 group-hover:text-lavender">Entrar →</p>
            </div>
          </Bento>
        );
      })}
    </div>
  );
}
