import { describe, expect, it } from "vitest";
import { p6rListCollaborators } from "@bb/db";
import {
  P6R_CLAIMED_IDENTITY_HEADER,
  p6rEncodeClaimedIdentityHeader,
} from "@bb/domain";
import { p6rCreateLocalOperatorIdentity } from "../../src/services/actors.js";
import { withTestHarness } from "../helpers/test-app.js";

describe("public request actors", () => {
  it("ignores a client-claimed identity on an API request", async () => {
    await withTestHarness(async (harness) => {
      const response = await harness.app.request("/api/v1/does-not-exist", {
        headers: {
          [P6R_CLAIMED_IDENTITY_HEADER]: p6rEncodeClaimedIdentityHeader({
            p6rHandle: "Sawyer",
            p6rDisplayName: "Sawyer Hood",
            p6rImageUrl: null,
            p6rClientId: "browser-1",
          }),
        },
      });

      expect(response.status).toBe(404);
      const localOperator = p6rCreateLocalOperatorIdentity();
      expect(p6rListCollaborators(harness.db)).toEqual([
        {
          p6rHandle: localOperator.p6rHandle,
          p6rDisplayName: localOperator.p6rDisplayName,
          p6rImageUrl: null,
          p6rFirstSeenAt: expect.any(Number),
          p6rLastSeenAt: expect.any(Number),
        },
      ]);
    });
  });

  it("records the local operator when the claimed identity is malformed", async () => {
    await withTestHarness(async (harness) => {
      const response = await harness.app.request("/api/v1/does-not-exist", {
        headers: {
          [P6R_CLAIMED_IDENTITY_HEADER]: "malformed",
        },
      });

      expect(response.status).toBe(404);
      const localOperator = p6rCreateLocalOperatorIdentity();
      expect(p6rListCollaborators(harness.db)).toEqual([
        {
          p6rHandle: localOperator.p6rHandle,
          p6rDisplayName: localOperator.p6rDisplayName,
          p6rImageUrl: null,
          p6rFirstSeenAt: expect.any(Number),
          p6rLastSeenAt: expect.any(Number),
        },
      ]);
    });
  });

  it("does not persist equivalent client-claimed handles as collaborators", async () => {
    await withTestHarness(async (harness) => {
      for (const p6rHandle of ["Sawyer ", "sawyer"]) {
        await harness.app.request("/api/v1/does-not-exist", {
          headers: {
            [P6R_CLAIMED_IDENTITY_HEADER]: p6rEncodeClaimedIdentityHeader({
              p6rHandle,
              p6rDisplayName: "Sawyer",
              p6rImageUrl: null,
              p6rClientId: "browser-1",
            }),
          },
        });
      }

      expect(p6rListCollaborators(harness.db)).toHaveLength(1);
      expect(p6rListCollaborators(harness.db)[0]?.p6rHandle).toBe(
        p6rCreateLocalOperatorIdentity().p6rHandle,
      );
    });
  });

  it("accepts only the presentation claim on a remote no-provider request", async () => {
    await withTestHarness(async (harness) => {
      const response = await harness.app.request(
        "http://100.64.0.10/api/v1/does-not-exist",
        {
          headers: {
            [P6R_CLAIMED_IDENTITY_HEADER]: p6rEncodeClaimedIdentityHeader({
              p6rHandle: "Sawyer",
              p6rDisplayName: "Sawyer Hood",
              p6rImageUrl: null,
              p6rClientId: "browser-1",
            }),
          },
        },
      );

      expect(response.status).toBe(404);
      expect(p6rListCollaborators(harness.db)).toEqual([
        {
          p6rHandle: "sawyer",
          p6rDisplayName: "Sawyer Hood",
          p6rImageUrl: null,
          p6rFirstSeenAt: expect.any(Number),
          p6rLastSeenAt: expect.any(Number),
        },
      ]);
    });
  });
});
