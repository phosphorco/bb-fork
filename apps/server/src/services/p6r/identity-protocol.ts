import { createHash } from "node:crypto";
import type { DbConnection } from "@bb/db";
import type { ExperimentalP6rIdentityProtocol, ExperimentalP6rInvocationContext, ExperimentalP6rInvocationRegistration, ExperimentalP6rInvocationRouteClass } from "@get-bb/plugin-sdk";
import type { P6rCaptureResult, P6rInvocationIngress, P6rInvocationRegistry, P6rInvocationScope, P6rValidity } from "./invocation-registry.js";
import type { P6rForkIdentityProvider, P6rForkProviderRegistration, P6rIdentityError, P6rPersonReference, P6rPreparedProvider, P6rProfilePresentation, P6rProviderConfiguration, P6rProviderDirectorySource, P6rProviderRegistry, P6rResult } from "./provider-contract.js";
import { p6rOutcomeFromStoredReceipt } from "./receipt-outcome.js";
import {
  getP6rHistoryRevision,
  findP6rNativeRequestForEvent,
  listP6rAttempts,
  listP6rAttemptsForNativeTurn,
  listP6rContributions,
  lookupP6rOperationReceipt,
  type P6rStoredAttempt,
} from "./sidecar-store.js";
import { getServerP6rToolCorrelationRegistry } from "./tool-correlation-registry.js";

export type { P6rForkIdentityProvider, P6rForkProviderRegistration, P6rIdentityError, P6rPersonReference, P6rPreparedProvider, P6rProfilePresentation, P6rProviderConfiguration, P6rProviderDirectoryRecord, P6rProviderDirectorySource, P6rProviderEvidence, P6rProviderRegistry, P6rProviderResolution, P6rResult } from "./provider-contract.js";

export type P6rJson = null | boolean | number | string | readonly P6rJson[] | { readonly [key: string]: P6rJson };
export interface P6rExternalAuthor { readonly presentation: P6rProfilePresentation; readonly subject: string; }
export interface P6rIdentityCapabilities { readonly requestIdentity: "singleton" | "host-resolved"; readonly acceptance: "pre-dispatch-check" | "transactional-check"; readonly forwarding: "singleton-convention" | "host-bound"; readonly directory: { readonly search: boolean; readonly lookup: boolean }; readonly participants: boolean; readonly externalSend: "source-labelled" | "structured"; readonly toolProvenance: "unknown" | "partial" | "causal"; readonly operationLookup: boolean; }
export interface P6rReadySession { readonly actor: { readonly evidence: "provider-verified" | "local-user" | "upstream-default" | "integration-asserted" | "legacy"; readonly identity: P6rPersonReference; readonly presentation: P6rProfilePresentation }; readonly capabilities: P6rIdentityCapabilities; readonly instanceId: string; readonly mode: "multi-user" | "single-user"; readonly stamp: string; readonly status: "ready"; }
export type P6rServerSession = P6rReadySession | { readonly error: P6rIdentityError; readonly instanceId: string; readonly status: "incompatible" | "unauthenticated" | "unavailable"; };
export interface P6rIdentityProfile { readonly identity: P6rPersonReference; readonly presentation: P6rProfilePresentation; readonly revision: string; readonly status: "current" | "historical"; }
export interface P6rRequestExpectation { readonly actor: string; readonly session: string; }
export interface P6rReadOptions { readonly signal?: AbortSignal; }
export interface P6rSendInput { readonly input: readonly P6rJson[]; readonly mode: "auto" | "start" | "steer-if-active" | "queue-if-active"; readonly operationId: string; readonly threadId: string; }
export interface P6rAcceptanceReceipt { readonly acceptedAt: string; readonly deduplication: "guaranteed"; readonly evidence: "host-accepted"; readonly native: { readonly deliveryId: string | null; readonly queuedMessageId: string | null; readonly turnId: string | null }; readonly operationId: string; readonly provenance: "structured"; readonly references: readonly { readonly contributionId: string; readonly threadId: string }[]; readonly retainedUntil: string; }
export type P6rAcceptanceOutcome = { readonly status: "submitted"; readonly receipt: P6rAcceptanceReceipt } | { readonly status: "rejected"; readonly error: P6rIdentityError } | { readonly status: "indeterminate"; readonly operationId: string; readonly message: string; };
export type P6rOperationLookup = { readonly status: "final"; readonly outcome: P6rAcceptanceOutcome } | { readonly status: "pending" } | { readonly status: "absent-final"; readonly retry: "same-operation-only" } | { readonly status: "unknown"; readonly reason: "unsupported" | "expired" | "unavailable" };
export type P6rToolContext = object;
export type P6rExecutionProvenance =
  | { readonly status: "known"; readonly correlation: { readonly attemptId: string; readonly threadId: string; readonly toolCallId: string | null; readonly turnId: string }; readonly contributions: readonly P6rContribution[]; readonly inputGroups: readonly { readonly sources: readonly { readonly kind: "contribution"; readonly reference: P6rContributionReference }[] }[]; }
  | { readonly status: "partial"; readonly correlation: { readonly attemptId: string; readonly threadId: string; readonly toolCallId: string | null; readonly turnId: string } | null; readonly contributions: readonly P6rContribution[]; readonly inputGroups: readonly { readonly sources: readonly { readonly kind: "contribution"; readonly reference: P6rContributionReference }[] }[]; readonly missing: readonly P6rContributionReference[]; readonly reason: string; }
  | { readonly status: "unknown"; readonly correlation: null; readonly reason: string; };
export interface P6rContributionReference { readonly contributionId: string; readonly threadId: string; }
export type P6rContributionQuery = ({ readonly kind: "references"; readonly references: readonly P6rContributionReference[] } | { readonly kind: "native-message"; readonly messageId: string; readonly threadId: string } | { readonly kind: "native-event"; readonly eventId: string; readonly threadId: string }) & { readonly cursor?: string; readonly limit?: number; };
export type P6rAttemptQuery = ({ readonly kind: "operation"; readonly operationId: string } | { readonly kind: "contribution"; readonly reference: P6rContributionReference }) & { readonly cursor?: string; readonly limit?: number; };
export interface P6rActorSnapshot { readonly evidence: "provider-verified" | "local-user" | "upstream-default" | "integration-asserted" | "legacy"; readonly identity: P6rPersonReference | P6rExternalIdentity; readonly presentation: P6rProfilePresentation; }
export interface P6rExternalIdentity { readonly key: string; readonly kind: "external"; readonly pluginId: string; readonly subject: string; }
export interface P6rExternalActorSnapshot { readonly evidence: "provider-verified" | "local-user" | "upstream-default" | "integration-asserted" | "legacy"; readonly identity: P6rExternalIdentity; readonly presentation: P6rProfilePresentation; }
export type P6rOrigin = { readonly kind: "person"; readonly actor: P6rActorSnapshot & { readonly identity: P6rPersonReference } } | { readonly kind: "external"; readonly actor: P6rActorSnapshot & { readonly identity: P6rExternalIdentity } } | { readonly kind: "agent"; readonly agentId: string | null } | { readonly kind: "system"; readonly reason: string } | { readonly kind: "unknown"; readonly reason: "legacy" | "upstream-unattributed" | "missing-source" };
export interface P6rContribution { readonly acceptedAt: string; readonly author: P6rOrigin; readonly latestEditor: P6rActorSnapshot | null; readonly mentionedPeople: readonly P6rPersonReference[]; readonly reference: P6rContributionReference; }
export type P6rEvidencePage<T> = { readonly status: "known" | "partial"; readonly items: readonly T[]; readonly missing: readonly string[]; readonly nextCursor: string | null; readonly traversal: "complete" | "continued" } | { readonly status: "pending" } | { readonly status: "unavailable"; readonly reason: "unsupported" | "missing-history" | "outage" };
export interface P6rParticipantQuery { readonly cursor?: string; readonly limit: number; readonly threadId: string; }
export interface P6rParticipant { readonly identity: P6rPersonReference | P6rExternalIdentity; readonly presentation: P6rProfilePresentation; readonly roles: readonly ("author" | "editor" | "mentioned" | "interaction-resolver")[]; }
export interface P6rParticipantPage { readonly coverage: "complete-history" | "partial-history"; readonly items: readonly P6rParticipant[]; readonly nextCursor: string | null; readonly revision: string; }
export type P6rHostInvalidation = { readonly kind: "session"; readonly reason: "actor" | "provider" | "capabilities" } | { readonly kind: "directory"; readonly keys: readonly string[] } | { readonly kind: "participants"; readonly threadIds: readonly string[] } | { readonly kind: "disconnected" | "reconnected" | "disposed" };

export type P6rRawProtocol = ExperimentalP6rIdentityProtocol<object, P6rToolContext, P6rSendInput, P6rExternalAuthor, P6rServerSession, P6rResult<P6rIdentityProfile>, P6rReadySession, P6rResult<void>, P6rRequestExpectation, P6rIdentityError, P6rAcceptanceOutcome, P6rResult<P6rOperationLookup>, P6rResult<P6rExecutionProvenance>, P6rContributionQuery, P6rResult<P6rEvidencePage<P6rContribution>>, P6rAttemptQuery, P6rResult<P6rEvidencePage<P6rExecutionProvenance>>, P6rProviderDirectorySource, P6rParticipantQuery, P6rResult<P6rParticipantPage>, P6rJson, P6rForkIdentityProvider, P6rForkProviderRegistration, P6rHostInvalidation, () => void, P6rReadOptions, P6rJson>;

export interface P6rIdentityGeneration { readonly generation: string; readonly lifetime: AbortSignal; readonly pluginId: string; }
export interface P6rIdentityExtension { readonly protocol: P6rRawProtocol; activate(): void; retire(): void; }
export interface P6rNativeAcceptance { readonly authorEvidence: P6rJson | null; readonly input: P6rSendInput; readonly operationNamespace: string; readonly payloadHash: string; readonly source: "external" | "scope"; readonly validate: () => P6rValidity; }
export interface P6rIdentityServiceRoot {
  readonly db: DbConnection;
  readonly instanceId: string;
  readonly invocationRegistry: P6rInvocationRegistry;
  readonly providerConfiguration: (pluginId: string) => P6rProviderConfiguration | null;
  readonly providerRegistry: P6rProviderRegistry;
  readonly native: {
    readonly accept?: (input: P6rNativeAcceptance) => Promise<P6rAcceptanceOutcome>;
    readonly forwardRpc?: (input: {
      readonly destination: { readonly method: string; readonly pluginId: string };
      readonly deriveScope: (destinationGeneration: string) => P6rDerivedForwardInvocation | null;
      readonly input: P6rJson;
    }) => Promise<P6rJson>;
  };
  readonly now: () => number;
  activateBindings(generation: P6rIdentityGeneration): void;
  bindInvocation<Args extends readonly unknown[], Output>(input: { readonly generation: P6rIdentityGeneration; readonly handler: (context: ExperimentalP6rInvocationContext<object>, ...args: Args) => Output; readonly routeClass: ExperimentalP6rInvocationRouteClass; }): { readonly handler: (...args: Args) => Output; readonly registration: ExperimentalP6rInvocationRegistration; };
  retireBindings(generation: P6rIdentityGeneration): void;
  trustedInvocation(input: { readonly generation: P6rIdentityGeneration; readonly ingress: P6rInvocationIngress; readonly request: object; readonly routeClass: ExperimentalP6rInvocationRouteClass; }): Promise<{ readonly deadlineAt: number; readonly session: P6rServerSession; readonly sessionEpoch: string; readonly signal?: AbortSignal; } | null>;
}
export interface P6rDerivedForwardInvocation {
  readonly request: object;
  readonly release: () => void;
  readonly scope: P6rInvocationScope;
}
export interface P6rIdentityService { captureInvocation(input: { readonly generation: string; readonly ingress: P6rInvocationIngress; readonly pluginId: string; readonly request: object; readonly routeClass: ExperimentalP6rInvocationRouteClass; }): Promise<P6rCaptureResult>; forPluginGeneration(pluginId: string, generation: string, lifetime: AbortSignal): P6rIdentityExtension; preparedProvider(pluginId: string, generation: string): P6rPreparedProvider | null; }

function failure(code: P6rIdentityError["code"], message: string): P6rIdentityError { return { code, message, retry: code === "expired" ? "same-operation" : code === "unavailable" ? "after-reconnect" : "never" }; }
function unavailableSession(): P6rServerSession { return { error: failure("unavailable", "Identity is unavailable for this request"), instanceId: "p6r-unavailable", status: "unavailable" }; }
function isRecord(value: P6rJson): value is { readonly [key: string]: P6rJson } { return value !== null && typeof value === "object" && !Array.isArray(value); }
function canonical(value: P6rJson): string { if (value === null || typeof value !== "object") return JSON.stringify(value); if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`; if (!isRecord(value)) throw new Error("P6r JSON record required"); return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key]!)}`).join(",")}}`; }
function payloadHash(input: P6rSendInput, source: "external" | "scope", authorEvidence: P6rJson, instanceId: string, pluginId: string): string { return createHash("sha256").update(canonical({ authorEvidence, input: { input: input.input, mode: input.mode, operationId: input.operationId, threadId: input.threadId }, namespace: { instanceId, pluginId }, source })).digest("hex"); }
function tupleKey(...parts: readonly string[]): string { return parts.map((part) => `${part.length}:${part}`).join(""); }
function operationNamespace(instanceId: string, pluginId: string): string { return tupleKey(instanceId, pluginId); }
function externalEvidence(author: P6rExternalAuthor, pluginId: string): P6rJson { return { evidence: "integration-asserted", identity: { key: `p6r-external:v1:${tupleKey(pluginId, author.subject)}`, kind: "external", pluginId, subject: author.subject }, presentation: { avatarUrl: author.presentation.avatarUrl, displayName: author.presentation.displayName, handle: author.presentation.handle } }; }
function sessionEvidence(session: P6rReadySession): P6rJson { return { evidence: session.actor.evidence, identity: { issuer: session.actor.identity.issuer, key: session.actor.identity.key, kind: session.actor.identity.kind, subject: session.actor.identity.subject }, presentation: { avatarUrl: session.actor.presentation.avatarUrl, displayName: session.actor.presentation.displayName, handle: session.actor.presentation.handle } }; }
function snapshotJson(value: P6rJson): P6rJson { if (Array.isArray(value)) return Object.freeze(value.map(snapshotJson)); if (isRecord(value)) { const result: Record<string, P6rJson> = {}; for (const key of Object.keys(value)) Object.defineProperty(result, key, { value: snapshotJson(value[key]!), enumerable: true, writable: true, configurable: true }); return Object.freeze(result); } return value; }
function snapshotInput(input: P6rSendInput): P6rSendInput { return Object.freeze({ input: Object.freeze(input.input.map(snapshotJson)), mode: input.mode, operationId: input.operationId, threadId: input.threadId }); }
function snapshotSession(session: P6rServerSession): P6rServerSession { if (session.status !== "ready") return Object.freeze({ error: Object.freeze({ code: session.error.code, message: session.error.message, retry: session.error.retry }), instanceId: session.instanceId, status: session.status }); return Object.freeze({ actor: Object.freeze({ evidence: session.actor.evidence, identity: Object.freeze({ issuer: session.actor.identity.issuer, key: session.actor.identity.key, kind: "person", subject: session.actor.identity.subject }), presentation: Object.freeze({ avatarUrl: session.actor.presentation.avatarUrl, displayName: session.actor.presentation.displayName, handle: session.actor.presentation.handle }) }), capabilities: Object.freeze({ acceptance: session.capabilities.acceptance, directory: Object.freeze({ lookup: session.capabilities.directory.lookup, search: session.capabilities.directory.search }), externalSend: session.capabilities.externalSend, forwarding: session.capabilities.forwarding, operationLookup: session.capabilities.operationLookup, participants: session.capabilities.participants, requestIdentity: session.capabilities.requestIdentity, toolProvenance: session.capabilities.toolProvenance }), instanceId: session.instanceId, mode: session.mode, stamp: session.stamp, status: "ready" }); }
function stringValue(value: unknown): string | null { return typeof value === "string" ? value : null; }
function profilePresentation(value: unknown): P6rProfilePresentation | null { if (value === null || typeof value !== "object" || Array.isArray(value)) return null; const record = value as Record<string, unknown>; const displayName = stringValue(record.displayName); const handle = record.handle; const avatarUrl = record.avatarUrl; return displayName === null || (handle !== null && typeof handle !== "string") || (avatarUrl !== null && typeof avatarUrl !== "string") ? null : { avatarUrl: avatarUrl as string | null, displayName, handle: handle as string | null }; }
function actorSnapshot(value: unknown): P6rActorSnapshot | null { if (value === null || typeof value !== "object" || Array.isArray(value)) return null; const record = value as Record<string, unknown>; const evidence = record.evidence; const presentation = profilePresentation(record.presentation); const identityRecord = record.identity; if ((evidence !== "provider-verified" && evidence !== "local-user" && evidence !== "upstream-default" && evidence !== "integration-asserted" && evidence !== "legacy") || presentation === null || identityRecord === null || typeof identityRecord !== "object" || Array.isArray(identityRecord)) return null; const identity = identityRecord as Record<string, unknown>; const key = stringValue(identity.key); const kind = identity.kind; if (key === null) return null; if (kind === "person") { const issuer = stringValue(identity.issuer); const subject = stringValue(identity.subject); return issuer === null || subject === null ? null : { evidence, identity: { issuer, key, kind, subject }, presentation }; } if (kind === "external") { const pluginId = stringValue(identity.pluginId); const subject = stringValue(identity.subject); return pluginId === null || subject === null ? null : { evidence, identity: { key, kind, pluginId, subject }, presentation }; } return null; }
function origin(value: unknown): P6rOrigin {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (record.kind === "system" && typeof record.reason === "string") {
      return { kind: "system", reason: record.reason };
    }
    if (
      record.kind === "agent" &&
      (typeof record.agentId === "string" || record.agentId === null)
    ) {
      return { kind: "agent", agentId: record.agentId };
    }
    if (
      record.kind === "unknown" &&
      (record.reason === "legacy" ||
        record.reason === "upstream-unattributed" ||
        record.reason === "missing-source")
    ) {
      return { kind: "unknown", reason: record.reason };
    }
  }
  const actor = actorSnapshot(value);
  if (actor === null) return { kind: "unknown", reason: "missing-source" };
  return actor.identity.kind === "person"
    ? { kind: "person", actor: { ...actor, identity: actor.identity } }
    : { kind: "external", actor: { ...actor, identity: actor.identity } };
}
function contribution(value: ReturnType<typeof listP6rContributions>[number]): P6rContribution { return { acceptedAt: new Date(value.acceptedAt).toISOString(), author: origin(value.acceptedAuthorship), latestEditor: actorSnapshot(value.latestEditor), mentionedPeople: [], reference: { contributionId: value.id, threadId: value.threadId } }; }
function queryFingerprint(value: unknown): string { return createHash("sha256").update(JSON.stringify(value)).digest("base64url"); }
function historyPage<T>(items: readonly T[], input: { readonly cursor?: string; readonly limit?: number }, fingerprint: string, revision: string): P6rResult<{ readonly items: readonly T[]; readonly nextCursor: string | null }> { const limit = input.limit ?? 50; if (!Number.isInteger(limit) || limit < 1 || limit > 200) return { ok: false, error: failure("invalid-input", "History page limit must be between 1 and 200") }; let offset = 0; if (input.cursor !== undefined) { try { const token = JSON.parse(Buffer.from(input.cursor, "base64url").toString("utf8")) as { readonly fingerprint?: unknown; readonly offset?: unknown; readonly revision?: unknown }; const tokenOffset = token.offset; if (token.fingerprint !== fingerprint || token.revision !== revision || typeof tokenOffset !== "number" || !Number.isInteger(tokenOffset) || tokenOffset < 0 || tokenOffset > items.length) return { ok: false, error: failure("conflict", "History cursor is stale or does not match this query") }; offset = tokenOffset; } catch { return { ok: false, error: failure("invalid-input", "History cursor is malformed") }; } } const nextOffset = offset + limit; return { ok: true, value: { items: items.slice(offset, nextOffset), nextCursor: nextOffset >= items.length ? null : Buffer.from(JSON.stringify({ fingerprint, offset: nextOffset, revision })).toString("base64url") } }; }
function attemptProvenance(db: DbConnection, attempt: P6rStoredAttempt): P6rExecutionProvenance { if (attempt.inputs.some((input) => input.sourceKind !== "contribution" || input.contributionId === null)) return { status: "partial", correlation: null, contributions: [], inputGroups: [], missing: [], reason: "Retained attempt has generated or interaction context without a normalized causal mapping" }; const references = attempt.inputs.map((input) => ({ contributionId: input.contributionId!, threadId: attempt.threadId })); const records = listP6rContributions(db, "", { references }); const contributions = records.map(contribution); const byReference = new Set(contributions.map((entry) => `${entry.reference.threadId}\u0000${entry.reference.contributionId}`)); const missing = references.filter((reference) => !byReference.has(`${reference.threadId}\u0000${reference.contributionId}`)); const groups = new Map<number, { readonly sources: { readonly kind: "contribution"; readonly reference: P6rContributionReference }[] }>(); for (const input of attempt.inputs) { const group = groups.get(input.groupIndex) ?? { sources: [] }; group.sources.push({ kind: "contribution", reference: { contributionId: input.contributionId!, threadId: attempt.threadId } }); groups.set(input.groupIndex, group); } const inputGroups = [...groups.entries()].sort(([left], [right]) => left - right).map(([, group]) => ({ sources: group.sources })); const correlation = attempt.nativeTurnId === null ? null : { attemptId: attempt.id, threadId: attempt.threadId, toolCallId: null, turnId: attempt.nativeTurnId }; if (correlation !== null && missing.length === 0) return { status: "known", correlation, contributions, inputGroups }; return { status: "partial", correlation, contributions, inputGroups, missing, reason: correlation === null ? "Retained attempt has no native turn correlation" : "Retained attempt references unavailable contributions" }; }

function toolProvenance(db: DbConnection, context: object): P6rExecutionProvenance {
  const call = getServerP6rToolCorrelationRegistry().lookupContext(context);
  if (call === null) {
    return { status: "unknown", correlation: null, reason: "No server-admitted native tool correlation is available" };
  }
  const attempts = listP6rAttemptsForNativeTurn(db, {
    threadId: call.threadId,
    turnId: call.turnId,
  });
  if (attempts.length === 0) {
    return { status: "unknown", correlation: null, reason: "No retained P6r attempt matches the admitted native tool turn" };
  }
  if (attempts.length !== 1) {
    return { status: "partial", correlation: null, contributions: [], inputGroups: [], missing: [], reason: "Multiple retained P6r attempts match the admitted native tool turn" };
  }
  const provenance = attemptProvenance(db, attempts[0]!);
  if (provenance.status === "unknown" || provenance.correlation === null) {
    return provenance;
  }
  const correlation = { ...provenance.correlation, toolCallId: call.callId };
  return provenance.status === "known"
    ? { ...provenance, correlation }
    : { ...provenance, correlation };
}

export function createP6rIdentityService(root: P6rIdentityServiceRoot): P6rIdentityService {
  const generations = new Map<string, P6rIdentityGeneration>();
  const requests = new WeakMap<object, { readonly scope: P6rInvocationScope; readonly session: P6rServerSession }>();
  const scopeSessions = new WeakMap<object, P6rServerSession>();
  const scopeRequests = new WeakMap<object, object>();
  const preparedProviders = new Map<string, P6rPreparedProvider>();
  const subscribers = new Map<string, Set<(event: P6rHostInvalidation) => void>>();
  const generationKey = (pluginId: string, generation: string) => `${pluginId}\u0000${generation}`;
  const requestState = (context: object) => { const state = requests.get(context); return state === undefined || !root.invocationRegistry.validateScope(state.scope).ok ? null : state; };
  const notify = (generation: string, event: P6rHostInvalidation): void => {
    for (const listener of subscribers.get(generation) ?? []) {
      try {
        listener(event);
      } catch {}
    }
  };
  root.providerRegistry.subscribeInvalidations((event) => {
    notify(
      event.generation,
      event.kind === "directory"
        ? { kind: "directory", keys: [] }
        : { kind: "session", reason: "provider" },
    );
  });
  return {
    async captureInvocation(input) {
      const generation = generations.get(input.generation);
      if (generation === undefined || generation.pluginId !== input.pluginId) return { ok: false, code: "retired" };
      const trusted = await root.trustedInvocation({ generation, ingress: input.ingress, request: input.request, routeClass: input.routeClass });
      if (trusted === null) return { ok: false, code: "retired" };
      if (generations.get(input.generation) !== generation || generation.lifetime.aborted || trusted.signal?.aborted || trusted.deadlineAt <= root.now()) return { ok: false, code: "retired" };
      const captured = root.invocationRegistry.captureInvocation({ deadlineAt: trusted.deadlineAt, generation: generation.generation, ingress: input.ingress, sessionEpoch: trusted.sessionEpoch, signal: trusted.signal });
      if (captured.ok) { const session = snapshotSession(trusted.session); requests.set(input.request, { scope: captured.scope, session }); scopeSessions.set(captured.scope, session); scopeRequests.set(captured.scope, input.request); }
      return captured;
    },
    preparedProvider(pluginId, generation) { return preparedProviders.get(generationKey(pluginId, generation)) ?? null; },
    forPluginGeneration(pluginId, generation, lifetime) {
      const identityGeneration: P6rIdentityGeneration = { generation, lifetime, pluginId };
      let lease: ReturnType<P6rInvocationRegistry["activateGeneration"]> | null = null;
      let retired = false;
      const retire = (): void => { if (retired) return; retired = true; notify(generation, { kind: "disposed" }); subscribers.delete(generation); if (generations.get(generation) === identityGeneration) generations.delete(generation); lease?.retire(); root.retireBindings(identityGeneration); const key = generationKey(pluginId, generation); const provider = preparedProviders.get(key); if (provider !== undefined) { preparedProviders.delete(key); root.providerRegistry.retire(provider); } };
      lifetime.addEventListener("abort", retire, { once: true });
      const protocol: P6rRawProtocol = {
        instanceId: root.instanceId,
        version: 1,
        bindInvocation<Args extends readonly unknown[], Output>(input: { readonly handler: (context: ExperimentalP6rInvocationContext<object>, ...args: Args) => Output; readonly routeClass: ExperimentalP6rInvocationRouteClass; }) { return root.bindInvocation({ generation: identityGeneration, handler: input.handler, routeClass: input.routeClass }); },
        session: async (context) => requestState(context)?.session ?? unavailableSession(),
        selfProfile: async (context) => {
          const state = requestState(context);
          if (state === null || state.session.status !== "ready") {
            return {
              ok: false,
              error: failure("unavailable", "No verified identity profile is available"),
            };
          }
          return {
            ok: true,
            value: {
              identity: state.session.actor.identity,
              presentation: state.session.actor.presentation,
              revision: state.session.stamp,
              status: "current",
            },
          };
        },
        openRequest: async (context) => {
          const state = requestState(context);
          if (state === null || state.session.status !== "ready") return { ok: false, error: failure("unauthenticated", "No live ready request is available") };
          const session = state.session;
          return { ok: true, value: {
            scope: state.scope, signal: state.scope.signal, session, release: state.scope.release,
            validate: (expected) => {
              const validity = root.invocationRegistry.validateScope(state.scope);
              if (!validity.ok) return { ok: false, error: failure(validity.code === "expired" ? "expired" : "stale-context", validity.code) };
              return expected.actor === session.actor.identity.key && expected.session === session.stamp
                ? { ok: true, value: undefined }
                : { ok: false, error: failure("stale-context", "Request expectation does not match the captured session") };
            },
          } };
        },
        accept: async (request) => {
          const source = request.source.kind;
          const immutableInput = snapshotInput(request.input);
          const authorEvidence: P6rJson | null = source === "external"
            ? externalEvidence(request.source.author, identityGeneration.pluginId)
            : (() => { const session = scopeSessions.get(request.source.scope); return session?.status === "ready" ? sessionEvidence(session) : null; })();
          if (authorEvidence === null) return { status: "rejected", error: failure("stale-context", "The invocation scope has no captured person identity") };
          const immutableAuthor = snapshotJson(authorEvidence);
          const hash = payloadHash(immutableInput, source, immutableAuthor, root.instanceId, identityGeneration.pluginId);
          const namespace = operationNamespace(root.instanceId, identityGeneration.pluginId);
          const existing = lookupP6rOperationReceipt(root.db, namespace, immutableInput.operationId);
          if (existing !== null && existing.payloadHash !== hash) return { status: "rejected", error: failure("invalid-operation", "Operation identifier was reused with different immutable acceptance data") };
          if (existing !== null) {
            return p6rOutcomeFromStoredReceipt(existing);
          }
          if (generations.get(identityGeneration.generation) !== identityGeneration) return { status: "rejected", error: failure("stale-context", "The plugin generation is no longer active") };
          const validate = (): P6rValidity => {
            if (
              generations.get(identityGeneration.generation) !== identityGeneration ||
              identityGeneration.lifetime.aborted
            ) {
              return { ok: false, code: "retired" };
            }
            return source === "scope"
              ? root.invocationRegistry.validateScope(request.source.scope)
              : { ok: true };
          };
          const validity = validate();
          if (!validity.ok) return { status: "rejected", error: failure(validity.code === "expired" ? "expired" : "stale-context", "The invocation scope is no longer live") };
          if (root.native.accept === undefined) return { status: "rejected", error: failure("unavailable", "Native transactional acceptance is not configured") };
          const outcome = await root.native.accept({ authorEvidence: immutableAuthor, input: immutableInput, operationNamespace: namespace, payloadHash: hash, source, validate });
          if (outcome.status === "submitted") {
            notify(identityGeneration.generation, {
              kind: "participants",
              threadIds: [immutableInput.threadId],
            });
          }
          return outcome;
        },
        lookup: async (operationId) => {
          const receipt = lookupP6rOperationReceipt(root.db, operationNamespace(root.instanceId, identityGeneration.pluginId), operationId);
          if (receipt === null) return { ok: true, value: { status: "absent-final", retry: "same-operation-only" } };
          if (receipt.status === "pending") return { ok: true, value: { status: "pending" } };
          return { ok: true, value: { status: "final", outcome: p6rOutcomeFromStoredReceipt(receipt) } };
        },
        provenance: async (context) => ({ ok: true, value: toolProvenance(root.db, context) }),
        historyContributions: async (query) => {
          if (query.kind === "native-message") {
            return { ok: true, value: { status: "unavailable", reason: "unsupported" } };
          }
          const nativeRequestId = query.kind === "native-event"
            ? findP6rNativeRequestForEvent(root.db, query.threadId, query.eventId)
            : null;
          const records = query.kind === "references"
            ? listP6rContributions(root.db, operationNamespace(root.instanceId, identityGeneration.pluginId), { references: query.references })
            : nativeRequestId === null ? [] : listP6rContributions(root.db, operationNamespace(root.instanceId, identityGeneration.pluginId), { nativeRequestId, threadId: query.threadId });
          if (query.kind === "native-event" && nativeRequestId === null) {
            return { ok: true, value: { status: "unavailable", reason: "missing-history" } };
          }
          const entries = records.map(contribution);
          const revision = getP6rHistoryRevision(root.db);
          const fingerprint = queryFingerprint(query.kind === "references" ? { kind: query.kind, references: query.references } : { eventId: query.eventId, kind: query.kind, threadId: query.threadId });
          const page = historyPage(entries, query, fingerprint, revision);
          if (!page.ok) return page;
          const found = new Set(entries.map((entry) => `${entry.reference.threadId}\u0000${entry.reference.contributionId}`));
          const missing = query.kind === "references"
            ? query.references.filter((reference) => !found.has(`${reference.threadId}\u0000${reference.contributionId}`)).map((reference) => `${reference.threadId}:${reference.contributionId}`)
            : [];
          return { ok: true, value: { status: missing.length === 0 ? "known" : "partial", items: page.value.items, missing, nextCursor: page.value.nextCursor, traversal: page.value.nextCursor === null ? "complete" : "continued" } };
        },
        historyAttempts: async (query) => {
          if (query.kind === "operation" && lookupP6rOperationReceipt(root.db, operationNamespace(root.instanceId, identityGeneration.pluginId), query.operationId) === null) {
            return { ok: true, value: { status: "unavailable", reason: "missing-history" } };
          }
          const attempts = listP6rAttempts(root.db, operationNamespace(root.instanceId, identityGeneration.pluginId), query.kind === "operation" ? { operationId: query.operationId } : { contributionId: query.reference.contributionId });
          const entries = attempts.map((attempt) => attemptProvenance(root.db, attempt));
          const revision = getP6rHistoryRevision(root.db);
          const fingerprint = queryFingerprint(query.kind === "operation" ? { kind: query.kind, operationId: query.operationId } : { kind: query.kind, reference: query.reference });
          const page = historyPage(entries, query, fingerprint, revision);
          if (!page.ok) return page;
          return { ok: true, value: { status: "known", items: page.value.items, missing: [], nextCursor: page.value.nextCursor, traversal: page.value.nextCursor === null ? "complete" : "continued" } };
        },
        directorySources: () => root.providerRegistry.directorySources(),
        participants: async (input) => {
          const records = listP6rContributions(root.db, operationNamespace(root.instanceId, identityGeneration.pluginId), { threadId: input.threadId });
          const entries = new Map<string, { identity: P6rParticipant["identity"]; presentation: P6rProfilePresentation; roles: Set<"author" | "editor"> }>();
          const add = (actor: P6rActorSnapshot | null, role: "author" | "editor") => { if (actor === null) return; const entry = entries.get(actor.identity.key) ?? { identity: actor.identity, presentation: actor.presentation, roles: new Set<"author" | "editor">() }; entry.roles.add(role); entries.set(actor.identity.key, entry); };
          for (const record of records) { const contributionValue = contribution(record); const authored = contributionValue.author.kind === "person" || contributionValue.author.kind === "external" ? contributionValue.author.actor : null; add(authored, "author"); add(contributionValue.latestEditor, "editor"); }
          const roleOrder = ["author", "editor", "mentioned", "interaction-resolver"] as const;
          const values = [...entries.values()].sort((left, right) => left.identity.key.localeCompare(right.identity.key)).map((entry) => ({ identity: entry.identity, presentation: entry.presentation, roles: roleOrder.filter((role) => entry.roles.has(role as "author" | "editor")) }));
          const revision = getP6rHistoryRevision(root.db);
          const page = historyPage(values, input, queryFingerprint({ kind: "participants", threadId: input.threadId }), revision);
          if (!page.ok) return page;
          return { ok: true, value: { coverage: "partial-history", items: page.value.items, nextCursor: page.value.nextCursor, revision } };
        },
        forwardRpc: async (scope, destination, input) => {
          const issued = root.invocationRegistry.resolveScope(scope);
          const session = scopeSessions.get(scope);
          if (
            issued === null ||
            session === undefined ||
            !root.invocationRegistry.validateScope(scope).ok ||
            root.native.forwardRpc === undefined
          ) {
            return { status: "unavailable" };
          }
          return root.native.forwardRpc({
            destination,
            input,
            deriveScope: (destinationGeneration) => {
              const derived = root.invocationRegistry.deriveForwardScope({
                destinationGeneration,
                sourceScope: issued,
              });
              if (!derived.ok) return null;
              const request = Object.freeze({});
              requests.set(request, { scope: derived.scope, session });
              scopeSessions.set(derived.scope, session);
              scopeRequests.set(derived.scope, request);
              return {
                request,
                release: derived.scope.release,
                scope: derived.scope,
              };
            },
          });
        },
        registerProvider: async (provider) => {
          const configuration = root.providerConfiguration(identityGeneration.pluginId);
          if (configuration === null) return { ok: false, error: failure("unavailable", "No operator-selected provider boundary is configured") };
          const key = generationKey(identityGeneration.pluginId, identityGeneration.generation);
          if (preparedProviders.has(key)) return { ok: false, error: failure("invalid-operation", "Only one provider boundary may be staged for this plugin generation") };
          const prepared = await root.providerRegistry.prepare({ configuration, deadlineAt: root.now() + configuration.resolver.timeoutMs, generation: identityGeneration.generation, provider });
          if (!prepared.ok) return prepared;
          preparedProviders.set(key, prepared.value);
          return { ok: true, value: prepared.value.registration };
        },
        subscribe: (listener) => {
          const entries = subscribers.get(generation) ?? new Set();
          entries.add(listener);
          subscribers.set(generation, entries);
          let subscribed = true;
          return () => {
            if (!subscribed) return;
            subscribed = false;
            entries.delete(listener);
            if (entries.size === 0 && subscribers.get(generation) === entries) {
              subscribers.delete(generation);
            }
          };
        },
      };
      return { protocol: Object.freeze(protocol), activate: () => { if (retired || lease !== null) return; lease = root.invocationRegistry.activateGeneration(generation); generations.set(generation, identityGeneration); root.activateBindings(identityGeneration); }, retire };
    },
  };
}
