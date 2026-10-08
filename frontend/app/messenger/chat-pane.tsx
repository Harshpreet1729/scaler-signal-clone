import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Icon } from "./icons";
import { Avatar, IconButton, Receipt } from "./primitives";
import type { ChatMessage, Conversation, Person, SendMessage } from "./types";

export function Composer({ conversationId, onSend, onUnavailable }: { conversationId: string; onSend?: SendMessage; onUnavailable: (message: string) => void }) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const body = draft.trim();
    if (!body || busy) return;
    if (!onSend) { onUnavailable("Group messaging is available in Phase 5. Your draft was not sent."); return; }
    setBusy(true);
    try { await onSend(conversationId, body); setDraft(""); if (textarea.current) textarea.current.style.height = ""; }
    catch { onUnavailable("Message failed. Your draft is still here; press Send to retry with the same message ID."); }
    finally { setBusy(false); textarea.current?.focus(); }
  }
  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void submit(); }
  }
  return <div className="composer-area">
    <form className="composer" onSubmit={submit}>
      <IconButton icon="plus" label="Attachments — coming soon" onClick={() => onUnavailable("Attachments are not available in this preview.")} />
      <div className="compose-input"><textarea ref={textarea} aria-label="Message draft" placeholder="Message" rows={1} maxLength={4000} value={draft}
        onChange={event => { setDraft(event.target.value); event.target.style.height = "auto"; event.target.style.height = Math.min(event.target.scrollHeight, 128) + "px"; }}
        onKeyDown={keyDown} disabled={busy} />
        <IconButton icon="smile" label="Emoji picker — coming soon" onClick={() => onUnavailable("The emoji picker is not connected. You can type emoji in your draft.")} />
      </div>
      <button className="send-button" type="submit" aria-label="Send message" title={onSend ? "Send message" : "Group sending available in Phase 5"} disabled={!draft.trim() || busy || !onSend}><Icon name="send" /></button>
    </form>
    <p className="composer-note">{onSend ? "Sent means saved · Delivery and read updates arrive in Phase 5" : "Group history is read-only until Phase 5"}</p>
  </div>;
}

function MessageBubble({ message, previous, next, person, isGroup }: { message: ChatMessage; previous?: ChatMessage; next?: ChatMessage; person: Person; isGroup: boolean }) {
  const startsGroup = previous?.sender !== message.sender || previous?.date !== message.date;
  const endsGroup = next?.sender !== message.sender || next?.date !== message.date;
  const outgoing = message.direction === "outgoing";
  return <div className={"message-row " + message.direction + (startsGroup ? " group-start" : "") + (endsGroup ? " group-end" : "")}>
    {!outgoing && isGroup && <span className={"sender-avatar " + (!endsGroup ? "avatar-spacer" : "")}><Avatar avatar={person.avatar} name={person.name} size={28} /></span>}
    <div className="message-bubble">
      {!outgoing && isGroup && startsGroup && <span className="sender-name" style={{ color: person.color }}>{person.name.split(" ")[0]} {person.name.split(" ")[1]}</span>}
      <span className="message-body">{message.body}</span><span className="message-meta"><time>{message.time}</time>{outgoing && message.receipt && <Receipt state={message.receipt} />}</span>
    </div>
  </div>;
}

export function ChatPane({ conversation, messages, people, onBack, onDetails, onSearch, onMenu, onUnavailable, onNew, onSend, onLoadOlder, hasOlder }: {
  conversation?: Conversation; messages: readonly ChatMessage[]; people: Readonly<Record<string, Person>>;
  onBack: () => void; onDetails: () => void; onSearch: () => void; onMenu: () => void; onUnavailable: (text: string) => void; onNew: () => void; onSend?: SendMessage;
  onLoadOlder?: () => void; hasOlder?: boolean;
}) {
  const history = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (history.current) history.current.scrollTop = history.current.scrollHeight;
  }, [conversation?.id, messages.length]);
  if (!conversation) return <section className="empty-chat" aria-label="No conversation selected"><div className="empty-chat-content"><span className="empty-symbol"><Icon name="chat" size={58} /></span><h2>Select a conversation</h2><p>Choose a chat or start a new direct message.</p><button className="primary-button" onClick={onNew}>New message</button></div><p className="empty-footnote">Signal-inspired demo · No real end-to-end encryption</p></section>;
  return <section className="chat-pane" aria-label={conversation.name + " conversation"}>
    <header className="chat-header"><IconButton className="mobile-back" icon="back" label="Back to conversations" onClick={onBack} />
      <button className="chat-title" onClick={onDetails} aria-label={conversation.kind === "group" ? "View group members" : "View contact details"}><Avatar avatar={conversation.avatar} name={conversation.name} size={36} /><span><strong>{conversation.name}</strong><small>{conversation.kind === "group" ? conversation.members.length + " members · read-only group" : "Last seen recently · demo"}</small></span></button>
      <div className="header-actions"><IconButton icon="video" label="Video call — coming soon" onClick={() => onUnavailable("Video calls are coming soon.")} /><IconButton icon="search" label="Search this conversation" onClick={onSearch} /><IconButton icon="more" label="Chat menu" onClick={onMenu} /></div>
    </header>
    <div ref={history} className="message-history" role="region" aria-label="Message history" tabIndex={0}>
      {hasOlder && <button className="load-older" onClick={onLoadOlder}>Load older messages</button>}
      <div className="history-content">{messages.map((message, index) => <div key={message.id}>
        {messages[index - 1]?.date !== message.date && <div className="date-separator"><span>{message.date}</span></div>}
        <MessageBubble message={message} previous={messages[index - 1]} next={messages[index + 1]} person={people[message.sender] ?? { id: message.sender, name: "Member", username: "member", avatar: "sky", color: "#707070" }} isGroup={conversation.kind === "group"} />
      </div>)}</div>
    </div>
    <Composer key={conversation.id} conversationId={conversation.id} onSend={onSend} onUnavailable={onUnavailable} />
  </section>;
}
