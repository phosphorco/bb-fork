import { z } from "zod";
import { systemNativeIdentityActorSchema } from "./api/system.js";

export const nativePresenceClientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("renew") }).strict(),
  z.object({ active: z.boolean(), type: z.literal("typing") }).strict(),
]);
export type NativePresenceClientMessage = z.infer<
  typeof nativePresenceClientMessageSchema
>;

export const nativePresenceEntrySchema = z
  .object({
    actor: systemNativeIdentityActorSchema,
    typing: z.boolean(),
  })
  .strict();
export type NativePresenceEntry = z.infer<typeof nativePresenceEntrySchema>;

export const nativePresenceServerMessageSchema = z.discriminatedUnion("type", [
  z
    .object({
      entries: z.array(nativePresenceEntrySchema),
      revision: z.number().int().nonnegative(),
      threadId: z.string().min(1),
      type: z.literal("snapshot"),
    })
    .strict(),
  z
    .object({
      entry: nativePresenceEntrySchema,
      revision: z.number().int().nonnegative(),
      threadId: z.string().min(1),
      type: z.literal("upsert"),
    })
    .strict(),
  z
    .object({
      identityKey: z.string().min(1),
      revision: z.number().int().nonnegative(),
      threadId: z.string().min(1),
      type: z.literal("remove"),
    })
    .strict(),
  z
    .object({
      status: z.enum(["expired", "invalidated"]),
      type: z.literal("status"),
    })
    .strict(),
]);
export type NativePresenceServerMessage = z.infer<
  typeof nativePresenceServerMessageSchema
>;
