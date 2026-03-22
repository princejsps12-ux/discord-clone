export type MessageCategory = "STUDY" | "PLACEMENT" | "CASUAL" | "UNCATEGORIZED";

export type User = {
  id: string;
  name: string;
  email: string;
  imageUrl?: string;
  isOnline?: boolean;
  lastSeenAt?: string;
  streakCurrent?: number;
  studyMinutesTotal?: number;
};

export type Server = { id: string; name: string; inviteCode: string };

export type ChannelRow = {
  id: string;
  name: string;
  type: "TEXT" | "VOICE";
  unreadCount?: number;
  isPinned?: boolean;
  isFavorite?: boolean;
  lastMessageAt?: string | null;
  lastMessagePreview?: string | null;
  lastMessageSenderName?: string | null;
};

export type Reaction = { id: string; emoji: string; member: { user: User } };

export type Message = {
  id: string;
  content: string;
  fileUrl?: string;
  createdAt: string;
  channelId?: string;
  channel?: { id: string; name: string };
  receiptStatus?: "SENT" | "DELIVERED" | "SEEN";
  category?: MessageCategory;
  tags?: string[];
  isAiAssistant?: boolean;
  isSahayakAi?: boolean;
  member: { user: User };
  reactions?: Reaction[];
};

export type ServerMember = User & { role?: string; memberId?: string };

export type PollOption = { id: string; text: string; sortOrder: number };
export type PollVote = { optionId: string; memberId: string };
export type Poll = {
  id: string;
  question: string;
  channelId: string;
  serverId: string;
  createdAt: string;
  options: PollOption[];
  votes: PollVote[];
  member: { user: User };
};

export type NoteRow = {
  id: string;
  title: string;
  fileUrl: string;
  mimeType?: string | null;
  createdAt: string;
  channelId?: string | null;
  uploadedBy: { id: string; name: string };
  channel?: { id: string; name: string } | null;
};

export type StreakInfo = {
  streakCurrent: number;
  streakLastDate: string | null;
  studyMinutesTotal: number;
};

export type LeaderboardRow = { messageCount: number; user?: Pick<User, "id" | "name" | "streakCurrent"> };

export type AnalyticsSummary = {
  memberCount: number;
  activeContributors7d: number;
  topChannels: { channelId: string; name?: string; messages: number }[];
  studySessionsEnded7d: number;
  plannedMinutesSum7d: number;
  messagesByCategory: { category: MessageCategory; count: number }[];
};
