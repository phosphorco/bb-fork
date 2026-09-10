import { ApiError } from "../../errors.js";
import type { AppDeps } from "../../types.js";
import type {
  P6rNativeRequestAdmission,
  P6rNativeRequestContext,
} from "./native-http-admission.js";
import type { P6rNativeWriteOrigin } from "./sidecar-store.js";

function readyOrigin(
  admission: Extract<P6rNativeRequestAdmission, { readonly status: "ready" }>,
): P6rNativeWriteOrigin {
  const actor = admission.session.actor;
  return Object.freeze({
    acceptedAuthorship: Object.freeze({
      evidence: actor.evidence,
      identity: Object.freeze({
        issuer: actor.identity.issuer,
        key: actor.identity.key,
        kind: "person" as const,
        subject: actor.identity.subject,
      }),
      presentation: Object.freeze({
        avatarUrl: actor.presentation.avatarUrl,
        displayName: actor.presentation.displayName,
        handle: actor.presentation.handle,
      }),
    }),
    validate: () => admission.validate(),
  });
}

function internalOrigin(
  admission: Extract<P6rNativeRequestAdmission, { readonly status: "internal" }>,
): P6rNativeWriteOrigin {
  return Object.freeze({
    acceptedAuthorship: Object.freeze({
      kind: "system" as const,
      reason: "plugin-sdk",
    }),
    validate: () => admission.validate(),
  });
}

/**
 * Acquires the request's sole attribution decision and keeps a ready human
 * admission alive only until the route completes. Direct HTTP has no special
 * treatment: it is either admitted as a configured human or is blocked.
 */
export async function withP6rOrdinaryWriteAttribution<T>(
  deps: AppDeps,
  context: P6rNativeRequestContext,
  write: (origin: P6rNativeWriteOrigin | null) => Promise<T>,
): Promise<T> {
  const admission =
    deps.nativeRequestAdmission === undefined
      ? ({ status: "baseline", validate: () => ({ ok: true } as const) } as const)
      : await deps.nativeRequestAdmission(context);

  if (admission.status === "blocked") {
    throw new ApiError(
      admission.error.code === "unauthenticated" ? 401 : 503,
      "identity_unavailable",
      "Native identity admission is unavailable",
      false,
    );
  }
  if (admission.status === "baseline") return write(null);
  if (admission.status === "internal") return write(internalOrigin(admission));

  try {
    return await write(readyOrigin(admission));
  } finally {
    admission.release();
  }
}
