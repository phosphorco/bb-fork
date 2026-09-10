import type { ThreadFacetQueryThread } from "@bb/server-contract";
import { describe, expect, it } from "vitest";
import { threadListEntry } from "../test/fixtures";
import { PROGRESS_LAST_KNOWN_STATUS } from "./facet-triage-model";
import { buildFacetTriageRows } from "./facet-triage-rows-model";

function facetThread(id: string): ThreadFacetQueryThread {
  return {
    ...threadListEntry({ id }),
    participantSummary: { totalCount: 0, profiles: [], nextCursor: null },
  };
}

describe("Facet Triage rows", () => {
  it("owns collapsed, loading, and empty section states", () => {
    expect(
      buildFacetTriageRows({
        collapsed: true,
        hasNextPage: false,
        isError: false,
        isFetchingNextPage: false,
        isLoading: false,
        model: { threads: [], status: null },
      }).map((row) => row.type),
    ).toEqual(["facet-triage-header"]);
    expect(
      buildFacetTriageRows({
        collapsed: false,
        hasNextPage: false,
        isError: false,
        isFetchingNextPage: false,
        isLoading: true,
        model: { threads: [], status: null },
      }),
    ).toMatchObject([
      { type: "facet-triage-header" },
      { type: "facet-triage-message", kind: "loading" },
    ]);
    expect(
      buildFacetTriageRows({
        collapsed: false,
        hasNextPage: false,
        isError: false,
        isFetchingNextPage: false,
        isLoading: false,
        model: { threads: [], status: null },
      }),
    ).toMatchObject([
      { type: "facet-triage-header" },
      { type: "facet-triage-message", kind: "empty" },
    ]);
  });

  it("keeps server order, availability status, and explicit cursor continuation", () => {
    const rows = buildFacetTriageRows({
      collapsed: false,
      hasNextPage: true,
      isError: false,
      isFetchingNextPage: true,
      isLoading: false,
      model: {
        threads: [facetThread("server-second"), facetThread("server-first")],
        status: PROGRESS_LAST_KNOWN_STATUS,
      },
    });
    expect(rows.map((row) => row.key)).toEqual([
      "facet-triage:header:my-progress",
      "facet-triage:status",
      "facet-triage:thread:server-second",
      "facet-triage:thread:server-first",
      "facet-triage:continuation",
    ]);
    expect(rows[1]).toMatchObject({
      kind: "status",
      label: PROGRESS_LAST_KNOWN_STATUS,
    });
    expect(rows.at(-1)).toMatchObject({ loading: true });
  });

  it("retains last-known rows while owning refresh failure copy", () => {
    expect(
      buildFacetTriageRows({
        collapsed: false,
        hasNextPage: false,
        isError: true,
        isFetchingNextPage: false,
        isLoading: false,
        model: { threads: [facetThread("last-known")], status: null },
      }),
    ).toMatchObject([
      { type: "facet-triage-header" },
      {
        type: "facet-triage-message",
        kind: "error",
        label: "Could not refresh progress.",
        retry: true,
      },
      { type: "facet-triage-thread", thread: { id: "last-known" } },
    ]);
  });
});
