#!/bin/sh
# Arranque del contenedor: 1) aplica migraciones  2) inicia el servidor.
#
# Las migraciones de Prisma usan un "candado" (pg_advisory_lock) que NO funciona a traves del
# pooler de Neon (host con "-pooler"): se queda esperando y da el error P1002.
# Por eso, SOLO para migrar, se usa la conexion directa (el mismo host sin "-pooler").
# La app sigue usando DATABASE_URL tal cual (con pooler), que es lo mejor para el dia a dia.
MIGRATE_URL=$(printf '%s' "$DATABASE_URL" | sed -E 's#(@[^/?]*)-pooler#\1#')

DATABASE_URL="$MIGRATE_URL" npx prisma migrate deploy || exit 1
exec node dist/main
