// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  type QueryClientConfig,
} from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  CORE_PARTICIPANTS_FACET_TYPE_ID,
  threadFacetTypeIdSchema,
} from "@bb/domain";
import type { ThreadFacetQueryResponse } from "@bb/server-contract";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BbHttpError, sdk } from "@/lib/sdk";
import {
  MY_PROGRESS_LAST_KNOWN_STATUS,
  MY_PROGRESS_UNAVAILABLE_STATUS,
  myProgressCollectionStatus,
} from "@/components/sidebar/MyProgressSidebarSection";
import {
  MY_PROGRESS_SAVED_FACET_QUERY,
  useMyProgressFacetQuery,
  type MyProgressFacetPage,
} from "./my-progress-query";

const PHASE_TYPE_ID = MY_PROGRESS_SAVED_FACET_QUERY.order.typeId;

function response(args?: {
  nextCursor?: string | null;
  phaseState?: "ready" | "reconciling" | "unavailable";
}): ThreadFacetQueryResponse {
  return {
    threads: [],
    nextCursor: args?.nextCursor ?? null,
    facetStates: [
      {
        typeId: CORE_PARTICIPANTS_FACET_TYPE_ID,
        ownerState: "ready",
      },
      {
        typeId: PHASE_TYPE_ID,
        ownerState: args?.phaseState ?? "ready",
      },
    ],
  };
}

function testQueryClient(config: QueryClientConfig = {}): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
    ...config,
  });
}

function wrapper(client: QueryClient) {
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("My progress saved facet query", () => {
  it("owns the participant filter, phase order, and cursor continuation without legacy listing", async () => {
    const queryFacets = vi
      .spyOn(sdk.threads, "queryFacets")
      .mockResolvedValueOnce(response({ nextCursor: "progress-page-2" }))
      .mockResolvedValueOnce(response());
    const legacyList = vi.spyOn(sdk.threads, "list");
    const client = testQueryClient();
    const rendered = renderHook(() => useMyProgressFacetQuery(), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(rendered.result.current.isSuccess).toBe(true));
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
      order: {
        typeId: threadFacetTypeIdSchema.parse("plugin/thread-progress/phase"),
        direction: "asc",
        absent: "last",
        unknown: "last",
      },
      pageSize: 25,
    });
    expect(queryFacets.mock.calls[0]?.[0]?.cursor).toBeUndefined();
    expect(legacyList).not.toHaveBeenCalled();

    await act(() => rendered.result.current.fetchNextPage());
    expect(queryFacets).toHaveBeenCalledTimes(2);
    expect(queryFacets.mock.calls[1]?.[0]).toMatchObject({
      cursor: "progress-page-2",
      scope: { archived: false },
      order: MY_PROGRESS_SAVED_FACET_QUERY.order,
    });
    expect(legacyList).not.toHaveBeenCalled();
  });

  it("performs one participant-only facet query after typed phase unavailability and keeps that mode for continuation", async () => {
    const queryFacets = vi
      .spyOn(sdk.threads, "queryFacets")
      .mockRejectedValueOnce(
        new BbHttpError({
          body: { code: "facet_unavailable" },
          code: "facet_unavailable",
          message: "The requested facet type is unavailable",
          status: 400,
        }),
      )
      .mockResolvedValueOnce(response({ nextCursor: "fallback-page-2" }))
      .mockResolvedValueOnce(response());
    const legacyList = vi.spyOn(sdk.threads, "list");
    const client = testQueryClient();
    const rendered = renderHook(() => useMyProgressFacetQuery(), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(rendered.result.current.isSuccess).toBe(true));
    expect(queryFacets).toHaveBeenCalledTimes(2);
    expect(queryFacets.mock.calls[0]?.[0]?.order).toEqual(
      MY_PROGRESS_SAVED_FACET_QUERY.order,
    );
    expect(queryFacets.mock.calls[1]?.[0]?.order).toBeUndefined();
    expect(queryFacets.mock.calls[1]?.[0]?.filters).toEqual(
      MY_PROGRESS_SAVED_FACET_QUERY.filters,
    );
    expect(queryFacets.mock.calls[1]?.[0]?.scope).toEqual({ archived: false });
    expect(legacyList).not.toHaveBeenCalled();

    await act(() => rendered.result.current.fetchNextPage());
    expect(queryFacets).toHaveBeenCalledTimes(3);
    expect(queryFacets.mock.calls[2]?.[0]).toMatchObject({
      cursor: "fallback-page-2",
      scope: { archived: false },
      filters: MY_PROGRESS_SAVED_FACET_QUERY.filters,
    });
    expect(queryFacets.mock.calls[2]?.[0]?.order).toBeUndefined();
    expect(legacyList).not.toHaveBeenCalled();
  });

  it("distinguishes last-known classification state from declaration fallback", () => {
    const progressPage = (
      phaseState: "ready" | "reconciling" | "unavailable",
    ): MyProgressFacetPage => ({
      mode: "progress",
      response: response({ phaseState }),
    });

    expect(myProgressCollectionStatus([progressPage("ready")])).toBeNull();
    expect(myProgressCollectionStatus([progressPage("reconciling")])).toBe(
      MY_PROGRESS_LAST_KNOWN_STATUS,
    );
    expect(myProgressCollectionStatus([progressPage("unavailable")])).toBe(
      MY_PROGRESS_LAST_KNOWN_STATUS,
    );
    expect(
      myProgressCollectionStatus([
        { mode: "participants-only", response: response() },
      ]),
    ).toBe(MY_PROGRESS_UNAVAILABLE_STATUS);
  });
});
