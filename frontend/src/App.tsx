import { useEffect, useState, type ReactNode } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useAuthFetch } from './api';
import AdminPanel from './components/AdminPanel';
import ChannelChat from './components/ChannelChat';
import { Aurora, Logo } from './components/ui';

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

// ───────── Pantalla de bienvenida: hero + una vista previa del chat ─────────
const MOCK = [
  { who: 'Luna', text: '¿Viste las fotos del viaje? 🌌', mine: false },
  { who: 'Tú', text: '¡Increíbles! Ya las respaldé en mi Drive ✨', mine: true },
];

const FEATURES = [
  { icon: '💬', title: 'Canales en vivo', text: 'Mensajes al instante.' },
  { icon: '☁️', title: 'Respaldo en Drive', text: 'Tus imágenes, a salvo.' },
  { icon: '🔔', title: 'Avisos', text: 'Nada se te escapa.' },
];

function Landing({ onLogin, error }: { onLogin: () => void; error?: string }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-5 py-8 md:py-10">
      <header className="animate-rise flex items-center gap-3">
        <Logo size={36} />
        <span className="text-gradient text-xl font-extrabold tracking-tight">Nebula</span>
      </header>

      <main className="my-auto grid items-center gap-10 py-10 lg:grid-cols-2 lg:gap-16">
        <section className="text-center lg:text-left">
          <h1 className="animate-rise text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl" style={{ animationDelay: '80ms' }}>
            Conversa en un universo <span className="text-gradient">violeta eléctrico</span>
          </h1>
          <p className="animate-rise mx-auto mt-5 max-w-md text-base text-violet-200/70 lg:mx-0" style={{ animationDelay: '160ms' }}>
            Chat en tiempo real, imágenes con copia en tu Google Drive y avisos que no se te escapan.
          </p>
          {error && <p className="mt-4 w-fit rounded-xl border border-rose-400/30 bg-rose-500/15 px-4 py-2 text-sm text-rose-200 max-lg:mx-auto">Error: {error}</p>}
          <button className="btn-glow animate-rise mt-8 rounded-full px-9 py-3.5 text-base font-bold" style={{ animationDelay: '240ms' }} onClick={onLogin}>
            Iniciar sesión →
          </button>
        </section>

        <section className="glass-deep animate-rise mx-auto w-full max-w-md rounded-3xl p-5" style={{ animationDelay: '200ms' }} aria-hidden>
          <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-3 text-xs text-violet-300/60">
            <span className="h-2 w-2 rounded-full bg-violet-400/60" /><span className="h-2 w-2 rounded-full bg-fuchsia-400/60" /><span className="h-2 w-2 rounded-full bg-indigo-400/60" />
            <span className="ml-2 font-mono"># general</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {MOCK.map((m, i) => (
              <div key={m.who} className={`animate-rise max-w-[85%] rounded-2xl px-4 py-2 text-sm ${m.mine ? 'self-end rounded-tr-md bg-gradient-to-br from-violet-600 to-fuchsia-600' : 'glass rounded-tl-md'}`} style={{ animationDelay: `${500 + i * 400}ms` }}>
                <b className="mb-0.5 block text-[11px] text-lavender">{m.who}</b>{m.text}
              </div>
            ))}
          </div>
        </section>
      </main>

      <ul className="animate-rise grid gap-4 border-t border-white/10 pt-6 sm:grid-cols-3" style={{ animationDelay: '320ms' }}>
        {FEATURES.map(f => (
          <li key={f.title} className="flex items-center gap-3 max-sm:justify-center">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-lg" aria-hidden>{f.icon}</span>
            <div>
              <p className="text-sm font-semibold">{f.title}</p>
              <p className="text-xs text-violet-200/60">{f.text}</p>
            </div>
          </li>
        ))}
      </ul>

      <footer className="pt-8 text-center text-xs text-violet-300/40">Nebula · hecho con 💜</footer>
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
