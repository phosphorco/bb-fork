import { CORE_PARTICIPANTS_FACET_TYPE_ID } from "@bb/domain";
import { BbHttpError, type BrowserBbSdk } from "@bb/sdk/browser";
import type { ThreadFacetQueryResponse } from "@bb/server-contract";
import { describe, expect, it, vi } from "vitest";
import {
  MY_PROGRESS_QUERY_POLICY,
  MY_PROGRESS_SAVED_FACET_QUERY,
  nextFacetParticipantCursor,
} from "./facet-triage-contract";
import {
  fetchMyProgressPage,
  nextMyProgressPageParam,
} from "./facet-triage-query";

const EMPTY_RESPONSE: ThreadFacetQueryResponse = {
  threads: [],
  nextCursor: null,
  facetStates: [
    { typeId: CORE_PARTICIPANTS_FACET_TYPE_ID, ownerState: "ready" },
  ],
};

type QueryFacetsArgs = Parameters<BrowserBbSdk["threads"]["queryFacets"]>[0];

function signal(): AbortSignal {
  return new AbortController().signal;
}

describe("My progress facet query", () => {
  it("uses the definite participant filter and canonical progress ordering", async () => {
    const queryFacets = vi.fn(async (_args: QueryFacetsArgs) => EMPTY_RESPONSE);
    const result = await fetchMyProgressPage({
      pageParam: { mode: "progress" },
      sdk: { threads: { queryFacets } },
      signal: signal(),
    });

    expect(result.mode).toBe("progress");
    expect(queryFacets).toHaveBeenCalledTimes(1);
    expect(queryFacets.mock.calls[0]?.[0]).toMatchObject({
      scope: { archived: false },
      filters: [
        {
          typeId: CORE_PARTICIPANTS_FACET_TYPE_ID,
          operator: "contains",
          member: { perspective: "request-principal" },
        },
      ],
      order: MY_PROGRESS_SAVED_FACET_QUERY.order,
      pageSize: 25,
    });
    expect(MY_PROGRESS_QUERY_POLICY.refetchOnWindowFocus).toBe("always");
  });

  it("falls back exactly once to the same participant query without ordering", async () => {
    const unavailable = new BbHttpError({
      status: 409,
      code: "facet_unavailable",
      body: { code: "facet_unavailable" },
      message: "unavailable",
    });
    let attempt = 0;
    const queryFacets = vi.fn(async (_args: QueryFacetsArgs) => {
      attempt += 1;
      if (attempt === 1) throw unavailable;
      return { ...EMPTY_RESPONSE, nextCursor: "participants:2" };
    });

    const result = await fetchMyProgressPage({
      pageParam: { mode: "progress" },
      sdk: { threads: { queryFacets } },
      signal: signal(),
    });

    expect(result.mode).toBe("participants-only");
    expect(queryFacets).toHaveBeenCalledTimes(2);
    const fallback = queryFacets.mock.calls[1]?.[0];
    expect(fallback).toMatchObject({
      scope: { archived: false },
      filters: MY_PROGRESS_SAVED_FACET_QUERY.filters,
      pageSize: 25,
    });
    expect(fallback).not.toHaveProperty("order");
    expect(nextMyProgressPageParam(result)).toEqual({
      cursor: "participants:2",
      mode: "participants-only",
    });
  });

  it("continues participant-only pages without retrying the unavailable order", async () => {
    const queryFacets = vi.fn(async (_args: QueryFacetsArgs) => EMPTY_RESPONSE);
    await fetchMyProgressPage({
      pageParam: { mode: "participants-only", cursor: "participants:2" },
      sdk: { threads: { queryFacets } },
      signal: signal(),
    });

    expect(queryFacets).toHaveBeenCalledTimes(1);
    expect(queryFacets.mock.calls[0]?.[0]).toMatchObject({
      cursor: "participants:2",
      scope: { archived: false },
      filters: MY_PROGRESS_SAVED_FACET_QUERY.filters,
    });
    expect(queryFacets.mock.calls[0]?.[0]).not.toHaveProperty("order");
  });

  it("does not broaden or retry non-facet failures", async () => {
    const failure = new Error("offline");
    const queryFacets = vi.fn(async (_args: QueryFacetsArgs) => {
      throw failure;
    });
    await expect(
      fetchMyProgressPage({
        pageParam: { mode: "progress" },
        sdk: { threads: { queryFacets } },
        signal: signal(),
      }),
    ).rejects.toBe(failure);
    expect(queryFacets).toHaveBeenCalledTimes(1);
  });

  it("follows opaque thread and participant cursors until terminal pages", () => {
    expect(
      nextMyProgressPageParam({
        mode: "progress",
        response: { ...EMPTY_RESPONSE, nextCursor: "opaque-next" },
      }),
    ).toEqual({ cursor: "opaque-next", mode: "progress" });
    expect(
      nextMyProgressPageParam({ mode: "progress", response: EMPTY_RESPONSE }),
    ).toBeUndefined();
    expect(nextFacetParticipantCursor({ nextCursor: "profiles-next" })).toBe(
      "profiles-next",
    );
    expect(nextFacetParticipantCursor({ nextCursor: null })).toBeUndefined();
  });
});
