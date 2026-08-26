import { useLayoutEffect, useRef, useState } from "react";
import { useIsCompactViewport } from "@bb/shared-ui/hooks/use-compact-viewport";
import { PluginSlotMount } from "./PluginSlotMount";
import { usePluginSlots } from "@/lib/plugin-slots";
import { usePaneContext } from "@/views/thread-detail/PaneContext";

const COMPACT_THREAD_HEADER_MAX_WIDTH = 880;

/**
 * Plugin `experimental_threadHeaderAction` slots: components rendered in the
 * thread header's action row, beside the host-rendered buttons that
 * `bb.ui.registerThreadAction` contributes from a plugin backend.
 *
 * One mount per pane, each with that pane's thread, so a split layout shows
 * the control once per visible thread.
 */
export function PluginThreadHeaderActions({
  threadId,
  projectId,
}: {
  threadId: string;
  projectId: string;
}) {
  const { threadHeaderActions } = usePluginSlots();
  const isCompactViewport = useIsCompactViewport();
  const { isSplitPane } = usePaneContext();
  const actionsRef = useRef<HTMLSpanElement>(null);
  const [isCompactPane, setIsCompactPane] = useState(false);

  useLayoutEffect(() => {
    if (!isSplitPane) {
      setIsCompactPane(false);
      return;
    }
    const actions = actionsRef.current;
    const pane = actions?.closest<HTMLElement>("[data-split-pane-id]");
    if (!pane) return;
    const measure = () => {
      setIsCompactPane(
        pane.getBoundingClientRect().width < COMPACT_THREAD_HEADER_MAX_WIDTH,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(pane);
    return () => observer.disconnect();
  }, [isSplitPane]);

  if (threadHeaderActions.length === 0) return null;

  return (
    <span ref={actionsRef} className="contents">
      {threadHeaderActions.map((slot) => {
        const Component = slot.component;
        return (
          <PluginSlotMount
            // Per pane as well as per slot: two panes mount the same slot at
            // once, and each needs its own boundary and React subtree.
            key={`${slot.pluginId}/${slot.id}/${slot.generation}/${threadId}`}
            pluginId={slot.pluginId}
            slotKind="threadHeaderAction"
            slotId={slot.id}
            // Per pane, so a crash in one pane's control leaves the other
            // pane's copy working.
            instanceId={threadId}
            // A crash leaves the rest of the header working. There is nothing
            // host-owned to fall back to, so the control simply disappears.
            crashFallback={null}
          >
            {/* role="group" so the label is actually exposed — a bare span
                with aria-label is ignored by assistive software. The plugin
                still labels its own control; this names the region. */}
            <span
              role="group"
              aria-label={slot.title}
              // The header is a fixed 48px chrome row, so clamp the LAYOUT
              // box: an oversized control cannot push the title out or grow
              // the row. Deliberately NOT `overflow-hidden` — that also clips
              // a popover anchored to the control, which is the normal way to
              // show anything taller than the row.
              className="flex max-h-7 max-w-64 shrink-0 items-center"
            >
              <Component
                threadId={threadId}
                projectId={projectId}
                isCompactViewport={isCompactViewport || isCompactPane}
              />
            </span>
          </PluginSlotMount>
        );
      })}
    </span>
  );
}
