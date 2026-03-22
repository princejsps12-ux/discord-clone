-- CreateEnum
CREATE TYPE "MessageReceiptStatus" AS ENUM ('SENT', 'DELIVERED', 'SEEN');

-- AlterTable
ALTER TABLE "Channel" ADD COLUMN     "lastMessageAt" TIMESTAMP(3),
ADD COLUMN     "lastMessagePreview" TEXT,
ADD COLUMN     "lastMessageSenderName" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "receiptStatus" "MessageReceiptStatus" NOT NULL DEFAULT 'SENT';

-- Existing rows: treat as delivered on server
UPDATE "Message" SET "receiptStatus" = 'DELIVERED' WHERE "receiptStatus" = 'SENT';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isOnline" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MemberChannelState" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "lastReadAt" TIMESTAMP(3),

    CONSTRAINT "MemberChannelState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledCall" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "channelId" TEXT,
    "title" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "callLink" TEXT NOT NULL,
    "isVideo" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberChannelState_channelId_idx" ON "MemberChannelState"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberChannelState_memberId_channelId_key" ON "MemberChannelState"("memberId", "channelId");

-- CreateIndex
CREATE INDEX "ScheduledCall_serverId_idx" ON "ScheduledCall"("serverId");

-- CreateIndex
CREATE INDEX "ScheduledCall_scheduledAt_idx" ON "ScheduledCall"("scheduledAt");

-- AddForeignKey
ALTER TABLE "MemberChannelState" ADD CONSTRAINT "MemberChannelState_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberChannelState" ADD CONSTRAINT "MemberChannelState_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledCall" ADD CONSTRAINT "ScheduledCall_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledCall" ADD CONSTRAINT "ScheduledCall_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledCall" ADD CONSTRAINT "ScheduledCall_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
