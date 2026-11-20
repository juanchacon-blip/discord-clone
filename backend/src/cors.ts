import 'dotenv/config';

// FRONTEND_URL puede ser una o varias URLs separadas por coma.
// Si no se define, se permite cualquier origen (en produccion con todo en una
// sola URL no hace falta CORS, porque el navegador y el servidor comparten origen).
export function allowedOrigins(): string[] | undefined {
  const list = (process.env.FRONTEND_URL ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : undefined;
}
