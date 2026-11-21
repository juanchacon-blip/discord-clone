# Respaldo en Google Drive + almacenamiento propio (gratis)

## Como funciona

Cuando alguien sube una foto/archivo:

1. Se guarda en el **almacenamiento del proyecto** (Supabase Storage, gratis). De ahi sale lo que ve todo el chat.
2. Si esa cuenta **conecto su Google Drive**, ademas se copia en segundo plano a SU Drive,
   en una carpeta llamada "Discord Clone - Respaldo". Solo ella ve ese estado ("☁️ respaldado").
3. Las cuentas sin Drive funcionan igual: solo tienen la copia del proyecto.

Seguridad: se pide el permiso `drive.file`, que deja a la app tocar **solo los archivos que ella
misma crea**. No puede leer el resto del Drive del usuario. Los tokens se guardan cifrados (AES-256-GCM).

---

## 1) Supabase Storage (almacenamiento del proyecto)

1. https://supabase.com -> New project (plan Free).
2. Storage -> New bucket -> nombre `chat-files` -> marca **Public bucket**.
3. Project Settings -> API: copia
   - `Project URL`            -> `SUPABASE_URL`
   - `service_role` (secret)  -> `SUPABASE_SERVICE_KEY`   (NUNCA en el frontend)
4. `SUPABASE_BUCKET=chat-files`

Limites del plan gratis: 1 GB, y el proyecto se pausa tras ~1 semana sin actividad (se reactiva desde el panel).
Si necesitas mas espacio: Cloudflare R2 (10 GB gratis, pide tarjeta). Solo hay que cambiar
`backend/src/storage/storage.service.ts`; el resto del codigo no cambia.

## 2) Google Cloud (Drive)

1. https://console.cloud.google.com -> crea un proyecto.
2. APIs y servicios -> Biblioteca -> activa **Google Drive API**.
3. Pantalla de consentimiento OAuth -> tipo **Externo** -> nombre de la app, correo de soporte.
   - Permisos (scopes): `openid`, `email` y `.../auth/drive.file`
   - **Publica la app ("En produccion")**. Si la dejas en "Prueba", Google borra los tokens
     a los 7 dias y solo deja entrar a los "usuarios de prueba". `drive.file` es un permiso no sensible,
     asi que normalmente no pide verificacion.
4. Credenciales -> Crear credenciales -> **ID de cliente OAuth** -> Aplicacion web.
   URIs de redireccionamiento autorizados (agrega las dos):
   - `http://localhost:3000/drive/callback`
   - `https://TU-APP.onrender.com/drive/callback`
5. Copia el ID y el secreto a `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`.
6. `GOOGLE_REDIRECT_URI` = la URI de arriba que corresponda (local o Render).
7. `TOKEN_ENCRYPTION_KEY` = genera uno:
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   (si lo cambias despues, los usuarios deben reconectar Drive).

## 3) Aplicar la base de datos

```
cd backend
npm install
npx prisma migrate dev      # o en produccion: el Dockerfile ya corre "migrate deploy"
```

## 4) Render

En Environment agrega: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
(la de Render), `TOKEN_ENCRYPTION_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_BUCKET`.

## Probar

1. Entra a la app -> "⚙️ Configuracion" -> "Vincular mi cuenta de Google Drive" -> acepta en Google -> vuelves al chat.
2. Sube una foto: se ve en el chat y debajo dice "respaldado en tu Drive".
3. Revisa tu Drive: carpeta "Discord Clone - Respaldo".
4. Con otra cuenta SIN Drive: sube una foto; se ve igual para todos, sin etiqueta de respaldo.

## Notas

- Si un usuario revoca el acceso desde su cuenta de Google, el siguiente respaldo falla,
  se borra la conexion y el boton "Conectar Google Drive" vuelve a aparecer.
- Si borra la carpeta de respaldo, se crea otra sola en el siguiente archivo.
- Los archivos subidos antes de esta version (`/uploads/...`) no se migran ni se respaldan.
- Solo las imagenes JPG/PNG/GIF/WEBP se muestran en linea (se verifica el contenido real, no el
  tipo que dice el navegador). Otros archivos salen como enlace de descarga.
