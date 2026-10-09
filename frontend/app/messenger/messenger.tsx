"use client";

import { useEffect, useState } from "react";
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
  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [screen, setScreen] = useState<"chats" | "settings" | "new-chat">("chats");
  const [menu, setMenu] = useState<"rail" | "list" | "chat" | null>(null);
  const [toast, setToast] = useState<{ text: string; sequence: number } | null>(null);
  const { data, selectedConversation: conversation, acknowledge, typing, setTyping, incoming, dismissIncoming, contacts, status, problem, send, react, directory, addContact, startDirect, createGroup, changeGroup, loadOlder, older } = useChatData(profile, csrf, query, unreadOnly, selectedId);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  function notify(text: string) { setToast(previous => ({ text, sequence: (previous?.sequence ?? 0) + 1 })); }
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
  function select(id: string) { setQuery(""); setUnreadOnly(false); setSelectedId(id); setScreen("chats"); }
  return <main className={"messenger " + (conversation && screen === "chats" ? "chat-selected " : "") + (screen === "settings" ? "settings-selected" : "")} aria-label="Messenger" data-username={profile.username}
    onKeyDown={event => { if (event.key === "Escape" && !dialog && !menu && screen !== "chats") { event.preventDefault(); returnToChats(); } }}>
    <NavigationRail settings={screen === "settings"} onSettings={() => open("settings")} onMenu={() => setMenu(menu === "rail" ? null : "rail")} onPlaceholder={name => open(name as "Calls" | "Stories")} onChats={() => { if (screen === "chats") setSelectedId(null); else returnToChats(); }} />
    {screen === "settings" ? <SettingsView profile={profile} onLogout={onLogout} busy={busy} /> : screen === "new-chat" ?
      <NewChatSidebar contacts={contacts} directory={directory} startDirect={startDirect} onSelect={select} onBack={returnToChats} onGroup={() => open("new-group")} onContact={() => open("new-contact")} /> :
      <ConversationSidebar conversations={data.conversations} selectedId={selectedId} query={query} unreadOnly={unreadOnly} onQuery={setQuery} onUnread={setUnreadOnly} onSelect={setSelectedId} onNew={() => open("new-chat")} onMenu={() => setMenu(menu === "list" ? null : "list")} />}
    <ChatPane active={screen !== "settings"} conversation={conversation} messages={selectedId ? data.messages[selectedId] ?? [] : []} people={data.people} userId={profile.id} onReact={react}
      onBack={() => setSelectedId(null)} onDetails={() => open(conversation?.kind === "group" ? "members" : "contact")}
      onSearch={() => open("search-chat")} onMenu={() => setMenu(menu === "chat" ? null : "chat")}
      onUnavailable={notify} onNew={() => open("new-chat")} onSend={send} onRead={acknowledge} onTyping={setTyping} typingNames={(selectedId ? typing[selectedId]?.ids ?? [] : []).map(id => data.people[id]?.name.split(" ")[0] ?? "Member")}
      onLoadOlder={async () => { if (selectedId) await loadOlder(selectedId); }} hasOlder={Boolean(selectedId && older[selectedId])} />
    {menu && <Menu scope={menu} onClose={() => setMenu(null)} items={menu === "chat" ? [
      { label: conversation?.kind === "group" ? "Group details" : "Contact details", icon: "group", action: () => open(conversation?.kind === "group" ? "members" : "contact") },
      { label: "Search conversation", icon: "search", action: () => open("search-chat") },
      { label: "Close conversation", icon: "close", action: () => setSelectedId(null) },
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
