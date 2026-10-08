"use client";

import { useEffect, useState } from "react";
import { ChatPane } from "./chat-pane";
import { MessengerDialog, type DialogState } from "./dialogs";
import { IconButton, Menu } from "./primitives";
import { ConversationSidebar, NavigationRail } from "./sidebar";
import type { Profile } from "./types";
import { useChatData } from "./use-chat-data";

type Props = { profile: Profile; csrf: string; onLogout: () => void; busy: boolean; error: string };

export default function Messenger({ profile, csrf, onLogout, busy, error }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [menu, setMenu] = useState<"rail" | "list" | "chat" | null>(null);
  const [toast, setToast] = useState<{ text: string; sequence: number } | null>(null);
  const { data, contacts, status, problem, send, directory, addContact, startDirect, loadOlder, older } = useChatData(profile, csrf, query, unreadOnly, selectedId);
  const conversation = data.conversations.find(item => item.id === selectedId);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  function notify(text: string) { setToast(previous => ({ text, sequence: (previous?.sequence ?? 0) + 1 })); }
  function open(kind: DialogState) { setDialog(kind); setMenu(null); }
  return <main className={"messenger " + (selectedId ? "chat-selected" : "")} aria-label="Messenger preview">
    <NavigationRail profile={profile} onSettings={() => open("settings")} onMenu={() => setMenu(menu === "rail" ? null : "rail")} onPlaceholder={name => open(name as "Calls" | "Stories")} onChats={() => setSelectedId(null)} />
    <ConversationSidebar conversations={data.conversations} selectedId={selectedId} query={query} unreadOnly={unreadOnly} onQuery={setQuery} onUnread={setUnreadOnly} onSelect={setSelectedId} onNew={() => open("new-chat")} onMenu={() => setMenu(menu === "list" ? null : "list")} onAbout={() => open("about")} status={status} />
    <ChatPane conversation={conversation} messages={selectedId ? data.messages[selectedId] ?? [] : []} people={data.people}
      onBack={() => setSelectedId(null)} onDetails={() => open(conversation?.kind === "group" ? "members" : "contact")}
      onSearch={() => open("search-chat")} onMenu={() => setMenu(menu === "chat" ? null : "chat")}
      onUnavailable={notify} onNew={() => open("new-chat")} onSend={conversation?.kind === "direct" ? send : undefined}
      onLoadOlder={() => { if (selectedId) void loadOlder(selectedId).catch(issue => notify(issue.message)); }} hasOlder={Boolean(selectedId && older[selectedId])} />
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
      directory={directory} addContact={addContact} startDirect={startDirect} onClose={() => setDialog(null)} onOpen={open}
      onSelect={id => { setQuery(""); setUnreadOnly(false); setSelectedId(id); }} onLogout={onLogout} busy={busy} />}
    {(toast || error || problem) && <div className={"toast " + (error || problem ? "toast-error" : "")} role={error || problem ? "alert" : "status"}><span>{error || problem || toast?.text}</span>{!error && !problem && <IconButton icon="close" label="Dismiss notification" onClick={() => setToast(null)} />}</div>}
  </main>;
}
