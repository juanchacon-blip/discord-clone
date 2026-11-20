import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

// La clave sale de TOKEN_ENCRYPTION_KEY (cualquier texto largo y aleatorio).
function key(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_KEY ?? '';
  if (secret.length < 16) throw new Error('Falta TOKEN_ENCRYPTION_KEY (minimo 16 caracteres) en backend/.env');
  return createHash('sha256').update(secret).digest();
}

/** Cifra con AES-256-GCM. Formato: base64(iv | tag | datos). */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), data]).toString('base64');
}

export function decrypt(payload: string): string {
  const raw = Buffer.from(payload, 'base64');
  const d = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
}

/** Secreto para firmar el "state" del flujo OAuth (distinto al de cifrado). */
export function stateSecret(): Uint8Array {
  return new Uint8Array(createHash('sha256').update('oauth-state:' + (process.env.TOKEN_ENCRYPTION_KEY ?? '')).digest());
}
