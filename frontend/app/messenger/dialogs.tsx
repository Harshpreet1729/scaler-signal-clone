import { useEffect, useState, type FormEvent } from "react";
import { Icon, type IconName } from "./icons";
import { Avatar, Dialog } from "./primitives";
import type { Conversation, MessengerData, Profile } from "./types";
import type { ApiUser } from "./use-chat-data";

export type DialogState = "new-chat" | "new-contact" | "new-group" | "settings" | "members" | "contact" | "search-chat" | "about" | "Calls" | "Stories" | null;
type Props = {
  kind: Exclude<DialogState, null>; profile: Profile; data: MessengerData; conversation?: Conversation;
  onClose: () => void; onOpen: (kind: DialogState) => void; onSelect: (id: string) => void; onLogout: () => void; busy: boolean;
  contacts: ApiUser[]; directory: (term: string) => Promise<ApiUser[]>; addContact: (userId: number) => Promise<void>;
  startDirect: (userId: number) => Promise<string>;
  createGroup: (name: string, userIds: number[]) => Promise<string>;
  changeGroup: (id: string, action: "rename" | "add" | "remove", value: string | number[]) => Promise<void>;
};

function NewContact({ directory, addContact }: Pick<Props, "directory" | "addContact">) {
  const [username, setUsername] = useState("");
  const [matches, setMatches] = useState<ApiUser[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    if (!username.trim()) return;
    const timer = setTimeout(() => { void directory(username.trim()).then(value => { if (active) setMatches(value); }).catch(() => { if (active) setMatches([]); }); }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [username, directory]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const target = matches.find(item => item.username === username.trim().toLowerCase());
    if (!target) { setNotice("Find an existing exact username first."); return; }
    setBusy(true);
    try { await addContact(target.id); setNotice(target.display_name + " is in your contacts."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not add contact."); }
    finally { setBusy(false); }
  }
  return <form className="dialog-form" onSubmit={submit}>
    <p>Find an existing user by username.</p><label htmlFor="contact-username">Username</label>
    <input id="contact-username" placeholder="e.g. bob" value={username} onChange={event => { setUsername(event.target.value); setNotice(""); }} required pattern="[A-Za-z0-9_]{3,32}" minLength={3} maxLength={32} autoCapitalize="none" autoComplete="off" />
    <p className="muted">3–32 letters, numbers or underscores.</p>
    {matches.length > 0 && <p className="muted">Matches: {matches.map(item => "@" + item.username).join(", ")}</p>}
    {notice && <p className="inline-notice" role="status">{notice}</p>}
    <div className="dialog-footer"><button className="primary-button" type="submit" disabled={busy}>Add contact</button></div>
  </form>;
}
function NewGroup({ data, profile, createGroup, onSelect, onClose }: Pick<Props, "data" | "profile" | "createGroup" | "onSelect" | "onClose">) {
  const [name, setName] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [invalid, setInvalid] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const valid = name.trim().length > 0 && members.length > 0;
    setInvalid(!valid);
    if (!valid) { setNotice("Enter a group name and choose at least one member."); return; }
    try { onSelect(await createGroup(name, members.map(Number))); onClose(); }
    catch (error) { setInvalid(true); setNotice(error instanceof Error ? error.message : "Could not create group."); }
  }
  return <form className="dialog-form" onSubmit={submit}>
    <div className="group-form-avatar"><Avatar avatar="group" name="New group" size={72} /></div>
    <label htmlFor="group-name">Group name</label><input id="group-name" value={name} onChange={event => setName(event.target.value)} placeholder="Name your group" maxLength={100} required />
    <fieldset className="member-picker"><legend>Choose members</legend>{Object.values(data.people).filter(person => person.id !== String(profile.id)).map(person => <label key={person.id}><Avatar avatar={person.avatar} name={person.name} size={36} /><span>{person.name}<small>@{person.username}</small></span><input type="checkbox" checked={members.includes(person.id)} onChange={event => setMembers(event.target.checked ? [...members, person.id] : members.filter(id => id !== person.id))} /></label>)}</fieldset>

    {notice && <p className={invalid ? "error" : "inline-notice"} role={invalid ? "alert" : "status"}>{notice}</p>}
    <div className="dialog-footer"><button className="primary-button" type="submit">Create group</button></div>
  </form>;
}
function Settings({ profile, onLogout, busy }: Pick<Props, "profile" | "onLogout" | "busy">) {
  const [category, setCategory] = useState("Profile");
  const categories: { name: string; icon: IconName }[] = [{ name: "Profile", icon: "chat" }, { name: "Privacy", icon: "shield" }, { name: "Notifications", icon: "bell" }, { name: "Appearance", icon: "sun" }];
  return <div className="settings-layout">
    <nav className="settings-nav" aria-label="Settings categories">{categories.map(item => <button key={item.name} aria-pressed={category === item.name} onClick={() => setCategory(item.name)}><Icon name={item.icon} size={20} />{item.name}</button>)}</nav>
    <section className="settings-detail" aria-label={category + " settings"}><h3>{category}</h3>
      {category === "Profile" ? <>
        <div className="settings-profile"><Avatar avatar={profile.avatar_key} name={profile.avatar_key} size={76} /><h4>{profile.display_name}</h4><p>@{profile.username}</p></div>
        <p>Your account is saved. Your session stays signed in after a reload.</p>
        <div className="settings-row"><span>Account type<small>Public fixed-OTP authentication</small></span><span className="muted">Demo</span></div>
        <button className="secondary-button logout-button" onClick={onLogout} disabled={busy}><Icon name="logout" size={18} />{busy ? "Logging out…" : "Log out"}</button>
      </> : <>
        <p className="preview-note">Settings preview. Preference controls are placeholders.</p>
        {category === "Privacy" && <><Setting label="Read receipts" detail="Enabled for this demo; preference is a placeholder" checked /><Setting label="Typing indicators" detail="Enabled for this demo; preference is a placeholder" checked /><p className="privacy-note"><Icon name="shield" size={18} />This assignment demo does not implement end-to-end encryption.</p></>}
        {category === "Notifications" && <><Setting label="Message notifications" detail="In-app incoming-message toasts are enabled" checked /><Setting label="Play notification sounds" detail="No sounds are played in this preview" /><div className="settings-row"><span>Show in notifications<small>Name and message</small></span><Icon name="chevron" size={18} /></div></>}
        {category === "Appearance" && <><div className="settings-row"><span>Theme<small>Light</small></span><span className="theme-swatch" /></div><p>Light theme is the approved desktop reference. Dark mode is deferred.</p><div className="settings-row"><span>Chat color<small>Blue</small></span><span className="color-swatch" /></div></>}
      </>}
    </section>
  </div>;
}
function Setting({ label, detail, checked = false }: { label: string; detail: string; checked?: boolean }) {
  return <label className="settings-row"><span>{label}<small>{detail}</small></span><input className="setting-toggle" type="checkbox" checked={checked} disabled aria-label={label + " (preview)"} /></label>;
}
function ChatSearch({ data, conversation }: { data: MessengerData; conversation?: Conversation }) {
  const [query, setQuery] = useState("");
  const results = (conversation ? data.messages[conversation.id] ?? [] : []).filter(message => query.trim() && message.body.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="dialog-form"><label htmlFor="search-messages">Search loaded messages</label><input id="search-messages" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search in this conversation" />
    <p className="muted">{query ? results.length + " loaded results" : "Type to search loaded history."}</p>
    <div className="search-results">{results.map(message => <article key={message.id}><strong>{data.people[message.sender]?.name ?? "Member"}</strong><time>{message.date} · {message.time}</time><p>{message.body}</p></article>)}</div>
    {query && results.length === 0 && <p>No matching messages.</p>}</div>;
}

function NewChat({ contacts, directory, startDirect, onSelect, onClose, onOpen }: Pick<Props, "contacts" | "directory" | "startDirect" | "onSelect" | "onClose" | "onOpen">) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ApiUser[]>(contacts);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    if (!query.trim()) return;
    const timer = setTimeout(() => { void directory(query.trim()).then(value => { if (active) setResults(value); }).catch(error => { if (active) setNotice(error.message); }); }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [query, directory]);
  async function openPerson(userId: number) {
    setBusy(true); setNotice("");
    try { onSelect(await startDirect(userId)); onClose(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not open chat."); }
    finally { setBusy(false); }
  }
  const visible = query.trim() ? results : contacts;
  return <div className="dialog-form"><label htmlFor="contact-search">Find a user</label><input id="contact-search" type="search" placeholder="Search by name or username" value={query} onChange={event => { setQuery(event.target.value); setNotice(""); }} />
    <div className="new-chat-actions"><button onClick={() => onOpen("new-contact")}><Icon name="plus" />New contact</button><button onClick={() => onOpen("new-group")}><Icon name="group" />New group</button></div>
    <p className="section-label">{query ? "DIRECTORY RESULTS" : "YOUR CONTACTS"}</p><div className="contact-options">{visible.map(person => <button key={person.id} disabled={busy} onClick={() => { void openPerson(person.id); }}><Avatar avatar={person.avatar_key} name={person.display_name} size={40} /><span>{person.display_name}<small>@{person.username}</small></span></button>)}</div>
    {visible.length === 0 && <p>{query ? "No users found." : "No contacts yet. Search for a username to start a chat."}</p>}
    {notice && <p className="error" role="alert">{notice}</p>}</div>;
}

function GroupDetails({ conversation, data, profile, changeGroup, directory }: Pick<Props, "data" | "profile" | "changeGroup" | "directory"> & { conversation: Conversation }) {
  const [name, setName] = useState(conversation.name);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ApiUser[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const admin = conversation.memberRoles?.[profile.id] === "admin";
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => { if (query.trim()) void directory(query).then(users => { if (active) setResults(users); }).catch(error => { if (active) setNotice(error.message); }); }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [query, directory]);
  async function change(action: "rename" | "add" | "remove", value: string | number[]) {
    setBusy(true); setNotice("");
    try { await changeGroup(conversation.id, action, value); setNotice("Group updated."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not update group."); }
    finally { setBusy(false); }
  }
  return <div className="group-details"><div className="details-hero"><Avatar avatar="group" name={conversation.name} size={88} /><h3>{conversation.name}</h3><p>{conversation.members.length} members · saved group</p></div>
    {admin && <div className="dialog-form"><form className="dialog-form" onSubmit={event => { event.preventDefault(); void change("rename", name); }}><label htmlFor="rename-group">Group name</label><input id="rename-group" value={name} onChange={event => setName(event.target.value)} required maxLength={100} /><button className="secondary-button" disabled={busy}>Rename group</button></form>
      <label htmlFor="add-member">Add members</label><input id="add-member" placeholder="Search username" value={query} onChange={event => setQuery(event.target.value)} />
      {query.trim() && results.filter(person => !conversation.members.includes(String(person.id))).map(person => <button key={person.id} className="secondary-button" disabled={busy} onClick={() => { void change("add", [person.id]); }}>Add {person.display_name}</button>)}
    </div>}
    {!admin && <p className="preview-note">Only admins can change this group.</p>}
    {notice && <p role="status">{notice}</p>}
    <h4>Members</h4>{conversation.members.map(id => <div className="member-row" key={id}><Avatar avatar={data.people[id]?.avatar ?? "sky"} name={data.people[id]?.name ?? "Member"} size={40} /><span>{data.people[id]?.name ?? "Member"}<small>{conversation.memberRoles?.[id] === "admin" ? "Admin" : "Member"}</small></span>{admin && <button className="text-button" disabled={busy} onClick={() => { void change("remove", id); }} aria-label={"Remove " + (data.people[id]?.name ?? "Member")}>Remove</button>}</div>)}</div>;
}

export function MessengerDialog(props: Props) {
  const { kind, onClose, onOpen, data, profile, conversation, onSelect } = props;
  const titles: Record<Exclude<DialogState, null>, string> = { "new-chat": "New message", "new-contact": "New contact", "new-group": "New group", settings: "Settings", members: "Group details", contact: "Contact details", "search-chat": "Search conversation", about: "About this preview", Calls: "Calls", Stories: "Stories" };
  return <Dialog key={kind} title={titles[kind]} onClose={onClose} wide={kind === "settings"} side={kind === "members"}>
    {kind === "new-chat" && <NewChat contacts={props.contacts} directory={props.directory} startDirect={props.startDirect} onSelect={onSelect} onClose={onClose} onOpen={onOpen} />}
    {kind === "new-contact" && <NewContact directory={props.directory} addContact={props.addContact} />}
    {kind === "new-group" && <NewGroup data={data} profile={profile} createGroup={props.createGroup} onSelect={onSelect} onClose={onClose} />}
    {kind === "settings" && <Settings profile={profile} onLogout={props.onLogout} busy={props.busy} />}
    {kind === "search-chat" && <ChatSearch data={data} conversation={conversation} />}
    {kind === "members" && conversation && <GroupDetails conversation={conversation} data={data} profile={profile} changeGroup={props.changeGroup} directory={props.directory} />}
    {kind === "contact" && conversation && <div className="details-hero"><Avatar avatar={conversation.avatar} name={conversation.name} size={88} /><h3>{conversation.name}</h3><p>@{conversation.members.map(id => data.people[id]).find(person => person?.id !== String(profile.id))?.username ?? "contact"}</p><p className="preview-note">Last seen recently is a mocked demo status.</p></div>}
    {kind === "about" && <div className="about-preview"><Icon name="chat" size={44} /><h3>Your conversations</h3><p>Direct and group messages are saved in SQLite. Sent means saved, delivered means acknowledged by recipients, and read means displayed in their visible chat. Group admins manage membership; typing is temporary.</p><p>Presence is mocked. No real end-to-end encryption is implemented.</p></div>}
    {(kind === "Calls" || kind === "Stories") && <div className="coming-soon"><Icon name={kind === "Calls" ? "phone" : "stories"} size={48} /><h3>{kind} are coming soon</h3><p>This section is a placeholder for the assignment.</p></div>}
  </Dialog>;
}
