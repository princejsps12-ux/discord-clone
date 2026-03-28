import { useMemo, useState } from "react";
import {
  ChevronDown,
  Hash,
  Volume2,
  Search,
  Link2,
  Pin,
  Star,
  Mic,
  Headphones,
  Settings,
} from "lucide-react";
import type { ChannelRow, ServerMember, User } from "../types";
import { MemberAvatar } from "./MemberAvatar";
import { presenceLine, sidebar } from "../content/hinglish";
import s from "./ChannelSidebar.module.css";

/* ── Voice avatar gradient palette (seeded by name) ────────── */
const GRADIENTS = [
  ["#5b7fff", "#a78bfa"],
  ["#f472b6", "#fb923c"],
  ["#34d399", "#06b6d4"],
  ["#f59e0b", "#ef4444"],
  ["#818cf8", "#38bdf8"],
  ["#a78bfa", "#ec4899"],
];

function gradientFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const [a, b] = GRADIENTS[h % GRADIENTS.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

function voiceInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

/* ── Voice session data type ────────────────────────────────── */
type VoiceSession = {
  channelId: string;
  channelName: string;
  participants: ServerMember[];
};

/* ── VoiceActiveCard ────────────────────────────────────────── */
function VoiceActiveCard({
  session,
  speakingUserId,
}: {
  session: VoiceSession;
  speakingUserId: string | null;
}) {
  return (
    <div className={s.voiceCardWrap}>
      <div className={s.voiceCard}>
        <div className={s.voiceCardInner}>
          {/* Header */}
          <div className={s.voiceCardHeader}>
            <span className={s.voicePulseDot} aria-hidden />
            <span className={s.voiceCardLabel} title={session.channelName}>
              Voice Active — {session.channelName}
            </span>
          </div>

          {/* Participant avatars */}
          <div className={s.voiceAvatars}>
            {session.participants.map((p) => {
              const speaking = p.id === speakingUserId;
              return (
                <div
                  key={p.id}
                  className={`${s.voiceAvatar} ${speaking ? s.speaking : ""}`}
                  style={p.imageUrl ? undefined : { background: gradientFor(p.name) }}
                  title={p.name}
                >
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} />
                  ) : (
                    voiceInitials(p.name)
                  )}
                  <span className={s.voiceAvatarName}>{p.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export type ListFilter = "all" | "unread" | "favorites" | "groups";

type Props = {
  serverName: string;
  inviteCode?: string;
  inviteCopyTitle: string;
  inviteCopyLabel: string;
  inviteCopiedMessage: string;
  clipboardFailMessage: string;
  onInviteCopyError: (message: string) => void;
  channels: ChannelRow[];
  activeChannel: string;
  onSelectChannel: (id: string) => void;
  listFilter: ListFilter;
  onListFilter: (f: ListFilter) => void;
  sidebarQuery: string;
  onSidebarQuery: (q: string) => void;
  members: ServerMember[];
  onTogglePin: (channelId: string, next: boolean) => void;
  onToggleFavorite: (channelId: string, next: boolean) => void;
  onOpenGlobalSearch: () => void;
  onCreateChannel: () => void;
  currentUser?: User | null;
  voiceActiveCounts?: Record<string, number>;
  /** userId → { channelId, channelName } for active voice sessions */
  voiceMembers?: Record<string, { channelId: string; channelName: string }>;
  speakingUserId?: string | null;
  className?: string;
};

const FILTERS: { id: ListFilter; label: string }[] = [
  { id: "all", label: sidebar.filterAll },
  { id: "unread", label: sidebar.filterUnread },
  { id: "favorites", label: sidebar.filterFavorites },
  { id: "groups", label: sidebar.filterGroups },
];

function ChannelIcon({ type }: { type: ChannelRow["type"] }) {
  if (type === "VOICE") return <Volume2 size={14} />;
  return <Hash size={14} />;
}

type ChannelItemProps = {
  channel: ChannelRow;
  active: boolean;
  voiceCount?: number;
  onSelect: () => void;
  onTogglePin: () => void;
  onToggleFavorite: () => void;
};

function ChannelItem({ channel, active, voiceCount, onSelect, onTogglePin, onToggleFavorite }: ChannelItemProps) {
  const unread = channel.unreadCount ?? 0;
  const isUnread = unread > 0 && !active;

  const cls = [
    s.channelItem,
    active ? s.channelActive : "",
    isUnread ? s.channelUnread : "",
  ].filter(Boolean).join(" ");

  return (
    <button type="button" className={cls} onClick={onSelect}>
      <span className={s.channelIcon}>
        <ChannelIcon type={channel.type} />
      </span>

      <span className={s.channelName}>{channel.name}</span>

      {channel.isPinned && <span className={s.pinDot} title="Pinned" />}

      {channel.type === "VOICE" && voiceCount != null && voiceCount > 0 && (
        <span className={s.voiceCount}>
          <span className={s.voiceDot} />
          {voiceCount}
        </span>
      )}

      {isUnread && (
        <span className={s.unreadBadge}>{unread > 99 ? "99+" : unread}</span>
      )}

      <span className={s.itemActions}>
        <button
          type="button"
          className={`${s.actionBtn} ${channel.isFavorite ? s.actionActive : ""}`}
          title={channel.isFavorite ? sidebar.unfavTitle : sidebar.favTitle}
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
        >
          <Star size={12} />
        </button>
        <button
          type="button"
          className={`${s.actionBtn} ${channel.isPinned ? s.actionActive : ""}`}
          title={channel.isPinned ? sidebar.unpinTitle : sidebar.pinTitle}
          onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
        >
          <Pin size={12} />
        </button>
      </span>
    </button>
  );
}

type CategoryGroupProps = {
  label: string;
  channels: ChannelRow[];
  activeChannel: string;
  voiceActiveCounts: Record<string, number>;
  onSelectChannel: (id: string) => void;
  onTogglePin: (id: string, next: boolean) => void;
  onToggleFavorite: (id: string, next: boolean) => void;
  onCreateChannel: () => void;
};

function CategoryGroup({
  label,
  channels,
  activeChannel,
  voiceActiveCounts,
  onSelectChannel,
  onTogglePin,
  onToggleFavorite,
  onCreateChannel,
}: CategoryGroupProps) {
  if (channels.length === 0) return null;
  return (
    <div>
      <div className={s.categoryHeader}>
        <span className={s.categoryLabel}>{label}</span>
        <button
          type="button"
          className={s.categoryAdd}
          title="Add channel"
          onClick={onCreateChannel}
        >
          +
        </button>
      </div>
      {channels.map((c) => (
        <ChannelItem
          key={c.id}
          channel={c}
          active={c.id === activeChannel}
          voiceCount={voiceActiveCounts[c.id]}
          onSelect={() => onSelectChannel(c.id)}
          onTogglePin={() => onTogglePin(c.id, !c.isPinned)}
          onToggleFavorite={() => onToggleFavorite(c.id, !c.isFavorite)}
        />
      ))}
    </div>
  );
}

export function ChannelSidebar({
  serverName,
  inviteCode,
  inviteCopyTitle,
  inviteCopyLabel,
  inviteCopiedMessage,
  clipboardFailMessage,
  onInviteCopyError,
  channels,
  activeChannel,
  onSelectChannel,
  listFilter,
  onListFilter,
  sidebarQuery,
  onSidebarQuery,
  members,
  onTogglePin,
  onToggleFavorite,
  onOpenGlobalSearch,
  onCreateChannel,
  currentUser,
  voiceActiveCounts = {},
  voiceMembers = {},
  speakingUserId = null,
  className,
}: Props) {
  const [inviteCopied, setInviteCopied] = useState(false);

  const copyInvite = async () => {
    if (!inviteCode?.trim()) return;
    try {
      await navigator.clipboard.writeText(inviteCode.trim());
      setInviteCopied(true);
      window.setTimeout(() => setInviteCopied(false), 2500);
    } catch {
      onInviteCopyError(clipboardFailMessage);
    }
  };

  const filtered = useMemo(() => {
    let list = [...channels];
    if (listFilter === "unread") list = list.filter((c) => (c.unreadCount ?? 0) > 0);
    if (listFilter === "favorites") list = list.filter((c) => c.isFavorite);
    if (listFilter === "groups") list = list.filter((c) => c.type === "TEXT");
    const q = sidebarQuery.trim().toLowerCase();
    if (q) list = list.filter((c) => c.name.toLowerCase().includes(q));
    list.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return bt - at;
    });
    return list;
  }, [channels, listFilter, sidebarQuery]);

  const textChannels = filtered.filter((c) => c.type === "TEXT");
  const voiceChannels = filtered.filter((c) => c.type === "VOICE");

  const memberMatch = useMemo(() => {
    const q = sidebarQuery.trim().toLowerCase();
    if (!q) return [];
    return members
      .filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
      .slice(0, 6);
  }, [members, sidebarQuery]);

  /** Derive active voice sessions grouped by channelId */
  const voiceSessions = useMemo((): VoiceSession[] => {
    const byChannel = new Map<string, VoiceSession>();
    for (const [userId, { channelId, channelName }] of Object.entries(voiceMembers)) {
      const member = members.find((m) => m.id === userId);
      if (!member) continue;
      // Fall back to matching by name when channelId is empty
      const key = channelId || channelName;
      if (!byChannel.has(key)) {
        // Resolve canonical channelId from channels list if missing
        const resolved = channelId || channels.find((c) => c.name === channelName)?.id || channelName;
        byChannel.set(key, { channelId: resolved, channelName, participants: [] });
      }
      byChannel.get(key)!.participants.push(member);
    }
    return [...byChannel.values()];
  }, [voiceMembers, members, channels]);

  return (
    <aside className={[s.sidebar, className].filter(Boolean).join(" ")}>
      {/* ── Header ── */}
      <div className={s.header}>
        <button type="button" className={s.serverBtn} title={serverName}>
          <span className={s.serverName}>{serverName}</span>
          <ChevronDown className={s.chevron} />
        </button>

        {/* Boost strip — decorative */}
        <div className={s.boostStrip}>
          <span>⚡</span>
          <span>Boosted</span>
        </div>

        {/* Invite row */}
        {(inviteCode || inviteCopied) && (
          <div className={s.inviteRow}>
            {inviteCopied ? (
              <span className={s.inviteCopiedNote}>{inviteCopiedMessage}</span>
            ) : inviteCode ? (
              <button
                type="button"
                className={s.inviteBtn}
                title={inviteCopyTitle}
                onClick={() => void copyInvite()}
              >
                <Link2 size={11} />
                {inviteCopyLabel}
              </button>
            ) : null}
            <button
              type="button"
              className={s.addChannelBtn}
              title="Add channel"
              onClick={onCreateChannel}
            >
              +
            </button>
          </div>
        )}

        {/* Search */}
        <div className={s.searchWrap}>
          <Search className={s.searchIcon} />
          <input
            id="sidebar-channel-search"
            className={s.searchInput}
            placeholder={sidebar.searchPlaceholder}
            value={sidebarQuery}
            onChange={(e) => onSidebarQuery(e.target.value)}
          />
        </div>

        {/* Global search */}
        <button type="button" className={s.globalBtn} onClick={onOpenGlobalSearch}>
          <Search size={12} />
          {sidebar.globalSearch}
        </button>

        {/* Filter chips */}
        <div className={s.filters}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`${s.chip} ${listFilter === f.id ? s.chipActive : ""}`}
              onClick={() => onListFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Member search results ── */}
      {memberMatch.length > 0 && (
        <div className={s.memberMatches}>
          <p className={s.sectionLabel}>{sidebar.people}</p>
          {memberMatch.map((m) => (
            <div key={m.id} className={s.memberRow}>
              <MemberAvatar name={m.name} imageUrl={m.imageUrl} showPresence isOnline={m.isOnline} />
              <div className={s.memberInfo}>
                <p className={s.memberName}>{m.name}</p>
                <p className={s.memberPresence}>{presenceLine(m.isOnline, m.lastSeenAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Voice active cards ── */}
      {voiceSessions.map((session) => (
        <VoiceActiveCard
          key={session.channelId}
          session={session}
          speakingUserId={speakingUserId}
        />
      ))}

      {/* ── Channel list ── */}
      <div className={s.list}>
        <CategoryGroup
          label="Text Channels"
          channels={textChannels}
          activeChannel={activeChannel}
          voiceActiveCounts={voiceActiveCounts}
          onSelectChannel={onSelectChannel}
          onTogglePin={onTogglePin}
          onToggleFavorite={onToggleFavorite}
          onCreateChannel={onCreateChannel}
        />
        <CategoryGroup
          label="Voice Channels"
          channels={voiceChannels}
          activeChannel={activeChannel}
          voiceActiveCounts={voiceActiveCounts}
          onSelectChannel={onSelectChannel}
          onTogglePin={onTogglePin}
          onToggleFavorite={onToggleFavorite}
          onCreateChannel={onCreateChannel}
        />
        {textChannels.length === 0 && voiceChannels.length === 0 && (
          <p className={s.empty}>{sidebar.noMatch}</p>
        )}
      </div>

      {/* ── Footer user bar ── */}
      {currentUser && (
        <div className={s.footer}>
          <div className={s.footerAvatar}>
            <MemberAvatar
              name={currentUser.name}
              imageUrl={currentUser.imageUrl}
              className="h-8 w-8"
              showPresence
              isOnline={currentUser.isOnline}
            />
          </div>
          <div className={s.footerInfo}>
            <p className={s.footerName}>{currentUser.name}</p>
            <p className={s.footerStatus}>
              <span className={`${s.statusDot} ${currentUser.isOnline ? s.online : s.offline}`} />
              {currentUser.isOnline ? "Online" : "Offline"}
            </p>
          </div>
          <div className={s.footerControls}>
            <button type="button" className={s.iconBtn} title="Mute mic">
              <Mic size={15} />
            </button>
            <button type="button" className={s.iconBtn} title="Headphones">
              <Headphones size={15} />
            </button>
            <button type="button" className={s.iconBtn} title="Settings">
              <Settings size={15} />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
