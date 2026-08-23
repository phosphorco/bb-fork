import { describe, expect, it } from "vitest";
import {
  createConnection,
  migrate,
  p6rGetActorSnapshot,
  type DbConnection,
} from "@bb/db";
import {
  P6R_CLAIMED_IDENTITY_HEADER,
  type P6rClaimedIdentity,
} from "@bb/domain";
import {
  P6R_IDENTITY_PROVIDER_TIMEOUT_MS,
  p6rCreateIdentityBoundary,
  type P6rIdentityRequestInput,
} from "../../src/services/identity.js";
import type { P6rIdentityProviderResolution } from "@get-bb/plugin-sdk";

const defaultActor: P6rClaimedIdentity = {
  p6rHandle: "local",
  p6rDisplayName: "Local Operator",
  p6rImageUrl: null,
  p6rClientId: "local",
};

function request(
  transport: P6rIdentityRequestInput["transport"],
  overrides: Partial<P6rIdentityRequestInput> = {},
): P6rIdentityRequestInput {
  return {
    transport,
    method: "GET",
    path: "/api/v1/threads",
    url: "http://remote.example/api/v1/threads?p6rIdentity=spoofed",
    host: "remote.example",
    origin: "http://remote.example",
    headers: {
      [P6R_CLAIMED_IDENTITY_HEADER]: "client-claimed-spoof",
    },
    ...overrides,
  };
}

function boundary(db: DbConnection) {
  return p6rCreateIdentityBoundary({
    db,
    defaultActor,
    now: () => 1234,
  });
}

describe("p6r verified identity boundary", () => {
  it("has one provider, composes its id, and gives HTTP and WS the same result", () => {
    const db = createConnection(":memory:");
    migrate(db);
    try {
      const identity = boundary(db);
      const transports: string[] = [];
      const release = identity.p6rRegisterProvider("p6r-fixture", {
        id: "provider",
        resolve: (input) => {
          transports.push(input.transport);
          return {
            kind: "authenticated",
            p6rSubject: "subject-1",
            p6rHandle: "Sawyer",
            p6rDisplayName: "Sawyer McAuth",
            p6rImageUrl: null,
          };
        },
      });

      expect(() =>
        identity.p6rRegisterProvider("p6r-other", {
          id: "second",
          resolve: () => ({ kind: "not-applicable" }),
        }),
      ).toThrow(/already registered/iu);

      const http = identity.p6rResolveRequest(request("http"));
      const websocket = identity.p6rResolveRequest(request("websocket"));
      expect(http).toEqual(websocket);
      expect(http).toEqual({
        kind: "authenticated",
        p6rActor: {
          p6rAssurance: "trusted-provider",
          p6rProviderId: "p6r-fixture/provider",
          p6rSubject: "subject-1",
          p6rHandle: "sawyer",
          p6rDisplayName: "Sawyer McAuth",
          p6rImageUrl: null,
        },
      });
      expect(transports).toEqual(["http", "websocket"]);
      expect(
        p6rGetActorSnapshot(db, {
          p6rProviderId: "p6r-fixture/provider",
          p6rSubject: "subject-1",
        }),
      ).toMatchObject({ p6rDisplayName: "Sawyer McAuth" });
      release();
    } finally {
      db.$client.close();
    }
  });

  it.each<[string, () => unknown]>([
    ["reject", () => ({ kind: "reject" as const })],
    [
      "throw",
      () => {
        throw new Error("provider failure");
      },
    ],
    [
      "malformed",
      () => ({ kind: "authenticated", p6rSubject: "missing-fields" }),
    ],
    [
      "timeout",
      () => {
        const startedAt = performance.now();
        while (
          performance.now() - startedAt <=
          P6R_IDENTITY_PROVIDER_TIMEOUT_MS + 10
        ) {
          // Deliberately exceed the bounded provider budget.
        }
        return { kind: "not-applicable" as const };
      },
    ],
  ])(
    "fails closed on provider %s and never uses the loopback fallback",
    (_name, resolve) => {
      const db = createConnection(":memory:");
      migrate(db);
      try {
        const identity = boundary(db);
        identity.p6rRegisterProvider("p6r-fixture", {
          id: "owned",
          resolve: () => resolve() as P6rIdentityProviderResolution,
        });
        expect(
          identity.p6rResolveRequest(
            request("http", {
              host: "127.0.0.1",
              url: "http://127.0.0.1/api/v1/threads?p6rIdentity=spoofed",
              remoteAddress: "127.0.0.1",
            }),
          ),
        ).toEqual({ kind: "reject" });
        expect(
          p6rGetActorSnapshot(db, {
            p6rProviderId: "p6r-local-operator",
            p6rSubject: "local",
          }),
        ).toBeNull();
      } finally {
        db.$client.close();
      }
    },
  );

  it.each([
    {
      label: "subject",
      p6rSubject: "s".repeat(513),
      p6rHandle: "over-limit",
    },
    {
      label: "handle",
      p6rSubject: "valid-subject",
      p6rHandle: "h".repeat(129),
    },
  ])(
    "rejects over-limit provider $label before persistence",
    ({ p6rSubject, p6rHandle }) => {
      const db = createConnection(":memory:");
      migrate(db);
      try {
        const identity = boundary(db);
        identity.p6rRegisterProvider("p6r-fixture", {
          id: "over-limit",
          resolve: () => ({
            kind: "authenticated",
            p6rSubject,
            p6rHandle,
            p6rDisplayName: "Over Limit",
            p6rImageUrl: null,
          }),
        });

        expect(identity.p6rResolveRequest(request("http"))).toEqual({
          kind: "reject",
        });
        expect(
          p6rGetActorSnapshot(db, {
            p6rProviderId: "p6r-fixture/over-limit",
            p6rSubject,
          }),
        ).toBeNull();
      } finally {
        db.$client.close();
      }
    },
  );

  it("uses loopback only when there is no provider or the provider is not applicable", () => {
    const db = createConnection(":memory:");
    migrate(db);
    try {
      const identity = boundary(db);
      expect(
        identity.p6rResolveRequest(
          request("http", {
            host: "127.0.0.1",
            url: "http://127.0.0.1/api/v1/threads",
            remoteAddress: "127.0.0.1",
          }),
        ),
      ).toMatchObject({
        kind: "authenticated",
        p6rActor: { p6rProviderId: "p6r-local-operator" },
      });
      expect(identity.p6rResolveRequest(request("http"))).toEqual({
        kind: "not-applicable",
        p6rRequestPrincipal: null,
      });

      identity.p6rRegisterProvider("p6r-fixture", {
        id: "optional",
        resolve: () => ({ kind: "not-applicable" }),
      });
      expect(identity.p6rResolveRequest(request("http"))).toEqual({
        kind: "not-applicable",
        p6rRequestPrincipal: null,
      });
      expect(
        identity.p6rResolveRequest(
          request("websocket", {
            host: "127.0.0.1",
            url: "http://127.0.0.1/ws",
            remoteAddress: "127.0.0.1",
          }),
        ),
      ).toMatchObject({
        kind: "authenticated",
        p6rActor: { p6rProviderId: "p6r-local-operator" },
      });
    } finally {
      db.$client.close();
    }
  });

  it.each<
    [
      P6rIdentityRequestInput["transport"],
      string,
      string,
      string | undefined,
      "authenticated" | "not-applicable",
    ]
  >([
    [
      "http",
      "http://127.0.0.1/api/v1/threads",
      "127.0.0.1",
      "203.0.113.42",
      "not-applicable",
    ],
    [
      "websocket",
      "http://127.0.0.1/ws",
      "127.0.0.1",
      "203.0.113.42",
      "not-applicable",
    ],
    [
      "http",
      "http://remote.example/api/v1/threads",
      "remote.example",
      "127.0.0.1",
      "authenticated",
    ],
    [
      "websocket",
      "http://remote.example/ws",
      "remote.example",
      "127.0.0.1",
      "authenticated",
    ],
    [
      "http",
      "http://127.0.0.1/api/v1/threads",
      "127.0.0.1",
      undefined,
      "authenticated",
    ],
    [
      "websocket",
      "http://127.0.0.1/ws",
      "127.0.0.1",
      undefined,
      "authenticated",
    ],
  ])(
    "uses trusted remote precedence for %s loopback decisions",
    (transport, url, host, remoteAddress, expectedKind) => {
      const db = createConnection(":memory:");
      migrate(db);
      try {
        const identity = boundary(db);
        expect(
          identity.p6rResolveRequest(
            request(transport, { url, host, remoteAddress }),
          ).kind,
        ).toBe(expectedKind);
      } finally {
        db.$client.close();
      }
    },
  );

  it("preserves a nonblank opaque subject exactly and rejects whitespace-only subjects", () => {
    const db = createConnection(":memory:");
    migrate(db);
    try {
      const identity = boundary(db);
      let p6rSubject = "  provider-defined-subject  ";
      identity.p6rRegisterProvider("p6r-fixture", {
        id: "opaque",
        resolve: () => ({
          kind: "authenticated",
          p6rSubject,
          p6rHandle: "Opaque",
          p6rDisplayName: "Opaque Subject",
          p6rImageUrl: null,
        }),
      });
      expect(identity.p6rResolveRequest(request("http"))).toMatchObject({
        kind: "authenticated",
        p6rActor: { p6rSubject: "  provider-defined-subject  " },
      });
      p6rSubject = "provider-defined-subject";
      expect(identity.p6rResolveRequest(request("http"))).toMatchObject({
        kind: "authenticated",
        p6rActor: { p6rSubject: "provider-defined-subject" },
      });
      expect(
        p6rGetActorSnapshot(db, {
          p6rProviderId: "p6r-fixture/opaque",
          p6rSubject: "  provider-defined-subject  ",
        }),
      ).not.toBeNull();
      expect(
        p6rGetActorSnapshot(db, {
          p6rProviderId: "p6r-fixture/opaque",
          p6rSubject: "provider-defined-subject",
        }),
      ).not.toBeNull();
    } finally {
      db.$client.close();
    }

    const whitespaceDb = createConnection(":memory:");
    migrate(whitespaceDb);
    try {
      const identity = boundary(whitespaceDb);
      identity.p6rRegisterProvider("p6r-fixture", {
        id: "blank",
        resolve: () => ({
          kind: "authenticated",
          p6rSubject: " \t\n",
          p6rHandle: "blank",
          p6rDisplayName: "Blank",
          p6rImageUrl: null,
        }),
      });
      expect(identity.p6rResolveRequest(request("http"))).toEqual({
        kind: "reject",
      });
      expect(
        p6rGetActorSnapshot(whitespaceDb, {
          p6rProviderId: "p6r-fixture/blank",
          p6rSubject: " \t\n",
        }),
      ).toBeNull();
    } finally {
      whitespaceDb.$client.close();
    }
  });

  it.each(["http", "websocket"] as const)(
    "contains a throwing provider result getter for %s and fails closed",
    (transport) => {
      const db = createConnection(":memory:");
      migrate(db);
      try {
        const identity = boundary(db);
        identity.p6rRegisterProvider("p6r-fixture", {
          id: "proxy",
          resolve: () =>
            new Proxy(
              {},
              {
                get() {
                  throw new Error("provider result getter exploded");
                },
              },
            ) as P6rIdentityProviderResolution,
        });
        expect(identity.p6rResolveRequest(request(transport))).toEqual({
          kind: "reject",
        });
        expect(
          p6rGetActorSnapshot(db, {
            p6rProviderId: "p6r-fixture/proxy",
            p6rSubject: "anything",
          }),
        ).toBeNull();
      } finally {
        db.$client.close();
      }
    },
  );
});
