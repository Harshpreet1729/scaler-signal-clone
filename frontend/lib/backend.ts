import "server-only";

/** Resolve only the fixed public health endpoint; browser input is never used. */
export function backendOrigin(): URL {
  const base = new URL(process.env.BACKEND_BASE_URL ?? "http://127.0.0.1:8000");
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username || base.password || base.pathname !== "/" ||
    base.search || base.hash
  ) {
    throw new Error("BACKEND_BASE_URL must be an HTTP(S) origin");
  }
  return base;
}

export function backendHealthUrl(): URL {
  return new URL("/v1/health/live", backendOrigin());
}
