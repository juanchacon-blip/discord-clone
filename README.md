# Nebula · Chat en tiempo real con canales

[**Ver la app en producción →**](https://discord-clone-yqg1.onrender.com/)

Chat estilo Discord con canales, mensajes en tiempo real, envío de imágenes con respaldo automático en Google Drive, avisos de mensajes sin leer, nombres personalizables y un panel de administración. Diseño oscuro en violetas con efecto cristal (glassmorphism).

## Características

- **Canales y mensajes en tiempo real** (WebSocket), con indicador de "escribiendo…".
- **Inicio de sesión con Auth0** (correo y contraseña o Google).
- **Imágenes y archivos** (hasta 10 MB). Las imágenes se muestran dentro del chat.
- **Respaldo en Google Drive:** cada cuenta que conecte su Drive recibe copia de todas las imágenes de todos los canales.
- **Notificaciones:** bolita con el número de mensajes sin leer por canal (se conserva al recargar) y contador en el título de la pestaña.
- **Nombre elegible** por cada usuario (único, sin repetirse).
- **Panel de administración** para eliminar canales, mensajes e imágenes.

## Tabla de contenidos

1. [Tecnologías](#1-tecnologías)
2. [Requisitos previos](#2-requisitos-previos)
3. [Instalación paso a paso](#3-instalación-paso-a-paso)
4. [Variables de entorno](#4-variables-de-entorno)
5. [Funciones opcionales](#5-funciones-opcionales)
6. [Comandos útiles](#6-comandos-útiles)
7. [Estructura del proyecto](#7-estructura-del-proyecto)
8. [Publicar en internet](#8-publicar-en-internet)
9. [Solución de problemas](#9-solución-de-problemas)

---

## 1. Tecnologías

| Parte | Tecnología |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4, socket.io-client |
| Backend | NestJS 10, TypeScript, socket.io (WebSocket), Prisma 6 |
| Base de datos | PostgreSQL 16 (local con Docker, o Neon en la nube) |
| Autenticación | Auth0 |
| Archivos | Supabase Storage (o la carpeta `backend/uploads` en desarrollo) |
| Respaldo | Google Drive API (OAuth) |
| Despliegue | Docker + Render |

## 2. Requisitos previos

Instala esto en el computador nuevo:

| Herramienta | Versión | Para qué | Comprobar |
|---|---|---|---|
| [Git](https://git-scm.com/downloads) | cualquiera | descargar el proyecto | `git --version` |
| [Node.js](https://nodejs.org/) | **22 LTS** (recomendado) | ejecutar backend y frontend | `node -v` |
| npm | viene con Node.js | instalar dependencias | `npm -v` |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | cualquiera | base de datos local (opcional) | `docker --version` |
| Cuenta de [Auth0](https://auth0.com/) | plan gratis | inicio de sesión (obligatorio) | — |

Notas:

- Node 20 puede funcionar para lo básico, pero las librerías de Google Drive piden **Node 22**. Usa la 22 y te ahorras problemas.
- Si no quieres usar Docker, puedes instalar [PostgreSQL 16](https://www.postgresql.org/download/) directamente, o usar una base gratis en [Neon](https://neon.com/) (ver paso 3).
- Cuentas de [Supabase](https://supabase.com/) y [Google Cloud](https://console.cloud.google.com/) solo se necesitan para las [funciones opcionales](#5-funciones-opcionales).

## 3. Instalación paso a paso

### Paso 1 · Descargar el proyecto

```bash
git clone https://github.com/juanchacon-blip/discord-clone.git
cd discord-clone
```

### Paso 2 · Configurar Auth0 (inicio de sesión)

La app no funciona sin esto: el servidor verifica en cada conexión que la persona haya iniciado sesión con Auth0.

**2.1 Crear la cuenta.** Entra a [auth0.com](https://auth0.com/), regístrate (plan gratis) y crea un *tenant* (por ejemplo `mi-chat`).

**2.2 Crear la aplicación.**

1. Ve a **Applications → Applications → Create Application**.
2. Nombre: `Nebula Chat`. Tipo: **Single Page Web Applications**. Pulsa **Create**.
3. En la pestaña **Settings** copia el **Domain** y el **Client ID**.
4. Rellena estos tres campos (separa varias direcciones con coma) y pulsa **Save Changes**:

   | Campo | Valor |
   |---|---|
   | Allowed Callback URLs | `http://localhost:5173` |
   | Allowed Logout URLs | `http://localhost:5173` |
   | Allowed Web Origins | `http://localhost:5173` |

   Cuando publiques la app, agrega también la dirección pública (por ejemplo `https://tu-app.onrender.com`).

**2.3 Crear la API.**

1. Ve a **Applications → APIs → Create API**.
2. Nombre: `Nebula API`. **Identifier:** `https://discord-clone-api` (puede ser cualquier dirección; no tiene que existir, solo debe coincidir en las variables de entorno). Algoritmo: `RS256`.
3. Entra a la API creada → pestaña **Settings** y activa **Allow Offline Access**. Sirve para que la sesión se renueve sola.

**2.4 (Opcional) Entrar con Google.** Ve a **Authentication → Social → Create Connection → Google**. Para probar sirven las claves de desarrollo que ofrece Auth0 (para producción conviene usar las tuyas). En la pestaña **Applications** de esa conexión, activa tu aplicación.

**2.5 Anota estos tres datos**, los usarás en el paso 4:

| Dato | Ejemplo |
|---|---|
| Domain (**sin** `https://`) | `mi-chat.us.auth0.com` |
| Client ID | `AbCdEf123...` |
| Audience (el Identifier de la API) | `https://discord-clone-api` |

### Paso 3 · Preparar la base de datos

Elige **una** opción.

**Opción A · Docker (la más fácil).** En la carpeta raíz del proyecto:

```bash
docker compose up -d
```

Crea un PostgreSQL 16 con usuario `postgres`, contraseña `postgres`, base `discord_clone` y puerto `5432`. Comprueba que esté encendido con `docker compose ps`.

> Para apagarlo sin perder los datos usa `docker compose stop` (y `docker compose start` para encenderlo). Con `docker compose down` la próxima vez se crea una base nueva y vacía.

**Opción B · PostgreSQL instalado.** Instálalo, crea la base y ajusta `DATABASE_URL` en el paso 4 con tu usuario y contraseña:

```bash
psql -U postgres -c "CREATE DATABASE discord_clone;"
```

**Opción C · Neon (en la nube, gratis).** Crea un proyecto en [neon.com](https://neon.com/) y copia el *connection string* (empieza con `postgresql://`). Usa la conexión **directa**, la que **no** lleva `-pooler` en el nombre del servidor; con la otra las migraciones se quedan esperando (ver [problemas](#9-solución-de-problemas)).

### Paso 4 · Backend

```bash
cd backend
```

**4.1 Crear el archivo `.env`** a partir del ejemplo:

```bash
# Windows (CMD o PowerShell)
copy .env.example .env

# macOS / Linux
cp .env.example .env
```

**4.2 Editarlo.** Para empezar solo necesitas estas cuatro líneas; el resto es opcional. Google Drive y Supabase quedan desactivados mientras no pongas `TOKEN_ENCRYPTION_KEY` y `SUPABASE_SERVICE_KEY`, y sin `ADMIN_EMAILS` nadie será administrador:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/discord_clone"
FRONTEND_URL=http://localhost:5173
AUTH0_DOMAIN=mi-chat.us.auth0.com
AUTH0_AUDIENCE=https://discord-clone-api
```

**4.3 Instalar, crear las tablas y arrancar:**

```bash
npm install
npx prisma migrate deploy
npm run start:dev
```

- `npm install` también genera el cliente de Prisma automáticamente.
- `npx prisma migrate deploy` crea todas las tablas en la base de datos.
- `npm run start:dev` deja el servidor en **http://localhost:3000** y se reinicia solo al guardar cambios. Debes ver un mensaje como `Nest application successfully started`.

Deja esta terminal abierta.

### Paso 5 · Frontend

Abre **otra terminal** en la carpeta del proyecto:

```bash
cd frontend
```

**5.1 Crear y editar el `.env`:**

```bash
# Windows (CMD o PowerShell)
copy .env.example .env

# macOS / Linux
cp .env.example .env
```

```env
VITE_API_URL=http://localhost:3000
VITE_AUTH0_DOMAIN=mi-chat.us.auth0.com
VITE_AUTH0_CLIENT_ID=AbCdEf123...
VITE_AUTH0_AUDIENCE=https://discord-clone-api
```

> El dominio, el Client ID y el audience deben ser los de **tu** Auth0 (paso 2.5), y el audience debe ser idéntico al del backend.

**5.2 Instalar y arrancar:**

```bash
npm install
npm run dev
```

Queda en **http://localhost:5173**. Si cambias el `.env` del frontend, detén el comando (`Ctrl + C`) y vuelve a ejecutarlo.

### Paso 6 · Probar que todo funciona

1. Abre **http://localhost:5173** y pulsa **Iniciar sesión**. Regístrate o entra con Google.
2. Verás el panel de inicio. En la barra izquierda escribe un nombre en **Nuevo canal** y pulsa **+**.
3. Entra al canal y escribe un mensaje.
4. Abre la app en una ventana de incógnito, inicia sesión con **otra cuenta** y escribe en el mismo canal: el mensaje aparece al instante en las dos ventanas.
5. Sube una imagen con el clip 📎. Se muestra dentro del chat.
6. En **⚙️ Configuración → Tu nombre** puedes cambiar tu nombre.

Si algo falla, revisa la [solución de problemas](#9-solución-de-problemas).

## 4. Variables de entorno

### Backend (`backend/.env`)

| Variable | ¿Obligatoria? | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Dirección de PostgreSQL. |
| `AUTH0_DOMAIN` | Sí | Dominio de Auth0, **sin** `https://`. |
| `AUTH0_AUDIENCE` | Sí | Identifier de la API de Auth0. |
| `FRONTEND_URL` | Solo en desarrollo | Dirección del frontend (`http://localhost:5173`). Se aceptan varias separadas por coma. Si se deja vacía, se permite cualquier origen. |
| `PORT` | No | Puerto del servidor (por defecto `3000`; los hostings lo definen solos). |
| `ADMIN_EMAILS` | No | Correo(s) de los administradores, separados por coma. Deben estar **verificados** en Auth0. |
| `ADMIN_SUBS` | No | Alternativa a `ADMIN_EMAILS`: ID(s) de cuenta (aparece en ⚙️ Configuración). |
| `GOOGLE_CLIENT_ID` | Para Drive | ID de cliente OAuth de Google. |
| `GOOGLE_CLIENT_SECRET` | Para Drive | Secreto del cliente OAuth de Google. |
| `GOOGLE_REDIRECT_URI` | Para Drive | `http://localhost:3000/drive/callback` (debe coincidir exactamente con Google Cloud). |
| `TOKEN_ENCRYPTION_KEY` | Para Drive | Texto aleatorio largo que cifra los tokens de Drive en la base de datos. |
| `SUPABASE_URL` | Para archivos en la nube | URL del proyecto de Supabase. |
| `SUPABASE_SERVICE_KEY` | Para archivos en la nube | Clave `service_role` de Supabase (**secreta**). |
| `SUPABASE_BUCKET` | Para archivos en la nube | Nombre del bucket (`chat-files`). |

### Frontend (`frontend/.env`)

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | Dirección del backend (`http://localhost:3000`). En producción va vacía. |
| `VITE_AUTH0_DOMAIN` | Dominio de Auth0 (sin `https://`). |
| `VITE_AUTH0_CLIENT_ID` | Client ID de la aplicación de Auth0. |
| `VITE_AUTH0_AUDIENCE` | Mismo audience que el backend. |

> Las variables `VITE_*` se incorporan al compilar el frontend: si las cambias, hay que volver a ejecutar `npm run dev` (o a compilar / desplegar).

## 5. Funciones opcionales

La app funciona sin estas tres cosas. Cada una tiene su guía:

### Archivos en la nube (Supabase)

Sin Supabase, las imágenes se guardan en `backend/uploads/` (sirve para desarrollo). En hostings gratuitos como Render ese disco se borra al reiniciar, por eso en producción se recomienda Supabase.

1. Crea un proyecto gratis en [supabase.com](https://supabase.com/).
2. En **Storage** crea un bucket llamado `chat-files` y márcalo como **Public**.
3. En **Project Settings → API** copia la **Project URL** y la clave **service_role** (pestaña *Legacy API Keys*) a `SUPABASE_URL` y `SUPABASE_SERVICE_KEY`.

### Respaldo en Google Drive

Permite que cada usuario conecte su Drive desde **⚙️ Configuración**. Requiere crear credenciales OAuth en Google Cloud. Paso a paso: **[GUIA-DRIVE.md](GUIA-DRIVE.md)**.

### Cuenta administradora

Agrega tu correo (verificado en Auth0) en `ADMIN_EMAILS` y aparecerá el botón **🛡️ Administración**. Detalles y seguridad: **[GUIA-ADMIN.md](GUIA-ADMIN.md)**.

## 6. Comandos útiles

| Dónde | Comando | Qué hace |
|---|---|---|
| `backend/` | `npm run start:dev` | Servidor en modo desarrollo (se reinicia solo). |
| `backend/` | `npm run build` | Compila el servidor a `dist/`. |
| `backend/` | `npm run start:prod` | Ejecuta el servidor compilado. |
| `backend/` | `npx prisma migrate deploy` | Aplica las migraciones pendientes (instalación y producción). |
| `backend/` | `npx prisma migrate dev` | Para desarrolladores: crea una migración nueva tras cambiar `schema.prisma`. |
| `backend/` | `npx prisma studio` | Abre una interfaz web para ver los datos de la base. |
| `frontend/` | `npm run dev` | Frontend en modo desarrollo. |
| `frontend/` | `npm run build` | Compila el frontend a `frontend/dist`. |
| `frontend/` | `npm run lint` | Revisa el código. |
| raíz | `docker compose up -d` | Enciende la base de datos local. |

## 7. Estructura del proyecto

```text
discord-clone/
├── backend/                  Servidor (NestJS)
│   ├── prisma/
│   │   ├── schema.prisma     Modelo de la base de datos
│   │   └── migrations/       Historial de cambios de la base
│   ├── src/
│   │   ├── auth/             Verificación de Auth0 y permisos de administrador
│   │   ├── channels/         Canales, mensajes, WebSocket y cola de respaldo
│   │   ├── drive/            Conexión y subida a Google Drive
│   │   ├── storage/          Guardado de archivos (Supabase o disco)
│   │   ├── profile/          Nombre elegido por cada usuario
│   │   ├── admin/            Panel de administración
│   │   └── main.ts           Arranque del servidor
│   ├── start.sh              Aplica migraciones y arranca (usado por Docker)
│   └── .env.example          Plantilla de variables del backend
├── frontend/                 Interfaz (React)
│   ├── src/
│   │   ├── App.tsx           Pantalla de bienvenida y navegación
│   │   ├── index.css         Tema visual (colores, animaciones, cristal)
│   │   └── components/       Chat, inicio, configuración, administración
│   └── .env.example          Plantilla de variables del frontend
├── docker-compose.yml        Base de datos local (PostgreSQL 16)
├── Dockerfile                Construcción para producción
├── GUIA-DRIVE.md             Guía de Google Drive y Supabase
└── GUIA-ADMIN.md             Guía de la cuenta administradora
```

## 8. Publicar en internet

### Probar toda la app en una sola dirección (en tu PC)

En producción el backend también sirve el frontend, así que todo queda en una URL:

```bash
cd frontend
npm run build

cd ../backend
npm run build
npm run start:prod
```

Abre **http://localhost:3000**. Para que el inicio de sesión funcione ahí, agrega `http://localhost:3000` a las tres listas de direcciones de tu aplicación en Auth0 (paso 2.2).

### Render + Neon (gratis, siempre en línea)

1. Sube el proyecto a un repositorio de GitHub (los archivos `.env` **no** se suben, es lo correcto).
2. Crea la base en [neon.com](https://neon.com/) y copia el *connection string*.
3. En [render.com](https://render.com/) → **New → Web Service** → conecta tu repositorio.
   - **Language / Runtime:** Docker (usa el `Dockerfile` de la raíz).
   - **Instance type:** Free.
4. En **Environment** agrega estas variables:

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | el *connection string* de Neon |
   | `AUTH0_DOMAIN` | tu dominio de Auth0 |
   | `AUTH0_AUDIENCE` | tu audience |
   | `VITE_AUTH0_DOMAIN` | tu dominio de Auth0 |
   | `VITE_AUTH0_CLIENT_ID` | tu Client ID |
   | `VITE_AUTH0_AUDIENCE` | tu audience |

   Las tres `VITE_*` se usan al **compilar**: si las cambias, haz un nuevo despliegue. Para las funciones opcionales agrega también las variables de la [sección 4](#4-variables-de-entorno) (con `GOOGLE_REDIRECT_URI` apuntando a `https://tu-app.onrender.com/drive/callback`).
5. En Auth0 agrega `https://tu-app.onrender.com` a **Allowed Callback URLs**, **Allowed Logout URLs** y **Allowed Web Origins**.
6. Pulsa **Deploy**. Render te da la dirección pública de la app.

Notas del plan gratis:

- Si nadie usa la app durante 15 minutos, Render la duerme; la primera visita tarda cerca de 1 minuto.
- No uses la base de datos gratis de Render (se borra a los 30 días): por eso se usa Neon.
- Al arrancar, `backend/start.sh` aplica las migraciones usando la conexión directa de Neon aunque tu `DATABASE_URL` use `-pooler`; la app sí usa la tuya.

## 9. Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| `Environment variable not found: DATABASE_URL` | Falta `backend/.env` | Cópialo desde `.env.example` (paso 4.1). |
| Prisma `P1001: Can't reach database server` | La base no está encendida | `docker compose up -d` y revisa con `docker compose ps`. Si usas Neon, revisa la dirección. |
| Prisma `P1002 ... pg_advisory_lock` (con Neon) | Usas el host con `-pooler` para migrar | En local usa la conexión **directa** (sin `-pooler`). En Render lo resuelve `start.sh`. Si persiste, en Neon → SQL Editor ejecuta `SELECT pg_terminate_backend(pid) FROM pg_locks WHERE locktype = 'advisory' AND pid <> pg_backend_pid();` y vuelve a desplegar. |
| Error de Node o de Vite al instalar o arrancar | Versión vieja de Node | Instala Node 22 LTS y revisa con `node -v`. |
| Aviso `EBADENGINE` al hacer `npm install` | Node anterior a 22 | Actualiza a Node 22 (las librerías de Google lo piden). |
| Auth0: *Callback URL mismatch* | La dirección no está en Auth0 | Agrega `http://localhost:5173` a las tres listas (paso 2.2) y guarda. |
| Auth0: *Service not found* o *invalid audience* | El audience no coincide | Debe ser idéntico en `frontend/.env`, `backend/.env` y el Identifier de la API en Auth0. |
| Inicias sesión pero el chat no conecta; el backend muestra `Token rechazado` | `AUTH0_DOMAIN` mal escrito o audience distinto | El dominio va **sin** `https://`. Revisa que coincida con el del frontend. |
| Pantalla en blanco o login que no abre | Falta `frontend/.env` o no se reinició | Revísalo y reinicia `npm run dev`. |
| Error de CORS en la consola del navegador | `FRONTEND_URL` no coincide | Debe ser exactamente `http://localhost:5173` (con el puerto), o déjalo vacío en desarrollo. |
| `EADDRINUSE` (puerto ocupado) | Otro programa usa el 3000 o el 5173 | Ciérralo, o cambia el puerto del backend con `PORT=3001` en `backend/.env` (y `VITE_API_URL` en el frontend). |
| Las imágenes desaparecen al reiniciar el servidor | Se guardan en un disco temporal | Configura Supabase (sección 5). |
| En ⚙️ Configuración, Drive dice *no está configurado* | Faltan variables de Google | La propia pantalla lista cuáles faltan. Revisa [GUIA-DRIVE.md](GUIA-DRIVE.md). |
| No aparece el botón 🛡️ Administración | El correo no está en la lista o no está verificado | Revisa `ADMIN_EMAILS`, o usa `ADMIN_SUBS` con el *ID de cuenta* de ⚙️ Configuración. Cierra sesión y vuelve a entrar. |
| Cambié el `.env` del backend y no pasa nada | El servidor no lo recargó | Detén (`Ctrl + C`) y ejecuta de nuevo `npm run start:dev`. |

## Seguridad

- **Nunca subas archivos `.env` a GitHub** (ya están en `.gitignore`) ni pegues claves en chats o capturas.
- `SUPABASE_SERVICE_KEY` y `GOOGLE_CLIENT_SECRET` son secretos: solo van en el `.env` del backend o en las variables de Render, nunca en el frontend.
- Si alguna clave se filtra, genera una nueva en el servicio correspondiente y actualízala.







# Link 

[Despliegue](https://discord-clone-yqg1.onrender.com/)
