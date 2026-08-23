import { z } from "zod";

export const p6rMemberSchema = z
  .object({
    p6rUserId: z.string().min(1),
    p6rHandle: z.string().min(1),
    p6rDisplayName: z.string().min(1),
    p6rImageUrl: z.string().nullable(),
    p6rAddedByUserId: z.string().min(1),
    p6rCreatedAt: z.number().int().nonnegative(),
  })
  .strict();
export type P6rMember = z.infer<typeof p6rMemberSchema>;

export const p6rMemberListResponseSchema = z
  .object({ p6rMembers: z.array(p6rMemberSchema) })
  .strict();
export type P6rMemberListResponse = z.infer<typeof p6rMemberListResponseSchema>;

export const p6rAddMemberRequestSchema = z
  .object({ p6rHandle: z.string().trim().min(1).max(64) })
  .strict();
export type P6rAddMemberRequest = z.infer<typeof p6rAddMemberRequestSchema>;

export const p6rRemoveMemberRequestSchema = p6rAddMemberRequestSchema;
export type P6rRemoveMemberRequest = z.infer<
  typeof p6rRemoveMemberRequestSchema
>;
