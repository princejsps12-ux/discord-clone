import { useState } from "react";
import {
  Hash,
  Volume2,
  Bell,
  Users,
  Pin,
  Search,
  LogOut,
  Phone,
  Video,
} from "lucide-react";
import type { StreakInfo } from "../types";
import type { AppLocale } from "../content/hinglish";
import { st } from "../content/hinglish";
import s from "./ChatHeader.module.css";

type ChannelType = "TEXT" | "VOICE";

type Props = {
  channelName?: string;
  channelType?: ChannelType;
  channelTopic?: string;
  searchText: string;
  onSearchChange: (v: string) => void;
  membersOpen: boolean;
  onToggleMembers: () => void;
  streakInfo?: StreakInfo | null;
  scheduledCallsCount?: number;
  locale: AppLocale;
  onSetLocale: (l: AppLocale) => void;
  onLogout: () => void;
  noChannelLabel: string;
  onStartCall?: () => void;
  onStartVideo?: () => void;
};

export function ChatHeader({
  channelName,
  channelType,
  channelTopic,
  searchText,
  onSearchChange,
  membersOpen,
  onToggleMembers,
  streakInfo,
  scheduledCallsCount = 0,
  locale,
  onSetLocale,
  onLogout,
  noChannelLabel,
  onStartCall,
  onStartVideo,
}: Props) {
  const [searchFocused, setSearchFocused] = useState(false);
  const searchOpen = searchFocused || searchText.length > 0;

  return (
    <header className={s.header}>
      {/* ── Left: channel identity ── */}
      <div className={s.left}>
        {channelName ? (
          <>
            <span className={s.channelIcon}>
              {channelType === "VOICE"
                ? <Volume2 size={18} />
                : <Hash size={18} />}
            </span>

            <span className={s.channelName}>{channelName}</span>

            {channelTopic && (
              <>
                <span className={s.divider} aria-hidden />
                <span className={s.topic}>{channelTopic}</span>
              </>
            )}
          </>
        ) : (
          <span className={s.noChannel}>{noChannelLabel}</span>
        )}
      </div>

      {/* ── Right: actions ── */}
      <div className={s.right}>
        {/* Streak chip */}
        {streakInfo != null && (
          <span className={s.streak} title={st(locale, "streak")}>
            🔥 {streakInfo.streakCurrent}
            <span style={{ opacity: 0.6 }}>·</span>
            {Math.round(streakInfo.studyMinutesTotal)}m
          </span>
        )}

        {scheduledCallsCount > 0 && (
          <span className={s.streak} style={{ background: "rgba(91,127,255,0.1)", borderColor: "rgba(91,127,255,0.2)", color: "var(--accent)" }}>
            📅 {scheduledCallsCount}
          </span>
        )}

        <span className={s.sep} aria-hidden />

        {/* Call / Video buttons */}
        {onStartCall && (
          <button type="button" className={s.iconBtn} title="Start call" onClick={onStartCall} disabled={!channelName}>
            <Phone size={15} />
          </button>
        )}
        {onStartVideo && (
          <button type="button" className={s.iconBtn} title="Start video" onClick={onStartVideo} disabled={!channelName}>
            <Video size={15} />
          </button>
        )}

        {/* Notifications */}
        <button
          type="button"
          className={s.iconBtn}
          title="Notifications"
          disabled={!channelName}
        >
          <Bell size={16} />
        </button>

        {/* Members toggle */}
        <button
          type="button"
          className={`${s.iconBtn} ${membersOpen ? s.membersActive : ""}`}
          title={membersOpen ? "Hide members" : "Show members"}
          onClick={onToggleMembers}
          disabled={!channelName}
        >
          <Users size={16} />
        </button>

        {/* Pins */}
        <button
          type="button"
          className={s.iconBtn}
          title="Pinned messages"
          disabled={!channelName}
        >
          <Pin size={16} />
        </button>

        {/* Search */}
        <div className={`${s.searchWrap} ${searchOpen ? s.searchOpen : ""}`}>
          <Search className={s.searchIcon} />
          <input
            className={s.searchInput}
            value={searchText}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search messages…"
            disabled={!channelName}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
        </div>

        <span className={s.sep} aria-hidden />

        {/* Locale toggles */}
        <button
          type="button"
          className={`${s.localePill} ${locale === "hinglish" ? s.localeActive : ""}`}
          onClick={() => onSetLocale("hinglish")}
        >
          HI
        </button>
        <button
          type="button"
          className={`${s.localePill} ${locale === "english" ? s.localeActive : ""}`}
          onClick={() => onSetLocale("english")}
        >
          EN
        </button>

        <span className={s.sep} aria-hidden />

        {/* Logout */}
        <button
          type="button"
          className={s.logoutBtn}
          onClick={onLogout}
        >
          <LogOut size={13} />
          Logout
        </button>
      </div>
    </header>
  );
}
