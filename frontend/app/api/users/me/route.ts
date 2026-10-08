import { forwardAuth } from "../../../../lib/auth-gateway";
export function PATCH(request: Request) { return forwardAuth(request, "profile"); }
