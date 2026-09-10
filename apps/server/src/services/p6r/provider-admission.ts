import { randomUUID } from "node:crypto";
import type { ExperimentalP6rInvocationRouteClass } from "@get-bb/plugin-sdk";
import type {
  P6rIdentityGeneration,
  P6rReadySession,
  P6rServerSession,
} from "./identity-protocol.js";
import type {
  P6rInvocationIngress,
  P6rValidity,
} from "./invocation-registry.js";
import type {
  P6rIdentityError,
  P6rPersonReference,
  P6rProfilePresentation,
  P6rProviderConfiguration,
  P6rProviderInvalidation,
  P6rProviderRegistry,
} from "./provider-contract.js";

type Timer = ReturnType<typeof setTimeout>;
type TrustedInvocation = {
  readonly deadlineAt: number;
  readonly session: P6rServerSession;
  readonly sessionEpoch: string;
  readonly signal?: AbortSignal;
} | null;
type AdmissionInput = {
  readonly generation: P6rIdentityGeneration;
  readonly ingress: P6rInvocationIngress;
  readonly request: object;
  readonly routeClass: ExperimentalP6rInvocationRouteClass;
};
type AdmissionResolutionInput = {
  readonly lifetime: AbortSignal;
  readonly lineageScope: string;
  readonly request: object;
  readonly transport: P6rInvocationIngress["transport"];
};
type SessionRecord = {
  readonly controller: AbortController;
  readonly key: string;
  readonly lifetime: AbortSignal;
  readonly lineageKey: string;
  readonly onLifetimeAbort: () => void;
  readonly providerGeneration: string;
  readonly session: P6rReadySession;
  readonly subject: P6rPersonReference;
  deadlineAt: number;
  timer: Timer | undefined;
};

export interface P6rAdmissionRequestFacts {
  readonly authority: string;
  cookie(name: string): string | null;
  header(name: string): string | null;
  readonly method: string;
  readonly pathname: string;
  readonly receivedAt: number;
  readonly transport: "http" | "websocket";
}
export interface P6rAdmissionIngressFacts {
  readonly authenticatedPeer: string | null;
  readonly id: string | null;
  readonly kind: "owned-proxy" | "local" | "unverified";
  readonly lineage: string | null;
}
export type P6rNativeAdmission =
  | { readonly status: "baseline"; validate(): P6rValidity }
  | {
      release(): void;
      readonly session: P6rReadySession;
      readonly signal: AbortSignal;
      readonly status: "ready";
      readonly validUntil: number;
      validate(): P6rValidity;
    }
  | { readonly error: P6rIdentityError; readonly status: "blocked" };
export type P6rNativeHttpAdmission = P6rNativeAdmission;
export type P6rNativeWebSocketAdmission = P6rNativeAdmission;
export interface P6rProviderAdmissionOptions {
  readonly clearTimeout?: (timer: Timer) => void;
  readonly configured?: () => boolean;
  readonly ingressFacts: (input: {
    readonly request: object;
    readonly transport: P6rInvocationIngress["transport"];
  }) => P6rAdmissionIngressFacts | null;
  readonly instanceId: string;
  readonly maxSessions?: number;
  readonly now: () => number;
  readonly providerRegistry: P6rProviderRegistry;
  readonly requestFacts: (request: object) => P6rAdmissionRequestFacts | null;
  readonly selectedConfiguration: () => P6rProviderConfiguration | null;
  readonly setTimeout?: (callback: () => void, delay: number) => Timer;
}
export interface P6rProviderAdmission {
  admitNativeHttp(request: object): Promise<P6rNativeHttpAdmission>;
  admitNativeWebSocket(request: object): Promise<P6rNativeWebSocketAdmission>;
  dispose(): void;
  providerConfiguration(pluginId: string): P6rProviderConfiguration | null;
  trustedInvocation(input: AdmissionInput): Promise<TrustedInvocation>;
}

function error(
  code: P6rIdentityError["code"],
  message: string,
): P6rIdentityError {
  return {
    code,
    message,
    retry:
      code === "unavailable"
        ? "after-reconnect"
        : code === "expired"
          ? "same-operation"
          : "never",
  };
}
function snapshotConfiguration(
  value: P6rProviderConfiguration,
): P6rProviderConfiguration {
  return Object.freeze({
    boundaryId: value.boundaryId,
    credentials: Object.freeze(
      value.credentials.map((credential) =>
        Object.freeze({
          field: credential.field,
          name: credential.name,
          source: credential.source,
        }),
      ),
    ),
    ingressIds: Object.freeze([...value.ingressIds]),
    pluginId: value.pluginId,
    resolver: Object.freeze({
      maxSessionAgeMs: value.resolver.maxSessionAgeMs,
      timeoutMs: value.resolver.timeoutMs,
    }),
    version: 1,
  });
}
function validConfiguration(value: P6rProviderConfiguration): boolean {
  return (
    value.version === 1 &&
    value.boundaryId.length > 0 &&
    value.pluginId.length > 0 &&
    Number.isFinite(value.resolver.maxSessionAgeMs) &&
    value.resolver.maxSessionAgeMs > 0 &&
    Number.isFinite(value.resolver.timeoutMs) &&
    value.resolver.timeoutMs > 0 &&
    value.credentials.every(
      (credential) => credential.field.length > 0 && credential.name.length > 0,
    ) &&
    new Set(value.credentials.map((credential) => credential.name)).size ===
      value.credentials.length &&
    value.ingressIds.every((id) => id.length > 0) &&
    new Set(value.ingressIds).size === value.ingressIds.length
  );
}
function unavailable(instanceId: string, message: string): P6rServerSession {
  return {
    error: error("unavailable", message),
    instanceId,
    status: "unavailable",
  };
}
function unauthenticated(
  instanceId: string,
  message: string,
): P6rServerSession {
  return {
    error: error("unauthenticated", message),
    instanceId,
    status: "unauthenticated",
  };
}
function sessionKey(parts: readonly string[]): string {
  return parts.map((part) => `${part.length}:${part}`).join("");
}

export function createP6rProviderAdmission(
  options: P6rProviderAdmissionOptions,
): P6rProviderAdmission {
  const timer = options.setTimeout ?? setTimeout;
  const cancelTimer = options.clearTimeout ?? clearTimeout;
  const maxSessions = options.maxSessions ?? 256;
  const sessions = new Map<string, SessionRecord>();
  const lineages = new Map<string, SessionRecord>();
  const admissionEpochs = new Map<string, number>();
  const nativeLifetime = new AbortController();
  let configuration: P6rProviderConfiguration | null = null;
  let admissionSerial = 0;
  let serial = 0;
  let disposed = false;
  const boot = randomUUID();
  const isConfigured = (): boolean =>
    options.configured?.() ?? options.selectedConfiguration() !== null;
  const selectedConfiguration = (): P6rProviderConfiguration | null => {
    if (configuration !== null) return configuration;
    const candidate = options.selectedConfiguration();
    if (candidate === null || !validConfiguration(candidate)) return null;
    configuration = snapshotConfiguration(candidate);
    return configuration;
  };
  const release = (record: SessionRecord): void => {
    if (sessions.get(record.key) !== record) return;
    sessions.delete(record.key);
    if (lineages.get(record.lineageKey) === record) {
      lineages.delete(record.lineageKey);
      admissionEpochs.delete(record.lineageKey);
    }
    if (record.timer !== undefined) cancelTimer(record.timer);
    record.lifetime.removeEventListener("abort", record.onLifetimeAbort);
    record.controller.abort();
  };
  const schedule = (record: SessionRecord, deadlineAt: number): void => {
    if (record.timer !== undefined) cancelTimer(record.timer);
    record.deadlineAt = deadlineAt;
    record.timer = timer(
      () => release(record),
      Math.max(0, deadlineAt - options.now()),
    );
  };
  const invalidate = (event: P6rProviderInvalidation): void => {
    for (const record of [...sessions.values()]) {
      if (record.providerGeneration !== event.generation) continue;
      if (
        event.kind === "authentication" &&
        event.subjects !== undefined &&
        !event.subjects.some(
          (subject) =>
            subject.issuer === record.subject.issuer &&
            subject.subject === record.subject.subject,
        )
      )
        continue;
      release(record);
    }
  };
  const revokeLineage = (lineageKey: string): void => {
    const record = lineages.get(lineageKey);
    if (record === undefined) admissionEpochs.delete(lineageKey);
    else release(record);
  };
  const unsubscribe =
    options.providerRegistry.subscribeInvalidations(invalidate);
  const sessionFor = (input: {
    readonly configuration: P6rProviderConfiguration;
    readonly lifetime: AbortSignal;
    readonly lineage: string;
    readonly lineageScope: string;
    readonly person: P6rPersonReference;
    readonly presentation: P6rProfilePresentation;
    readonly providerGeneration: string;
    readonly validUntil: number;
  }): SessionRecord | null => {
    const lineageKey = sessionKey([
      input.lineageScope,
      input.configuration.boundaryId,
      input.lineage,
    ]);
    const key = sessionKey([
      lineageKey,
      input.providerGeneration,
      input.person.issuer,
      input.person.subject,
    ]);
    const lineageRecord = lineages.get(lineageKey);
    if (lineageRecord !== undefined && lineageRecord.key !== key)
      release(lineageRecord);
    const existing = sessions.get(key);
    if (
      existing !== undefined &&
      !existing.controller.signal.aborted &&
      existing.deadlineAt > options.now()
    ) {
      schedule(existing, input.validUntil);
      return existing;
    }
    if (existing !== undefined) release(existing);
    if (sessions.size >= maxSessions) return null;
    const person = Object.freeze({
      issuer: input.person.issuer,
      key: input.person.key,
      kind: "person" as const,
      subject: input.person.subject,
    });
    const session: P6rReadySession = Object.freeze({
      actor: Object.freeze({
        evidence: "provider-verified",
        identity: person,
        presentation: Object.freeze({
          avatarUrl: input.presentation.avatarUrl,
          displayName: input.presentation.displayName,
          handle: input.presentation.handle,
        }),
      }),
      capabilities: Object.freeze({
        acceptance: "transactional-check",
        directory: Object.freeze({
          lookup:
            options.providerRegistry.directorySources()[0]?.lookup !==
            undefined,
          search:
            options.providerRegistry.directorySources()[0]?.directory !==
            undefined,
        }),
        externalSend: "structured",
        forwarding: "host-bound",
        operationLookup: true,
        participants: true,
        requestIdentity: "host-resolved",
        toolProvenance: "partial",
      }),
      instanceId: options.instanceId,
      mode: "multi-user",
      stamp: `p6r-session:v1:${boot}:${++serial}`,
      status: "ready",
    });
    const controller = new AbortController();
    let record: SessionRecord;
    const onLifetimeAbort = (): void => release(record);
    record = {
      controller,
      deadlineAt: input.validUntil,
      key,
      lifetime: input.lifetime,
      lineageKey,
      onLifetimeAbort,
      providerGeneration: input.providerGeneration,
      session,
      subject: person,
      timer: undefined,
    };
    input.lifetime.addEventListener("abort", onLifetimeAbort, { once: true });
    sessions.set(key, record);
    lineages.set(lineageKey, record);
    schedule(record, input.validUntil);
    return record;
  };
  const resolve = async (
    input: AdmissionResolutionInput,
  ): Promise<TrustedInvocation> => {
    if (disposed || input.lifetime.aborted) return null;
    const current = selectedConfiguration();
    if (current === null)
      return {
        deadlineAt: options.now() + 1,
        session: unavailable(
          options.instanceId,
          "No operator-selected identity boundary is configured",
        ),
        sessionEpoch: `p6r-denied:${++serial}`,
      };
    const request = options.requestFacts(input.request);
    const ingress = options.ingressFacts({
      request: input.request,
      transport: input.transport,
    });
    if (
      request === null ||
      ingress === null ||
      request.transport !== input.transport ||
      ingress.id === null ||
      ingress.lineage === null ||
      ingress.lineage.length === 0 ||
      ingress.kind === "unverified" ||
      !current.ingressIds.includes(ingress.id)
    )
      return {
        deadlineAt: options.now() + 1,
        session: unauthenticated(
          options.instanceId,
          "Trusted identity ingress is unavailable for this request",
        ),
        sessionEpoch: `p6r-denied:${++serial}`,
      };
    const lineageKey = sessionKey([
      input.lineageScope,
      current.boundaryId,
      ingress.lineage,
    ]);
    const admissionEpoch = ++admissionSerial;
    admissionEpochs.set(lineageKey, admissionEpoch);
    const controller = new AbortController();
    const onRetire = (): void => controller.abort();
    input.lifetime.addEventListener("abort", onRetire, { once: true });
    const deadlineAt = Math.min(
      request.receivedAt + current.resolver.timeoutMs,
      options.now() + current.resolver.timeoutMs,
    );
    const credentials = current.credentials.flatMap((credential) => {
      const value =
        credential.source === "header"
          ? request.header(credential.field)
          : request.cookie(credential.field);
      return value === null
        ? []
        : [Object.freeze({ name: credential.name, value })];
    });
    try {
      const resolution = await options.providerRegistry.resolve({
        configuration: current,
        credentials: Object.freeze(credentials),
        deadlineAt,
        ingress: Object.freeze({
          authenticatedPeer: ingress.authenticatedPeer,
          id: ingress.id,
          kind: ingress.kind,
        }),
        request: Object.freeze({
          authority: request.authority,
          method: request.method,
          pathname: request.pathname,
          receivedAt: request.receivedAt,
          transport: request.transport,
        }),
        signal: controller.signal,
        version: 1,
      });
      if (controller.signal.aborted || input.lifetime.aborted) return null;
      if (admissionEpochs.get(lineageKey) !== admissionEpoch) return null;
      if (resolution.status === "unavailable") {
        revokeLineage(lineageKey);
        return {
          deadlineAt: options.now() + 1,
          session: unavailable(options.instanceId, resolution.reason),
          sessionEpoch: `p6r-denied:${++serial}`,
        };
      }
      if (resolution.status === "not-applicable") {
        revokeLineage(lineageKey);
        return {
          deadlineAt: options.now() + 1,
          session: unauthenticated(
            options.instanceId,
            "The selected identity boundary does not apply",
          ),
          sessionEpoch: `p6r-denied:${++serial}`,
        };
      }
      if (resolution.status === "rejected") {
        revokeLineage(lineageKey);
        return {
          deadlineAt: options.now() + 1,
          session: unauthenticated(options.instanceId, resolution.reason),
          sessionEpoch: `p6r-denied:${++serial}`,
        };
      }
      if (resolution.status !== "resolved") {
        revokeLineage(lineageKey);
        return {
          deadlineAt: options.now() + 1,
          session: unavailable(
            options.instanceId,
            "Provider resolution state is invalid",
          ),
          sessionEpoch: `p6r-denied:${++serial}`,
        };
      }
      const source = options.providerRegistry.directorySources()[0];
      if (source === undefined) {
        revokeLineage(lineageKey);
        return {
          deadlineAt: options.now() + 1,
          session: unavailable(
            options.instanceId,
            "Provider publication is unavailable",
          ),
          sessionEpoch: `p6r-denied:${++serial}`,
        };
      }
      const person = source.person(resolution.issuer, resolution.subject);
      if (!person.ok) {
        revokeLineage(lineageKey);
        return {
          deadlineAt: options.now() + 1,
          session: unauthenticated(options.instanceId, person.error.message),
          sessionEpoch: `p6r-denied:${++serial}`,
        };
      }
      const record = sessionFor({
        configuration: current,
        lifetime: input.lifetime,
        lineage: ingress.lineage,
        lineageScope: input.lineageScope,
        person: person.value,
        presentation: resolution.presentation,
        providerGeneration: source.generation,
        validUntil: resolution.validUntil,
      });
      if (record === null) {
        admissionEpochs.delete(lineageKey);
        return {
          deadlineAt: options.now() + 1,
          session: unavailable(
            options.instanceId,
            "Identity session capacity is exhausted",
          ),
          sessionEpoch: `p6r-denied:${++serial}`,
        };
      }
      return {
        deadlineAt: record.deadlineAt,
        session: record.session,
        sessionEpoch: record.session.stamp,
        signal: record.controller.signal,
      };
    } finally {
      input.lifetime.removeEventListener("abort", onRetire);
    }
  };
  const admitNative = async (
    request: object,
    transport: "http" | "websocket",
  ): Promise<P6rNativeAdmission> => {
    if (!isConfigured())
      return {
        status: "baseline",
        validate: () =>
          isConfigured() ? { ok: false, code: "invalidated" } : { ok: true },
      };
    const lifetime = new AbortController();
    const abortNativeLifetime = () => lifetime.abort();
    nativeLifetime.signal.addEventListener("abort", abortNativeLifetime, {
      once: true,
    });
    const release = (): void => {
      nativeLifetime.signal.removeEventListener("abort", abortNativeLifetime);
      lifetime.abort();
    };
    const admitted = await resolve({
      lifetime: lifetime.signal,
      lineageScope: `native-${transport}:${++admissionSerial}`,
      request,
      transport,
    });
    if (admitted === null || admitted.session.status !== "ready") {
      release();
      return {
        error:
          admitted === null || admitted.session.status === "ready"
            ? error("unavailable", "Native identity admission is unavailable")
            : admitted.session.error,
        status: "blocked",
      };
    }
    return {
      release,
      session: admitted.session,
      signal: admitted.signal ?? lifetime.signal,
      status: "ready",
      validUntil: admitted.deadlineAt,
      validate: () =>
        options.now() >= admitted.deadlineAt
          ? { ok: false, code: "expired" }
          : lifetime.signal.aborted ||
              admitted.signal?.aborted ||
              !isConfigured()
            ? { ok: false, code: "invalidated" }
            : { ok: true },
    };
  };
  return {
    admitNativeHttp(request) {
      return admitNative(request, "http");
    },
    admitNativeWebSocket(request) {
      return admitNative(request, "websocket");
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      nativeLifetime.abort();
      unsubscribe();
      for (const record of [...sessions.values()]) release(record);
    },
    providerConfiguration(pluginId) {
      const current = selectedConfiguration();
      return current === null || current.pluginId !== pluginId ? null : current;
    },
    async trustedInvocation(input) {
      return resolve({
        lifetime: input.generation.lifetime,
        lineageScope: input.generation.generation,
        request: input.request,
        transport: input.ingress.transport,
      });
    },
  };
}
