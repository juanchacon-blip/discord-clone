-- AlterTable
ALTER TABLE "Message" ADD COLUMN "mimeType" TEXT,
ADD COLUMN "storageKey" TEXT,
ADD COLUMN "authorSub" TEXT,
ADD COLUMN "driveStatus" TEXT,
ADD COLUMN "driveFileId" TEXT;

-- CreateTable
CREATE TABLE "DriveConnection" (
    "sub" TEXT NOT NULL,
    "email" TEXT,
    "refreshToken" TEXT NOT NULL,
    "folderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriveConnection_pkey" PRIMARY KEY ("sub")
);
