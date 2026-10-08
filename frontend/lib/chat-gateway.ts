import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { backendOrigin } from "./backend";

type Operation = "users" | "contacts" | "contact-add" | "conversations" | "direct-create" | "detail" | "history" | "send";
const operations: Record<Operation, { method: "GET" | "POST"; path: (id?: number) => string; params: readonly string[] }> = {
  users: { method: "GET", path: () => "/v1/users", params: ["query"] },
  contacts: { method: "GET", path: () => "/v1/contacts", params: [] },
  "contact-add": { method: "POST", path: () => "/v1/contacts", params: [] },
  conversations: { method: "GET", path: () => "/v1/conversations", params: ["query", "filter", "cursor"] },
  "direct-create": { method: "POST", path: () => "/v1/conversations/direct", params: [] },
  detail: { method: "GET", path: id => `/v1/conversations/${id}`, params: [] },
  history: { method: "GET", path: id => `/v1/conversations/${id}/messages`, params: ["before_id", "after_id", "limit"] },
  send: { method: "POST", path: id => `/v1/conversations/${id}/messages`, params: [] },
};
const cookieName = "scaler_session";
function reply(value: unknown, status = 200) { return NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } }); }
function error(status: number, code: string, message: string) { return reply({ error: { code, message } }, status); }

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

/** Explicit fixed operations; never accepts a browser-selected upstream path or identity. */
export async function forwardChat(request: Request, operation: Operation, idText?: string) {
  const route = operations[operation];
  const id = idText === undefined ? undefined : Number(idText);
  if (idText !== undefined && (!/^[1-9][0-9]*$/.test(idText) || !Number.isSafeInteger(id))) return error(404, "CONVERSATION_NOT_FOUND", "Conversation not found.");
  const origin = process.env.FRONTEND_ORIGIN ?? "http://127.0.0.1:3000";
  let parsed: URL;
  try { parsed = new URL(origin); }
  catch { return error(503, "CONFIGURATION", "Messaging is not configured."); }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.origin !== origin || parsed.username || parsed.password ||
      (parsed.protocol === "http:" && !["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname))) {
    return error(503, "CONFIGURATION", "Messaging is not configured.");
  }
  if (request.method !== route.method) return error(405, "METHOD", "Method not allowed.");
  if (route.method === "POST" && request.headers.get("origin") !== origin) return error(403, "ORIGIN", "Request origin is not allowed.");
  const key = process.env.INTERNAL_API_KEY ?? "";
  if (key.length < 32) return error(503, "AUTH_UNCONFIGURED", "Authentication is not configured.");
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return error(401, "UNAUTHENTICATED", "Sign in to continue.");
  const url = new URL(route.path(id), backendOrigin());
  const incoming = new URL(request.url);
  for (const name of route.params) {
    const value = incoming.searchParams.get(name);
    if (value !== null && value.length <= 100) url.searchParams.set(name, value);
  }
  const headers = new Headers({ Accept: "application/json", Authorization: `Bearer ${token}`, "X-Internal-API-Key": key });
  let body: string | undefined;
  if (route.method === "POST") {
    if (!request.headers.get("content-type")?.startsWith("application/json")) return error(415, "CONTENT_TYPE", "Use JSON requests.");
    // 4000 Unicode characters can exceed 8 KiB once encoded as JSON.
    try { body = await boundedText(request.body, operation === "send" ? 32768 : 8192); }
    catch { return error(413, "BODY_TOO_LARGE", "Request is too large."); }
    headers.set("Content-Type", "application/json");
    headers.set("Origin", origin);
    headers.set("X-CSRF-Token", (request.headers.get("x-csrf-token") ?? "").slice(0, 128));
  }
  try {
    const upstream = await fetch(url, { method: route.method, headers, body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000) });
    const data: unknown = JSON.parse(await boundedText(upstream.body, 600_000));
    if (typeof data !== "object" || data === null || Array.isArray(data)) throw new Error("Invalid upstream response");
    if (!upstream.ok) {
      const issue = (data as { error?: { code?: unknown; message?: unknown } }).error;
      if (typeof issue?.code !== "string" || typeof issue.message !== "string") throw new Error("Invalid upstream error");
      const response = error(upstream.status, issue.code.slice(0, 64), issue.message.slice(0, 200));
      if (upstream.status === 401) response.cookies.set(cookieName, "", { httpOnly: true, sameSite: "lax", secure: parsed.protocol === "https:", path: "/", maxAge: 0 });
      return response;
    }
    return reply(data, upstream.status);
  } catch {
    return error(503, "BACKEND_UNAVAILABLE", "Messaging service unavailable. Try again shortly.");
  }
}
