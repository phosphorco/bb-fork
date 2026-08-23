import { useSyncExternalStore } from "react";
import { nanoid } from "nanoid";
import {
  p6rClaimedIdentitySchema,
  p6rEncodeClaimedIdentityHeader,
  p6rNormalizeHandle,
  type P6rClaimedIdentity,
} from "@bb/domain";

/**
 * Client-side owner of the CLAIMED multiplayer identity (see
 * @bb/domain/claimed-identity: self-asserted, attribution-only, never used for
 * authorization). The desktop shell and localhost browsers send no identity at
 * all — the server's local-operator default covers the single-player case —
 * so the store only activates for a remote web origin.
 */
const P6R_CLAIMED_IDENTITY_STORAGE_KEY = "bb.p6rClaimedIdentity";
const P6R_CLIENT_ID_STORAGE_KEY = "bb.p6rClaimedIdentity.p6rClientId";

/**
 * True when this app instance is a remote browser session: not the desktop
 * shell (`window.bbDesktop`, same signal as getAppSurface) and not a localhost
 * origin. Only remote sessions claim an identity.
 */
export function p6rIsRemoteAppContext(): boolean {
  if (typeof window === "undefined" || window.bbDesktop !== undefined) {
    return false;
  }
  const hostname = window.location.hostname;
  return (
    hostname !== "localhost" &&
    hostname !== "127.0.0.1" &&
    hostname !== "[::1]" &&
    hostname !== "::1"
  );
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    // Best-effort persistence; private-mode/quota failures degrade to a
    // per-session identity.
  }
}

let cachedClientId: string | null = null;

/** Per-device presence-bookkeeping hint; generated once and persisted. */
function getOrCreateClientId(): string {
  if (cachedClientId !== null) {
    return cachedClientId;
  }
  const stored = readStorage(P6R_CLIENT_ID_STORAGE_KEY);
  if (stored !== null && stored.length > 0 && stored.length <= 64) {
    cachedClientId = stored;
    return stored;
  }
  const created = nanoid();
  writeStorage(P6R_CLIENT_ID_STORAGE_KEY, created);
  cachedClientId = created;
  return created;
}

function readStoredIdentity(): P6rClaimedIdentity | null {
  const raw = readStorage(P6R_CLAIMED_IDENTITY_STORAGE_KEY);
  if (raw === null) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = p6rClaimedIdentitySchema.safeParse(parsed);
  if (!result.success) {
    return null;
  }
  const p6rHandle = p6rNormalizeHandle(result.data.p6rHandle);
  if (p6rHandle.length === 0) {
    return null;
  }
  return { ...result.data, p6rHandle };
}

let currentIdentity: P6rClaimedIdentity | null = readStoredIdentity();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

/**
 * The active claimed identity, or null when none applies. Always null outside
 * a remote app context so desktop/localhost requests carry no identity even if
 * a stale stored value exists (e.g. a copied browser profile).
 */
export function p6rGetClaimedIdentity(): P6rClaimedIdentity | null {
  return p6rIsRemoteAppContext() ? currentIdentity : null;
}

/** Encoded x-p6r-claimed-identity value, or null when no identity applies. */
export function p6rGetClaimedIdentityHeaderValue(): string | null {
  const identity = p6rGetClaimedIdentity();
  return identity === null ? null : p6rEncodeClaimedIdentityHeader(identity);
}

/**
 * Claims an identity from a freeform display name (p6rHandle derived via
 * p6rNormalizeHandle). Returns the stored identity, or null when the name
 * normalizes to nothing.
 */
export function p6rSetClaimedDisplayName(
  p6rDisplayName: string,
): P6rClaimedIdentity | null {
  const trimmed = p6rDisplayName.trim().slice(0, 128);
  const p6rHandle = p6rNormalizeHandle(trimmed).slice(0, 64);
  if (trimmed.length === 0 || p6rHandle.length === 0) {
    return null;
  }
  const identity: P6rClaimedIdentity = {
    p6rHandle,
    p6rDisplayName: trimmed,
    p6rImageUrl: null,
    p6rClientId: getOrCreateClientId(),
  };
  currentIdentity = identity;
  writeStorage(P6R_CLAIMED_IDENTITY_STORAGE_KEY, JSON.stringify(identity));
  notify();
  return identity;
}

export function p6rClearClaimedIdentity(): void {
  if (currentIdentity === null) {
    return;
  }
  currentIdentity = null;
  writeStorage(P6R_CLAIMED_IDENTITY_STORAGE_KEY, null);
  notify();
}

export function p6rSubscribeClaimedIdentity(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Reactive claimed identity (null when absent or not a remote context). */
export function useP6rClaimedIdentity(): P6rClaimedIdentity | null {
  return useSyncExternalStore(
    p6rSubscribeClaimedIdentity,
    p6rGetClaimedIdentity,
    () => null,
  );
}

/** Test-only: reset module state so each test starts from storage. */
export function p6rResetClaimedIdentityStoreForTest(): void {
  cachedClientId = null;
  currentIdentity = readStoredIdentity();
  notify();
}
