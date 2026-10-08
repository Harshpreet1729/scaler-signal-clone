import { forwardChat } from "../../../lib/chat-gateway";
export function GET(request: Request) { return forwardChat(request, "contacts"); }
export function POST(request: Request) { return forwardChat(request, "contact-add"); }
