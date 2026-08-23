import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createConnection,
  p6rGetCollaborator,
  migrate,
  type DbConnection,
} from "@bb/db";
import {
  P6R_CLAIMED_IDENTITY_HEADER,
  p6rEncodeClaimedIdentityHeader,
  p6rPrincipalKeySchema,
  type P6rClaimedIdentity,
} from "@bb/domain";
import {
  p6rCreateActorService,
  p6rResolveRequestActor,
} from "../../src/services/actors.js";

const defaultActor: P6rClaimedIdentity = {
  p6rHandle: "local",
  p6rDisplayName: "Local Operator",
  p6rImageUrl: null,
  p6rClientId: "local",
  p6rPrincipalKey: p6rPrincipalKeySchema.parse("local:local"),
};

function headerReader(value: string | undefined) {
  return {
    header(name: string): string | undefined {
      return name === P6R_CLAIMED_IDENTITY_HEADER ? value : undefined;
    },
  };
}

describe("request actors", () => {
  let db: DbConnection;

  beforeEach(() => {
    db = createConnection(":memory:");
    migrate(db);
  });

  afterEach(() => {
    db.$client.close();
  });

  it("resolves and normalizes a valid claimed identity header", () => {
    const encoded = p6rEncodeClaimedIdentityHeader({
      p6rHandle: " Sawyer ",
      p6rDisplayName: "Sawyer",
      p6rImageUrl: "https://example.test/avatar.png",
      p6rClientId: "browser-1",
      p6rPrincipalKey: p6rPrincipalKeySchema.parse("github:spoofed"),
    });

    expect(p6rResolveRequestActor(headerReader(encoded), defaultActor)).toEqual(
      expect.objectContaining({
        p6rHandle: "sawyer",
        p6rDisplayName: "Sawyer",
        p6rImageUrl: "https://example.test/avatar.png",
        p6rClientId: "browser-1",
      }),
    );
    expect(
      p6rResolveRequestActor(headerReader(encoded), defaultActor)
        .p6rPrincipalKey,
    ).toBe(defaultActor.p6rPrincipalKey);
  });

  it("falls back to the local operator for a malformed header", () => {
    expect(
      p6rResolveRequestActor(
        headerReader("not-valid-encoded-json"),
        defaultActor,
      ),
    ).toBe(defaultActor);
  });

  it("skips unchanged collaborator writes within the debounce window", () => {
    let now = 1_000;
    const actorService = p6rCreateActorService({
      db,
      defaultActor,
      now: () => now,
    });
    const encoded = p6rEncodeClaimedIdentityHeader({
      p6rHandle: "Sawyer",
      p6rDisplayName: "Sawyer",
      p6rImageUrl: null,
      p6rClientId: "browser-1",
    });

    actorService.p6rResolveRequest(headerReader(encoded));
    now = 2_000;
    actorService.p6rResolveRequest(headerReader(encoded));

    expect(p6rGetCollaborator(db, "sawyer")?.p6rLastSeenAt).toBe(1_000);

    now = 61_000;
    actorService.p6rResolveRequest(headerReader(encoded));

    expect(p6rGetCollaborator(db, "sawyer")?.p6rLastSeenAt).toBe(61_000);
  });
});
