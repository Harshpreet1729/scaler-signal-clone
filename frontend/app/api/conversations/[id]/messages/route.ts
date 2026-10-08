import { forwardChat } from "../../../../../lib/chat-gateway";
export async function GET(request: Request, context: RouteContext<"/api/conversations/[id]/messages">) {
  return forwardChat(request, "history", (await context.params).id);
}
export async function POST(request: Request, context: RouteContext<"/api/conversations/[id]/messages">) {
  return forwardChat(request, "send", (await context.params).id);
}
