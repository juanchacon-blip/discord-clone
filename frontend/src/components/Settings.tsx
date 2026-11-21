import { useCallback, useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

type DriveInfo = { enabled: boolean; connected: boolean; email?: string | null; missing?: string[] };

type Props = {
  authFetch: (path: string, init?: RequestInit) => Promise<Response>;
  onClose: () => void;
  /** Resultado de volver de Google: 'ok' | 'error' (viene en la URL como ?drive=...) */
  driveResult?: string | null;
};

export default function Settings({ authFetch, onClose, driveResult }: Props) {
  const { user } = useAuth0();
  const [drive, setDrive] = useState<DriveInfo | null>(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await authFetch('/drive/status');
      if (!res.ok) throw new Error(`El servidor respondio ${res.status}`);
      setDrive(await res.json());
      setLoadError('');
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);

  const connect = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await authFetch('/drive/auth-url');
      if (!res.ok) throw new Error(`El servidor respondio ${res.status}`);
      const { url } = await res.json();
      window.location.href = url; // te lleva a la pantalla de permisos de Google
    } catch (e) {
      setError(`No se pudo iniciar la conexion: ${(e as Error).message}`);
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm('¿Desconectar tu Google Drive?\nLo que ya respaldaste se queda en tu Drive.')) return;
    setBusy(true);
    setError('');
    try {
      const res = await authFetch('/drive', { method: 'DELETE' });
      if (!res.ok) throw new Error(`El servidor respondio ${res.status}`);
      await load();
    } catch (e) {
      setError(`No se pudo desconectar: ${(e as Error).message}`);
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3" onClick={onClose}>
      <div className="w-full max-w-lg max-h-full overflow-y-auto rounded bg-white p-4 text-black" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">⚙️ Configuracion</h2>
          <button className="border px-2" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <section className="mt-4">
          <h3 className="font-bold">Cuenta</h3>
          <p>{user?.nickname || user?.name}</p>
          {user?.email && <p className="text-sm text-gray-600">{user.email}</p>}
        </section>

        <section className="mt-5 border-t pt-4">
          <h3 className="font-bold">☁️ Respaldo en Google Drive</h3>
          <p className="mt-1 text-sm text-gray-700">
            Si conectas tu Drive, cada archivo o foto que subas al chat tambien se copiara a tu Drive,
            en una carpeta llamada <b>"Discord Clone - Respaldo"</b>. La app solo puede ver lo que ella misma
            guarda ahi; no tiene acceso al resto de tu Drive. Puedes desconectarlo cuando quieras.
          </p>

          {driveResult === 'ok' && <p className="mt-2 rounded bg-green-100 p-2 text-sm">✅ Google Drive conectado.</p>}
          {driveResult === 'error' && (
            <p className="mt-2 rounded bg-red-100 p-2 text-sm">
              ❌ No se pudo conectar. Asegurate de dejar marcado el permiso de Drive en la pantalla de Google e intenta otra vez.
            </p>
          )}
          {loadError && (
            <p className="mt-2 rounded bg-red-100 p-2 text-sm">
              No se pudo consultar el estado de Drive ({loadError}). Revisa que el servidor este actualizado y encendido.
            </p>
          )}
          {!drive && !loadError && <p className="mt-2 text-sm text-gray-500">Consultando...</p>}

          {drive && !drive.enabled && (
            <div className="mt-2 rounded bg-yellow-100 p-2 text-sm">
              <p><b>Drive aun no esta configurado en el servidor.</b> Falta agregar estas variables de entorno (en Render, seccion Environment):</p>
              <ul className="mt-1 list-disc pl-5">
                {drive.missing?.map(name => <li key={name}><code>{name}</code></li>)}
              </ul>
            </div>
          )}

          {drive?.enabled && !drive.connected && (
            <button className="mt-3 w-full border border-black p-2 hover:bg-gray-100 disabled:opacity-50" disabled={busy} onClick={connect}>
              {busy ? 'Abriendo Google...' : 'Vincular mi cuenta de Google Drive'}
            </button>
          )}

          {drive?.enabled && drive.connected && (
            <div className="mt-3">
              <p className="rounded bg-green-100 p-2 text-sm">
                ✅ Conectado{drive.email ? <> como <b>{drive.email}</b></> : null}
              </p>
              <button className="mt-2 w-full border p-2 hover:bg-gray-100 disabled:opacity-50" disabled={busy} onClick={disconnect}>
                Desvincular mi Google Drive
              </button>
            </div>
          )}

          {error && <p className="mt-2 rounded bg-red-100 p-2 text-sm">{error}</p>}
        </section>
      </div>
    </div>
  );
}
