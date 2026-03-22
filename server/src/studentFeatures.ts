import type { Express, Request, Response, NextFunction } from "express";
import type { Server as SocketServer } from "socket.io";
import type { PrismaClient } from "@prisma/client";
import { answerStudentQuestion } from "./aiService";
import { addStudyMinutes, bumpUserStreak } from "./streak";

type AuthRequest = Request & { userId?: string };
type Role = "ADMIN" | "MODERATOR" | "MEMBER";

export function registerStudentFeatures(
  app: Express,
  prisma: PrismaClient,
  io: SocketServer,
  deps: {
    auth: (req: AuthRequest, res: Response, next: NextFunction) => void;
    param: (req: Request, key: string) => string;
    canManage: (role: Role) => boolean;
    incrementUnreadsForChannel: (
      prisma: PrismaClient,
      channelId: string,
      serverId: string,
      excludeUserId: string,
    ) => Promise<void>;
    updateChannelLastMessage: (prisma: PrismaClient, channelId: string, preview: string, senderName: string) => Promise<void>;
  },
) {
  const { auth, param, canManage, incrementUnreadsForChannel, updateChannelLastMessage } = deps;

  app.post("/api/ai/ask", auth, async (req: AuthRequest, res) => {
    const { channelId, question } = req.body as { channelId: string; question: string };
    if (!channelId || !question?.trim()) return res.status(400).json({ error: "channelId and question required" });
    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel || channel.type !== "TEXT") return res.status(404).json({ error: "Channel not found" });
    const member = await prisma.member.findUnique({
      where: { userId_serverId: { userId: req.userId!, serverId: channel.serverId } },
      include: { user: true },
    });
    if (!member) return res.status(403).json({ error: "Forbidden" });
    const lastMessages = await prisma.message.findMany({
      where: { channelId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { content: true },
    });
    const context = lastMessages.map((m) => m.content).join("\n");
    const answer = await answerStudentQuestion(question.trim(), context);
    const preview = `🤖 AI: ${answer.slice(0, 80)}…`;
    const message = await prisma.message.create({
      data: {
        content: `🤖 **AI Assistant**\n\n${answer}`,
        channelId: channel.id,
        serverId: channel.serverId,
        memberId: member.id,
        receiptStatus: "DELIVERED",
        category: "STUDY",
        isAiAssistant: true,
        tags: [],
      },
      include: { member: { include: { user: true } }, reactions: { include: { member: { include: { user: true } } } } },
    });
    await updateChannelLastMessage(prisma, channel.id, preview, "AI Assistant");
    await incrementUnreadsForChannel(prisma, channel.id, channel.serverId, req.userId!);
    io.to(channel.id).emit("message:new", message);
    io.to(channel.serverId).emit("server:channel-activity", {
      channelId: channel.id,
      kind: "message",
      lastMessagePreview: preview,
      lastMessageAt: message.createdAt.toISOString(),
      lastMessageSenderName: "AI Assistant",
      fromUserId: req.userId,
    });
    res.status(201).json(message);
  });

  app.patch("/api/messages/:messageId/meta", auth, async (req: AuthRequest, res) => {
    const { tags, category } = req.body as { tags?: string[]; category?: string };
    const existing = await prisma.message.findUnique({ where: { id: param(req, "messageId") } });
    if (!existing) return res.status(404).json({ error: "Not found" });
    const membership = await prisma.member.findUnique({
      where: { userId_serverId: { userId: req.userId!, serverId: existing.serverId } },
    });
    if (!membership) return res.status(403).json({ error: "Forbidden" });
    if (existing.memberId !== membership.id && !canManage(membership.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const updated = await prisma.message.update({
      where: { id: existing.id },
      data: {
        ...(Array.isArray(tags) ? { tags } : {}),
        ...(category && ["STUDY", "PLACEMENT", "CASUAL", "UNCATEGORIZED"].includes(category)
          ? { category: category as "STUDY" | "PLACEMENT" | "CASUAL" | "UNCATEGORIZED" }
          : {}),
      },
      include: { member: { include: { user: true } }, reactions: { include: { member: { include: { user: true } } } } },
    });
    io.to(existing.channelId).emit("message:updated", updated);
    res.json(updated);
  });

  app.get("/api/bookmarks", auth, async (req: AuthRequest, res) => {
    const rows = await prisma.bookmark.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        message: {
          include: {
            member: { include: { user: true } },
            channel: { select: { id: true, name: true } },
            reactions: { include: { member: { include: { user: true } } } },
          },
        },
      },
    });
    res.json(rows.map((r) => r.message));
  });

  app.post("/api/messages/:messageId/bookmark", auth, async (req: AuthRequest, res) => {
    const existing = await prisma.message.findUnique({ where: { id: param(req, "messageId") } });
    if (!existing) return res.status(404).json({ error: "Not found" });
    const member = await prisma.member.findUnique({
      where: { userId_serverId: { userId: req.userId!, serverId: existing.serverId } },
    });
    if (!member) return res.status(403).json({ error: "Forbidden" });
    await prisma.bookmark.upsert({
      where: { userId_messageId: { userId: req.userId!, messageId: existing.id } },
      create: { userId: req.userId!, messageId: existing.id },
      update: {},
    });
    res.json({ ok: true });
  });

  app.delete("/api/messages/:messageId/bookmark", auth, async (req: AuthRequest, res) => {
    await prisma.bookmark.deleteMany({ where: { userId: req.userId!, messageId: param(req, "messageId") } });
    res.json({ ok: true });
  });

  app.get("/api/servers/:serverId/notes", auth, async (req: AuthRequest, res) => {
    const ok = await prisma.member.findUnique({
      where: { userId_serverId: { userId: req.userId!, serverId: param(req, "serverId") } },
    });
    if (!ok) return res.status(403).json({ error: "Forbidden" });
    const channelId = req.query.channelId as string | undefined;
    const notes = await prisma.note.findMany({
      where: { serverId: param(req, "serverId"), ...(channelId ? { channelId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { uploadedBy: { select: { id: true, name: true } }, channel: { select: { id: true, name: true } } },
    });
    res.json(notes);
  });

  app.post("/api/servers/:serverId/notes", auth, async (req: AuthRequest, res) => {
    const ok = await prisma.member.findUnique({
      where: { userId_serverId: { userId: req.userId!, serverId: param(req, "serverId") } },
    });
    if (!ok) return res.status(403).json({ error: "Forbidden" });
    const { title, fileUrl, mimeType, channelId } = req.body as {
      title: string;
      fileUrl: string;
      mimeType?: string;
      channelId?: string;
    };
    if (!title || !fileUrl) return res.status(400).json({ error: "title and fileUrl required" });
    if (channelId) {
      const ch = await prisma.channel.findFirst({
        where: { id: channelId, serverId: param(req, "serverId") },
      });
      if (!ch) return res.status(400).json({ error: "Invalid channel" });
    }
    const note = await prisma.note.create({
      data: {
        serverId: param(req, "serverId"),
        channelId: channelId || null,
        title,
        fileUrl,
        mimeType: mimeType || null,
        uploadedById: req.userId!,
      },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });
    io.to(param(req, "serverId")).emit("notes:updated", { serverId: param(req, "serverId") });
    res.status(201).json(note);
  });

  app.post("/api/channels/:channelId/polls", auth, async (req: AuthRequest, res) => {
    const { question, options } = req.body as { question: string; options: string[] };
    if (!question?.trim() || !options?.length) return res.status(400).json({ error: "question and options required" });
    const channel = await prisma.channel.findUnique({ where: { id: param(req, "channelId") } });
    if (!channel || channel.type !== "TEXT") return res.status(404).json({ error: "Not found" });
    const member = await prisma.member.findUnique({
      where: { userId_serverId: { userId: req.userId!, serverId: channel.serverId } },
      include: { user: true },
    });
    if (!member) return res.status(403).json({ error: "Forbidden" });
    const poll = await prisma.poll.create({
      data: {
        channelId: channel.id,
        serverId: channel.serverId,
        memberId: member.id,
        question: question.trim(),
        options: {
          create: options.slice(0, 8).map((text, i) => ({ text: text.trim(), sortOrder: i })),
        },
      },
      include: {
        options: { orderBy: { sortOrder: "asc" } },
        votes: true,
        member: { include: { user: true } },
      },
    });
    io.to(channel.id).emit("poll:new", poll);
    res.status(201).json(poll);
  });

  app.get("/api/channels/:channelId/polls", auth, async (req: AuthRequest, res) => {
    const channel = await prisma.channel.findUnique({ where: { id: param(req, "channelId") } });
    if (!channel) return res.status(404).json({ error: "Not found" });
    const member = await prisma.member.findUnique({
      where: { userId_serverId: { userId: req.userId!, serverId: channel.serverId } },
    });
    if (!member) return res.status(403).json({ error: "Forbidden" });
    const polls = await prisma.poll.findMany({
      where: { channelId: channel.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        options: { orderBy: { sortOrder: "asc" } },
        votes: true,
        member: { include: { user: true } },
      },
    });
    res.json(polls);
  });

  app.post("/api/polls/:pollId/vote", auth, async (req: AuthRequest, res) => {
    const { optionId } = req.body as { optionId: string };
    if (!optionId) return res.status(400).json({ error: "optionId required" });
    const poll = await prisma.poll.findUnique({ where: { id: param(req, "pollId") } });
    if (!poll) return res.status(404).json({ error: "Not found" });
    const member = await prisma.member.findUnique({
      where: { userId_serverId: { userId: req.userId!, serverId: poll.serverId } },
    });
    if (!member) return res.status(403).json({ error: "Forbidden" });
    const opt = await prisma.pollOption.findFirst({ where: { id: optionId, pollId: poll.id } });
    if (!opt) return res.status(400).json({ error: "Invalid option" });
    await prisma.pollVote.upsert({
      where: { pollId_memberId: { pollId: poll.id, memberId: member.id } },
      create: { pollId: poll.id, optionId, memberId: member.id },
      update: { optionId },
    });
    const full = await prisma.poll.findUnique({
      where: { id: poll.id },
      include: {
        options: { orderBy: { sortOrder: "asc" } },
        votes: true,
        member: { include: { user: true } },
      },
    });
    io.to(poll.channelId).emit("poll:updated", full);
    res.json(full);
  });

  app.post("/api/channels/:channelId/study-sessions", auth, async (req: AuthRequest, res) => {
    const { title, plannedMinutes } = req.body as { title?: string; plannedMinutes?: number };
    const channel = await prisma.channel.findUnique({ where: { id: param(req, "channelId") } });
    if (!channel) return res.status(404).json({ error: "Not found" });
    const member = await prisma.member.findUnique({
      where: { userId_serverId: { userId: req.userId!, serverId: channel.serverId } },
    });
    if (!member) return res.status(403).json({ error: "Forbidden" });
    const session = await prisma.studySession.create({
      data: {
        serverId: channel.serverId,
        channelId: channel.id,
        creatorMemberId: member.id,
        title: title?.trim() || "Group study",
        plannedMinutes: Math.min(180, Math.max(5, plannedMinutes ?? 25)),
        participants: { create: { memberId: member.id } },
      },
      include: { participants: { include: { member: { include: { user: true } } } }, creator: { include: { user: true } } },
    });
    io.to(channel.id).emit("study:session", { action: "start", session });
    bumpUserStreak(prisma, req.userId!).catch(() => undefined);
    res.status(201).json(session);
  });

  app.post("/api/study-sessions/:sessionId/join", auth, async (req: AuthRequest, res) => {
    const session = await prisma.studySession.findUnique({ where: { id: param(req, "sessionId") } });
    if (!session || session.endedAt) return res.status(404).json({ error: "Not found" });
    const member = await prisma.member.findUnique({
      where: { userId_serverId: { userId: req.userId!, serverId: session.serverId } },
    });
    if (!member) return res.status(403).json({ error: "Forbidden" });
    await prisma.studyParticipant.upsert({
      where: { sessionId_memberId: { sessionId: session.id, memberId: member.id } },
      create: { sessionId: session.id, memberId: member.id },
      update: { leftAt: null },
    });
    const full = await prisma.studySession.findUnique({
      where: { id: session.id },
      include: { participants: { include: { member: { include: { user: true } } } } },
    });
    io.to(session.channelId).emit("study:session", { action: "update", session: full });
    bumpUserStreak(prisma, req.userId!).catch(() => undefined);
    res.json(full);
  });

  app.patch("/api/study-sessions/:sessionId/end", auth, async (req: AuthRequest, res) => {
    const session = await prisma.studySession.findUnique({ where: { id: param(req, "sessionId") } });
    if (!session) return res.status(404).json({ error: "Not found" });
    const member = await prisma.member.findUnique({
      where: { userId_serverId: { userId: req.userId!, serverId: session.serverId } },
    });
    if (!member || (session.creatorMemberId !== member.id && !canManage(member.role))) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const endedAt = new Date();
    const minutes = Math.max(1, (endedAt.getTime() - session.startedAt.getTime()) / 60_000);
    await prisma.studySession.update({
      where: { id: session.id },
      data: { endedAt },
    });
    const participants = await prisma.studyParticipant.findMany({
      where: { sessionId: session.id },
      include: { member: { include: { user: true } } },
    });
    for (const p of participants) {
      await addStudyMinutes(prisma, p.member.userId, minutes / Math.max(1, participants.length));
    }
    io.to(session.channelId).emit("study:session", { action: "end", sessionId: session.id });
    res.json({ ok: true, minutes: Math.round(minutes) });
  });

  app.get("/api/channels/:channelId/study-sessions/active", auth, async (req: AuthRequest, res) => {
    const channel = await prisma.channel.findUnique({ where: { id: param(req, "channelId") } });
    if (!channel) return res.status(404).json({ error: "Not found" });
    const member = await prisma.member.findUnique({
      where: { userId_serverId: { userId: req.userId!, serverId: channel.serverId } },
    });
    if (!member) return res.status(403).json({ error: "Forbidden" });
    const active = await prisma.studySession.findMany({
      where: { channelId: channel.id, endedAt: null },
      include: { participants: { include: { member: { include: { user: true } } } }, creator: { include: { user: true } } },
    });
    res.json(active);
  });

  app.get("/api/streak/me", auth, async (req: AuthRequest, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { streakCurrent: true, streakLastDate: true, studyMinutesTotal: true },
    });
    res.json(user);
  });

  app.get("/api/servers/:serverId/leaderboard", auth, async (req: AuthRequest, res) => {
    const ok = await prisma.member.findUnique({
      where: { userId_serverId: { userId: req.userId!, serverId: param(req, "serverId") } },
    });
    if (!ok) return res.status(403).json({ error: "Forbidden" });
    const since = new Date(Date.now() - 7 * 86_400_000);
    const rows = await prisma.message.groupBy({
      by: ["memberId"],
      where: {
        serverId: param(req, "serverId"),
        createdAt: { gte: since },
        isAiAssistant: false,
        isSahayakAi: false,
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 15,
    });
    const members = await prisma.member.findMany({
      where: { id: { in: rows.map((r) => r.memberId) } },
      include: { user: { select: { id: true, name: true, streakCurrent: true } } },
    });
    const map = new Map(members.map((m) => [m.id, m]));
    res.json(
      rows.map((r) => ({
        messageCount: r._count.id,
        user: map.get(r.memberId)?.user,
      })),
    );
  });

  app.get("/api/servers/:serverId/analytics", auth, async (req: AuthRequest, res) => {
    const ok = await prisma.member.findUnique({
      where: { userId_serverId: { userId: req.userId!, serverId: param(req, "serverId") } },
    });
    if (!ok) return res.status(403).json({ error: "Forbidden" });
    const serverId = param(req, "serverId");
    const since = new Date(Date.now() - 7 * 86_400_000);
    const [memberCount, activeContributors, topChannels, studySum, msgByCat] = await Promise.all([
      prisma.member.count({ where: { serverId } }),
      prisma.message.groupBy({
        by: ["memberId"],
        where: { serverId, createdAt: { gte: since } },
        _count: { id: true },
      }),
      prisma.message.groupBy({
        by: ["channelId"],
        where: { serverId, createdAt: { gte: since } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 8,
      }),
      prisma.studySession.aggregate({
        where: { serverId, endedAt: { not: null }, startedAt: { gte: since } },
        _sum: { plannedMinutes: true },
        _count: { id: true },
      }),
      prisma.message.groupBy({
        by: ["category"],
        where: { serverId, createdAt: { gte: since } },
        _count: { id: true },
      }),
    ]);
    const chIds = topChannels.map((t) => t.channelId);
    const chans = await prisma.channel.findMany({ where: { id: { in: chIds } }, select: { id: true, name: true } });
    const cMap = new Map(chans.map((c) => [c.id, c.name]));
    res.json({
      memberCount,
      activeContributors7d: activeContributors.length,
      topChannels: topChannels.map((t) => ({ channelId: t.channelId, name: cMap.get(t.channelId), messages: t._count.id })),
      studySessionsEnded7d: studySum._count.id,
      plannedMinutesSum7d: studySum._sum.plannedMinutes ?? 0,
      messagesByCategory: msgByCat.map((m) => ({ category: m.category, count: m._count.id })),
    });
  });
}

/** Attach study + typing helpers on socket (call from io.on connection) */
export function registerStudySocketHandlers(
  socket: { on: (ev: string, fn: (p: unknown) => void) => void; join: (room: string) => void; leave: (room: string) => void; to: (room: string) => { emit: (e: string, p: unknown) => void } },
  io: SocketServer,
  userId: string,
) {
  socket.on("study:join", (p: unknown) => {
    const payload = p as { sessionId?: string; channelId?: string };
    if (!payload?.sessionId || !payload?.channelId) return;
    socket.join(`study:${payload.sessionId}`);
    io.to(payload.channelId).emit("study:presence", { sessionId: payload.sessionId, userId, action: "join" });
  });
  socket.on("study:leave", (p: unknown) => {
    const payload = p as { sessionId?: string; channelId?: string };
    if (!payload?.sessionId) return;
    socket.leave(`study:${payload.sessionId}`);
    if (payload.channelId) io.to(payload.channelId).emit("study:presence", { sessionId: payload.sessionId, userId, action: "leave" });
  });
}
