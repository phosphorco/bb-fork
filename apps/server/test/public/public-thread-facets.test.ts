import { p6rContributions } from "../../src/services/p6r/sidecar-schema.js";
import { threadFacetQueryResponseSchema } from "@bb/server-contract";
import { describe, expect, it } from "vitest";
import { readJson } from "../helpers/json.js";
import {
  seedHostSession,
  seedProjectWithSource,
  seedThread,
} from "../helpers/seed.js";
import { withTestHarness } from "../helpers/test-app.js";

const aliceKey = "p6r:identity-boundaries%2Ftailnet/alice";
const bobKey = "p6r:identity-boundaries%2Ftailnet/bob";

function actor(args: {
  displayName: string;
  key: string;
  kind: "external" | "person";
}) {
  return {
    evidence: "provider-verified",
    identity: args.kind === "person"
      ? {
          key: args.key,
          kind: "person",
          issuer: "identity-boundaries/tailnet",
          subject: args.key.slice(args.key.lastIndexOf("/") + 1),
        }
      : {
          key: args.key,
          kind: "external",
          pluginId: "rosetta-slack",
          subject: args.key.slice(args.key.lastIndexOf("/") + 1),
        },
    presentation: {
      displayName: args.displayName,
      avatarUrl: `/avatars/${args.displayName.toLowerCase()}.png`,
    },
  };
}

describe("public thread participant facets", () => {
  it("rebuilds accepted native authors before the first contains/notContains filter and retains relative avatars", async () => {
    await withTestHarness(async (harness) => {
      const { host } = seedHostSession(harness.deps);
      const { project } = seedProjectWithSource(harness.deps, {
        hostId: host.id,
        path: "/tmp/public-thread-participant-facets",
      });
      const aliceThread = seedThread(harness.deps, { projectId: project.id });
      const bobThread = seedThread(harness.deps, { projectId: project.id });
      const alice = actor({ displayName: "Alice", key: aliceKey, kind: "person" });
      const bob = actor({ displayName: "Bob", key: bobKey, kind: "external" });
      harness.db.insert(p6rContributions).values([
        {
          id: "participant-alice",
          threadId: aliceThread.id,
          acceptedAt: 1,
          acceptedAuthorship: JSON.stringify(alice),
          initialInput: "[]",
          currentProjection: "[]",
          latestEditor: JSON.stringify(alice),
          nativeRequestId: null,
          copiedFromContributionId: null,
          replacesContributionId: null,
        },
        {
          id: "participant-bob",
          threadId: bobThread.id,
          acceptedAt: 2,
          acceptedAuthorship: JSON.stringify(bob),
          initialInput: "[]",
          currentProjection: "[]",
          latestEditor: JSON.stringify(bob),
          nativeRequestId: null,
          copiedFromContributionId: null,
          replacesContributionId: null,
        },
      ]).run();

      const contains = await harness.app.request("/api/v1/threads/facet-query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scope: { projectId: project.id },
          filters: [{ typeId: "core/participants", operator: "contains", member: aliceKey }],
          pageSize: 10,
        }),
      });
      expect(contains.status, await contains.clone().text()).toBe(200);
      const page = threadFacetQueryResponseSchema.parse(await readJson(contains));
      expect(page.threads.map((thread) => thread.id)).toEqual([aliceThread.id]);
      expect(page.threads[0]?.participantSummary.profiles).toContainEqual({
        p6rPrincipalKey: aliceKey,
        p6rIdentityKind: "person",
        p6rDisplayName: "Alice",
        p6rImageUrl: "/avatars/alice.png",
      });

      const notContains = await harness.app.request("/api/v1/threads/facet-query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scope: { projectId: project.id },
          filters: [{ typeId: "core/participants", operator: "notContains", member: aliceKey }],
          pageSize: 10,
        }),
      });
      expect(notContains.status, await notContains.clone().text()).toBe(200);
      expect(
        threadFacetQueryResponseSchema.parse(await readJson(notContains)).threads.map((thread) => thread.id),
      ).toEqual([bobThread.id]);
    });
  });
});
