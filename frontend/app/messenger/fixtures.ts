import type { MessengerData } from "./types";

/** Public, fictional visual fixtures. Never loaded from or written to the SQLite seed. */
export const previewData: MessengerData = {
  source: "preview",
  people: {
    alice: { id: "alice", name: "Alice Morgan", username: "alice", avatar: "sky", color: "#946224" },
    bob: { id: "bob", name: "Bob Patel", username: "bob", avatar: "fern", color: "#34725a" },
    carol: { id: "carol", name: "Carol Chen", username: "carol", avatar: "sun", color: "#8155b9" },
    dave: { id: "dave", name: "Dave Rivera", username: "dave", avatar: "clay", color: "#ba4f4f" },
  },
  conversations: [
    { id: "bob", name: "Bob Patel", kind: "direct", avatar: "fern", preview: "Perfect, see you there!", time: "1m", activityOrder: 40, unread: 1, members: ["alice", "bob"] },
    { id: "weekend", name: "Weekend Plans", kind: "group", avatar: "group", preview: "Carol: I'll bring something to share.", time: "2m", activityOrder: 30, unread: 2, members: ["alice", "bob", "carol"] },
    { id: "carol", name: "Carol Chen", kind: "direct", avatar: "sun", preview: "That sounds like a good plan.", time: "10m", activityOrder: 20, unread: 0, members: ["alice", "carol"], lastReceipt: "read" },
    { id: "dave", name: "Dave Rivera", kind: "direct", avatar: "clay", preview: "You: Have a good evening!", time: "Yesterday", activityOrder: 10, unread: 0, members: ["alice", "dave"], lastReceipt: "delivered" },
  ],
  messages: {
    bob: [
      { id: "b1", sender: "bob", body: "Hey Alice! Are we still on for Saturday?", time: "10:32", date: "Today", direction: "incoming" },
      { id: "b2", sender: "alice", body: "Absolutely. I was thinking we could try the riverside park.", time: "10:33", date: "Today", direction: "outgoing", receipt: "read" },
      { id: "b3", sender: "alice", body: "It's supposed to be sunny all afternoon ☀️", time: "10:33", date: "Today", direction: "outgoing", receipt: "read" },
      { id: "b4", sender: "bob", body: "That sounds great. Shall we meet by the main entrance?", time: "10:34", date: "Today", direction: "incoming" },
      { id: "b5", sender: "bob", body: "I can bring coffee on the way.", time: "10:34", date: "Today", direction: "incoming" },
      { id: "b6", sender: "alice", body: "Coffee would be lovely. Let's say 12?", time: "10:35", date: "Today", direction: "outgoing", receipt: "read" },
      { id: "b7", sender: "bob", body: "Perfect, see you there!", time: "10:36", date: "Today", direction: "incoming" },
    ],
    weekend: [
      { id: "g1", sender: "carol", body: "Does anyone have plans for the weekend?", time: "10:24", date: "Today", direction: "incoming" },
      { id: "g2", sender: "alice", body: "How about a picnic at the riverside park on Saturday?", time: "10:25", date: "Today", direction: "outgoing", receipt: "read" },
      { id: "g3", sender: "bob", body: "I'm in! The weather looks perfect.", time: "10:26", date: "Today", direction: "incoming" },
      { id: "g4", sender: "carol", body: "Yes! We haven't all caught up in a while.", time: "10:27", date: "Today", direction: "incoming" },
      { id: "g5", sender: "alice", body: "Let's meet at the main entrance at noon.", time: "10:28", date: "Today", direction: "outgoing", receipt: "read" },
      { id: "g6", sender: "bob", body: "I'll bring a blanket and some snacks.", time: "10:29", date: "Today", direction: "incoming" },
      { id: "g7", sender: "alice", body: "Sounds good. Looking forward to it!", time: "10:30", date: "Today", direction: "outgoing", receipt: "delivered" },
      { id: "g8", sender: "carol", body: "I'll bring something to share.", time: "10:35", date: "Today", direction: "incoming" },
    ],
    carol: [
      { id: "c1", sender: "carol", body: "The riverside park has some lovely picnic spots.", time: "09:48", date: "Today", direction: "incoming" },
      { id: "c2", sender: "carol", body: "There's a quiet area just past the bridge.", time: "09:49", date: "Today", direction: "incoming" },
      { id: "c3", sender: "alice", body: "That sounds like a good plan.", time: "10:27", date: "Today", direction: "outgoing", receipt: "read" },
    ],
    dave: [
      { id: "d1", sender: "dave", body: "Thanks for the book recommendation, Alice.", time: "18:02", date: "Yesterday", direction: "incoming" },
      { id: "d2", sender: "alice", body: "You're welcome! Let me know what you think.", time: "18:03", date: "Yesterday", direction: "outgoing", receipt: "read" },
      { id: "d3", sender: "alice", body: "Have a good evening!", time: "18:04", date: "Yesterday", direction: "outgoing", receipt: "delivered" },
    ],
  },
};
