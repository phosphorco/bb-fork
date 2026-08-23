import { z } from "zod";
import {
  p6rCreateLocalPrincipalKey,
  p6rCreateProviderPrincipalKey,
  p6rPrincipalKeySchema,
  type P6rPrincipalKey,
} from "./claimed-identity.js";

/** Immutable identity key. Presentation fields are intentionally absent. */
export const p6rActorPrincipalSchema = z
  .object({
    p6rProviderId: z
      .string()
      .min(1)
      .max(256)
      .refine(isUriComponentEncodable, "Malformed Unicode is not an identity"),
    p6rSubject: z
      .string()
      .min(1)
      .max(512)
      .refine(isUriComponentEncodable, "Malformed Unicode is not an identity"),
  })
  .strict();
export type P6rActorPrincipal = z.infer<typeof p6rActorPrincipalSchema>;

/** Canonical key plus the last authenticated presentation snapshot. */
export const p6rActorSnapshotSchema = p6rActorPrincipalSchema
  .extend({
    p6rHandle: z.string().min(1).max(128),
    p6rDisplayName: z.string().min(1).max(256),
    p6rImageUrl: z.string().max(2048).nullable(),
  })
  .strict();
export type P6rActorSnapshot = z.infer<typeof p6rActorSnapshotSchema>;

function isUriComponentEncodable(value: string): boolean {
  try {
    encodeURIComponent(value);
    return true;
  } catch {
    return false;
  }
}

export function p6rActorPrincipalKey(actor: P6rActorPrincipal): string {
  const principal = parseActorPrincipal(actor);
  return JSON.stringify([principal.p6rProviderId, principal.p6rSubject]);
}

function parseActorPrincipal(actor: P6rActorPrincipal): P6rActorPrincipal {
  return p6rActorPrincipalSchema.parse({
    p6rProviderId: actor.p6rProviderId,
    p6rSubject: actor.p6rSubject,
  });
}

/** Server-established exact identity encoded as the public PrincipalKey. */
export function p6rPrincipalKeyForActorSnapshot(
  actor: P6rActorPrincipal,
): P6rPrincipalKey {
  const principal = parseActorPrincipal(actor);
  if (principal.p6rProviderId === "p6r-local-operator") {
    return p6rCreateLocalPrincipalKey(principal.p6rSubject);
  }
  if (principal.p6rProviderId === "claimed") {
    return p6rCreateProviderPrincipalKey("claimed", principal.p6rSubject);
  }
  return p6rPrincipalKeySchema.parse(
    `p6r:${encodeURIComponent(principal.p6rProviderId)}/${encodeURIComponent(
      principal.p6rSubject,
    )}`,
  );
}
