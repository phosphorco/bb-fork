const STALE_CHUNK_RELOAD_KEY = "bb.staleChunkReloadAt";
const STALE_CHUNK_RELOAD_COOLDOWN_MS = 30_000;

/**
 * Browsers keep an already-open SPA on its old JavaScript graph while a
 * deployment replaces immutable hashed assets. If a later `import()` asks for
 * one of those removed chunks, React.lazy rejects and the error boundary would
 * otherwise turn a recoverable stale tab into a stopped app.
 */
export function p6rIsDynamicImportError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed/iu.test(
      error.message,
    )
  );
}

interface ChunkLoadRecoveryEnvironment {
  now?: () => number;
  reload?: () => void;
  storage?: Pick<Storage, "getItem" | "setItem">;
}

/**
 * Reload once for a stale dynamic chunk. The cooldown prevents a deployment
 * that is still missing the asset from causing an infinite reload loop.
 * Returns true only when this call claimed the reload attempt.
 */
export function p6rRecoverFromStaleDynamicImport(
  error: unknown,
  environment: ChunkLoadRecoveryEnvironment = {},
): boolean {
  if (!p6rIsDynamicImportError(error)) return false;

  const now = environment.now ?? Date.now;
  const reload = environment.reload ?? (() => window.location.reload());
  let storage: Pick<Storage, "getItem" | "setItem">;
  try {
    storage = environment.storage ?? window.sessionStorage;
    const lastAttemptRaw = storage.getItem(STALE_CHUNK_RELOAD_KEY);
    const lastAttempt =
      lastAttemptRaw === null ? null : Number(lastAttemptRaw);
    if (
      lastAttempt !== null &&
      Number.isFinite(lastAttempt) &&
      now() - lastAttempt < STALE_CHUNK_RELOAD_COOLDOWN_MS
    ) {
      return false;
    }
    storage.setItem(STALE_CHUNK_RELOAD_KEY, String(now()));
    reload();
    return true;
  } catch {
    // Private browsing or a disabled storage implementation must not turn
    // recovery into an unbounded reload loop. The normal error boundary will
    // still show its manual Reload action.
    return false;
  }
}
