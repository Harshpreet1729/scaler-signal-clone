import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./icons";
import { Avatar, IconButton } from "./primitives";
import type { Profile } from "./types";
import type { ApiUser } from "./use-chat-data";

const categories: { name: string; icon: IconName }[] = [
  { name: "Account", icon: "user" }, { name: "General", icon: "settings" },
  { name: "Appearance", icon: "sun" }, { name: "Chats", icon: "chat" },
  { name: "Calls", icon: "phone" }, { name: "Notifications", icon: "bell" },
  { name: "Privacy", icon: "lock" }, { name: "Data usage", icon: "data" },
  { name: "About", icon: "info" },
];

function Setting({ label, detail, checked = false }: { label: string; detail: string; checked?: boolean }) {
  return <label className="settings-row"><span>{label}<small>{detail}</small></span><input className="setting-toggle" type="checkbox" checked={checked} disabled aria-label={label + " (preview)"} /></label>;
}

export function SettingsView({ profile, onLogout, busy }: { profile: Profile; onLogout: () => void; busy: boolean }) {
  const [category, setCategory] = useState("Profile");
  const [detailOpen, setDetailOpen] = useState(false);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  function select(name: string) { setCategory(name); setDetailOpen(true); }
  useEffect(() => { if (detailOpen) detailHeading.current?.focus(); }, [category, detailOpen]);
  return <>
    <aside className={"settings-sidebar " + (detailOpen ? "settings-index-hidden" : "")} aria-label="Settings navigation">
      <header className="sidebar-header"><h1>Settings</h1></header>
      <button className="settings-account" aria-label="Profile" aria-pressed={category === "Profile"} onClick={() => select("Profile")}>
        <Avatar avatar={profile.avatar_key} name={profile.avatar_key} size={46} /><span><strong>{profile.display_name}</strong><small>@{profile.username}</small></span>
      </button>
      <nav className="settings-nav" aria-label="Settings categories">{categories.map(item => <button key={item.name} aria-pressed={category === item.name} onClick={() => select(item.name)}><Icon name={item.icon} size={20} />{item.name}</button>)}</nav>
    </aside>
    <section className={"settings-page " + (detailOpen ? "settings-detail-open" : "")} aria-label={category + " settings"}>
      <header className="settings-page-header"><IconButton className="mobile-back" icon="back" label="Back to Settings" onClick={() => { setDetailOpen(false); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.settings-nav button[aria-pressed="true"], .settings-account[aria-pressed="true"]')?.focus()); }} /><h2 ref={detailHeading} tabIndex={-1}>{category}</h2></header>
      <div className="settings-detail">
        {category === "Profile" ? <>
          <div className="settings-profile"><Avatar avatar={profile.avatar_key} name={profile.avatar_key} size={76} /><p>Preset demo avatar</p></div>
          <div className="settings-card"><div className="profile-field"><Icon name="user" size={20} /><span>{profile.display_name}<small>Display name</small></span></div><div className="profile-field"><Icon name="info" size={20} /><span>Fictitious demo account</span></div></div>
          <p className="settings-helper">Your profile is visible to people you message. Profile editing is not available in this view.</p>
          <div className="settings-card"><div className="profile-field"><Icon name="at" size={20} /><span>Username<small>@{profile.username}</small></span></div></div>
          <p className="settings-helper">People can find this demo account by username. Your session stays signed in after a reload.</p>
          <button className="secondary-button logout-button" onClick={onLogout} disabled={busy}><Icon name="logout" size={18} />{busy ? "Logging out…" : "Log out"}</button>
        </> : <>
          {category === "Account" && <><div className="settings-card"><div className="settings-row"><span>Account type<small>Public fixed-OTP authentication · 123456</small></span><span>Demo</span></div></div><p className="settings-helper">Anyone with the public demo OTP can sign into these fictitious accounts. Do not enter private information.</p><button className="secondary-button logout-button" onClick={onLogout} disabled={busy}>Log out</button></>}
          {category === "General" && <><div className="settings-card"><div className="settings-row"><span>Desktop-inspired web application<small>Use a separate browser session for each demo account.</small></span></div></div><p className="settings-helper">Operating-system integration and linked devices are not implemented.</p></>}
          {category === "Privacy" && <><p className="preview-note">Preference controls are placeholders.</p><div className="settings-card"><Setting label="Read receipts" detail="Enabled for this demo; preference is a placeholder" checked /><Setting label="Typing indicators" detail="Enabled for this demo; preference is a placeholder" checked /></div><p className="privacy-note"><Icon name="shield" size={18} />This assignment demo does not implement end-to-end encryption.</p></>}
          {category === "Notifications" && <><p className="preview-note">Preference controls are placeholders.</p><div className="settings-card"><Setting label="Message notifications" detail="In-app incoming-message toasts are enabled" checked /><Setting label="Play notification sounds" detail="No sounds are played in this demo" /></div></>}
          {category === "Appearance" && <><div className="settings-card"><div className="settings-row"><span>Theme<small>Light</small></span><span className="theme-swatch" /></div><div className="settings-row"><span>Chat color<small>Blue</small></span><span className="color-swatch" /></div></div><p className="settings-helper">Appearance preferences are placeholders. Light theme follows the approved Windows reference.</p></>}
          {category === "Chats" && <div className="settings-card"><div className="settings-row"><span>Send messages<small>Enter to send · Shift+Enter for a new line</small></span></div><div className="settings-row"><span>Message history<small>Saved on the server. Disappearing messages are not implemented.</small></span></div></div>}
          {category === "Calls" && <div className="settings-card"><div className="settings-row"><span>Voice and video calls<small>Coming soon · assignment placeholder</small></span></div></div>}
          {category === "Data usage" && <div className="settings-card"><div className="settings-row"><span>Text messages only<small>Attachments and data-usage controls are not implemented.</small></span></div></div>}
          {category === "About" && <div className="settings-card"><div className="settings-row"><span>Signal-inspired Messenger<small>Original Scaler assignment demo. Not an official Signal client.</small></span></div><div className="settings-row"><span>No real end-to-end encryption<small>Public demo OTP: 123456 · fictitious accounts only</small></span></div></div>}
        </>}
      </div>
    </section>
  </>;
}

export function NewChatSidebar({ contacts, directory, startDirect, onSelect, onBack, onGroup, onContact }: {
  contacts: ApiUser[]; directory: (term: string) => Promise<ApiUser[]>; startDirect: (id: number) => Promise<string>;
  onSelect: (id: string) => void; onBack: () => void; onGroup: () => void; onContact: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ApiUser[]>([]);
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    if (!query.trim()) return;
    let active = true;
    const timer = setTimeout(() => { void directory(query.trim()).then(value => { if (active) setResults(value); }).catch(error => { if (active) setNotice(error.message); }).finally(() => { if (active) setPending(false); }); }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [query, directory]);
  async function openPerson(id: number) {
    setBusy(true); setNotice("");
    try { onSelect(await startDirect(id)); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not open chat."); }
    finally { setBusy(false); }
  }
  const visible = query.trim() ? results : contacts;
  return <aside className="conversation-sidebar new-chat-sidebar" aria-label="New chat">
    <header className="sidebar-header new-chat-header"><IconButton icon="back" label="Back to Chats" onClick={onBack} /><h1>New chat</h1></header>
    <div className="sidebar-search"><div className="search-field"><Icon name="search" size={17} /><input ref={input} aria-label="Find a user" type="search" placeholder="Name or username" value={query} onChange={event => { setQuery(event.target.value); setResults([]); setPending(Boolean(event.target.value.trim())); setNotice(""); }} />{query && <IconButton icon="close" label="Clear user search" onClick={() => { setQuery(""); setPending(false); input.current?.focus(); }} />}</div></div>
    <div className="new-chat-content"><div className="new-chat-actions"><button onClick={onGroup}><span className="action-symbol"><Icon name="group" /></span>New group</button><button onClick={() => input.current?.focus()}><span className="action-symbol"><Icon name="at" /></span>Find by username</button><button onClick={onContact}><span className="action-symbol"><Icon name="plus" /></span>New contact</button></div>
      <h2 className="contacts-heading">{query ? "Directory results" : "Contacts"}</h2>
      {pending ? <p className="preview-note" role="status">Searching…</p> : <div className="contact-options">{visible.map(person => <button key={person.id} disabled={busy} onClick={() => { void openPerson(person.id); }}><Avatar avatar={person.avatar_key} name={person.display_name} size={36} /><span>{person.display_name}<small>@{person.username}</small></span></button>)}</div>}
      {!pending && visible.length === 0 && <p className="preview-note">{query ? "No users found." : "No contacts yet. Search for a username to start a chat."}</p>}
      {notice && <p className="error" role="alert">{notice}</p>}
    </div>
  </aside>;
}
