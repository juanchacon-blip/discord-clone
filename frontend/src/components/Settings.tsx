import { useCallback, useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

type ImageStats = { total: number; ok: number; pending: number; failed: number; missing: number };
type DriveInfo = { enabled: boolean; connected: boolean; email?: string | null; missing?: string[]; images?: ImageStats };

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
  const [info, setInfo] = useState('');

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

  // Pide al servidor que copie a MI Drive las imagenes que me faltan
  const backfill = useCallback(async (silent = false) => {
    if (!silent) { setBusy(true); setError(''); setInfo(''); }
    try {
      const res = await authFetch('/channels/backup-images', { method: 'POST' });
      if (!res.ok) throw new Error(`El servidor respondio ${res.status}`);
      const { queued } = await res.json();
      if (!silent) setInfo(queued ? `Se estan copiando ${queued} imagen(es) a tu Drive...` : 'No te falta ninguna imagen.');
      await load();
    } catch (e) {
      if (!silent) setError(`No se pudo iniciar el respaldo: ${(e as Error).message}`);
    }
    if (!silent) setBusy(false);
  }, [authFetch, load]);

  // Recien conectado: empezar solo a copiar todas las imagenes (tambien las anteriores)
  useEffect(() => { if (driveResult === 'ok') void backfill(true); }, [driveResult, backfill]);

  // Mientras haya copias en proceso, se actualiza el progreso cada 4 segundos
  const pending = drive?.images?.pending ?? 0;
  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(load, 4000);
    return () => clearTimeout(t);
  }, [pending, drive, load]);

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
          {user?.sub && <p className="mt-1 break-all text-xs text-gray-500">ID de cuenta: {user.sub}</p>}
        </section>

        <section className="mt-5 border-t pt-4">
          <h3 className="font-bold">☁️ Respaldo en Google Drive</h3>
          <p className="mt-1 text-sm text-gray-700">
            Si conectas tu Drive, <b>todas las imagenes de todos los canales</b> (las tuyas y las de los demas,
            tambien las que ya estaban antes de que te conectaras) se copian a tu Drive, en una carpeta llamada{' '}
            <b>"Discord Clone - Respaldo"</b>. Ocupan espacio de tu Drive. Los archivos que no son imagenes solo
            se copian si los subes tu. La app solo puede ver lo que ella misma guarda ahi; no tiene acceso al
            resto de tu Drive. Puedes desconectarlo cuando quieras.
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
              {drive.images && (
                <div className="mt-2 rounded border p-2 text-sm">
                  <p>
                    🖼️ Imagenes respaldadas: <b>{drive.images.ok}</b> de <b>{drive.images.total}</b>
                    {drive.images.pending > 0 && <span> · ⏳ {drive.images.pending} en proceso</span>}
                    {drive.images.failed > 0 && <span> · ⚠️ {drive.images.failed} fallaron</span>}
                    {drive.images.missing > 0 && <span className="text-gray-500"> · {drive.images.missing} ya no existen en el servidor</span>}
                  </p>
                  {drive.images.ok + drive.images.missing < drive.images.total && drive.images.pending === 0 && (
                    <button className="mt-2 w-full border p-1 hover:bg-gray-100 disabled:opacity-50" disabled={busy} onClick={() => backfill()}>
                      Respaldar las imagenes que faltan
                    </button>
                  )}
                </div>
              )}
              <button className="mt-2 w-full border p-2 hover:bg-gray-100 disabled:opacity-50" disabled={busy} onClick={disconnect}>
                Desvincular mi Google Drive
              </button>
            </div>
          )}

          {info && <p className="mt-2 rounded bg-blue-100 p-2 text-sm">{info}</p>}
          {error && <p className="mt-2 rounded bg-red-100 p-2 text-sm">{error}</p>}
        </section>
      </div>
    </div>
  );
}
