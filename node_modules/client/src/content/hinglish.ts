import { formatDistanceToNow } from "date-fns";

/** Example Indian names for placeholders & docs */
export const INDIAN_NAMES = [
  "Rahul Sharma",
  "Priya Verma",
  "Aman Gupta",
  "Sneha Patel",
  "Rohit Singh",
  "Anjali Mehta",
  "Kunal Yadav",
  "Neha Joshi",
] as const;

export const EXAMPLE_GROUPS = [
  "BTech CSE 2026",
  "Placement Prep Group",
  "GATE Discussion",
  "Hostel Gang 😎",
  "Cricket Fans Club 🏏",
] as const;

export const ui = {
  appTitle: "College Connect",
  login: "Login",
  register: "Account banao",
  continue: "Aage badho",
  needAccount: "Naya account chahiye?",
  haveAccount: "Pehle se account hai?",
  namePlaceholder: "Naam (jaise Rahul Sharma)",
  emailPlaceholder: "Email",
  passwordPlaceholder: "Password",
  backendDownTitle: "Backend (port 4000) chal nahi raha.",
  backendDownHint:
    "Project folder mein `npm run dev` chalao (API + site dono), ya `start-dev.bat`, ya `server` folder mein `npm run dev` — window band mat karna.",
  dismiss: "Band karo",
  createServerTitle: "Naya server / group",
  promptServerName: "Server ya group ka naam? (jaise: BTech CSE 2026)",
  promptChannelName: "Channel ka naam?",
  promptChannelType: "Type: TEXT ya VOICE",
  selectServer: "Pehle server choose karo",
  noChannel: "Koi channel select nahi hai",
  voice: "Voice",
  call: "Call",
  video: "Video",
  link: "Link",
  schedule: "Schedule",
  upcoming: "aane wale",
  searchChannel: "Channel mein dhoondo…",
  logout: "Logout",
  messagePlaceholder: "Message bhejo…",
  selectChannelFirst: "Pehle channel choose karo",
  file: "File",
  send: "Message bhejo",
  uploading: "Upload ho raha hai…",
  openAttachment: "Attachment kholo",
  typing: "type kar raha hai…",
  scheduleCallTitle: "Call schedule karo",
  scheduleCallSub: "Shareable link banega is server ke liye.",
  titleLabel: "Title",
  scheduleTitlePh: "Placement mock / standup",
  dateTimeLabel: "Date aur time",
  videoCall: "Video call",
  cancel: "Cancel",
  save: "Save",
  serverFallback: "Server",
  emptyHintsTitle: "Koi message nahi — aise shuru karo:",
  sessionExpired: "Session khatam ho gayi ya galat hai. Logout karke dubara login karo.",
  backendHealthFail:
    "Server tak nahi pahunch paaye. `server` folder mein `npm run dev` chalao aur http://localhost:5173 use karo.",
  uploadFail: "Upload fail. Server par Cloudinary set karo ya sirf text bhejo.",
  messageFail: "Message nahi gaya.",
  pinFail: "Pin update nahi hua.",
  favFail: "Favourite update nahi hua.",
  scheduleFail: "Schedule save nahi hua.",
  createServerFail: "Server nahi bana.",
  createChannelFail: "Channel nahi bana.",
  voiceCopied: "Voice call link copy ho gayi — baaki ko bhejo is channel pe join karne ke liye.",
  videoCopied: "Video call link copy ho gayi — baaki ko bhejo is channel pe join karne ke liye.",
  /** Friend pastes this code in “Join server” (same app URL as you). */
  copyInviteTitle: "Invite code copy — friend ko bhejo taaki woh isi server pe aa jaye",
  copyInviteShort: "Invite",
  inviteCopiedOk: "Code copy ho gaya — friend ko WhatsApp / DM se bhejo.",
  clipboardFail: "Auto-copy nahi hua — code neeche se manually copy karo.",
  joinServerTitle: "Invite code se server join karo",
  joinServerPrompt: "Friend ka invite code yahan paste karo:",
  inviteJoinFail: "Join nahi hua — code galat hai ya pehle se member ho.",
} as const;

export const emptyState = {
  title: "Channel choose karo",
  subtitle: (server: string) =>
    `${server || "Is server"} mein koi channel kholo — messages yahi dikhenge. Neeche shortcuts bhi hain.`,
  startChat: "Chat start karo — pehla text channel kholo",
  joinChannel: "Channel dhoondo — list search pe focus",
  createServer: "Naya server / group banao",
} as const;

export const sidebar = {
  searchPlaceholder: "Dhoondo ya nayi chat…",
  globalSearch: "Poori jagah dhoondo (messages, channels, log)",
  filterAll: "Sab",
  filterUnread: "Unread",
  filterFavorites: "Favourites",
  filterGroups: "Groups",
  voiceRoom: "Voice room",
  noMessagesYet: "Abhi koi message nahi",
  people: "Log",
  pinned: "Pin kiye",
  channels: "Channels",
  noMatch: "Is filter se koi channel match nahi.",
  favTitle: "Favourite",
  unfavTitle: "Favourite hatao",
  pinTitle: "Pin",
  unpinTitle: "Unpin",
} as const;

export const searchModal = {
  placeholder: "Messages, channels, log — sab dhoondo…",
  searching: "Dhoondh rahe hain…",
  channels: "Channels",
  people: "Log",
  messages: "Messages",
  noResults: "Kuch nahi mila",
} as const;

export const callPages = {
  defaultCallTitle: "Scheduled call",
  joinTitle: "Call join karo",
  joinSub: "Is device pe app kholo aur voice channel se connect karo.",
  openApp: "App mein kholo",
  copyLink: "Link copy karo",
  loginFirst: "Pehle home se login karo, phir yeh link dubara kholo.",
  loadFail: "Yeh call load nahi ho payi.",
  loading: "Load ho raha hai…",
  copyCallLink: "Call link copy karo",
} as const;

/** Hinglish lines shown when a channel has no messages yet */
export const hinglishChatHints = [
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
] as const;

export function presenceLine(isOnline?: boolean, lastSeenAt?: string | null): string {
  if (isOnline) return "Online";
  if (!lastSeenAt) return "Offline";
  try {
    return `Last seen ${formatDistanceToNow(new Date(lastSeenAt), { addSuffix: true })}`;
  } catch {
    return "Offline";
  }
}

/** Simple avatar when user has no imageUrl (UI Avatars — teal-ish theme) */
export function avatarFromName(name: string, imageUrl?: string | null): string | undefined {
  if (imageUrl) return imageUrl;
  const q = encodeURIComponent(name.trim() || "User");
  return `https://ui-avatars.com/api/?size=128&name=${q}&background=0d9488&color=f0fdfa&bold=true`;
}

export const reactionEmojis = ["👍", "🔥", "😂", "❤️", "😭", "🙌"] as const;

export type AppLocale = "hinglish" | "english";

const student = {
  askAi: { hi: "AI se poocho", en: "Ask AI" },
  aiTitle: { hi: "Sahayak AI — DSA / code / placement", en: "Sahayak AI — DSA, code & placement" },
  aiPlaceholder: { hi: "Sawal likho (jaise: DP se egg drop)", en: "Ask a question…" },
  aiSend: { hi: "Jawaab lao", en: "Get answer" },
  poll: { hi: "Poll", en: "Poll" },
  pollTitle: { hi: "Naya poll", en: "New poll" },
  pollQ: { hi: "Sawal", en: "Question" },
  pollOpts: { hi: "Options (comma se alag)", en: "Options (comma-separated)" },
  studyStart: { hi: "Study mode", en: "Study mode" },
  studyEnd: { hi: "Session band karo", en: "End session" },
  studyJoin: { hi: "Join karo", en: "Join" },
  studyActive: { hi: "Group study chal rahi hai", en: "Group study in progress" },
  notes: { hi: "Notes", en: "Notes" },
  chat: { hi: "Chat", en: "Chat" },
  saved: { hi: "Saved", en: "Saved" },
  analytics: { hi: "Analytics", en: "Analytics" },
  placementHub: { hi: "Placement hub", en: "Placement hub" },
  filterCategory: { hi: "Message filter", en: "Message filter" },
  allCats: { hi: "Sab", en: "All" },
  studyOnly: { hi: "Sirf study", en: "Study only" },
  localeHi: { hi: "Hinglish UI", en: "Hinglish UI" },
  localeEn: { hi: "English UI", en: "English UI" },
  streak: { hi: "Streak", en: "Streak" },
  tagEdit: { hi: "Tags (Amazon, Google…)", en: "Tags (Amazon, Google…)" },
  saveMsg: { hi: "Save", en: "Save" },
  unsaveMsg: { hi: "Saved", en: "Saved" },
  categoryLabel: { hi: "Category", en: "Category" },
  votes: { hi: "votes", en: "votes" },
  uploadNote: { hi: "Note upload", en: "Upload note" },
  noteTitle: { hi: "Title", en: "Title" },
  previewNote: { hi: "Preview", en: "Preview" },
  leaderboard: { hi: "7 din — messages leaderboard", en: "7-day message leaderboard" },
  analyticsTitle: { hi: "Server analytics", en: "Server analytics" },
  members: { hi: "Members", en: "Members" },
  active7d: { hi: "Active contributors (7d)", en: "Active contributors (7d)" },
  topCh: { hi: "Top channels", en: "Top channels" },
  studyMin: { hi: "Study sessions (planned min, 7d)", en: "Study sessions (planned min, 7d)" },
  byCat: { hi: "Messages by category", en: "Messages by category" },
  aiAssistant: { hi: "AI Assistant", en: "AI Assistant" },
  searchTag: { hi: "Tag filter", en: "Tag filter" },
  searchCat: { hi: "Category", en: "Category" },
  summarizeChat: { hi: "Chat summarize karo", en: "Summarize chat" },
  summarizing: { hi: "Summary bana rahe hain…", en: "Summarizing…" },
  sahayakName: { hi: "Sahayak AI", en: "Sahayak AI" },
  aiBadge: { hi: "AI", en: "AI" },
  msgHintSahayak: { hi: "Tip: @sahayak se poochho", en: "Tip: mention @sahayak to ask" },
} as const;

export type StudentKey = keyof typeof student;

export function st(locale: AppLocale, key: StudentKey): string {
  return locale === "english" ? student[key].en : student[key].hi;
}
