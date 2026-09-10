import { getThread } from "@bb/db";
import type { P6rIdentityBoundaryConfig } from "@bb/config/server";
import type { createNodeWebSocket } from "@hono/node-ws";
import type { Hono } from "hono";
import { ApiError } from "../errors.js";
import { browserRequestProblem } from "../browser-request-guard.js";
import { getTrustedRemoteAddress } from "../request-context.js";
import type { ServerRuntimeConfig } from "../types.js";
import type { P6rBrowserLineage } from "../services/p6r/browser-lineage.js";
import type { P6rNativePresenceService } from "../services/p6r/native-presence.js";
import type { P6rNativeWebSocketIdentityAdmission } from "../services/p6r/native-websocket-admission.js";

type UpgradeWebSocket = ReturnType<
  typeof createNodeWebSocket
>["upgradeWebSocket"];

export function registerNativePresenceWebSocket(
  app: Hono,
  input: {
    readonly boundary: () => P6rIdentityBoundaryConfig | null;
    readonly db: import("@bb/db").DbConnection;
    readonly deps: Pick<
      ServerRuntimeConfig,
      "appUrl" | "devAppPort" | "serverPort"
    >;
    readonly identity: P6rNativeWebSocketIdentityAdmission;
    readonly lineage: P6rBrowserLineage;
    readonly presence: P6rNativePresenceService;
    readonly upgradeWebSocket: UpgradeWebSocket;
  },
): void {
  app.get(
    "/ws/threads/:threadId/presence",
    input.upgradeWebSocket(async (context) => {
      const browserProblem = browserRequestProblem(context, {
        config: input.deps,
      });
      if (browserProblem !== null) {
        throw new ApiError(
          browserProblem.status,
          "forbidden_origin",
          browserProblem.error,
          false,
        );
      }
      const boundary = input.boundary();
      const remoteAddress = getTrustedRemoteAddress(context);
      const trustedIngress = boundary?.trustedIngresses.find((candidate) =>
        candidate.remoteAddresses.includes(remoteAddress ?? ""),
      );
      if (trustedIngress !== undefined) await input.lineage.restore(context);
      const admission = await input.identity.admit(context);
      if (admission.status === "baseline") {
        throw new ApiError(
          501,
          "identity_unsupported",
          "Native presence requires an identity boundary",
          false,
        );
      }
      if (admission.status === "blocked") {
        throw new ApiError(
          admission.error.code === "unauthenticated" ? 401 : 503,
          "identity_unavailable",
          "Native presence identity is unavailable",
          false,
        );
      }
      const threadId = context.req.param("threadId");
      const thread = getThread(input.db, threadId);
      if (thread === null || thread.deletedAt !== null) {
        admission.release();
        throw new ApiError(404, "thread_not_found", "Thread not found", false);
      }
      return {
        onOpen: (_event, socket) =>
          input.presence.open({
            admission,
            socket,
            threadId,
          }),
        onMessage: (event, socket) =>
          input.presence.receive(socket, event.data),
        onClose: (_event, socket) => input.presence.close(socket),
        onError: (_event, socket) => input.presence.close(socket),
      };
    }),
  );
}
