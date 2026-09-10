import { z } from "zod";
import { rawThreadIdSchema } from "./raw-thread-id.js";
import { threadOriginKindSchema } from "./thread-origin-kind.js";

const localNamePattern = /^[a-z][a-z0-9._-]{0,63}$/u;

export const threadFacetLocalNameSchema = z.string().regex(localNamePattern);
export const threadFacetMemberIdSchema = threadFacetLocalNameSchema;
export const threadFacetPrincipalKeySchema = z.string().min(1).max(512);
export const threadFacetMemberKindSchema = z.enum(["principal-key", "enum"]);
export const threadFacetCardinalitySchema = z.enum(["one", "many"]);
export const threadFacetAssignmentScopeSchema = z.literal("shared-thread");
export const threadFacetOwnerStateSchema = z.enum([
  "ready",
  "reconciling",
  "unavailable",
]);

export type ThreadFacetLocalName = z.infer<typeof threadFacetLocalNameSchema>;
export type ThreadFacetMemberKind = z.infer<typeof threadFacetMemberKindSchema>;
export type ThreadFacetCardinality = z.infer<typeof threadFacetCardinalitySchema>;
export type ThreadFacetAssignmentScope = z.infer<
  typeof threadFacetAssignmentScopeSchema
>;
export type ThreadFacetOwnerState = z.infer<typeof threadFacetOwnerStateSchema>;

export type ThreadFacetTypeParts =
  | { scope: "core"; owner: "core"; localName: ThreadFacetLocalName }
  | { scope: "plugin"; owner: string; localName: ThreadFacetLocalName };

function serializedTypeId(parts: ThreadFacetTypeParts): string {
  const localName = threadFacetLocalNameSchema.parse(parts.localName);
  return parts.scope === "core"
    ? `core/${localName}`
    : `plugin/${encodeURIComponent(parts.owner)}/${localName}`;
}

export function parseThreadFacetTypeId(value: string): ThreadFacetTypeParts {
  const segments = value.split("/");
  if (segments.length === 2 && segments[0] === "core") {
    const parts: ThreadFacetTypeParts = {
      scope: "core",
      owner: "core",
      localName: threadFacetLocalNameSchema.parse(segments[1]),
    };
    if (serializedTypeId(parts) === value) return parts;
  }
  if (segments.length === 3 && segments[0] === "plugin") {
    try {
      const owner = decodeURIComponent(segments[1] ?? "");
      if (owner.length === 0 || owner.length > 256) throw new Error();
      const parts: ThreadFacetTypeParts = {
        scope: "plugin",
        owner,
        localName: threadFacetLocalNameSchema.parse(segments[2]),
      };
      if (serializedTypeId(parts) === value) return parts;
    } catch {}
  }
  throw new Error("Invalid thread facet type id");
}

export const threadFacetTypeIdSchema = z
  .string()
  .min(3)
  .max(512)
  .refine((value) => {
    try {
      parseThreadFacetTypeId(value);
      return true;
    } catch {
      return false;
    }
  })
  .brand<"ThreadFacetTypeId">();
export type ThreadFacetTypeId = z.infer<typeof threadFacetTypeIdSchema>;

export function serializeThreadFacetTypeId(
  parts: ThreadFacetTypeParts,
): ThreadFacetTypeId {
  return threadFacetTypeIdSchema.parse(serializedTypeId(parts));
}

export const CORE_PARTICIPANTS_FACET_TYPE_ID = serializeThreadFacetTypeId({
  scope: "core",
  owner: "core",
  localName: "participants",
});

export const threadFacetFilterSchema = z.discriminatedUnion("operator", [
  z.object({ typeId: threadFacetTypeIdSchema, operator: z.literal("present") }).strict(),
  z.object({ typeId: threadFacetTypeIdSchema, operator: z.literal("absent") }).strict(),
  z.object({
    typeId: threadFacetTypeIdSchema,
    operator: z.enum(["contains", "notContains"]),
    member: z.union([
      threadFacetPrincipalKeySchema,
      z.object({ perspective: z.literal("request-principal") }).strict(),
    ]),
  }).strict(),
]);
export type ThreadFacetFilter = z.infer<typeof threadFacetFilterSchema>;
export type ResolvedThreadFacetFilter =
  | Exclude<ThreadFacetFilter, { operator: "contains" | "notContains" }>
  | { typeId: ThreadFacetTypeId; operator: "contains" | "notContains"; member: string };

export const threadFacetOrderSchema = z.object({
  typeId: threadFacetTypeIdSchema,
  direction: z.enum(["asc", "desc"]),
  absent: z.enum(["first", "last"]),
  unknown: z.enum(["first", "last"]),
}).strict();
export type ThreadFacetOrder = z.infer<typeof threadFacetOrderSchema>;

export const threadFacetListScopeSchema = z.object({
  projectId: z.string().min(1).optional(),
  archived: z.boolean().optional(),
  includeHidden: z.boolean().optional(),
  parentThreadId: rawThreadIdSchema.optional(),
  sourceThreadId: rawThreadIdSchema.optional(),
  sectionId: z.string().min(1).optional(),
  unsectioned: z.boolean().optional(),
  hasParent: z.boolean().optional(),
  originKind: threadOriginKindSchema.optional(),
  originPluginId: z.string().min(1).optional(),
  experimental_latestAttentionAtOrAfter: z.number().int().nonnegative().optional(),
}).strict();
export type ThreadFacetListScope = z.infer<typeof threadFacetListScopeSchema>;

export const threadFacetQueryRequestSchema = z.object({
  scope: threadFacetListScopeSchema.default({}),
  filters: z.array(threadFacetFilterSchema).max(4).default([]),
  order: threadFacetOrderSchema.optional(),
  pageSize: z.number().int().min(1).max(100).default(50),
  cursor: z.string().max(4096).optional(),
  experimental_includeExecution: z.boolean().optional(),
}).strict();
export type ThreadFacetQueryRequest = z.infer<typeof threadFacetQueryRequestSchema>;

export const threadFacetParticipantPageRequestSchema = z.object({
  threadId: rawThreadIdSchema,
  pageSize: z.number().int().min(1).max(100).default(50),
  cursor: z.string().max(4096).optional(),
}).strict();
export type ThreadFacetParticipantPageRequest = z.infer<
  typeof threadFacetParticipantPageRequestSchema
>;
