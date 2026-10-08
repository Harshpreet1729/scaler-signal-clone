import { useEffect, useRef, type ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import type { ReceiptState } from "./types";

export function IconButton({ icon, label, onClick, active, className = "", disabled = false }: {
  icon: IconName; label: string; onClick: () => void; active?: boolean; className?: string; disabled?: boolean;
}) {
  return <button type="button" className={"icon-button " + className} aria-label={label} title={label}
    aria-pressed={active} onClick={onClick} disabled={disabled}><Icon name={icon} /></button>;
}
export function Avatar({ avatar, name, size = 44 }: { avatar: string; name: string; size?: number }) {
  return avatar === "group" ? <span className="avatar group-avatar" style={{ width: size, height: size }} role="img" aria-label={name + " avatar"}><Icon name="group" size={Math.round(size * .55)} /></span>
    : <img className="avatar" src={"/avatars/" + avatar + ".svg"} width={size} height={size} alt={name + " avatar"} />;
}
export function Receipt({ state }: { state: ReceiptState }) {
  return <span className={"receipt receipt-" + state} role="img" aria-label={"Status: " + state} title={"Status: " + state}>
    {state === "failed" ? <span aria-hidden="true">!</span> : state === "sending" ? <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeDasharray="2 2" /></svg>
      : <svg viewBox={state === "sent" ? "0 0 16 16" : "0 0 23 16"} aria-hidden="true">
        <circle cx="8" cy="8" r="6" /><path d="m5 8 2 2 4-4" />
        {state !== "sent" && <><circle cx="15" cy="8" r="6" /><path d="m12 8 2 2 4-4" /></>}
      </svg>}
  </span>;
}

/** Native modal with explicit Tab wrapping; return focus to the opener on unmount. */
export function Dialog({ title, children, onClose, wide = false, side = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean; side?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); if (opener?.isConnected) opener.focus(); };
  }, []);
  return <dialog ref={ref} className={"dialog " + (wide ? "dialog-wide " : "") + (side ? "dialog-side" : "")} aria-labelledby="dialog-title"
    onKeyDown={event => {
      if (event.key !== "Tab") return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')].filter(element => element.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === ref.current) { const rect = ref.current.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }}>
    <header className="dialog-header"><h2 id="dialog-title">{title}</h2><IconButton icon="close" label="Close dialog" onClick={onClose} /></header>
    <div className="dialog-content">{children}</div>
  </dialog>;
}

export function Menu({ scope, items, onClose }: { scope: "rail" | "list" | "chat"; items: { label: string; icon: IconName; action: () => void }[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function dismiss(event: PointerEvent) { if (!ref.current?.contains(event.target as Node)) close.current(); }
    document.addEventListener("pointerdown", dismiss);
    return () => { document.removeEventListener("pointerdown", dismiss); if (opener?.isConnected) opener.focus(); };
  }, []);
  return <div ref={ref} className={"popup-menu menu-" + scope} role="menu" aria-label="Actions" onKeyDown={event => {
    if (event.key === "Escape" || event.key === "Tab") { event.preventDefault(); onClose(); }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    }
  }}>{items.map(item => <button key={item.label} role="menuitem" onClick={() => { onClose(); item.action(); }}><Icon name={item.icon} size={19} />{item.label}</button>)}</div>;
}
