import type { ThreadFacetParticipantsResponse } from "@bb/server-contract";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useProfileClient } from "@/app-shell/ProfilesProvider";
import {
  MY_PROGRESS_QUERY_POLICY,
  MY_PROGRESS_SAVED_FACET_QUERY,
  nextFacetParticipantCursor,
  type MyProgressPageParam,
} from "./facet-triage-contract";
import {
  fetchMyProgressPage,
  nextMyProgressPageParam,
} from "./facet-triage-query";

const PARTICIPANT_DISCLOSURE_PAGE_SIZE = 100;

export function useMyProgressFacetQuery(enabled: boolean) {
  const { sdk } = useProfileClient();
  return useInfiniteQuery({
    queryKey: ["threads", "facet-triage", MY_PROGRESS_SAVED_FACET_QUERY.id],
    queryFn: ({ pageParam, signal }) =>
      fetchMyProgressPage({ pageParam, sdk, signal }),
    initialPageParam: { mode: "progress" } satisfies MyProgressPageParam,
    getNextPageParam: nextMyProgressPageParam,
    enabled,
    ...MY_PROGRESS_QUERY_POLICY,
  });
}

export function useFacetParticipantPages(args: {
  enabled: boolean;
  initialCursor: string | null;
  threadId: string;
}) {
  const { sdk } = useProfileClient();
  return useInfiniteQuery({
    queryKey: [
      "threads",
      "facet-triage-participants",
      args.threadId,
      args.initialCursor,
    ],
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
    initialPageParam: args.initialCursor ?? "",
    getNextPageParam: nextFacetParticipantCursor,
    enabled: args.enabled && args.initialCursor !== null,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}
