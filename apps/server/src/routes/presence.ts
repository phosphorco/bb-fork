import {
  p6rPresenceSnapshotResponseSchema,
  publicApiRoutes,
  typedRoutes,
  type PublicApiSchema,
} from "@bb/server-contract";
import type { Hono } from "hono";
import { ApiError } from "../errors.js";
import type { AppDeps } from "../types.js";

export function p6rRegisterPresenceRoutes(app: Hono, deps: AppDeps): void {
  const { get } = typedRoutes<PublicApiSchema>(app, {
    onValidationError: (message) =>
      new ApiError(400, "invalid_request", message),
  });

  get(publicApiRoutes.p6rPresence.p6rSnapshot, (context) => {
    const snapshot = p6rPresenceSnapshotResponseSchema.parse(
      deps.hub.p6rGetPresenceSnapshot(),
    );
    return context.json(snapshot);
  });
}
