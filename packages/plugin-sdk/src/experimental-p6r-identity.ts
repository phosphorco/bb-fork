/**
 * Experimental host-owned identity extension primitives.
 *
 * Product packages own identity, acceptance, provenance, and directory
 * models. This module intentionally defines only the generic host boundary.
 */

export type ExperimentalP6rInvocationRouteClass =
  | "interactive-session"
  | "external-credential"
  | "anonymous"
  | "plugin-background"
  | "agent-tool"
  | "local-cli";

export type ExperimentalP6rInvocationValidity =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code: "expired" | "invalidated" | "retired";
    };

/** A fresh, host-issued request lease; a plugin cannot construct one. */
export interface ExperimentalP6rInvocationScope {
  readonly expiresAt: number;
  readonly signal: AbortSignal;
  release(): void;
  validate(): ExperimentalP6rInvocationValidity;
}

/** The host supplies this context only to a handler returned by bindInvocation. */
export interface ExperimentalP6rInvocationContext<RequestContext = unknown> {
  readonly request: RequestContext;
  readonly scope: ExperimentalP6rInvocationScope;
}

/** A generation-bound registration owned by the host lifecycle. */
export interface ExperimentalP6rInvocationRegistration {
  readonly generation: string;
  readonly status: "staged" | "active" | "retired";
  dispose(): void;
}

export interface ExperimentalP6rRequestHandle<
  Session = unknown,
  Validation = unknown,
  ExpectedValidation = unknown,
> {
  readonly signal: AbortSignal;
  readonly session: Session;
  release(): void;
  validate(expected: ExpectedValidation): Validation;
}

/** Enhanced hosts attach the original host-issued scope to this request handle. */
export interface ExperimentalP6rForkRequestHandle<
  Session = unknown,
  Validation = unknown,
  ExpectedValidation = unknown,
> extends ExperimentalP6rRequestHandle<
  Session,
  Validation,
  ExpectedValidation
> {
  readonly scope: ExperimentalP6rInvocationScope;
}

export type ExperimentalP6rResult<Value, Failure = unknown> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: Failure };

export type ExperimentalP6rAcceptanceSource<ExternalAuthor = unknown> =
  | { readonly kind: "scope"; readonly scope: ExperimentalP6rInvocationScope }
  | { readonly kind: "external"; readonly author: ExternalAuthor };

export interface ExperimentalP6rAcceptanceRequest<
  Input = unknown,
  ExternalAuthor = unknown,
> {
  readonly input: Input;
  readonly source: ExperimentalP6rAcceptanceSource<ExternalAuthor>;
}

export interface ExperimentalP6rProviderRegistration<
  Configuration = unknown,
  InvalidationChange = unknown,
  InvalidationResult = unknown,
  PersonResult = unknown,
  Subscription = () => void,
> {
  readonly configuration: Configuration;
  readonly generation: string;
  readonly signal: AbortSignal;
  dispose(): void;
  getStatus(): "staged" | "active" | "retired";
  invalidate(change: InvalidationChange): InvalidationResult;
  person(issuer: string, subject: string): PersonResult;
  subscribe(
    listener: (status: "staged" | "active" | "retired") => void,
  ): Subscription;
}

/**
 * Structural enhanced-host protocol. Product packages validate and narrow
 * its opaque product values when they discover this optional capability.
 */
export interface ExperimentalP6rIdentityProtocol<
  RequestContext = unknown,
  ToolContext = unknown,
  Input = unknown,
  ExternalAuthor = unknown,
  SessionResult = unknown,
  SelfProfileResult = unknown,
  RequestSession = unknown,
  RequestValidation = unknown,
  RequestValidationExpected = unknown,
  ResultFailure = unknown,
  AcceptanceResult = unknown,
  LookupResult = unknown,
  ProvenanceResult = unknown,
  ContributionsQuery = unknown,
  ContributionsResult = unknown,
  AttemptsQuery = unknown,
  AttemptsResult = unknown,
  DirectorySource = unknown,
  ParticipantsInput = unknown,
  ParticipantsResult = unknown,
  ForwardInput = unknown,
  Provider = unknown,
  ProviderRegistration = ExperimentalP6rProviderRegistration,
  Event = unknown,
  Subscription = () => void,
  ReadOptions = unknown,
  ForwardResult = unknown,
> {
  readonly instanceId: string;
  readonly version: 1;
  bindInvocation<Args extends readonly unknown[], Output>(input: {
    readonly handler: (
      context: ExperimentalP6rInvocationContext<RequestContext>,
      ...args: Args
    ) => Output;
    readonly routeClass: ExperimentalP6rInvocationRouteClass;
  }): {
    readonly handler: (...args: Args) => Output;
    readonly registration: ExperimentalP6rInvocationRegistration;
  };
  session(context: RequestContext): Promise<SessionResult>;
  selfProfile(
    context: RequestContext,
    options?: ReadOptions,
  ): Promise<SelfProfileResult>;
  openRequest(
    context: RequestContext,
  ): Promise<
    ExperimentalP6rResult<
      ExperimentalP6rForkRequestHandle<
        RequestSession,
        RequestValidation,
        RequestValidationExpected
      >,
      ResultFailure
    >
  >;
  accept(
    input: ExperimentalP6rAcceptanceRequest<Input, ExternalAuthor>,
    options?: ReadOptions,
  ): Promise<AcceptanceResult>;
  lookup(operationId: string, options?: ReadOptions): Promise<LookupResult>;
  provenance(context: ToolContext): Promise<ProvenanceResult>;
  historyContributions(
    query: ContributionsQuery,
    options?: ReadOptions,
  ): Promise<ContributionsResult>;
  historyAttempts(
    query: AttemptsQuery,
    options?: ReadOptions,
  ): Promise<AttemptsResult>;
  directorySources(): readonly DirectorySource[];
  participants(
    input: ParticipantsInput,
    options?: ReadOptions,
  ): Promise<ParticipantsResult>;
  forwardRpc(
    scope: ExperimentalP6rInvocationScope,
    destination: { readonly method: string; readonly pluginId: string },
    input: ForwardInput,
  ): Promise<ForwardResult>;
  registerProvider(
    provider: Provider,
  ): Promise<ExperimentalP6rResult<ProviderRegistration, ResultFailure>>;
  subscribe(listener: (event: Event) => void): Subscription;
}
