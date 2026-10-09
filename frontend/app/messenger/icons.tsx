import type { ReactNode } from "react";
export type IconName = "menu" | "chat" | "phone" | "video" | "stories" | "settings" | "compose" | "more" | "search" | "filter" | "close" | "back" | "plus" | "send" | "smile" | "paperclip" | "group" | "bell" | "shield" | "sun" | "appearance" | "account" | "chevron" | "logout" | "check" | "user" | "at" | "lock" | "data" | "info" | "microphone";
const paths: Record<IconName, ReactNode> = {
  menu: <path d="M5 6h14M5 12h14M5 18h14" />,
  chat: <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 10 10 0 0 1-4-.8L3 21l1.8-5.5a9 9 0 0 1-.8-4A8.5 8.5 0 0 1 12.5 3a8.5 8.5 0 0 1 8.5 8.5Z" />,
  phone: <path d="M7.1 3.1a1.4 1.4 0 0 0-2 0L3.6 4.6c-2 2 0 6.8 4.3 11.1s9.1 6.3 11.1 4.3l1.5-1.5a1.4 1.4 0 0 0 0-2l-2.7-2.7a1.4 1.4 0 0 0-2 0l-1.4 1.4a13.8 13.8 0 0 1-5.6-5.6l1.4-1.4a1.4 1.4 0 0 0 0-2Z" />,
  video: <><rect x="3" y="5" width="12" height="14" rx="3" /><path d="m15 9 6-3v12l-6-3Z" /></>,
  stories: <><rect x="8.5" y="2.5" width="11.5" height="19" rx="2.8" /><path d="m5.5 6-1.6.4a2.3 2.3 0 0 0-1.6 2.8l2.6 10a2.3 2.3 0 0 0 2.4 1.7" /></>,
  settings: <path fillRule="evenodd" d="m10 2-.7 2.1-1.5.9-2.2-.4-2 3.5 1.5 1.7v2.4l-1.5 1.7 2 3.5 2.2-.4 1.5.9.7 2.1h4l.7-2.1 1.5-.9 2.2.4 2-3.5-1.5-1.7V9.9l1.5-1.7-2-3.5-2.2.4-1.5-.9L14 2ZM15 11.1a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" transform="translate(0 .9)" />,
  compose: <><path d="M12 4H7a4 4 0 0 0-4 4v9a4 4 0 0 0 4 4h9a4 4 0 0 0 4-4v-6.5" /><path d="m8.5 15.5 1-4 9.1-9.1a1.84 1.84 0 0 1 2.6 2.6l-9.1 9.1Z" /></>,
  more: <g fill="currentColor" stroke="none"><circle cx="4" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="20" cy="12" r="1.4" /></g>,
  search: <><circle cx="10.5" cy="10.5" r="7" /><path d="m16 16 5 5" /></>,
  filter: <path d="M3 8h18M7 12h10M10 16h4" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  back: <path d="m14.5 4.5-7.5 7.5 7.5 7.5" />,
  plus: <path d="M12 4v16M4 12h16" />,
  send: <><path d="m3 3 19 9-19 9 4-9Z" /><path d="M7 12h15" /></>,
  smile: <><circle cx="12" cy="12" r="9" /><path d="M8 14q4 5 8 0M8 9h.01M16 9h.01" /></>,
  paperclip: <path d="m8 13 7-7q4-3 6 1 1 2-1 4L10 21Q5 24 2 19q-2-3 1-6L14 2M6 15l9-9q1-1 2 1L8 17q-2 1-2-2Z" />,
  group: <><circle cx="8" cy="7" r="3" /><circle cx="17" cy="7" r="3" /><path d="M2.5 20v-2a5.5 5.5 0 0 1 11 0v2ZM15.5 13a5.5 5.5 0 0 1 6 5v2h-5" /></>,
  bell: <path d="M5 17h14c-1.6-1.7-2-3-2-5V9a5 5 0 0 0-10 0v3c0 2-.4 3.3-2 5ZM10 20a2 2 0 0 0 4 0" />,
  shield: <><path d="m12 2 8 4v7c0 5-8 9-8 9s-8-4-8-9V6Z" /><path d="m8 12 3 3 5-6" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 1v2M12 21v2M1 12h2M21 12h2M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2" /></>,
  appearance: <><path d="m12 2 3 3h4v4l3 3-3 3v4h-4l-3 3-3-3H5v-4l-3-3 3-3V5h4Z" /><path d="M12 7.5a4.5 4.5 0 0 1 0 9Z" fill="currentColor" stroke="none" /></>,
  account: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="8.5" r="2.6" /><path d="M6.5 18v-.5a5.5 5.5 0 0 1 11 0v.5" /></>,
  chevron: <path d="m9 5 7 7-7 7" />,
  logout: <><path d="M9 3H4v18h5M10 12h12m-5-5 5 5-5 5" /></>,
  user: <><circle cx="12" cy="7" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2Z" /></>,
  at: <><circle cx="11" cy="12" r="4" /><path d="M15 8v7q0 3 4 1 3-2 2-6A9 9 0 1 0 16 20" /></>,
  lock: <><rect x="5" y="10" width="14" height="12" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0v4M12 15v3" /></>,
  data: <><circle cx="12" cy="12" r="9" /><path d="M12 3v9l6 6M12 12l6-6" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
  microphone: <><rect x="9" y="2" width="6" height="13" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" /></>,
  check: <path d="m5 12 4 4L19 6" />,
};
/** Original path drawings; no copied Signal assets or icon dependency. */
export function Icon({ name, size = 22, filled = false }: { name: IconName; size?: number; filled?: boolean }) {
  return <svg data-icon={name} width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={name === "compose" ? 1.8 : 1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
