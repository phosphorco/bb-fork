import { describe, expect, it } from "vitest";
import {
  getStoredThemeId,
  p6rClearStoredAppearanceForPrincipalKey,
  p6rListStoredPrincipalAppearance,
  p6rSetStoredAppearanceForPrincipalKey,
  p6rUpsertActorSnapshot,
} from "@bb/db";
import { defaultFaviconColor, type P6rActorSnapshot } from "@bb/domain";
import { systemConfigResponseSchema } from "@bb/server-contract";
import { p6rCreateLocalOperatorIdentity } from "../../src/services/actors.js";
import { P6R_LOCAL_OPERATOR_PROVIDER_ID } from "../../src/services/identity.js";
import {
  p6rBuildPaletteRoster,
  p6rResolveAppearanceSelection,
} from "../../src/services/system/p6r-principal-appearance.js";
import { readJson } from "../helpers/json.js";
import { withTestHarness } from "../helpers/test-app.js";

const alice: P6rActorSnapshot = {
  p6rProviderId: "tailscale",
  p6rSubject: "1001",
  p6rHandle: "alice",
  p6rDisplayName: "Alice",
  p6rImageUrl: null,
};

const aliceKey = "p6r:tailscale/1001";

const bob: P6rActorSnapshot = {
  p6rProviderId: "tailscale",
  p6rSubject: "1002",
  p6rHandle: "bob",
  p6rDisplayName: "Bob",
  p6rImageUrl: null,
};

describe("p6r principal appearance", () => {
  it("overrides the shared palette only for the principal who stored one", async () => {
    await withTestHarness(async (harness) => {
      p6rSetStoredAppearanceForPrincipalKey(harness.db, aliceKey, {
        themeId: "dracula",
        faviconColor: defaultFaviconColor,
      });

      expect(p6rResolveAppearanceSelection(harness.db, alice).themeId).toBe(
        "dracula",
      );
      // The shared row, other principals, and local sessions are untouched.
      expect(getStoredThemeId(harness.db)).toBe("default");
      expect(p6rResolveAppearanceSelection(harness.db, bob).themeId).toBe(
        "default",
      );
      expect(p6rResolveAppearanceSelection(harness.db, null).themeId).toBe(
        "default",
      );

      p6rClearStoredAppearanceForPrincipalKey(harness.db, aliceKey);
      expect(p6rResolveAppearanceSelection(harness.db, alice).themeId).toBe(
        "default",
      );
      expect(p6rListStoredPrincipalAppearance(harness.db)).toEqual([]);
    });
  });

  it("resolves the local operator from the shared row, never a personal one", async () => {
    await withTestHarness(async (harness) => {
      const localIdentity = p6rCreateLocalOperatorIdentity();
      const localOperator: P6rActorSnapshot = {
        p6rProviderId: P6R_LOCAL_OPERATOR_PROVIDER_ID,
        p6rSubject: localIdentity.p6rHandle,
        p6rHandle: localIdentity.p6rHandle,
        p6rDisplayName: localIdentity.p6rDisplayName,
        p6rImageUrl: localIdentity.p6rImageUrl,
      };

      const put = await harness.app.request("/api/v1/settings/appearance", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ themeId: "nord", faviconColor: "default" }),
      });
      expect(put.status).toBe(200);

      // The Settings write stayed on the shared row and the local operator
      // reads it from there.
      expect(getStoredThemeId(harness.db)).toBe("nord");
      expect(p6rListStoredPrincipalAppearance(harness.db)).toEqual([]);
      expect(
        p6rResolveAppearanceSelection(harness.db, localOperator).themeId,
      ).toBe("nord");
    });
  });

  it("rejects personal overrides from sessions that follow the shared row", async () => {
    await withTestHarness(async (harness) => {
      const put = await harness.app.request(
        "/api/v1/settings/p6r-personal-appearance",
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ themeId: "nord", faviconColor: "default" }),
        },
      );
      expect(put.status).toBe(400);

      const clear = await harness.app.request(
        "/api/v1/settings/p6r-personal-appearance",
        { method: "DELETE" },
      );
      expect(clear.status).toBe(400);
      expect(p6rListStoredPrincipalAppearance(harness.db)).toEqual([]);
    });
  });

  it("builds a roster of each person's choice with null for followers", async () => {
    await withTestHarness(async (harness) => {
      const now = Date.now();
      p6rUpsertActorSnapshot(harness.db, alice, now);
      p6rUpsertActorSnapshot(harness.db, bob, now + 1);
      p6rSetStoredAppearanceForPrincipalKey(harness.db, aliceKey, {
        themeId: "gruvbox",
        faviconColor: defaultFaviconColor,
      });

      const roster = p6rBuildPaletteRoster(harness.db);
      expect(roster).toEqual([
        {
          p6rPrincipalKey: "p6r:tailscale/1002",
          p6rHandle: "bob",
          p6rDisplayName: "Bob",
          p6rImageUrl: null,
          themeId: null,
        },
        {
          p6rPrincipalKey: aliceKey,
          p6rHandle: "alice",
          p6rDisplayName: "Alice",
          p6rImageUrl: null,
          themeId: "gruvbox",
        },
      ]);
    });
  });

  it("reflects the shared choice in /system/config's roster entry for the local operator", async () => {
    await withTestHarness(async (harness) => {
      const put = await harness.app.request("/api/v1/settings/appearance", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ themeId: "nord", faviconColor: "default" }),
      });
      expect(put.status).toBe(200);

      const response = await harness.app.request("/api/v1/system/config");
      expect(response.status).toBe(200);
      const body = systemConfigResponseSchema.parse(await readJson(response));
      expect(body.appearance.themeId).toBe("nord");
      const localOperator = p6rCreateLocalOperatorIdentity();
      expect(body.p6rPaletteRoster).toEqual([
        {
          p6rPrincipalKey: expect.stringContaining("local:"),
          p6rHandle: localOperator.p6rHandle,
          p6rDisplayName: localOperator.p6rDisplayName,
          p6rImageUrl: null,
          themeId: "nord",
        },
      ]);
    });
  });
});
