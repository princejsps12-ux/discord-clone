import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Link2, Pin, Search, Star, Hash, Volume2 } from "lucide-react";
import clsx from "clsx";
import type { ChannelRow, ServerMember } from "../types";
import { MemberAvatar } from "./MemberAvatar";
import { presenceLine, sidebar } from "../content/hinglish";

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
};

function formatListTime(iso?: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Date.now() - d.getTime() < 86_400_000) return format(d, "HH:mm");
    return format(d, "dd/MM/yy");
  } catch {
    return "";
  }
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
      const ap = a.isPinned ? 0 : 1;
      const bp = b.isPinned ? 0 : 1;
      if (ap !== bp) return ap - bp;
      const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return bt - at;
    });
    return list;
  }, [channels, listFilter, sidebarQuery]);

  const memberMatch = useMemo(() => {
    const q = sidebarQuery.trim().toLowerCase();
    if (!q) return [];
    return members.filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)).slice(0, 6);
  }, [members, sidebarQuery]);

  const filters: { id: ListFilter; label: string }[] = [
    { id: "all", label: sidebar.filterAll },
    { id: "unread", label: sidebar.filterUnread },
    { id: "favorites", label: sidebar.filterFavorites },
    { id: "groups", label: sidebar.filterGroups },
  ];

  const renderRow = (c: ChannelRow) => {
    const preview = c.lastMessagePreview || (c.type === "VOICE" ? sidebar.voiceRoom : sidebar.noMessagesYet);
    const unread = c.unreadCount ?? 0;
    return (
      <div
        key={c.id}
        className={clsx(
          "group relative flex w-full items-start gap-2 rounded-lg px-2 py-2.5 text-left transition-all duration-150",
          activeChannel === c.id ? "bg-[#3f4248] shadow-inner" : "hover:bg-[#35373c]",
        )}
      >
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelectChannel(c.id)}>
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 truncate font-medium text-slate-100">
              {c.type === "TEXT" ? <Hash className="h-4 w-4 shrink-0 text-slate-500" /> : <Volume2 className="h-4 w-4 shrink-0 text-amber-500/90" />}
              <span className="truncate">{c.name}</span>
              {c.isPinned && <Pin className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
            </span>
            <span className="shrink-0 text-[11px] tabular-nums text-slate-500">{formatListTime(c.lastMessageAt)}</span>
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <p className="truncate text-xs text-slate-400">
              {c.lastMessageSenderName ? <span className="text-slate-500">{c.lastMessageSenderName}: </span> : null}
              {preview}
            </p>
            {unread > 0 && (
              <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[11px] font-semibold text-emerald-950 shadow-sm">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </div>
        </button>
        <div className="flex shrink-0 flex-col gap-0.5 opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            title={c.isFavorite ? sidebar.unfavTitle : sidebar.favTitle}
            className="rounded p-1 text-slate-400 hover:bg-[#2B2D31] hover:text-amber-300"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(c.id, !c.isFavorite);
            }}
          >
            <Star className={clsx("h-4 w-4", c.isFavorite && "fill-amber-400 text-amber-400")} />
          </button>
          <button
            type="button"
            title={c.isPinned ? sidebar.unpinTitle : sidebar.pinTitle}
            className="rounded p-1 text-slate-400 hover:bg-[#2B2D31] hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin(c.id, !c.isPinned);
            }}
          >
            <Pin className={clsx("h-4 w-4", c.isPinned && "text-amber-400")} />
          </button>
        </div>
      </div>
    );
  };

  const pinnedRows = filtered.filter((c) => c.isPinned);
  const otherRows = filtered.filter((c) => !c.isPinned);

  return (
    <aside className="flex w-[320px] shrink-0 flex-col border-r border-slate-700/80 bg-[#111214]">
      <div className="border-b border-slate-700/80 px-3 py-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="min-w-0 truncate text-lg font-semibold tracking-tight text-white">{serverName}</h2>
          <div className="flex shrink-0 items-center gap-1">
            {inviteCode ? (
              <button
                type="button"
                title={inviteCopyTitle}
                className="rounded-lg border border-slate-600/80 bg-[#1a1b1e] px-2 py-1.5 text-xs text-slate-200 transition hover:border-emerald-600/50 hover:text-white"
                onClick={() => void copyInvite()}
              >
                <span className="flex items-center gap-1">
                  <Link2 className="h-3.5 w-3.5" />
                  {inviteCopyLabel}
                </span>
              </button>
            ) : null}
            <button type="button" className="btn shrink-0 py-1.5 text-xs" onClick={onCreateChannel}>
              +
            </button>
          </div>
        </div>
        {inviteCopied ? (
          <p className="mb-2 rounded-md border border-emerald-700/50 bg-emerald-950/40 px-2 py-1.5 text-[11px] text-emerald-100/95">{inviteCopiedMessage}</p>
        ) : null}
        {inviteCode && !inviteCopied ? (
          <p className="mb-2 break-all font-mono text-[10px] leading-snug text-slate-500" title={inviteCopyTitle}>
            {inviteCode}
          </p>
        ) : null}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            id="sidebar-channel-search"
            className="input w-full border-slate-700 bg-[#1a1b1e] py-2 pl-9 pr-3 text-sm transition focus:border-emerald-600/50"
            placeholder={sidebar.searchPlaceholder}
            value={sidebarQuery}
            onChange={(e) => onSidebarQuery(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={onOpenGlobalSearch}
          className="mt-2 w-full rounded-lg border border-slate-700/80 bg-[#1a1b1e] py-2 text-xs text-slate-400 transition hover:border-emerald-600/40 hover:text-slate-200"
        >
          {sidebar.globalSearch}
        </button>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onListFilter(f.id)}
              className={clsx(
                "rounded-full px-3 py-1 text-xs font-medium transition",
                listFilter === f.id ? "bg-emerald-600 text-white shadow" : "bg-[#2B2D31] text-slate-400 hover:bg-[#35373c] hover:text-slate-200",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {memberMatch.length > 0 && (
        <div className="border-b border-slate-700/60 px-3 py-2">
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">{sidebar.people}</p>
          <ul className="space-y-1">
            {memberMatch.map((m) => (
              <li key={m.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-300">
                <MemberAvatar name={m.name} imageUrl={m.imageUrl} showPresence isOnline={m.isOnline} />
                <div className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-200">{m.name}</span>
                  <span className="text-[10px] text-slate-500">{presenceLine(m.isOnline, m.lastSeenAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {pinnedRows.length > 0 && (
          <div className="mb-2">
            <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-amber-500/90">{sidebar.pinned}</p>
            <div className="space-y-0.5">{pinnedRows.map(renderRow)}</div>
          </div>
        )}
        {otherRows.length > 0 && (
          <div>
            {pinnedRows.length > 0 && (
              <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{sidebar.channels}</p>
            )}
            <div className="space-y-0.5">{otherRows.map(renderRow)}</div>
          </div>
        )}
        {pinnedRows.length === 0 && otherRows.length === 0 && (
          <p className="px-2 py-8 text-center text-sm text-slate-500">{sidebar.noMatch}</p>
        )}
      </div>
    </aside>
  );
}
