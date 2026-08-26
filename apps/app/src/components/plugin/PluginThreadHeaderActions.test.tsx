// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetPluginSlotStoreForTest,
  setPluginSlotRegistrations,
} from "@/lib/plugin-slots";
import {
  PaneContext,
  type PaneContextValue,
} from "@/views/thread-detail/PaneContext";
import { PluginThreadHeaderActions } from "./PluginThreadHeaderActions";

const resize = vi.hoisted(() => ({
  callback: null as ResizeObserverCallback | null,
  paneWidth: 700,
}));

vi.mock("@bb/shared-ui/hooks/use-compact-viewport", () => ({
  useIsCompactViewport: () => false,
}));

vi.mock("@/lib/plugin-css", () => ({ usePluginCss: () => undefined }));

const PANE_CONTEXT: PaneContextValue = {
  paneId: "left",
  isFocused: true,
  isSplitPane: true,
  secondaryPanelHost: null,
  reservesWindowPanelToggle: false,
  onRequestClose: null,
  isMaximized: false,
  onToggleMaximize: null,
  isBoundedPane: true,
  isTopRow: true,
  ownsWindowTopLeft: true,
  navigateInPane: vi.fn(),
};

beforeEach(() => {
  resize.paneWidth = 700;
  resize.callback = null;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () =>
      ({
        bottom: 40,
        height: 40,
        left: 0,
        right: resize.paneWidth,
        top: 0,
        width: resize.paneWidth,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect,
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        resize.callback = callback;
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
  setPluginSlotRegistrations("responsive-header", {
    homepageSections: [],
    settingsSections: [],
    navPanels: [],
    threadPanelActions: [],
    sidebarFooterActions: [],
    fileOpeners: [],
    messageDirectives: [],
    threadHeaderActions: [
      {
        id: "status",
        title: "Status",
        component: ({ isCompactViewport }) => (
          <span>{isCompactViewport ? "compact" : "full"}</span>
        ),
      },
    ],
  });
});

afterEach(() => {
  cleanup();
  resetPluginSlotStoreForTest();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("PluginThreadHeaderActions", () => {
  it("compacts plugin controls from split-pane width and updates on resize", async () => {
    render(
      <PaneContext.Provider value={PANE_CONTEXT}>
        <div data-split-pane-id="left">
          <PluginThreadHeaderActions threadId="thr_left" projectId="proj" />
        </div>
      </PaneContext.Provider>,
    );

    expect(screen.getByText("compact")).not.toBeNull();

    resize.paneWidth = 1000;
    resize.callback?.([], {} as ResizeObserver);

    await waitFor(() => expect(screen.getByText("full")).not.toBeNull());
  });
});
