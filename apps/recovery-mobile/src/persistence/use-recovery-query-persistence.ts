import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { ZodType } from "zod";
import type { ProfileIdentityContext } from "./contracts";
import { getNativeRecoveryRepository } from "./native-repository";
import { buildRecoveryServerProfileKey } from "./recovery-namespace";

export interface RecoveryQueryPersistenceArgs<T> {
  namespace: ProfileIdentityContext | null;
  recordKey: string;
  queryKey: QueryKey;
  data: T | undefined;
  revision: number;
  schema: ZodType<T>;
}

/** Hydrate one Query entry from SQLite, then mirror successful network data. */
export function useRecoveryQueryPersistence<T>({
  namespace,
  recordKey,
  queryKey,
  data,
  revision,
  schema,
}: RecoveryQueryPersistenceArgs<T>): void {
  const queryClient = useQueryClient();
  const queryKeyFingerprint = JSON.stringify(queryKey);
  const lastScheduledRef = useRef<{
    data: T;
    scheduledKey: string;
  } | null>(null);

  useEffect(() => {
    if (!namespace) return;
    const stableQueryKey = JSON.parse(queryKeyFingerprint) as QueryKey;
    let cancelled = false;
    void getNativeRecoveryRepository()
      .then((repository) =>
        repository.getObservedRecord<T>(namespace.namespaceId, recordKey),
      )
      .then((cached) => {
        if (
          cancelled ||
          !cached ||
          queryClient.getQueryData(stableQueryKey) !== undefined
        ) {
          return;
        }
        const parsed = schema.safeParse(cached.payload);
        if (parsed.success)
          queryClient.setQueryData(stableQueryKey, parsed.data);
      });
    return () => {
      cancelled = true;
    };
  }, [namespace, queryClient, queryKeyFingerprint, recordKey, schema]);

  useEffect(() => {
    if (!namespace || namespace.source !== "live" || data === undefined) return;
    const scheduledKey = JSON.stringify([namespace.namespaceId, recordKey]);
    if (
      lastScheduledRef.current?.scheduledKey === scheduledKey &&
      lastScheduledRef.current.data === data
    ) {
      return;
    }
    lastScheduledRef.current = { data, scheduledKey };
    void getNativeRecoveryRepository()
      .then(async (repository) => {
        await repository.ensureNamespace({
          namespaceId: namespace.namespaceId,
          serverProfileKey: buildRecoveryServerProfileKey(namespace),
          ownerKey: namespace.principalKey ?? "read-only",
          ownerState: namespace.ownerState,
        });
        await repository.putObservedRecord({
          namespaceId: namespace.namespaceId,
          recordKey,
          payload: data,
          revision,
          updatedAt: Date.now(),
        });
      })
      .catch(() => {
        if (
          lastScheduledRef.current?.scheduledKey === scheduledKey &&
          lastScheduledRef.current.data === data
        ) {
          lastScheduledRef.current = null;
        }
      });
  }, [data, namespace, recordKey, revision]);
}
