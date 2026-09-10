export type P6rInvocationTransport =
  | "agent-tool"
  | "http"
  | "rpc"
  | "websocket";

export interface P6rInvocationIngress {
  readonly requestId: string;
  readonly transport: P6rInvocationTransport;
}

export type P6rValidity =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code: "expired" | "invalidated" | "retired";
    };

export type P6rForwardValidity =
  | P6rValidity
  | { readonly ok: false; readonly code: "destination-retired" };

export interface P6rInvocationScope {
  readonly expiresAt: number;
  readonly generation: string;
  readonly ingress: P6rInvocationIngress;
  readonly sessionEpoch: string;
  readonly signal: AbortSignal;
  release(): void;
  validate(): P6rValidity;
}

export interface P6rGenerationLease {
  readonly generation: string;
  retire(): void;
}

export type P6rCaptureResult =
  | { readonly ok: true; readonly scope: P6rInvocationScope }
  | { readonly ok: false; readonly code: "retired" };

export interface P6rInvocationRegistry {
  activateGeneration(generation: string): P6rGenerationLease;
  captureInvocation(input: {
    readonly deadlineAt: number;
    readonly generation: string;
    readonly ingress: P6rInvocationIngress;
    readonly sessionEpoch: string;
    readonly signal?: AbortSignal;
  }): P6rCaptureResult;
  deriveForwardScope(input: {
    readonly destinationGeneration: string;
    readonly sourceScope: P6rInvocationScope;
  }): P6rCaptureResult;
  invalidateSession(input: {
    readonly generation: string;
    readonly sessionEpoch: string;
  }): void;
  resolveScope(scope: object): P6rInvocationScope | null;
  validateScope(scope: object): P6rValidity;
  validateForward(input: {
    readonly destinationGeneration: string;
    readonly scope: P6rInvocationScope;
  }): P6rForwardValidity;
}

interface ActiveGeneration {
  readonly generation: string;
  readonly scopes: Set<InvocationScopeState>;
  retired: boolean;
}

interface InvocationScopeState {
  readonly controller: AbortController;
  readonly deadlineAt: number;
  readonly generation: ActiveGeneration;
  readonly ingress: P6rInvocationIngress;
  readonly origin: InvocationScopeState | undefined;
  readonly parentSignal: AbortSignal | undefined;
  readonly sessionEpoch: string;
  invalidate(code: Extract<P6rValidity, { readonly ok: false }>['code']): void;
  released: boolean;
  reason: Extract<P6rValidity, { readonly ok: false }>['code'] | undefined;
}

function invalid(
  code: Extract<P6rValidity, { readonly ok: false }>['code'],
): P6rValidity {
  return { ok: false, code };
}

export function createP6rInvocationRegistry(input?: {
  readonly now?: () => number;
}): P6rInvocationRegistry {
  const now = input?.now ?? Date.now;
  const generations = new Map<string, ActiveGeneration>();
  const scopeStates = new WeakMap<object, InvocationScopeState>();
  const issuedScopes = new WeakMap<object, P6rInvocationScope>();

  function validate(state: InvocationScopeState): P6rValidity {
    if (state.origin !== undefined) {
      const originValidity = validate(state.origin);
      if (!originValidity.ok) return originValidity;
    }
    if (state.released) return invalid("invalidated");
    if (state.generation.retired) return invalid("retired");
    if (now() >= state.deadlineAt) return invalid("expired");
    if (state.controller.signal.aborted) {
      return invalid(state.reason ?? "invalidated");
    }
    return { ok: true };
  }

  function retire(generation: ActiveGeneration): void {
    if (generation.retired) return;
    generation.retired = true;
    if (generations.get(generation.generation) === generation) {
      generations.delete(generation.generation);
    }
    for (const scope of [...generation.scopes]) scope.invalidate("retired");
  }

  function issueScope(state: InvocationScopeState): P6rInvocationScope {
    const generation = state.generation;
    const release = (): void => {
      if (state.released) return;
      state.released = true;
      state.parentSignal?.removeEventListener("abort", onParentAbort);
      generation.scopes.delete(state);
      state.invalidate("invalidated");
    };
    const onParentAbort = (): void => state.invalidate("invalidated");
    state.parentSignal?.addEventListener("abort", onParentAbort, { once: true });
    if (state.parentSignal?.aborted) onParentAbort();
    generation.scopes.add(state);
    const scope: P6rInvocationScope = {
      expiresAt: state.deadlineAt,
      generation: generation.generation,
      ingress: state.ingress,
      sessionEpoch: state.sessionEpoch,
      signal: state.controller.signal,
      release,
      validate: () => validate(state),
    };
    scopeStates.set(scope, state);
    issuedScopes.set(scope, scope);
    return scope;
  }

  return {
    activateGeneration(generation) {
      const existing = generations.get(generation);
      if (existing !== undefined) {
        throw new Error(`P6r generation "${generation}" is already active`);
      }
      const active: ActiveGeneration = {
        generation,
        scopes: new Set<InvocationScopeState>(),
        retired: false,
      };
      generations.set(generation, active);
      return { generation, retire: () => retire(active) };
    },

    captureInvocation(input) {
      const generation = generations.get(input.generation);
      if (generation === undefined || generation.retired) {
        return { ok: false, code: "retired" };
      }
      const controller = new AbortController();
      const state: InvocationScopeState = {
        controller,
        deadlineAt: input.deadlineAt,
        generation,
        ingress: input.ingress,
        origin: undefined,
        parentSignal: input.signal,
        sessionEpoch: input.sessionEpoch,
        released: false,
        reason: undefined,
        invalidate(code) {
          if (this.reason !== undefined) return;
          this.reason = code;
          this.controller.abort();
        },
      };
      return { ok: true, scope: issueScope(state) };
    },

    deriveForwardScope(input) {
      const origin = scopeStates.get(input.sourceScope);
      const destination = generations.get(input.destinationGeneration);
      if (
        origin === undefined ||
        !validate(origin).ok ||
        destination === undefined ||
        destination.retired
      ) {
        return { ok: false, code: "retired" };
      }
      const controller = new AbortController();
      const state: InvocationScopeState = {
        controller,
        deadlineAt: origin.deadlineAt,
        generation: destination,
        ingress: origin.ingress,
        origin,
        parentSignal: input.sourceScope.signal,
        sessionEpoch: origin.sessionEpoch,
        released: false,
        reason: undefined,
        invalidate(code) {
          if (this.reason !== undefined) return;
          this.reason = code;
          this.controller.abort();
        },
      };
      return { ok: true, scope: issueScope(state) };
    },

    invalidateSession(input) {
      const generation = generations.get(input.generation);
      if (generation === undefined || generation.retired) return;
      for (const scope of generation.scopes) {
        if (scope.sessionEpoch === input.sessionEpoch) {
          scope.invalidate("invalidated");
        }
      }
    },

    resolveScope(scope) {
      return issuedScopes.get(scope) ?? null;
    },

    validateScope(scope) {
      const state = scopeStates.get(scope);
      return state === undefined ? invalid("invalidated") : validate(state);
    },

    validateForward(input) {
      const state = scopeStates.get(input.scope);
      if (state === undefined) return invalid("invalidated");
      const scopeValid = validate(state);
      if (!scopeValid.ok) return scopeValid;
      const destination = generations.get(input.destinationGeneration);
      if (destination === undefined || destination.retired) {
        return { ok: false, code: "destination-retired" };
      }
      return { ok: true };
    },
  };
}
