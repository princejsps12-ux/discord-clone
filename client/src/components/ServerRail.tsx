import { useState } from "react";
import type { Server, User } from "../types";
import { avatarFromName } from "../content/hinglish";
import s from "./ServerRail.module.css";

type Props = {
  servers: Server[];
  activeServerId: string;
  currentUser: User | null;
  onSelectServer: (serverId: string) => void;
  onAddServer: () => void;
  onJoinServer?: () => void;
};

function ServerIcon({ server, active, onSelect }: { server: Server; active: boolean; onSelect: () => void }) {
  const [imgErr, setImgErr] = useState(false);
  const initials = server.name.trim().slice(0, 2).toUpperCase() || "??";
  const imageUrl = (server as Server & { imageUrl?: string }).imageUrl;
  const showImg = imageUrl && !imgErr;

  return (
    <div className={`${s.item} ${active ? s.active : ""}`}>
      <span className={s.pill} aria-hidden />
      <button
        type="button"
        className={s.icon}
        onClick={onSelect}
        aria-label={server.name}
        aria-pressed={active}
      >
        {showImg ? (
          <img src={imageUrl} alt="" onError={() => setImgErr(true)} />
        ) : (
          initials
        )}
      </button>
      <span className={s.tooltip} aria-hidden>{server.name}</span>
    </div>
  );
}

function UserFooter({ user }: { user: User }) {
  const [imgErr, setImgErr] = useState(false);
  const imageUrl = user.imageUrl || avatarFromName(user.name, null);
  const showImg = imageUrl && !imgErr;
  const initials = user.name.trim().slice(0, 1).toUpperCase() || "?";

  return (
    <footer className={s.footer}>
      <div className={s.avatarWrap} title={user.name}>
        {showImg ? (
          <img
            src={imageUrl}
            alt={user.name}
            className={s.avatar}
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className={s.avatarInitials}>{initials}</div>
        )}
        <span className={`${s.statusDot} ${user.isOnline ? s.online : s.offline}`} aria-hidden />
      </div>
    </footer>
  );
}

export function ServerRail({ servers, activeServerId, currentUser, onSelectServer, onAddServer, onJoinServer }: Props) {
  return (
    <nav className={s.rail} aria-label="Servers">
      {/* Logo */}
      <div className={s.logo} aria-label="College Connect">CC</div>

      <div className={s.divider} />

      {/* Server list */}
      <div className={s.list} role="list">
        {servers.map((sv) => (
          <ServerIcon
            key={sv.id}
            server={sv}
            active={sv.id === activeServerId}
            onSelect={() => onSelectServer(sv.id)}
          />
        ))}

        {/* Add server */}
        <div className={s.addWrap}>
          <span className={s.pill} aria-hidden />
          <button
            type="button"
            className={s.addBtn}
            onClick={onAddServer}
            aria-label="Add a server"
          >
            +
          </button>
          <span className={s.tooltip} aria-hidden>Create a server</span>
        </div>

        {/* Join server via invite */}
        {onJoinServer && (
          <div className={s.addWrap}>
            <span className={s.pill} aria-hidden />
            <button
              type="button"
              className={s.addBtn}
              onClick={onJoinServer}
              aria-label="Join a server"
              style={{ fontSize: 13, fontFamily: "var(--font-display)" }}
            >
              ↗
            </button>
            <span className={s.tooltip} aria-hidden>Join with invite</span>
          </div>
        )}
      </div>

      {/* Current user */}
      {currentUser && <UserFooter user={currentUser} />}
    </nav>
  );
}
