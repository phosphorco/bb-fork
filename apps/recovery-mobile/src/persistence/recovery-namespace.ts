export interface RecoveryNamespaceIdentity {
  profileId: string;
  serverUrl: string;
  principalKey: string | null;
}

function normalizedServerUrl(serverUrl: string): string {
  return serverUrl.trim().replace(/\/+$/u, "");
}

/** Stable local cache owner. The version prefix permits a later server ID. */
export function buildRecoveryNamespaceId(
  identity: RecoveryNamespaceIdentity,
): string {
  return JSON.stringify([
    1,
    identity.profileId,
    normalizedServerUrl(identity.serverUrl),
    identity.principalKey,
  ]);
}

/** SQLite uniqueness must distinguish a profile rebound to another origin. */
export function buildRecoveryServerProfileKey(
  identity: Pick<RecoveryNamespaceIdentity, "profileId" | "serverUrl">,
): string {
  return JSON.stringify([
    identity.profileId,
    normalizedServerUrl(identity.serverUrl),
  ]);
}
