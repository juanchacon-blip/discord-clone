-- CreateTable
CREATE TABLE "ChannelRead" (
    "sub" TEXT NOT NULL,
    "channelId" INTEGER NOT NULL,
    "lastReadId" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ChannelRead_pkey" PRIMARY KEY ("sub","channelId")
);

-- AddForeignKey
ALTER TABLE "ChannelRead" ADD CONSTRAINT "ChannelRead_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
