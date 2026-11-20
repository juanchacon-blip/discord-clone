import { useAuth0 } from '@auth0/auth0-react';
import ChannelChat from './components/ChannelChat';

export default function App() {
  const { isLoading, isAuthenticated, loginWithRedirect, error } = useAuth0();

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Cargando...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        {error && <p className="text-red-600">Error: {error.message}</p>}
        <button className="border px-4 py-2" onClick={() => loginWithRedirect()}>
          Iniciar sesion
        </button>
      </div>
    );
  }

  return <ChannelChat />;
}
