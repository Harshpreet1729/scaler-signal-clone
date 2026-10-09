"use client";

import { useEffect, useRef, useState } from "react";
import { ChatPane } from "./chat-pane";
import { MessengerDialog, type DialogState } from "./dialogs";
import { IconButton, Menu } from "./primitives";
import { ConversationSidebar, NavigationRail } from "./sidebar";
import { NewChatSidebar, SettingsView } from "./shell-views";
import type { Profile } from "./types";
import { useChatData } from "./use-chat-data";

type Props = { profile: Profile; csrf: string; onLogout: () => void; busy: boolean; error: string };

export default function Messenger({ profile, csrf, onLogout, busy, error }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState<{ conversationId: string | null; query: string }>({ conversationId: null, query: "" });
  const [searchSidebarOpen, setSearchSidebarOpen] = useState(false);
  const [messageTarget, setMessageTarget] = useState<{ conversationId: string; messageId: string; sequence: number } | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [screen, setScreen] = useState<"chats" | "settings" | "new-chat">("chats");
  const [menu, setMenu] = useState<"rail" | "list" | "chat" | null>(null);
  const [toast, setToast] = useState<{ text: string; sequence: number } | null>(null);
  const scoped = search.conversationId !== null && search.conversationId === selectedId;
  const { data, selectedConversation: conversation, acknowledge, typing, setTyping, incoming, dismissIncoming, contacts, status, problem, send, react, directory, addContact, startDirect, createGroup, changeGroup, loadOlder, older } = useChatData(profile, csrf, scoped ? "" : search.query, scoped ? false : unreadOnly, selectedId);
  const scope = scoped ? conversation : undefined;
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  function notify(text: string) { setToast(previous => ({ text, sequence: (previous?.sequence ?? 0) + 1 })); }
  function clearScope() {
    setSearch({ conversationId: null, query: "" });
    requestAnimationFrame(() => searchInput.current?.focus());
  }
  function searchConversation() {
    if (!conversation) return;
    setSearch({ conversationId: conversation.id, query: "" });
    setSearchSidebarOpen(true); setScreen("chats"); setMenu(null); setDialog(null);
    setTyping(conversation.id, false);
    requestAnimationFrame(() => searchInput.current?.focus());
  }
  function closeConversation() {
    setSelectedId(null); setSearch({ conversationId: null, query: "" }); setSearchSidebarOpen(false); setMessageTarget(null);
  }
  function showMessage(messageId: string) {
    if (!scope) return;
    setMessageTarget(previous => ({ conversationId: scope.id, messageId, sequence: (previous?.sequence ?? 0) + 1 }));
    setSearchSidebarOpen(false);
  }
  function open(kind: DialogState | "settings" | "new-chat") {
    if (kind === "settings" || kind === "new-chat") {
      if (selectedId) setTyping(selectedId, false);
      setScreen(kind); setDialog(null);
    } else setDialog(kind);
    setMenu(null);
  }
  function returnToChats() {
    const opener = screen === "settings" ? "Settings" : "New chat";
    setScreen("chats");
    requestAnimationFrame(() => {
      const button = document.querySelector<HTMLButtonElement>(`button[aria-label="${opener}"]`);
      if (button?.getClientRects().length) button.focus();
      else document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message draft"]')?.focus();
    });
  }
  function select(id: string) { setSearch({ conversationId: null, query: "" }); setUnreadOnly(false); setSelectedId(id); setScreen("chats"); setSearchSidebarOpen(false); setMessageTarget(null); }
  return <main className={"messenger " + (conversation && screen === "chats" ? "chat-selected " : "") + (conversation && searchSidebarOpen && screen === "chats" ? "search-sidebar-open " : "") + (screen === "settings" ? "settings-selected" : "")} aria-label="Messenger" data-username={profile.username}
    onKeyDown={event => { if (event.key !== "Escape" || dialog || menu) return; if (scope && screen === "chats") { event.preventDefault(); clearScope(); } else if (screen !== "chats") { event.preventDefault(); returnToChats(); } }}>
    <NavigationRail settings={screen === "settings"} onSettings={() => open("settings")} onMenu={() => setMenu(menu === "rail" ? null : "rail")} onPlaceholder={name => open(name as "Calls" | "Stories")} onChats={() => { if (screen === "chats") closeConversation(); else returnToChats(); }} />
    {screen === "settings" ? <SettingsView profile={profile} onLogout={onLogout} busy={busy} /> : screen === "new-chat" ?
      <NewChatSidebar contacts={contacts} directory={directory} startDirect={startDirect} onSelect={select} onBack={returnToChats} onGroup={() => open("new-group")} onContact={() => open("new-contact")} /> :
      <ConversationSidebar conversations={data.conversations} selectedId={selectedId} query={search.query} unreadOnly={unreadOnly} onQuery={query => setSearch(current => ({ ...current, query }))} onUnread={setUnreadOnly}
        onSelect={id => { if (scope) clearScope(); setSelectedId(id); setSearchSidebarOpen(false); setMessageTarget(null); }} onNew={() => open("new-chat")} onMenu={() => setMenu(menu === "list" ? null : "list")}
        searchInput={searchInput} scope={scope} messages={scope ? data.messages[scope.id] ?? [] : []} people={data.people} hasOlder={Boolean(scope && older[scope.id])} onClearScope={clearScope} onMessage={showMessage}
        onReturnToChat={conversation && searchSidebarOpen ? () => { setSearchSidebarOpen(false); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('button[aria-label="Search this conversation"]')?.focus()); } : undefined} />}
    <ChatPane active={screen !== "settings"} conversation={conversation} messages={selectedId ? data.messages[selectedId] ?? [] : []} people={data.people} userId={profile.id} onReact={react}
      onBack={closeConversation} onDetails={() => open(conversation?.kind === "group" ? "members" : "contact")}
      onSearch={searchConversation} onMenu={() => setMenu(menu === "chat" ? null : "chat")} messageTarget={messageTarget?.conversationId === conversation?.id ? messageTarget : null}
      onUnavailable={notify} onNew={() => open("new-chat")} onSend={send} onRead={acknowledge} onTyping={setTyping} typingNames={(selectedId ? typing[selectedId]?.ids ?? [] : []).map(id => data.people[id]?.name.split(" ")[0] ?? "Member")}
      onLoadOlder={async () => { if (selectedId) await loadOlder(selectedId); }} hasOlder={Boolean(selectedId && older[selectedId])} />
    {menu && <Menu scope={menu} onClose={() => setMenu(null)} items={menu === "chat" ? [
      { label: conversation?.kind === "group" ? "Group details" : "Contact details", icon: "group", action: () => open(conversation?.kind === "group" ? "members" : "contact") },
      { label: "Search conversation", icon: "search", action: searchConversation },
      { label: "Close conversation", icon: "close", action: closeConversation },
    ] : [
      { label: "New contact", icon: "plus", action: () => open("new-contact") },
      { label: "New group", icon: "group", action: () => open("new-group") },
      { label: "Settings", icon: "settings", action: () => open("settings") },
      { label: "About this preview", icon: "chat", action: () => open("about") },
    ]} />}
    {dialog && <MessengerDialog key={dialog} kind={dialog} profile={profile} data={data} conversation={conversation} contacts={contacts}
      directory={directory} addContact={addContact} startDirect={startDirect} createGroup={createGroup} changeGroup={changeGroup} onClose={() => setDialog(null)} onOpen={open}
      onSelect={select} onLogout={onLogout} busy={busy} />}
    <span className="sr-only" role="status" data-testid="connection-status" data-state={status}>Messages · {status}</span>
    {status !== "connected" && <p className="connection-notice" role="status">Messages · {status}</p>}
    {(toast || incoming || error || problem) && <div className={"toast " + (error || problem ? "toast-error" : "")} role={error || problem ? "alert" : "status"}><span>{error || problem || toast?.text || incoming?.text}</span>{!error && !problem && <IconButton icon="close" label="Dismiss notification" onClick={() => { setToast(null); dismissIncoming(); }} />}</div>}
  </main>;
}
