import { forwardChat } from "../../../lib/chat-gateway";
export function GET(request: Request) { return forwardChat(request, "conversations"); }
