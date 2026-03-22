/**
 * Optional demo data: Indian names + Hinglish messages.
 * Run from server/: npx prisma db seed
 * Login: rahul.sharma@demo.college / demo123 (and other @demo.college users same password)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

const USERS = [
  { email: "rahul.sharma@demo.college", name: "Rahul Sharma" },
  { email: "priya.verma@demo.college", name: "Priya Verma" },
  { email: "aman.gupta@demo.college", name: "Aman Gupta" },
  { email: "sneha.patel@demo.college", name: "Sneha Patel" },
  { email: "rohit.singh@demo.college", name: "Rohit Singh" },
  { email: "anjali.mehta@demo.college", name: "Anjali Mehta" },
  { email: "kunal.yadav@demo.college", name: "Kunal Yadav" },
  { email: "neha.joshi@demo.college", name: "Neha Joshi" },
] as const;

const HINGLISH = [
  "Bhai ye DSA ka question samajh nahi aa raha 😭",
  "Kal placement drive hai kya?",
  "Notes bhej de yaar",
  "Aaj class attend ki kya?",
  "Assignment kab submit karna hai?",
  "Match dekha kal ka? 🔥",
  "Group study kare kya aaj?",
  "Bhai ye code error de raha hai",
  "Chai break ke baad milte hain ☕",
  "Slides share kar de pls 🙌",
  "👍 agreed",
  "😂😂 same here",
] as const;

async function main() {
  const passwordHash = await bcrypt.hash("demo123", 10);
  for (const u of USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name },
      create: { email: u.email, name: u.name, passwordHash, provider: "credentials" },
    });
  }

  const owner = await prisma.user.findUniqueOrThrow({ where: { email: USERS[0].email } });
  let server = await prisma.server.findFirst({ where: { name: "BTech CSE 2026" } });
  if (!server) {
    server = await prisma.server.create({
      data: {
        name: "BTech CSE 2026",
        inviteCode: randomUUID(),
        ownerId: owner.id,
        members: { create: { userId: owner.id, role: "ADMIN" } },
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
  }

  for (let i = 1; i < USERS.length; i++) {
    const u = await prisma.user.findUniqueOrThrow({ where: { email: USERS[i].email } });
    await prisma.member.upsert({
      where: { userId_serverId: { userId: u.id, serverId: server.id } },
      update: {},
      create: { userId: u.id, serverId: server.id, role: "MEMBER" },
    });
  }

  const general = await prisma.channel.findFirst({
    where: { serverId: server.id, name: "general-chat", type: "TEXT" },
  });
  if (!general) return;

  const count = await prisma.message.count({ where: { channelId: general.id } });
  if (count > 0) {
    console.log("Seed skipped: general-chat already has messages.");
    return;
  }

  const members = await prisma.member.findMany({ where: { serverId: server.id } });
  const byUserId = new Map(members.map((m) => [m.userId, m]));
  for (let i = 0; i < HINGLISH.length; i++) {
    const u = USERS[i % USERS.length];
    const userRow = await prisma.user.findUniqueOrThrow({ where: { email: u.email } });
    const member = byUserId.get(userRow.id);
    if (!member) continue;
    const ago = new Date(Date.now() - (HINGLISH.length - i) * 120_000);
    await prisma.message.create({
      data: {
        content: HINGLISH[i],
        channelId: general.id,
        serverId: server.id,
        memberId: member.id,
        receiptStatus: "DELIVERED",
        createdAt: ago,
      },
    });
  }

  const last = await prisma.message.findFirst({
    where: { channelId: general.id },
    orderBy: { createdAt: "desc" },
    include: { member: { include: { user: true } } },
  });
  if (last) {
    const preview = last.content.slice(0, 120);
    await prisma.channel.update({
      where: { id: general.id },
      data: {
        lastMessageAt: last.createdAt,
        lastMessagePreview: preview,
        lastMessageSenderName: last.member.user.name,
      },
    });
  }

  console.log("Seed OK: demo users @demo.college / demo123 — server BTech CSE 2026 + Hinglish messages.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
