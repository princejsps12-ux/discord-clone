"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureMemberChannelState = ensureMemberChannelState;
exports.incrementUnreadsForChannel = incrementUnreadsForChannel;
exports.updateChannelLastMessage = updateChannelLastMessage;
exports.recomputeReceiptsForChannel = recomputeReceiptsForChannel;
async function ensureMemberChannelState(prisma, memberId, channelId) {
    await prisma.memberChannelState.upsert({
        where: { memberId_channelId: { memberId, channelId } },
        create: { memberId, channelId },
        update: {},
    });
}
async function incrementUnreadsForChannel(prisma, channelId, serverId, excludeUserId) {
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
async function updateChannelLastMessage(prisma, channelId, preview, senderName) {
    await prisma.channel.update({
        where: { id: channelId },
        data: {
            lastMessageAt: new Date(),
            lastMessagePreview: preview.slice(0, 200),
            lastMessageSenderName: senderName,
        },
    });
}
async function recomputeReceiptsForChannel(prisma, channelId) {
    const channel = await prisma.channel.findUnique({
        where: { id: channelId },
        include: { server: { include: { members: true } } },
    });
    if (!channel)
        return;
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
        const allRead = others.length === 0 ||
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
