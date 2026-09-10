import { describe, expect, it, vi } from "vitest";
import {
  p6rIsDynamicImportError,
  p6rRecoverFromStaleDynamicImport,
} from "./chunk-load-recovery";

function storage(): Pick<Storage, "getItem" | "setItem"> {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe("stale dynamic-import recovery", () => {
  it("recognizes browser dynamic-import failures", () => {
    expect(
      p6rIsDynamicImportError(
        new TypeError("Failed to fetch dynamically imported module: /assets/x.js"),
      ),
    ).toBe(true);
    expect(
      p6rIsDynamicImportError(new TypeError("Importing a module script failed.")),
    ).toBe(true);
    expect(p6rIsDynamicImportError(new Error("terminal creation failed"))).toBe(
      false,
    );
  });

  it("reloads once and suppresses an immediate retry", () => {
    const reload = vi.fn();
    const environment = {
      now: () => 1_000,
      reload,
      storage: storage(),
    };
    const error = new TypeError("Failed to fetch dynamically imported module");

    expect(p6rRecoverFromStaleDynamicImport(error, environment)).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
    expect(p6rRecoverFromStaleDynamicImport(error, environment)).toBe(false);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("allows a later retry after the cooldown", () => {
    const reload = vi.fn();
    let now = 1_000;
    const environment = {
      now: () => now,
      reload,
      storage: storage(),
    };
    const error = new TypeError("error loading dynamically imported module");

    expect(p6rRecoverFromStaleDynamicImport(error, environment)).toBe(true);
    now += 30_000;
    expect(p6rRecoverFromStaleDynamicImport(error, environment)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
