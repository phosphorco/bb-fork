import { createApiClient } from "@bb/server-contract";
import {
  P6R_CLAIMED_IDENTITY_HEADER,
  p6rEncodeClaimedIdentityHeader,
} from "@bb/domain";
import {
  readJsonResponse,
  readVoidResponse,
  resolveResponse,
} from "./response.js";
import type { BbSdkTransport, CreateHttpTransportArgs } from "./transport.js";
import type { FetchImplementation } from "./response.js";

const SAME_ORIGIN_BASE_URL = "";

export function createHttpTransport(
  args: CreateHttpTransportArgs,
): BbSdkTransport {
  const baseUrl = args.baseUrl ?? SAME_ORIGIN_BASE_URL;
  const baseFetch = args.fetch ?? fetch;
  const p6rClaimedIdentityHeader = args.p6rClaimedIdentity
    ? p6rEncodeClaimedIdentityHeader(args.p6rClaimedIdentity)
    : undefined;
  const fetchImpl: FetchImplementation = p6rClaimedIdentityHeader
    ? (input, init) => {
        const headers = new Headers(
          input instanceof Request ? input.headers : undefined,
        );
        new Headers(init?.headers).forEach((value, name) => {
          headers.set(name, value);
        });
        headers.set(P6R_CLAIMED_IDENTITY_HEADER, p6rClaimedIdentityHeader);
        return baseFetch(input, { ...init, headers });
      }
    : baseFetch;
  const client = createApiClient(baseUrl, { fetch: fetchImpl });

  return {
    api: client.api,
    baseUrl,
    ...(p6rClaimedIdentityHeader ? { p6rClaimedIdentityHeader } : {}),
    fetch: fetchImpl,
    ...(args.realtimeUrl ? { realtimeUrl: args.realtimeUrl } : {}),
    runtime: args.runtime,
    websocket: args.websocket,
    readJson: readJsonResponse,
    readVoid: readVoidResponse,
    resolve: resolveResponse,
  };
}
