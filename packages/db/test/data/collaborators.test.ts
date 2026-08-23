import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createConnection,
  p6rGetCollaborator,
  p6rListCollaborators,
  migrate,
  p6rUpsertCollaborator,
  type DbConnection,
} from "../../src/index.js";

describe("p6rCollaborators data", () => {
  let db: DbConnection;

  beforeEach(() => {
    db = createConnection(":memory:");
    migrate(db);
  });

  afterEach(() => {
    db.$client.close();
  });

  it("inserts a collaborator with matching first and last seen timestamps", () => {
    const collaborator = p6rUpsertCollaborator(
      db,
      {
        p6rHandle: "sawyer",
        p6rDisplayName: "Sawyer",
        p6rImageUrl: null,
      },
      1_000,
    );

    expect(collaborator).toEqual({
      p6rHandle: "sawyer",
      p6rDisplayName: "Sawyer",
      p6rImageUrl: null,
      p6rFirstSeenAt: 1_000,
      p6rLastSeenAt: 1_000,
    });
    expect(p6rGetCollaborator(db, "sawyer")).toEqual(collaborator);
  });

  it("updates display fields and last seen while preserving first seen", () => {
    p6rUpsertCollaborator(
      db,
      {
        p6rHandle: "sawyer",
        p6rDisplayName: "Sawyer",
        p6rImageUrl: null,
      },
      1_000,
    );

    const updated = p6rUpsertCollaborator(
      db,
      {
        p6rHandle: "sawyer",
        p6rDisplayName: "Sawyer Hood",
        p6rImageUrl: "https://example.test/sawyer.png",
      },
      2_000,
    );

    expect(updated).toEqual({
      p6rHandle: "sawyer",
      p6rDisplayName: "Sawyer Hood",
      p6rImageUrl: "https://example.test/sawyer.png",
      p6rFirstSeenAt: 1_000,
      p6rLastSeenAt: 2_000,
    });
    expect(p6rListCollaborators(db)).toEqual([updated]);
  });
});
