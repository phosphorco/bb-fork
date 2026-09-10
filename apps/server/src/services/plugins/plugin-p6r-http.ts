import type { P6rInvocationScope } from "../p6r/invocation-registry.js";

export function retainP6rHttpResponse(response: Response, scope: P6rInvocationScope): Response {
  if (response.body === null) {
    scope.release();
    return response;
  }
  const reader = response.body.getReader();
  let settled = false;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let streamController: ReadableStreamDefaultController<Uint8Array>;
  const finish = () => {
    if (settled) return;
    settled = true;
    clearTimeout(deadline);
    scope.signal.removeEventListener("abort", abort);
    scope.release();
  };
  const abort = () => {
    if (settled) return;
    finish();
    streamController.error(new Error("Identity HTTP invocation expired"));
    void reader.cancel().catch(() => undefined);
  };
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
      scope.signal.addEventListener("abort", abort, { once: true });
      if (scope.signal.aborted) abort();
    },
    async pull(controller) {
      if (settled) return;
      try {
        const item = await reader.read();
        if (settled) return;
        if (!scope.validate().ok) { abort(); return; }
        if (item.done) {
          finish();
          controller.close();
        } else {
          controller.enqueue(item.value);
        }
      } catch (cause) {
        if (settled) return;
        finish();
        controller.error(cause);
      }
    },
    cancel(reason) {
      finish();
      return reader.cancel(reason);
    },
  });
  if (!settled) deadline = setTimeout(abort, Math.max(0, Math.min(2_147_483_647, scope.expiresAt - Date.now())));
  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
}
