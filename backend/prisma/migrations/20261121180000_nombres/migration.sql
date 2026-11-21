-- CreateTable
CREATE TABLE "Profile" (
    "sub" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("sub")
);

-- CreateIndex
CREATE UNIQUE INDEX "Profile_nameKey_key" ON "Profile"("nameKey");
