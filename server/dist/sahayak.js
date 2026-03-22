"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SAHAYAK_EMAIL = void 0;
exports.ensureSahayakMemberForServer = ensureSahayakMemberForServer;
exports.registerSahayakRoutes = registerSahayakRoutes;
const streak_1 = require("./streak");
const categorize_1 = require("./categorize");
const aiService_1 = require("./aiService");
exports.SAHAYAK_EMAIL = "sahayak-ai@bots.internal";
async function ensureSahayakMemberForServer(prisma, serverId) {
    const botUser = await prisma.user.upsert({
        where: { email: exports.SAHAYAK_EMAIL },
        create: {
            email: exports.SAHAYAK_EMAIL,
            name: "Sahayak AI",
            provider: "system",
        },
        update: { name: "Sahayak AI" },
    });
    await prisma.member.upsert({
        where: { userId_serverId: { userId: botUser.id, serverId } },
        create: { userId: botUser.id, serverId, role: "MEMBER" },
        update: {},
    });
    return botUser;
}
function formatHistoryLines(rows) {
    return rows
        .map((m) => {
        const who = m.isSahayakAi || m.isAiAssistant ? "Sahayak AI" : m.member.user.name;
        const line = m.content.replace(/\s+/g, " ").trim();
        return `[${who}]: ${line}`;
    })
        .join("\n");
}
function registerSahayakRoutes(app, prisma, io, deps) {
    const { auth, param, incrementUnreadsForChannel, updateChannelLastMessage } = deps;
    app.post("/api/channels/:channelId/sahayak", auth, async (req, res) => {
        const channelId = param(req, "channelId");
        const body = req.body;
        const s = body.summarize;
        const wantSummary = s === true || s === "true" || s === 1 || s === "1";
        const { prompt, userMessage } = body;
        const channel = await prisma.channel.findUnique({ where: { id: channelId } });
        if (!channel || channel.type !== "TEXT")
            return res.status(404).json({ error: "Channel not found" });
        const member = await prisma.member.findUnique({
            where: { userId_serverId: { userId: req.userId, serverId: channel.serverId } },
            include: { user: true },
        });
        if (!member)
            return res.status(403).json({ error: "Forbidden" });
        await ensureSahayakMemberForServer(prisma, channel.serverId);
        const botUser = await prisma.user.findUnique({ where: { email: exports.SAHAYAK_EMAIL } });
        if (!botUser)
            return res.status(500).json({ error: "Sahayak bot user missing" });
        const botMember = await prisma.member.findUnique({
            where: { userId_serverId: { userId: botUser.id, serverId: channel.serverId } },
        });
        if (!botMember)
            return res.status(500).json({ error: "Sahayak bot member missing" });
        const includeReactions = {
            member: { include: { user: true } },
            reactions: { include: { member: { include: { user: true } } } },
        };
        try {
            if (wantSummary) {
                const recent = await prisma.message.findMany({
                    where: { channelId },
                    orderBy: { createdAt: "desc" },
                    take: 50,
                    include: { member: { include: { user: true } } },
                });
                const chronological = [...recent].reverse();
                if (chronological.length === 0) {
                    const body = "**Sahayak AI** — channel summary\n\nAbhi is channel pe koi message nahi hai jisse summary ban sake. Thodi chat karo, phir dubara **Summarize** dabao 🙂";
                    const botMsg = await prisma.message.create({
                        data: {
                            content: body,
                            channelId: channel.id,
                            serverId: channel.serverId,
                            memberId: botMember.id,
                            receiptStatus: "DELIVERED",
                            category: "UNCATEGORIZED",
                            isSahayakAi: true,
                            isAiAssistant: false,
                            tags: [],
                        },
                        include: includeReactions,
                    });
                    await updateChannelLastMessage(prisma, channel.id, "Sahayak: (empty channel)", "Sahayak AI");
                    await incrementUnreadsForChannel(prisma, channel.id, channel.serverId, req.userId);
                    io.to(channel.id).emit("message:new", botMsg);
                    io.to(channel.serverId).emit("server:channel-activity", {
                        channelId: channel.id,
                        kind: "message",
                        lastMessagePreview: "Sahayak: empty channel",
                        lastMessageAt: botMsg.createdAt.toISOString(),
                        lastMessageSenderName: "Sahayak AI",
                        fromUserId: req.userId,
                    });
                    return res.status(201).json({ botMessage: botMsg });
                }
                const transcript = formatHistoryLines(chronological);
                const summary = await (0, aiService_1.sahayakSummarizeChat)(transcript);
                const body = `**Sahayak AI** — channel summary\n\n${summary}`;
                const preview = `Sahayak: ${summary.slice(0, 80)}${summary.length > 80 ? "…" : ""}`;
                const botMsg = await prisma.message.create({
                    data: {
                        content: body,
                        channelId: channel.id,
                        serverId: channel.serverId,
                        memberId: botMember.id,
                        receiptStatus: "DELIVERED",
                        category: "STUDY",
                        isSahayakAi: true,
                        isAiAssistant: false,
                        tags: [],
                    },
                    include: includeReactions,
                });
                await updateChannelLastMessage(prisma, channel.id, preview, "Sahayak AI");
                await incrementUnreadsForChannel(prisma, channel.id, channel.serverId, req.userId);
                io.to(channel.id).emit("message:new", botMsg);
                io.to(channel.serverId).emit("server:channel-activity", {
                    channelId: channel.id,
                    kind: "message",
                    lastMessagePreview: preview,
                    lastMessageAt: botMsg.createdAt.toISOString(),
                    lastMessageSenderName: "Sahayak AI",
                    fromUserId: req.userId,
                });
                return res.status(201).json({ botMessage: botMsg });
            }
            const trimmedUser = typeof userMessage === "string" ? userMessage.trim() : "";
            let promptForModel = typeof prompt === "string" ? prompt.trim() : "";
            if (!promptForModel && trimmedUser) {
                promptForModel = trimmedUser.replace(/@sahayak\b/gi, "").replace(/\s+/g, " ").trim();
            }
            if (!promptForModel) {
                promptForModel = "Based on recent chat, help out — koi specific doubt ho to batao.";
            }
            let userMsg = null;
            if (trimmedUser) {
                const text = trimmedUser;
                const category = (0, categorize_1.inferMessageCategory)(text);
                const tags = (0, categorize_1.extractCompanyTags)(text);
                userMsg = await prisma.message.create({
                    data: {
                        content: text,
                        channelId: channel.id,
                        serverId: channel.serverId,
                        memberId: member.id,
                        receiptStatus: "DELIVERED",
                        category,
                        tags,
                    },
                    include: includeReactions,
                });
                void (0, streak_1.bumpUserStreak)(prisma, req.userId).catch(() => undefined);
                await updateChannelLastMessage(prisma, channel.id, text.slice(0, 200), member.user.name);
                await incrementUnreadsForChannel(prisma, channel.id, channel.serverId, req.userId);
                io.to(channel.id).emit("message:new", userMsg);
                io.to(channel.serverId).emit("server:channel-activity", {
                    channelId: channel.id,
                    kind: "message",
                    lastMessagePreview: text.slice(0, 120),
                    lastMessageAt: userMsg.createdAt.toISOString(),
                    lastMessageSenderName: member.user.name,
                    fromUserId: req.userId,
                });
            }
            const historyRows = await prisma.message.findMany({
                where: { channelId },
                orderBy: { createdAt: "desc" },
                take: 100,
                include: { member: { include: { user: true } } },
            });
            const chronological = [...historyRows].reverse();
            const transcript = formatHistoryLines(chronological);
            const answer = await (0, aiService_1.sahayakAnswerFromHistory)(transcript, promptForModel);
            const body = `**Sahayak AI**\n\n${answer}`;
            const preview = `Sahayak: ${answer.slice(0, 80)}${answer.length > 80 ? "…" : ""}`;
            const botMsg = await prisma.message.create({
                data: {
                    content: body,
                    channelId: channel.id,
                    serverId: channel.serverId,
                    memberId: botMember.id,
                    receiptStatus: "DELIVERED",
                    category: "STUDY",
                    isSahayakAi: true,
                    isAiAssistant: false,
                    tags: [],
                },
                include: includeReactions,
            });
            await updateChannelLastMessage(prisma, channel.id, preview, "Sahayak AI");
            await incrementUnreadsForChannel(prisma, channel.id, channel.serverId, req.userId);
            io.to(channel.id).emit("message:new", botMsg);
            io.to(channel.serverId).emit("server:channel-activity", {
                channelId: channel.id,
                kind: "message",
                lastMessagePreview: preview,
                lastMessageAt: botMsg.createdAt.toISOString(),
                lastMessageSenderName: "Sahayak AI",
                fromUserId: req.userId,
            });
            return res.status(201).json({ userMessage: userMsg, botMessage: botMsg });
        }
        catch (e) {
            console.error("Sahayak error", e);
            const msg = e instanceof Error ? e.message : "unknown";
            return res.status(500).json({
                error: "Sahayak failed to respond",
                detail: process.env.NODE_ENV === "development" ? msg : undefined,
            });
        }
    });
}
