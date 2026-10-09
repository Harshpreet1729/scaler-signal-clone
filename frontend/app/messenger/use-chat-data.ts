"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, Conversation, MessengerData, Person, Profile, ReceiptState } from "./types";

export type ApiUser = Profile & { role?: "admin" | "member" };
export type ApiMessage = { id: number; conversation_id: number; sender_id: number; client_message_id: string; body: string; created_at: number; status: "sending" | "failed" | "sent" | "delivered" | "read"; recipient_ids?: number[]; delivered_ids?: number[]; read_ids?: number[] };
export type ApiConversation = { id: number; kind: "direct" | "group"; name: string; avatar_key: string; members: ApiUser[]; last_activity_at: number; version: number; preview: ApiMessage | null; unread_count: number };
type SocketFrame = { v: number; type: string; request_id?: string; conversation_id?: number; payload?: { message?: ApiMessage; code?: string; detail?: string; user_id?: number; user_ids?: number[]; expires_in_ms?: number } };
type Pending = { clientId: string; body: string };

export class ChatError extends Error {
  constructor(message: string, readonly code: string) { super(message); }
}

export async function chatApi<T>(path: string, csrf?: string, body?: unknown, method?: "PATCH" | "DELETE"): Promise<T> {
  const response = await fetch(path, { method: method ?? (body === undefined ? "GET" : "POST"), credentials: "same-origin", cache: "no-store",
    headers: body === undefined ? undefined : { "Content-Type": "application/json", "X-CSRF-Token": csrf ?? "" },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new ChatError(data.error?.message ?? "Request failed. Try again.", data.error?.code ?? "REQUEST");
  return data as T;
}

function clock(value: number) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function day(value: number) {
  const date = new Date(value), now = new Date();
  if (date.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  return date.toDateString() === yesterday.toDateString() ? "Yesterday" : date.toLocaleDateString();
}
function previewTime(value: number) {
  if (!value) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - value) / 60000));
  if (minutes < 60) return minutes < 1 ? "now" : `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return day(value) === "Yesterday" ? "Yesterday" : new Date(value).toLocaleDateString();
}
function color(id: number) { return ["#34725a", "#8155b9", "#946224", "#ba4f4f"][id % 4]; }
function merge(existing: ApiMessage[], incoming: ApiMessage): ApiMessage[] {
  const previous = existing.find(item => item.id === incoming.id || item.client_message_id === incoming.client_message_id);
  if (previous && previous.id > 0 && incoming.id < 0) return existing;
  if (previous && previous.id > 0) {
    const rank = { failed: 0, sending: 0, sent: 1, delivered: 2, read: 3 };
    incoming = { ...incoming, status: rank[previous.status] > rank[incoming.status] ? previous.status : incoming.status,
      delivered_ids: [...new Set([...(previous.delivered_ids ?? []), ...(incoming.delivered_ids ?? [])])],
      read_ids: [...new Set([...(previous.read_ids ?? []), ...(incoming.read_ids ?? [])])] };
  }
  return [...existing.filter(item => item.id !== incoming.id && item.client_message_id !== incoming.client_message_id), incoming]
    .sort((a, b) => (a.id < 0 ? Number.MAX_SAFE_INTEGER : a.id) - (b.id < 0 ? Number.MAX_SAFE_INTEGER : b.id));
}

export function useChatData(profile: Profile, csrf: string, query: string, unreadOnly: boolean, selectedId: string | null) {
  const [conversations, setConversations] = useState<ApiConversation[]>([]);
  const [contacts, setContacts] = useState<ApiUser[]>([]);
  const [messages, setMessages] = useState<Record<string, ApiMessage[]>>({});
  const [older, setOlder] = useState<Record<string, number | null>>({});
  const [status, setStatus] = useState<"connecting" | "connected" | "reconnecting" | "offline">("connecting");
  const [problem, setProblem] = useState("");
  const [typing, setTypingState] = useState<Record<string, { ids: number[]; until: number }>>({});
  const [incoming, setIncoming] = useState<{ id: number; text: string } | null>(null);
  const seenMessages = useRef(new Set<number>());
  const conversationRef = useRef<ApiConversation[]>([]);
  const typingSent = useRef(new Map<string, number>());
  const socket = useRef<WebSocket | null>(null);
  const pending = useRef<Map<string, Pending>>(new Map());
  const awaits = useRef<Map<string, { resolve: (message: ApiMessage) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>>(new Map());
  const loadedFloor = useRef<Record<string, number>>({});
  const revoked = useRef(new Set<string>());
  const ackInFlight = useRef(new Set<string>());
  const listSequence = useRef(0);
  const selectedRef = useRef(selectedId);
  const listRef = useRef<() => Promise<void>>(async () => {});
  const historyRef = useRef<() => Promise<void>>(async () => {});

  const refreshList = useCallback(async () => {
    const sequence = ++listSequence.current;
    const rows: ApiConversation[] = [];
    let cursor: string | null = null;
    do {
      const page: { conversations: ApiConversation[]; next_cursor: string | null } = await chatApi(`/api/conversations${cursor ? "?cursor=" + encodeURIComponent(cursor) : ""}`);
      rows.push(...page.conversations); cursor = page.next_cursor;
    } while (cursor);
    if (sequence !== listSequence.current) return;
    for (const row of rows) revoked.current.delete(String(row.id));
    rows.forEach(row => { if (row.preview) seenMessages.current.add(row.preview.id); });
    setConversations(rows);
  }, []);
  const acknowledge = useCallback(async (id: string, ids: number[], read: boolean) => {
    const eligible = ids.filter(value => !ackInFlight.current.has(`${id}:${read}:${value}`));
    if (!eligible.length || revoked.current.has(id)) return;
    eligible.forEach(value => ackInFlight.current.add(`${id}:${read}:${value}`));
    try {
      for (let offset = 0; offset < eligible.length; offset += 100) {
        const batch = eligible.slice(offset, offset + 100);
        const value = await chatApi<{ messages: ApiMessage[] }>(`/api/conversations/${id}/${read ? "read" : "delivered"}`, csrf, { message_ids: batch });
        if (revoked.current.has(id)) return;
        setMessages(current => ({ ...current, [id]: value.messages.reduce((list, item) => merge(list, item), current[id] ?? []).map(item => batch.includes(item.id) ? {
          ...item, delivered_ids: [...new Set([...(item.delivered_ids ?? []), profile.id])],
          read_ids: read ? [...new Set([...(item.read_ids ?? []), profile.id])] : item.read_ids,
        } : item) }));
      }
      await listRef.current();
    } catch (error) {
      if (!(error instanceof ChatError && error.code === "CONVERSATION_NOT_FOUND")) setProblem(error instanceof Error ? error.message : "Acknowledgment failed.");
    } finally { eligible.forEach(value => ackInFlight.current.delete(`${id}:${read}:${value}`)); }
  }, [csrf, profile.id]);
  const refreshContacts = useCallback(async () => {
    const data = await chatApi<{ contacts: ApiUser[] }>("/api/contacts");
    setContacts(data.contacts);
  }, []);
  const loadHistory = useCallback(async (conversationId: string, before?: number) => {
    const suffix = before ? `?before_id=${before}&limit=50` : "?limit=50";
    const data = await chatApi<{ messages: ApiMessage[]; next_before_id: number | null }>(`/api/conversations/${conversationId}/messages${suffix}`);
    // Repair all previously loaded rows, including older receipt updates and >50 missed messages.
    const floor = loadedFloor.current[conversationId];
    while (!before && floor && data.next_before_id && data.messages[0]?.id > floor) {
      const page = await chatApi<{ messages: ApiMessage[]; next_before_id: number | null }>(`/api/conversations/${conversationId}/messages?before_id=${data.next_before_id}&limit=50`);
      data.messages.unshift(...page.messages); data.next_before_id = page.next_before_id;
    }
    if (revoked.current.has(conversationId)) return;
    if (data.messages.length) loadedFloor.current[conversationId] = Math.min(floor ?? Infinity, data.messages[0].id);
    data.messages.forEach(item => seenMessages.current.add(item.id));
    void acknowledge(conversationId, data.messages.filter(item => item.recipient_ids?.includes(profile.id) && !item.delivered_ids?.includes(profile.id)).map(item => item.id), false);
    // A REST snapshot may predate a live event; keep newer/pending rows and deduplicate both.
    setMessages(current => ({ ...current, [conversationId]: data.messages.reduce((list, item) => merge(list, item), current[conversationId] ?? []) }));
    setOlder(current => ({ ...current, [conversationId]: data.next_before_id }));
  }, [acknowledge, profile.id]);
  const refreshSelected = useCallback(async () => {
    const id = selectedRef.current;
    if (!id || revoked.current.has(id)) return;
    try { await loadHistory(id); }
    catch (error) {
      if (!(error instanceof ChatError && error.code === "CONVERSATION_NOT_FOUND")) throw error;
      revoked.current.add(id);
      setMessages(current => { const next = { ...current }; delete next[id]; return next; });
      await listRef.current();
    }
  }, [loadHistory]);
  useEffect(() => { selectedRef.current = selectedId; }, [selectedId]);
  useEffect(() => { conversationRef.current = conversations; }, [conversations]);
  useEffect(() => {
    if (!incoming) return;
    const timer = setTimeout(() => setIncoming(null), 6000);
    return () => clearTimeout(timer);
  }, [incoming]);
  const setTyping = useCallback((id: string, value: boolean) => {
    const previous = typingSent.current.get(id);
    if ((value && previous && Date.now() - previous < 2000) || (!value && !previous)) return;
    const live = socket.current;
    if (live?.readyState !== WebSocket.OPEN) return;
    if (value) typingSent.current.set(id, Date.now()); else typingSent.current.delete(id);
    live.send(JSON.stringify({ v: 1, type: "typing.set", conversation_id: Number(id), payload: { typing: value } }));
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setTypingState(current => {
      if (!Object.values(current).some(item => item.until <= Date.now())) return current;
      return Object.fromEntries(Object.entries(current).filter(([, item]) => item.until > Date.now()));
    }), 500);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => { listRef.current = refreshList; historyRef.current = refreshSelected; }, [refreshList, refreshSelected]);
  useEffect(() => { void refreshList().catch(error => setProblem(error.message)); }, [refreshList]);
  useEffect(() => { void refreshContacts().catch(error => setProblem(error.message)); }, [refreshContacts]);
  useEffect(() => { if (selectedId && !revoked.current.has(selectedId)) void loadHistory(selectedId).catch(error => setProblem(error.message)); }, [selectedId, loadHistory]);

  useEffect(() => {
    let active = true, attempts = 0;
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    const heartbeat = setInterval(() => { if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify({ v: 1, type: "ping" })); }, 20_000);
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? "ws://127.0.0.1:8000/v1/ws";
    function rejectAwaiting() {
      for (const waiter of awaits.current.values()) { clearTimeout(waiter.timer); waiter.reject(new Error("Connection interrupted.")); }
      awaits.current.clear();
    }
    function schedule() {
      if (!active || reconnect) return;
      setStatus(navigator.onLine ? "reconnecting" : "offline");
      const delay = Math.min(30_000, 500 * 2 ** Math.min(attempts++, 6));
      reconnect = setTimeout(() => { reconnect = undefined; void connect(); }, delay);
    }
    async function connect() {
      if (!active || socket.current?.readyState === WebSocket.OPEN || socket.current?.readyState === WebSocket.CONNECTING) return;
      if (!/^wss?:\/\//.test(wsUrl) || (location.protocol === "https:" && !wsUrl.startsWith("wss://"))) {
        setProblem("Configure a secure public WebSocket URL for this frontend."); setStatus("offline"); return;
      }
      try {
        const ticket = await chatApi<{ ticket: string }>("/api/auth/ws-ticket", csrf, {});
        if (!active) return;
        const current = new WebSocket(wsUrl);
        socket.current = current;
        current.onopen = () => current.send(JSON.stringify({ v: 1, type: "auth", payload: { ticket: ticket.ticket } }));
        current.onmessage = event => {
          let frame: SocketFrame;
          try { frame = JSON.parse(event.data) as SocketFrame; } catch { return; }
          if (frame.v !== 1) return;
          if (frame.type === "ready") {
            setTypingState({}); typingSent.current.clear();
            attempts = 0; setStatus("connected"); setProblem("");
            void Promise.all([listRef.current(), historyRef.current()]).catch(error => setProblem(error.message));
            return;
          }
          if ((frame.type === "message.created" || frame.type === "receipt.updated") && frame.payload?.message) {
            const item = frame.payload.message;
            const key = String(item.conversation_id);
            if (revoked.current.has(key)) return;
            loadedFloor.current[key] = Math.min(loadedFloor.current[key] ?? Infinity, item.id);
            if (frame.type === "message.created") {
              if (!seenMessages.current.has(item.id) && item.sender_id !== profile.id && selectedRef.current !== key) {
                const source = conversationRef.current.find(row => row.id === item.conversation_id);
                const sender = source?.members.find(user => user.id === item.sender_id)?.display_name ?? "New message";
                setIncoming({ id: item.id, text: `${sender}: ${item.body.slice(0, 120)}` });
              }
              seenMessages.current.add(item.id);
            }
            if (frame.type === "message.created" && item.recipient_ids?.includes(profile.id) && !item.delivered_ids?.includes(profile.id)) void acknowledge(key, [item.id], false);
            setMessages(current => ({ ...current, [key]: merge(current[key] ?? [], item) }));
            void listRef.current().catch(error => setProblem(error.message));
            return;
          }
          if (frame.type === "typing.changed" && frame.conversation_id && frame.payload?.user_ids) {
            const key = String(frame.conversation_id);
            if (!revoked.current.has(key)) setTypingState(current => ({ ...current, [key]: { ids: frame.payload!.user_ids!.filter(id => id !== profile.id), until: Date.now() + 5000 } }));
            return;
          }
          if (frame.type === "membership.removed" && frame.conversation_id) {
            const id = String(frame.conversation_id);
            revoked.current.add(id); listSequence.current++;
            setTypingState(current => { const next = { ...current }; delete next[id]; return next; });
            setMessages(current => { const next = { ...current }; delete next[id]; return next; });
            setConversations(current => current.filter(item => item.id !== frame.conversation_id));
            void listRef.current().catch(error => setProblem(error.message)); return;
          }
          if (frame.type === "conversation.updated") { void listRef.current().catch(error => setProblem(error.message)); return; }
          if (frame.type === "ping") { current.send(JSON.stringify({ v: 1, type: "pong" })); return; }
          if (frame.request_id) {
            const waiting = awaits.current.get(frame.request_id);
            if (waiting) {
              clearTimeout(waiting.timer); awaits.current.delete(frame.request_id);
              if (frame.type === "message.accepted" && frame.payload?.message) waiting.resolve(frame.payload.message);
              else if (frame.type === "error") waiting.reject(new ChatError(frame.payload?.detail ?? frame.payload?.code ?? "Send failed.", frame.payload?.code ?? "SOCKET"));
            }
          }
        };
        current.onclose = () => { setTypingState({}); typingSent.current.clear(); if (socket.current === current) socket.current = null; rejectAwaiting(); schedule(); };
        current.onerror = () => { /* onclose drives retry; no credential or body logging */ };
      } catch (error) {
        if (error instanceof ChatError && error.code === "UNAUTHENTICATED") { setStatus("offline"); setProblem("Your session ended. Sign in again."); return; }
        schedule();
      }
    }
    const resume = () => {
      if (!active || document.visibilityState === "hidden") return;
      void Promise.all([listRef.current(), historyRef.current()]).catch(error => setProblem(error.message));
      if (!socket.current || socket.current.readyState === WebSocket.CLOSED) {
        if (reconnect) clearTimeout(reconnect);
        reconnect = undefined; void connect();
      }
    };
    const repair = setInterval(resume, 30_000);
    window.addEventListener("online", resume);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    void connect();
    return () => {
      active = false; clearInterval(repair);
      if (reconnect) clearTimeout(reconnect);
      if (heartbeat) clearInterval(heartbeat);
      window.removeEventListener("online", resume); window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
      socket.current?.close(); socket.current = null; rejectAwaiting();
    };
  }, [profile.id, csrf, acknowledge]);

  const send = useCallback(async (conversationId: string, body: string) => {
    const trimmed = body.trim();
    if (!trimmed || trimmed.length > 4000) throw new Error("Enter 1–4000 nonblank characters.");
    const old = pending.current.get(conversationId);
    const clientId = old?.body === body ? old.clientId : crypto.randomUUID();
    pending.current.set(conversationId, { clientId, body });
    const key = String(conversationId);
    const provisional: ApiMessage = { id: -Date.now(), conversation_id: Number(conversationId), sender_id: profile.id,
      client_message_id: clientId, body, created_at: Date.now(), status: "sending" };
    setMessages(current => ({ ...current, [key]: merge(current[key] ?? [], provisional) }));
    try {
      let saved: ApiMessage;
      const live = socket.current;
      if (live?.readyState === WebSocket.OPEN) {
        const requestId = crypto.randomUUID();
        try {
          saved = await new Promise<ApiMessage>((resolve, reject) => {
            const timer = setTimeout(() => { awaits.current.delete(requestId); reject(new Error("Socket acknowledgment timed out.")); }, 7000);
            awaits.current.set(requestId, { resolve, reject, timer });
            live.send(JSON.stringify({ v: 1, type: "message.send", request_id: requestId,
              conversation_id: Number(conversationId), payload: { client_message_id: clientId, body } }));
          });
        } catch {
          saved = (await chatApi<{ message: ApiMessage }>(`/api/conversations/${conversationId}/messages`, csrf,
            { client_message_id: clientId, body })).message;
        }
      } else {
        saved = (await chatApi<{ message: ApiMessage }>(`/api/conversations/${conversationId}/messages`, csrf,
          { client_message_id: clientId, body })).message;
      }
      setMessages(current => ({ ...current, [key]: merge(current[key] ?? [], saved) }));
      loadedFloor.current[key] = Math.min(loadedFloor.current[key] ?? Infinity, saved.id);
      pending.current.delete(conversationId);
      void listRef.current().catch(error => setProblem(error.message));
    } catch (error) {
      setMessages(current => ({ ...current, [key]: (current[key] ?? []).map(item => item.client_message_id === clientId && item.id < 0 ? { ...item, status: "failed" } : item) }));
      throw error;
    }
  }, [csrf, profile.id]);

  const directory = useCallback(async (term: string) => (await chatApi<{ users: ApiUser[] }>(`/api/users?query=${encodeURIComponent(term.slice(0, 64))}`)).users, []);
  const addContact = useCallback(async (userId: number) => {
    await chatApi("/api/contacts", csrf, { user_id: userId });
    await refreshContacts();
  }, [csrf, refreshContacts]);
  const startDirect = useCallback(async (userId: number) => {
    const value = await chatApi<{ conversation: ApiConversation }>("/api/conversations/direct", csrf, { user_id: userId });
    setConversations(current => [value.conversation, ...current.filter(item => item.id !== value.conversation.id)]);
    return String(value.conversation.id);
  }, [csrf]);
  const createGroup = useCallback(async (name: string, userIds: number[]) => {
    const value = await chatApi<{ conversation: ApiConversation }>("/api/conversations/groups", csrf, { name, user_ids: userIds });
    await refreshList(); return String(value.conversation.id);
  }, [csrf, refreshList]);
  const changeGroup = useCallback(async (id: string, action: "rename" | "add" | "remove", value: string | number[]) => {
    const path = `/api/conversations/${id}`;
    if (action === "rename") await chatApi(path, csrf, { name: value }, "PATCH");
    else if (action === "add") await chatApi(path + "/members", csrf, { user_ids: value });
    else await chatApi(path + "/members/" + value, csrf, {}, "DELETE");
    await refreshList();
  }, [csrf, refreshList]);
  const loadOlder = useCallback(async (conversationId: string) => {
    const before = older[conversationId];
    if (before) await loadHistory(conversationId, before);
  }, [older, loadHistory]);

  const data = useMemo<MessengerData>(() => {
    const people: Record<string, Person> = { [profile.id]: { id: String(profile.id), name: profile.display_name, username: profile.username, avatar: profile.avatar_key, color: color(profile.id) } };
    for (const user of [...contacts, ...conversations.flatMap(item => item.members)]) {
      people[user.id] = { id: String(user.id), name: user.display_name, username: user.username, avatar: user.avatar_key, color: color(user.id) };
    }
    const rows: Conversation[] = conversations.map(item => ({ id: String(item.id), name: item.name, kind: item.kind, avatar: item.avatar_key,
      preview: item.preview ? `${item.preview.sender_id === profile.id ? "You: " : item.kind === "group" ? (people[item.preview.sender_id]?.name ?? "Member") + ": " : ""}${item.preview.body}` : "Start a conversation",
      time: previewTime(item.last_activity_at), activityOrder: item.last_activity_at, unread: item.unread_count,
      members: item.members.map(member => String(member.id)),
      memberRoles: Object.fromEntries(item.members.map(member => [String(member.id), member.role ?? "member"])),
      lastReceipt: item.preview?.sender_id === profile.id ? item.preview.status : undefined }));
    const displayed: Record<string, ChatMessage[]> = {};
    for (const [key, list] of Object.entries(messages)) {
      displayed[key] = list.map(item => ({ id: String(item.id), sender: String(item.sender_id), body: item.body,
        time: clock(item.created_at), date: day(item.created_at), direction: item.sender_id === profile.id ? "outgoing" : "incoming",
        receipt: item.sender_id === profile.id ? item.status as ReceiptState : undefined,
        unread: Boolean(item.recipient_ids?.includes(profile.id) && !item.read_ids?.includes(profile.id)),
        clientMessageId: item.client_message_id }));
    }
    return { source: "connected", conversations: rows, people, messages: displayed };
  }, [conversations, contacts, messages, profile]);

  const selectedConversation = data.conversations.find(item => item.id === selectedId);
  const visibleData = { ...data, conversations: data.conversations.filter(item => (!unreadOnly || item.unread > 0) &&
    (!query.trim() || item.name.toLowerCase().includes(query.trim().toLowerCase()) || item.members.some(id => id !== String(profile.id) &&
      [data.people[id]?.name, data.people[id]?.username].some(value => value?.toLowerCase().includes(query.trim().toLowerCase()))))) };
  return { data: visibleData, selectedConversation, typing, setTyping, incoming, dismissIncoming: () => setIncoming(null), acknowledge, contacts, status, problem, send, directory, addContact, startDirect, createGroup, changeGroup, loadOlder, older };
}
