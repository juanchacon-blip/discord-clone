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
    <div className="animate-fade fixed inset-0 z-50 flex items-center justify-center bg-void/70 p-3 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-deep animate-pop max-h-full w-full max-w-lg overflow-y-auto rounded-3xl p-5 text-violet-50 md:p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-gradient text-2xl font-extrabold">⚙️ Configuración</h2>
          <button className="btn-ghost grid h-9 w-9 place-items-center rounded-full" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-[.18em] text-lavender">Cuenta</h3>
          <p>{user?.nickname || user?.name}</p>
          {user?.email && <p className="text-sm text-violet-200/70">{user.email}</p>}
          {user?.sub && <p className="mt-1 break-all text-xs text-violet-300/50">ID de cuenta: {user.sub}</p>}
        </section>

        <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-[.18em] text-lavender">☁️ Respaldo en Google Drive</h3>
          <p className="mt-1 text-sm text-violet-200/80">
            Si conectas tu Drive, <b>todas las imagenes de todos los canales</b> (las tuyas y las de los demas,
            tambien las que ya estaban antes de que te conectaras) se copian a tu Drive, en una carpeta llamada{' '}
            <b>"Discord Clone - Respaldo"</b>. Ocupan espacio de tu Drive. Los archivos que no son imagenes solo
            se copian si los subes tu. La app solo puede ver lo que ella misma guarda ahi; no tiene acceso al
            resto de tu Drive. Puedes desconectarlo cuando quieras.
          </p>

          {driveResult === 'ok' && <p className="mt-2 rounded-xl border border-emerald-300/25 bg-emerald-400/15 text-emerald-100 p-2 text-sm">✅ Google Drive conectado.</p>}
          {driveResult === 'error' && (
            <p className="mt-2 rounded-xl border border-rose-300/25 bg-rose-500/15 text-rose-100 p-2 text-sm">
              ❌ No se pudo conectar. Asegurate de dejar marcado el permiso de Drive en la pantalla de Google e intenta otra vez.
            </p>
          )}
          {loadError && (
            <p className="mt-2 rounded-xl border border-rose-300/25 bg-rose-500/15 text-rose-100 p-2 text-sm">
              No se pudo consultar el estado de Drive ({loadError}). Revisa que el servidor este actualizado y encendido.
            </p>
          )}
          {!drive && !loadError && <p className="mt-2 text-sm text-violet-300/50">Consultando...</p>}

          {drive && !drive.enabled && (
            <div className="mt-2 rounded-xl border border-amber-300/25 bg-amber-400/15 text-amber-100 p-2 text-sm">
              <p><b>Drive aun no esta configurado en el servidor.</b> Falta agregar estas variables de entorno (en Render, seccion Environment):</p>
              <ul className="mt-1 list-disc pl-5">
                {drive.missing?.map(name => <li key={name}><code>{name}</code></li>)}
              </ul>
            </div>
          )}

          {drive?.enabled && !drive.connected && (
            <button className="btn-glow mt-3 w-full rounded-2xl p-3 font-semibold" disabled={busy} onClick={connect}>
              {busy ? 'Abriendo Google...' : 'Vincular mi cuenta de Google Drive'}
            </button>
          )}

          {drive?.enabled && drive.connected && (
            <div className="mt-3">
              <p className="rounded-xl border border-emerald-300/25 bg-emerald-400/15 text-emerald-100 p-2 text-sm">
                ✅ Conectado{drive.email ? <> como <b>{drive.email}</b></> : null}
              </p>
              {drive.images && (
                <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm">
                  <p>
                    🖼️ Imagenes respaldadas: <b>{drive.images.ok}</b> de <b>{drive.images.total}</b>
                    {drive.images.pending > 0 && <span> · ⏳ {drive.images.pending} en proceso</span>}
                    {drive.images.failed > 0 && <span> · ⚠️ {drive.images.failed} fallaron</span>}
                    {drive.images.missing > 0 && <span className="text-violet-300/50"> · {drive.images.missing} ya no existen en el servidor</span>}
                  </p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-violet-500 via-purple-400 to-fuchsia-400 shadow-[0_0_12px_rgba(217,70,239,.7)] transition-all duration-1000"
                      style={{ width: `${drive.images.total ? Math.round((drive.images.ok / drive.images.total) * 100) : 0}%` }} />
                  </div>
                  {drive.images.ok + drive.images.missing < drive.images.total && drive.images.pending === 0 && (
                    <button className="btn-ghost mt-2 w-full rounded-xl p-2 text-sm" disabled={busy} onClick={() => backfill()}>
                      Respaldar las imagenes que faltan
                    </button>
                  )}
                </div>
              )}
              <button className="btn-ghost mt-2 w-full rounded-2xl p-2.5" disabled={busy} onClick={disconnect}>
                Desvincular mi Google Drive
              </button>
            </div>
          )}

          {info && <p className="mt-2 rounded-xl border border-sky-300/25 bg-sky-400/15 text-sky-100 p-2 text-sm">{info}</p>}
          {error && <p className="mt-2 rounded-xl border border-rose-300/25 bg-rose-500/15 text-rose-100 p-2 text-sm">{error}</p>}
        </section>
      </div>
    </div>
  );
}
