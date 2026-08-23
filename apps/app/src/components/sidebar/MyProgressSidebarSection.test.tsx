// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  CORE_PARTICIPANTS_FACET_TYPE_ID,
  p6rPrincipalKeySchema,
} from "@bb/domain";
import type {
  ThreadFacetQueryResponse,
  ThreadFacetQueryThread,
} from "@bb/server-contract";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BbHttpError, sdk } from "@/lib/sdk";
import { MY_PROGRESS_SAVED_FACET_QUERY } from "@/hooks/queries/my-progress-query";
import {
  MY_PROGRESS_LAST_KNOWN_STATUS,
  MY_PROGRESS_UNAVAILABLE_STATUS,
  MyProgressSidebarSection,
} from "./MyProgressSidebarSection";

vi.mock("@/hooks/useRealtimeSubscription", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/hooks/useRealtimeSubscription")>();
  return { ...actual, useThreadListRealtimeSubscription: vi.fn() };
});

vi.mock("@/hooks/usePromptDraftStorage", () => ({
  usePromptDraftHasInput: vi.fn(() => false),
}));

vi.mock("./ThreadRow", () => ({
  ThreadRow: ({
    facetParticipantSummary,
    thread,
  }: {
    facetParticipantSummary: { totalCount: number };
    thread: ThreadFacetQueryThread;
  }) => (
    <div
      data-testid={`facet-thread-${thread.id}`}
      data-participant-count={facetParticipantSummary.totalCount}
    >
      {thread.title}
    </div>
  ),
}));

function thread(id: string, title: string): ThreadFacetQueryThread {
  return {
    id,
    projectId: "proj_progress",
    environmentId: null,
    providerId: "codex",
    title,
    titleFallback: title,
    sectionId: null,
    status: "idle",
    parentThreadId: null,
    sourceThreadId: null,
    originKind: null,
    originPluginId: null,
    visibility: "visible",
    archivedAt: null,
    pinnedAt: null,
    pinSortKey: null,
    deletedAt: null,
    lastReadAt: 0,
    latestAttentionAt: 1,
    createdAt: 1,
    updatedAt: 1,
    activity: {
      activeWorkflowCount: 0,
      activeBackgroundAgentCount: 0,
      activeBackgroundCommandCount: 0,
      activePlanModeCount: 0,
      activeGoalCount: 0,
    },
    hasPendingInteraction: false,
    environmentHostId: null,
    environmentName: null,
    environmentBranchName: null,
    environmentWorkspaceDisplayKind: "other",
    runtime: {
      displayStatus: "idle",
      hostReconnectGraceExpiresAt: null,
    },
    participantSummary: {
      totalCount: 1,
      profiles: [
        {
          p6rPrincipalKey: p6rPrincipalKeySchema.parse("p6r:local/me"),
          p6rDisplayName: "Me",
          p6rImageUrl: null,
        },
      ],
      nextCursor: null,
    },
  };
}

function response(args?: {
  nextCursor?: string | null;
  ownerState?: "ready" | "reconciling" | "unavailable";
  threads?: ThreadFacetQueryThread[];
}): ThreadFacetQueryResponse {
  return {
    threads: args?.threads ?? [],
    nextCursor: args?.nextCursor ?? null,
    facetStates: [
      { typeId: CORE_PARTICIPANTS_FACET_TYPE_ID, ownerState: "ready" },
      {
        typeId: MY_PROGRESS_SAVED_FACET_QUERY.order.typeId,
        ownerState: args?.ownerState ?? "ready",
      },
    ],
  };
}

function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MyProgressSidebarSection
        disabled
        isCollapsed={false}
        onToggleCollapsed={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("My progress sidebar collection", () => {
  it("owns loading, server page order, empty continuation, and explicit pagination", async () => {
    let resolveFirstPage:
      | ((value: ThreadFacetQueryResponse) => void)
      | undefined;
    const firstPage = new Promise<ThreadFacetQueryResponse>((resolve) => {
      resolveFirstPage = resolve;
    });
    const queryFacets = vi
      .spyOn(sdk.threads, "queryFacets")
      .mockReturnValueOnce(firstPage)
      .mockResolvedValueOnce(
        response({ threads: [thread("thr_second", "Second page")] }),
      );
    renderSection();

    expect(screen.getByLabelText("Loading My progress")).not.toBeNull();
    await act(async () => {
      resolveFirstPage?.(
        response({
          threads: [thread("thr_first", "First page")],
          nextCursor: "progress-next",
        }),
      );
      await firstPage;
    });

    expect(await screen.findByText("First page")).not.toBeNull();
    expect(screen.queryByText("Second page")).toBeNull();
    expect(
      screen.getByTestId("facet-thread-thr_first").dataset.participantCount,
    ).toBe("1");
    fireEvent.click(
      screen.getByRole("button", { name: "Load more in My progress" }),
    );
    expect(await screen.findByText("Second page")).not.toBeNull();
    expect(
      screen.getAllByTestId(/^facet-thread-/u).map((row) => row.textContent),
    ).toEqual(["First page", "Second page"]);
    expect(queryFacets.mock.calls[1]?.[0]?.cursor).toBe("progress-next");
  });

  it("renders last-known and participant-only unavailability truthfully", async () => {
    vi.spyOn(sdk.threads, "queryFacets").mockResolvedValueOnce(
      response({
        ownerState: "reconciling",
        threads: [thread("thr_known", "Known")],
      }),
    );
    const first = renderSection();
    expect((await screen.findByRole("status")).textContent).toBe(
      MY_PROGRESS_LAST_KNOWN_STATUS,
    );
    expect(screen.getByText("Known")).not.toBeNull();
    first.unmount();

    vi.restoreAllMocks();
    vi.spyOn(sdk.threads, "queryFacets")
      .mockRejectedValueOnce(
        new BbHttpError({
          body: { code: "facet_unavailable" },
          code: "facet_unavailable",
          message: "Phase facet unavailable",
          status: 400,
        }),
      )
      .mockResolvedValueOnce(response());
    renderSection();
    expect((await screen.findByRole("status")).textContent).toBe(
      MY_PROGRESS_UNAVAILABLE_STATUS,
    );
    expect(screen.getByText("No participating threads")).not.toBeNull();
  });

  it("owns terminal errors without exposing a legacy-list fallback", async () => {
    vi.spyOn(sdk.threads, "queryFacets").mockRejectedValueOnce(
      new Error("network down"),
    );
    const legacyList = vi.spyOn(sdk.threads, "list");
    renderSection();

    expect((await screen.findByRole("alert")).textContent).toBe(
      "My progress unavailable",
    );
    expect(legacyList).not.toHaveBeenCalled();
  });
});
