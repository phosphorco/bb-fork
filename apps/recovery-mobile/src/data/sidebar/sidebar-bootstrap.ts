import { PERSONAL_PROJECT_ID } from "@bb/domain";
import {
  sidebarBootstrapResponseSchema,
  type SidebarBootstrapResponse,
} from "@bb/server-contract";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useProfileClient } from "@/app-shell/ProfilesProvider";
import { sidebarNavigationQueryKey } from "@/lib/query/query-keys";
import { useRecoveryQueryPersistence } from "@/persistence/use-recovery-query-persistence";
import { useRecoveryNamespace } from "@/persistence/use-recovery-namespace";
import { RECOVERY_SIDEBAR_RECORD_KEY } from "@/persistence/recovery-snapshot";
import { recoveryScopedQueryKey } from "@/persistence/recovery-query-key";
import { REALTIME_OWNED_STATIC_CACHE_QUERY_POLICY } from "../shared/query-policies";
import {
  useEnvironmentListRealtimeSubscription,
  useProjectListRealtimeSubscription,
  useThreadListRealtimeSubscription,
} from "../shared/use-realtime-subscription";
import { stripProjectThreads, type SidebarProject } from "./sidebar-model";

interface QueryOptions {
  enabled?: boolean;
}

/**
 * `GET /projects/sidebar-bootstrap`: sections, every project with its live
 * threads and resolved thread-creation defaults, and the personal project.
 * Realtime `thread-list` + `project-list` (+ `environment-list`, whose
 * metadata the rows label worktrees with) subscriptions keep it live through
 * the invalidation bridge, so the cache never goes stale by age.
 */
export function useSidebarBootstrap(options?: QueryOptions) {
  const { sdk } = useProfileClient();
  const namespace = useRecoveryNamespace();
  const enabled = options?.enabled ?? true;
  const recoveryEnabled = enabled && namespace !== null;
  const queryKey = recoveryScopedQueryKey(
    sidebarNavigationQueryKey(),
    namespace?.namespaceId ?? null,
  );
  useThreadListRealtimeSubscription({ enabled: recoveryEnabled });
  useProjectListRealtimeSubscription({ enabled: recoveryEnabled });
  useEnvironmentListRealtimeSubscription({ enabled: recoveryEnabled });

  const query = useQuery<SidebarBootstrapResponse>({
    queryKey,
    queryFn: ({ signal }) => sdk.projects.sidebarBootstrap({ signal }),
    enabled: recoveryEnabled,
    ...REALTIME_OWNED_STATIC_CACHE_QUERY_POLICY,
  });

  useRecoveryQueryPersistence({
    namespace,
    recordKey: RECOVERY_SIDEBAR_RECORD_KEY,
    queryKey,
    data: query.data,
    revision: 0,
    schema: sidebarBootstrapResponseSchema,
  });

  return query;
}

/**
 * One project (with sources and thread-creation defaults) from the sidebar
 * cache. Reads the cache the sidebar already keeps live; `enabled` only
 * matters before the sidebar has ever mounted.
 */
export function useSidebarProject(
  projectId: string | undefined,
  options?: QueryOptions,
): SidebarProject | undefined {
  const { data } = useSidebarBootstrap({
    enabled: (options?.enabled ?? true) && Boolean(projectId),
  });
  return useMemo(() => {
    if (!data || !projectId) return undefined;
    const project =
      projectId === PERSONAL_PROJECT_ID
        ? data.personalProject
        : data.projects.find((candidate) => candidate.id === projectId);
    return project ? stripProjectThreads(project) : undefined;
  }, [data, projectId]);
}

export function useProjectDisplayName(
  projectId: string | undefined,
): string | undefined {
  return useSidebarProject(projectId)?.name;
}
