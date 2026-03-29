import { Hash, LogIn, PlusCircle, Radio } from "lucide-react";
import { emptyState } from "../content/hinglish";
import s from "./EmptyChatState.module.css";

type Props = {
  serverName: string;
  onStartChat: () => void;
  onJoinChannel: () => void;
  onCreateServer: () => void;
};

export function EmptyChatState({ serverName, onStartChat, onJoinChannel, onCreateServer }: Props) {
  return (
    <div className={s.wrap}>
      <div className={s.orbCyan} aria-hidden />
      <div className={s.orbMagenta} aria-hidden />
      <div className={s.orbViolet} aria-hidden />

      <div className={s.card}>
        <div className={s.iconRing}>
          <Hash className="h-9 w-9" strokeWidth={1.5} />
        </div>
        <h2 className={s.title}>{emptyState.title}</h2>
        <p className={s.subtitle}>{emptyState.subtitle(serverName)}</p>

        <div className={s.actions}>
          <button type="button" className={`${s.cta} ${s.ctaCyan}`} onClick={onStartChat}>
            <span className={s.ctaIcon}>
              <Radio className="h-5 w-5" strokeWidth={2} />
            </span>
            <span>{emptyState.startChat}</span>
          </button>
          <button type="button" className={`${s.cta} ${s.ctaMagenta}`} onClick={onJoinChannel}>
            <span className={s.ctaIcon}>
              <LogIn className="h-5 w-5" strokeWidth={2} />
            </span>
            <span>{emptyState.joinChannel}</span>
          </button>
          <button type="button" className={`${s.cta} ${s.ctaViolet}`} onClick={onCreateServer}>
            <span className={s.ctaIcon}>
              <PlusCircle className="h-5 w-5" strokeWidth={2} />
            </span>
            <span>{emptyState.createServer}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
