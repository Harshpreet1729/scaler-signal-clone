import { forwardChat } from "../../../../lib/chat-gateway";
export async function POST(request: Request) { return forwardChat(request, "group-create"); }
