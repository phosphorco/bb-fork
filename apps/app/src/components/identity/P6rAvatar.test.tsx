// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { P6rAvatar, p6rSafeAvatarUrl } from "./P6rAvatar";

afterEach(cleanup);

describe("P6rAvatar", () => {
  it("accepts only HTTPS provider presentation", () => {
    expect(p6rSafeAvatarUrl("https://images.example.test/alice.png")).toBe(
      "https://images.example.test/alice.png",
    );
    expect(p6rSafeAvatarUrl("http://images.example.test/alice.png")).toBeNull();
    expect(p6rSafeAvatarUrl("data:image/png;base64,abc")).toBeNull();
    expect(p6rSafeAvatarUrl("not a url")).toBeNull();
    expect(p6rSafeAvatarUrl(null)).toBeNull();
  });

  it("requests a safe image without credentials or referrer", () => {
    render(
      <P6rAvatar
        p6rDisplayName="Alice Chen"
        p6rImageUrl="https://images.example.test/alice.png"
        className="avatar"
      />,
    );

    const image = screen.getByRole("img", { name: "Alice Chen" });
    expect(image.getAttribute("crossorigin")).toBe("anonymous");
    expect(image.getAttribute("referrerpolicy")).toBe("no-referrer");
  });

  it("renders an accessible neutral fallback when loading fails", () => {
    render(
      <P6rAvatar
        p6rDisplayName="Alice Chen"
        p6rImageUrl="https://images.example.test/missing.png"
        className="avatar"
      />,
    );

    fireEvent.error(screen.getByRole("img", { name: "Alice Chen" }));
    expect(screen.getByRole("img", { name: "Alice Chen" }).textContent).toBe(
      "AC",
    );
  });
});
