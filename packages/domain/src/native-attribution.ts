import { z } from "zod";

const identityText = z.string().min(1).max(4096);
export const nativePersonReferenceSchema = z.object({
  kind: z.literal("person"),
  key: identityText,
  issuer: identityText,
  subject: identityText,
});
const externalReferenceSchema = z.object({
  kind: z.literal("external"),
  key: identityText,
  pluginId: identityText,
  subject: identityText,
});
const actorFields = {
  evidence: z.enum([
    "provider-verified",
    "local-user",
    "upstream-default",
    "integration-asserted",
    "legacy",
  ]),
  presentation: z.object({
    displayName: identityText,
    handle: identityText.nullable(),
    avatarUrl: identityText.nullable(),
  }),
};
export const nativePersonActorSchema = z.object({
  ...actorFields,
  identity: nativePersonReferenceSchema,
});
const externalActorSchema = z.object({
  ...actorFields,
  identity: externalReferenceSchema,
});
export const nativeActorSnapshotSchema = z.object({
  ...actorFields,
  identity: z.discriminatedUnion("kind", [
    nativePersonReferenceSchema,
    externalReferenceSchema,
  ]),
});
export type NativeActorSnapshot = z.infer<typeof nativeActorSnapshotSchema>;

export const nativeOriginSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("person"), actor: nativePersonActorSchema }),
  z.object({ kind: z.literal("external"), actor: externalActorSchema }),
  z.object({ kind: z.literal("agent"), agentId: identityText.nullable() }),
  z.object({ kind: z.literal("system"), reason: identityText }),
  z.object({
    kind: z.literal("unknown"),
    reason: z.enum(["legacy", "upstream-unattributed", "missing-source"]),
  }),
]);
export type NativeOrigin = z.infer<typeof nativeOriginSchema>;

export const nativeInputAttributionSchema = z.object({
  author: nativeOriginSchema,
  latestEditor: nativeActorSnapshotSchema.nullable(),
});
export type NativeInputAttribution = z.infer<
  typeof nativeInputAttributionSchema
>;

const nativeAttributionSourceFields = {
  sourceIndex: z.number().int().nonnegative(),
  attribution: nativeInputAttributionSchema,
};

export const nativeAttributionSourceSchema = z.discriminatedUnion(
  "sourceKind",
  [
    z.object({
      ...nativeAttributionSourceFields,
      sourceKind: z.literal("contribution"),
      contributionId: z.string().min(1).nullable(),
    }),
    z.object({
      ...nativeAttributionSourceFields,
      sourceKind: z.literal("generated"),
      contributionId: z.null(),
    }),
    z.object({
      ...nativeAttributionSourceFields,
      sourceKind: z.literal("interaction"),
      contributionId: z.null(),
    }),
  ],
);
export type NativeAttributionSource = z.infer<
  typeof nativeAttributionSourceSchema
>;

export const nativeInputProvenanceGroupSchema = z.object({
  groupIndex: z.number().int().nonnegative(),
  sources: z.array(nativeAttributionSourceSchema),
});
export type NativeInputProvenanceGroup = z.infer<
  typeof nativeInputProvenanceGroupSchema
>;
