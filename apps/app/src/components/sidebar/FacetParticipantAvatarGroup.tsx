import {
  useMemo,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import type { P6rThreadParticipantProfile } from "@bb/domain";
import type { ThreadFacetParticipantSummary } from "@bb/server-contract";
import { Button } from "@bb/shared-ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@bb/shared-ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@bb/shared-ui/tooltip";
import { p6rPresenceInitials } from "@/components/thread/presence/PresenceAvatarRow";
import { useThreadFacetParticipantPages } from "@/hooks/queries/my-progress-query";

function stopNestedClick(event: MouseEvent<HTMLElement>): void {
  event.stopPropagation();
}

function stopNestedPointerDown(event: PointerEvent<HTMLElement>): void {
  event.stopPropagation();
}

function stopNestedKeyDown(event: KeyboardEvent<HTMLElement>): void {
  event.stopPropagation();
}

function ParticipantAvatar({
  participant,
}: {
  participant: P6rThreadParticipantProfile;
}) {
  const [isNameDisclosed, setIsNameDisclosed] = useState(false);

  return (
    <Tooltip open={isNameDisclosed} onOpenChange={setIsNameDisclosed}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={participant.p6rDisplayName}
          data-participant-key={participant.p6rPrincipalKey}
          className="relative inline-flex size-5 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-sidebar-border bg-surface-recessed text-[9px] font-medium leading-none text-muted-foreground outline-none ring-sidebar-ring hover:z-10 focus-visible:z-10 focus-visible:ring-2"
          onClick={(event) => {
            stopNestedClick(event);
            setIsNameDisclosed(true);
          }}
          onPointerDown={stopNestedPointerDown}
          onKeyDown={stopNestedKeyDown}
        >
          {participant.p6rImageUrl === null ? (
            <span aria-hidden="true" title={participant.p6rDisplayName}>
              {p6rPresenceInitials(participant.p6rDisplayName)}
            </span>
          ) : (
            <img
              src={participant.p6rImageUrl}
              alt={participant.p6rDisplayName}
              title={participant.p6rDisplayName}
              className="size-full object-cover"
            />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{participant.p6rDisplayName}</TooltipContent>
    </Tooltip>
  );
}

function ParticipantOverflowDisclosure({
  count,
  initialCursor,
  threadId,
}: {
  count: number;
  initialCursor: string;
  threadId: string;
}) {
  const [open, setOpen] = useState(false);
  const participantsQuery = useThreadFacetParticipantPages({
    enabled: open,
    initialCursor,
    threadId,
  });
  const participants = useMemo(
    () => participantsQuery.data?.pages.flatMap((page) => page.profiles) ?? [],
    [participantsQuery.data],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${count} more participants`}
          className="relative z-10 inline-flex h-5 min-w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border border-sidebar-border bg-surface-recessed px-1 text-[9px] font-medium leading-none text-muted-foreground outline-none ring-sidebar-ring hover:bg-sidebar-accent focus-visible:ring-2"
          onClick={stopNestedClick}
          onPointerDown={stopNestedPointerDown}
          onKeyDown={stopNestedKeyDown}
        >
          +{count}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        mobileTitle="More participants"
        aria-label="More participants"
        className="w-64 space-y-3 p-3"
        onClick={stopNestedClick}
        onPointerDown={stopNestedPointerDown}
        onKeyDown={stopNestedKeyDown}
      >
        <p className="text-sm font-medium">More participants</p>
        {participantsQuery.isLoading ? (
          <p className="text-xs text-muted-foreground">Loading participants…</p>
        ) : participantsQuery.isError ? (
          <p role="alert" className="text-xs text-destructive">
            Participants unavailable
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {participants.map((participant) => (
              <li key={participant.p6rPrincipalKey}>
                {participant.p6rDisplayName}
              </li>
            ))}
          </ul>
        )}
        {participantsQuery.hasNextPage ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={participantsQuery.isFetchingNextPage}
            onClick={() => participantsQuery.fetchNextPage()}
          >
            {participantsQuery.isFetchingNextPage
              ? "Loading participants…"
              : "Load more participants"}
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function participantGroupLabel(summary: ThreadFacetParticipantSummary): string {
  const names = summary.profiles.map(
    (participant) => participant.p6rDisplayName,
  );
  const overflow = Math.max(0, summary.totalCount - summary.profiles.length);
  return `Participants: ${names.join(", ")}${
    overflow > 0 ? `, and ${overflow} more` : ""
  }`;
}

export function FacetParticipantAvatarGroup({
  summary,
  threadId,
}: {
  summary: ThreadFacetParticipantSummary;
  threadId: string;
}) {
  if (summary.totalCount === 0 || summary.profiles.length === 0) {
    return null;
  }

  const overflow = Math.max(0, summary.totalCount - summary.profiles.length);

  return (
    <span
      role="group"
      aria-label={participantGroupLabel(summary)}
      data-testid="facet-participant-avatar-group"
      className="relative z-10 inline-flex shrink-0 items-center -space-x-1"
    >
      {summary.profiles.map((participant) => (
        <ParticipantAvatar
          key={participant.p6rPrincipalKey}
          participant={participant}
        />
      ))}
      {overflow > 0 && summary.nextCursor !== null ? (
        <ParticipantOverflowDisclosure
          count={overflow}
          initialCursor={summary.nextCursor}
          threadId={threadId}
        />
      ) : null}
    </span>
  );
}
