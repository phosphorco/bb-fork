// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { p6rPrincipalKeySchema } from "@bb/domain";
import type { ThreadFacetParticipantSummary } from "@bb/server-contract";
import { TooltipProvider } from "@bb/shared-ui/tooltip";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sdk } from "@/lib/sdk";
import { FacetParticipantAvatarGroup } from "./FacetParticipantAvatarGroup";

const summary: ThreadFacetParticipantSummary = {
  totalCount: 6,
  nextCursor: "participants-page-1",
  profiles: [
    {
      p6rPrincipalKey: p6rPrincipalKeySchema.parse("p6r:github/same-1"),
      p6rDisplayName: "Same Name",
      p6rImageUrl: "https://example.test/shared.png",
    },
    {
      p6rPrincipalKey: p6rPrincipalKeySchema.parse("p6r:google/same-2"),
      p6rDisplayName: "Same Name",
      p6rImageUrl: "https://example.test/shared.png",
    },
    {
      p6rPrincipalKey: p6rPrincipalKeySchema.parse("p6r:local/grace"),
      p6rDisplayName: "Grace Cole",
      p6rImageUrl: null,
    },
  ],
};

function renderGroup(onAncestorClick = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const rendered = render(
    <QueryClientProvider client={client}>
      <TooltipProvider delayDuration={0}>
        <div onClick={onAncestorClick}>
          <FacetParticipantAvatarGroup summary={summary} threadId="thr_group" />
        </div>
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return { ...rendered, onAncestorClick };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("facet participant avatar group", () => {
  it("preserves server order and PrincipalKey cardinality across equal and missing presentation", async () => {
    vi.spyOn(sdk.threads, "facetParticipants").mockResolvedValue({
      totalCount: 6,
      profiles: [],
      nextCursor: null,
    });
    const { container, onAncestorClick } = renderGroup();

    const group = screen.getByRole("group", {
      name: "Participants: Same Name, Same Name, Grace Cole, and 3 more",
    });
    expect(
      within(group).getAllByRole("button", { name: "Same Name" }),
    ).toHaveLength(2);
    expect(
      container.querySelectorAll('[data-participant-key="p6r:github/same-1"]'),
    ).toHaveLength(1);
    expect(
      container.querySelectorAll('[data-participant-key="p6r:google/same-2"]'),
    ).toHaveLength(1);
    expect(
      within(group).getAllByRole("img", { name: "Same Name" }),
    ).toHaveLength(2);
    expect(
      within(group)
        .getAllByRole("img", { name: "Same Name" })
        .map((image) => image.getAttribute("src")),
    ).toEqual([
      "https://example.test/shared.png",
      "https://example.test/shared.png",
    ]);
    expect(
      within(group).getByRole("button", { name: "Grace Cole" }).textContent,
    ).toBe("GC");

    const grace = within(group).getByRole("button", { name: "Grace Cole" });
    fireEvent.focus(grace);
    expect((await screen.findByRole("tooltip")).textContent).toBe("Grace Cole");
    fireEvent.click(grace);
    expect(onAncestorClick).not.toHaveBeenCalled();
  });

  it("opens overflow without row navigation and pages remaining profiles in canonical order", async () => {
    const facetParticipants = vi
      .spyOn(sdk.threads, "facetParticipants")
      .mockResolvedValueOnce({
        totalCount: 6,
        profiles: [
          {
            p6rPrincipalKey: p6rPrincipalKeySchema.parse("p6r:github/dana"),
            p6rDisplayName: "Dana Reed",
            p6rImageUrl: null,
          },
          {
            p6rPrincipalKey: p6rPrincipalKeySchema.parse("p6r:google/eli"),
            p6rDisplayName: "Eli Park",
            p6rImageUrl: null,
          },
        ],
        nextCursor: "participants-page-2",
      })
      .mockResolvedValueOnce({
        totalCount: 6,
        profiles: [
          {
            p6rPrincipalKey: p6rPrincipalKeySchema.parse("p6r:local/finn"),
            p6rDisplayName: "Finn Roy",
            p6rImageUrl: null,
          },
        ],
        nextCursor: null,
      });
    const { onAncestorClick } = renderGroup();

    fireEvent.click(
      screen.getByRole("button", { name: "3 more participants" }),
    );
    expect(onAncestorClick).not.toHaveBeenCalled();
    await screen.findByText("Dana Reed");
    const firstPageNames = screen
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    expect(firstPageNames).toEqual(["Dana Reed", "Eli Park"]);
    expect(facetParticipants).toHaveBeenNthCalledWith(1, {
      cursor: "participants-page-1",
      pageSize: 100,
      signal: expect.any(AbortSignal),
      threadId: "thr_group",
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Load more participants" }),
    );
    await screen.findByText("Finn Roy");
    await waitFor(() => expect(facetParticipants).toHaveBeenCalledTimes(2));
    expect(
      screen.getAllByRole("listitem").map((item) => item.textContent),
    ).toEqual(["Dana Reed", "Eli Park", "Finn Roy"]);
    expect(facetParticipants).toHaveBeenNthCalledWith(2, {
      cursor: "participants-page-2",
      pageSize: 100,
      signal: expect.any(AbortSignal),
      threadId: "thr_group",
    });
    expect(onAncestorClick).not.toHaveBeenCalled();
  });
});
