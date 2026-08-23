import {
  createBbSdk,
  createBuiltinPlanCommandTextInput,
  type BbSdk,
  type BbSdkAreas,
} from "./core.js";
import { createHttpTransport } from "./transport-http.js";
import type {
  BbRealtimeSocketFactory,
  BbSdkContext,
  BbSdkTransport,
} from "./transport.js";

import type { P6rClaimedIdentity } from "@bb/domain";

export interface CreateBrowserTransportArgs {
  baseUrl?: string;
  p6rClaimedIdentity?: P6rClaimedIdentity;
  fetch?: typeof fetch;
  realtimeUrl?: string;
  websocket?: BbRealtimeSocketFactory;
}

export interface CreateBrowserBbSdkArgs extends CreateBrowserTransportArgs {
  context?: BbSdkContext;
}

/**
 * The browser SDK has every server-backed area but no `guide`. The guide is a
 * local, template-only area for the CLI and Node SDK; attaching it here would
 * ship its generated markdown in the web app's boot chunk.
 */
export type BrowserBbSdk = BbSdkAreas;

export function createBrowserTransport(
  args: CreateBrowserTransportArgs = {},
): BbSdkTransport {
  return createHttpTransport({
    baseUrl: args.baseUrl,
    ...(args.p6rClaimedIdentity
      ? { p6rClaimedIdentity: args.p6rClaimedIdentity }
      : {}),
    fetch: args.fetch,
    realtimeUrl: args.realtimeUrl,
    runtime: "browser",
    websocket: args.websocket,
  });
}

export function createBrowserBbSdk(
  args: CreateBrowserBbSdkArgs = {},
): BrowserBbSdk {
  return createBbSdk({
    context: args.context,
    transport: createBrowserTransport(args),
  });
}

export const bb = createBrowserBbSdk();

export { BbHttpError, BbRequestTimeoutError } from "./response.js";

export type { BbHttpErrorArgs } from "./response.js";
export { createBbSdk, createBuiltinPlanCommandTextInput, createHttpTransport };
export type { BbSdk, BbSdkAreas, BbSdkContext, BbSdkTransport };
export type * from "./areas/skills.js";
export type * from "./public-types.js";
