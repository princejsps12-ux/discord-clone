import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { api } from "../lib/api";
import type { ChannelRow, Message, MessageCategory, ServerMember } from "../types";
import { searchModal, st, type AppLocale } from "../content/hinglish";

type Props = {
  open: boolean;
  onClose: () => void;
  serverId: string;
  locale?: AppLocale;
  onPickChannel: (channelId: string) => void;
  onPickMessage: (channelId: string) => void;
};

type SearchResult = {
  messages: (Message & { channel: { id: string; name: string; serverId: string } })[];
  channels: (ChannelRow & { server: { id: string; name: string } })[];
  users: (ServerMember & { serverId: string; serverName: string })[];
};

const CATS: (MessageCategory | "")[] = ["", "STUDY", "PLACEMENT", "CASUAL", "UNCATEGORIZED"];

export function GlobalSearchModal({ open, onClose, serverId, locale = "hinglish", onPickChannel, onPickMessage }: Props) {
  const [q, setQ] = useState("");
  const [searchCategory, setSearchCategory] = useState<MessageCategory | "">("");
  const [searchTag, setSearchTag] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SearchResult | null>(null);

  useEffect(() => {
    if (!open) {
      setQ("");
      setSearchCategory("");
      setSearchTag("");
      setData(null);
      return;
    }
    if (!serverId) {
      setData({ messages: [], channels: [], users: [] });
      return;
    }
    const t = setTimeout(() => {
      const qt = q.trim();
      const tt = searchTag.trim();
      if (!qt && !tt && !searchCategory) {
        setData({ messages: [], channels: [], users: [] });
        return;
      }
      setLoading(true);
      api
        .get("/api/search", {
          params: {
            ...(qt ? { q: qt } : {}),
            serverId,
            ...(searchCategory ? { category: searchCategory } : {}),
            ...(tt ? { tag: tt } : {}),
          },
        })
        .then((res) => setData(res.data))
        .catch(() => setData({ messages: [], channels: [], users: [] }))
        .finally(() => setLoading(false));
    }, 280);
    return () => clearTimeout(t);
  }, [q, open, serverId, searchCategory, searchTag]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-16 px-4" role="dialog">
      <div className="w-full max-w-lg rounded-xl border border-slate-600 bg-[#2B2D31] shadow-2xl">
        <div className="border-b border-slate-600 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <input
              autoFocus
              className="input flex-1 border-0 bg-[#1E1F22]"
              placeholder={searchModal.placeholder}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button type="button" className="rounded p-2 text-slate-400 hover:bg-[#35373c] hover:text-white" onClick={onClose}>
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <label className="flex items-center gap-1 text-slate-400">
              <span>{st(locale, "searchCat")}</span>
              <select
                className="rounded bg-[#1E1F22] border border-slate-600 px-2 py-1 text-slate-200"
                value={searchCategory}
                onChange={(e) => setSearchCategory(e.target.value as MessageCategory | "")}
              >
                {CATS.map((c) => (
                  <option key={c || "all"} value={c}>
                    {c || "—"}
                  </option>
                ))}
              </select>
            </label>
            <input
              className="input flex-1 min-w-[120px] h-8 text-xs border-slate-600 bg-[#1E1F22]"
              placeholder={st(locale, "searchTag")}
              value={searchTag}
              onChange={(e) => setSearchTag(e.target.value)}
            />
          </div>
        </div>
        <div className="max-h-[min(60vh,420px)] overflow-y-auto p-2 text-sm">
          {loading && <p className="px-2 py-4 text-slate-400">{searchModal.searching}</p>}
          {!loading && data && (
            <>
              {data.channels.length > 0 && (
                <section className="mb-3">
                  <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-slate-500">{searchModal.channels}</p>
                  <ul className="space-y-1">
                    {data.channels.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className="w-full rounded-lg px-3 py-2 text-left text-slate-200 hover:bg-[#35373c]"
                          onClick={() => {
                            onPickChannel(c.id);
                            onClose();
                          }}
                        >
                          # {c.name}
                          <span className="ml-2 text-xs text-slate-500">{c.server?.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {data.users.length > 0 && (
                <section className="mb-3">
                  <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-slate-500">{searchModal.people}</p>
                  <ul className="space-y-1">
                    {data.users.map((u) => (
                      <li key={`${u.id}-${u.serverId}`} className="rounded-lg px-3 py-2 text-slate-300">
                        <span className="font-medium text-white">{u.name}</span>
                        <span className="ml-2 text-xs text-slate-500">{u.serverName}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {data.messages.length > 0 && (
                <section>
                  <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-slate-500">{searchModal.messages}</p>
                  <ul className="space-y-1">
                    {data.messages.map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          className="w-full rounded-lg px-3 py-2 text-left hover:bg-[#35373c]"
                          onClick={() => {
                            onPickMessage(m.channel.id);
                            onClose();
                          }}
                        >
                          <span className="text-xs text-emerald-400/90">#{m.channel.name}</span>
                          <p className="line-clamp-2 text-slate-200">{m.content}</p>
                          <p className="text-xs text-slate-500">{m.member.user.name}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {!loading &&
                (q.trim() || searchTag.trim() || searchCategory) &&
                data.channels.length === 0 &&
                data.messages.length === 0 &&
                data.users.length === 0 && (
                  <p className="px-2 py-6 text-center text-slate-500">{searchModal.noResults}</p>
                )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
