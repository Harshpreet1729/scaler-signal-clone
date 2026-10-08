import type { ReactNode } from "react";
export type IconName = "menu" | "chat" | "phone" | "video" | "stories" | "settings" | "compose" | "more" | "search" | "filter" | "close" | "back" | "plus" | "send" | "smile" | "paperclip" | "group" | "bell" | "shield" | "sun" | "chevron" | "logout" | "check";
const paths: Record<IconName, ReactNode> = {
  menu: <path d="M5 6h14M5 12h14M5 18h14" />,
  chat: <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 10 10 0 0 1-4-.8L3 21l1.8-5.5a9 9 0 0 1-.8-4A8.5 8.5 0 0 1 12.5 3a8.5 8.5 0 0 1 8.5 8.5Z" />,
  phone: <path d="m7 3-3 2c-2 4 7 15 12 15l4-3-4-4-3 2-4-4 2-3-4-5Z" />,
  video: <><rect x="3" y="5" width="12" height="14" rx="3" /><path d="m15 9 6-3v12l-6-3Z" /></>,
  stories: <><rect x="8" y="3" width="11" height="17" rx="3" /><path d="m5 7-2 1 2 12q.4 2 3 1" /></>,
  settings: <><path d="m9 3 1-1h4l1 3 3 2 3 1v4l-2 2-1 3v3l-4 2-2-2-3-1-3 1-2-4 1-2-1-3-2-2 2-4 3 1Z" transform="translate(1 0) scale(.9)" /><circle cx="12" cy="12" r="3" /></>,
  compose: <><path d="M12 4H6a3 3 0 0 0-3 3v11a3 3 0 0 0 3 3h11a3 3 0 0 0 3-3v-6M14 3l3-1 5 5-2 3-9 8-5 1 1-5Z" /><path d="m14 4 5 5" /></>,
  more: <><circle cx="4" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="20" cy="12" r="1" fill="currentColor" /></>,
  search: <><circle cx="10" cy="10" r="6.5" /><path d="m15 15 6 6" /></>,
  filter: <path d="M3 6h18M6 12h12M10 18h4" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  back: <path d="m14 5-7 7 7 7M7 12h14" />,
  plus: <path d="M12 4v16M4 12h16" />,
  send: <><path d="m3 3 19 9-19 9 4-9Z" /><path d="M7 12h15" /></>,
  smile: <><circle cx="12" cy="12" r="9" /><path d="M8 14q4 5 8 0M8 9h.01M16 9h.01" /></>,
  paperclip: <path d="m8 13 7-7q4-3 6 1 1 2-1 4L10 21Q5 24 2 19q-2-3 1-6L14 2M6 15l9-9q1-1 2 1L8 17q-2 1-2-2Z" />,
  group: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M17 14q4 0 4 6" /></>,
  bell: <><path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5ZM10 21h4" /></>,
  shield: <><path d="m12 2 8 4v7c0 5-8 9-8 9s-8-4-8-9V6Z" /><path d="m8 12 3 3 5-6" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 1v2M12 21v2M1 12h2M21 12h2M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2" /></>,
  chevron: <path d="m9 5 7 7-7 7" />,
  logout: <><path d="M9 3H4v18h5M10 12h12m-5-5 5 5-5 5" /></>,
  check: <path d="m5 12 4 4L19 6" />,
};
/** Original path drawings; no copied Signal assets or icon dependency. */
export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
