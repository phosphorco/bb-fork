import type { HeaderPair } from "@bb/tunnel-contract";

const SKIP_REQUEST_HEADERS = new Set([
  "host",
  "content-length",
  "connection",
  "x-p6r-via-tunnel",
]);

export const P6R_TUNNEL_ORIGIN_HEADER = "x-p6r-via-tunnel";

interface LoopbackHeaderRewrite {
  publicOrigin: string;
  loopbackOrigin: string;
  /** Stamp the trusted marker when this header set is re-issued by a tunnel. */
  p6rMarkTunnelOrigin?: boolean;
  /**
   * When set, inject a Host header (share streams). When omitted, Host is
   * dropped — bare-handle behavior, byte-identical to pre-share.
   */
  host?: string;
}

export function headersForLoopbackRequest(
  headers: HeaderPair[],
  rewrite: LoopbackHeaderRewrite,
): Record<string, string> {
  const forwarded: Record<string, string> = {};
  for (const [name, value] of headers) {
    const lowerName = name.toLowerCase();
    if (SKIP_REQUEST_HEADERS.has(lowerName)) continue;
    forwarded[name] =
      lowerName === "origin" && value === rewrite.publicOrigin
        ? rewrite.loopbackOrigin
        : value;
  }
  if (rewrite.host !== undefined) {
    forwarded.Host = rewrite.host;
  }
  if (rewrite.p6rMarkTunnelOrigin) {
    forwarded[P6R_TUNNEL_ORIGIN_HEADER] = "1";
  }
  return forwarded;
}
