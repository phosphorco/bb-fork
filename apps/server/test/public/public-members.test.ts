import { setPluginKvValue } from "@bb/db";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readJson } from "../helpers/json.js";
import { withTestHarness } from "../helpers/test-app.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("/api/v1/p6r-members", () => {
  it("rejects tunnel-originated member management", async () => {
    await withTestHarness(async (harness) => {
      const response = await harness.app.request("/api/v1/p6r-members", {
        headers: { "x-p6r-via-tunnel": "1" },
      });

      expect(response.status).toBe(403);
      await expect(readJson(response)).resolves.toMatchObject({
        code: "member_management_tunnel_forbidden",
      });
    });
  });

  it("returns a clear not-enrolled error without a Connect credential", async () => {
    await withTestHarness(async (harness) => {
      const response = await harness.app.request("/api/v1/p6r-members");

      expect(response.status).toBe(404);
      await expect(readJson(response)).resolves.toMatchObject({
        code: "connect_not_enrolled",
      });
    });
  });

  it("resolves the enrolled server and proxies its member list", async () => {
    await withTestHarness(async (harness) => {
      setPluginKvValue(
        harness.db,
        "connect",
        "credential",
        JSON.stringify({
          serverUrl: "https://owner.getbb.app",
          handle: "owner",
          credential: "bbcred_owner",
        }),
      );
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          Response.json({
            servers: [{ id: "server-1", handle: "owner" }],
          }),
        )
        .mockResolvedValueOnce(
          Response.json([
            {
              p6rUserId: "member-1",
              p6rHandle: "collaborator",
              p6rName: "Collaborator",
              p6rImage: null,
              p6rAddedByUserId: "owner-user",
              p6rCreatedAt: 123,
            },
          ]),
        );
      vi.stubGlobal("fetch", fetchMock);

      const response = await harness.app.request("/api/v1/p6r-members");

      expect(response.status).toBe(200);
      await expect(readJson(response)).resolves.toEqual({
        p6rMembers: [
          {
            p6rUserId: "member-1",
            p6rHandle: "collaborator",
            p6rDisplayName: "Collaborator",
            p6rImageUrl: null,
            p6rAddedByUserId: "owner-user",
            p6rCreatedAt: 123,
          },
        ],
      });
      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        "https://owner.getbb.app/api/connect/servers",
        { headers: { "x-bb-connect-machine": "bbcred_owner" } },
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "https://owner.getbb.app/api/p6r-servers/server-1/p6r-members",
        { headers: { authorization: "Bearer bbcred_owner" } },
      );
    });
  });
});
