import { describe, expect, it } from "vitest";
import { createQueryClientTestHarness } from "@/test/queryClientTestHarness";
import { makeThreadListEntry } from "@/test/fixtures/thread-list-entries";
import {
  archivedThreadsListQueryKey,
  myProgressFacetQueryKey,
  threadFacetParticipantsQueryKey,
  threadsQueryKey,
} from "../queries/query-keys";
import {
  getCachedThreadLists,
  iterateThreadListCacheEntries,
} from "./thread-list-cache-data";

describe("thread list cache data", () => {
  it("ignores colliding infinite-query caches whose pages are not thread arrays", () => {
    const { queryClient } = createQueryClientTestHarness();
    const thread = makeThreadListEntry({ id: "thr_cached" });

    queryClient.setQueryData(archivedThreadsListQueryKey({}), {
      pageParams: [0],
      pages: [[thread]],
    });
    queryClient.setQueryData(myProgressFacetQueryKey(), {
      pageParams: [null],
      pages: [{ items: [], nextCursor: null }],
    });
    queryClient.setQueryData(
      threadFacetParticipantsQueryKey("thr_cached", "cursor_initial"),
      {
        pageParams: [],
        pages: [],
      },
    );

    const cached = getCachedThreadLists(queryClient, {
      queryKey: threadsQueryKey(),
    });

    expect(cached).toHaveLength(1);
    expect(Array.from(iterateThreadListCacheEntries(cached[0]!.data))).toEqual([
      thread,
    ]);
  });
});
