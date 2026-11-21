-- CreateTable
CREATE TABLE "DriveBackup" (
    "sub" TEXT NOT NULL,
    "messageId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "driveFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriveBackup_pkey" PRIMARY KEY ("sub","messageId")
);

-- CreateIndex
CREATE INDEX "DriveBackup_messageId_idx" ON "DriveBackup"("messageId");

-- AddForeignKey
ALTER TABLE "DriveBackup" ADD CONSTRAINT "DriveBackup_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Lo que ya se respaldo antes (cada autor en su propio Drive) cuenta como hecho: no se vuelve a copiar.
INSERT INTO "DriveBackup" ("sub", "messageId", "status", "driveFileId")
SELECT "authorSub", "id", 'ok', "driveFileId" FROM "Message"
WHERE "driveStatus" = 'ok' AND "authorSub" IS NOT NULL;
