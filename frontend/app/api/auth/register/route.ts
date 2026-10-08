import { forwardAuth } from "../../../../lib/auth-gateway";
export function POST(request: Request) { return forwardAuth(request, "register"); }
