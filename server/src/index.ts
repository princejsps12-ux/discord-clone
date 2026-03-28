import cors from "cors";
import dotenv from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import http from "http";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Server as SocketServer } from "socket.io";
import { randomUUID } from "crypto";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { PrismaClient } from "@prisma/client";
import {
  incrementUnreadsForChannel,
  recomputeReceiptsForChannel,
  updateChannelLastMessage,
  ensureMemberChannelState,
} from "./channelState";
import { registerStudentFeatures, registerStudySocketHandlers } from "./studentFeatures";
import { inferMessageCategory, extractCompanyTags } from "./categorize";
import { bumpUserStreak } from "./streak";
import { registerSahayakRoutes, ensureSahayakMemberForServer } from "./sahayak";
type Role = "ADMIN" | "MODERATOR" | "MEMBER";

const userConnectionCounts = new Map<string, number>();

function bumpOnline(prisma: PrismaClient, userId: string, online: boolean) {
  return prisma.user.updateMany({
    where: { id: userId },
    data: online
      ? { isOnline: true, lastSeenAt: new Date() }
      : { isOnline: false, lastSeenAt: new Date() },
  });
}

dotenv.config();

const app = express();
const server = http.createServer(app);
const prisma: PrismaClient = new PrismaClient();
const allowOrigin = (origin?: string) => {
  if (!origin) return true;
  const configured = process.env.CLIENT_URL || "http://localhost:5173";
  const allowedOrigins = configured.split(",").map((o) => o.trim());
  return (
    allowedOrigins.includes(origin) ||
    /^http:\/\/localhost:\d+$/.test(origin) ||
    /^http:\/\/127\.0\.0\.1:\d+$/.test(origin) ||
    /^https:\/\/[\w-]+\.vercel\.app$/.test(origin)
  );
};

/** Path without query — reliable across Express versions for rate-limit / routing checks */
function pathWithoutQuery(req: Request): string {
  const raw = req.originalUrl || req.url || "";
  const q = raw.indexOf("?");
  return q >= 0 ? raw.slice(0, q) : raw;
}

function isSahayakRequest(req: Request): boolean {
  return pathWithoutQuery(req).includes("/sahayak");
}
const io = new SocketServer(server, {
  cors: {
    origin: (origin, callback) => callback(null, allowOrigin(origin)),
    credentials: true,
  },
});

const upload = multer({ storage: multer.memoryStorage() });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => callback(null, allowOrigin(origin)),
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    skip: (req) => isSahayakRequest(req),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res: Response) => {
      res.status(429).json({ error: "Bahut requests — 1 minute baad dubara try karo." });
    },
  }),
);

type AuthRequest = Request & { userId?: string };

function param(req: Request, key: string): string {
  const v = (req.params as Record<string, string | string[] | undefined>)[key];
  if (Array.isArray(v)) return v[0] ?? "";
  return typeof v === "string" ? v : "";
}

const auth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev-secret") as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
};

const canManage = (role: Role) => role === "ADMIN" || role === "MODERATOR";

registerStudentFeatures(app, prisma, io, {
  auth,
  param,
  canManage,
  incrementUnreadsForChannel,
  updateChannelLastMessage,
});

registerSahayakRoutes(app, prisma, io, {
  auth,
  param,
  incrementUnreadsForChannel,
  updateChannelLastMessage,
});

app.get("/api/health", (_req, res: Response) => res.json({ ok: true }));

app.post("/api/auth/register", async (req: Request, res: Response) => {
  const { email, password, name } = req.body as { email: string; password: string; name: string };
  if (!email || !password || !name) return res.status(400).json({ error: "Missing required fields" });
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "Email already in use" });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { email, name, passwordHash, provider: "credentials" } });
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || "dev-secret", { expiresIn: "7d" });
  res.status(201).json({ token, user });
});

app.post("/api/auth/login", async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash) return res.status(401).json({ error: "Invalid credentials" });
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || "dev-secret", { expiresIn: "7d" });
  res.json({ token, user });
});

app.get("/api/auth/me", auth, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  res.json(user);
});

app.patch("/api/auth/profile", auth, async (req: AuthRequest, res: Response) => {
  const { name, imageUrl } = req.body as { name?: string; imageUrl?: string };
  const user = await prisma.user.update({ where: { id: req.userId }, data: { name, imageUrl } });
  res.json(user);
});

app.post("/api/upload", auth, upload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "Missing file" });
  const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
  const result = await cloudinary.uploader.upload(dataUri, { folder: "discord-clone" });
  res.json({ url: result.secure_url });
});

app.post("/api/servers", auth, async (req: AuthRequest, res: Response) => {
  const { name, imageUrl } = req.body as { name: string; imageUrl?: string };
  const serverCreated = await prisma.server.create({
    data: {
      name,
      imageUrl,
      inviteCode: randomUUID(),
      ownerId: req.userId!,
      members: { create: { userId: req.userId!, role: "ADMIN" } },
      channels: {
        create: [
          { name: "general-chat", type: "TEXT" },
          { name: "placement-prep", type: "TEXT" },
          { name: "dsa-help", type: "TEXT" },
          { name: "college-life", type: "TEXT" },
          { name: "Study Room 📚", type: "VOICE" },
          { name: "Group Discussion 🎙️", type: "VOICE" },
          { name: "Night Talk 🌙", type: "VOICE" },
        ],
      },
    },
  });
  await ensureSahayakMemberForServer(prisma, serverCreated.id);
  res.status(201).json(serverCreated);
});

app.get("/api/servers", auth, async (req: AuthRequest, res: Response) => {
  const memberships = await prisma.member.findMany({
    where: { userId: req.userId },
    include: { server: true },
    orderBy: { joinedAt: "asc" },
  });
  res.json(memberships.map((m: { server: unknown }) => m.server));
});

app.post("/api/servers/join/:inviteCode", auth, async (req: AuthRequest, res: Response) => {
  const serverFound = await prisma.server.findUnique({ where: { inviteCode: param(req, "inviteCode") } });
  if (!serverFound) return res.status(404).json({ error: "Invite invalid" });
  await prisma.member.upsert({
    where: { userId_serverId: { userId: req.userId!, serverId: serverFound.id } },
    update: {},
    create: { userId: req.userId!, serverId: serverFound.id, role: "MEMBER" },
  });
  await ensureSahayakMemberForServer(prisma, serverFound.id);
  res.json({ success: true, serverId: serverFound.id });
});

app.get("/api/servers/:serverId/channels", auth, async (req: AuthRequest, res: Response) => {
  const member = await prisma.member.findUnique({
    where: { userId_serverId: { userId: req.userId!, serverId: param(req, "serverId") } },
  });
  if (!member) return res.status(403).json({ error: "Forbidden" });
  const channels = await prisma.channel.findMany({
    where: { serverId: param(req, "serverId") },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  const states = await prisma.memberChannelState.findMany({
    where: { memberId: member.id, channelId: { in: channels.map((c) => c.id) } },
  });
  const stateMap = new Map(states.map((s) => [s.channelId, s]));
  const list = channels.map((c) => {
    const st = stateMap.get(c.id);
    return {
      id: c.id,
      name: c.name,
      type: c.type,
      unreadCount: st?.unreadCount ?? 0,
      isPinned: st?.isPinned ?? false,
      isFavorite: st?.isFavorite ?? false,
      lastMessageAt: c.lastMessageAt,
      lastMessagePreview: c.lastMessagePreview,
      lastMessageSenderName: c.lastMessageSenderName,
    };
  });
  list.sort((a, b) => {
    const ap = a.isPinned ? 0 : 1;
    const bp = b.isPinned ? 0 : 1;
    if (ap !== bp) return ap - bp;
    const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    if (bt !== at) return bt - at;
    return a.name.localeCompare(b.name);
  });
  res.json(list);
});

app.get("/api/servers/:serverId/members", auth, async (req: AuthRequest, res: Response) => {
  const ok = await prisma.member.findUnique({
    where: { userId_serverId: { userId: req.userId!, serverId: param(req, "serverId") } },
  });
  if (!ok) return res.status(403).json({ error: "Forbidden" });
  await ensureSahayakMemberForServer(prisma, param(req, "serverId"));
  const members = await prisma.member.findMany({
    where: { serverId: param(req, "serverId") },
    include: { user: { select: { id: true, name: true, email: true, imageUrl: true, isOnline: true, lastSeenAt: true } } },
    orderBy: { joinedAt: "asc" },
  });
  res.json(members.map((m) => ({ ...m.user, role: m.role, memberId: m.id })));
});

app.post("/api/channels/:channelId/read", auth, async (req: AuthRequest, res: Response) => {
  const channel = await prisma.channel.findUnique({ where: { id: param(req, "channelId") } });
  if (!channel) return res.status(404).json({ error: "Channel not found" });
  const member = await prisma.member.findUnique({
    where: { userId_serverId: { userId: req.userId!, serverId: channel.serverId } },
  });
  if (!member) return res.status(403).json({ error: "Forbidden" });
  await ensureMemberChannelState(prisma, member.id, channel.id);
  await prisma.memberChannelState.update({
    where: { memberId_channelId: { memberId: member.id, channelId: channel.id } },
    data: { unreadCount: 0, lastReadAt: new Date() },
  });
  await recomputeReceiptsForChannel(prisma, channel.id);
  io.to(channel.id).emit("channel:receipts-updated", { channelId: channel.id });
  io.to(channel.serverId).emit("server:channel-activity", { channelId: channel.id, kind: "read", byUserId: req.userId });
  res.json({ ok: true });
});

app.patch("/api/channels/:channelId/preferences", auth, async (req: AuthRequest, res: Response) => {
  const { isPinned, isFavorite } = req.body as { isPinned?: boolean; isFavorite?: boolean };
  const channel = await prisma.channel.findUnique({ where: { id: param(req, "channelId") } });
  if (!channel) return res.status(404).json({ error: "Channel not found" });
  const member = await prisma.member.findUnique({
    where: { userId_serverId: { userId: req.userId!, serverId: channel.serverId } },
  });
  if (!member) return res.status(403).json({ error: "Forbidden" });
  await ensureMemberChannelState(prisma, member.id, channel.id);
  const updated = await prisma.memberChannelState.update({
    where: { memberId_channelId: { memberId: member.id, channelId: channel.id } },
    data: {
      ...(typeof isPinned === "boolean" ? { isPinned } : {}),
      ...(typeof isFavorite === "boolean" ? { isFavorite } : {}),
    },
  });
  io.to(channel.serverId).emit("server:channel-activity", { channelId: channel.id, kind: "prefs" });
  res.json(updated);
});

app.get("/api/search", auth, async (req: AuthRequest, res: Response) => {
  const q = (req.query.q as string | undefined)?.trim();
  const serverId = req.query.serverId as string | undefined;
  const categoryFilter = req.query.category as string | undefined;
  const tagFilter = (req.query.tag as string | undefined)?.trim();
  const cats = ["STUDY", "PLACEMENT", "CASUAL", "UNCATEGORIZED"];
  const categoryWhere =
    categoryFilter && cats.includes(categoryFilter)
      ? { category: categoryFilter as "STUDY" | "PLACEMENT" | "CASUAL" | "UNCATEGORIZED" }
      : {};
  const tagWhere = tagFilter ? { tags: { has: tagFilter } } : {};
  if (!q && !tagFilter && !categoryFilter) return res.json({ messages: [], channels: [], users: [] });
  const memberships = await prisma.member.findMany({
    where: { userId: req.userId!, ...(serverId ? { serverId } : {}) },
    select: { serverId: true },
  });
  const serverIds = [...new Set(memberships.map((m) => m.serverId))];
  if (!serverIds.length) return res.json({ messages: [], channels: [], users: [] });

  const [channels, messages, memberRows] = await Promise.all([
    q
      ? prisma.channel.findMany({
          where: { serverId: { in: serverIds }, name: { contains: q, mode: "insensitive" } },
          take: 20,
          include: { server: { select: { id: true, name: true } } },
        })
      : Promise.resolve([]),
    prisma.message.findMany({
      where: {
        serverId: { in: serverIds },
        ...categoryWhere,
        ...tagWhere,
        ...(q ? { content: { contains: q, mode: "insensitive" } } : {}),
      },
      take: 25,
      orderBy: { createdAt: "desc" },
      include: {
        channel: { select: { id: true, name: true, serverId: true } },
        member: { include: { user: { select: { id: true, name: true } } } },
      },
    }),
    q
      ? prisma.member.findMany({
          where: {
            serverId: { in: serverIds },
            user: {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            },
          },
          take: 30,
          include: {
            user: { select: { id: true, name: true, email: true, isOnline: true } },
            server: { select: { id: true, name: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const seenUser = new Set<string>();
  const users = memberRows
    .filter((row) => {
      if (seenUser.has(row.userId)) return false;
      seenUser.add(row.userId);
      return true;
    })
    .map((row) => ({ ...row.user, serverId: row.serverId, serverName: row.server.name }));

  res.json({ messages, channels, users });
});

app.get("/api/servers/:serverId/scheduled-calls", auth, async (req: AuthRequest, res: Response) => {
  const ok = await prisma.member.findUnique({
    where: { userId_serverId: { userId: req.userId!, serverId: param(req, "serverId") } },
  });
  if (!ok) return res.status(403).json({ error: "Forbidden" });
  const items = await prisma.scheduledCall.findMany({
    where: { serverId: param(req, "serverId"), scheduledAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    orderBy: { scheduledAt: "asc" },
    include: { channel: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true } } },
  });
  res.json(items);
});

app.post("/api/servers/:serverId/scheduled-calls", auth, async (req: AuthRequest, res: Response) => {
  const ok = await prisma.member.findUnique({
    where: { userId_serverId: { userId: req.userId!, serverId: param(req, "serverId") } },
  });
  if (!ok) return res.status(403).json({ error: "Forbidden" });
  const { channelId, title, scheduledAt, isVideo } = req.body as {
    channelId?: string;
    title?: string;
    scheduledAt: string;
    isVideo?: boolean;
  };
  if (!scheduledAt) return res.status(400).json({ error: "scheduledAt required" });
  const when = new Date(scheduledAt);
  if (Number.isNaN(when.getTime())) return res.status(400).json({ error: "Invalid date" });
  const base = (process.env.PUBLIC_APP_URL || process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");
  const created = await prisma.scheduledCall.create({
    data: {
      serverId: param(req, "serverId"),
      channelId: channelId || null,
      title: title || "Scheduled call",
      scheduledAt: when,
      callLink: "pending",
      isVideo: Boolean(isVideo),
      createdById: req.userId!,
    },
  });
  const callLink = `${base}/call/${created.id}`;
  const row = await prisma.scheduledCall.update({
    where: { id: created.id },
    data: { callLink },
    include: { channel: { select: { id: true, name: true } }, server: { select: { id: true, name: true } } },
  });
  io.to(param(req, "serverId")).emit("scheduled-call:created", row);
  res.status(201).json(row);
});

app.get("/api/scheduled-calls/:id", auth, async (req: AuthRequest, res: Response) => {
  const row = await prisma.scheduledCall.findUnique({
    where: { id: param(req, "id") },
    include: { channel: { select: { id: true, name: true, type: true } }, server: { select: { id: true, name: true } } },
  });
  if (!row) return res.status(404).json({ error: "Not found" });
  const member = await prisma.member.findUnique({
    where: { userId_serverId: { userId: req.userId!, serverId: row.serverId } },
  });
  if (!member) return res.status(403).json({ error: "Forbidden" });
  res.json(row);
});

app.delete("/api/scheduled-calls/:id", auth, async (req: AuthRequest, res: Response) => {
  const row = await prisma.scheduledCall.findUnique({ where: { id: param(req, "id") } });
  if (!row) return res.status(404).json({ error: "Not found" });
  const member = await prisma.member.findUnique({
    where: { userId_serverId: { userId: req.userId!, serverId: row.serverId } },
  });
  if (!member) return res.status(403).json({ error: "Forbidden" });
  if (row.createdById !== req.userId && !canManage(member.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  await prisma.scheduledCall.delete({ where: { id: row.id } });
  io.to(row.serverId).emit("scheduled-call:deleted", { id: row.id });
  res.json({ ok: true });
});

app.post("/api/servers/:serverId/channels", auth, async (req: AuthRequest, res: Response) => {
  const member = await prisma.member.findUnique({
    where: { userId_serverId: { userId: req.userId!, serverId: param(req, "serverId") } },
  });
  if (!member || !canManage(member.role)) return res.status(403).json({ error: "Forbidden" });
  const { name, type } = req.body as { name: string; type: "TEXT" | "VOICE" };
  const channel = await prisma.channel.create({ data: { name, type, serverId: param(req, "serverId") } });
  io.to(param(req, "serverId")).emit("channel:created", channel);
  res.status(201).json(channel);
});

app.get("/api/channels/:channelId/messages", auth, async (req: AuthRequest, res: Response) => {
  const cursor = req.query.cursor as string | undefined;
  const q = (req.query.q as string | undefined)?.trim();
  const category = req.query.category as string | undefined;
  const catOk = ["STUDY", "PLACEMENT", "CASUAL", "UNCATEGORIZED"].includes(category || "");
  const catEnum = category as "STUDY" | "PLACEMENT" | "CASUAL" | "UNCATEGORIZED";
  const searchOr = q
    ? ([
        { content: { contains: q, mode: "insensitive" as const } },
        { member: { user: { name: { contains: q, mode: "insensitive" as const } } } },
      ] as const)
    : null;
  /** AI replies are often STUDY; keep them visible even when filtering by another category */
  const categoryOr = catOk
    ? [{ category: catEnum }, { isSahayakAi: true }, { isAiAssistant: true }]
    : null;
  const where =
    categoryOr && searchOr
      ? {
          channelId: param(req, "channelId"),
          AND: [{ OR: categoryOr }, { OR: [...searchOr] }],
        }
      : categoryOr
        ? { channelId: param(req, "channelId"), OR: categoryOr }
        : searchOr
          ? { channelId: param(req, "channelId"), OR: [...searchOr] }
          : { channelId: param(req, "channelId") };
  const messages = await prisma.message.findMany({
    where,
    include: {
      member: { include: { user: true } },
      reactions: { include: { member: { include: { user: true } } } },
    },
    take: 30,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { createdAt: "desc" },
  });
  res.json({ items: messages, nextCursor: messages.at(-1)?.id || null });
});

app.post("/api/channels/:channelId/messages", auth, async (req: AuthRequest, res: Response) => {
  const body = req.body as {
    content?: unknown;
    fileUrl?: unknown;
    category?: string;
    tags?: unknown;
  };
  const fileUrl = typeof body.fileUrl === "string" && body.fileUrl.trim() ? body.fileUrl.trim() : undefined;
  const raw =
    typeof body.content === "string"
      ? body.content
      : body.content != null
        ? String(body.content)
        : "";
  const text = raw.trim() || (fileUrl ? "Attachment" : "");
  if (!text.trim() && !fileUrl) {
    return res.status(400).json({ error: "Message text or attachment required" });
  }
  const channel = await prisma.channel.findUnique({ where: { id: param(req, "channelId") } });
  if (!channel) return res.status(404).json({ error: "Channel not found" });
  const member = await prisma.member.findUnique({
    where: { userId_serverId: { userId: req.userId!, serverId: channel.serverId } },
    include: { user: true },
  });
  if (!member) return res.status(403).json({ error: "Forbidden" });
  const bodyCategory = body.category;
  const bodyTags = body.tags;
  const allowedCat = ["STUDY", "PLACEMENT", "CASUAL", "UNCATEGORIZED"] as const;
  let category = inferMessageCategory(text);
  if (bodyCategory && (allowedCat as readonly string[]).includes(bodyCategory)) {
    category = bodyCategory as (typeof allowedCat)[number];
  }
  const fromBody = Array.isArray(bodyTags) ? bodyTags.map((t) => String(t).trim()).filter(Boolean) : [];
  const tags = [...new Set([...fromBody, ...extractCompanyTags(text)])];
  const preview = (text.trim() || (fileUrl ? "Attachment" : "")).slice(0, 200) || "Message";
  const message = await prisma.message.create({
    data: {
      content: text,
      fileUrl: fileUrl ?? null,
      channelId: channel.id,
      serverId: channel.serverId,
      memberId: member.id,
      receiptStatus: "DELIVERED",
      category,
      tags,
    },
    include: { member: { include: { user: true } }, reactions: { include: { member: { include: { user: true } } } } },
  });
  void bumpUserStreak(prisma, req.userId!).catch(() => undefined);
  await updateChannelLastMessage(prisma, channel.id, preview, member.user.name);
  await incrementUnreadsForChannel(prisma, channel.id, channel.serverId, req.userId!);
  io.to(channel.id).emit("message:new", message);
  io.to(channel.serverId).emit("server:channel-activity", {
    channelId: channel.id,
    kind: "message",
    lastMessagePreview: preview,
    lastMessageAt: message.createdAt.toISOString(),
    lastMessageSenderName: member.user.name,
    fromUserId: req.userId,
  });
  res.status(201).json(message);
});

app.patch("/api/messages/:messageId", auth, async (req: AuthRequest, res: Response) => {
  const existing = await prisma.message.findUnique({
    where: { id: param(req, "messageId") },
    include: { member: true },
  });
  if (!existing) return res.status(404).json({ error: "Message not found" });
  const membership = await prisma.member.findUnique({
    where: { userId_serverId: { userId: req.userId!, serverId: existing.serverId } },
  });
  if (!membership) return res.status(403).json({ error: "Forbidden" });
  if (existing.member.userId !== req.userId && !canManage(membership.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const updated = await prisma.message.update({
    where: { id: param(req, "messageId") },
    data: { content: req.body.content, edited: true },
    include: { member: { include: { user: true } }, reactions: { include: { member: { include: { user: true } } } } },
  });
  io.to(existing.channelId).emit("message:updated", updated);
  res.json(updated);
});

app.delete("/api/messages/:messageId", auth, async (req: AuthRequest, res: Response) => {
  const existing = await prisma.message.findUnique({
    where: { id: param(req, "messageId") },
    include: { member: true },
  });
  if (!existing) return res.status(404).json({ error: "Message not found" });
  const membership = await prisma.member.findUnique({
    where: { userId_serverId: { userId: req.userId!, serverId: existing.serverId } },
  });
  if (!membership) return res.status(403).json({ error: "Forbidden" });
  if (existing.member.userId !== req.userId && !canManage(membership.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  await prisma.message.delete({ where: { id: param(req, "messageId") } });
  io.to(existing.channelId).emit("message:deleted", { id: existing.id });
  res.json({ success: true });
});

app.post("/api/messages/:messageId/reactions", auth, async (req: AuthRequest, res: Response) => {
  const { emoji } = req.body as { emoji: string };
  if (!emoji) return res.status(400).json({ error: "Missing emoji" });
  const existing = await prisma.message.findUnique({ where: { id: param(req, "messageId") } });
  if (!existing) return res.status(404).json({ error: "Message not found" });
  const membership = await prisma.member.findUnique({
    where: { userId_serverId: { userId: req.userId!, serverId: existing.serverId } },
  });
  if (!membership) return res.status(403).json({ error: "Forbidden" });

  const reactionFound = await prisma.reaction.findUnique({
    where: { messageId_memberId_emoji: { messageId: existing.id, memberId: membership.id, emoji } },
  });
  if (reactionFound) {
    await prisma.reaction.delete({ where: { id: reactionFound.id } });
  } else {
    await prisma.reaction.create({ data: { emoji, messageId: existing.id, memberId: membership.id } });
  }

  const reactions = await prisma.reaction.findMany({
    where: { messageId: existing.id },
    include: { member: { include: { user: true } } },
  });
  io.to(existing.channelId).emit("message:reactions", { messageId: existing.id, reactions });
  res.json({ messageId: existing.id, reactions });
});

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token as string;
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev-secret") as { userId: string };
    (socket.data as { userId?: string }).userId = decoded.userId;
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  const userId = (socket.data as { userId?: string }).userId;
  if (!userId) {
    socket.disconnect();
    return;
  }

  const prev = userConnectionCounts.get(userId) || 0;
  userConnectionCounts.set(userId, prev + 1);
  if (prev === 0) {
    void bumpOnline(prisma, userId, true).then(() => {
      io.emit("presence:update", { userId, isOnline: true, lastSeenAt: new Date().toISOString() });
    });
  }
  socket.join(`user:${userId}`);

  socket.on("join-server", (serverId: string) => {
    socket.join(serverId);
  });
  socket.on("join-channel", (channelId: string) => {
    socket.join(channelId);
  });
  socket.on("typing", (payload: { channelId: string; userName: string }) => {
    socket.to(payload.channelId).emit("typing", payload);
  });
  socket.on("typing:stop", (payload: { channelId: string; userName: string }) => {
    socket.to(payload.channelId).emit("typing:stop", payload);
  });
  socket.on("voice:join", (payload: { channelId: string; userId: string; userName: string }) => {
    socket.join(payload.channelId);
    io.to(payload.channelId).emit("voice:user-joined", payload);
  });
  socket.on("voice:signal", (payload: { channelId: string; signal: unknown; to: string; from: string }) => {
    io.to(payload.to).emit("voice:signal", payload);
  });
  socket.on("voice:leave", (payload: { channelId: string; userId: string }) => {
    socket.leave(payload.channelId);
    io.to(payload.channelId).emit("voice:user-left", payload);
  });

  registerStudySocketHandlers(socket, io, userId);

  socket.on("disconnect", () => {
    const n = (userConnectionCounts.get(userId) || 1) - 1;
    if (n <= 0) {
      userConnectionCounts.delete(userId);
      void bumpOnline(prisma, userId, false).then(() => {
        io.emit("presence:update", { userId, isOnline: false, lastSeenAt: new Date().toISOString() });
      });
    } else {
      userConnectionCounts.set(userId, n);
    }
  });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const port = Number(process.env.PORT || 4000);
const host = process.env.BIND_HOST || "0.0.0.0";
server.listen(port, host, () => console.log(`API running on http://127.0.0.1:${port} (bound ${host})`));

