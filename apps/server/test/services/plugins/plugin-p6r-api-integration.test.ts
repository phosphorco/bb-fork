import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Hono } from "hono";
import {
  createConnection,
  createProject,
  createThread,
  migrate,
  noopNotifier,
  upsertHost,
  type DbConnection,
} from "@bb/db";
import type { Thread } from "@bb/domain";
import { createAiServiceRegistry } from "../../../src/services/ai/ai-service-registry.js";
import {
  createP6rIdentityService,
  type P6rNativeAcceptance,
  type P6rRawProtocol,
} from "../../../src/services/p6r/identity-protocol.js";
import { createP6rInvocationRegistry } from "../../../src/services/p6r/invocation-registry.js";
import { createP6rProviderRegistry } from "../../../src/services/p6r/provider-registry.js";
import { createP6rProviderAdmission } from "../../../src/services/p6r/provider-admission.js";
import { createP6rNativeAcceptance } from "../../../src/services/p6r/native-acceptance.js";
import { migrateP6rSidecars } from "../../../src/services/p6r/sidecar-migrate.js";
import { lookupP6rOperationReceipt } from "../../../src/services/p6r/sidecar-store.js";
import { createP6rPluginDispatch } from "../../../src/services/plugins/plugin-p6r-dispatch.js";
import {
  createPluginService,
  type PluginService,
} from "../../../src/services/plugins/plugin-service.js";
import { createNoopTelemetryService } from "../../../src/services/system/telemetry.js";
import { testLogger } from "../../helpers/test-app.js";

type HostAdapterFactory = (options: unknown) => unknown;

function isHostAdapterFactory(value: unknown): value is HostAdapterFactory {
  return typeof value === "function";
}

const providerConfiguration = {
  boundaryId: "fixture-boundary",
  credentials: [
    {
      field: "x-fixture-assertion",
      name: "x-bb-assertion",
      source: "header" as const,
    },
  ],
  ingressIds: ["fixture-ingress"],
  pluginId: "provider",
  resolver: { maxSessionAgeMs: 60_000, timeoutMs: 5_000 },
  version: 1 as const,
};

const originSource = `
  const schema = { "~standard": { version: 1, vendor: "p6r-origin", validate: (value) => ({ value }) } };
  export default async function plugin(bb) {
    const threadId = (globalThis as typeof globalThis & { __p6rThreadId: string }).__p6rThreadId;
    const identity = bb.experimental_p6rIdentity;
    if (!identity) throw new Error("P6r identity is unavailable");
    const host = globalThis.__p6rHostAdapter(identity);
    const bound = identity.bindInvocation({
      routeClass: "interactive-session",
      handler: async (context, input) => {
        const request = await host.openPersonRequest(context.request);
        if (!request.ok) throw new Error(request.error.message);
        const scopedInput = { input: [{ mentions: [], text: "scoped " + input.value, type: "text" }], mode: "start", operationId: "scoped-operation", threadId };
        const scoped = await host.send(request.value, scopedInput);
        const replay = await host.send(request.value, scopedInput);
        const lookup = await host.lookupOperation("scoped-operation");
        const external = await host.sendExternal({ presentation: { avatarUrl: null, displayName: "External", handle: "external" }, subject: "external-subject" }, { input: [{ mentions: [], text: "external " + input.value, type: "text" }], mode: "queue-if-active", operationId: "external-operation", threadId });
        let forwarded;
        try {
          forwarded = await host.forward(request.value, "destination", "receive", { pause: input.pause === true, value: input.value });
        } catch (error) {
          forwarded = { error: error instanceof Error ? error.message : String(error) };
        }
        const afterForward = "error" in forwarded
          ? await host.send(request.value, { input: [{ mentions: [], text: "source after " + input.value, type: "text" }], mode: "start", operationId: "source-after-forward", threadId })
          : null;
        const sourceValidation = "error" in forwarded
          ? request.value.validate({ actor: request.value.session.actor.identity.key, session: request.value.session.stamp })
          : null;
        return { afterForward, external, forwarded, lookup, replay, scoped, sourceValid: sourceValidation?.ok ?? null };
      },
    });
    bb.rpc.register({ run: { input: schema, output: schema } }, { run: bound.handler });
  }
`;

const providerSource = `
  export default async function plugin(bb) {
    const identity = bb.experimental_p6rIdentity;
    if (!identity) throw new Error("P6r identity is unavailable");
    const registration = await identity.registerProvider(globalThis.__p6rSignedProvider);
    if (!registration.ok) throw new Error(registration.error.message);
  }
`;

const destinationSource = `
  const schema = { "~standard": { version: 1, vendor: "p6r-destination", validate: (value) => ({ value }) } };
  export default function plugin(bb) {
    const threadId = (globalThis as typeof globalThis & { __p6rThreadId: string }).__p6rThreadId;
    const identity = bb.experimental_p6rIdentity;
    if (!identity) throw new Error("P6r identity is unavailable");
    const host = globalThis.__p6rHostAdapter(identity);
    const bound = identity.bindInvocation({
      routeClass: "interactive-session",
      handler: async (context, input) => {
        const request = await host.openPersonRequest(context.request);
        if (!request.ok) throw new Error(request.error.message);
        if (input.pause === true) await globalThis.__p6rPauseDestination();
        return host.send(request.value, { input: [{ mentions: [], text: "destination " + input.value, type: "text" }], mode: "start", operationId: "destination-operation", threadId });
      },
    });
    bb.rpc.register({ receive: { input: schema, output: schema } }, { receive: bound.handler });
  }
`;

async function writePlugin(
  workDir: string,
  id: string,
  source: string,
): Promise<string> {
  const root = join(workDir, `bb-plugin-${id}`);
  await mkdir(root, { recursive: true });
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({
      bb: {
        branding: { icon: "Zap" },
        description: "P6r fixture",
        name: "P6r fixture",
        server: "./server.ts",
      },
      name: `bb-plugin-${id}`,
      version: "0.1.0",
    }),
  );
  await writeFile(join(root, "server.ts"), source);
  return root;
}

describe("P6r PluginService API integration", () => {
  let db: DbConnection;
  let service: PluginService;
  let workDir: string;
  let onP6rPluginPublishedForTest:
    | ((input: {
        readonly generation: string;
        readonly pluginId: string;
      }) => void)
    | undefined;
  let admission: ReturnType<typeof createP6rProviderAdmission>;
  let clock: number;
  let persistedThread: Thread;
  const accepted: P6rNativeAcceptance[] = [];

  beforeEach(async () => {
    db = createConnection(":memory:");
    migrate(db);
    migrateP6rSidecars(db);
    const host = upsertHost(db, noopNotifier, {
      id: "fixture-host",
      name: "Fixture Host",
      type: "persistent",
    });
    const { project } = createProject(db, noopNotifier, {
      name: "Fixture Project",
      source: {
        hostId: host.id,
        path: "/tmp/p6r-plugin-service-fixture",
        type: "local_path",
      },
    });
    persistedThread = createThread(db, noopNotifier, {
      projectId: project.id,
      providerId: "fixture-provider",
      status: "idle",
      title: "Fixture Thread",
      titleFallback: "Fixture Thread",
    });
    Reflect.set(globalThis, "__p6rThreadId", persistedThread.id);
    workDir = await mkdtemp(join(tmpdir(), "bb-p6r-api-"));
    accepted.length = 0;
    clock = Date.now();
    const packageArtifact = await import(
      new URL(
        "../../../../../../../../plugins/packages/bb-identity/dist/host-runtime.js",
        import.meta.url,
      ).href
    );
    const createHostAdapter = Reflect.get(packageArtifact, "createHostAdapter");
    if (!isHostAdapterFactory(createHostAdapter))
      throw new Error("Package host adapter export is unavailable");
    const publicBinding = await import(
      new URL(
        "../../../../../../../../plugins/packages/bb-identity/dist/bb-entry-runtime.js",
        import.meta.url,
      ).href
    );
    Reflect.set(globalThis, "__p6rPublicBinding", publicBinding.bindBbIdentity);
    Reflect.set(globalThis, "__p6rHostAdapter", (protocol: P6rRawProtocol) =>
      createHostAdapter({
        extension: { protocol, status: "supported" },
        upstream: {
          inputCodec: {
            decode: (value: unknown) => ({ ok: true, value }),
            encode: (value: unknown) => value,
          },
          instanceId: "instance-fixture",
          labelExternal: (_author: unknown, input: readonly unknown[]) => input,
          openScope: async () => ({
            ok: false,
            error: { code: "unsupported", message: "unused", retry: "never" },
          }),
          pluginId: "feature",
          scheduler: { now: Date.now, schedule: () => () => undefined },
          selfProfile: async () => ({
            ok: false,
            error: { code: "unsupported", message: "unused", retry: "never" },
          }),
          session: async () => ({
            error: { code: "unsupported", message: "unused", retry: "never" },
            instanceId: "instance-fixture",
            status: "unavailable",
          }),
          submit: async () => ({
            status: "rejected",
            error: { code: "unsupported", message: "unused", retry: "never" },
          }),
          subscribe: () => () => undefined,
          toolCorrelation: () => ({
            correlation: null,
            reason: "unused",
            status: "unknown",
          }),
          forward: async () => undefined,
        },
      }),
    );
    const signedFixtures = await import(
      new URL(
        "../../../../../../../../plugins/packages/bb-identity/examples/signed-assertion-provider.mjs",
        import.meta.url,
      ).href
    );
    const fixtureKey = signedFixtures.createFixtureKeyPair();
    const assertion = signedFixtures.signFixtureAssertion({
      audience: "fixture-audience",
      expiresAt: clock + 60_000,
      issuer: "fixture-issuer",
      key: fixtureKey,
      now: clock,
      presentation: {
        avatarUrl: "/avatars/fixture.jpg",
        displayName: "Fixture Person",
        handle: "fixture",
      },
      subject: "fixture-subject",
    });
    Reflect.set(
      globalThis,
      "__p6rSignedProvider",
      signedFixtures.createSignedAssertionProvider({
        audience: "fixture-audience",
        issuer: "fixture-issuer",
        keys: new Map([[fixtureKey.kid, fixtureKey.publicKey]]),
        maxSessionAgeMs: 60_000,
        now: () => clock,
      }),
    );
    const dispatch = createP6rPluginDispatch();
    const providers = createP6rProviderRegistry({ now: () => clock });
    admission = createP6rProviderAdmission({
      ingressFacts: () => ({
        authenticatedPeer: "fixture-peer",
        id: "fixture-ingress",
        kind: "owned-proxy",
        lineage: "fixture-lineage",
      }),
      instanceId: "instance-fixture",
      now: () => clock,
      providerRegistry: providers,
      requestFacts: () => ({
        authority: "fixture.test",
        cookie: () => null,
        header: (name) => (name === "x-fixture-assertion" ? assertion : null),
        method: "POST",
        pathname: "/api/plugins/feature/rpc",
        receivedAt: clock,
        transport: "http",
      }),
      selectedConfiguration: () => providerConfiguration,
    });
    let nativeRequestSequence = 0;
    let failAfterFirstCommit = true;
    const nativeAccept = createP6rNativeAcceptance({
      db,
      dispatch: async (input) => {
        db.transaction((tx) => {
          input.beforeAppendInTransaction({ tx });
          input.afterAppendInTransaction({
            inputGroups: [input.payload.input],
            request: {
              requestId: `fixture-native-${++nativeRequestSequence}`,
              sequence: nativeRequestSequence,
            },
            tx,
          });
        });
        if (failAfterFirstCommit) {
          failAfterFirstCommit = false;
          throw new Error("fixture postcommit response failure");
        }
      },
      findThread: (threadId) =>
        threadId === persistedThread.id ? persistedThread : null,
      now: () => clock,
      retentionMs: 60_000,
    });
    const identity = createP6rIdentityService({
      activateBindings: (generation) => dispatch.activateBindings(generation),
      bindInvocation: (input) => dispatch.bindInvocation(input),
      db,
      instanceId: "instance-fixture",
      invocationRegistry: createP6rInvocationRegistry({ now: () => clock }),
      native: {
        accept: async (input) => {
          accepted.push(input);
          return nativeAccept(input);
        },
        forwardRpc: (input) => service.forwardP6rRpc(input),
      },
      now: () => clock,
      providerConfiguration: admission.providerConfiguration,
      providerRegistry: providers,
      retireBindings: (generation) => dispatch.retireBindings(generation),
      trustedInvocation: admission.trustedInvocation,
    });
    service = createPluginService({
      aiServices: createAiServiceRegistry(),
      appVersion: "0.9.0",
      dataDir: join(workDir, "data"),
      db,
      hub: {
        getDaemonSessionIdForHost: () => null,
        notifyPluginSignal: () => 0,
        notifySystem: () => undefined,
      },
      loadTimeoutMs: 2_000,
      logger: testLogger,
      onP6rPluginPublishedForTest: (input) =>
        onP6rPluginPublishedForTest?.(input),
      p6rDispatch: dispatch,
      p6rIdentity: identity,
      p6rProviderRegistry: providers,
      telemetry: createNoopTelemetryService(),
    });
  });

  afterEach(async () => {
    Reflect.deleteProperty(globalThis, "__p6rHostAdapter");
    Reflect.deleteProperty(globalThis, "__p6rPauseDestination");
    Reflect.deleteProperty(globalThis, "__p6rSignedProvider");
    Reflect.deleteProperty(globalThis, "__p6rHttpScope");
    Reflect.deleteProperty(globalThis, "__p6rPublicBinding");
    Reflect.deleteProperty(globalThis, "__p6rThreadId");
    Reflect.deleteProperty(globalThis, "__p6rHttpInvocation");
    Reflect.deleteProperty(globalThis, "__p6rHoldHttp");
    onP6rPluginPublishedForTest = undefined;
    admission.dispose();
    if (service !== undefined) await service.stop();
    await rm(workDir, { force: true, recursive: true });
  });

  it("admits a signed provider P session for feature F and decodes durable scoped and external receipts", async () => {
    const provider = await writePlugin(workDir, "provider", providerSource);
    const destination = await writePlugin(
      workDir,
      "destination",
      destinationSource,
    );
    const root = await writePlugin(workDir, "feature", originSource);
    await service.installPath(provider);
    await service.installPath(destination);
    const installed = await service.installPath(root);
    expect(installed.status).toBe("running");
    const handler = service.getRpcHandler("feature", "run");
    expect(handler.outcome).toBe("found");
    if (handler.outcome !== "found")
      throw new Error("P6r RPC handler was not published");

    const result = await service.invokeRpcHandler(
      "feature",
      "run",
      handler.value,
      { value: "fixture" },
      {
        ingress: { requestId: "request-1", transport: "http" },
        request: { id: "request-1" },
      },
    );

    expect(result).toMatchObject({
      ok: true,
      result: {
        external: expect.objectContaining({ status: "submitted" }),
        forwarded: expect.objectContaining({ status: "submitted" }),
        lookup: {
          ok: true,
          value: expect.objectContaining({ status: "final" }),
        },
        replay: expect.objectContaining({ status: "submitted" }),
        scoped: expect.objectContaining({ status: "submitted" }),
        afterForward: null,
        sourceValid: null,
      },
    });
    expect(accepted).toHaveLength(3);
    expect(accepted.map((entry) => entry.source)).toEqual([
      "scope",
      "external",
      "scope",
    ]);
    expect(accepted[0]?.authorEvidence).toMatchObject({
      evidence: "provider-verified",
      identity: {
        issuer: "fixture-issuer",
        kind: "person",
        subject: "fixture-subject",
      },
    });
    expect(accepted[1]?.authorEvidence).toMatchObject({
      identity: {
        kind: "external",
        pluginId: "feature",
        subject: "external-subject",
      },
    });
    const durable = lookupP6rOperationReceipt(
      db,
      accepted[0]!.operationNamespace,
      "scoped-operation",
    );
    expect(durable).toMatchObject({
      acceptedRequestSequence: 1,
      operationId: "scoped-operation",
      payloadHash: accepted[0]?.payloadHash,
    });
  });

  it("rejects a paused destination commit after publication replaces its binding", async () => {
    const provider = await writePlugin(workDir, "provider", providerSource);
    const destination = await writePlugin(
      workDir,
      "destination",
      destinationSource,
    );
    const origin = await writePlugin(workDir, "feature", originSource);
    await service.installPath(provider);
    await service.installPath(destination);
    await service.installPath(origin);
    const handler = service.getRpcHandler("feature", "run");
    if (handler.outcome !== "found")
      throw new Error("P6r RPC handler was not published");

    let entered: (() => void) | undefined;
    const enteredDestination = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let resume: (() => void) | undefined;
    const resumeDestination = new Promise<void>((resolve) => {
      resume = resolve;
    });
    Reflect.set(globalThis, "__p6rPauseDestination", async () => {
      entered?.();
      await resumeDestination;
    });
    const pending = service.invokeRpcHandler(
      "feature",
      "run",
      handler.value,
      { pause: true, value: "replacement" },
      {
        ingress: { requestId: "request-replacement", transport: "http" },
        request: { id: "request-replacement" },
      },
    );
    await enteredDestination;
    const published = new Promise<void>((resolve) => {
      onP6rPluginPublishedForTest = (input) => {
        if (input.pluginId === "destination") resolve();
      };
    });
    await writeFile(join(destination, "server.ts"), `${destinationSource}\n`);
    const replacement = service.reload("destination");
    await published;
    resume?.();
    await replacement;

    await expect(pending).resolves.toMatchObject({
      ok: true,
      result: {
        afterForward: expect.objectContaining({ status: "submitted" }),
        external: expect.objectContaining({ status: "submitted" }),
        forwarded: expect.objectContaining({
          error: expect.objectContaining({ code: "stale-context" }),
          status: "rejected",
        }),
        scoped: expect.objectContaining({ status: "submitted" }),
        sourceValid: true,
      },
    });
    expect(accepted.map((entry) => entry.input.operationId)).toEqual([
      "scoped-operation",
      "external-operation",
      "source-after-forward",
    ]);
  });

  it("runs actual Notifications and ntfy request-bound registration and credential claims", async () => {
    await service.installPath(
      await writePlugin(workDir, "provider", providerSource),
    );
    for (const id of ["notifications", "ntfy"]) {
      const source = new URL(
        `../../../../../../../../plugins/plugins/${id}/server.ts`,
        import.meta.url,
      ).href;
      const installed = await service.installPath(
        await writePlugin(
          workDir,
          id,
          `export { default } from ${JSON.stringify(source)};`,
        ),
      );
      expect(installed.status, JSON.stringify(installed)).toBe("running");
    }
    expect(
      service
        .listAgentTools()
        .find((entry) => entry.tool.name === "notify_user")?.tool.presentation
        ?.label,
    ).toEqual({
      pending: "Resolving notification recipient",
      completed: "Sent user notification",
    });
    const call = async (id: string, method: string, input: unknown) => {
      const handler = service.getRpcHandler(id, method);
      if (handler.outcome !== "found")
        throw new Error(`Missing ${id}.${method}`);
      return service.invokeRpcHandler(id, method, handler.value, input, {
        ingress: { requestId: `fixture-${method}`, transport: "http" },
        request: { method },
      });
    };
    expect(await call("ntfy", "listEndpoints", {})).toMatchObject({
      ok: true,
      result: { endpoints: [] },
    });
    const currentIdentity = await call(
      "notifications",
      "getCurrentIdentity",
      null,
    );
    expect(currentIdentity, JSON.stringify(currentIdentity)).toMatchObject({
      ok: true,
      result: {
        profile: {
          displayName: "Fixture Person",
          profilePicture: "/avatars/fixture.jpg",
        },
      },
    });
    const begin = await call("notifications", "beginNtfyRouteRegistration", {
      minimumLoudness: "loud",
    });
    if (
      !begin.ok ||
      typeof begin.result !== "object" ||
      begin.result === null ||
      Array.isArray(begin.result)
    )
      throw new Error(JSON.stringify(begin));
    const complete = await call(
      "notifications",
      "completeNtfyRouteRegistration",
      {
        registrationCapability: begin.result.registrationCapability,
        minimumLoudness: "loud",
        address: {
          serverUrl: "http://127.0.0.1:1",
          topic: "fixture-route-0001",
        },
      },
    );
    if (
      !complete.ok ||
      typeof complete.result !== "object" ||
      complete.result === null ||
      Array.isArray(complete.result)
    )
      throw new Error(JSON.stringify(complete));
    const route = complete.result.route;
    if (typeof route !== "object" || route === null || Array.isArray(route))
      throw new Error("Missing route");
    const claims = await call("notifications", "claimRouteDeliveries", {
      routeId: route.id,
      routeCredential: complete.result.routeCredential,
    });
    expect(claims).toMatchObject({ ok: true, result: { claims: [] } });
    const rejected = await call("notifications", "claimRouteDeliveries", {
      routeId: route.id,
      routeCredential: "x".repeat(43),
    });
    expect(rejected).toMatchObject({ ok: false });
    expect(accepted).toHaveLength(0);
  });

  it("dispatches a bound HTTP handler with provider authority through response consumption", async () => {
    await service.installPath(
      await writePlugin(workDir, "provider", providerSource),
    );
    await service.installPath(
      await writePlugin(
        workDir,
        "feature",
        `
      export default function plugin(bb) {
        const protocol = bb.experimental_p6rIdentity;
        const bound = protocol.bindInvocation({ routeClass: "interactive-session", handler: async (invocation, context) => {
          globalThis.__p6rHttpScope = invocation.scope;
          const session = await protocol.session(invocation.request);
          return context.json({ status: session.status, subject: session.actor?.identity.subject });
        }});
        bb.http.route("POST", "/identity", bound.handler);
      }
    `,
      ),
    );
    const route = service.getHttpRoute("feature", "POST", "/identity");
    if (route.outcome !== "found") throw new Error("HTTP route missing");
    const app = new Hono();
    app.post("/identity", (context) =>
      service.invokeHttpRoute("feature", route.value, context),
    );
    const response = await app.request("http://fixture.test/identity", {
      method: "POST",
    });
    expect(response.status).toBe(200);
    const scope = Reflect.get(globalThis, "__p6rHttpScope");
    expect(scope.validate().ok).toBe(true);
    expect(await response.json()).toMatchObject({
      status: "ready",
      subject: "fixture-subject",
    });
    expect(scope.validate().ok).toBe(false);
  });

  it("expires the public invocation when the request aborts during a held handler", async () => {
    await service.installPath(
      await writePlugin(workDir, "provider", providerSource),
    );
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    Reflect.set(globalThis, "__p6rHoldHttp", async () => {
      entered();
      await held;
    });
    await service.installPath(
      await writePlugin(
        workDir,
        "feature",
        `
      export default function plugin(bb) {
        const result = globalThis.__p6rPublicBinding(bb);
        if (!result.ok) throw new Error(result.error.message);
        const identity = result.value;
        const registered = identity.http.route("POST", "/identity", { origin: "interactive-user", handle: async (context, invocation) => {
          globalThis.__p6rHttpInvocation = { invocation, identity };
          await globalThis.__p6rHoldHttp();
          return context.json(await identity.server.selfProfile(invocation));
        }});
        if (!registered.ok) throw new Error(registered.error.message);
      }
    `,
      ),
    );
    const route = service.getHttpRoute("feature", "POST", "/identity");
    if (route.outcome !== "found") throw new Error("HTTP route missing");
    const app = new Hono();
    app.post("/identity", (context) =>
      service.invokeHttpRoute("feature", route.value, context),
    );
    const controller = new AbortController();
    const pending = app.request("http://fixture.test/identity", {
      method: "POST",
      signal: controller.signal,
    });
    await started;
    const saved = Reflect.get(globalThis, "__p6rHttpInvocation");
    expect((await saved.identity.server.selfProfile(saved.invocation)).ok).toBe(
      true,
    );
    controller.abort();
    expect(
      await saved.identity.server.selfProfile(saved.invocation),
    ).toMatchObject({ ok: false, error: { code: "expired" } });
    release();
    const response = await pending;
    await expect(response.text()).rejects.toThrow("expired");
  });

  it("retains the public package HTTP invocation until the host consumes or cancels the body", async () => {
    await service.installPath(
      await writePlugin(workDir, "provider", providerSource),
    );
    await service.installPath(
      await writePlugin(
        workDir,
        "feature",
        `
      export default function plugin(bb) {
        const result = globalThis.__p6rPublicBinding(bb);
        if (!result.ok) throw new Error(result.error.message);
        const identity = result.value;
        const registered = identity.http.route("POST", "/identity", { origin: "interactive-user", handle: async (context, invocation) => {
          globalThis.__p6rHttpInvocation = { invocation, identity };
          const profile = await identity.server.selfProfile(invocation);
          return context.json(profile);
        }});
        if (!registered.ok) throw new Error(registered.error.message);
      }
    `,
      ),
    );
    const route = service.getHttpRoute("feature", "POST", "/identity");
    if (route.outcome !== "found") throw new Error("HTTP route missing");
    const app = new Hono();
    app.post("/identity", (context) =>
      service.invokeHttpRoute("feature", route.value, context),
    );
    const response = await app.request("http://fixture.test/identity", {
      method: "POST",
    });
    const saved = Reflect.get(globalThis, "__p6rHttpInvocation");
    expect((await saved.identity.server.selfProfile(saved.invocation)).ok).toBe(
      true,
    );
    expect(await response.json()).toMatchObject({
      ok: true,
      value: { identity: { subject: "fixture-subject" } },
    });
    expect(
      await saved.identity.server.selfProfile(saved.invocation),
    ).toMatchObject({ ok: false, error: { code: "expired" } });
    const cancelled = await app.request("http://fixture.test/identity", {
      method: "POST",
    });
    const second = Reflect.get(globalThis, "__p6rHttpInvocation");
    await cancelled.body!.cancel();
    expect(
      await second.identity.server.selfProfile(second.invocation),
    ).toMatchObject({ ok: false, error: { code: "expired" } });
  });
});
