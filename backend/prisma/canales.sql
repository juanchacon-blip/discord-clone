-- Tablas de canales y mensajes (equivalente al schema.prisma)

CREATE TABLE "Channel" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Message" (
  "id" SERIAL PRIMARY KEY,
  "content" TEXT NOT NULL,
  "author" TEXT NOT NULL,
  "channelId" INTEGER NOT NULL REFERENCES "Channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Canal de prueba
INSERT INTO "Channel" ("name") VALUES ('general');
