import { useEffect, useState, type ReactNode } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useAuthFetch } from './api';
import AdminPanel from './components/AdminPanel';
import ChannelChat from './components/ChannelChat';
import Landing from './components/Landing';
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
