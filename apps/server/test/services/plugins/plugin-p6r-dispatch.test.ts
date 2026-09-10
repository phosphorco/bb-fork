import { describe, expect, it } from "vitest";
import { createP6rPluginDispatch } from "../../../src/services/plugins/plugin-p6r-dispatch.js";

describe("p6r plugin dispatch", () => {
  it("admits only an active bound handler through the same host-issued scope", () => {
    const dispatch = createP6rPluginDispatch();
    const lifetime = new AbortController();
    const scope = {
      expiresAt: 1_000,
      release: () => undefined,
      signal: lifetime.signal,
      validate: () => ({ ok: true as const }),
    };
    const binding = dispatch.bindInvocation({
      generation: {
        generation: "generation-1",
        lifetime: lifetime.signal,
        pluginId: "plugin",
      },
      handler: (context, input: string) => ({ input, scope: context.scope }),
      routeClass: "interactive-session",
    });

    expect(binding.registration.status).toBe("staged");
    expect(() => binding.handler("before-activate")).toThrow(
      "P6r invocation binding is unavailable",
    );

    dispatch.activateBindings({
      generation: "generation-1",
      lifetime: lifetime.signal,
      pluginId: "plugin",
    });
    const result = dispatch.runWithInvocation(
      binding.handler,
      { request: { requestId: "request-1" }, scope },
      () => binding.handler("accepted"),
    );

    expect(binding.registration.status).toBe("active");
    expect(result).toEqual({ input: "accepted", scope });
    expect(result.scope).toBe(scope);
    expect(dispatch.bindingFor(binding.handler)).toEqual({
      generation: "generation-1",
      pluginId: "plugin",
      routeClass: "interactive-session",
    });

    dispatch.retireBindings({
      generation: "generation-1",
      lifetime: lifetime.signal,
      pluginId: "plugin",
    });
    expect(binding.registration.status).toBe("retired");
    expect(dispatch.bindingFor(binding.handler)).toBeUndefined();
  });

  it("does not let one active binding invoke another with its scope", () => {
    const dispatch = createP6rPluginDispatch();
    const lifetime = new AbortController();
    const generation = {
      generation: "generation-1",
      lifetime: lifetime.signal,
      pluginId: "plugin",
    };
    const scope = {
      expiresAt: 1_000,
      release: () => undefined,
      signal: lifetime.signal,
      validate: () => ({ ok: true as const }),
    };
    const second = dispatch.bindInvocation({
      generation,
      handler: () => "second",
      routeClass: "external-credential",
    });
    const first = dispatch.bindInvocation({
      generation,
      handler: () => second.handler(),
      routeClass: "interactive-session",
    });
    dispatch.activateBindings(generation);

    expect(() =>
      dispatch.runWithInvocation(first.handler, { request: {}, scope }, () =>
        first.handler(),
      ),
    ).toThrow("P6r invocation requires host dispatch context");
  });

  it("keeps overlapping handler scopes isolated and removes one disposed binding", async () => {
    const dispatch = createP6rPluginDispatch();
    const generation = {
      generation: "generation-1",
      lifetime: new AbortController().signal,
      pluginId: "plugin",
    };
    const createScope = (requestId: string) => ({
      expiresAt: 1_000,
      release: () => undefined,
      signal: new AbortController().signal,
      validate: () => ({ ok: true as const }),
      requestId,
    });
    const first = dispatch.bindInvocation({
      generation,
      handler: async (context) => {
        await Promise.resolve();
        return context.request;
      },
      routeClass: "interactive-session",
    });
    const second = dispatch.bindInvocation({
      generation,
      handler: async (context) => {
        await Promise.resolve();
        return context.request;
      },
      routeClass: "external-credential",
    });
    dispatch.activateBindings(generation);
    const firstScope = createScope("first");
    const secondScope = createScope("second");

    await expect(
      Promise.all([
        dispatch.runWithInvocation(
          first.handler,
          { request: { id: "first" }, scope: firstScope },
          () => first.handler(),
        ),
        dispatch.runWithInvocation(
          second.handler,
          { request: { id: "second" }, scope: secondScope },
          () => second.handler(),
        ),
      ]),
    ).resolves.toEqual([{ id: "first" }, { id: "second" }]);

    first.registration.dispose();
    expect(dispatch.bindingFor(first.handler)).toBeUndefined();
    expect(dispatch.bindingFor(second.handler)).toEqual({
      generation: "generation-1",
      pluginId: "plugin",
      routeClass: "external-credential",
    });
  });

  it("rejects an aborted or invalid scope before entering a handler", () => {
    const dispatch = createP6rPluginDispatch();
    const controller = new AbortController();
    const generation = {
      generation: "generation-1",
      lifetime: controller.signal,
      pluginId: "plugin",
    };
    const binding = dispatch.bindInvocation({
      generation,
      handler: () => "unreachable",
      routeClass: "interactive-session",
    });
    dispatch.activateBindings(generation);
    controller.abort();

    expect(() =>
      dispatch.runWithInvocation(
        binding.handler,
        {
          request: {},
          scope: {
            expiresAt: 1_000,
            release: () => undefined,
            signal: controller.signal,
            validate: () => ({ ok: false as const, code: "invalidated" }),
          },
        },
        () => binding.handler(),
      ),
    ).toThrow("P6r invocation scope is unavailable");
  });
});
