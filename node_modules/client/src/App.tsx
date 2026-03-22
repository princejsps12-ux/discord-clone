import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { format } from "date-fns";
import {
  Phone,
  Search,
  Video,
  CalendarClock,
  Link2,
  LogOut,
  Sparkles,
  BarChart3,
  Star,
  BookOpen,
  Timer,
  Vote,
  Tag,
  FileText,
  UserPlus,
} from "lucide-react";
import { api, getApiErrorMessage, setAuthToken } from "./lib/api";
import type {
  AnalyticsSummary,
  ChannelRow,
  LeaderboardRow,
  Message,
  MessageCategory,
  NoteRow,
  Poll,
  Reaction,
  Server,
  ServerMember,
  StreakInfo,
  User,
} from "./types";
import { ChannelSidebar, type ListFilter } from "./components/ChannelSidebar";
import { EmptyChatState } from "./components/EmptyChatState";
import { GlobalSearchModal } from "./components/GlobalSearchModal";
import { JoinCallPage, ScheduledCallPage } from "./pages/CallPages";
import {
  EXAMPLE_GROUPS,
  hinglishChatHints,
  INDIAN_NAMES,
  presenceLine,
  reactionEmojis,
  ui,
  st,
  type AppLocale,
} from "./content/hinglish";
import { MemberAvatar } from "./components/MemberAvatar";

let socket: Socket | null = null;
const DEMO_MODE = false;

type StudySessionRow = {
  id: string;
  channelId: string;
  title: string;
  plannedMinutes: number;
  startedAt: string;
  endedAt: string | null;
  creatorMemberId: string;
  participants: { member: { id: string; user: User } }[];
};

function pollVoteCounts(poll: Poll) {
  const m = new Map<string, number>();
  for (const v of poll.votes) m.set(v.optionId, (m.get(v.optionId) || 0) + 1);
  return m;
}

function receiptLabel(status?: Message["receiptStatus"]) {
  if (status === "SEEN") return { text: "✓✓", className: "text-sky-400" };
  if (status === "DELIVERED") return { text: "✓✓", className: "text-slate-500" };
  return { text: "✓", className: "text-slate-600" };
}

function MainApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [user, setUser] = useState<User | null>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [members, setMembers] = useState<ServerMember[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeServer, setActiveServer] = useState<string>("");
  const [activeChannel, setActiveChannel] = useState<string>("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [messageText, setMessageText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState<ListFilter>("all");
  const [sidebarQuery, setSidebarQuery] = useState("");
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleTitle, setScheduleTitle] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [scheduleVideo, setScheduleVideo] = useState(false);
  const [scheduledCalls, setScheduledCalls] = useState<
    { id: string; title: string | null; scheduledAt: string; callLink: string; isVideo: boolean; channel: { name: string } | null }[]
  >([]);
  const [authError, setAuthError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  /** null = not checked yet; false = /api/health failed */
  const [backendReachable, setBackendReachable] = useState<boolean | null>(null);
  const [locale, setLocale] = useState<AppLocale>(() => (localStorage.getItem("app-locale") as AppLocale) || "hinglish");
  const [categoryFilter, setCategoryFilter] = useState<MessageCategory | "">("");
  const [messageSendCategory, setMessageSendCategory] = useState<MessageCategory | "UNCATEGORIZED">("UNCATEGORIZED");
  const [centerPanel, setCenterPanel] = useState<"chat" | "notes">("chat");
  const [polls, setPolls] = useState<Poll[]>([]);
  const [studySessions, setStudySessions] = useState<StudySessionRow[]>([]);
  const [streakInfo, setStreakInfo] = useState<StreakInfo | null>(null);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(() => new Set());
  const [aiOpen, setAiOpen] = useState(false);
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptionsText, setPollOptionsText] = useState("8 PM, 9 PM");
  const [savedOpen, setSavedOpen] = useState(false);
  const [savedMessages, setSavedMessages] = useState<Message[]>([]);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsSummary | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [metaForMessage, setMetaForMessage] = useState<string | null>(null);
  const [metaTags, setMetaTags] = useState("");
  const [metaCategory, setMetaCategory] = useState<MessageCategory>("UNCATEGORIZED");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteUploading, setNoteUploading] = useState(false);
  const [summarizingChat, setSummarizingChat] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const activeChannelRef = useRef(activeChannel);
  const activeServerRef = useRef(activeServer);
  const searchTextRef = useRef(searchText);
  const categoryFilterRef = useRef(categoryFilter);
  useEffect(() => {
    searchTextRef.current = searchText;
  }, [searchText]);
  useEffect(() => {
    activeChannelRef.current = activeChannel;
  }, [activeChannel]);
  useEffect(() => {
    activeServerRef.current = activeServer;
  }, [activeServer]);
  useEffect(() => {
    categoryFilterRef.current = categoryFilter;
  }, [categoryFilter]);
  useEffect(() => {
    localStorage.setItem("app-locale", locale);
  }, [locale]);

  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefetchChannels = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(async () => {
      const sid = activeServerRef.current;
      const t = localStorage.getItem("token");
      if (!sid || !t) return;
      try {
        const { data } = await api.get<ChannelRow[]>(`/api/servers/${sid}/channels`);
        setChannels(data);
      } catch {
        /* ignore */
      }
    }, 220);
  }, []);

  const fetchMembers = useCallback(async (serverId: string) => {
    try {
      const { data } = await api.get<ServerMember[]>(`/api/servers/${serverId}/members`);
      setMembers(data);
    } catch {
      setMembers([]);
    }
  }, []);

  const fetchScheduled = useCallback(async (serverId: string) => {
    try {
      const { data } = await api.get(`/api/servers/${serverId}/scheduled-calls`);
      setScheduledCalls(data);
    } catch {
      setScheduledCalls([]);
    }
  }, []);

  const activeChannelType = useMemo(
    () => channels.find((c) => c.id === activeChannel)?.type,
    [channels, activeChannel],
  );

  useEffect(() => {
    let cancelled = false;
    const ping = () => {
      api
        .get("/api/health")
        .then(() => {
          if (!cancelled) setBackendReachable(true);
        })
        .catch(() => {
          if (!cancelled) setBackendReachable(false);
        });
    };
    ping();
    const t = setInterval(ping, 8000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    const st = location.state as { serverId?: string; channelId?: string } | null;
    if (st?.serverId) setActiveServer(st.serverId);
    if (st?.channelId) setActiveChannel(st.channelId);
    if (st?.serverId || st?.channelId) navigate(location.pathname, { replace: true, state: {} });
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    if (DEMO_MODE) return;
    if (!token) return;
    setAuthToken(token);
    api.get("/api/auth/me").then((res) => setUser(res.data));
    api.get("/api/servers").then((res) => setServers(res.data));
    const socketUrl =
      import.meta.env.VITE_API_URL || (import.meta.env.DEV ? window.location.origin : "http://localhost:4000");
    socket = io(socketUrl, { auth: { token } });
    socket.on("message:new", (message: Message) => {
      const chId = message.channelId;
      if (chId && chId === activeChannelRef.current) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev;
          return [message, ...prev];
        });
      }
      scheduleRefetchChannels();
    });
    socket.on("message:updated", (updated: Message) =>
      setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m))),
    );
    socket.on("message:deleted", ({ id }: { id: string }) =>
      setMessages((prev) => prev.filter((m) => m.id !== id)),
    );
    socket.on("message:reactions", ({ messageId, reactions }: { messageId: string; reactions: Reaction[] }) => {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
    });
    socket.on("typing", ({ userName }: { channelId: string; userName: string }) => {
      setTypingUser(userName);
    });
    socket.on("typing:stop", () => {
      setTypingUser(null);
    });
    socket.on("presence:update", (p: { userId: string; isOnline: boolean; lastSeenAt?: string }) => {
      setMembers((prev) =>
        prev.map((m) => (m.id === p.userId ? { ...m, isOnline: p.isOnline, lastSeenAt: p.lastSeenAt } : m)),
      );
      setUser((u) => (u && u.id === p.userId ? { ...u, isOnline: p.isOnline, lastSeenAt: p.lastSeenAt } : u));
    });
    socket.on("server:channel-activity", () => {
      scheduleRefetchChannels();
    });
    socket.on("channel:receipts-updated", ({ channelId }: { channelId: string }) => {
      if (channelId === activeChannelRef.current && localStorage.getItem("token")) {
        const st = searchTextRef.current.trim();
        const cat = categoryFilterRef.current;
        const p = new URLSearchParams();
        if (st) p.set("q", st);
        if (cat) p.set("category", cat);
        const qs = p.toString();
        api.get(`/api/channels/${channelId}/messages${qs ? `?${qs}` : ""}`).then((res) => setMessages(res.data.items));
      }
    });
    socket.on("scheduled-call:created", () => {
      const sid = activeServerRef.current;
      if (sid) fetchScheduled(sid);
    });
    socket.on("scheduled-call:deleted", () => {
      const sid = activeServerRef.current;
      if (sid) fetchScheduled(sid);
    });
    socket.on("channel:created", () => {
      scheduleRefetchChannels();
    });
    socket.on("poll:new", (poll: Poll) => {
      if (poll.channelId === activeChannelRef.current) {
        setPolls((prev) => (prev.some((p) => p.id === poll.id) ? prev : [poll, ...prev]));
      }
    });
    socket.on("poll:updated", (poll: Poll) => {
      if (poll.channelId === activeChannelRef.current) {
        setPolls((prev) => prev.map((p) => (p.id === poll.id ? poll : p)));
      }
    });
    socket.on("study:session", (payload: { action: string; session?: StudySessionRow; sessionId?: string }) => {
      const ch = activeChannelRef.current;
      if (payload.action === "start" && payload.session?.channelId === ch) {
        setStudySessions((prev) => [payload.session!, ...prev.filter((s) => s.id !== payload.session!.id)]);
      }
      if (payload.action === "update" && payload.session?.channelId === ch) {
        setStudySessions((prev) => prev.map((s) => (s.id === payload.session!.id ? payload.session! : s)));
      }
      if (payload.action === "end") {
        setStudySessions((prev) => prev.filter((s) => s.id !== payload.sessionId));
      }
    });
    socket.on("notes:updated", (p: { serverId: string }) => {
      if (p.serverId !== activeServerRef.current) return;
      const sid = activeServerRef.current;
      const cid = activeChannelRef.current;
      if (!sid) return;
      api
        .get<NoteRow[]>(`/api/servers/${sid}/notes`, { params: cid ? { channelId: cid } : {} })
        .then((r) => setNotes(r.data))
        .catch(() => undefined);
    });
    return () => {
      socket?.disconnect();
      socket = null;
    };
  }, [token, scheduleRefetchChannels, fetchScheduled]);

  useEffect(() => {
    if (DEMO_MODE) return;
    if (!activeServer || !token) return;
    api.get(`/api/servers/${activeServer}/channels`).then((res) => {
      setChannels(res.data);
      setActiveChannel("");
    });
    fetchMembers(activeServer);
    fetchScheduled(activeServer);
    socket?.emit("join-server", activeServer);
  }, [activeServer, token, fetchMembers, fetchScheduled]);

  useEffect(() => {
    if (DEMO_MODE) return;
    if (!activeChannel || !token) return;
    socket?.emit("join-channel", activeChannel);
    api.post(`/api/channels/${activeChannel}/read`).then(() => scheduleRefetchChannels()).catch(() => undefined);
  }, [activeChannel, token, scheduleRefetchChannels]);

  useEffect(() => {
    if (!activeChannel || !token) return;
    const timeout = setTimeout(() => {
      fetchMessages(activeChannel, searchText).catch(() => undefined);
    }, 250);
    return () => clearTimeout(timeout);
  }, [searchText, activeChannel, token, categoryFilter]);

  useEffect(() => {
    if (!studySessions.length) return;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [studySessions.length]);

  useEffect(() => {
    if (!token) return;
    api
      .get<StreakInfo>("/api/streak/me")
      .then((r) => setStreakInfo(r.data))
      .catch(() => undefined);
    api
      .get<Message[]>("/api/bookmarks")
      .then((r) => setBookmarkedIds(new Set(r.data.map((m) => m.id))))
      .catch(() => undefined);
  }, [token]);

  useEffect(() => {
    if (DEMO_MODE || !activeChannel || !token || activeChannelType !== "TEXT") {
      setPolls([]);
      setStudySessions([]);
      return;
    }
    api
      .get<Poll[]>(`/api/channels/${activeChannel}/polls`)
      .then((r) => setPolls(r.data))
      .catch(() => setPolls([]));
    api
      .get<StudySessionRow[]>(`/api/channels/${activeChannel}/study-sessions/active`)
      .then((r) => setStudySessions(r.data))
      .catch(() => setStudySessions([]));
  }, [activeChannel, token, activeChannelType]);

  useEffect(() => {
    if (!activeServer || !token || centerPanel !== "notes") return;
    api
      .get<NoteRow[]>(`/api/servers/${activeServer}/notes`, { params: activeChannel ? { channelId: activeChannel } : {} })
      .then((r) => setNotes(r.data))
      .catch(() => setNotes([]));
  }, [activeServer, activeChannel, token, centerPanel]);

  useEffect(() => {
    if (activeChannelType !== "TEXT") setCenterPanel("chat");
  }, [activeChannelType]);

  const onAuth = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
    const payload = authMode === "login" ? { email, password } : { email, password, name };
    try {
      const { data } = await api.post(endpoint, payload);
      setAuthToken(data.token);
      setToken(data.token);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (err as Error)?.message ||
        ui.backendHealthFail;
      setAuthError(msg);
    }
  };

  const createServer = async () => {
    if (DEMO_MODE) return;
    setActionError(null);
    const serverName = window.prompt(ui.promptServerName, EXAMPLE_GROUPS[0]);
    if (!serverName) return;
    try {
      await api.post("/api/servers", { name: serverName });
      const { data } = await api.get("/api/servers");
      setServers(data);
    } catch (err: unknown) {
      setActionError(getApiErrorMessage(err, ui.createServerFail));
    }
  };

  const joinServerWithInvite = async () => {
    if (DEMO_MODE) return;
    setActionError(null);
    const code = window.prompt(ui.joinServerPrompt)?.trim();
    if (!code) return;
    try {
      const { data } = await api.post<{ success: boolean; serverId: string }>(
        `/api/servers/join/${encodeURIComponent(code)}`,
      );
      const { data: list } = await api.get<Server[]>("/api/servers");
      setServers(list);
      setActiveServer(data.serverId);
    } catch (err: unknown) {
      setActionError(getApiErrorMessage(err, ui.inviteJoinFail));
    }
  };

  const createChannel = async () => {
    if (DEMO_MODE) return;
    if (!activeServer) return;
    setActionError(null);
    const channelName = window.prompt(ui.promptChannelName);
    const channelType = window.prompt(ui.promptChannelType, "TEXT") as "TEXT" | "VOICE";
    if (!channelName) return;
    try {
      await api.post(`/api/servers/${activeServer}/channels`, { name: channelName, type: channelType });
      const { data } = await api.get(`/api/servers/${activeServer}/channels`);
      setChannels(data);
    } catch (err: unknown) {
      setActionError(getApiErrorMessage(err, ui.createChannelFail));
    }
  };

  const mergeSahayakMessages = (data: { userMessage?: Message; botMessage: Message }) => {
    setMessages((prev) => {
      let x = prev;
      if (data.userMessage && !x.some((m) => m.id === data.userMessage!.id)) x = [data.userMessage!, ...x];
      if (data.botMessage && !x.some((m) => m.id === data.botMessage.id)) x = [data.botMessage, ...x];
      return x;
    });
  };

  const summarizeSahayak = async () => {
    if (!activeChannel) return;
    setSummarizingChat(true);
    setActionError(null);
    try {
      const { data } = await api.post<{ botMessage: Message }>(`/api/channels/${activeChannel}/sahayak`, {
        summarize: true,
      });
      if (data.botMessage) mergeSahayakMessages({ botMessage: data.botMessage });
      scheduleRefetchChannels();
    } catch (err: unknown) {
      setActionError(getApiErrorMessage(err, ui.messageFail));
    } finally {
      setSummarizingChat(false);
    }
  };

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if ((!messageText.trim() && !selectedFile) || !activeChannel) return;
    setActionError(null);

    const rawText = messageText.trim();
    if (!selectedFile && /@sahayak\b/i.test(rawText)) {
      setUploading(true);
      try {
        const promptClean = rawText.replace(/@sahayak\b/gi, "").replace(/\s+/g, " ").trim();
        const { data } = await api.post<{ userMessage?: Message; botMessage: Message }>(
          `/api/channels/${activeChannel}/sahayak`,
          {
            userMessage: rawText,
            prompt: promptClean || undefined,
          },
        );
        setMessageText("");
        socket?.emit("typing:stop", { channelId: activeChannel, userName: user?.name || "Someone" });
        mergeSahayakMessages(data);
        scheduleRefetchChannels();
        api.get<StreakInfo>("/api/streak/me").then((r) => setStreakInfo(r.data)).catch(() => undefined);
      } catch (err: unknown) {
        setActionError(getApiErrorMessage(err, ui.messageFail));
      } finally {
        setUploading(false);
      }
      return;
    }

    let fileUrl: string | undefined;
    if (selectedFile) {
      const formData = new FormData();
      formData.append("file", selectedFile);
      setUploading(true);
      try {
        const uploadResponse = await api.post("/api/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        fileUrl = uploadResponse.data.url;
      } catch {
        setActionError(ui.uploadFail);
        setUploading(false);
        return;
      } finally {
        setUploading(false);
      }
    }

    try {
      const { data } = await api.post<Message>(`/api/channels/${activeChannel}/messages`, {
        content: messageText.trim() || "Attachment",
        ...(fileUrl ? { fileUrl } : {}),
        ...(messageSendCategory && messageSendCategory !== "UNCATEGORIZED" ? { category: messageSendCategory } : {}),
      });
      setMessageText("");
      socket?.emit("typing:stop", { channelId: activeChannel, userName: user?.name || "Someone" });
      setSelectedFile(null);
      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [data, ...prev]));
      scheduleRefetchChannels();
      api.get<StreakInfo>("/api/streak/me").then((r) => setStreakInfo(r.data)).catch(() => undefined);
    } catch (err: unknown) {
      setActionError(getApiErrorMessage(err, ui.messageFail));
    }
  };

  const onSelectFile = (e: ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(e.target.files?.[0] || null);
  };

  const onTyping = (value: string) => {
    setMessageText(value);
    if (!activeChannel || !user?.name) return;
    socket?.emit("typing", { channelId: activeChannel, userName: user.name });
    window.clearTimeout((onTyping as unknown as { timer?: number }).timer);
    (onTyping as unknown as { timer?: number }).timer = window.setTimeout(() => {
      socket?.emit("typing:stop", { channelId: activeChannel, userName: user.name });
    }, 1000);
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!activeChannel) return;
    await api.post(`/api/messages/${messageId}/reactions`, { emoji });
  };

  const fetchMessages = async (channelId: string, search?: string) => {
    const p = new URLSearchParams();
    if (search?.trim()) p.set("q", search.trim());
    if (categoryFilter) p.set("category", categoryFilter);
    const qs = p.toString();
    const res = await api.get(`/api/channels/${channelId}/messages${qs ? `?${qs}` : ""}`);
    setMessages(res.data.items);
  };

  const myMemberId = useMemo(() => members.find((m) => m.id === user?.id)?.memberId, [members, user?.id]);

  const submitAi = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeChannel || !aiQuestion.trim()) return;
    setAiLoading(true);
    setActionError(null);
    const q = aiQuestion.trim();
    try {
      const { data } = await api.post<{ userMessage?: Message; botMessage: Message }>(
        `/api/channels/${activeChannel}/sahayak`,
        { userMessage: `@sahayak ${q}`, prompt: q },
      );
      mergeSahayakMessages(data);
      setAiQuestion("");
      setAiOpen(false);
      scheduleRefetchChannels();
      api.get<StreakInfo>("/api/streak/me").then((r) => setStreakInfo(r.data)).catch(() => undefined);
    } catch (err: unknown) {
      setActionError(getApiErrorMessage(err, ui.messageFail));
    } finally {
      setAiLoading(false);
    }
  };

  const submitPoll = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeChannel) return;
    const parts = pollOptionsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!pollQuestion.trim() || parts.length < 2) return;
    setActionError(null);
    try {
      await api.post(`/api/channels/${activeChannel}/polls`, { question: pollQuestion.trim(), options: parts });
      setPollOpen(false);
      setPollQuestion("");
      setPollOptionsText("8 PM, 9 PM");
    } catch {
      setActionError(ui.messageFail);
    }
  };

  const votePoll = async (pollId: string, optionId: string) => {
    try {
      const { data } = await api.post<Poll>(`/api/polls/${pollId}/vote`, { optionId });
      setPolls((prev) => prev.map((p) => (p.id === data.id ? data : p)));
    } catch {
      setActionError(ui.messageFail);
    }
  };

  const toggleBookmark = async (messageId: string) => {
    try {
      if (bookmarkedIds.has(messageId)) {
        await api.delete(`/api/messages/${messageId}/bookmark`);
        setBookmarkedIds((prev) => {
          const n = new Set(prev);
          n.delete(messageId);
          return n;
        });
      } else {
        await api.post(`/api/messages/${messageId}/bookmark`);
        setBookmarkedIds((prev) => new Set(prev).add(messageId));
      }
    } catch {
      setActionError(ui.messageFail);
    }
  };

  const openSaved = () => {
    setSavedOpen(true);
    api
      .get<Message[]>("/api/bookmarks")
      .then((r) => {
        setSavedMessages(r.data);
        setBookmarkedIds(new Set(r.data.map((m) => m.id)));
      })
      .catch(() => undefined);
  };

  const openAnalytics = () => {
    if (!activeServer) return;
    setAnalyticsOpen(true);
    api
      .get<AnalyticsSummary>(`/api/servers/${activeServer}/analytics`)
      .then((r) => setAnalyticsData(r.data))
      .catch(() => setAnalyticsData(null));
    api
      .get<LeaderboardRow[]>(`/api/servers/${activeServer}/leaderboard`)
      .then((r) => setLeaderboard(r.data))
      .catch(() => setLeaderboard([]));
  };

  const startStudySession = async () => {
    if (!activeChannel) return;
    setActionError(null);
    try {
      const { data } = await api.post<StudySessionRow>(`/api/channels/${activeChannel}/study-sessions`, {
        title: "Group study",
        plannedMinutes: 25,
      });
      setStudySessions((prev) => [data, ...prev.filter((s) => s.id !== data.id)]);
      socket?.emit("study:join", { sessionId: data.id, channelId: activeChannel });
      api.get<StreakInfo>("/api/streak/me").then((r) => setStreakInfo(r.data)).catch(() => undefined);
    } catch {
      setActionError(ui.messageFail);
    }
  };

  const joinStudySession = async (sessionId: string) => {
    try {
      const { data } = await api.post<StudySessionRow>(`/api/study-sessions/${sessionId}/join`);
      setStudySessions((prev) => prev.map((s) => (s.id === data.id ? data : s)));
      if (activeChannel) socket?.emit("study:join", { sessionId, channelId: activeChannel });
      api.get<StreakInfo>("/api/streak/me").then((r) => setStreakInfo(r.data)).catch(() => undefined);
    } catch {
      setActionError(ui.messageFail);
    }
  };

  const endStudySession = async (sessionId: string) => {
    try {
      await api.patch(`/api/study-sessions/${sessionId}/end`);
      setStudySessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeChannel) socket?.emit("study:leave", { sessionId, channelId: activeChannel });
    } catch {
      setActionError(ui.messageFail);
    }
  };

  const saveMessageMeta = async () => {
    if (!metaForMessage) return;
    const tags = metaTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    try {
      await api.patch(`/api/messages/${metaForMessage}/meta`, { tags, category: metaCategory });
      setMetaForMessage(null);
    } catch {
      setActionError(ui.messageFail);
    }
  };

  const uploadNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeServer || !noteTitle.trim()) return;
    const input = (e.target as HTMLFormElement).elements.namedItem("noteFile") as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    setNoteUploading(true);
    setActionError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const up = await api.post<{ url: string }>("/api/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await api.post(`/api/servers/${activeServer}/notes`, {
        title: noteTitle.trim(),
        fileUrl: up.data.url,
        mimeType: file.type,
        channelId: activeChannel || undefined,
      });
      setNoteTitle("");
      input.value = "";
      const { data } = await api.get<NoteRow[]>(`/api/servers/${activeServer}/notes`, {
        params: activeChannel ? { channelId: activeChannel } : {},
      });
      setNotes(data);
    } catch {
      setActionError(ui.uploadFail);
    } finally {
      setNoteUploading(false);
    }
  };

  const togglePin = async (channelId: string, next: boolean) => {
    setActionError(null);
    try {
      await api.patch(`/api/channels/${channelId}/preferences`, { isPinned: next });
      scheduleRefetchChannels();
    } catch {
      setActionError(ui.pinFail);
    }
  };

  const toggleFavorite = async (channelId: string, next: boolean) => {
    setActionError(null);
    try {
      await api.patch(`/api/channels/${channelId}/preferences`, { isFavorite: next });
      scheduleRefetchChannels();
    } catch {
      setActionError(ui.favFail);
    }
  };

  const isImageUrl = (url: string) => /\.(png|jpe?g|gif|webp|svg)$/i.test(url);

  const copyJoinCallLink = () => {
    if (!activeServer || !activeChannel) return;
    const base = window.location.origin;
    const url = `${base}/join-call?serverId=${encodeURIComponent(activeServer)}&channelId=${encodeURIComponent(activeChannel)}`;
    void navigator.clipboard.writeText(url);
  };

  const startVoiceSession = (video: boolean) => {
    if (!activeChannel || !user) return;
    socket?.emit("voice:join", {
      channelId: activeChannel,
      userId: user.id,
      userName: user.name,
    });
    copyJoinCallLink();
    window.alert(video ? ui.videoCopied : ui.voiceCopied);
  };

  const submitSchedule = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeServer || !scheduleAt) return;
    setActionError(null);
    try {
      await api.post(`/api/servers/${activeServer}/scheduled-calls`, {
        channelId: activeChannel || undefined,
        title: scheduleTitle || ui.scheduleTitlePh,
        scheduledAt: scheduleAt,
        isVideo: scheduleVideo,
      });
      setScheduleOpen(false);
      setScheduleTitle("");
      setScheduleAt("");
      fetchScheduled(activeServer);
    } catch {
      setActionError(ui.scheduleFail);
    }
  };

  const serverName = servers.find((s) => s.id === activeServer)?.name || ui.serverFallback;
  const firstTextChannel = channels.find((c) => c.type === "TEXT");

  const backendBanner =
    backendReachable === false ? (
      <div className="shrink-0 border-b border-amber-700/60 bg-amber-950/90 px-4 py-3 text-sm text-amber-100">
        <p className="font-medium">{ui.backendDownTitle}</p>
        <p className="mt-1 text-amber-200/90">{ui.backendDownHint}</p>
      </div>
    ) : null;

  if (!DEMO_MODE && !token) {
    return (
      <main className="flex min-h-screen flex-col bg-[#313338] text-white">
        {backendBanner}
        <div className="flex flex-1 items-center justify-center p-4">
        <form onSubmit={onAuth} className="w-full max-w-sm space-y-3 rounded-lg bg-[#1E1F22] p-5">
          <h1 className="text-xl font-semibold">{authMode === "login" ? ui.login : ui.register}</h1>
          {authMode === "register" && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder={`${ui.namePlaceholder} — ${INDIAN_NAMES[0]}`}
            />
          )}
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder={ui.emailPlaceholder} />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder={ui.passwordPlaceholder} />
          {authError && <p className="rounded-md bg-red-900/40 px-3 py-2 text-sm text-red-200">{authError}</p>}
          <button className="btn w-full" type="submit">
            {ui.continue}
          </button>
          <button type="button" className="text-sm text-slate-300" onClick={() => setAuthMode((m) => (m === "login" ? "register" : "login"))}>
            {authMode === "login" ? ui.needAccount : ui.haveAccount}
          </button>
        </form>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col bg-[#0b0c0f] text-white">
      {backendBanner}
      {actionError && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-red-900/50 bg-red-950/80 px-4 py-2 text-sm text-red-100">
          <span>{actionError}</span>
          <button type="button" className="shrink-0 underline" onClick={() => setActionError(null)}>
            {ui.dismiss}
          </button>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
      <aside className="flex w-[72px] shrink-0 flex-col gap-2 border-r border-slate-800 bg-[#0a0a0b] p-2">
        <button type="button" className="btn w-full rounded-xl py-2 text-lg font-bold shadow-lg shadow-indigo-900/20" onClick={createServer} title={ui.createServerTitle}>
          +
        </button>
        <button
          type="button"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#1E1F22] text-slate-200 transition hover:bg-emerald-700/80 hover:text-white"
          onClick={() => void joinServerWithInvite()}
          title={ui.joinServerTitle}
        >
          <UserPlus className="h-5 w-5" />
        </button>
        <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto">
          {servers.map((s) => (
            <button
              type="button"
              key={s.id}
              onClick={() => setActiveServer(s.id)}
              title={s.name}
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-bold transition-all duration-200 ${
                activeServer === s.id ? "bg-indigo-600 text-white shadow-md" : "bg-[#1E1F22] text-slate-200 hover:rounded-xl hover:bg-indigo-600/80"
              }`}
            >
              {s.name.slice(0, 2).toUpperCase()}
            </button>
          ))}
        </div>
      </aside>

      {activeServer ? (
        <ChannelSidebar
          serverName={serverName}
          inviteCode={servers.find((s) => s.id === activeServer)?.inviteCode}
          inviteCopyTitle={ui.copyInviteTitle}
          inviteCopyLabel={ui.copyInviteShort}
          inviteCopiedMessage={ui.inviteCopiedOk}
          clipboardFailMessage={ui.clipboardFail}
          onInviteCopyError={(msg) => setActionError(msg)}
          channels={channels}
          activeChannel={activeChannel}
          onSelectChannel={setActiveChannel}
          listFilter={listFilter}
          onListFilter={setListFilter}
          sidebarQuery={sidebarQuery}
          onSidebarQuery={setSidebarQuery}
          members={members}
          onTogglePin={togglePin}
          onToggleFavorite={toggleFavorite}
          onOpenGlobalSearch={() => setGlobalSearchOpen(true)}
          onCreateChannel={createChannel}
        />
      ) : (
        <aside className="flex w-[320px] items-center justify-center border-r border-slate-800 bg-[#111214] text-slate-500">
          {ui.selectServer}
        </aside>
      )}

      <section className="flex min-w-0 flex-1 flex-col bg-[#313338]">
        <header className="flex shrink-0 flex-col border-b border-slate-700/80">
          <div className="flex h-14 items-center justify-between gap-3 px-4">
            <div className="flex min-w-0 items-center gap-3">
              {activeChannel ? (
                <>
                  <p className="truncate text-sm font-medium text-slate-100">
                    {activeChannelType === "VOICE" ? ui.voice : "#"} {channels.find((c) => c.id === activeChannel)?.name}
                  </p>
                  <div className="hidden items-center gap-1 sm:flex">
                    <button
                      type="button"
                      className="flex items-center gap-1 rounded-lg bg-[#2B2D31] px-2 py-1.5 text-xs text-slate-200 transition hover:bg-[#3f4248]"
                      onClick={() => startVoiceSession(false)}
                      disabled={!activeChannel}
                    >
                      <Phone className="h-3.5 w-3.5" /> {ui.call}
                    </button>
                    <button
                      type="button"
                      className="flex items-center gap-1 rounded-lg bg-[#2B2D31] px-2 py-1.5 text-xs text-slate-200 transition hover:bg-[#3f4248]"
                      onClick={() => startVoiceSession(true)}
                      disabled={!activeChannel}
                    >
                      <Video className="h-3.5 w-3.5" /> {ui.video}
                    </button>
                    <button
                      type="button"
                      className="flex items-center gap-1 rounded-lg bg-[#2B2D31] px-2 py-1.5 text-xs text-slate-200 transition hover:bg-[#3f4248]"
                      onClick={copyJoinCallLink}
                      disabled={!activeChannel}
                    >
                      <Link2 className="h-3.5 w-3.5" /> {ui.link}
                    </button>
                    <button
                      type="button"
                      className="flex items-center gap-1 rounded-lg bg-[#2B2D31] px-2 py-1.5 text-xs text-slate-200 transition hover:bg-[#3f4248]"
                      onClick={() => setScheduleOpen(true)}
                    >
                      <CalendarClock className="h-3.5 w-3.5" /> {ui.schedule}
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400">{ui.noChannel}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {streakInfo != null && (
                <span
                  className="hidden rounded-full bg-orange-950/80 px-2 py-0.5 text-[11px] font-medium text-orange-200 sm:inline"
                  title={st(locale, "streak")}
                >
                  🔥 {streakInfo.streakCurrent} · {Math.round(streakInfo.studyMinutesTotal)}m
                </span>
              )}
              {scheduledCalls.length > 0 && (
                <span className="hidden text-xs text-slate-500 md:inline">
                  {scheduledCalls.length} {ui.upcoming}
                </span>
              )}
              {user && (
                <div className="hidden max-w-[160px] shrink-0 text-right text-[11px] leading-tight text-slate-400 lg:block">
                  <span className="block truncate font-medium text-slate-200">{user.name}</span>
                  <span>{presenceLine(user.isOnline, user.lastSeenAt)}</span>
                </div>
              )}
              <div className="relative flex items-center">
                <Search className="pointer-events-none absolute left-2 h-4 w-4 text-slate-500" />
                <input
                  className="input h-9 w-44 border-slate-600 bg-[#1E1F22] pl-8 text-xs md:w-56"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder={ui.searchChannel}
                  disabled={!activeChannel}
                />
              </div>
              <button
                type="button"
                className={`rounded px-2 py-1 text-[10px] uppercase ${locale === "hinglish" ? "bg-teal-900/50 text-teal-100" : "text-slate-500"}`}
                onClick={() => setLocale("hinglish")}
              >
                HI
              </button>
              <button
                type="button"
                className={`rounded px-2 py-1 text-[10px] uppercase ${locale === "english" ? "bg-teal-900/50 text-teal-100" : "text-slate-500"}`}
                onClick={() => setLocale("english")}
              >
                EN
              </button>
              <button
                className="flex items-center gap-1 rounded-lg border border-slate-600 px-2 py-1.5 text-xs text-slate-300 hover:bg-[#2B2D31]"
                onClick={() => {
                  setAuthToken(null);
                  setToken(null);
                }}
              >
                <LogOut className="h-3.5 w-3.5" /> {ui.logout}
              </button>
            </div>
          </div>
          {activeChannel && activeChannelType === "TEXT" && (
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-800/80 px-4 py-2">
              <label className="flex items-center gap-1 text-[11px] text-slate-400">
                <span>{st(locale, "filterCategory")}</span>
                <select
                  className="rounded border border-slate-600 bg-[#1E1F22] px-2 py-1 text-xs text-slate-200"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as MessageCategory | "")}
                >
                  <option value="">{st(locale, "allCats")}</option>
                  <option value="STUDY">{st(locale, "studyOnly")}</option>
                  <option value="PLACEMENT">Placement</option>
                  <option value="CASUAL">Casual</option>
                  <option value="UNCATEGORIZED">—</option>
                </select>
              </label>
              <button
                type="button"
                className="flex items-center gap-1 rounded-lg bg-violet-900/50 px-2 py-1 text-xs text-violet-100 hover:bg-violet-800/50 disabled:opacity-50"
                onClick={() => void summarizeSahayak()}
                disabled={summarizingChat}
              >
                <FileText className="h-3.5 w-3.5" /> {summarizingChat ? st(locale, "summarizing") : st(locale, "summarizeChat")}
              </button>
              <button
                type="button"
                className="flex items-center gap-1 rounded-lg bg-indigo-900/40 px-2 py-1 text-xs text-indigo-100 hover:bg-indigo-800/50"
                onClick={() => setAiOpen(true)}
              >
                <Sparkles className="h-3.5 w-3.5" /> {st(locale, "askAi")}
              </button>
              <button
                type="button"
                className="flex items-center gap-1 rounded-lg bg-[#2B2D31] px-2 py-1 text-xs text-slate-200 hover:bg-[#3f4248]"
                onClick={() => setPollOpen(true)}
              >
                <Vote className="h-3.5 w-3.5" /> {st(locale, "poll")}
              </button>
              <button
                type="button"
                className="flex items-center gap-1 rounded-lg bg-emerald-900/30 px-2 py-1 text-xs text-emerald-100 hover:bg-emerald-800/40"
                onClick={startStudySession}
              >
                <Timer className="h-3.5 w-3.5" /> {st(locale, "studyStart")}
              </button>
              <button
                type="button"
                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs ${
                  centerPanel === "notes" ? "bg-amber-900/50 text-amber-100" : "bg-[#2B2D31] text-slate-200 hover:bg-[#3f4248]"
                }`}
                onClick={() => setCenterPanel((p) => (p === "notes" ? "chat" : "notes"))}
              >
                <BookOpen className="h-3.5 w-3.5" /> {st(locale, "notes")}
              </button>
              <button
                type="button"
                className="flex items-center gap-1 rounded-lg bg-[#2B2D31] px-2 py-1 text-xs text-slate-200 hover:bg-[#3f4248]"
                onClick={openSaved}
              >
                <Star className="h-3.5 w-3.5" /> {st(locale, "saved")}
              </button>
              <button
                type="button"
                className="flex items-center gap-1 rounded-lg bg-[#2B2D31] px-2 py-1 text-xs text-slate-200 hover:bg-[#3f4248]"
                onClick={openAnalytics}
              >
                <BarChart3 className="h-3.5 w-3.5" /> {st(locale, "analytics")}
              </button>
              <button
                type="button"
                className="rounded-lg bg-violet-900/30 px-2 py-1 text-xs text-violet-100 hover:bg-violet-800/40"
                onClick={() => {
                  setCategoryFilter("PLACEMENT");
                  setCenterPanel("chat");
                }}
              >
                {st(locale, "placementHub")}
              </button>
            </div>
          )}
        </header>

        {!activeChannel ? (
          <EmptyChatState
            serverName={serverName}
            onStartChat={() => firstTextChannel && setActiveChannel(firstTextChannel.id)}
            onJoinChannel={() => document.getElementById("sidebar-channel-search")?.focus()}
            onCreateServer={createServer}
          />
        ) : centerPanel === "notes" && activeChannelType === "TEXT" ? (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-200">{st(locale, "notes")}</h2>
              <button type="button" className="text-xs text-indigo-300 hover:underline" onClick={() => setCenterPanel("chat")}>
                ← {st(locale, "chat")}
              </button>
            </div>
            <form onSubmit={uploadNote} className="rounded-xl border border-slate-600 bg-[#2B2D31] p-4 space-y-2">
              <p className="text-xs font-medium text-slate-300">{st(locale, "uploadNote")}</p>
              <input
                className="input w-full"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder={st(locale, "noteTitle")}
                required
              />
              <input name="noteFile" type="file" accept=".pdf,.doc,.docx,application/pdf" className="text-xs text-slate-300" />
              <button type="submit" className="btn text-sm" disabled={noteUploading}>
                {noteUploading ? ui.uploading : ui.save}
              </button>
            </form>
            <ul className="space-y-3">
              {notes.map((n) => (
                <li key={n.id} className="rounded-xl border border-slate-600 bg-[#2B2D31] p-3">
                  <p className="font-medium text-slate-100">{n.title}</p>
                  <p className="text-[11px] text-slate-500">
                    {n.uploadedBy.name}
                    {n.channel?.name ? ` · #${n.channel.name}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <a className="text-xs text-indigo-300 hover:underline" href={n.fileUrl} target="_blank" rel="noreferrer">
                      {ui.openAttachment}
                    </a>
                    {n.mimeType?.includes("pdf") || n.fileUrl.toLowerCase().includes(".pdf") ? (
                      <span className="text-xs text-slate-500">{st(locale, "previewNote")} (PDF)</span>
                    ) : null}
                  </div>
                  {n.mimeType?.includes("pdf") || n.fileUrl.toLowerCase().includes(".pdf") ? (
                    <iframe title={n.title} src={n.fileUrl} className="mt-2 h-64 w-full rounded-lg border border-slate-700 bg-white" />
                  ) : null}
                </li>
              ))}
            </ul>
            {notes.length === 0 && <p className="text-sm text-slate-500">No notes yet — upload PDFs or docs for the group.</p>}
          </div>
        ) : activeChannelType === "VOICE" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-slate-400">
            <p className="text-lg font-medium text-slate-200">{ui.voice}</p>
            <p className="max-w-sm text-sm">Up se Call / Video dabao ya link copy karo — yahan text chat nahi, sirf voice room.</p>
          </div>
        ) : (
          <>
            {studySessions.length > 0 && (
              <div className="shrink-0 space-y-2 border-b border-slate-700/80 bg-[#232428] px-4 py-3">
                <p className="text-xs font-medium text-emerald-200/90">{st(locale, "studyActive")}</p>
                {studySessions.map((s) => {
                  const elapsedMin = Math.max(0, (nowTick - new Date(s.startedAt).getTime()) / 60_000);
                  const names = s.participants.map((p) => p.member.user.name).join(", ");
                  const role = members.find((mm) => mm.id === user?.id)?.role;
                  const canEnd =
                    myMemberId &&
                    (s.creatorMemberId === myMemberId || role === "ADMIN" || role === "MODERATOR");
                  return (
                    <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-900/50 bg-emerald-950/20 px-3 py-2 text-xs text-slate-200">
                      <div>
                        <span className="font-medium">{s.title}</span>
                        <span className="ml-2 text-slate-400">
                          {Math.floor(elapsedMin)}m / ~{s.plannedMinutes}m
                        </span>
                        <p className="mt-1 text-[11px] text-slate-500">{names || "—"}</p>
                      </div>
                      <div className="flex gap-1">
                        <button type="button" className="rounded bg-emerald-800/60 px-2 py-1 hover:bg-emerald-700/60" onClick={() => joinStudySession(s.id)}>
                          {st(locale, "studyJoin")}
                        </button>
                        {canEnd ? (
                          <button
                            type="button"
                            className="rounded bg-red-900/40 px-2 py-1 text-red-100 hover:bg-red-800/50"
                            onClick={() => endStudySession(s.id)}
                          >
                            {st(locale, "studyEnd")}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {activeChannelType === "TEXT" && polls.length > 0 && (
              <div className="shrink-0 space-y-2 border-b border-slate-700/80 px-4 py-3">
                {polls.map((poll) => {
                  const counts = pollVoteCounts(poll);
                  const total = poll.votes.length;
                  return (
                    <div key={poll.id} className="rounded-xl border border-slate-600 bg-[#2B2D31] p-3">
                      <p className="text-sm font-medium text-slate-100">{poll.question}</p>
                      <p className="text-[11px] text-slate-500">
                        {poll.member.user.name} · {total} {st(locale, "votes")}
                      </p>
                      <ul className="mt-2 space-y-1">
                        {poll.options.map((opt) => {
                          const c = counts.get(opt.id) || 0;
                          const pct = total ? Math.round((c / total) * 100) : 0;
                          return (
                            <li key={opt.id}>
                              <button
                                type="button"
                                className="w-full rounded-lg bg-[#3a3d43] px-2 py-1.5 text-left text-xs text-slate-100 hover:bg-[#4b4f57]"
                                onClick={() => votePoll(poll.id, opt.id)}
                              >
                                <span className="font-medium">{opt.text}</span>
                                <span className="ml-2 text-slate-400">
                                  {c} ({pct}%)
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 && activeChannelType === "TEXT" && (
                <div className="rounded-xl border border-slate-600/50 bg-[#1E1F22]/80 px-4 py-3 text-sm text-slate-400">
                  <p className="font-medium text-slate-300">{ui.emptyHintsTitle}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                    {hinglishChatHints.slice(0, 6).map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                </div>
              )}
              {activeChannelType === "TEXT" &&
                messages.map((m) => {
                  const isSahayak = Boolean(m.isSahayakAi);
                  const mine = m.member.user.id === user?.id;
                  const r = receiptLabel(m.receiptStatus);
                  const displayName = isSahayak
                    ? st(locale, "sahayakName")
                    : m.isAiAssistant
                      ? st(locale, "aiAssistant")
                      : m.member.user.name;
                  const botLike = isSahayak || Boolean(m.isAiAssistant);
                  const cat = m.category || "UNCATEGORIZED";
                  const catClass =
                    cat === "STUDY"
                      ? "bg-sky-900/50 text-sky-100"
                      : cat === "PLACEMENT"
                        ? "bg-violet-900/50 text-violet-100"
                        : cat === "CASUAL"
                          ? "bg-amber-900/40 text-amber-100"
                          : "bg-slate-700/50 text-slate-300";
                  return (
                    <article
                      key={m.id}
                      className={`rounded-xl border p-3 shadow-sm transition ${
                        isSahayak
                          ? "border-violet-500/45 bg-gradient-to-br from-violet-950/90 via-indigo-950/65 to-[#1a1628] hover:border-violet-400/50"
                          : "border-slate-700/40 bg-[#2B2D31] hover:border-slate-600/60"
                      }`}
                    >
                      <div className="flex gap-3">
                        <MemberAvatar
                          name={displayName}
                          imageUrl={botLike ? undefined : m.member.user.imageUrl}
                          className="h-9 w-9 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium text-slate-200">{displayName}</p>
                              {isSahayak ? (
                                <span className="rounded bg-violet-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                                  {st(locale, "aiBadge")}
                                </span>
                              ) : null}
                              <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${catClass}`}>{cat}</span>
                              {m.tags?.map((t) => (
                                <span key={t} className="rounded bg-slate-600/50 px-1.5 py-0.5 text-[10px] text-slate-200">
                                  {t}
                                </span>
                              ))}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500">
                              <span>{format(new Date(m.createdAt), "HH:mm")}</span>
                              {mine && !botLike && <span className={r.className}>{r.text}</span>}
                            </div>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-slate-100">{m.content}</p>
                          {m.fileUrl && (
                            <div className="mt-2">
                              {isImageUrl(m.fileUrl) ? (
                                <img src={m.fileUrl} alt="" className="max-h-64 rounded-lg border border-slate-700" />
                              ) : null}
                              <a className="text-sm text-indigo-300 hover:underline" href={m.fileUrl} target="_blank" rel="noreferrer">
                                {ui.openAttachment}
                              </a>
                            </div>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {reactionEmojis.map((emoji) => {
                              const count = m.reactions?.filter((rx) => rx.emoji === emoji).length || 0;
                              return (
                                <button
                                  key={`${m.id}-${emoji}`}
                                  type="button"
                                  className="rounded-full bg-[#3a3d43] px-2.5 py-1 text-xs transition hover:bg-[#4b4f57]"
                                  onClick={() => toggleReaction(m.id, emoji)}
                                >
                                  {emoji} {count > 0 ? count : ""}
                                </button>
                              );
                            })}
                            <button
                              type="button"
                              className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs ${
                                bookmarkedIds.has(m.id) ? "bg-amber-900/50 text-amber-100" : "bg-[#3a3d43] text-slate-300"
                              }`}
                              onClick={() => toggleBookmark(m.id)}
                            >
                              <Star className="h-3 w-3" />
                              {bookmarkedIds.has(m.id) ? st(locale, "unsaveMsg") : st(locale, "saveMsg")}
                            </button>
                            <button
                              type="button"
                              className="flex items-center gap-1 rounded-full bg-[#3a3d43] px-2 py-1 text-xs text-slate-300 hover:bg-[#4b4f57]"
                              onClick={() => {
                                setMetaForMessage(m.id);
                                setMetaTags((m.tags || []).join(", "));
                                setMetaCategory((m.category as MessageCategory) || "UNCATEGORIZED");
                              }}
                            >
                              <Tag className="h-3 w-3" /> {st(locale, "tagEdit")}
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
            </div>
            {typingUser && activeChannelType === "TEXT" && (
              <div className="px-4 pb-2 text-xs text-slate-400">
                {typingUser} {ui.typing}
              </div>
            )}
            {activeChannelType === "TEXT" && (
              <form onSubmit={sendMessage} className="flex shrink-0 flex-wrap items-end gap-2 border-t border-slate-700/80 bg-[#313338] p-3">
                <label className="btn cursor-pointer shrink-0">
                  {ui.file}
                  <input type="file" className="hidden" onChange={onSelectFile} />
                </label>
                <select
                  className="input h-10 w-[130px] shrink-0 text-xs"
                  value={messageSendCategory}
                  onChange={(e) => setMessageSendCategory(e.target.value as MessageCategory)}
                  title={st(locale, "categoryLabel")}
                >
                  <option value="UNCATEGORIZED">Auto</option>
                  <option value="STUDY">Study</option>
                  <option value="PLACEMENT">Placement</option>
                  <option value="CASUAL">Casual</option>
                </select>
                <input
                  className="input min-w-0 flex-1"
                  value={messageText}
                  onChange={(e) => onTyping(e.target.value)}
                  placeholder={
                    activeChannel ? `${ui.messagePlaceholder} — ${st(locale, "msgHintSahayak")}` : ui.selectChannelFirst
                  }
                />
                <button className="btn shrink-0" disabled={uploading}>
                  {uploading ? ui.uploading : ui.send}
                </button>
              </form>
            )}
            {selectedFile && activeChannelType === "TEXT" && (
              <div className="px-3 pb-3 text-xs text-slate-400">Selected: {selectedFile.name}</div>
            )}
          </>
        )}
      </section>
      </div>

      <GlobalSearchModal
        open={globalSearchOpen}
        onClose={() => setGlobalSearchOpen(false)}
        serverId={activeServer}
        locale={locale}
        onPickChannel={(id) => setActiveChannel(id)}
        onPickMessage={(id) => setActiveChannel(id)}
      />

      {aiOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={submitAi}
            className="w-full max-w-lg rounded-xl border border-slate-600 bg-[#2B2D31] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-indigo-100">{st(locale, "aiTitle")}</h3>
            <textarea
              className="input mt-3 min-h-[120px] w-full resize-y"
              value={aiQuestion}
              onChange={(e) => setAiQuestion(e.target.value)}
              placeholder={st(locale, "aiPlaceholder")}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:bg-[#35373c]" onClick={() => setAiOpen(false)}>
                {ui.cancel}
              </button>
              <button type="submit" className="btn" disabled={aiLoading}>
                {aiLoading ? ui.uploading : st(locale, "aiSend")}
              </button>
            </div>
          </form>
        </div>
      )}

      {pollOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form onSubmit={submitPoll} className="w-full max-w-md rounded-xl border border-slate-600 bg-[#2B2D31] p-6 shadow-xl">
            <h3 className="text-lg font-semibold">{st(locale, "pollTitle")}</h3>
            <label className="mt-3 block text-sm text-slate-300">
              {st(locale, "pollQ")}
              <input className="input mt-1 w-full" value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} required />
            </label>
            <label className="mt-3 block text-sm text-slate-300">
              {st(locale, "pollOpts")}
              <input className="input mt-1 w-full" value={pollOptionsText} onChange={(e) => setPollOptionsText(e.target.value)} required />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:bg-[#35373c]" onClick={() => setPollOpen(false)}>
                {ui.cancel}
              </button>
              <button type="submit" className="btn">
                {ui.save}
              </button>
            </div>
          </form>
        </div>
      )}

      {savedOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-16">
          <div className="w-full max-w-lg rounded-xl border border-slate-600 bg-[#2B2D31] p-5 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold">{st(locale, "saved")}</h3>
              <button type="button" className="text-sm text-slate-400 hover:text-white" onClick={() => setSavedOpen(false)}>
                {ui.dismiss}
              </button>
            </div>
            <ul className="mt-4 max-h-[60vh] space-y-3 overflow-y-auto text-sm">
              {savedMessages.map((m) => (
                <li key={m.id} className="rounded-lg border border-slate-600 bg-[#1E1F22] p-3">
                  <p className="text-[11px] text-emerald-400/90">#{m.channel?.name || "?"}</p>
                  <p className="mt-1 line-clamp-4 text-slate-200">{m.content}</p>
                  <button
                    type="button"
                    className="mt-2 text-xs text-indigo-300 hover:underline"
                    onClick={() => {
                      if (m.channelId) setActiveChannel(m.channelId);
                      setSavedOpen(false);
                    }}
                  >
                    Go to channel
                  </button>
                </li>
              ))}
            </ul>
            {savedMessages.length === 0 && <p className="mt-4 text-slate-500">Nothing saved yet.</p>}
          </div>
        </div>
      )}

      {analyticsOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-12">
          <div className="w-full max-w-lg rounded-xl border border-slate-600 bg-[#2B2D31] p-5 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold">{st(locale, "analyticsTitle")}</h3>
              <button type="button" className="text-sm text-slate-400 hover:text-white" onClick={() => setAnalyticsOpen(false)}>
                {ui.dismiss}
              </button>
            </div>
            {analyticsData && (
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <p>
                  {st(locale, "members")}: <span className="text-white">{analyticsData.memberCount}</span>
                </p>
                <p>
                  {st(locale, "active7d")}: <span className="text-white">{analyticsData.activeContributors7d}</span>
                </p>
                <p>
                  {st(locale, "studyMin")}: <span className="text-white">{analyticsData.plannedMinutesSum7d}</span> ({analyticsData.studySessionsEnded7d}{" "}
                  sessions)
                </p>
                <div>
                  <p className="font-medium text-slate-200">{st(locale, "topCh")}</p>
                  <ul className="mt-1 list-inside list-disc text-xs text-slate-400">
                    {analyticsData.topChannels.map((c) => (
                      <li key={c.channelId}>
                        #{c.name || c.channelId} — {c.messages}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-slate-200">{st(locale, "byCat")}</p>
                  <ul className="mt-1 text-xs text-slate-400">
                    {analyticsData.messagesByCategory.map((x) => (
                      <li key={x.category}>
                        {x.category}: {x.count}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            <div className="mt-6 border-t border-slate-600 pt-4">
              <p className="text-sm font-medium text-slate-200">{st(locale, "leaderboard")}</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-300">
                {leaderboard.map((row, i) => (
                  <li key={row.user?.id || i}>
                    {row.user?.name || "?"} — {row.messageCount} msgs · 🔥 {row.user?.streakCurrent ?? 0}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}

      {metaForMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-600 bg-[#2B2D31] p-6 shadow-xl">
            <h3 className="text-lg font-semibold">{st(locale, "tagEdit")}</h3>
            <label className="mt-3 block text-sm text-slate-300">
              Tags
              <input className="input mt-1 w-full" value={metaTags} onChange={(e) => setMetaTags(e.target.value)} placeholder="Amazon, Google" />
            </label>
            <label className="mt-3 block text-sm text-slate-300">
              {st(locale, "categoryLabel")}
              <select
                className="input mt-1 w-full"
                value={metaCategory}
                onChange={(e) => setMetaCategory(e.target.value as MessageCategory)}
              >
                <option value="STUDY">STUDY</option>
                <option value="PLACEMENT">PLACEMENT</option>
                <option value="CASUAL">CASUAL</option>
                <option value="UNCATEGORIZED">UNCATEGORIZED</option>
              </select>
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:bg-[#35373c]" onClick={() => setMetaForMessage(null)}>
                {ui.cancel}
              </button>
              <button type="button" className="btn" onClick={() => void saveMessageMeta()}>
                {ui.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {scheduleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={submitSchedule}
            className="w-full max-w-md rounded-xl border border-slate-600 bg-[#2B2D31] p-6 shadow-xl"
          >
            <h3 className="text-lg font-semibold">{ui.scheduleCallTitle}</h3>
            <p className="mt-1 text-xs text-slate-400">{ui.scheduleCallSub}</p>
            <label className="mt-4 block text-sm text-slate-300">
              {ui.titleLabel}
              <input
                className="input mt-1"
                value={scheduleTitle}
                onChange={(e) => setScheduleTitle(e.target.value)}
                placeholder={ui.scheduleTitlePh}
              />
            </label>
            <label className="mt-3 block text-sm text-slate-300">
              {ui.dateTimeLabel}
              <input
                type="datetime-local"
                className="input mt-1"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                required
              />
            </label>
            <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={scheduleVideo} onChange={(e) => setScheduleVideo(e.target.checked)} />
              {ui.videoCall}
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:bg-[#35373c]" onClick={() => setScheduleOpen(false)}>
                {ui.cancel}
              </button>
              <button type="submit" className="btn">
                {ui.save}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/join-call" element={<JoinCallPage />} />
      <Route path="/call/:id" element={<ScheduledCallPage />} />
      <Route path="/*" element={<MainApp />} />
    </Routes>
  );
}
