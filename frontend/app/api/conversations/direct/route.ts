import { forwardChat } from "../../../../lib/chat-gateway";
export function POST(request: Request) { return forwardChat(request, "direct-create"); }
