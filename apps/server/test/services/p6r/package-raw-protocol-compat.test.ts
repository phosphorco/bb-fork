import type {
  ExperimentalP6rInvocationContext,
  ExperimentalP6rInvocationRegistration,
  ExperimentalP6rInvocationRouteClass,
  ExperimentalP6rInvocationScope,
} from "@get-bb/plugin-sdk";
import { describe, expect, it } from "vitest";
import type {
  P6rForkIdentityProvider,
  P6rForkProviderRegistration,
  P6rJson,
  P6rRawProtocol,
  P6rToolContext,
} from "../../../src/services/p6r/identity-protocol.js";

type PackageError = {
  readonly code: "ambiguous" | "cancelled" | "conflict" | "disposed" | "expired" | "incompatible" | "invalid-input" | "invalid-operation" | "limit-exceeded" | "not-found" | "stale-context" | "stale-owner" | "unauthenticated" | "unavailable" | "unsupported";
  readonly message: string;
  readonly retry: "after-reconnect" | "after-refresh" | "never" | "same-operation";
};
type PackageResult<Value> = { readonly ok: true; readonly value: Value } | { readonly ok: false; readonly error: PackageError };
type PackagePresentation = { readonly avatarUrl: string | null; readonly displayName: string; readonly handle: string | null };
type PackagePerson = { readonly issuer: string; readonly key: string; readonly kind: "person"; readonly subject: string };
type PackageExternalIdentity = { readonly key: string; readonly kind: "external"; readonly pluginId: string; readonly subject: string };
type PackageIdentity = PackagePerson | PackageExternalIdentity;
type PackageCapabilities = {
  readonly acceptance: "pre-dispatch-check" | "transactional-check";
  readonly directory: { readonly lookup: boolean; readonly search: boolean };
  readonly externalSend: "source-labelled" | "structured";
  readonly forwarding: "host-bound" | "singleton-convention";
  readonly operationLookup: boolean;
  readonly participants: boolean;
  readonly requestIdentity: "host-resolved" | "singleton";
  readonly toolProvenance: "causal" | "partial" | "unknown";
};
type PackageSession = {
  readonly actor: { readonly evidence: "integration-asserted" | "legacy" | "local-user" | "provider-verified" | "upstream-default"; readonly identity: PackagePerson; readonly presentation: PackagePresentation };
  readonly capabilities: PackageCapabilities;
  readonly instanceId: string;
  readonly mode: "multi-user" | "single-user";
  readonly stamp: string;
  readonly status: "ready";
} | { readonly error: PackageError; readonly instanceId: string; readonly status: "incompatible" | "unauthenticated" | "unavailable" };
type PackageExpectation = { readonly actor: string; readonly session: string };
type PackageProfile = { readonly identity: PackagePerson; readonly presentation: PackagePresentation; readonly revision: string; readonly status: "current" | "historical" };
type PackageSendInput = { readonly input: readonly P6rJson[]; readonly mode: "queue-if-active" | "start" | "steer-if-active"; readonly operationId: string; readonly threadId: string };
type PackageReceipt = { readonly acceptedAt: string; readonly deduplication: "guaranteed"; readonly evidence: "host-accepted"; readonly native: { readonly deliveryId: string | null; readonly queuedMessageId: string | null; readonly turnId: string | null }; readonly operationId: string; readonly provenance: "structured"; readonly references: readonly { readonly contributionId: string; readonly threadId: string }[]; readonly retainedUntil: string };
type PackageAcceptance = { readonly receipt: PackageReceipt; readonly status: "submitted" } | { readonly error: PackageError; readonly status: "rejected" } | { readonly message: string; readonly operationId: string; readonly status: "indeterminate" };
type PackageLookup = { readonly outcome: PackageAcceptance; readonly status: "final" } | { readonly status: "pending" } | { readonly retry: "same-operation-only"; readonly status: "absent-final" } | { readonly reason: "expired" | "unavailable" | "unsupported"; readonly status: "unknown" };
type PackageRequest = { readonly release: () => void; readonly scope: ExperimentalP6rInvocationScope; readonly session: Extract<PackageSession, { readonly status: "ready" }>; readonly signal: AbortSignal; readonly validate: (expected: PackageExpectation) => PackageResult<void> };
type PackageExternalAuthor = { readonly presentation: PackagePresentation; readonly subject: string };
type PackageReference = { readonly contributionId: string; readonly threadId: string };
type PackageActor = { readonly evidence: "integration-asserted" | "legacy" | "local-user" | "provider-verified" | "upstream-default"; readonly identity: PackageIdentity; readonly presentation: PackagePresentation };
type PackagePersonActor = PackageActor & { readonly identity: PackagePerson };
type PackageExternalActor = PackageActor & { readonly identity: PackageExternalIdentity };
type PackageOrigin = { readonly actor: PackagePersonActor; readonly kind: "person" } | { readonly actor: PackageExternalActor; readonly kind: "external" } | { readonly agentId: string | null; readonly kind: "agent" } | { readonly kind: "system"; readonly reason: string } | { readonly kind: "unknown"; readonly reason: "legacy" | "missing-source" | "upstream-unattributed" };
type PackageContribution = { readonly acceptedAt: string; readonly author: PackageOrigin; readonly latestEditor: PackageActor | null; readonly mentionedPeople: readonly PackagePerson[]; readonly reference: PackageReference };
type PackageEvidencePage<Value> = { readonly items: readonly Value[]; readonly missing: readonly string[]; readonly nextCursor: string | null; readonly status: "known" | "partial"; readonly traversal: "complete" | "continued" } | { readonly status: "pending" } | { readonly reason: "missing-history" | "outage" | "unsupported"; readonly status: "unavailable" };
type PackageContributionQuery = ({ readonly kind: "references"; readonly references: readonly PackageReference[] } | { readonly kind: "native-message"; readonly messageId: string; readonly threadId: string } | { readonly eventId: string; readonly kind: "native-event"; readonly threadId: string }) & { readonly cursor?: string; readonly limit?: number };
type PackageAttemptQuery = ({ readonly kind: "operation"; readonly operationId: string } | { readonly kind: "contribution"; readonly reference: PackageReference }) & { readonly cursor?: string; readonly limit?: number };
type PackageCorrelation = { readonly attemptId: string; readonly threadId: string; readonly toolCallId: string | null; readonly turnId: string };
type PackageAttemptInputSource = { readonly kind: "contribution"; readonly reference: PackageReference } | { readonly interactionId: string; readonly kind: "interaction"; readonly resolver: PackageOrigin } | { readonly basedOn: readonly PackageReference[]; readonly kind: "generated"; readonly purpose: "continuation" | "resolved-resource" | "system-context" };
type PackageExecutionProvenance = { readonly correlation: PackageCorrelation; readonly contributions: readonly PackageContribution[]; readonly inputGroups: readonly { readonly sources: readonly PackageAttemptInputSource[] }[]; readonly status: "known" } | { readonly correlation: PackageCorrelation | null; readonly contributions: readonly PackageContribution[]; readonly inputGroups: readonly { readonly sources: readonly PackageAttemptInputSource[] }[]; readonly missing: readonly PackageReference[]; readonly reason: string; readonly status: "partial" } | { readonly correlation: PackageCorrelation | null; readonly reason: string; readonly status: "unknown" };
type PackageParticipantQuery = { readonly cursor?: string; readonly limit: number; readonly threadId: string };
type PackageParticipant = { readonly identity: PackageIdentity; readonly presentation: PackagePresentation; readonly roles: readonly ("author" | "editor" | "interaction-resolver" | "mentioned")[] };
type PackageParticipantPage = { readonly coverage: "complete-history" | "partial-history"; readonly items: readonly PackageParticipant[]; readonly nextCursor: string | null; readonly revision: string };
type PackageConfiguration = { readonly boundaryId: string; readonly credentials: readonly { readonly field: string; readonly name: string; readonly source: "cookie" | "header" }[]; readonly ingressIds: readonly string[]; readonly pluginId: string; readonly resolver: { readonly maxSessionAgeMs: number; readonly timeoutMs: number }; readonly version: 1 };
type PackageProviderEvidence = { readonly configuration: PackageConfiguration; readonly credentials: readonly { readonly name: string; readonly value: string }[]; readonly deadlineAt: number; readonly ingress: { readonly authenticatedPeer: string | null; readonly id: string | null; readonly kind: "local" | "owned-proxy" | "unverified" }; readonly request: { readonly authority: string; readonly method: string; readonly pathname: string; readonly receivedAt: number; readonly transport: "http" | "websocket" }; readonly signal: AbortSignal; readonly version: 1 };
type PackageProvider = { readonly issuers: readonly string[]; readonly resolve: (evidence: PackageProviderEvidence) => Promise<{ readonly issuer: string; readonly presentation: PackagePresentation; readonly status: "resolved"; readonly subject: string; readonly validUntil: number } | { readonly status: "not-applicable" } | { readonly reason: string; readonly status: "rejected" | "unavailable" }>; readonly validateReadiness?: (input: { readonly configuration: PackageConfiguration; readonly deadlineAt: number; readonly generation: string; readonly signal: AbortSignal }) => Promise<PackageResult<void>> };
type PackageRegistration = { readonly configuration: PackageConfiguration; readonly dispose: () => void; readonly generation: string; readonly getStatus: () => "active" | "retired" | "staged"; readonly invalidate: (change: { readonly kind: "authentication"; readonly subjects?: readonly { readonly issuer: string; readonly subject: string }[] } | { readonly kind: "directory"; readonly revision: string }) => PackageResult<void>; readonly person: (issuer: string, subject: string) => PackageResult<PackagePerson>; readonly signal: AbortSignal; readonly subscribe: (listener: (status: "active" | "retired" | "staged") => void) => () => void };
type PackageDirectorySource = { readonly generation: string; readonly issuers: readonly string[]; readonly person: (issuer: string, subject: string) => PackageResult<PackagePerson> };
type PackageInvalidation = { readonly kind: "session"; readonly reason: "actor" | "capabilities" | "provider" } | { readonly keys: readonly string[]; readonly kind: "directory" } | { readonly kind: "disposed" | "disconnected" | "reconnected" } | { readonly kind: "participants"; readonly threadIds: readonly string[] };
type PackageProtocol = {
  /** Core-owned persisted instance namespace; never inferred from a session. */
  readonly instanceId: string;
  readonly bindInvocation: <Args extends readonly unknown[], Output>(input: { readonly handler: (context: ExperimentalP6rInvocationContext<object>, ...args: Args) => Output; readonly routeClass: ExperimentalP6rInvocationRouteClass }) => { readonly handler: (...args: Args) => Output; readonly registration: ExperimentalP6rInvocationRegistration };
  readonly accept: (input: { readonly input: PackageSendInput; readonly source: { readonly kind: "scope"; readonly scope: ExperimentalP6rInvocationScope } | { readonly author: PackageExternalAuthor; readonly kind: "external" } }) => Promise<PackageAcceptance>;
  readonly directorySources: () => readonly PackageDirectorySource[];
  readonly forwardRpc: (scope: ExperimentalP6rInvocationScope, destination: { readonly method: string; readonly pluginId: string }, input: P6rJson) => Promise<P6rJson>;
  readonly historyAttempts: (query: PackageAttemptQuery) => Promise<PackageResult<PackageEvidencePage<PackageExecutionProvenance>>>;
  readonly historyContributions: (query: PackageContributionQuery) => Promise<PackageResult<PackageEvidencePage<PackageContribution>>>;
  readonly lookup: (operationId: string) => Promise<PackageResult<PackageLookup>>;
  readonly openRequest: (context: object) => Promise<PackageResult<PackageRequest>>;
  readonly participants: (input: PackageParticipantQuery) => Promise<PackageResult<PackageParticipantPage>>;
  readonly provenance: (context: P6rToolContext) => Promise<PackageResult<PackageExecutionProvenance>>;
  readonly registerProvider: (provider: PackageProvider) => Promise<PackageResult<PackageRegistration>>;
  readonly selfProfile: (context: object) => Promise<PackageResult<PackageProfile>>;
  readonly session: (context: object) => Promise<PackageSession>;
  readonly subscribe: (listener: (event: PackageInvalidation) => void) => () => void;
};

declare const actual: P6rRawProtocol;
declare const actualProvider: P6rForkIdentityProvider;
declare const actualRegistration: P6rForkProviderRegistration;

const compileOnly = () => {
const session: PackageProtocol["session"] = actual.session;
const instanceId: PackageProtocol["instanceId"] = actual.instanceId;
const selfProfile: PackageProtocol["selfProfile"] = actual.selfProfile;
const openRequest: PackageProtocol["openRequest"] = actual.openRequest;
const accept: PackageProtocol["accept"] = actual.accept;
const lookup: PackageProtocol["lookup"] = actual.lookup;
const provenance: PackageProtocol["provenance"] = actual.provenance;
const bindInvocation: PackageProtocol["bindInvocation"] = actual.bindInvocation;
const historyContributions: PackageProtocol["historyContributions"] = actual.historyContributions;
const historyAttempts: PackageProtocol["historyAttempts"] = actual.historyAttempts;
const directorySources: PackageProtocol["directorySources"] = actual.directorySources;
const participants: PackageProtocol["participants"] = actual.participants;
const forwardRpc: PackageProtocol["forwardRpc"] = actual.forwardRpc;
const registerProvider: PackageProtocol["registerProvider"] = actual.registerProvider;
const subscribe: PackageProtocol["subscribe"] = actual.subscribe;
const provider: PackageProvider = actualProvider;
const registration: PackageRegistration = actualRegistration;

void session;
void instanceId;
void selfProfile;
void openRequest;
void accept;
void lookup;
void provenance;
void bindInvocation;
void historyContributions;
void historyAttempts;
void directorySources;
void participants;
void forwardRpc;
void registerProvider;
void subscribe;
void provider;
void registration;
};

void compileOnly;

describe("package raw protocol compatibility", () => {
  it("typechecks the independently mirrored complete surface", () => {
    expect(true).toBe(true);
  });
});
