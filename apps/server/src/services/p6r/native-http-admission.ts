import type { P6rReadySession } from "./identity-protocol.js";
import type { P6rValidity } from "./invocation-registry.js";
import type {
  P6rNativeHttpAdmission,
  P6rProviderAdmission,
} from "./provider-admission.js";

export type P6rNativeIdentityStatus =
  | {
      readonly actor: P6rReadySession["actor"];
      readonly revision: string;
      readonly status: "ready";
    }
  | {
      readonly status: "unsupported";
    }
  | {
      readonly status: "unauthenticated";
    }
  | {
      readonly status: "unavailable";
    };

export interface P6rNativeHttpIdentityAdmission {
  admit(context: object): Promise<P6rNativeHttpAdmission>;
  current(context: object): Promise<P6rNativeIdentityStatus>;
}

export type P6rNativeRequestAdmission =
  | P6rNativeHttpAdmission
  | {
      readonly status: "internal";
      readonly pluginId: string;
      readonly generation: string;
      validate(): P6rValidity;
    };
export interface P6rNativeRequestContext {
  readonly req: {
    readonly raw: Request;
  };
}

export type P6rNativeRequestAdmissionReader = (
  context: P6rNativeRequestContext,
) => Promise<P6rNativeRequestAdmission>;

function statusFromAdmission(
  admission: P6rNativeHttpAdmission,
): P6rNativeIdentityStatus {
  if (admission.status === "baseline") return { status: "unsupported" };
  if (admission.status === "ready") {
    return {
      actor: admission.session.actor,
      revision: admission.session.stamp,
      status: "ready",
    };
  }
  return {
    status:
      admission.error.code === "unauthenticated"
        ? "unauthenticated"
        : "unavailable",
  };
}

export function createP6rNativeHttpIdentityAdmission(input: {
  readonly providerAdmission: P6rProviderAdmission;
}): P6rNativeHttpIdentityAdmission {
  return {
    admit: (context) => input.providerAdmission.admitNativeHttp(context),
    async current(context) {
      const admission = await input.providerAdmission.admitNativeHttp(context);
      try {
        return statusFromAdmission(admission);
      } finally {
        if (admission.status === "ready") admission.release();
      }
    },
  };
}
