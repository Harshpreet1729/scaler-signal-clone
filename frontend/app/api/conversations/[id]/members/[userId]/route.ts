import { forwardChat } from "../../../../../../lib/chat-gateway";
export async function DELETE(request: Request, context: { params: Promise<{ id: string; userId: string }> }) { const { id, userId } = await context.params; return forwardChat(request, "member-remove", id, userId); }
