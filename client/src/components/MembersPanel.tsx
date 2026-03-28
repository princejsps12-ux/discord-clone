import type { ServerMember } from "../types";
import s from "./MembersPanel.module.css";

// ── Gradient palette (same seed logic as Message avatar) ────
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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ── Role-based name class ────────────────────────────────────
function nameClass(role?: string, isOnline?: boolean): string {
  if (!isOnline) return s.offline;
  const r = (role ?? "").toUpperCase();
  if (r === "ADMIN" || r === "OWNER") return s.admin;
  if (r === "MOD" || r === "MODERATOR") return s.mod;
  return s.member;
}

// ── Relative "last seen" label ────────────────────────────────
function lastSeenLabel(iso?: string): string {
  if (!iso) return "Offline";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 2)   return "Just now";
  if (mins < 60)  return `Last seen ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `Last seen ${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `Last seen ${days}d ago`;
}

// ── Avatar ────────────────────────────────────────────────────
function Avatar34({ name, imageUrl }: { name: string; imageUrl?: string | null }) {
  if (imageUrl) {
    return (
      <div className={s.avatar}>
        <img src={imageUrl} alt={name} className={s.avatarImg} />
      </div>
    );
  }
  return (
    <div className={s.avatar} style={{ background: gradientFor(name) }}>
      {initials(name)}
    </div>
  );
}

// ── Subtitle line ─────────────────────────────────────────────
function Subtitle({
  member,
  typingUser,
  voiceChannelName,
}: {
  member: ServerMember;
  typingUser: string | null;
  voiceChannelName?: string;
}) {
  const isTyping = !!typingUser && typingUser === member.name;

  if (isTyping) {
    return (
      <p className={s.subtitle}>
        <span className={s.typingDots} aria-hidden>
          <span /><span /><span />
        </span>
        Typing…
      </p>
    );
  }

  if (voiceChannelName) {
    return (
      <p className={s.subtitle} title={`In voice · ${voiceChannelName}`}>
        🔊 In voice · {voiceChannelName}
      </p>
    );
  }

  if (!member.isOnline) {
    return <p className={s.subtitle}>{lastSeenLabel(member.lastSeenAt)}</p>;
  }

  if (member.role) {
    return <p className={s.subtitle}>{member.role}</p>;
  }

  return null;
}

// ── Single member row ─────────────────────────────────────────
function MemberRow({
  member,
  typingUser,
  voiceChannelName,
}: {
  member: ServerMember;
  typingUser: string | null;
  voiceChannelName?: string;
}) {
  return (
    <div className={`${s.row} ${member.isOnline ? "" : s.offline}`}>
      <div className={s.avatarWrap}>
        <Avatar34 name={member.name} imageUrl={member.imageUrl} />
        <span
          className={`${s.statusDot} ${member.isOnline ? s.online : s.offline}`}
          title={member.isOnline ? "Online" : "Offline"}
        />
      </div>

      <div className={s.info}>
        <p className={`${s.name} ${nameClass(member.role, member.isOnline)}`}>
          {member.name}
        </p>
        <Subtitle
          member={member}
          typingUser={typingUser}
          voiceChannelName={voiceChannelName}
        />
      </div>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────
function Section({
  label,
  members,
  typingUser,
  voiceMembers,
}: {
  label: string;
  members: ServerMember[];
  typingUser: string | null;
  voiceMembers: Record<string, string>;
}) {
  if (members.length === 0) return null;
  return (
    <div>
      <p className={s.groupLabel}>{label} — {members.length}</p>
      {members.map((m) => (
        <MemberRow
          key={m.id}
          member={m}
          typingUser={typingUser}
          voiceChannelName={voiceMembers[m.id]}
        />
      ))}
    </div>
  );
}

// ── Public component ──────────────────────────────────────────
type Props = {
  members: ServerMember[];
  typingUser: string | null;
  /** userId → voice channel name they're currently in */
  voiceMembers?: Record<string, string>;
};

export function MembersPanel({ members, typingUser, voiceMembers = {} }: Props) {
  const online  = members.filter((m) => m.isOnline);
  const offline = members.filter((m) => !m.isOnline);
  const total   = members.length;

  return (
    <aside className={s.panel}>
      <div className={s.header}>Members — {total}</div>

      <div className={s.list}>
        {total === 0 ? (
          <p style={{ padding: "24px 12px", textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>No members yet</p>
        ) : (
          <>
            <Section
              label="Online"
              members={online}
              typingUser={typingUser}
              voiceMembers={voiceMembers}
            />
            <Section
              label="Offline"
              members={offline}
              typingUser={typingUser}
              voiceMembers={voiceMembers}
            />
          </>
        )}
      </div>
    </aside>
  );
}
