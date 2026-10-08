import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { backendOrigin } from "./backend";

const routes = {
  challenge: { path: "/v1/auth/challenges", method: "POST", authenticated: false },
  register: { path: "/v1/auth/register", method: "POST", authenticated: false },
  login: { path: "/v1/auth/login", method: "POST", authenticated: false },
  me: { path: "/v1/auth/me", method: "GET", authenticated: true },
  logout: { path: "/v1/auth/logout", method: "POST", authenticated: true },
  profile: { path: "/v1/users/me", method: "PATCH", authenticated: true },
  ticket: { path: "/v1/auth/ws-ticket", method: "POST", authenticated: true },
} as const;
const cookieName = "scaler_session";

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
function error(status: number, code: string, message: string) {
  return reply({ error: { code, message } }, status);
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function user(value: unknown) {
  if (!object(value) || !Number.isSafeInteger(value.id) || typeof value.username !== "string" ||
      typeof value.display_name !== "string" || typeof value.avatar_key !== "string") throw new Error("Invalid user response");
  return { id: value.id, username: value.username, display_name: value.display_name, avatar_key: value.avatar_key };
}
async function boundedText(stream: ReadableStream<Uint8Array> | null, limit: number): Promise<string> {
  if (!stream) return "";
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let size = 0, result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) return result + decoder.decode();
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new Error("Body limit"); }
    result += decoder.decode(value, { stream: true });
  }
}

/** A fixed operation map, not a user-selectable proxy. Backend owns all auth rules. */
export async function forwardAuth(request: Request, operation: keyof typeof routes) {
  const route = routes[operation];
  let origin: URL;
  try { origin = new URL(process.env.FRONTEND_ORIGIN ?? "http://127.0.0.1:3000"); }
  catch { return error(503, "CONFIGURATION", "Authentication is not configured."); }
  if (!["http:", "https:"].includes(origin.protocol) || origin.origin !== origin.href.replace(/\/$/, "") || origin.username || origin.password) {
    return error(503, "CONFIGURATION", "Authentication is not configured.");
  }
  const secure = origin.protocol === "https:";
  if (!secure && !["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname)) {
    return error(503, "CONFIGURATION", "Authentication requires HTTPS outside local development.");
  }
  if (route.method !== "GET" && request.headers.get("origin") !== origin.origin) {
    return error(403, "ORIGIN", "Request origin is not allowed.");
  }
  const key = process.env.INTERNAL_API_KEY ?? "";
  if (key.length < 32) return error(503, "AUTH_UNCONFIGURED", "Authentication is not configured.");
  const cookieStore = await cookies();
  const session = cookieStore.get(cookieName)?.value;
  if (route.authenticated && (!session || !/^[A-Za-z0-9_-]{43}$/.test(session))) return error(401, "UNAUTHENTICATED", "Sign in to continue.");
  const headers = new Headers({ Accept: "application/json", "X-Internal-API-Key": key });
  if (route.authenticated) headers.set("Authorization", `Bearer ${session}`);
  let body: string | undefined;
  if (route.method !== "GET") {
    if (!request.headers.get("content-type")?.startsWith("application/json")) return error(415, "CONTENT_TYPE", "Use JSON requests.");
    try { body = await boundedText(request.body, 8192); }
    catch { return error(413, "BODY_TOO_LARGE", "Request is too large."); }
    headers.set("Content-Type", "application/json");
    headers.set("Origin", origin.origin);
    if (route.authenticated) headers.set("X-CSRF-Token", (request.headers.get("x-csrf-token") ?? "").slice(0, 128));
  }
  try {
    const upstream = await fetch(new URL(route.path, backendOrigin()), {
      method: route.method, headers, body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000),
    });
    const data: unknown = JSON.parse(await boundedText(upstream.body, 16384));
    if (!object(data)) throw new Error("Invalid upstream response");
    if (!upstream.ok) {
      if (!object(data.error) || typeof data.error.code !== "string" || typeof data.error.message !== "string") throw new Error("Invalid upstream error");
      const response = error(upstream.status, data.error.code.slice(0, 64), data.error.message.slice(0, 200));
      if (route.authenticated && upstream.status === 401) response.cookies.set(cookieName, "", { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 0 });
      return response;
    }
    let publicBody: unknown;
    if (operation === "challenge") {
      if (typeof data.challenge_id !== "string" || typeof data.expires_at !== "number" || typeof data.purpose !== "string") throw new Error("Invalid challenge response");
      publicBody = { challenge_id: data.challenge_id, expires_at: data.expires_at, purpose: data.purpose };
    } else if (operation === "logout") {
      publicBody = { ok: true };
    } else if (operation === "ticket") {
      if (typeof data.ticket !== "string" || typeof data.expires_in !== "number") throw new Error("Invalid ticket response");
      publicBody = { ticket: data.ticket, expires_in: data.expires_in };
    } else if (operation === "profile") {
      publicBody = { user: user(data.user) };
    } else {
      if (typeof data.csrf_token !== "string" || typeof data.expires_at !== "number") throw new Error("Invalid session response");
      publicBody = { user: user(data.user), csrf_token: data.csrf_token, expires_at: data.expires_at };
    }
    const response = reply(publicBody, upstream.status);
    if (operation === "login" || operation === "register") {
      if (typeof data.session_token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(data.session_token) || typeof data.expires_at !== "number") throw new Error("Invalid credential");
      response.cookies.set(cookieName, data.session_token, {
        httpOnly: true, sameSite: "lax", secure, path: "/", expires: new Date(data.expires_at),
      });
    }
    if (operation === "logout") response.cookies.set(cookieName, "", { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 0 });
    return response;
  } catch {
    return error(503, "BACKEND_UNAVAILABLE", "Authentication service unavailable. Try again shortly.");
  }
}
