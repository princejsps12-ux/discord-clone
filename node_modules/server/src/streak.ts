import type { PrismaClient } from "@prisma/client";

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Call after user sends a message or joins a study session minute. */
export async function bumpUserStreak(prisma: PrismaClient, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;
  const today = startOfUtcDay(new Date());
  const last = user.streakLastDate ? startOfUtcDay(new Date(user.streakLastDate)) : null;
  let next = user.streakCurrent;
  if (!last) {
    next = 1;
  } else {
    const diffDays = Math.round((today.getTime() - last.getTime()) / 86_400_000);
    if (diffDays === 0) return;
    if (diffDays === 1) next = user.streakCurrent + 1;
    else next = 1;
  }
  await prisma.user.update({
    where: { id: userId },
    data: { streakCurrent: next, streakLastDate: today },
  });
}

export async function addStudyMinutes(prisma: PrismaClient, userId: string, minutes: number) {
  await prisma.user.update({
    where: { id: userId },
    data: { studyMinutesTotal: { increment: Math.max(0, Math.round(minutes)) } },
  });
  await bumpUserStreak(prisma, userId);
}
