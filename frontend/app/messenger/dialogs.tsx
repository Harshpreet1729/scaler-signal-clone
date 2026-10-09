import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "./icons";
import { Avatar, Dialog } from "./primitives";
import type { Conversation, MessengerData, Profile } from "./types";
import type { ApiUser } from "./use-chat-data";

export type DialogState = "new-contact" | "new-group" | "members" | "contact" | "about" | "Calls" | "Stories" | null;
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
  const { kind, onClose, data, profile, conversation, onSelect } = props;
  const titles: Record<Exclude<DialogState, null>, string> = { "new-contact": "New contact", "new-group": "New group", members: "Group details", contact: "Contact details", about: "About this preview", Calls: "Calls", Stories: "Stories" };
  return <Dialog key={kind} title={titles[kind]} onClose={onClose} side={kind === "members"}>
    {kind === "new-contact" && <NewContact directory={props.directory} addContact={props.addContact} />}
    {kind === "new-group" && <NewGroup data={data} profile={profile} createGroup={props.createGroup} onSelect={onSelect} onClose={onClose} />}
    {kind === "members" && conversation && <GroupDetails conversation={conversation} data={data} profile={profile} changeGroup={props.changeGroup} directory={props.directory} />}
    {kind === "contact" && conversation && <div className="details-hero"><Avatar avatar={conversation.avatar} name={conversation.name} size={88} /><h3>{conversation.name}</h3><p>@{conversation.members.map(id => data.people[id]).find(person => person?.id !== String(profile.id))?.username ?? "contact"}</p><p className="preview-note">Last seen recently is a mocked demo status.</p></div>}
    {kind === "about" && <div className="about-preview"><Icon name="chat" size={44} /><h3>Your conversations</h3><p>Direct and group messages are saved in SQLite. Sent means saved, delivered means acknowledged by recipients, and read means displayed in their visible chat. Group admins manage membership; typing is temporary.</p><p>Presence is mocked. No real end-to-end encryption is implemented.</p></div>}
    {(kind === "Calls" || kind === "Stories") && <div className="coming-soon"><Icon name={kind === "Calls" ? "phone" : "stories"} size={48} /><h3>{kind} are coming soon</h3><p>This section is a placeholder for the assignment.</p></div>}
  </Dialog>;
}
