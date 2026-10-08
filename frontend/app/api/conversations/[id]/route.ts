import { forwardChat } from "../../../../lib/chat-gateway";
export async function GET(request: Request, context: RouteContext<"/api/conversations/[id]">) {
  return forwardChat(request, "detail", (await context.params).id);
}
