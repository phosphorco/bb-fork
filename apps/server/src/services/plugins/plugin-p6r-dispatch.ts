import { AsyncLocalStorage } from "node:async_hooks";
import type {
  ExperimentalP6rInvocationContext,
  ExperimentalP6rInvocationRegistration,
  ExperimentalP6rInvocationRouteClass,
} from "@get-bb/plugin-sdk";
import type { P6rIdentityGeneration } from "../p6r/identity-protocol.js";

interface P6rBinding {
  activate(): void;
  readonly generation: P6rIdentityGeneration;
  readonly handler: object;
  readonly registration: ExperimentalP6rInvocationRegistration;
  readonly routeClass: ExperimentalP6rInvocationRouteClass;
  retire(): void;
}

const routeClasses = new Set<ExperimentalP6rInvocationRouteClass>([
  "interactive-session",
  "external-credential",
  "anonymous",
  "plugin-background",
  "agent-tool",
  "local-cli",
]);

function isSameGeneration(
  left: P6rIdentityGeneration,
  right: P6rIdentityGeneration,
): boolean {
  return (
    left.generation === right.generation && left.pluginId === right.pluginId
  );
}

export interface P6rPluginDispatch {
  activateBindings(generation: P6rIdentityGeneration): void;
  bindInvocation<Args extends readonly unknown[], Output>(input: {
    readonly generation: P6rIdentityGeneration;
    readonly handler: (
      context: ExperimentalP6rInvocationContext<object>,
      ...args: Args
    ) => Output;
    readonly routeClass: ExperimentalP6rInvocationRouteClass;
  }): {
    readonly handler: (...args: Args) => Output;
    readonly registration: ExperimentalP6rInvocationRegistration;
  };
  bindingFor(handler: unknown):
    | {
        readonly generation: string;
        readonly pluginId: string;
        readonly routeClass: ExperimentalP6rInvocationRouteClass;
      }
    | undefined;
  retireBindings(generation: P6rIdentityGeneration): void;
  runWithInvocation<Output>(
    handler: unknown,
    context: ExperimentalP6rInvocationContext<object>,
    run: () => Output,
  ): Output;
}

export function createP6rPluginDispatch(): P6rPluginDispatch {
  const contexts = new AsyncLocalStorage<{
    readonly binding: P6rBinding;
    readonly context: ExperimentalP6rInvocationContext<object>;
  }>();
  const bindings = new Map<string, Set<P6rBinding>>();
  const bindingsByHandler = new WeakMap<object, P6rBinding>();

  return {
    activateBindings(generation) {
      const entries = bindings.get(generation.generation);
      if (entries === undefined) return;
      for (const binding of entries) {
        if (!isSameGeneration(binding.generation, generation)) continue;
        binding.activate();
      }
    },

    bindInvocation<Args extends readonly unknown[], Output>(input: {
      readonly generation: P6rIdentityGeneration;
      readonly handler: (
        context: ExperimentalP6rInvocationContext<object>,
        ...args: Args
      ) => Output;
      readonly routeClass: ExperimentalP6rInvocationRouteClass;
    }) {
      if (!routeClasses.has(input.routeClass)) {
        throw new Error(`Unsupported p6r route class: ${input.routeClass}`);
      }
      let status: ExperimentalP6rInvocationRegistration["status"] =
        "staged";
      let binding: P6rBinding | undefined;
      const remove = (): void => {
        if (binding === undefined) return;
        const entries = bindings.get(binding.generation.generation);
        entries?.delete(binding);
        if (entries?.size === 0) bindings.delete(binding.generation.generation);
        bindingsByHandler.delete(binding.handler);
      };
      const registration: ExperimentalP6rInvocationRegistration = {
        generation: input.generation.generation,
        get status() {
          return status;
        },
        dispose() {
          status = "retired";
          remove();
        },
      };
      const handler = (...args: Args): Output => {
        if (status !== "active") {
          throw new Error("P6r invocation binding is unavailable");
        }
        const execution = contexts.getStore();
        if (execution === undefined || execution.binding !== binding) {
          throw new Error("P6r invocation requires host dispatch context");
        }
        if (
          execution.context.scope.signal.aborted ||
          !execution.context.scope.validate().ok
        ) {
          throw new Error("P6r invocation scope is unavailable");
        }
        return input.handler(execution.context, ...args);
      };
      binding = {
        activate() {
          if (status === "staged") status = "active";
        },
        generation: input.generation,
        handler,
        registration,
        routeClass: input.routeClass,
        retire() {
          status = "retired";
        },
      };
      const entries = bindings.get(input.generation.generation) ?? new Set();
      const registeredBinding = binding;
      if (registeredBinding === undefined) {
        throw new Error("P6r invocation binding was not initialized");
      }
      entries.add(registeredBinding);
      bindings.set(input.generation.generation, entries);
      bindingsByHandler.set(handler, registeredBinding);
      return { handler, registration };
    },

    bindingFor(handler) {
      if (typeof handler !== "function") return undefined;
      const binding = bindingsByHandler.get(handler);
      return binding === undefined
        ? undefined
        : {
            generation: binding.generation.generation,
            pluginId: binding.generation.pluginId,
            routeClass: binding.routeClass,
          };
    },

    retireBindings(generation) {
      const entries = bindings.get(generation.generation);
      if (entries === undefined) return;
      for (const binding of entries) {
        if (!isSameGeneration(binding.generation, generation)) continue;
        binding.retire();
        bindingsByHandler.delete(binding.handler);
        entries.delete(binding);
      }
      if (entries.size === 0) bindings.delete(generation.generation);
    },

    runWithInvocation(handler, context, run) {
      const binding =
        (typeof handler === "function" ||
          (typeof handler === "object" && handler !== null))
          ? bindingsByHandler.get(handler)
          : undefined;
      if (binding === undefined || binding.registration.status !== "active") {
        throw new Error("P6r invocation binding is unavailable");
      }
      if (context.scope.signal.aborted || !context.scope.validate().ok) {
        throw new Error("P6r invocation scope is unavailable");
      }
      return contexts.run({ binding, context }, run);
    },
  };
}
