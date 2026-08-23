import type { P6rPresenceViewer } from "@bb/server-contract";
import { cn } from "@bb/shared-ui/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@bb/shared-ui/tooltip";

const P6R_MAX_VISIBLE_AVATARS = 4;

export type P6rPresenceAvatarSize = "sm" | "md";

interface P6rPresenceAvatarRowProps {
  p6rViewers: readonly P6rPresenceViewer[];
  size?: P6rPresenceAvatarSize;
}

interface P6rPresenceAvatarProps {
  viewer: P6rPresenceViewer;
  size: P6rPresenceAvatarSize;
}

function p6rAvatarSizeClass(size: P6rPresenceAvatarSize): string {
  return size === "md" ? "size-5 text-[10px]" : "size-4 text-[9px]";
}

export function p6rPresenceInitials(p6rDisplayName: string): string {
  const words = p6rDisplayName.trim().split(/\s+/u).filter(Boolean);
  const first = words[0]?.[0] ?? "?";
  const second = words.length > 1 ? (words.at(-1)?.[0] ?? "") : "";
  return `${first}${second}`.toUpperCase();
}

// A viewer with an avatar renders the image; without one, initials on a
// recessed surface (per the claimed-identity contract, p6rImageUrl null = no
// avatar, render initials).
function P6rPresenceAvatar({ viewer, size }: P6rPresenceAvatarProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          data-testid="presence-avatar"
          aria-label={`${viewer.p6rDisplayName} is viewing`}
          className={cn(
            "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full border border-border bg-surface-recessed font-medium leading-none text-muted-foreground",
            p6rAvatarSizeClass(size),
          )}
        >
          {viewer.p6rImageUrl === null ? (
            p6rPresenceInitials(viewer.p6rDisplayName)
          ) : (
            <img
              src={viewer.p6rImageUrl}
              alt=""
              className="size-full object-cover"
            />
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{viewer.p6rDisplayName}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Overlapping avatar row of the p6rCollaborators currently viewing a thread.
 * Callers pre-filter the roster (e.g. exclude the local viewer); renders
 * nothing when it is empty.
 */
export function P6rPresenceAvatarRow({
  p6rViewers,
  size = "md",
}: P6rPresenceAvatarRowProps) {
  if (p6rViewers.length === 0) {
    return null;
  }
  const visible = p6rViewers.slice(0, P6R_MAX_VISIBLE_AVATARS);
  const overflow = p6rViewers.length - visible.length;
  return (
    <span
      data-testid="presence-avatar-row"
      className="inline-flex items-center -space-x-1"
    >
      {visible.map((viewer) => (
        <P6rPresenceAvatar key={viewer.p6rHandle} viewer={viewer} size={size} />
      ))}
      {overflow > 0 ? (
        <span
          className={cn(
            "inline-flex shrink-0 select-none items-center justify-center rounded-full border border-border bg-surface-recessed font-medium leading-none text-muted-foreground",
            p6rAvatarSizeClass(size),
          )}
          aria-label={`${overflow} more p6rViewers`}
        >
          +{overflow}
        </span>
      ) : null}
    </span>
  );
}
