import type { P6rPresenceViewer } from "@bb/server-contract";

const P6R_MAX_VISIBLE_DOTS = 3;

/**
 * Compact viewer markers for sidebar thread rows: one initial-dot per remote
 * viewer profile from the presence summary. Purely decorative — the row's own
 * link handles navigation (clicking a dot follows/jumps to the thread). The
 * handles input remains a legacy story/consumer compatibility shape.
 */
export function P6rSidebarPresenceDots({
  viewers,
  handles,
}: {
  viewers?: readonly P6rPresenceViewer[];
  handles?: readonly string[];
}) {
  const entries =
    viewers ??
    handles?.map(
      (p6rHandle): P6rPresenceViewer => ({
        p6rPrincipalKey: undefined,
        p6rHandle,
        p6rDisplayName: p6rHandle,
        p6rImageUrl: null,
        p6rTyping: false,
      }),
    ) ??
    [];
  if (entries.length === 0) {
    return null;
  }
  const visible = entries.slice(0, P6R_MAX_VISIBLE_DOTS);
  const overflow = entries.length - visible.length;
  return (
    <span
      data-testid="sidebar-presence-dots"
      aria-label={`Viewing: ${entries.map((viewer) => viewer.p6rDisplayName || viewer.p6rHandle).join(", ")}`}
      className="pointer-events-none inline-flex shrink-0 items-center -space-x-0.5"
    >
      {visible.map((viewer, index) => (
        <span
          key={viewer.p6rPrincipalKey ?? `${viewer.p6rHandle}-${index}`}
          title={viewer.p6rDisplayName || viewer.p6rHandle}
          className="inline-flex size-3.5 select-none items-center justify-center rounded-full border border-sidebar-border bg-sidebar-accent text-[8px] font-medium uppercase leading-none text-sidebar-accent-foreground"
        >
          {(viewer.p6rDisplayName || viewer.p6rHandle)[0] ?? "?"}
        </span>
      ))}
      {overflow > 0 ? (
        <span className="inline-flex size-3.5 select-none items-center justify-center rounded-full border border-sidebar-border bg-sidebar-accent text-[8px] font-medium leading-none text-sidebar-accent-foreground">
          +{overflow}
        </span>
      ) : null}
    </span>
  );
}
