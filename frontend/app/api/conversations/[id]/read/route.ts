import { forwardChat } from "../../../../../lib/chat-gateway";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) { return forwardChat(request, "read", (await context.params).id); }
