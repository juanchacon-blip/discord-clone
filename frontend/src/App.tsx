import { useEffect, useState, type ReactNode } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useAuthFetch } from './api';
import AdminPanel from './components/AdminPanel';
import ChannelChat from './components/ChannelChat';
import { Aurora, Bento, Logo, Ring } from './components/ui';

const Centered = ({ children }: { children: ReactNode }) => (
  <div className="grid h-dvh place-items-center p-4">
    <div className="glass-deep animate-pop flex max-w-sm flex-col items-center gap-4 rounded-3xl p-8 text-center">{children}</div>
  </div>
);

const Loading = () => (
  <Centered>
    <Logo size={52} />
    <div className="flex gap-1.5">
      {[0, 1, 2].map(i => <span key={i} className="animate-dot h-2 w-2 rounded-full bg-lavender" style={{ animationDelay: `${i * 0.16}s` }} />)}
    </div>
    <p className="text-sm text-violet-200/70">Cargando…</p>
  </Centered>
);

// Pantalla de la sesion iniciada: el chat normal, o el panel de administracion (#admin).
// Ojo: esconder el panel aqui es solo comodidad. La proteccion real esta en el servidor,
// que responde 403 a cualquier cuenta que no sea administradora.
function Shell() {
  const authFetch = useAuthFetch();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    authFetch('/admin/me')
      .then(r => (r.ok ? r.json() : { isAdmin: false }))
      .then(d => setIsAdmin(Boolean(d.isAdmin)))
      .catch(() => setIsAdmin(false));
  }, [authFetch]);

  const goChat = () => { window.location.hash = ''; };

  if (hash === '#admin') {
    if (isAdmin === null) return <Loading />;
    if (isAdmin) return <AdminPanel onExit={goChat} />;
    return (
      <Centered>
        <span className="text-4xl">🚫</span>
        <p className="text-lg font-semibold">Esta página es solo para administradores</p>
        <button className="btn-glow rounded-full px-6 py-2.5 font-semibold" onClick={goChat}>Volver al chat</button>
      </Centered>
    );
  }
  return <ChannelChat isAdmin={isAdmin === true} onOpenAdmin={() => { window.location.hash = 'admin'; }} />;
}

// ───────── Pantalla de bienvenida: hero + Bento Grid interactivo ─────────
const MOCK = [
  { who: 'Luna', text: '¿Viste las fotos del viaje? 🌌', mine: false },
  { who: 'Tú', text: '¡Increíbles! Ya las respaldé en mi Drive ✨', mine: true },
];

function Landing({ onLogin, error }: { onLogin: () => void; error?: string }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 py-8 md:py-12">
      <header className="animate-rise flex items-center gap-3">
        <Logo size={42} />
        <span className="text-gradient text-2xl font-extrabold tracking-tight">Nebula</span>
      </header>

      <section className="my-10 text-center md:my-14">
        <p className="animate-rise mx-auto mb-4 w-fit rounded-full border border-violet-300/20 bg-violet-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[.2em] text-lavender" style={{ animationDelay: '80ms' }}>
          Chat · Imágenes · Respaldo
        </p>
        <h1 className="animate-rise text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl md:text-7xl" style={{ animationDelay: '140ms' }}>
          Conversa en un universo<br /><span className="text-gradient">violeta eléctrico</span>
        </h1>
        <p className="animate-rise mx-auto mt-5 max-w-xl text-base text-violet-200/70 md:text-lg" style={{ animationDelay: '220ms' }}>
          Canales en tiempo real, imágenes con copia automática en tu Google Drive y avisos que no se te escapan.
        </p>
        {error && <p className="mx-auto mt-4 w-fit rounded-xl border border-rose-400/30 bg-rose-500/15 px-4 py-2 text-sm text-rose-200">Error: {error}</p>}
        <button className="btn-glow animate-rise mt-8 rounded-full px-9 py-3.5 text-base font-bold" style={{ animationDelay: '300ms' }} onClick={onLogin}>
          Iniciar sesión →
        </button>
      </section>

      <section className="grid auto-rows-[10.5rem] grid-cols-2 gap-4 lg:grid-cols-4">
        <Bento className="animate-rise col-span-2 row-span-2 flex flex-col p-6" style={{ animationDelay: '360ms' }}>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-lavender">Tiempo real</p>
          <h3 className="mt-1 text-xl font-bold">Mensajes que llegan al instante</h3>
          <div className="mt-4 flex flex-1 flex-col justify-end gap-2.5">
            {MOCK.map((m, i) => (
              <div key={m.who} className={`animate-rise max-w-[85%] rounded-2xl px-4 py-2 text-sm ${m.mine ? 'self-end rounded-tr-md bg-gradient-to-br from-violet-600 to-fuchsia-600' : 'glass rounded-tl-md'}`} style={{ animationDelay: `${700 + i * 450}ms` }}>
                <b className="mb-0.5 block text-[11px] text-lavender">{m.who}</b>{m.text}
              </div>
            ))}
            <div className="glass animate-rise flex w-fit items-center gap-1.5 rounded-2xl rounded-tl-md px-4 py-3" style={{ animationDelay: '1700ms' }}>
              {[0, 1, 2].map(i => <span key={i} className="animate-dot h-1.5 w-1.5 rounded-full bg-lavender" style={{ animationDelay: `${i * 0.16}s` }} />)}
            </div>
          </div>
        </Bento>

        <Bento className="animate-rise p-5" style={{ animationDelay: '440ms' }}>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-lavender">Imágenes</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {['from-violet-500 to-fuchsia-400', 'from-indigo-500 to-sky-400', 'from-fuchsia-500 to-rose-400', 'from-purple-600 to-violet-300', 'from-sky-500 to-violet-400', 'from-pink-500 to-purple-500'].map((g, i) => (
              <div key={i} className={`aspect-square rounded-xl bg-gradient-to-br transition duration-500 group-hover:rotate-3 group-hover:scale-105 ${g}`} style={{ transitionDelay: `${i * 40}ms` }} />
            ))}
          </div>
        </Bento>

        <Bento className="animate-rise flex items-center gap-4 p-5" style={{ animationDelay: '520ms' }}>
          <Ring value={0.82} size={88}><span className="text-lg font-extrabold">82%</span></Ring>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-lavender">Drive</p>
            <p className="mt-1 text-sm text-violet-100/80">Respaldo automático de cada foto</p>
          </div>
        </Bento>

        <Bento className="animate-rise flex flex-col justify-between p-5" style={{ animationDelay: '600ms' }}>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-lavender">Avisos</p>
          <div className="flex items-center gap-3">
            <span className="relative grid h-12 w-12 place-items-center">
              <span className="animate-ping-soft absolute inset-0 rounded-full bg-fuchsia-500/60" />
              <span className="relative grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-lg font-extrabold shadow-[0_0_24px_rgba(217,70,239,.7)]">3</span>
            </span>
            <p className="text-sm text-violet-100/80">Una bolita te avisa de lo nuevo</p>
          </div>
        </Bento>

        <Bento className="animate-rise col-span-2 flex flex-col justify-between p-5" style={{ animationDelay: '680ms' }}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-lavender">Panel de control</p>
            <h3 className="mt-1 text-lg font-bold">Moderación sencilla para administradores</h3>
          </div>
          <div className="flex h-12 items-end gap-1.5" aria-hidden>
            {Array.from({ length: 22 }, (_, i) => (
              <span key={i} className="animate-bars h-full w-full origin-bottom rounded-full bg-gradient-to-t from-violet-600 to-fuchsia-300" style={{ animationDelay: `${(i * 0.11) % 1.5}s` }} />
            ))}
          </div>
        </Bento>
      </section>

      <footer className="mt-auto pt-10 text-center text-xs text-violet-300/40">Nebula · hecho con 💜</footer>
    </div>
  );
}

function AppInner() {
  const { isLoading, isAuthenticated, loginWithRedirect, error } = useAuth0();
  if (isLoading) return <Loading />;
  if (!isAuthenticated) return <Landing onLogin={() => loginWithRedirect()} error={error?.message} />;
  return <Shell />;
}

export default function App() {
  return (
    <>
      <Aurora />
      <AppInner />
    </>
  );
}
