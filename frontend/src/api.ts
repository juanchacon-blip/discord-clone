import { useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

// En desarrollo apunta a http://localhost:3000 (ver .env).
// En produccion queda vacio: el backend sirve el frontend, asi que usa el mismo dominio.
export const API: string = import.meta.env.VITE_API_URL || '';

// Con Supabase la URL ya viene completa (https://...); con disco local es relativa al backend.
export const fileHref = (url: string) => (url.startsWith('http') ? url : `${API}${url}`);

/** fetch que agrega el token de Auth0 */
export function useAuthFetch() {
  const { getAccessTokenSilently } = useAuth0();
  return useCallback(async (path: string, init: RequestInit = {}) => {
    const token = await getAccessTokenSilently();
    return fetch(`${API}${path}`, {
      ...init,
      headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` },
    });
  }, [getAccessTokenSilently]);
}
