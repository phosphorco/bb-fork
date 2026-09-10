import type {
  P6rNativeWebSocketAdmission,
  P6rProviderAdmission,
} from "./provider-admission.js";

export interface P6rNativeWebSocketIdentityAdmission {
  admit(context: object): Promise<P6rNativeWebSocketAdmission>;
}

export function createP6rNativeWebSocketIdentityAdmission(input: {
  readonly providerAdmission: P6rProviderAdmission;
}): P6rNativeWebSocketIdentityAdmission {
  return {
    admit: (context) => input.providerAdmission.admitNativeWebSocket(context),
  };
}
