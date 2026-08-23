import type { P6rPresenceViewer } from "@bb/server-contract";

export type P6rTypingParticipant = Pick<
  P6rPresenceViewer,
  "p6rDisplayName" | "p6rHandle"
>;

function p6rParticipantLabel(participant: P6rTypingParticipant): string {
  return participant.p6rDisplayName || participant.p6rHandle;
}

export function p6rTypingIndicatorLabel(
  participants: readonly P6rTypingParticipant[],
): string | null {
  if (participants.length === 0) {
    return null;
  }
  const labels = participants.map(p6rParticipantLabel);
  if (participants.length === 1) {
    return `${labels[0]} is typing…`;
  }
  if (participants.length === 2) {
    return `${labels[0]} and ${labels[1]} are typing…`;
  }
  return `${labels[0]} and ${participants.length - 1} others are typing…`;
}

/**
 * One-line composer-adjacent p6rTyping readout for other p6rCollaborators. Renders
 * nothing when no one else is p6rTyping.
 */
export function P6rTypingIndicator({
  participants,
  handles,
}: {
  participants?: readonly P6rTypingParticipant[];
  handles?: readonly string[];
}) {
  const displayParticipants =
    participants ??
    handles?.map((p6rHandle) => ({
      p6rDisplayName: p6rHandle,
      p6rHandle,
    })) ??
    [];
  const label = p6rTypingIndicatorLabel(displayParticipants);
  if (label === null) {
    return null;
  }
  return (
    <p
      data-testid="thread-p6rTyping-indicator"
      aria-live="polite"
      className="px-2 text-xs text-muted-foreground"
    >
      {label}
    </p>
  );
}
