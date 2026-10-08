import { forwardAuth } from "../../../../lib/auth-gateway";
export function GET(request: Request) { return forwardAuth(request, "me"); }
