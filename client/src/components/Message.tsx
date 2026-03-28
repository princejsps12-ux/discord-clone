import { useState } from "react";
import { format } from "date-fns";
import { Smile, Reply, Pin, Trash2, Star, ExternalLink } from "lucide-react";
import type { Message as MessageType } from "../types";
import type { AppLocale } from "../content/hinglish";
import { st, reactionEmojis } from "../content/hinglish";
import s from "./Message.module.css";

/* ── Receipt indicator ──────────────────────────────────────── */
function receiptLabel(status?: MessageType["receiptStatus"]) {
  if (status === "SEEN") return { text: "✓✓", color: "var(--accent)" };
  if (status === "DELIVERED") return { text: "✓✓", color: "var(--text-3)" };
  return { text: "✓", color: "var(--text-muted)" };
}

/* ── Rich text renderer ─────────────────────────────────────── */
function parseContent(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Split on @mention and `inline code` patterns
  const pattern = /(`[^`\n]+`)|(@\w+)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const chunk = match[0];
    if (chunk.startsWith("`")) {
      nodes.push(
        <code key={match.index} className={s.inlineCode}>
          {chunk.slice(1, -1)}
        </code>,
      );
    } else {
      nodes.push(
        <span key={match.index} className={s.mention}>
          {chunk}
        </span>,
      );
    }
    last = pattern.lastIndex;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/* ── Category badge ─────────────────────────────────────────── */
function CategoryBadge({ cat }: { cat: string }) {
  const cls =
    cat === "STUDY"
      ? s.badgeStudy
      : cat === "PLACEMENT"
        ? s.badgePlacement
        : cat === "CASUAL"
          ? s.badgeCasual
          : s.badgeDefault;
  if (cat === "UNCATEGORIZED") return null;
  return <span className={`${s.badge} ${cls}`}>{cat}</span>;
}

/* ── Avatar placeholder (40px gradient circle) ─────────────── */
function gradientForName(name: string): string {
  const code = (name.charCodeAt(0) || 0) - 65; // A=0, Z=25
  if (code < 5)  return "linear-gradient(135deg,#5b7fff,#a78bfa)"; // A-E
  if (code < 10) return "linear-gradient(135deg,#f59e0b,#ef4444)"; // F-J
  if (code < 15) return "linear-gradient(135deg,#10b981,#3b82f6)"; // K-O
  if (code < 20) return "linear-gradient(135deg,#ec4899,#8b5cf6)"; // P-T
  return          "linear-gradient(135deg,#14b8a6,#f97316)";        // U-Z
}

function Avatar40({ name, imageUrl }: { name: string; imageUrl?: string | null }) {
  const [err, setErr] = useState(false);
  const initials = name.trim().slice(0, 1).toUpperCase() || "?";
  if (imageUrl && !err) {
    return (
      <img
        src={imageUrl}
        alt={name}
        onError={() => setErr(true)}
        style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      />
    );
  }
  return (
    <span
      style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        background: gradientForName(name),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        fontSize: 15,
        fontWeight: 700,
        color: "#fff",
        fontFamily: "var(--font-display)",
      }}
    >
      {initials}
    </span>
  );
}

/* ── Reaction pill ──────────────────────────────────────────── */
type ReactionPillProps = {
  emoji: string;
  count: number;
  active: boolean;
  onClick: () => void;
};

function ReactionPill({ emoji, count, active, onClick }: ReactionPillProps) {
  return (
    <button
      type="button"
      className={`${s.reaction} ${active ? s.reactionActive : ""}`}
      onClick={onClick}
    >
      {emoji}
      {count > 0 && <span className={s.reactionCount}>{count}</span>}
    </button>
  );
}

/* ── Props ──────────────────────────────────────────────────── */
type Props = {
  message: MessageType;
  grouped: boolean;
  isMine: boolean;
  locale: AppLocale;
  bookmarked: boolean;
  currentUserId?: string;
  isNew?: boolean;
  msgIndex?: number;
  onToggleReaction: (emoji: string) => void;
  onToggleBookmark: () => void;
  onTagEdit?: () => void;
  onDelete?: () => void;
};

/* ── Component ──────────────────────────────────────────────── */
export function Message({
  message: m,
  grouped,
  isMine,
  locale,
  bookmarked,
  currentUserId,
  isNew = false,
  msgIndex = 0,
  onToggleReaction,
  onToggleBookmark,
  onTagEdit: _onTagEdit,
  onDelete,
}: Props) {
  const isSahayak = Boolean(m.isSahayakAi);
  const botLike = isSahayak || Boolean(m.isAiAssistant);

  const displayName = isSahayak
    ? st(locale, "sahayakName")
    : m.isAiAssistant
      ? st(locale, "aiAssistant")
      : m.member.user.name;

  const receipt = receiptLabel(m.receiptStatus);
  const timeStr = format(new Date(m.createdAt), "HH:mm");
  const isImageUrl = (url: string) => /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(url);

  const staggerDelay = isNew ? 0 : Math.min(msgIndex, 7) * 0.04;
  const articleClass = [
    s.message,
    grouped ? s.grouped : "",
    isSahayak ? s.sahayak : "",
    isNew ? s.isNew : "",
  ].filter(Boolean).join(" ");

  return (
    <article className={articleClass} style={staggerDelay > 0 ? { animationDelay: `${staggerDelay}s` } : undefined}>
      {/* ── Floating action bar ── */}
      <div className={s.actionBar} role="toolbar" aria-label="Message actions">
        <button type="button" className={s.actionBtn} title="Add reaction" onClick={() => onToggleReaction(reactionEmojis[0])}>
          <Smile size={15} />
        </button>
        <button type="button" className={s.actionBtn} title="Reply">
          <Reply size={15} />
        </button>
        <button type="button" className={s.actionBtn} title="Pin message">
          <Pin size={15} />
        </button>
        {(isMine || onDelete) && (
          <>
            <span className={s.actionSep} aria-hidden />
            <button type="button" className={`${s.actionBtn} ${s.danger}`} title="Delete message" onClick={onDelete}>
              <Trash2 size={15} />
            </button>
          </>
        )}
      </div>

      {/* ── Avatar column ── */}
      <div className={s.avatarCol}>
        {grouped ? (
          <span className={s.groupedTime}>{timeStr}</span>
        ) : (
          <Avatar40
            name={displayName}
            imageUrl={botLike ? undefined : m.member.user.imageUrl}
          />
        )}
      </div>

      {/* ── Body ── */}
      <div className={s.body}>
        {/* Author row — hidden when grouped */}
        {!grouped && (
          <div className={s.authorRow}>
            <span className={s.authorName}>{displayName}</span>

            {isSahayak && (
              <span className={`${s.badge} ${s.badgeAi}`}>{st(locale, "aiBadge")}</span>
            )}

            {m.category && <CategoryBadge cat={m.category} />}

            {m.tags?.map((t) => (
              <span key={t} className={s.tag}>{t}</span>
            ))}

            <span className={s.timestamp}>
              {timeStr}
              {isMine && !botLike && (
                <span
                  className={s.receipt}
                  style={{ color: receipt.color, marginLeft: 4 }}
                >
                  {receipt.text}
                </span>
              )}
            </span>
          </div>
        )}

        {/* Message text */}
        <p className={s.text}>{parseContent(m.content)}</p>

        {/* Attachment */}
        {m.fileUrl && (
          <div className={s.attachment}>
            {isImageUrl(m.fileUrl) && (
              <img src={m.fileUrl} alt="attachment" className={s.attachImage} />
            )}
            <a className={s.attachLink} href={m.fileUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={12} /> Open attachment
            </a>
          </div>
        )}

        {/* Reactions */}
        <div className={s.reactions}>
          {reactionEmojis.map((emoji) => {
            const count = m.reactions?.filter((rx) => rx.emoji === emoji).length ?? 0;
            const active = Boolean(
              m.reactions?.some((rx) => rx.emoji === emoji && rx.member.user.id === currentUserId),
            );
            if (count === 0 && !active) return null;
            return (
              <ReactionPill
                key={emoji}
                emoji={emoji}
                count={count}
                active={active}
                onClick={() => onToggleReaction(emoji)}
              />
            );
          })}

          {/* Add-reaction entry point (always show a + pill) */}
          <button
            type="button"
            className={s.reaction}
            title="Add reaction"
            onClick={() => onToggleReaction(reactionEmojis[0])}
          >
            <Smile size={12} style={{ color: "var(--text-3)" }} />
          </button>

          {/* Bookmark */}
          <button
            type="button"
            className={`${s.bookmarkBtn} ${bookmarked ? s.bookmarkActive : ""}`}
            onClick={onToggleBookmark}
          >
            <Star size={11} />
            {bookmarked ? st(locale, "unsaveMsg") : st(locale, "saveMsg")}
          </button>
        </div>
      </div>
    </article>
  );
}

/* ── Loading skeleton ────────────────────────────────────────── */
export function MessageSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={s.skeleton}>
          <div className={s.skeletonAvatar} />
          <div className={s.skeletonBody}>
            <div className={s.skeletonLine} />
            <div className={s.skeletonLine} />
          </div>
        </div>
      ))}
    </>
  );
}
