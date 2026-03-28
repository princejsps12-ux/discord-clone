import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import {
  Sparkles,
  BarChart3,
  Star,
  BookOpen,
  Timer,
  Vote,
  FileText,
} from "lucide-react";
import { api, getApiErrorMessage, setAuthToken, setAuthFailureHandler } from "./lib/api";
import type {
  AnalyticsSummary,
  ChannelRow,
  LeaderboardRow,
  Message as MessageType,
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
import { ServerRail } from "./components/ServerRail";
import { ChatHeader } from "./components/ChatHeader";
import { Message, MessageSkeleton } from "./components/Message";
import { MessageInput } from "./components/MessageInput";
import { MembersPanel } from "./components/MembersPanel";
import { JoinCallPage, ScheduledCallPage } from "./pages/CallPages";
import {
  EXAMPLE_GROUPS,
  hinglishChatHints,
  INDIAN_NAMES,
  ui,
  st,
  type AppLocale,
} from "./content/hinglish";
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


function MainApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [user, setUser] = useState<User | null>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [members, setMembers] = useState<ServerMember[]>([]);
  const [messages, setMessages] = useState<MessageType[]>([]);
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
  const [savedMessages, setSavedMessages] = useState<MessageType[]>([]);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsSummary | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [metaForMessage, setMetaForMessage] = useState<string | null>(null);
  const [metaTags, setMetaTags] = useState("");
  const [metaCategory, setMetaCategory] = useState<MessageCategory>("UNCATEGORIZED");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteUploading, setNoteUploading] = useState(false);
  const [summarizingChat, setSummarizingChat] = useState(false);
  const [membersOpen, setMembersOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  /** userId → { channelId, channelName } for the voice channel they're in */
  const [voiceMembers, setVoiceMembers] = useState<Record<string, { channelId: string; channelName: string }>>({});
  /** userId currently speaking (via VAD/WebRTC event from server) */
  const [speakingUserId, setSpeakingUserId] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [messagesLoading, setMessagesLoading] = useState(false);
  /** id of the newest socket message (gets isNew animation) */
  const [newestMessageId, setNewestMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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

  // Register the global 401 → auto-logout handler once per mount
  useEffect(() => {
    const logout = () => { setAuthToken(null); setToken(null); };
    setAuthFailureHandler(logout);
  }, []);

  useEffect(() => {
    if (DEMO_MODE) return;
    if (!token) return;
    setAuthToken(token);
    // If the token is stale/invalid, auto-logout instead of showing a broken shell
    api.get("/api/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => { /* interceptor already handles 401 → logout */ });
    api.get("/api/servers").then((res) => setServers(res.data));
    const socketUrl =
      import.meta.env.VITE_API_URL || (import.meta.env.DEV ? window.location.origin : "http://localhost:4000");
    socket = io(socketUrl, { auth: { token } });
    socket.on("message:new", (message: MessageType) => {
      const chId = message.channelId;
      if (chId && chId === activeChannelRef.current) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev;
          return [message, ...prev];
        });
        setNewestMessageId(message.id);
        // Scroll to the new message
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 80);
      }
      scheduleRefetchChannels();
    });
    socket.on("message:updated", (updated: MessageType) =>
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
    socket.on("voice:joined", (p: { userId: string; channelId?: string; channelName: string }) => {
      // Prefer channelId from payload; fall back to matching by name in current channels list
      setVoiceMembers((prev) => ({
        ...prev,
        [p.userId]: {
          channelId: p.channelId ?? "",
          channelName: p.channelName,
        },
      }));
    });
    socket.on("voice:left", (p: { userId: string }) => {
      setVoiceMembers((prev) => {
        const next = { ...prev };
        delete next[p.userId];
        return next;
      });
      setSpeakingUserId((cur) => (cur === p.userId ? null : cur));
    });
    socket.on("voice:speaking", (p: { userId: string }) => {
      setSpeakingUserId(p.userId);
    });
    socket.on("voice:speaking:stop", (p: { userId: string }) => {
      setSpeakingUserId((cur) => (cur === p.userId ? null : cur));
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
      .get<MessageType[]>("/api/bookmarks")
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

  const mergeSahayakMessages = (data: { userMessage?: MessageType; botMessage: MessageType }) => {
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
      const { data } = await api.post<{ botMessage: MessageType }>(`/api/channels/${activeChannel}/sahayak`, {
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
        const { data } = await api.post<{ userMessage?: MessageType; botMessage: MessageType }>(
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
      const { data } = await api.post<MessageType>(`/api/channels/${activeChannel}/messages`, {
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
    setMessagesLoading(true);
    try {
      const p = new URLSearchParams();
      if (search?.trim()) p.set("q", search.trim());
      if (categoryFilter) p.set("category", categoryFilter);
      const qs = p.toString();
      const res = await api.get(`/api/channels/${channelId}/messages${qs ? `?${qs}` : ""}`);
      setMessages(res.data.items);
    } finally {
      setMessagesLoading(false);
    }
  };

  const myMemberId = useMemo(() => members.find((m) => m.id === user?.id)?.memberId, [members, user?.id]);

  const submitAi = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeChannel || !aiQuestion.trim()) return;
    setAiLoading(true);
    setActionError(null);
    const q = aiQuestion.trim();
    try {
      const { data } = await api.post<{ userMessage?: MessageType; botMessage: MessageType }>(
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
      .get<MessageType[]>("/api/bookmarks")
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
    <main className={`app-shell${membersOpen ? "" : " no-members"}${mobileNavOpen ? " nav-open" : ""}`}>
      {/* ── Banner row — spans all 4 columns ── */}
      <div className="app-shell-banner">
        {backendBanner}
        {actionError && (
          <div className="flex items-center justify-between gap-2 border-b border-red-900/50 bg-red-950/80 px-4 py-2 text-sm text-red-100">
            <span>{actionError}</span>
            <button type="button" className="shrink-0 underline" onClick={() => setActionError(null)}>
              {ui.dismiss}
            </button>
          </div>
        )}
      </div>

      {/* ── Nav drawer — wraps Rail + Sidebar; slides in on mobile ── */}
      <div className="app-nav-drawer">
        {/* Rail — 72px server icon column */}
        <ServerRail
          servers={servers}
          activeServerId={activeServer}
          currentUser={user}
          onSelectServer={(id) => { setActiveServer(id); setMobileNavOpen(false); }}
          onAddServer={createServer}
          onJoinServer={() => void joinServerWithInvite()}
        />

        {/* Sidebar — 240px channel list column */}
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
            onSelectChannel={(id) => { setActiveChannel(id); setMobileNavOpen(false); }}
            listFilter={listFilter}
            onListFilter={setListFilter}
            sidebarQuery={sidebarQuery}
            onSidebarQuery={setSidebarQuery}
            members={members}
            onTogglePin={togglePin}
            onToggleFavorite={toggleFavorite}
            onOpenGlobalSearch={() => setGlobalSearchOpen(true)}
            onCreateChannel={createChannel}
            currentUser={user}
            voiceMembers={voiceMembers}
            speakingUserId={speakingUserId}
            className="app-shell-sidebar"
          />
        ) : (
          <aside className="app-shell-sidebar" style={{ display: "flex", alignItems: "center", justifyContent: "center", borderRight: "1px solid var(--border)", background: "var(--bg-deep)", color: "var(--text-3)", fontSize: 13 }}>
            {ui.selectServer}
          </aside>
        )}
      </div>

      {/* ── Mobile nav backdrop overlay ── */}
      {mobileNavOpen && (
        <div
          className="nav-overlay"
          onClick={() => setMobileNavOpen(false)}
          role="presentation"
        />
      )}

      {/* ── Chat — 1fr main content column ── */}
      <section className="app-shell-chat">
        <ChatHeader
          channelName={channels.find((c) => c.id === activeChannel)?.name}
          channelType={activeChannelType}
          searchText={searchText}
          onSearchChange={setSearchText}
          membersOpen={membersOpen}
          onToggleMembers={() => setMembersOpen((v) => !v)}
          streakInfo={streakInfo}
          scheduledCallsCount={scheduledCalls.length}
          locale={locale}
          onSetLocale={setLocale}
          onLogout={() => { setAuthToken(null); setToken(null); }}
          noChannelLabel={ui.noChannel}
          onStartCall={() => startVoiceSession(false)}
          onStartVideo={() => startVoiceSession(true)}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />

        {/* ── Sub-toolbar (category filters + AI actions) ── */}
        {activeChannel && activeChannelType === "TEXT" && (
          <div style={{
            display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6,
            borderBottom: "1px solid var(--border)", background: "var(--bg-surface)",
            padding: "6px 16px", flexShrink: 0,
          }}>
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-3)" }}>
              <span>{st(locale, "filterCategory")}</span>
              <select
                style={{ borderRadius: "var(--radius-xs)", border: "1px solid var(--border)", background: "var(--bg-raised)", padding: "2px 6px", fontSize: 11, color: "var(--text-1)", outline: "none" }}
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
              style={{ display: "flex", alignItems: "center", gap: 4, borderRadius: "var(--radius-sm)", background: "var(--accent-soft)", padding: "3px 8px", fontSize: 11, color: "var(--accent)", border: "1px solid var(--border-lit)", cursor: "pointer", opacity: summarizingChat ? 0.5 : 1 }}
              onClick={() => void summarizeSahayak()}
              disabled={summarizingChat}
            >
              <FileText size={12} /> {summarizingChat ? st(locale, "summarizing") : st(locale, "summarizeChat")}
            </button>
            <button
              type="button"
              style={{ display: "flex", alignItems: "center", gap: 4, borderRadius: "var(--radius-sm)", background: "var(--accent-soft)", padding: "3px 8px", fontSize: 11, color: "var(--accent-2)", border: "1px solid rgba(167,139,250,0.2)", cursor: "pointer" }}
              onClick={() => setAiOpen(true)}
            >
              <Sparkles size={12} /> {st(locale, "askAi")}
            </button>
            <button
              type="button"
              style={{ display: "flex", alignItems: "center", gap: 4, borderRadius: "var(--radius-sm)", background: "var(--bg-raised)", padding: "3px 8px", fontSize: 11, color: "var(--text-2)", border: "1px solid var(--border)", cursor: "pointer" }}
              onClick={() => setPollOpen(true)}
            >
              <Vote size={12} /> {st(locale, "poll")}
            </button>
            <button
              type="button"
              style={{ display: "flex", alignItems: "center", gap: 4, borderRadius: "var(--radius-sm)", background: "var(--online-soft)", padding: "3px 8px", fontSize: 11, color: "var(--online)", border: "1px solid var(--online-border)", cursor: "pointer" }}
              onClick={startStudySession}
            >
              <Timer size={12} /> {st(locale, "studyStart")}
            </button>
            <button
              type="button"
              style={{ display: "flex", alignItems: "center", gap: 4, borderRadius: "var(--radius-sm)", background: centerPanel === "notes" ? "var(--idle-soft)" : "var(--bg-raised)", padding: "3px 8px", fontSize: 11, color: centerPanel === "notes" ? "var(--idle)" : "var(--text-2)", border: "1px solid var(--border)", cursor: "pointer" }}
              onClick={() => setCenterPanel((p) => (p === "notes" ? "chat" : "notes"))}
            >
              <BookOpen size={12} /> {st(locale, "notes")}
            </button>
            <button
              type="button"
              style={{ display: "flex", alignItems: "center", gap: 4, borderRadius: "var(--radius-sm)", background: "var(--bg-raised)", padding: "3px 8px", fontSize: 11, color: "var(--text-2)", border: "1px solid var(--border)", cursor: "pointer" }}
              onClick={openSaved}
            >
              <Star size={12} /> {st(locale, "saved")}
            </button>
            <button
              type="button"
              style={{ display: "flex", alignItems: "center", gap: 4, borderRadius: "var(--radius-sm)", background: "var(--bg-raised)", padding: "3px 8px", fontSize: 11, color: "var(--text-2)", border: "1px solid var(--border)", cursor: "pointer" }}
              onClick={openAnalytics}
            >
              <BarChart3 size={12} /> {st(locale, "analytics")}
            </button>
            <button
              type="button"
              style={{ borderRadius: "var(--radius-sm)", background: "var(--badge-placement-bg)", padding: "3px 8px", fontSize: 11, color: "var(--badge-placement)", border: "1px solid rgba(167,139,250,0.15)", cursor: "pointer" }}
              onClick={() => { setCategoryFilter("PLACEMENT"); setCenterPanel("chat"); }}
            >
              {st(locale, "placementHub")}
            </button>
          </div>
        )}

        {!activeChannel ? (
          <EmptyChatState
            serverName={serverName}
            onStartChat={() => firstTextChannel && setActiveChannel(firstTextChannel.id)}
            onJoinChannel={() => document.getElementById("sidebar-channel-search")?.focus()}
            onCreateServer={createServer}
          />
        ) : centerPanel === "notes" && activeChannelType === "TEXT" ? (
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto", padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "var(--text-1)" }}>{st(locale, "notes")}</h2>
              <button type="button" style={{ fontSize: 12, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }} onClick={() => setCenterPanel("chat")}>
                ← {st(locale, "chat")}
              </button>
            </div>
            <form onSubmit={uploadNote} style={{ borderRadius: "var(--radius-md)", border: "1px solid var(--border)", background: "var(--bg-raised)", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text-2)" }}>{st(locale, "uploadNote")}</p>
              <input
                className="input"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder={st(locale, "noteTitle")}
                required
              />
              <input name="noteFile" type="file" accept=".pdf,.doc,.docx,application/pdf" style={{ fontSize: 12, color: "var(--text-3)" }} />
              <button type="submit" className="btn" disabled={noteUploading}>
                {noteUploading ? ui.uploading : ui.save}
              </button>
            </form>
            <ul style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {notes.map((n) => (
                <li key={n.id} style={{ borderRadius: "var(--radius-md)", border: "1px solid var(--border)", background: "var(--bg-raised)", padding: 12 }}>
                  <p style={{ fontWeight: 600, color: "var(--text-1)", fontSize: 13 }}>{n.title}</p>
                  <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                    {n.uploadedBy.name}
                    {n.channel?.name ? ` · #${n.channel.name}` : ""}
                  </p>
                  <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <a style={{ fontSize: 12, color: "var(--accent)" }} href={n.fileUrl} target="_blank" rel="noreferrer">
                      {ui.openAttachment}
                    </a>
                    {n.mimeType?.includes("pdf") || n.fileUrl.toLowerCase().includes(".pdf") ? (
                      <span style={{ fontSize: 12, color: "var(--text-3)" }}>{st(locale, "previewNote")} (PDF)</span>
                    ) : null}
                  </div>
                  {n.mimeType?.includes("pdf") || n.fileUrl.toLowerCase().includes(".pdf") ? (
                    <iframe title={n.title} src={n.fileUrl} style={{ marginTop: 8, height: 256, width: "100%", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "#fff" }} />
                  ) : null}
                </li>
              ))}
            </ul>
            {notes.length === 0 && <p style={{ fontSize: 13, color: "var(--text-3)" }}>No notes yet — upload PDFs or docs for the group.</p>}
          </div>
        ) : activeChannelType === "VOICE" ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 32, textAlign: "center", color: "var(--text-3)" }}>
            <p style={{ fontSize: 17, fontWeight: 600, color: "var(--text-2)" }}>{ui.voice}</p>
            <p style={{ maxWidth: 340, fontSize: 13, color: "var(--text-3)" }}>Up se Call / Video dabao ya link copy karo — yahan text chat nahi, sirf voice room.</p>
          </div>
        ) : (
          <>
            {studySessions.length > 0 && (
              <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 6, borderBottom: "1px solid var(--border)", background: "var(--bg-deep)", padding: "10px 16px" }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--online)" }}>{st(locale, "studyActive")}</p>
                {studySessions.map((s) => {
                  const elapsedMin = Math.max(0, (nowTick - new Date(s.startedAt).getTime()) / 60_000);
                  const names = s.participants.map((p) => p.member.user.name).join(", ");
                  const role = members.find((mm) => mm.id === user?.id)?.role;
                  const canEnd =
                    myMemberId &&
                    (s.creatorMemberId === myMemberId || role === "ADMIN" || role === "MODERATOR");
                  return (
                    <div key={s.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, borderRadius: "var(--radius-sm)", border: "1px solid var(--online-border)", background: "var(--online-soft)", padding: "6px 10px", fontSize: 12, color: "var(--text-1)" }}>
                      <div>
                        <span style={{ fontWeight: 600 }}>{s.title}</span>
                        <span style={{ marginLeft: 8, color: "var(--text-3)" }}>
                          {Math.floor(elapsedMin)}m / ~{s.plannedMinutes}m
                        </span>
                        <p style={{ marginTop: 2, fontSize: 11, color: "var(--text-muted)" }}>{names || "—"}</p>
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button type="button" style={{ borderRadius: "var(--radius-xs)", background: "var(--online-soft)", border: "1px solid var(--online-border)", padding: "2px 8px", fontSize: 11, color: "var(--online)", cursor: "pointer" }} onClick={() => joinStudySession(s.id)}>
                          {st(locale, "studyJoin")}
                        </button>
                        {canEnd ? (
                          <button
                            type="button"
                            style={{ borderRadius: "var(--radius-xs)", background: "var(--dnd-soft)", border: "1px solid rgba(248,113,113,0.2)", padding: "2px 8px", fontSize: 11, color: "var(--dnd)", cursor: "pointer" }}
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
              <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 8, borderBottom: "1px solid var(--border)", padding: "10px 16px" }}>
                {polls.map((poll) => {
                  const counts = pollVoteCounts(poll);
                  const total = poll.votes.length;
                  return (
                    <div key={poll.id} style={{ borderRadius: "var(--radius-md)", border: "1px solid var(--border)", background: "var(--bg-raised)", padding: "10px 12px" }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>{poll.question}</p>
                      <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                        {poll.member.user.name} · {total} {st(locale, "votes")}
                      </p>
                      <ul style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                        {poll.options.map((opt) => {
                          const c = counts.get(opt.id) || 0;
                          const pct = total ? Math.round((c / total) * 100) : 0;
                          return (
                            <li key={opt.id}>
                              <button
                                type="button"
                                style={{ width: "100%", borderRadius: "var(--radius-sm)", background: "var(--bg-float)", padding: "5px 10px", textAlign: "left", fontSize: 12, color: "var(--text-1)", border: "1px solid var(--border)", cursor: "pointer" }}
                                onClick={() => votePoll(poll.id, opt.id)}
                              >
                                <span style={{ fontWeight: 500 }}>{opt.text}</span>
                                <span style={{ marginLeft: 8, color: "var(--text-3)" }}>
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
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 0", scrollBehavior: "smooth" }}>
              {messagesLoading ? (
                <MessageSkeleton />
              ) : (
                <>
                  {messages.length === 0 && activeChannelType === "TEXT" && (
                    <div style={{ margin: "16px", padding: "12px 16px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", background: "var(--bg-raised)", fontSize: 13, color: "var(--text-3)" }}>
                      <p style={{ fontWeight: 600, color: "var(--text-2)", marginBottom: 8 }}>{ui.emptyHintsTitle}</p>
                      <ul style={{ paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                        {hinglishChatHints.slice(0, 6).map((h) => (
                          <li key={h}>{h}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {activeChannelType === "TEXT" &&
                    messages.map((m, idx) => {
                      const prev = messages[idx + 1];
                      const grouped =
                        !!prev &&
                        prev.member.user.id === m.member.user.id &&
                        Math.abs(
                          new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime(),
                        ) < 5 * 60 * 1000;

                      return (
                        <Message
                          key={m.id}
                          message={m}
                          grouped={grouped}
                          isMine={m.member.user.id === user?.id}
                          locale={locale}
                          bookmarked={bookmarkedIds.has(m.id)}
                          currentUserId={user?.id}
                          isNew={m.id === newestMessageId}
                          msgIndex={idx}
                          onToggleReaction={(emoji: string) => toggleReaction(m.id, emoji)}
                          onToggleBookmark={() => toggleBookmark(m.id)}
                          onTagEdit={() => {
                            setMetaForMessage(m.id);
                            setMetaTags((m.tags || []).join(", "));
                            setMetaCategory((m.category as MessageCategory) || "UNCATEGORIZED");
                          }}
                        />
                      );
                    })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>
            {activeChannelType === "TEXT" && (
              <MessageInput
                channelName={channels.find((c) => c.id === activeChannel)?.name}
                messageText={messageText}
                onTyping={onTyping}
                onSubmit={sendMessage}
                selectedFile={selectedFile}
                onSelectFile={onSelectFile}
                onClearFile={() => setSelectedFile(null)}
                uploading={uploading}
                messageSendCategory={messageSendCategory}
                onSetCategory={setMessageSendCategory}
                typingUser={typingUser}
                locale={locale}
                disabled={!activeChannel}
              />
            )}
          </>
        )}
      </section>

      {/* ── Members panel — 260px right column (fixed overlay on mobile/tablet) ── */}
      <div className={`app-shell-members${membersOpen ? " members-open" : ""}`}>
        <MembersPanel
          members={members}
          typingUser={typingUser}
          voiceMembers={Object.fromEntries(
            Object.entries(voiceMembers).map(([uid, v]) => [uid, v.channelName])
          )}
        />
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
