import { Hash, LogIn, PlusCircle, Radio } from "lucide-react";
import { emptyState } from "../content/hinglish";

type Props = {
  serverName: string;
  onStartChat: () => void;
  onJoinChannel: () => void;
  onCreateServer: () => void;
};

export function EmptyChatState({ serverName, onStartChat, onJoinChannel, onCreateServer }: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-[#313338] px-8 text-center transition-opacity duration-300">
      <div className="max-w-md rounded-2xl border border-slate-600/60 bg-[#2B2D31]/80 p-10 shadow-xl backdrop-blur-sm">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600/20 text-emerald-400">
          <Hash className="h-8 w-8" strokeWidth={1.5} />
        </div>
        <h2 className="text-xl font-semibold text-white">{emptyState.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">{emptyState.subtitle(serverName)}</p>
        <div className="mt-8 grid gap-3 text-left">
          <button
            type="button"
            onClick={onStartChat}
            className="flex items-center gap-3 rounded-xl border border-slate-600/50 bg-[#1E1F22] px-4 py-3 text-sm text-slate-200 transition hover:border-emerald-500/40 hover:bg-[#25262b]"
          >
            <Radio className="h-5 w-5 shrink-0 text-emerald-400" />
            <span>{emptyState.startChat}</span>
          </button>
          <button
            type="button"
            onClick={onJoinChannel}
            className="flex items-center gap-3 rounded-xl border border-slate-600/50 bg-[#1E1F22] px-4 py-3 text-sm text-slate-200 transition hover:border-emerald-500/40 hover:bg-[#25262b]"
          >
            <LogIn className="h-5 w-5 shrink-0 text-sky-400" />
            <span>{emptyState.joinChannel}</span>
          </button>
          <button
            type="button"
            onClick={onCreateServer}
            className="flex items-center gap-3 rounded-xl border border-slate-600/50 bg-[#1E1F22] px-4 py-3 text-sm text-slate-200 transition hover:border-emerald-500/40 hover:bg-[#25262b]"
          >
            <PlusCircle className="h-5 w-5 shrink-0 text-indigo-400" />
            <span>{emptyState.createServer}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
