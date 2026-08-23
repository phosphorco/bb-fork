import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
import {
  CORE_PARTICIPANTS_FACET_TYPE_ID,
  threadFacetTypeIdSchema,
} from "@bb/domain";
import type {
  ThreadFacetParticipantsResponse,
  ThreadFacetQueryResponse,
} from "@bb/server-contract";
import type { ThreadFacetQueryArgs } from "@bb/sdk/browser";
import { useThreadListRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { BbHttpError, sdk } from "@/lib/sdk";
import {
  myProgressFacetQueryKey,
  threadFacetParticipantsQueryKey,
  type MyProgressFacetQueryKey,
} from "./query-keys";
import { REALTIME_OWNED_MOUNT_BASELINE_QUERY_POLICY } from "./query-policies";

const THREAD_PROGRESS_PHASE_FACET_TYPE_ID = threadFacetTypeIdSchema.parse(
  "plugin/thread-progress/phase",
);

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
} satisfies {
  id: string;
  label: string;
  scope: NonNullable<ThreadFacetQueryArgs["scope"]>;
  filters: NonNullable<ThreadFacetQueryArgs["filters"]>;
  order: NonNullable<ThreadFacetQueryArgs["order"]>;
};

const MY_PROGRESS_PAGE_SIZE = 25;
const PARTICIPANT_DISCLOSURE_PAGE_SIZE = 100;

type MyProgressQueryMode = "progress" | "participants-only";

interface MyProgressPageParam {
  cursor?: string;
  mode: MyProgressQueryMode;
}

const INITIAL_MY_PROGRESS_PAGE = {
  mode: "progress",
} satisfies MyProgressPageParam;

export interface MyProgressFacetPage {
  mode: MyProgressQueryMode;
  response: ThreadFacetQueryResponse;
}

function queryMyProgressPage(args: {
  cursor?: string;
  mode: MyProgressQueryMode;
  signal: AbortSignal;
}): Promise<ThreadFacetQueryResponse> {
  return sdk.threads.queryFacets({
    scope: MY_PROGRESS_SAVED_FACET_QUERY.scope,
    filters: MY_PROGRESS_SAVED_FACET_QUERY.filters,
    pageSize: MY_PROGRESS_PAGE_SIZE,
    signal: args.signal,
    ...(args.cursor === undefined ? {} : { cursor: args.cursor }),
    ...(args.mode === "progress"
      ? { order: MY_PROGRESS_SAVED_FACET_QUERY.order }
      : {}),
  });
}

async function fetchMyProgressPage(
  pageParam: MyProgressPageParam,
  signal: AbortSignal,
): Promise<MyProgressFacetPage> {
  if (pageParam.mode === "participants-only") {
    return {
      mode: "participants-only",
      response: await queryMyProgressPage({ ...pageParam, signal }),
    };
  }

  try {
    return {
      mode: "progress",
      response: await queryMyProgressPage({ ...pageParam, signal }),
    };
  } catch (error) {
    if (!(error instanceof BbHttpError) || error.code !== "facet_unavailable") {
      throw error;
    }
    return {
      mode: "participants-only",
      response: await queryMyProgressPage({
        cursor: pageParam.cursor,
        mode: "participants-only",
        signal,
      }),
    };
  }
}

export function useMyProgressFacetQuery() {
  useThreadListRealtimeSubscription();

  return useInfiniteQuery<
    MyProgressFacetPage,
    Error,
    InfiniteData<MyProgressFacetPage, MyProgressPageParam>,
    MyProgressFacetQueryKey,
    MyProgressPageParam
  >({
    queryKey: myProgressFacetQueryKey(),
    queryFn: ({ pageParam, signal }) => fetchMyProgressPage(pageParam, signal),
    initialPageParam: INITIAL_MY_PROGRESS_PAGE,
    getNextPageParam: (lastPage): MyProgressPageParam | undefined =>
      lastPage.response.nextCursor === null
        ? undefined
        : {
            cursor: lastPage.response.nextCursor,
            mode: lastPage.mode,
          },
    retry: false,
    ...REALTIME_OWNED_MOUNT_BASELINE_QUERY_POLICY,
  });
}

export function useThreadFacetParticipantPages(args: {
  enabled: boolean;
  initialCursor: string;
  threadId: string;
}) {
  return useInfiniteQuery({
    queryKey: threadFacetParticipantsQueryKey(
      args.threadId,
      args.initialCursor,
    ),
    queryFn: ({
      pageParam,
      signal,
    }): Promise<ThreadFacetParticipantsResponse> =>
      sdk.threads.facetParticipants({
        cursor: pageParam,
        pageSize: PARTICIPANT_DISCLOSURE_PAGE_SIZE,
        signal,
        threadId: args.threadId,
      }),
    initialPageParam: args.initialCursor,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: args.enabled,
    retry: false,
    ...REALTIME_OWNED_MOUNT_BASELINE_QUERY_POLICY,
  });
}
