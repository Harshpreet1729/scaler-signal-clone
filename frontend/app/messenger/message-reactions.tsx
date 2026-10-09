import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import type { Reaction } from "./types";

const choices = [
  ["👍", "Thumbs up"], ["❤️", "Heart"], ["😂", "Laugh"],
  ["😮", "Surprised"], ["😢", "Sad"], ["🙏", "Thanks"],
] as const;

export function MessageReactions({ reactions, userId, onReact, onError }: {
  reactions: readonly Reaction[]; userId: number;
  onReact: (emoji: string, active: boolean) => Promise<void>; onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLButtonElement>(".reaction-picker button")?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  function close() {
    setOpen(false);
    // A completed request re-enables the trigger in the next render.
    requestAnimationFrame(() => trigger.current?.focus());
  }
  async function choose(emoji: string) {
    if (busy) return;
    setBusy(true);
    try {
      await onReact(emoji, !reactions.some(item => item.emoji === emoji && item.user_ids.includes(userId)));
      close();
    } catch (error) { onError(error instanceof Error ? error.message : "Reaction failed. Try again."); }
    finally { setBusy(false); }
  }
  return <div ref={root} className="message-reactions" aria-busy={busy} onKeyDown={event => {
    if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); close(); }
  }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    {open && <div className="reaction-picker" role="group" aria-label="Choose a reaction">
      {choices.map(([emoji, name]) => <button key={emoji} type="button" aria-label={name}
        aria-pressed={reactions.some(item => item.emoji === emoji && item.user_ids.includes(userId))}
        disabled={busy} onClick={() => void choose(emoji)}>{emoji}</button>)}
    </div>}
    <div className="reaction-chips">
      {reactions.map(item => <button className="reaction-chip" key={item.emoji} type="button"
        aria-label={`${item.emoji} reaction, ${item.count}${item.user_ids.includes(userId) ? ", including you" : ""}`}
        title={item.user_ids.includes(userId) ? "Remove your reaction" : "Add your reaction"}
        aria-pressed={item.user_ids.includes(userId)} disabled={busy} onClick={() => void choose(item.emoji)}>
        <span>{item.emoji}</span><span>{item.count}</span>
      </button>)}
      <button ref={trigger} className="reaction-trigger" type="button" aria-label="React to message"
        aria-expanded={open} disabled={busy} onClick={() => setOpen(value => !value)}><Icon name="smile" size={16} /></button>
    </div>
  </div>;
}
