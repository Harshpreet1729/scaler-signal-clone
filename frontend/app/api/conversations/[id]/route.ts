import { forwardChat } from "../../../../lib/chat-gateway";
export async function GET(request: Request, context: RouteContext<"/api/conversations/[id]">) {
  return forwardChat(request, "detail", (await context.params).id);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) { return forwardChat(request, "group-rename", (await context.params).id); }
