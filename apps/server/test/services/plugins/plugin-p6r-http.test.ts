import { describe, expect, it } from "vitest";
import { createP6rInvocationRegistry } from "../../../src/services/p6r/invocation-registry.js";
import { retainP6rHttpResponse } from "../../../src/services/plugins/plugin-p6r-http.js";

function fixture() {
  const registry = createP6rInvocationRegistry();
  const generation = registry.activateGeneration("http-generation");
  const captured = registry.captureInvocation({
    generation: "http-generation", deadlineAt: Date.now() + 60_000,
    ingress: { requestId: "http-request", transport: "http" }, sessionEpoch: "session",
  });
  if (!captured.ok) throw new Error("Scope fixture failed");
  return { registry, generation, scope: captured.scope };
}

describe("P6r HTTP body lifetime", () => {
  it("retains authority through body consumption and releases at EOF", async () => {
    const { scope } = fixture();
    const response = retainP6rHttpResponse(new Response("body", { headers: { "x-test": "retained" } }), scope);
    expect(scope.validate().ok).toBe(true);
    expect(response.headers.get("x-test")).toBe("retained");
    expect(await response.text()).toBe("body");
    expect(scope.validate().ok).toBe(false);
  });

  it("cancels the producer and releases on client cancellation", async () => {
    const { scope } = fixture();
    let cancelled = false;
    const response = retainP6rHttpResponse(new Response(new ReadableStream({ cancel() { cancelled = true; } })), scope);
    await response.body!.cancel();
    expect(cancelled).toBe(true);
    expect(scope.validate().ok).toBe(false);
  });

  it("retires a held producer without publishing late bytes", async () => {
    const { generation, scope } = fixture();
    let cancelled = false;
    const response = retainP6rHttpResponse(new Response(new ReadableStream({ cancel() { cancelled = true; } })), scope);
    const read = response.body!.getReader().read();
    generation.retire();
    await expect(read).rejects.toThrow("expired");
    expect(cancelled).toBe(true);
  });

  it("releases bodyless responses and producer failures", async () => {
    const first = fixture();
    retainP6rHttpResponse(new Response(null, { status: 204 }), first.scope);
    expect(first.scope.validate().ok).toBe(false);
    const second = fixture();
    const response = retainP6rHttpResponse(new Response(new ReadableStream({ pull() { throw new Error("producer failed"); } })), second.scope);
    await expect(response.text()).rejects.toThrow("producer failed");
    expect(second.scope.validate().ok).toBe(false);
  });
});
