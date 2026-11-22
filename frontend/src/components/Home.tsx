import { useEffect, useState } from 'react';
import { Bento, Icon, Ring, useCountUp } from './ui';

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

const GRADIENTS = [
  'from-violet-500 to-fuchsia-500', 'from-indigo-500 to-violet-400', 'from-fuchsia-500 to-pink-400',
  'from-purple-600 to-indigo-400', 'from-violet-400 to-sky-400',
];
const gradFor = (name: string) => GRADIENTS[[...name].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7) % GRADIENTS.length];

const label = 'font-mono text-[11px] uppercase tracking-[.2em] text-lavender/80';

/** Panel de inicio: banner synthwave, tres indicadores y tus canales. */
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
  // Canal sugerido: el que más mensajes sin leer tiene, o el primero
  const top = [...channels].sort((a, b) => (unread[b.id] || 0) - (unread[a.id] || 0))[0];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      {/* ───────── Banner ───────── */}
      <section className="panel animate-rise relative min-h-[15rem] overflow-hidden rounded-3xl p-6 md:p-10">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="synth-sun max-md:hidden" style={{ left: '80%', bottom: '30%', width: 280, opacity: 0.45 }} />
          <div className="synth-floor" />
        </div>
        <div className="relative">
          <p className="font-mono text-xs tracking-[.22em] text-lavender/80">&gt; {greeting().toLowerCase()}_</p>
          <h2 className="mt-3 break-words font-display text-4xl font-bold leading-[1.05] text-gradient md:text-6xl">{name}</h2>
          <p className="mt-4 max-w-md text-violet-100/75">
            {totalUnread > 0
              ? `Tienes ${totalUnread} mensaje${totalUnread === 1 ? '' : 's'} esperándote.`
              : 'Estás al día. Elige un canal para empezar a conversar.'}
          </p>
          {top && (
            <button type="button" onClick={() => onOpen(top)} className="btn-glow group mt-6 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold">
              {totalUnread > 0 ? 'Ir a' : 'Abrir'} <span className="font-mono">#{top.name}</span>
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </button>
          )}
        </div>
      </section>

      {/* ───────── Indicadores ───────── */}
      <section className="grid gap-4 sm:grid-cols-3">
        <Bento panel className="animate-rise flex flex-col justify-between gap-4 p-5" style={{ animationDelay: '80ms' }}>
          <p className={label}>Canales</p>
          <p className="font-display text-5xl font-bold tabular-nums">{nChannels}</p>
        </Bento>

        <Bento panel className="animate-rise flex flex-col justify-between gap-4 p-5" style={{ animationDelay: '140ms' }}>
          <p className={`${label} flex items-center gap-2`}>
            Sin leer {totalUnread > 0 && <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400" />}
          </p>
          <p className={`font-display text-5xl font-bold tabular-nums ${totalUnread > 0 ? 'text-gradient' : ''}`}>{nUnread}</p>
        </Bento>

        <Bento panel className="animate-rise flex items-center gap-4 p-5" style={{ animationDelay: '200ms' }}>
          {drive?.connected && img ? (
            <>
              <Ring value={pct} size={72}><span className="font-display text-sm font-bold tabular-nums">{Math.round(pct * 100)}%</span></Ring>
              <div className="min-w-0">
                <p className={label}>Drive</p>
                <p className="mt-1 text-sm font-semibold">{img.ok} de {img.total} imágenes</p>
                <p className="font-mono text-[11px] text-violet-300/60">{img.pending > 0 ? `${img.pending} en proceso…` : 'todo en orden'}</p>
              </div>
            </>
          ) : (
            <div className="min-w-0">
              <p className={label}>Drive</p>
              {drive === null && <p className="mt-2 text-sm text-violet-200/60">Consultando…</p>}
              {drive && !drive.enabled && <p className="mt-2 text-sm text-violet-200/60">Aún no está configurado en el servidor.</p>}
              {drive?.enabled && !drive.connected && (
                <>
                  <p className="mt-1 text-sm text-violet-100/80">Guarda copia de tus imágenes.</p>
                  <button type="button" onClick={onOpenSettings} className="btn-glow mt-2 rounded-full px-4 py-1.5 text-xs font-semibold">Conectar ahora</button>
                </>
              )}
            </div>
          )}
        </Bento>
      </section>

      {/* ───────── Canales ───────── */}
      <section>
        <div className="mb-3 flex items-baseline justify-between px-1">
          <h3 className={label}>// tus canales</h3>
          <span className="font-mono text-[11px] text-violet-300/50">{channels.length} en total</span>
        </div>
        {channels.length === 0 ? (
          <div className="panel animate-rise flex items-center gap-4 rounded-3xl p-6 text-violet-100/70">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-500/15 text-lavender"><Icon name="plus" size={22} /></span>
            Aún no hay canales. Crea el primero desde la barra lateral.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {channels.map((c, i) => {
              const n = unread[c.id] || 0;
              return (
                <Bento key={c.id} panel onClick={() => onOpen(c)} className="animate-rise flex items-center gap-4 p-4" style={{ animationDelay: `${260 + i * 60}ms` }}>
                  <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white ${gradFor(c.name)}`}><Icon name="hash" size={22} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-lg font-bold">{c.name}</span>
                    <span className="block font-mono text-xs text-violet-300/60 transition group-hover:text-lavender">{n > 0 ? `${n} sin leer` : 'al día'}</span>
                  </span>
                  {n > 0
                    ? <span className="min-w-6 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 px-2 py-0.5 text-center text-xs font-bold">{n > 99 ? '99+' : n}</span>
                    : <span className="font-mono text-violet-300/40 transition group-hover:translate-x-1 group-hover:text-lavender">→</span>}
                </Bento>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
