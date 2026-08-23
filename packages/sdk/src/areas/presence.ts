import type { P6rPresenceSnapshotResponse } from "@bb/server-contract";
import type { CreateSdkAreaArgs } from "./common.js";

export type P6rPresenceGetResult = P6rPresenceSnapshotResponse;

export interface P6rPresenceArea {
  p6rGet(): Promise<P6rPresenceGetResult>;
}

export function p6rCreatePresenceArea(
  args: CreateSdkAreaArgs,
): P6rPresenceArea {
  return {
    p6rGet() {
      return args.transport.readJson(
        args.transport.api.v1["p6r-presence"].$get({}),
      );
    },
  };
}
