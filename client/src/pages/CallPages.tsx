import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, setAuthToken } from "../lib/api";
import { Copy, Phone } from "lucide-react";
import { callPages } from "../content/hinglish";

export function JoinCallPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const serverId = params.get("serverId") || "";
  const channelId = params.get("channelId") || "";
  const link = typeof window !== "undefined" ? window.location.href : "";

  const go = () => {
    navigate("/", { state: { serverId: serverId || undefined, channelId: channelId || undefined } });
  };

  return (
    <main className="page-fullscreen-safe flex flex-col items-center justify-center bg-[#111214] text-white">
      <div className="page-fullscreen-safe__card rounded-2xl border border-slate-700 bg-[#2B2D31] p-6 text-center sm:p-8">
        <Phone className="mx-auto h-12 w-12 text-emerald-400 mb-4" />
        <h1 className="text-xl font-semibold">{callPages.joinTitle}</h1>
        <p className="mt-2 text-sm text-slate-400">{callPages.joinSub}</p>
        {(serverId || channelId) && (
          <p className="mt-4 text-xs text-slate-500 break-all">
            Server: {serverId || "—"} · Channel: {channelId || "—"}
          </p>
        )}
        <button type="button" className="btn mt-6 w-full" onClick={go}>
          {callPages.openApp}
        </button>
        <button
          type="button"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-600 py-2 text-sm text-slate-300 hover:bg-[#35373c]"
          onClick={() => navigator.clipboard.writeText(link)}
        >
          <Copy className="h-4 w-4" /> {callPages.copyLink}
        </button>
      </div>
    </main>
  );
}

type ScheduledRow = {
  id: string;
  title: string | null;
  scheduledAt: string;
  callLink: string;
  isVideo: boolean;
  serverId: string;
  channelId: string | null;
  server: { id: string; name: string };
  channel: { id: string; name: string; type: string } | null;
};

export function ScheduledCallPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [row, setRow] = useState<ScheduledRow | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setErr(callPages.loginFirst);
      return;
    }
    setAuthToken(token);
    if (!id) return;
    api
      .get(`/api/scheduled-calls/${id}`)
      .then((res) => setRow(res.data))
      .catch(() => setErr(callPages.loadFail));
  }, [id]);

  if (err) {
    return (
      <main className="page-fullscreen-safe flex items-center justify-center bg-[#111214] text-white">
        <p className="text-slate-400">{err}</p>
      </main>
    );
  }

  if (!row) {
    return (
      <main className="page-fullscreen-safe flex items-center justify-center bg-[#111214] text-white">
        <p className="text-slate-400">{callPages.loading}</p>
      </main>
    );
  }

  const when = new Date(row.scheduledAt);

  return (
    <main className="page-fullscreen-safe flex flex-col items-center justify-center bg-[#111214] text-white">
      <div className="page-fullscreen-safe__card rounded-2xl border border-slate-700 bg-[#2B2D31] p-6 sm:p-8">
        <h1 className="text-xl font-semibold">{row.title || callPages.defaultCallTitle}</h1>
        <p className="mt-2 text-slate-400 text-sm">
          {row.server.name}
          {row.channel ? ` · #${row.channel.name}` : ""}
        </p>
        <p className="mt-4 text-sm text-slate-300">
          {when.toLocaleString()} {row.isVideo ? "(video)" : "(voice)"}
        </p>
        <button
          type="button"
          className="btn mt-6 w-full"
          onClick={() =>
            navigate("/", {
              state: {
                serverId: row.serverId,
                channelId: row.channelId || undefined,
              },
            })
          }
        >
          {callPages.openApp}
        </button>
        <button
          type="button"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-600 py-2 text-sm text-slate-300 hover:bg-[#35373c]"
          onClick={() => navigator.clipboard.writeText(row.callLink)}
        >
          <Copy className="h-4 w-4" /> {callPages.copyCallLink}
        </button>
      </div>
    </main>
  );
}
