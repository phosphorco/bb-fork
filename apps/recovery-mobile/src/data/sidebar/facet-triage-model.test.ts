import {
  CORE_PARTICIPANTS_FACET_TYPE_ID,
  p6rPrincipalKeySchema,
} from "@bb/domain";
import type {
  ThreadFacetParticipantSummary,
  ThreadFacetQueryResponse,
  ThreadFacetQueryThread,
} from "@bb/server-contract";
import { describe, expect, it, vi } from "vitest";
import { threadListEntry } from "../test/fixtures";
import {
  THREAD_PROGRESS_PHASE_FACET_TYPE_ID,
  type MyProgressFacetPage,
} from "./facet-triage-contract";
import {
  buildFacetTriageModel,
  activateFacetRowNestedControl,
  p6rCompactParticipantAvatarGroup,
  participantAvatarItems,
  participantDisclosureTarget,
  participantGroupLabel,
  participantInitials,
  PROGRESS_LAST_KNOWN_STATUS,
  PROGRESS_UNAVAILABLE_STATUS,
  shouldRefreshFacetTriage,
} from "./facet-triage-model";

function facetThread(
  id: string,
  summary: ThreadFacetParticipantSummary = {
    totalCount: 0,
    profiles: [],
    nextCursor: null,
  },
): ThreadFacetQueryThread {
  return {
    ...threadListEntry({ id }),
    participantSummary: summary,
  };
}

function page(
  args: {
    mode?: MyProgressFacetPage["mode"];
    ownerState?: "ready" | "reconciling" | "unavailable";
    threads?: ThreadFacetQueryThread[];
    nextCursor?: string | null;
  } = {},
): MyProgressFacetPage {
  const response: ThreadFacetQueryResponse = {
    threads: args.threads ?? [],
    nextCursor: args.nextCursor ?? null,
    facetStates: [
      { typeId: CORE_PARTICIPANTS_FACET_TYPE_ID, ownerState: "ready" },
      {
        typeId: THREAD_PROGRESS_PHASE_FACET_TYPE_ID,
        ownerState: args.ownerState ?? "ready",
      },
    ],
  };
  return { mode: args.mode ?? "progress", response };
}

describe("Facet Triage model", () => {
  it("preserves server page order without joining or filtering the legacy bootstrap", () => {
    const serverFirst = facetThread("server-z");
    const serverSecond = facetThread("server-a");
    serverFirst.updatedAt = 1;
    serverSecond.updatedAt = 99;

    const model = buildFacetTriageModel([
      page({ threads: [serverFirst], nextCursor: "opaque" }),
      page({ threads: [serverSecond] }),
    ]);

    expect(model.threads.map((thread) => thread.id)).toEqual([
      "server-z",
      "server-a",
    ]);
  });

  it("projects exact progress availability copy", () => {
    expect(buildFacetTriageModel([page()]).status).toBeNull();
    expect(
      buildFacetTriageModel([page({ ownerState: "reconciling" })]).status,
    ).toBe(PROGRESS_LAST_KNOWN_STATUS);
    expect(
      buildFacetTriageModel([page({ ownerState: "unavailable" })]).status,
    ).toBe(PROGRESS_LAST_KNOWN_STATUS);
    expect(
      buildFacetTriageModel([page({ mode: "participants-only" })]).status,
    ).toBe(PROGRESS_UNAVAILABLE_STATUS);
  });

  it("labels the compact group from exact cardinality and preserves equal presentations", () => {
    const profiles = [
      {
        p6rPrincipalKey: p6rPrincipalKeySchema.parse("github:one"),
        p6rDisplayName: "Same Name",
        p6rImageUrl: "https://example.test/same.png",
      },
      {
        p6rPrincipalKey: p6rPrincipalKeySchema.parse("github:two"),
        p6rDisplayName: "Same Name",
        p6rImageUrl: "https://example.test/same.png",
      },
      {
        p6rPrincipalKey: p6rPrincipalKeySchema.parse("github:three"),
        p6rDisplayName: "No Avatar",
        p6rImageUrl: null,
      },
    ];
    const summary: ThreadFacetParticipantSummary = {
      totalCount: 5,
      profiles,
      nextCursor: "profiles:4",
    };

    expect(participantGroupLabel(summary)).toBe(
      "Participants: Same Name, Same Name, No Avatar, and 2 more",
    );
    expect(participantAvatarItems(profiles)).toEqual([
      {
        key: profiles[0]?.p6rPrincipalKey,
        label: "Same Name",
        imageUrl: "https://example.test/same.png",
        initials: "SN",
      },
      {
        key: profiles[1]?.p6rPrincipalKey,
        label: "Same Name",
        imageUrl: "https://example.test/same.png",
        initials: "SN",
      },
      {
        key: profiles[2]?.p6rPrincipalKey,
        label: "No Avatar",
        imageUrl: null,
        initials: "NA",
      },
    ]);
  });

  it("uses deterministic existing initials fallback", () => {
    expect(participantInitials("Ada Lovelace")).toBe("AL");
    expect(participantInitials("Prince")).toBe("P");
    expect(participantInitials("   ")).toBe("?");
  });

  it("projects ordinary rows to three ordered avatars plus exact overflow", () => {
    const profiles = [
      {
        p6rPrincipalKey: p6rPrincipalKeySchema.parse("github:same-one"),
        p6rDisplayName: "Same Name",
        p6rImageUrl: "https://example.test/same.png",
      },
      {
        p6rPrincipalKey: p6rPrincipalKeySchema.parse("google:same-two"),
        p6rDisplayName: "Same Name",
        p6rImageUrl: "https://example.test/same.png",
      },
      {
        p6rPrincipalKey: p6rPrincipalKeySchema.parse("local:grace"),
        p6rDisplayName: "Grace Cole",
        p6rImageUrl: null,
      },
      {
        p6rPrincipalKey: p6rPrincipalKeySchema.parse("local:dana"),
        p6rDisplayName: "Dana Reed",
        p6rImageUrl: null,
      },
    ];

    expect(p6rCompactParticipantAvatarGroup(profiles)).toEqual({
      accessibilityLabel:
        "Thread participants: Same Name, Same Name, Grace Cole, Dana Reed",
      visible: [
        {
          key: profiles[0]?.p6rPrincipalKey,
          label: "Same Name",
          imageUrl: "https://example.test/same.png",
          initials: "SN",
        },
        {
          key: profiles[1]?.p6rPrincipalKey,
          label: "Same Name",
          imageUrl: "https://example.test/same.png",
          initials: "SN",
        },
        {
          key: profiles[2]?.p6rPrincipalKey,
          label: "Grace Cole",
          imageUrl: null,
          initials: "GC",
        },
      ],
      overflow: [
        {
          key: profiles[3]?.p6rPrincipalKey,
          label: "Dana Reed",
          imageUrl: null,
          initials: "DR",
        },
      ],
    });
  });

  it("refreshes cached data on open and focus regain, but not while collapsed", () => {
    expect(
      shouldRefreshFacetTriage({
        hasData: true,
        previous: { collapsed: true, screenFocused: true },
        next: { collapsed: false, screenFocused: true },
      }),
    ).toBe(true);
    expect(
      shouldRefreshFacetTriage({
        hasData: true,
        previous: { collapsed: false, screenFocused: false },
        next: { collapsed: false, screenFocused: true },
      }),
    ).toBe(true);
    expect(
      shouldRefreshFacetTriage({
        hasData: true,
        previous: { collapsed: true, screenFocused: false },
        next: { collapsed: true, screenFocused: true },
      }),
    ).toBe(false);
    expect(
      shouldRefreshFacetTriage({
        hasData: false,
        previous: { collapsed: true, screenFocused: true },
        next: { collapsed: false, screenFocused: true },
      }),
    ).toBe(false);
  });

  it("stops nested avatar and overflow presses from navigating the row", () => {
    const event = { stopPropagation: vi.fn() };
    const disclose = vi.fn();
    activateFacetRowNestedControl(event, disclose);
    expect(event.stopPropagation).toHaveBeenCalledOnce();
    expect(disclose).toHaveBeenCalledOnce();
  });

  it("opens overflow from the exact server continuation and cardinality", () => {
    expect(
      participantDisclosureTarget(
        facetThread("thread-with-overflow", {
          totalCount: 5,
          profiles: [
            {
              p6rPrincipalKey: p6rPrincipalKeySchema.parse("github:one"),
              p6rDisplayName: "One",
              p6rImageUrl: null,
            },
            {
              p6rPrincipalKey: p6rPrincipalKeySchema.parse("github:two"),
              p6rDisplayName: "Two",
              p6rImageUrl: null,
            },
            {
              p6rPrincipalKey: p6rPrincipalKeySchema.parse("github:three"),
              p6rDisplayName: "Three",
              p6rImageUrl: null,
            },
          ],
          nextCursor: "profiles:4",
        }),
      ),
    ).toEqual({
      initialCursor: "profiles:4",
      remainingCount: 2,
      threadId: "thread-with-overflow",
    });
  });
});
