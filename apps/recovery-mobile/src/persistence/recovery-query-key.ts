import type { QueryKey } from "@tanstack/react-query";

const RECOVERY_NAMESPACE_MARKER = "recovery-namespace";

export function recoveryScopedQueryKey(
  queryKey: QueryKey,
  namespaceId: string | null,
): QueryKey {
  return [...queryKey, RECOVERY_NAMESPACE_MARKER, namespaceId];
}

export function queryKeyMatchesRecoveryNamespace(
  queryKey: QueryKey,
  namespaceId: string,
): boolean {
  return (
    queryKey.at(-2) === RECOVERY_NAMESPACE_MARKER &&
    queryKey.at(-1) === namespaceId
  );
}
