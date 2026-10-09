import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Icon } from "./icons";
import { Avatar, IconButton, Receipt } from "./primitives";
import type { ChatMessage, Conversation, Person, SendMessage } from "./types";

export function Composer({ conversationId, onSend, onUnavailable, onTyping }: { conversationId: string; onSend?: SendMessage; onUnavailable: (message: string) => void; onTyping: (id: string, value: boolean) => void }) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => () => onTyping(conversationId, false), [conversationId, onTyping]);
  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const body = draft.trim();
    if (!body || busy) return;
    if (!onSend) { onUnavailable("Messaging is unavailable. Your draft was not sent."); return; }
    onTyping(conversationId, false);
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
      <IconButton icon="smile" label="Emoji picker — coming soon; type emoji in your draft" disabled onClick={() => {}} />
      <div className="compose-input"><textarea ref={textarea} aria-label="Message draft" placeholder="Message" rows={1} maxLength={4000} value={draft}
        onChange={event => { setDraft(event.target.value); onTyping(conversationId, Boolean(event.target.value.trim())); event.target.style.height = "auto"; event.target.style.height = Math.min(event.target.scrollHeight, 128) + "px"; }}
        onKeyDown={keyDown} onBlur={() => onTyping(conversationId, false)} disabled={busy} />
      </div>
      {draft.trim() ? <button className="send-button" type="submit" aria-label="Send message" title={onSend ? "Send message" : "Messaging unavailable"} disabled={busy || !onSend}><Icon name="send" /></button> : <>
        <IconButton icon="microphone" label="Voice messages — coming soon" disabled onClick={() => {}} />
        <IconButton icon="plus" label="Attachments — coming soon" disabled onClick={() => {}} />
      </>}
    </form>
    {!onSend && <p className="composer-note">Messaging unavailable</p>}
  </div>;
}

function MessageBubble({ message, previous, next, person, isGroup }: { message: ChatMessage; previous?: ChatMessage; next?: ChatMessage; person: Person; isGroup: boolean }) {
  const startsGroup = previous?.sender !== message.sender || previous?.date !== message.date;
  const endsGroup = next?.sender !== message.sender || next?.date !== message.date;
  const outgoing = message.direction === "outgoing";
  return <div data-message-id={message.id} data-unread={message.unread ? "true" : undefined} className={"message-row " + message.direction + (startsGroup ? " group-start" : "") + (endsGroup ? " group-end" : "")}>
    {!outgoing && isGroup && <span className={"sender-avatar " + (!endsGroup ? "avatar-spacer" : "")}><Avatar avatar={person.avatar} name={person.name} size={28} /></span>}
    <div className="message-bubble">
      {!outgoing && isGroup && startsGroup && <span className="sender-name" style={{ color: person.color }}>{person.name}</span>}
      <span className="message-body">{message.body}</span><span className="message-meta"><time>{message.time}</time>{outgoing && message.receipt && <Receipt state={message.receipt} />}</span>
    </div>
  </div>;
}

export function ChatPane({ active = true, conversation, messages, people, onBack, onDetails, onSearch, onMenu, onUnavailable, onNew, onSend, onLoadOlder, hasOlder, onRead, onTyping, typingNames }: {
  active?: boolean;
  conversation?: Conversation; messages: readonly ChatMessage[]; people: Readonly<Record<string, Person>>;
  onBack: () => void; onDetails: () => void; onSearch: () => void; onMenu: () => void; onUnavailable: (text: string) => void; onNew: () => void; onSend?: SendMessage;
  onTyping: (id: string, value: boolean) => void; typingNames: string[];
  onRead: (id: string, ids: number[], read: boolean) => Promise<void>;
  onLoadOlder?: () => Promise<void>; hasOlder?: boolean;
}) {
  const history = useRef<HTMLDivElement>(null);
  const firstMessageId = messages[0]?.id;
  const previousHistory = useRef<{ conversationId?: string; firstMessageId?: string; count: number }>({ count: 0 });
  const requestedEarlierPage = useRef<string | undefined>(undefined);
  useEffect(() => {
    const previous = previousHistory.current;
    const prepended = requestedEarlierPage.current !== undefined && previous.conversationId === conversation?.id && messages.length > previous.count
      && previous.firstMessageId !== undefined && previous.firstMessageId !== firstMessageId;
    // Loading an earlier page should reveal it rather than jump back to the latest message.
    if (active && history.current) history.current.scrollTop = prepended ? 0 : history.current.scrollHeight;
    if (prepended || previous.conversationId !== conversation?.id) requestedEarlierPage.current = undefined;
    previousHistory.current = { conversationId: conversation?.id, firstMessageId, count: messages.length };
  }, [active, conversation?.id, firstMessageId, messages.length]);
  useEffect(() => {
    const root = history.current;
    if (!active || !root || !conversation) return;
    let observer: IntersectionObserver | undefined;
    const observe = () => {
      observer?.disconnect();
      if (document.visibilityState !== "visible") return;
      observer = new IntersectionObserver(entries => {
        if (document.visibilityState !== "visible") return;
        const ids = entries.filter(entry => entry.isIntersecting).map(entry => Number((entry.target as HTMLElement).dataset.messageId));
        if (ids.length) void onRead(conversation.id, ids, true);
      }, { root, threshold: 0.1 });
      root.querySelectorAll('[data-unread="true"]').forEach(element => observer!.observe(element));
    };
    observe();
    document.addEventListener("visibilitychange", observe);
    return () => { observer?.disconnect(); document.removeEventListener("visibilitychange", observe); };
  }, [active, conversation, messages, onRead]);
  if (!conversation) return <section hidden={!active} className="empty-chat" aria-label="No conversation selected"><div className="empty-chat-content"><span className="empty-symbol"><Icon name="chat" size={112} /></span><h2>Welcome to your conversations</h2><p>Start a chat with a demo account.</p><button className="primary-button" onClick={onNew}>New message</button></div><p className="empty-footnote">Signal-inspired demo · No real end-to-end encryption</p></section>;
  return <section hidden={!active} className="chat-pane" aria-label={conversation.name + " conversation"}>
    <header className="chat-header"><IconButton className="mobile-back" icon="back" label="Back to conversations" onClick={onBack} />
      <button className="chat-title" onClick={onDetails} aria-label={conversation.kind === "group" ? "View group members" : "View contact details"}><Avatar avatar={conversation.avatar} name={conversation.name} size={36} /><span><strong>{conversation.name}</strong><small>{conversation.kind === "group" ? conversation.members.length + " members" : "Last seen recently · demo"}</small></span></button>
      <div className="header-actions"><IconButton icon="video" label="Video call — coming soon" onClick={() => onUnavailable("Video calls are coming soon.")} /><IconButton icon="search" label="Search this conversation" onClick={onSearch} /><IconButton icon="more" label="Chat menu" onClick={onMenu} /></div>
    </header>
    <div ref={history} className="message-history" role="region" aria-label="Message history" tabIndex={0}>
      {hasOlder && <button className="load-older" onClick={() => {
        requestedEarlierPage.current = firstMessageId;
        void onLoadOlder?.().catch(issue => { requestedEarlierPage.current = undefined; onUnavailable(issue.message); });
      }}>Load older messages</button>}
      <div className="history-content">{messages.map((message, index) => <div key={message.id}>
        {messages[index - 1]?.date !== message.date && <div className="date-separator"><span>{message.date}</span></div>}
        <MessageBubble message={message} previous={messages[index - 1]} next={messages[index + 1]} person={people[message.sender] ?? { id: message.sender, name: "Member", username: "member", avatar: "sky", color: "#707070" }} isGroup={conversation.kind === "group"} />
      </div>)}</div>
    </div>
    {typingNames.length > 0 && <div className="typing-indicator" role="status">{typingNames.join(", ")}{typingNames.length === 1 ? " is" : " are"} typing…</div>}
    <Composer key={conversation.id} conversationId={conversation.id} onSend={onSend} onUnavailable={onUnavailable} onTyping={onTyping} />
  </section>;
}
