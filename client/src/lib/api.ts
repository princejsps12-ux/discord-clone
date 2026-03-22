import axios from "axios";
import { ui } from "../content/hinglish";

/** In dev, use same origin so Vite proxies `/api` and `/socket.io` to :4000 (avoids CORS / wrong host issues). */
const baseURL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "" : "http://localhost:4000");

export const api = axios.create({
  baseURL,
});

export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    localStorage.setItem("token", token);
  } else {
    delete api.defaults.headers.common.Authorization;
    localStorage.removeItem("token");
  }
};

/** Turns axios/fetch failures into a short message users can act on. */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  const ax = err as {
    response?: { status?: number; data?: { error?: string; detail?: string } };
    code?: string;
    message?: string;
  };
  if (ax.response?.status === 401) {
    return ui.sessionExpired;
  }
  const raw: unknown = ax.response?.data;
  const detail =
    raw && typeof raw === "object" && "detail" in raw ? String((raw as { detail?: unknown }).detail) : undefined;
  const errFromObject =
    raw && typeof raw === "object"
      ? String((raw as { error?: unknown }).error || (raw as { message?: unknown }).message || "").trim()
      : "";
  const errFromString = typeof raw === "string" ? raw.trim() : "";
  const errText = errFromObject || errFromString;
  if (errText) {
    const base = detail && import.meta.env.DEV ? `${errText} (${detail})` : errText;
    return base;
  }
  const st = ax.response?.status;
  if (st === 429) return "Bahut requests — thodi der baad try karo.";
  if (st && st >= 500) return ui.backendHealthFail;
  if (st && st >= 400) return `${fallback} (HTTP ${st})`;
  if (ax.code === "ERR_NETWORK" || ax.message === "Network Error") {
    return ui.backendHealthFail;
  }
  return fallback;
}
