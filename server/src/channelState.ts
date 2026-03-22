import type { PrismaClient } from "@prisma/client";

export async function ensureMemberChannelState(
  prisma: PrismaClient,
  memberId: string,
  channelId: string,
) {
  await prisma.memberChannelState.upsert({
    where: { memberId_channelId: { memberId, channelId } },
    create: { memberId, channelId },
    update: {},
  });
}

export async function incrementUnreadsForChannel(
  prisma: PrismaClient,
  channelId: string,
  serverId: string,
  excludeUserId: string,
) {
  const members = await prisma.member.findMany({
    where: { serverId, userId: { not: excludeUserId } },
    select: { id: true },
  });
  for (const m of members) {
    await prisma.memberChannelState.upsert({
      where: { memberId_channelId: { memberId: m.id, channelId } },
      create: { memberId: m.id, channelId, unreadCount: 1 },
      update: { unreadCount: { increment: 1 } },
    });
  }
}

export async function updateChannelLastMessage(
  prisma: PrismaClient,
  channelId: string,
  preview: string,
  senderName: string,
) {
  await prisma.channel.update({
    where: { id: channelId },
    data: {
      lastMessageAt: new Date(),
      lastMessagePreview: preview.slice(0, 200),
      lastMessageSenderName: senderName,
    },
  });
}

export async function recomputeReceiptsForChannel(prisma: PrismaClient, channelId: string) {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: { server: { include: { members: true } } },
  });
  if (!channel) return;
  const reads = await prisma.memberChannelState.findMany({ where: { channelId } });
  const readMap = new Map(reads.map((r) => [r.memberId, r.lastReadAt]));
  const members = channel.server.members;
  const messages = await prisma.message.findMany({
    where: { channelId },
    select: {
      id: true,
      createdAt: true,
      receiptStatus: true,
      member: { select: { userId: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  for (const msg of messages) {
    const senderUserId = msg.member.userId;
    const others = members.filter((m) => m.userId !== senderUserId);
    const allRead =
      others.length === 0 ||
      others.every((o) => {
        const t = readMap.get(o.id);
        return t != null && t >= msg.createdAt;
      });
    const next = allRead ? "SEEN" : "DELIVERED";
    if (msg.receiptStatus !== next) {
      await prisma.message.update({ where: { id: msg.id }, data: { receiptStatus: next } });
    }
  }
}
