import { useMemo } from "react";
import type { P6rPresenceViewer } from "@bb/server-contract";
import { useP6rClaimedIdentity } from "@/lib/claimed-identity-store";
import { useP6rThreadPresenceViewers } from "@/lib/presence-store";
import { P6rPresenceAvatarRow } from "./PresenceAvatarRow";
import {
  P6rTypingIndicator,
  type P6rTypingParticipant,
} from "./TypingIndicator";

/**
 * The other people looking at this thread: the live roster minus the viewer's
 * exact server-authored PrincipalKey. Presentation fields never participate in
 * self suppression.
 */
function useOtherThreadViewers(threadId: string): readonly P6rPresenceViewer[] {
  const p6rViewers = useP6rThreadPresenceViewers(threadId);
  const ownPrincipalKey = useP6rClaimedIdentity()?.p6rPrincipalKey;
  return useMemo(
    () =>
      ownPrincipalKey === undefined
        ? p6rViewers
        : p6rViewers.filter(
            (viewer) => viewer.p6rPrincipalKey !== ownPrincipalKey,
          ),
    [p6rViewers, ownPrincipalKey],
  );
}

/** Thread-header avatar row of the other current p6rViewers. */
export function P6rThreadPresenceHeaderAvatars({
  threadId,
}: {
  threadId: string;
}) {
  const others = useOtherThreadViewers(threadId);
  return <P6rPresenceAvatarRow p6rViewers={others} />;
}

/** Human display-label line for other p6rViewers currently p6rTyping. */
export function P6rThreadTypingIndicator({ threadId }: { threadId: string }) {
  const others = useOtherThreadViewers(threadId);
  const typingParticipants = useMemo<readonly P6rTypingParticipant[]>(
    () =>
      others
        .filter((viewer) => viewer.p6rTyping)
        .map(({ p6rDisplayName, p6rHandle }) => ({
          p6rDisplayName,
          p6rHandle,
        })),
    [others],
  );
  return <P6rTypingIndicator participants={typingParticipants} />;
}
