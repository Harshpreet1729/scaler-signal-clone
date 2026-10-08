import { backendHealthUrl } from "../../../../lib/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    const response = await fetch(backendHealthUrl(), {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(3000),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("Backend health failed");
    const body: unknown = await response.json();
    if (
      typeof body !== "object" || body === null ||
      !("status" in body) || body.status !== "ok" ||
      !("service" in body) || body.service !== "scaler-signal-api"
    ) {
      throw new Error("Unexpected backend health response");
    }
    // Reconstruct the public contract so unexpected upstream fields cannot leak.
    return Response.json({ status: body.status, service: body.service }, { headers });
  } catch {
    return Response.json(
      { error: { code: "BACKEND_UNAVAILABLE", message: "Backend health is unavailable." } },
      { status: 503, headers },
    );
  }
}
