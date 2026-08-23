import type { P6rThreadParticipantProfile } from "@bb/domain";
import type {
  ThreadFacetParticipantSummary,
  ThreadFacetQueryThread,
} from "@bb/server-contract";
import {
  THREAD_PROGRESS_PHASE_FACET_TYPE_ID,
  type MyProgressFacetPage,
} from "./facet-triage-contract";

export const PROGRESS_LAST_KNOWN_STATUS =
  "Progress unavailable; showing last-known classifications";
export const PROGRESS_UNAVAILABLE_STATUS = "Progress unavailable";

export interface FacetTriageModel {
  threads: readonly ThreadFacetQueryThread[];
  status: string | null;
}

/** Preserve server page and row order; no legacy-sidebar join or local sort. */
export function buildFacetTriageModel(
  pages: readonly MyProgressFacetPage[],
): FacetTriageModel {
  const threads = pages.flatMap((page) => page.response.threads);
  if (pages.some((page) => page.mode === "participants-only")) {
    return { threads, status: PROGRESS_UNAVAILABLE_STATUS };
  }
  const progressIsUnavailable = pages.some((page) =>
    page.response.facetStates.some(
      (state) =>
        state.typeId === THREAD_PROGRESS_PHASE_FACET_TYPE_ID &&
        state.ownerState !== "ready",
    ),
  );
  return {
    threads,
    status: progressIsUnavailable ? PROGRESS_LAST_KNOWN_STATUS : null,
  };
}

export function participantOverflowCount(
  summary: ThreadFacetParticipantSummary,
): number {
  return Math.max(0, summary.totalCount - summary.profiles.length);
}

export function participantGroupLabel(
  summary: ThreadFacetParticipantSummary,
): string {
  const names = summary.profiles.map((profile) => profile.p6rDisplayName);
  const overflow = participantOverflowCount(summary);
  return `Participants: ${names.join(", ")}${
    overflow > 0 ? `, and ${overflow} more` : ""
  }`;
}

/** Up to two readable initials; matches the existing participant fallback. */
export function participantInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/u).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = Array.from(parts[0] ?? "")[0] ?? "";
  const last =
    parts.length > 1
      ? (Array.from(parts[parts.length - 1] ?? "")[0] ?? "")
      : "";
  return `${first}${last}`.toUpperCase() || "?";
}

export interface FacetParticipantAvatarItem {
  key: string;
  label: string;
  imageUrl: string | null;
  initials: string;
}

/** Identity/cardinality are keyed by PrincipalKey, never image or name. */
export function participantAvatarItems(
  profiles: readonly P6rThreadParticipantProfile[],
): FacetParticipantAvatarItem[] {
  return profiles.map((profile) => ({
    key: profile.p6rPrincipalKey,
    label: profile.p6rDisplayName,
    imageUrl: profile.p6rImageUrl,
    initials: participantInitials(profile.p6rDisplayName),
  }));
}

export function activateFacetRowNestedControl(
  event: { stopPropagation(): void },
  activate: () => void,
): void {
  event.stopPropagation();
  activate();
}

export interface FacetParticipantDisclosureTarget {
  initialCursor: string | null;
  remainingCount: number;
  threadId: string;
}

export function participantDisclosureTarget(
  thread: Pick<ThreadFacetQueryThread, "id" | "participantSummary">,
): FacetParticipantDisclosureTarget {
  return {
    initialCursor: thread.participantSummary.nextCursor,
    remainingCount: participantOverflowCount(thread.participantSummary),
    threadId: thread.id,
  };
}

export interface FacetTriageVisibility {
  collapsed: boolean;
  screenFocused: boolean;
}

/** Cached data refreshes on a reopen or a screen-focus regain. */
export function shouldRefreshFacetTriage(args: {
  hasData: boolean;
  next: FacetTriageVisibility;
  previous: FacetTriageVisibility;
}): boolean {
  if (!args.hasData || args.next.collapsed || !args.next.screenFocused) {
    return false;
  }
  return (
    args.previous.collapsed ||
    (!args.previous.screenFocused && args.next.screenFocused)
  );
}
