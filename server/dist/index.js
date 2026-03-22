"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const socket_io_1 = require("socket.io");
const crypto_1 = require("crypto");
const multer_1 = __importDefault(require("multer"));
const cloudinary_1 = require("cloudinary");
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const { PrismaClient } = require("@prisma/client");
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const prisma = new PrismaClient();
const allowOrigin = (origin) => {
    if (!origin)
        return true;
    const configured = process.env.CLIENT_URL || "http://localhost:5173";
    return origin === configured || /^http:\/\/localhost:\d+$/.test(origin);
};
const io = new socket_io_1.Server(server, {
    cors: {
        origin: (origin, callback) => callback(null, allowOrigin(origin)),
        credentials: true,
    },
});
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: (origin, callback) => callback(null, allowOrigin(origin)),
    credentials: true,
}));
app.use(express_1.default.json({ limit: "2mb" }));
app.use((0, express_rate_limit_1.default)({ windowMs: 60 * 1000, max: 120 }));
const auth = (req, res, next) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token)
        return res.status(401).json({ error: "Unauthorized" });
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || "dev-secret");
        req.userId = decoded.userId;
        next();
    }
    catch {
        return res.status(401).json({ error: "Invalid token" });
    }
};
const canManage = (role) => role === "ADMIN" || role === "MODERATOR";
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.post("/api/auth/register", async (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !password || !name)
        return res.status(400).json({ error: "Missing required fields" });
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing)
        return res.status(409).json({ error: "Email already in use" });
    const passwordHash = await bcryptjs_1.default.hash(password, 10);
    const user = await prisma.user.create({ data: { email, name, passwordHash, provider: "credentials" } });
    const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET || "dev-secret", { expiresIn: "7d" });
    res.status(201).json({ token, user });
});
app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash)
        return res.status(401).json({ error: "Invalid credentials" });
    const valid = await bcryptjs_1.default.compare(password, user.passwordHash);
    if (!valid)
        return res.status(401).json({ error: "Invalid credentials" });
    const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET || "dev-secret", { expiresIn: "7d" });
    res.json({ token, user });
});
app.get("/api/auth/me", auth, async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    res.json(user);
});
app.patch("/api/auth/profile", auth, async (req, res) => {
    const { name, imageUrl } = req.body;
    const user = await prisma.user.update({ where: { id: req.userId }, data: { name, imageUrl } });
    res.json(user);
});
app.post("/api/upload", auth, upload.single("file"), async (req, res) => {
    if (!req.file)
        return res.status(400).json({ error: "Missing file" });
    const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    const result = await cloudinary_1.v2.uploader.upload(dataUri, { folder: "discord-clone" });
    res.json({ url: result.secure_url });
});
app.post("/api/servers", auth, async (req, res) => {
    const { name, imageUrl } = req.body;
    const serverCreated = await prisma.server.create({
        data: {
            name,
            imageUrl,
            inviteCode: (0, crypto_1.randomUUID)(),
            ownerId: req.userId,
            members: { create: { userId: req.userId, role: "ADMIN" } },
            channels: { create: [{ name: "general", type: "TEXT" }] },
        },
    });
    res.status(201).json(serverCreated);
});
app.get("/api/servers", auth, async (req, res) => {
    const memberships = await prisma.member.findMany({
        where: { userId: req.userId },
        include: { server: true },
        orderBy: { joinedAt: "asc" },
    });
    res.json(memberships.map((m) => m.server));
});
app.post("/api/servers/join/:inviteCode", auth, async (req, res) => {
    const serverFound = await prisma.server.findUnique({ where: { inviteCode: req.params.inviteCode } });
    if (!serverFound)
        return res.status(404).json({ error: "Invite invalid" });
    await prisma.member.upsert({
        where: { userId_serverId: { userId: req.userId, serverId: serverFound.id } },
        update: {},
        create: { userId: req.userId, serverId: serverFound.id, role: "MEMBER" },
    });
    res.json({ success: true, serverId: serverFound.id });
});
app.get("/api/servers/:serverId/channels", auth, async (req, res) => {
    const channels = await prisma.channel.findMany({
        where: { serverId: req.params.serverId },
        orderBy: [{ type: "asc" }, { name: "asc" }],
    });
    res.json(channels);
});
app.post("/api/servers/:serverId/channels", auth, async (req, res) => {
    const member = await prisma.member.findUnique({
        where: { userId_serverId: { userId: req.userId, serverId: req.params.serverId } },
    });
    if (!member || !canManage(member.role))
        return res.status(403).json({ error: "Forbidden" });
    const { name, type } = req.body;
    const channel = await prisma.channel.create({ data: { name, type, serverId: req.params.serverId } });
    io.to(req.params.serverId).emit("channel:created", channel);
    res.status(201).json(channel);
});
app.get("/api/channels/:channelId/messages", auth, async (req, res) => {
    const cursor = req.query.cursor;
    const q = req.query.q?.trim();
    const messages = await prisma.message.findMany({
        where: {
            channelId: req.params.channelId,
            ...(q
                ? {
                    OR: [
                        { content: { contains: q, mode: "insensitive" } },
                        { member: { user: { name: { contains: q, mode: "insensitive" } } } },
                    ],
                }
                : {}),
        },
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
app.post("/api/channels/:channelId/messages", auth, async (req, res) => {
    const { content, fileUrl } = req.body;
    const channel = await prisma.channel.findUnique({ where: { id: req.params.channelId } });
    if (!channel)
        return res.status(404).json({ error: "Channel not found" });
    const member = await prisma.member.findUnique({
        where: { userId_serverId: { userId: req.userId, serverId: channel.serverId } },
    });
    if (!member)
        return res.status(403).json({ error: "Forbidden" });
    const message = await prisma.message.create({
        data: { content, fileUrl, channelId: channel.id, serverId: channel.serverId, memberId: member.id },
        include: { member: { include: { user: true } }, reactions: { include: { member: { include: { user: true } } } } },
    });
    io.to(channel.id).emit("message:new", message);
    res.status(201).json(message);
});
app.patch("/api/messages/:messageId", auth, async (req, res) => {
    const existing = await prisma.message.findUnique({
        where: { id: req.params.messageId },
        include: { member: true },
    });
    if (!existing)
        return res.status(404).json({ error: "Message not found" });
    const membership = await prisma.member.findUnique({
        where: { userId_serverId: { userId: req.userId, serverId: existing.serverId } },
    });
    if (!membership)
        return res.status(403).json({ error: "Forbidden" });
    if (existing.member.userId !== req.userId && !canManage(membership.role)) {
        return res.status(403).json({ error: "Forbidden" });
    }
    const updated = await prisma.message.update({
        where: { id: req.params.messageId },
        data: { content: req.body.content, edited: true },
        include: { member: { include: { user: true } }, reactions: { include: { member: { include: { user: true } } } } },
    });
    io.to(existing.channelId).emit("message:updated", updated);
    res.json(updated);
});
app.delete("/api/messages/:messageId", auth, async (req, res) => {
    const existing = await prisma.message.findUnique({
        where: { id: req.params.messageId },
        include: { member: true },
    });
    if (!existing)
        return res.status(404).json({ error: "Message not found" });
    const membership = await prisma.member.findUnique({
        where: { userId_serverId: { userId: req.userId, serverId: existing.serverId } },
    });
    if (!membership)
        return res.status(403).json({ error: "Forbidden" });
    if (existing.member.userId !== req.userId && !canManage(membership.role)) {
        return res.status(403).json({ error: "Forbidden" });
    }
    await prisma.message.delete({ where: { id: req.params.messageId } });
    io.to(existing.channelId).emit("message:deleted", { id: existing.id });
    res.json({ success: true });
});
app.post("/api/messages/:messageId/reactions", auth, async (req, res) => {
    const { emoji } = req.body;
    if (!emoji)
        return res.status(400).json({ error: "Missing emoji" });
    const existing = await prisma.message.findUnique({ where: { id: req.params.messageId } });
    if (!existing)
        return res.status(404).json({ error: "Message not found" });
    const membership = await prisma.member.findUnique({
        where: { userId_serverId: { userId: req.userId, serverId: existing.serverId } },
    });
    if (!membership)
        return res.status(403).json({ error: "Forbidden" });
    const reactionFound = await prisma.reaction.findUnique({
        where: { messageId_memberId_emoji: { messageId: existing.id, memberId: membership.id, emoji } },
    });
    if (reactionFound) {
        await prisma.reaction.delete({ where: { id: reactionFound.id } });
    }
    else {
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
        const token = socket.handshake.auth.token;
        jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || "dev-secret");
        next();
    }
    catch {
        next(new Error("Unauthorized"));
    }
});
io.on("connection", (socket) => {
    socket.on("join-server", (serverId) => socket.join(serverId));
    socket.on("join-channel", (channelId) => socket.join(channelId));
    socket.on("typing", (payload) => {
        socket.to(payload.channelId).emit("typing", payload);
    });
    socket.on("typing:stop", (payload) => {
        socket.to(payload.channelId).emit("typing:stop", payload);
    });
    socket.on("voice:join", (payload) => {
        socket.join(payload.channelId);
        io.to(payload.channelId).emit("voice:user-joined", payload);
    });
    socket.on("voice:signal", (payload) => {
        io.to(payload.to).emit("voice:signal", payload);
    });
    socket.on("voice:leave", (payload) => {
        socket.leave(payload.channelId);
        io.to(payload.channelId).emit("voice:user-left", payload);
    });
});
app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
});
const port = Number(process.env.PORT || 4000);
server.listen(port, () => console.log(`API running on :${port}`));
