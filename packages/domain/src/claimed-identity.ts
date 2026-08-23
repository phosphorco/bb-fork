import { z } from "zod";

/** Provider-qualified identity equality. Presentation fields are not identity. */
export const p6rPrincipalKeySchema = z
  .string()
  .min(3)
  .max(256)
  .regex(/^[a-z][a-z0-9+.-]*:[^\s]+$/u)
  .brand<"P6rPrincipalKey">();
export type P6rPrincipalKey = z.infer<typeof p6rPrincipalKeySchema>;

/**
 * A client may claim presentation over this compatibility transport, but the
 * server validates the claim and is the only PrincipalKey authority.
 * `clientId` is a per-device hint; it is never itself a PrincipalKey.
 */
export const P6R_CLAIMED_IDENTITY_HEADER = "x-p6r-claimed-identity";

export const p6rClaimedIdentitySchema = z
  .object({
    p6rHandle: z.string().min(1).max(64),
    p6rDisplayName: z.string().min(1).max(128),
    // null = this person has no avatar; clients render initials instead.
    p6rImageUrl: z.string().max(2048).nullable(),
    p6rClientId: z.string().min(1).max(64),
    // Legacy records omit this field. New server-authored identities carry it.
    p6rPrincipalKey: p6rPrincipalKeySchema.optional(),
  })
  .strict();
export type P6rClaimedIdentity = z.infer<typeof p6rClaimedIdentitySchema>;

/** Client-asserted presentation only; PrincipalKey is never a client field. */
export const p6rClaimedIdentityClaimSchema = p6rClaimedIdentitySchema
  .omit({ p6rPrincipalKey: true })
  .superRefine((identity, context) => {
    if (p6rNormalizeHandle(identity.p6rHandle).length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "p6rHandle must contain a non-whitespace character",
        path: ["p6rHandle"],
      });
    }
  });
export type P6rClaimedIdentityClaim = z.infer<
  typeof p6rClaimedIdentityClaimSchema
>;

/**
 * Canonical form used as the collaborator key. Case and surrounding whitespace
 * never distinguish people ("Sawyer" and "sawyer " are the same collaborator).
 */
export function p6rNormalizeHandle(raw: string): string {
  return raw.normalize("NFKC").trim().toLowerCase();
}

export function p6rCreateProviderPrincipalKey(
  provider: string,
  subject: string,
): P6rPrincipalKey {
  return p6rPrincipalKeySchema.parse(`${provider}:${subject}`);
}

export function p6rCreateLocalPrincipalKey(
  operatorSubject: string,
): P6rPrincipalKey {
  return p6rCreateProviderPrincipalKey(
    "local",
    p6rNormalizeHandle(operatorSubject),
  );
}

/** Header value: URI-encoded JSON (ASCII-safe, portable browser/node). */
export function p6rEncodeClaimedIdentityHeader(
  identity: P6rClaimedIdentity,
): string {
  return encodeURIComponent(JSON.stringify(identity));
}

/**
 * Boundary parser for the freeform header. Returns the identity with its
 * handle normalized, or null when the value is absent or malformed — callers
 * fall back to their default local identity rather than failing the request.
 */
export function p6rDecodeClaimedIdentityHeader(
  value: string | null | undefined,
): P6rClaimedIdentity | null {
  if (!value) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeURIComponent(value));
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
