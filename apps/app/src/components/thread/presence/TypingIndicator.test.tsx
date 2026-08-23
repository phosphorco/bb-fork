// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { P6rTypingIndicator, p6rTypingIndicatorLabel } from "./TypingIndicator";

afterEach(cleanup);

describe("p6r typing presentation", () => {
  it("uses a remote display label and human singular copy", () => {
    render(
      <P6rTypingIndicator
        participants={[{ p6rDisplayName: "Alice Chen", p6rHandle: "alice" }]}
      />,
    );

    const indicator = screen.getByTestId("thread-p6rTyping-indicator");
    expect(indicator.textContent).toBe("Alice Chen is typing…");
    expect(indicator.textContent).not.toMatch(/p6rTyping|@alice/u);
  });

  it("preserves distinct equal-presentation participants in plural copy", () => {
    expect(
      p6rTypingIndicatorLabel([
        { p6rDisplayName: "Alice Chen", p6rHandle: "alice" },
        { p6rDisplayName: "Alice Chen", p6rHandle: "alice-2" },
      ]),
    ).toBe("Alice Chen and Alice Chen are typing…");
  });

  it("renders no banner for an empty resolved participant projection", () => {
    render(<P6rTypingIndicator participants={[]} />);
    expect(screen.queryByTestId("thread-p6rTyping-indicator")).toBeNull();
  });
});
