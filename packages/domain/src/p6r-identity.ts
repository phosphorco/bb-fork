import { z } from "zod";

/** Immutable identity key. Presentation fields are intentionally absent. */
export const p6rActorPrincipalSchema = z
  .object({
    p6rProviderId: z.string().min(1).max(256),
    p6rSubject: z.string().min(1).max(512),
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

export const p6rRequestActorAssuranceSchema = z.enum([
  "trusted-provider",
  "local-operator",
  "claimed",
]);
export type P6rRequestActorAssurance = z.infer<
  typeof p6rRequestActorAssuranceSchema
>;

/** Request-scoped authority. Assurance is never persisted as actor identity. */
export const p6rRequestActorSchema = p6rActorSnapshotSchema.extend({
  p6rAssurance: p6rRequestActorAssuranceSchema,
});
export type P6rRequestActor = z.infer<typeof p6rRequestActorSchema>;

export function p6rActorPrincipalKey(actor: P6rActorPrincipal): string {
  return `${actor.p6rProviderId}\0${actor.p6rSubject}`;
}
