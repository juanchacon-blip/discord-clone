import { useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useAuthFetch } from './api';
import AdminPanel from './components/AdminPanel';
import ChannelChat from './components/ChannelChat';

const Centered = ({ children }: { children: React.ReactNode }) => (
  <div className="flex h-screen flex-col items-center justify-center gap-3">{children}</div>
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
    if (isAdmin === null) return <Centered>Cargando...</Centered>;
    if (isAdmin) return <AdminPanel onExit={goChat} />;
    return (
      <Centered>
        <p>🚫 Esta pagina es solo para administradores.</p>
        <button className="border px-4 py-2" onClick={goChat}>Volver al chat</button>
      </Centered>
    );
  }
  return <ChannelChat isAdmin={isAdmin === true} onOpenAdmin={() => { window.location.hash = 'admin'; }} />;
}

export default function App() {
  const { isLoading, isAuthenticated, loginWithRedirect, error } = useAuth0();

  if (isLoading) return <Centered>Cargando...</Centered>;

  if (!isAuthenticated) {
    return (
      <Centered>
        {error && <p className="text-red-600">Error: {error.message}</p>}
        <button className="border px-4 py-2" onClick={() => loginWithRedirect()}>
          Iniciar sesion
        </button>
      </Centered>
    );
  }

  return <Shell />;
}
