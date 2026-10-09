export type Profile = { id: number; username: string; display_name: string; avatar_key: string };
export type Person = { id: string; name: string; username: string; avatar: string; color: string };
export type ReceiptState = "sending" | "sent" | "delivered" | "read" | "failed";
export type Reaction = { emoji: string; count: number; user_ids: number[] };
export type ReactToMessage = (conversationId: string, messageId: string, emoji: string, active: boolean) => Promise<void>;
export type ChatMessage = {
  id: string; sender: string; body: string; time: string; date: string;
  direction: "incoming" | "outgoing"; receipt?: ReceiptState; unread?: boolean; clientMessageId?: string;
  reactions?: Reaction[];
};
export type Conversation = {
  id: string; name: string; kind: "direct" | "group"; avatar: string;
  preview: string; time: string; activityOrder: number; unread: number;
  members: readonly string[]; lastReceipt?: ReceiptState;
  memberRoles?: Readonly<Record<string, "admin" | "member">>;
};
/** Presentation contract. Phase 4 can supply authorized API data with the same view models. */
export type MessengerData = {
  source: "preview" | "connected";
  conversations: readonly Conversation[];
  people: Readonly<Record<string, Person>>;
  messages: Readonly<Record<string, readonly ChatMessage[]>>;
};
export type SendMessage = (conversationId: string, body: string) => Promise<void>;
