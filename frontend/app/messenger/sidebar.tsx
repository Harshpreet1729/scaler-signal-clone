import type { RefObject } from "react";
import { Icon } from "./icons";
import { Avatar, IconButton, Receipt } from "./primitives";
import type { ChatMessage, Conversation, Person } from "./types";

export function NavigationRail({ settings = false, onSettings, onMenu, onPlaceholder, onChats }: {
  settings?: boolean; onSettings: () => void; onMenu: () => void;
  onPlaceholder: (name: string) => void; onChats: () => void;
}) {
  return <nav className="navigation-rail" aria-label="Main navigation">
    <IconButton icon="menu" label="Main menu" onClick={onMenu} />
    <div className="rail-items">
      <IconButton icon="chat" label="Chats" active={!settings} onClick={onChats} />
      <IconButton icon="phone" label="Calls" onClick={() => onPlaceholder("Calls")} />
      <IconButton icon="stories" label="Stories" onClick={() => onPlaceholder("Stories")} />
    </div>
    <div className="rail-bottom">
      <IconButton icon="settings" label="Settings" active={settings} onClick={onSettings} />
    </div>
  </nav>;
}
export function ConversationSidebar({ conversations, selectedId, query, unreadOnly, onQuery, onUnread, onSelect, onNew, onMenu, searchInput, scope, messages, people, hasOlder, onClearScope, onMessage, onReturnToChat }: {
  conversations: readonly Conversation[]; selectedId: string | null; query: string; unreadOnly: boolean;
  onQuery: (value: string) => void; onUnread: (value: boolean) => void; onSelect: (id: string) => void;
  onNew: () => void; onMenu: () => void;
  searchInput: RefObject<HTMLInputElement | null>; scope?: Conversation; messages: readonly ChatMessage[]; people: Readonly<Record<string, Person>>;
  hasOlder: boolean; onClearScope: () => void; onMessage: (id: string) => void; onReturnToChat?: () => void;
}) {
  const filtered = conversations.filter(chat => scope ? chat.id === scope.id : !unreadOnly || chat.unread > 0)
    .toSorted((a, b) => b.activityOrder - a.activityOrder);
  const term = query.trim().toLowerCase();
  const results = scope && term ? messages.filter(message => message.body.toLowerCase().includes(term)) : [];
  return <aside className="conversation-sidebar" aria-label="Conversations">
    <header className="sidebar-header"><h1>Chats</h1><div className="header-actions">
      <IconButton icon="compose" label="New chat" onClick={onNew} /><IconButton icon="more" label="Conversation list menu" onClick={onMenu} />
    </div></header>
    <div className="sidebar-search"><div className={"search-field " + (scope ? "scoped-search-field" : "")}>
      {scope ? <span className="search-scope-chip" title={"Search in " + scope.name}>
        <Avatar avatar={scope.avatar} name={scope.name} size={18} /><IconButton icon="close" label="Remove conversation search" onClick={onClearScope} />
      </span> : <Icon name="search" size={17} />}
      <input ref={searchInput} aria-label={scope ? "Search loaded messages" : "Search conversations and contacts"} aria-describedby={scope ? "search-history-note" : undefined} placeholder={scope ? "Search chat" : "Search"} value={query} onChange={event => onQuery(event.target.value)} />
      {query && <IconButton icon="close" label="Clear search" onClick={() => onQuery("")} />}
    </div>{!scope && <IconButton icon="filter" label="Filter by unread" active={unreadOnly} onClick={() => onUnread(!unreadOnly)} />}</div>
    {onReturnToChat && <button className="mobile-search-back text-button" onClick={onReturnToChat}><Icon name="back" size={16} />Return to conversation</button>}
    {!scope && unreadOnly && <div className="filter-caption"><span>Filtered by unread</span><button className="text-button" onClick={() => onUnread(false)}>Clear filter</button></div>}
    {scope && <p id="search-history-note" className="search-history-note">Searches loaded messages only.{hasOlder ? " Load older messages in the chat to include them." : ""}</p>}
    {scope && term ? <div className="conversation-list message-search-results" aria-label="Message search results">
      <p className="search-result-count" role="status">{results.length ? `${results.length} loaded ${results.length === 1 ? "result" : "results"}` : "No matching loaded messages"}</p>
      {results.map(message => <button key={message.id} className="message-search-result" onClick={() => onMessage(message.id)}>
        <span className="search-result-heading"><strong>{people[message.sender]?.name ?? "Member"}</strong><time>{message.date} · {message.time}</time></span>
        <span className="search-result-body">{message.body}</span>
      </button>)}
    </div> : <div className="conversation-list" aria-label="Conversation previews">
      {filtered.map(chat => <button key={chat.id} className={"conversation-row " + (selectedId === chat.id ? "selected" : "")}
        aria-label={chat.name + (chat.unread ? ", " + chat.unread + " unread" : "")} aria-pressed={selectedId === chat.id} onClick={() => onSelect(chat.id)}>
        <Avatar avatar={chat.avatar} name={chat.name} /><span className="row-copy"><span className="row-top"><strong>{chat.name}</strong><time>{chat.time}</time></span>
          <span className="row-bottom"><span className="last-message">{chat.preview}</span>
            {chat.unread > 0 ? <span className="unread-badge">{chat.unread}</span> : chat.lastReceipt ? <Receipt state={chat.lastReceipt} /> : null}
          </span></span>
      </button>)}
      {filtered.length === 0 && <div className="list-empty"><h2>{query || unreadOnly ? "No conversations found" : "No chats"}</h2><p>{query || unreadOnly ? "Try a different name or clear your filters." : "Recent chats will appear here."}</p>{(query || unreadOnly) && <button className="text-button" onClick={() => { onQuery(""); onUnread(false); }}>Clear search and filters</button>}</div>}
    </div>}
  </aside>;
}
