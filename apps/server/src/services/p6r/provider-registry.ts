import type { P6rForkIdentityProvider, P6rForkProviderRegistration, P6rPersonReference, P6rProviderConfiguration, P6rProviderDirectorySource, P6rProviderEvidence, P6rProviderInvalidation, P6rProviderRegistry, P6rResult } from "./provider-contract.js";

type Timer = ReturnType<typeof setTimeout>;
type CandidateState = { readonly controller: AbortController; readonly configuration: Readonly<P6rProviderConfiguration>; readonly generation: string; readonly listeners: Set<(status: "staged" | "active" | "retired") => void>; readonly pluginId: string; readonly provider: P6rForkIdentityProvider; readonly resolutionControllers: Set<AbortController>; readonly registration: P6rForkProviderRegistration; authEpoch: number; status: "staged" | "active" | "retired"; };

export interface P6rProviderRegistryOptions { readonly clearTimeout?: (timer: Timer) => void; readonly now: () => number; readonly setTimeout?: (callback: () => void, delay: number) => Timer; }

function failure(code: "unavailable" | "invalid-input" | "invalid-operation" | "expired", message: string): P6rResult<never> { return { ok: false, error: { code, message, retry: code === "unavailable" ? "after-reconnect" : code === "expired" ? "same-operation" : "never" } }; }
function keyFor(issuer: string, subject: string): string { return `p6r-person:v1:${encodeURIComponent(issuer)}:${encodeURIComponent(subject)}`; }
function configurationSnapshot(value: P6rProviderConfiguration): Readonly<P6rProviderConfiguration> { return Object.freeze({ boundaryId: value.boundaryId, credentials: Object.freeze(value.credentials.map((credential) => Object.freeze({ field: credential.field, name: credential.name, source: credential.source }))), ingressIds: Object.freeze([...value.ingressIds]), pluginId: value.pluginId, resolver: Object.freeze({ maxSessionAgeMs: value.resolver.maxSessionAgeMs, timeoutMs: value.resolver.timeoutMs }), version: 1 }); }
function validConfiguration(value: P6rProviderConfiguration): boolean { return value.version === 1 && value.boundaryId.length > 0 && value.pluginId.length > 0 && Number.isFinite(value.resolver.timeoutMs) && value.resolver.timeoutMs > 0 && Number.isFinite(value.resolver.maxSessionAgeMs) && value.resolver.maxSessionAgeMs > 0; }
function validIssuers(issuers: readonly string[]): boolean { return issuers.length > 0 && issuers.every((issuer) => issuer.length > 0) && new Set(issuers).size === issuers.length; }
function sameConfiguration(left: Readonly<P6rProviderConfiguration>, right: Readonly<P6rProviderConfiguration>): boolean { return left.version === right.version && left.boundaryId === right.boundaryId && left.pluginId === right.pluginId && left.resolver.timeoutMs === right.resolver.timeoutMs && left.resolver.maxSessionAgeMs === right.resolver.maxSessionAgeMs && left.credentials.length === right.credentials.length && left.credentials.every((credential, index) => credential.name === right.credentials[index]?.name && credential.source === right.credentials[index]?.source && credential.field === right.credentials[index]?.field) && left.ingressIds.length === right.ingressIds.length && left.ingressIds.every((id, index) => id === right.ingressIds[index]); }

export function encodeP6rPersonKey(issuer: string, subject: string): string { return keyFor(issuer, subject); }

export function createP6rProviderRegistry(options: P6rProviderRegistryOptions): P6rProviderRegistry {
  const candidates = new Map<string, CandidateState>();
  const timer = options.setTimeout ?? setTimeout;
  const cancelTimer = options.clearTimeout ?? clearTimeout;
  let active: CandidateState | null = null;
  const invalidationListeners = new Set<(event: P6rProviderInvalidation) => void>();

  const notifyInvalidation = (event: P6rProviderInvalidation): void => { for (const listener of invalidationListeners) listener(event); };

  const person = (state: CandidateState, issuer: string, subject: string): P6rResult<P6rPersonReference> => {
    if (!state.provider.issuers.includes(issuer) || subject.length === 0) return failure("invalid-input", "Provider issuer or subject is invalid");
    return { ok: true, value: { issuer, key: keyFor(issuer, subject), kind: "person", subject } };
  };
  const retireState = (state: CandidateState): void => {
    if (state.status === "retired") return;
    const registered = candidates.get(state.generation) === state;
    state.status = "retired";
    state.controller.abort();
    for (const controller of state.resolutionControllers) controller.abort();
    state.resolutionControllers.clear();
    if (candidates.get(state.generation) === state) candidates.delete(state.generation);
    if (active === state) active = null;
    for (const listener of state.listeners) listener("retired");
    if (registered) notifyInvalidation({ epoch: state.authEpoch, generation: state.generation, kind: "retired" });
  };
  const current = (state: CandidateState, epoch: number): boolean => active === state && state.status === "active" && state.authEpoch === epoch && !state.controller.signal.aborted;
  const bounded = async <T>(run: () => Promise<T>, deadlineAt: number, signal: AbortSignal): Promise<T | null> => {
    const remaining = deadlineAt - options.now();
    if (remaining <= 0 || signal.aborted) return null;
    let timeout: Timer | undefined;
    let removeAbort: (() => void) | undefined;
    const cancelled = new Promise<null>((resolve) => {
      timeout = timer(() => resolve(null), remaining);
      const onAbort = (): void => resolve(null);
      signal.addEventListener("abort", onAbort, { once: true });
      removeAbort = () => signal.removeEventListener("abort", onAbort);
    });
    try { return await Promise.race([run(), cancelled]); } finally { if (timeout !== undefined) cancelTimer(timeout); removeAbort?.(); }
  };
  const sourceFor = (state: CandidateState): P6rProviderDirectorySource => ({
    directory: state.provider.directory === undefined ? undefined : async (input, readOptions) => {
      if (active !== state || state.status !== "active") return failure("unavailable", "Provider generation is retired");
      return state.provider.directory!(input, readOptions);
    },
    generation: state.generation,
    issuers: Object.freeze([...state.provider.issuers]),
    lookup: state.provider.lookup === undefined ? undefined : async (subjects, readOptions) => {
      if (active !== state || state.status !== "active") return failure("unavailable", "Provider generation is retired");
      return state.provider.lookup!(subjects, readOptions);
    },
    person: (issuer, subject) => person(state, issuer, subject),
  });

  return {
    async prepare(input) {
      if (!validConfiguration(input.configuration) || !validIssuers(input.provider.issuers) || input.generation.length === 0 || candidates.has(input.generation)) return failure("invalid-input", "Provider candidate is malformed or already staged");
      const configuration = configurationSnapshot(input.configuration);
      const controller = new AbortController();
      let state: CandidateState;
      const registration: P6rForkProviderRegistration = {
        configuration,
        dispose: () => retireState(state),
        generation: input.generation,
        getStatus: () => state.status,
        invalidate: (change) => {
          if (active !== state || state.status !== "active") return { ok: true, value: undefined };
          if (change.kind === "authentication") { state.authEpoch += 1; for (const resolution of state.resolutionControllers) resolution.abort(); notifyInvalidation({ epoch: state.authEpoch, generation: state.generation, kind: "authentication", subjects: change.subjects === undefined ? undefined : Object.freeze(change.subjects.map((subject) => Object.freeze({ issuer: subject.issuer, subject: subject.subject }))) }); }
          if (change.kind === "directory") notifyInvalidation({ generation: state.generation, kind: "directory" });
          return { ok: true, value: undefined };
        },
        person: (issuer, subject) => person(state, issuer, subject),
        signal: controller.signal,
        subscribe: (listener) => { state.listeners.add(listener); return () => state.listeners.delete(listener); },
      };
      state = { authEpoch: 0, configuration, controller, generation: input.generation, listeners: new Set(), pluginId: configuration.pluginId, provider: input.provider, registration, resolutionControllers: new Set(), status: "staged" };
      if (input.provider.validateReadiness !== undefined) {
        const readiness = await bounded(() => input.provider.validateReadiness!({ configuration, deadlineAt: input.deadlineAt, generation: input.generation, signal: controller.signal }), input.deadlineAt, controller.signal);
        if (readiness === null) { retireState(state); return failure("unavailable", "Provider readiness timed out or was cancelled"); }
        if (!readiness.ok) { retireState(state); return readiness; }
      }
      if (controller.signal.aborted || options.now() >= input.deadlineAt) { retireState(state); return failure("unavailable", "Provider readiness expired"); }
      candidates.set(state.generation, state);
      return { ok: true, value: { configuration, generation: state.generation, pluginId: state.pluginId, registration } };
    },
    notifyPublished(candidate) {
      const state = candidates.get(candidate.generation);
      if (state === undefined || active !== state || state.status !== "active" || state.pluginId !== candidate.pluginId || state.registration !== candidate.registration) return;
      for (const listener of state.listeners) listener("active");
    },
    publish(candidate) {
      const state = candidates.get(candidate.generation);
      if (state === undefined || state.status !== "staged" || state.pluginId !== candidate.pluginId || state.registration !== candidate.registration || state.configuration !== candidate.configuration) return failure("invalid-operation", "Provider candidate is stale");
      const predecessor = active;
      active = state;
      state.status = "active";
      return { ok: true, value: { active: candidate, predecessor: predecessor === null ? null : { configuration: predecessor.configuration, generation: predecessor.generation, pluginId: predecessor.pluginId, registration: predecessor.registration } } };
    },
    directorySources: () => active === null || active.status !== "active" ? [] : [sourceFor(active)],
    async resolve(evidence) {
      const state = active;
      if (state === null || state.status !== "active") return { status: "unavailable", reason: "no-active-provider" };
      if (!sameConfiguration(state.configuration, evidence.configuration)) return { status: "unavailable", reason: "provider-configuration-mismatch" };
      const epoch = state.authEpoch;
      const controller = new AbortController();
      const onEvidenceAbort = (): void => controller.abort();
      evidence.signal.addEventListener("abort", onEvidenceAbort, { once: true });
      if (evidence.signal.aborted) onEvidenceAbort();
      state.resolutionControllers.add(controller);
      const deadlineAt = Math.min(evidence.deadlineAt, options.now() + state.configuration.resolver.timeoutMs);
      const providerEvidence: P6rProviderEvidence = {
        configuration: configurationSnapshot(state.configuration),
        credentials: Object.freeze(evidence.credentials.map((credential) => Object.freeze({ name: credential.name, value: credential.value }))),
        deadlineAt,
        ingress: Object.freeze({ authenticatedPeer: evidence.ingress.authenticatedPeer, id: evidence.ingress.id, kind: evidence.ingress.kind }),
        request: Object.freeze({ authority: evidence.request.authority, method: evidence.request.method, pathname: evidence.request.pathname, receivedAt: evidence.request.receivedAt, transport: evidence.request.transport }),
        signal: controller.signal,
        version: 1,
      };
      try {
        const resolution = await bounded(() => state.provider.resolve(providerEvidence), deadlineAt, controller.signal);
        if (resolution === null) return current(state, epoch) ? { status: "unavailable", reason: "provider-resolution-timeout" } : { status: "unavailable", reason: "provider-resolution-invalidated" };
        if (!current(state, epoch)) return { status: "unavailable", reason: "provider-resolution-invalidated" };
        if (resolution.status !== "resolved") return resolution;
        if (!state.provider.issuers.includes(resolution.issuer) || resolution.subject.length === 0) return { status: "rejected", reason: "undeclared-issuer-or-subject" };
        const validUntil = Math.min(resolution.validUntil, evidence.request.receivedAt + state.configuration.resolver.maxSessionAgeMs);
        if (!Number.isFinite(validUntil) || validUntil <= options.now()) return { status: "rejected", reason: "invalid-provider-expiry" };
        return { ...resolution, validUntil };
      } catch { return { status: "unavailable", reason: "provider-resolution-fault" }; } finally { evidence.signal.removeEventListener("abort", onEvidenceAbort); state.resolutionControllers.delete(controller); }
    },
    retire(candidate) {
      const state = candidates.get(candidate.generation);
      if (state !== undefined && state.pluginId === candidate.pluginId && state.registration === candidate.registration) retireState(state);
    },
    subscribeInvalidations(listener) {
      invalidationListeners.add(listener);
      let subscribed = true;
      return () => { if (!subscribed) return; subscribed = false; invalidationListeners.delete(listener); };
    },
  };
}
