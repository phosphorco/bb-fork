import {
  CORE_PARTICIPANTS_FACET_TYPE_ID,
  threadFacetTypeIdSchema,
} from "@bb/domain";
import type { ThreadFacetQueryResponse } from "@bb/server-contract";

export const THREAD_PROGRESS_PHASE_FACET_TYPE_ID =
  threadFacetTypeIdSchema.parse("plugin/thread-progress/phase");

export const MY_PROGRESS_SAVED_FACET_QUERY = {
  id: "my-progress",
  label: "My progress",
  scope: { archived: false },
  filters: [
    {
      typeId: CORE_PARTICIPANTS_FACET_TYPE_ID,
      operator: "contains",
      member: { perspective: "request-principal" },
    },
  ],
  order: {
    typeId: THREAD_PROGRESS_PHASE_FACET_TYPE_ID,
    direction: "asc",
    absent: "last",
    unknown: "last",
  },
} as const;

export const MY_PROGRESS_QUERY_POLICY = {
  retry: false,
  // Reopening explicitly refetches cached data. Keeping it fresh while
  // collapsed prevents the enabled transition from racing a second request.
  staleTime: Number.POSITIVE_INFINITY,
  refetchOnWindowFocus: "always",
} as const;

export type MyProgressQueryMode = "progress" | "participants-only";

export interface MyProgressPageParam {
  cursor?: string;
  mode: MyProgressQueryMode;
}

export interface MyProgressFacetPage {
  mode: MyProgressQueryMode;
  response: ThreadFacetQueryResponse;
}

export function nextFacetParticipantCursor(page: {
  nextCursor: string | null;
}): string | undefined {
  return page.nextCursor ?? undefined;
}
