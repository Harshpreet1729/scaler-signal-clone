import { forwardChat } from "../../../../../lib/chat-gateway";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) { return forwardChat(request, "members", (await context.params).id); }
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) { return forwardChat(request, "member-add", (await context.params).id); }
