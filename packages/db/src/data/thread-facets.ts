import {
  CORE_PARTICIPANTS_FACET_TYPE_ID,
  parseThreadFacetTypeId,
  p6rActorSnapshotSchema,
  p6rPrincipalKeyForActorSnapshot,
  p6rPrincipalKeySchema,
  serializeThreadFacetTypeId,
  threadFacetLocalNameSchema,
  threadFacetAssignmentScopeSchema,
  threadFacetCardinalitySchema,
  threadFacetMemberIdSchema,
  threadFacetMemberKindSchema,
  type P6rThreadParticipantProfile,
  type ThreadFacetAssignmentScope,
  type ThreadFacetCardinality,
  type ResolvedThreadFacetFilter,
  type ThreadFacetMemberKind,
  type ThreadFacetOrder,
  type ThreadFacetOwnerState,
  type ThreadFacetTypeId,
  type ThreadOriginKind,
} from "@bb/domain";
import { randomBytes } from "node:crypto";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  not,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type {
  DbConnection,
  DbQueryConnection,
  DbTransaction,
} from "../connection.js";
import {
  threadFacetDeclarations,
  threadFacetCursorKeys,
  threadFacetMembers,
  threadFacetOwners,
  threadFacetPrincipalProfiles,
  threadFacetReconciliationTargets,
  threadFacetRelations,
  threadFacetSnapshots,
  events,
  projects,
  threads,
} from "../schema.js";
import {
  listStoredEventRowsByThreadIdsAndTypes,
  queryInSqliteVariableBatches,
} from "./events.js";

export const THREAD_FACET_PLUGIN_REPLACEMENT_MEMBER_LIMIT = 64;
export const THREAD_FACET_DIRECTORY_MEMBER_LIMIT = 4_096;
export const THREAD_FACET_CENSUS_PAGE_LIMIT = 100;

const CORE_PARTICIPANT_EVENT_TYPES = [
  "client/thread/start",
  "client/turn/requested",
  "client/turn/start",
] as const;

export type ThreadFacetInvariantErrorCode =
  | "cardinality_exceeded"
  | "census_not_exhausted"
  | "duplicate_member"
  | "facet_unavailable"
  | "incompatible_declaration"
  | "invalid_member"
  | "prior_snapshots_remaining"
  | "stale_generation"
  | "thread_unavailable";

export class ThreadFacetInvariantError extends Error {
  constructor(readonly code: ThreadFacetInvariantErrorCode) {
    super(code);
    this.name = "ThreadFacetInvariantError";
  }
}

interface FacetTypeKey {
  localName: string;
  typeOwner: string;
  typeScope: "core" | "plugin";
}

export interface ThreadFacetDeclaration {
  assignmentScope: ThreadFacetAssignmentScope;
  cardinality: ThreadFacetCardinality;
  memberKind: ThreadFacetMemberKind;
  members: readonly string[];
  typeId: ThreadFacetTypeId;
}

export interface DeclarePluginThreadFacetArgs {
  assignmentScope: "shared-thread";
  cardinality: ThreadFacetCardinality;
  localName: string;
  memberKind: ThreadFacetMemberKind;
  members: readonly string[];
  ownerPluginId: string;
}

export interface ActivatePluginThreadFacetDeclarationsArgs {
  declarations: readonly Omit<DeclarePluginThreadFacetArgs, "ownerPluginId">[];
  ownerPluginId: string;
}

export interface ActivatedPluginThreadFacetDeclaration extends ThreadFacetGeneration {
  declaration: ThreadFacetDeclaration;
}

export interface QuarantinedPluginThreadFacetDeclaration {
  code: ThreadFacetInvariantErrorCode;
  localName: string;
}

export interface ActivatePluginThreadFacetDeclarationsResult {
  activated: readonly ActivatedPluginThreadFacetDeclaration[];
  quarantined: readonly QuarantinedPluginThreadFacetDeclaration[];
}

export interface ThreadFacetGeneration {
  generation: number;
}

export interface ReplaceThreadFacetRelationsArgs {
  generation: number;
  members: readonly string[];
  threadId: string;
  typeId: ThreadFacetTypeId;
}

export interface ListPriorThreadFacetSnapshotTargetsArgs {
  afterThreadId?: string;
  generation: number;
  limit: number;
  typeId: ThreadFacetTypeId;
}

export interface PriorThreadFacetSnapshotTargetPage {
  nextAfterThreadId: string | null;
  threadIds: readonly string[];
}

export interface ThreadFacetQueryPosition {
  rank: number | null;
  state: number | null;
  threadId: string;
  updatedAt: number | null;
}

export interface QueryThreadFacetIdsArgs {
  after?: ThreadFacetQueryPosition;
  archived?: boolean;
  filters: readonly ResolvedThreadFacetFilter[];
  includeHidden: boolean;
  order?: ThreadFacetOrder;
  pageSize: number;
  projectId?: string;
  parentThreadId?: string;
  sourceThreadId?: string;
  sectionId?: string;
  unsectioned?: boolean;
  hasParent?: boolean;
  originKind?: ThreadOriginKind;
  originPluginId?: string;
  experimental_latestAttentionAtOrAfter?: number;
}

export interface ListThreadIdsForFacetProjectionArgs {
  archived?: boolean;
  includeHidden: boolean;
  projectId?: string;
  parentThreadId?: string;
  sourceThreadId?: string;
  sectionId?: string;
  unsectioned?: boolean;
  hasParent?: boolean;
  originKind?: ThreadOriginKind;
  originPluginId?: string;
  experimental_latestAttentionAtOrAfter?: number;
}

export interface ThreadFacetIdPage {
  hasMore: boolean;
  positions: readonly ThreadFacetQueryPosition[];
  threadIds: readonly string[];
}

export interface ThreadFacetOwnerProjection {
  generation: number;
  ownerState: ThreadFacetOwnerState;
  projectionRevision: number;
  typeId: ThreadFacetTypeId;
}

export function getOrCreateThreadFacetCursorSigningKey(
  db: DbConnection,
): string {
  return db.transaction(
    (tx) => {
      tx.insert(threadFacetCursorKeys)
        .values({
          keyId: "primary",
          secret: randomBytes(32).toString("hex"),
          createdAt: Date.now(),
        })
        .onConflictDoNothing()
        .run();
      const row = tx
        .select({ secret: threadFacetCursorKeys.secret })
        .from(threadFacetCursorKeys)
        .where(eq(threadFacetCursorKeys.keyId, "primary"))
        .get();
      if (row === undefined) {
        throw new Error("Facet cursor signing key was not persisted");
      }
      return row.secret;
    },
    { behavior: "immediate" },
  );
}

export function listThreadIdsForFacetProjection(
  db: DbQueryConnection,
  args: ListThreadIdsForFacetProjectionArgs,
): string[] {
  return db
    .select({ id: threads.id })
    .from(threads)
    .where(
      and(
        isNull(threads.deletedAt),
        args.includeHidden ? undefined : eq(threads.visibility, "visible"),
        args.projectId ? eq(threads.projectId, args.projectId) : undefined,
        args.parentThreadId
          ? eq(threads.parentThreadId, args.parentThreadId)
          : undefined,
        args.sourceThreadId
          ? eq(threads.sourceThreadId, args.sourceThreadId)
          : undefined,
        args.sectionId ? eq(threads.sectionId, args.sectionId) : undefined,
        args.unsectioned === true ? isNull(threads.sectionId) : undefined,
        args.hasParent === true
          ? isNotNull(threads.parentThreadId)
          : args.hasParent === false
            ? isNull(threads.parentThreadId)
            : undefined,
        args.originKind ? eq(threads.originKind, args.originKind) : undefined,
        args.originPluginId
          ? eq(threads.originPluginId, args.originPluginId)
          : undefined,
        args.experimental_latestAttentionAtOrAfter === undefined
          ? undefined
          : gte(
              threads.latestAttentionAt,
              args.experimental_latestAttentionAtOrAfter,
            ),
        args.archived === true
          ? isNotNull(threads.archivedAt)
          : args.archived === false
            ? isNull(threads.archivedAt)
            : undefined,
      ),
    )
    .orderBy(
      ...(args.experimental_latestAttentionAtOrAfter === undefined
        ? [asc(threads.id)]
        : [asc(threads.latestAttentionAt), asc(threads.id)]),
    )
    .all()
    .map(({ id }) => id);
}

export interface CoreParticipantProfilePage {
  nextPosition: number | null;
  profiles: readonly P6rThreadParticipantProfile[];
  totalCount: number;
}

function facetTypeKey(typeId: ThreadFacetTypeId): FacetTypeKey {
  const parts = parseThreadFacetTypeId(typeId);
  return {
    typeScope: parts.scope,
    typeOwner: parts.owner,
    localName: parts.localName,
  };
}

function declarationWhere(key: FacetTypeKey) {
  return and(
    eq(threadFacetDeclarations.typeScope, key.typeScope),
    eq(threadFacetDeclarations.typeOwner, key.typeOwner),
    eq(threadFacetDeclarations.localName, key.localName),
  );
}

function ownerWhere(key: FacetTypeKey) {
  return and(
    eq(threadFacetOwners.typeScope, key.typeScope),
    eq(threadFacetOwners.typeOwner, key.typeOwner),
    eq(threadFacetOwners.localName, key.localName),
    eq(threadFacetOwners.assignmentScope, "shared-thread"),
  );
}

export function getThreadFacetDeclaration(
  db: DbQueryConnection,
  typeId: ThreadFacetTypeId,
): ThreadFacetDeclaration | null {
  const key = facetTypeKey(typeId);
  const row = db
    .select()
    .from(threadFacetDeclarations)
    .where(declarationWhere(key))
    .get();
  if (!row) {
    return null;
  }
  const members = db
    .select({ memberId: threadFacetMembers.memberId })
    .from(threadFacetMembers)
    .where(
      and(
        eq(threadFacetMembers.typeScope, key.typeScope),
        eq(threadFacetMembers.typeOwner, key.typeOwner),
        eq(threadFacetMembers.localName, key.localName),
      ),
    )
    .orderBy(asc(threadFacetMembers.memberRank))
    .all()
    .map(({ memberId }) => memberId);
  return {
    typeId,
    assignmentScope: row.assignmentScope,
    cardinality: row.cardinality,
    memberKind: row.memberKind,
    members,
  };
}

function validateDirectoryMembers(members: unknown): string[] {
  if (!Array.isArray(members)) {
    throw new ThreadFacetInvariantError("invalid_member");
  }
  if (members.length > THREAD_FACET_DIRECTORY_MEMBER_LIMIT) {
    throw new ThreadFacetInvariantError("invalid_member");
  }
  const parsed = members.map((member) => {
    const result = threadFacetMemberIdSchema.safeParse(member);
    if (!result.success) {
      throw new ThreadFacetInvariantError("invalid_member");
    }
    return result.data;
  });
  if (new Set(parsed).size !== parsed.length) {
    throw new ThreadFacetInvariantError("duplicate_member");
  }
  return parsed;
}

function declarePluginThreadFacetInTransaction(
  tx: DbTransaction,
  args: DeclarePluginThreadFacetArgs,
): ThreadFacetDeclaration {
  const parsedLocalName = threadFacetLocalNameSchema.safeParse(args.localName);
  if (!parsedLocalName.success) {
    throw new ThreadFacetInvariantError("incompatible_declaration");
  }
  const localName = parsedLocalName.data;
  if (
    args.ownerPluginId.length === 0 ||
    args.ownerPluginId.length > 256 ||
    !isUriComponentEncodable(args.ownerPluginId)
  ) {
    throw new ThreadFacetInvariantError("incompatible_declaration");
  }
  if (
    !threadFacetAssignmentScopeSchema.safeParse(args.assignmentScope).success ||
    args.assignmentScope !== "shared-thread" ||
    !threadFacetCardinalitySchema.safeParse(args.cardinality).success ||
    !threadFacetMemberKindSchema.safeParse(args.memberKind).success ||
    args.memberKind !== "enum"
  ) {
    throw new ThreadFacetInvariantError("incompatible_declaration");
  }
  const desiredMembers = validateDirectoryMembers(args.members);
  let typeId: ThreadFacetTypeId;
  try {
    typeId = serializeThreadFacetTypeId({
      scope: "plugin",
      owner: args.ownerPluginId,
      localName,
    });
  } catch {
    throw new ThreadFacetInvariantError("incompatible_declaration");
  }
  const key = facetTypeKey(typeId);
  const existing = getThreadFacetDeclaration(tx, typeId);
  const now = Date.now();
  if (
    existing !== null &&
    (existing.memberKind !== args.memberKind ||
      existing.cardinality !== args.cardinality ||
      existing.assignmentScope !== args.assignmentScope)
  ) {
    throw new ThreadFacetInvariantError("incompatible_declaration");
  }

  const existingMembers = existing?.members ?? [];
  for (let index = 0; index < existingMembers.length; index += 1) {
    if (desiredMembers[index] !== existingMembers[index]) {
      throw new ThreadFacetInvariantError("incompatible_declaration");
    }
  }
  const appendedMembers = desiredMembers.slice(existingMembers.length);
  if (
    desiredMembers.length < existingMembers.length ||
    appendedMembers.length > THREAD_FACET_PLUGIN_REPLACEMENT_MEMBER_LIMIT ||
    desiredMembers.length > THREAD_FACET_DIRECTORY_MEMBER_LIMIT
  ) {
    throw new ThreadFacetInvariantError("incompatible_declaration");
  }
  if (existing === null) {
    tx.insert(threadFacetDeclarations)
      .values({
        typeScope: key.typeScope,
        typeOwner: key.typeOwner,
        localName: key.localName,
        memberKind: args.memberKind,
        cardinality: args.cardinality,
        assignmentScope: args.assignmentScope,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }
  if (appendedMembers.length > 0) {
    tx.insert(threadFacetMembers)
      .values(
        appendedMembers.map((memberId, offset) => ({
          typeScope: key.typeScope,
          typeOwner: key.typeOwner,
          localName: key.localName,
          memberId,
          memberRank: existingMembers.length + offset,
          createdAt: now,
        })),
      )
      .run();
    tx.update(threadFacetDeclarations)
      .set({ updatedAt: now })
      .where(declarationWhere(key))
      .run();
  }
  const declared = getThreadFacetDeclaration(tx, typeId);
  if (declared === null) {
    throw new ThreadFacetInvariantError("facet_unavailable");
  }
  return declared;
}

function isUriComponentEncodable(value: string): boolean {
  try {
    encodeURIComponent(value);
    return true;
  } catch {
    return false;
  }
}

export function declarePluginThreadFacet(
  db: DbConnection,
  args: DeclarePluginThreadFacetArgs,
): ThreadFacetDeclaration {
  return db.transaction(
    (tx) => declarePluginThreadFacetInTransaction(tx, args),
    { behavior: "immediate" },
  );
}

function requireDeclaration(
  db: DbQueryConnection,
  typeId: ThreadFacetTypeId,
): ThreadFacetDeclaration {
  const declaration = getThreadFacetDeclaration(db, typeId);
  if (declaration === null) {
    throw new ThreadFacetInvariantError("facet_unavailable");
  }
  return declaration;
}

function requireCurrentGeneration(
  db: DbQueryConnection,
  args: { generation: number; typeId: ThreadFacetTypeId },
) {
  const key = facetTypeKey(args.typeId);
  const owner = db
    .select()
    .from(threadFacetOwners)
    .where(ownerWhere(key))
    .get();
  if (
    owner === undefined ||
    owner.generation !== args.generation ||
    owner.state === "unavailable"
  ) {
    throw new ThreadFacetInvariantError("stale_generation");
  }
  return owner;
}

function beginThreadFacetOwnerGenerationInTransaction(
  tx: DbTransaction,
  args: { typeId: ThreadFacetTypeId },
): ThreadFacetGeneration {
  requireDeclaration(tx, args.typeId);
  const key = facetTypeKey(args.typeId);
  const current = tx
    .select({ generation: threadFacetOwners.generation })
    .from(threadFacetOwners)
    .where(ownerWhere(key))
    .get();
  const generation = (current?.generation ?? 0) + 1;
  tx.insert(threadFacetOwners)
    .values({
      typeScope: key.typeScope,
      typeOwner: key.typeOwner,
      localName: key.localName,
      assignmentScope: "shared-thread",
      generation,
      state: "reconciling",
      censusExhausted: false,
      censusTerminalDelivered: false,
      updatedAt: Date.now(),
    })
    .onConflictDoUpdate({
      target: [
        threadFacetOwners.typeScope,
        threadFacetOwners.typeOwner,
        threadFacetOwners.localName,
        threadFacetOwners.assignmentScope,
      ],
      set: {
        generation,
        state: "reconciling",
        censusExhausted: false,
        censusTerminalDelivered: false,
        updatedAt: Date.now(),
      },
    })
    .run();
  tx.delete(threadFacetReconciliationTargets)
    .where(
      and(
        eq(threadFacetReconciliationTargets.typeScope, key.typeScope),
        eq(threadFacetReconciliationTargets.typeOwner, key.typeOwner),
        eq(threadFacetReconciliationTargets.localName, key.localName),
        eq(threadFacetReconciliationTargets.assignmentScope, "shared-thread"),
      ),
    )
    .run();
  tx.run(sql`
        insert into ${threadFacetReconciliationTargets}
          (type_scope, type_owner, local_name, assignment_scope,
           owner_generation, thread_id, discharged)
        select ${key.typeScope}, ${key.typeOwner}, ${key.localName},
          'shared-thread', ${generation}, ${threadFacetSnapshots.threadId}, 0
        from ${threadFacetSnapshots}
        inner join ${threads} on ${threads.id} = ${threadFacetSnapshots.threadId}
        inner join ${projects} on ${projects.id} = ${threads.projectId}
        where ${and(
          eq(threadFacetSnapshots.typeScope, key.typeScope),
          eq(threadFacetSnapshots.typeOwner, key.typeOwner),
          eq(threadFacetSnapshots.localName, key.localName),
          eq(threadFacetSnapshots.assignmentScope, "shared-thread"),
          eq(threads.visibility, "visible"),
          isNull(threads.deletedAt),
          isNull(projects.deletedAt),
        )}
      `);
  return { generation };
}

export function beginThreadFacetOwnerGeneration(
  db: DbConnection,
  args: { typeId: ThreadFacetTypeId },
): ThreadFacetGeneration {
  return db.transaction(
    (tx) => beginThreadFacetOwnerGenerationInTransaction(tx, args),
    { behavior: "immediate" },
  );
}

export function activatePluginThreadFacetDeclarations(
  db: DbConnection,
  args: ActivatePluginThreadFacetDeclarationsArgs,
): ActivatePluginThreadFacetDeclarationsResult {
  return db.transaction(
    (tx) => {
      const localNameCounts = new Map<string, number>();
      for (const rawInput of args.declarations as readonly unknown[]) {
        const localName =
          typeof rawInput === "object" && rawInput !== null
            ? (rawInput as { localName?: unknown }).localName
            : undefined;
        if (typeof localName !== "string") {
          continue;
        }
        localNameCounts.set(
          localName,
          (localNameCounts.get(localName) ?? 0) + 1,
        );
      }
      const activated: ActivatedPluginThreadFacetDeclaration[] = [];
      const quarantined: QuarantinedPluginThreadFacetDeclaration[] = [];
      const stagedLocalNames = new Set<string>();
      for (const rawInput of args.declarations as readonly unknown[]) {
        const input =
          typeof rawInput === "object" && rawInput !== null
            ? (rawInput as DeclarePluginThreadFacetArgs)
            : ({} as DeclarePluginThreadFacetArgs);
        const parsedLocalName = threadFacetLocalNameSchema.safeParse(
          input.localName,
        );
        const localName = parsedLocalName.success
          ? parsedLocalName.data
          : typeof input.localName === "string"
            ? input.localName.slice(0, 64)
            : "<invalid>";
        if (
          typeof input.localName === "string" &&
          (localNameCounts.get(input.localName) ?? 0) > 1
        ) {
          if (!stagedLocalNames.has(localName)) {
            quarantined.push({
              localName,
              code: "incompatible_declaration",
            });
          }
          stagedLocalNames.add(localName);
          continue;
        }
        stagedLocalNames.add(localName);
        try {
          const declaration = declarePluginThreadFacetInTransaction(tx, {
            ...input,
            ownerPluginId: args.ownerPluginId,
          });
          activated.push({
            declaration,
            ...beginThreadFacetOwnerGenerationInTransaction(tx, {
              typeId: declaration.typeId,
            }),
          });
        } catch (error) {
          if (!(error instanceof ThreadFacetInvariantError)) {
            throw error;
          }
          quarantined.push({ localName, code: error.code });
        }
      }
      const declaredLocalNames = new Set(
        activated.map(
          ({ declaration }) => facetTypeKey(declaration.typeId).localName,
        ),
      );
      const previouslyOwned = tx
        .select({ localName: threadFacetDeclarations.localName })
        .from(threadFacetDeclarations)
        .where(
          and(
            eq(threadFacetDeclarations.typeScope, "plugin"),
            eq(threadFacetDeclarations.typeOwner, args.ownerPluginId),
          ),
        )
        .all();
      for (const { localName } of previouslyOwned) {
        if (declaredLocalNames.has(localName)) {
          continue;
        }
        tx.update(threadFacetOwners)
          .set({ state: "unavailable", updatedAt: Date.now() })
          .where(
            and(
              eq(threadFacetOwners.typeScope, "plugin"),
              eq(threadFacetOwners.typeOwner, args.ownerPluginId),
              eq(threadFacetOwners.localName, localName),
              eq(threadFacetOwners.assignmentScope, "shared-thread"),
            ),
          )
          .run();
      }
      return { activated, quarantined };
    },
    { behavior: "immediate" },
  );
}

export function markAllPluginThreadFacetOwnersUnavailable(
  db: DbConnection,
): void {
  db.update(threadFacetOwners)
    .set({ state: "unavailable", updatedAt: Date.now() })
    .where(eq(threadFacetOwners.typeScope, "plugin"))
    .run();
}

function validateReplacementMembers(
  declaration: ThreadFacetDeclaration,
  members: readonly string[],
  maximum: number | null,
): string[] {
  if (maximum !== null && members.length > maximum) {
    throw new ThreadFacetInvariantError("cardinality_exceeded");
  }
  if (declaration.cardinality === "one" && members.length > 1) {
    throw new ThreadFacetInvariantError("cardinality_exceeded");
  }
  const parsed = members.map((member) => {
    const result =
      declaration.memberKind === "principal-key"
        ? p6rPrincipalKeySchema.safeParse(member)
        : threadFacetMemberIdSchema.safeParse(member);
    if (!result.success) {
      throw new ThreadFacetInvariantError("invalid_member");
    }
    return result.data;
  });
  if (new Set(parsed).size !== parsed.length) {
    throw new ThreadFacetInvariantError("duplicate_member");
  }
  if (
    declaration.memberKind === "enum" &&
    parsed.some((member) => !declaration.members.includes(member))
  ) {
    throw new ThreadFacetInvariantError("invalid_member");
  }
  return parsed;
}

function replaceRelationsInTransaction(
  tx: DbTransaction,
  args: ReplaceThreadFacetRelationsArgs & {
    maximumMembers: number | null;
    requireVisibleTarget: boolean;
    sourceVersion?: number;
  },
): "replaced" | "thread_unavailable" {
  const declaration = requireDeclaration(tx, args.typeId);
  requireCurrentGeneration(tx, args);
  const key = facetTypeKey(args.typeId);
  const target = tx
    .select({ id: threads.id })
    .from(threads)
    .innerJoin(projects, eq(projects.id, threads.projectId))
    .where(
      and(
        eq(threads.id, args.threadId),
        args.requireVisibleTarget
          ? eq(threads.visibility, "visible")
          : undefined,
        isNull(threads.deletedAt),
        isNull(projects.deletedAt),
      ),
    )
    .get();
  if (!target) {
    if (args.requireVisibleTarget) {
      tx.update(threadFacetReconciliationTargets)
        .set({ discharged: true })
        .where(
          and(
            reconciliationTargetWhere({ key, generation: args.generation }),
            eq(threadFacetReconciliationTargets.threadId, args.threadId),
          ),
        )
        .run();
      return "thread_unavailable";
    }
    throw new ThreadFacetInvariantError("thread_unavailable");
  }
  const members = validateReplacementMembers(
    declaration,
    args.members,
    args.maximumMembers,
  );
  const now = Date.now();
  const targetWhere = and(
    eq(threadFacetRelations.typeScope, key.typeScope),
    eq(threadFacetRelations.typeOwner, key.typeOwner),
    eq(threadFacetRelations.localName, key.localName),
    eq(threadFacetRelations.assignmentScope, "shared-thread"),
    eq(threadFacetRelations.threadId, args.threadId),
  );
  tx.delete(threadFacetRelations).where(targetWhere).run();
  if (members.length > 0) {
    tx.insert(threadFacetRelations)
      .values(
        members.map((memberId) => ({
          typeScope: key.typeScope,
          typeOwner: key.typeOwner,
          localName: key.localName,
          assignmentScope: "shared-thread" as const,
          threadId: args.threadId,
          memberId,
          updatedAt: now,
        })),
      )
      .run();
  }
  tx.insert(threadFacetSnapshots)
    .values({
      typeScope: key.typeScope,
      typeOwner: key.typeOwner,
      localName: key.localName,
      assignmentScope: "shared-thread",
      threadId: args.threadId,
      ownerGeneration: args.generation,
      sourceVersion: args.sourceVersion ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        threadFacetSnapshots.typeScope,
        threadFacetSnapshots.typeOwner,
        threadFacetSnapshots.localName,
        threadFacetSnapshots.assignmentScope,
        threadFacetSnapshots.threadId,
      ],
      set: {
        ownerGeneration: args.generation,
        sourceVersion: args.sourceVersion ?? null,
        updatedAt: now,
      },
    })
    .run();
  tx.update(threadFacetReconciliationTargets)
    .set({ discharged: true })
    .where(
      and(
        eq(threadFacetReconciliationTargets.typeScope, key.typeScope),
        eq(threadFacetReconciliationTargets.typeOwner, key.typeOwner),
        eq(threadFacetReconciliationTargets.localName, key.localName),
        eq(threadFacetReconciliationTargets.assignmentScope, "shared-thread"),
        eq(threadFacetReconciliationTargets.ownerGeneration, args.generation),
        eq(threadFacetReconciliationTargets.threadId, args.threadId),
      ),
    )
    .run();
  tx.update(threadFacetOwners)
    .set({
      projectionRevision: sql`${threadFacetOwners.projectionRevision} + 1`,
      updatedAt: now,
    })
    .where(
      and(ownerWhere(key), eq(threadFacetOwners.generation, args.generation)),
    )
    .run();
  return "replaced";
}

export function replaceThreadFacetRelationsInGeneration(
  db: DbConnection,
  args: ReplaceThreadFacetRelationsArgs,
): void {
  const result = db.transaction(
    (tx) =>
      replaceRelationsInTransaction(tx, {
        ...args,
        maximumMembers: THREAD_FACET_PLUGIN_REPLACEMENT_MEMBER_LIMIT,
        requireVisibleTarget: true,
      }),
    { behavior: "immediate" },
  );
  if (result === "thread_unavailable") {
    throw new ThreadFacetInvariantError("thread_unavailable");
  }
}

function publicThreadFacetTargetExistsExpression() {
  return sql<boolean>`exists (
    select 1
    from ${threads} as public_facet_target_thread
    inner join ${projects} as public_facet_target_project
      on public_facet_target_project.id = public_facet_target_thread.project_id
    where public_facet_target_thread.id = ${threadFacetReconciliationTargets.threadId}
      and public_facet_target_thread.visibility = 'visible'
      and public_facet_target_thread.deleted_at is null
      and public_facet_target_project.deleted_at is null
  )`;
}

function isPublicThreadFacetTarget(
  db: DbQueryConnection,
  threadId: string,
): boolean {
  return (
    db
      .select({ id: threads.id })
      .from(threads)
      .innerJoin(projects, eq(projects.id, threads.projectId))
      .where(
        and(
          eq(threads.id, threadId),
          eq(threads.visibility, "visible"),
          isNull(threads.deletedAt),
          isNull(projects.deletedAt),
        ),
      )
      .get() !== undefined
  );
}

function reconciliationTargetWhere(args: {
  generation: number;
  key: FacetTypeKey;
}) {
  return and(
    eq(threadFacetReconciliationTargets.typeScope, args.key.typeScope),
    eq(threadFacetReconciliationTargets.typeOwner, args.key.typeOwner),
    eq(threadFacetReconciliationTargets.localName, args.key.localName),
    eq(threadFacetReconciliationTargets.assignmentScope, "shared-thread"),
    eq(threadFacetReconciliationTargets.ownerGeneration, args.generation),
  );
}

function dischargeIneligibleReconciliationTargets(
  db: DbTransaction,
  args: { generation: number; key: FacetTypeKey },
): void {
  db.update(threadFacetReconciliationTargets)
    .set({ discharged: true })
    .where(
      and(
        reconciliationTargetWhere(args),
        eq(threadFacetReconciliationTargets.discharged, false),
        not(publicThreadFacetTargetExistsExpression()),
      ),
    )
    .run();
}

export function waiveThreadFacetReconciliationTargetIfIneligible(
  db: DbConnection,
  args: { generation: number; threadId: string; typeId: ThreadFacetTypeId },
): boolean {
  return db.transaction(
    (tx) => {
      requireCurrentGeneration(tx, args);
      if (isPublicThreadFacetTarget(tx, args.threadId)) {
        return false;
      }
      const key = facetTypeKey(args.typeId);
      return (
        tx
          .update(threadFacetReconciliationTargets)
          .set({ discharged: true })
          .where(
            and(
              reconciliationTargetWhere({
                key,
                generation: args.generation,
              }),
              eq(threadFacetReconciliationTargets.threadId, args.threadId),
            ),
          )
          .returning({
            threadId: threadFacetReconciliationTargets.threadId,
          })
          .get() !== undefined
      );
    },
    { behavior: "immediate" },
  );
}

export function listPriorThreadFacetSnapshotTargets(
  db: DbConnection,
  args: ListPriorThreadFacetSnapshotTargetsArgs,
): PriorThreadFacetSnapshotTargetPage {
  requireCurrentGeneration(db, args);
  const key = facetTypeKey(args.typeId);
  const limit = Math.min(
    Math.max(args.limit, 1),
    THREAD_FACET_CENSUS_PAGE_LIMIT,
  );
  return db.transaction(
    (tx) => {
      requireCurrentGeneration(tx, args);
      const rows = tx
        .select({
          threadId: threadFacetReconciliationTargets.threadId,
          discharged: threadFacetReconciliationTargets.discharged,
          eligible: publicThreadFacetTargetExistsExpression(),
        })
        .from(threadFacetReconciliationTargets)
        .where(
          and(
            reconciliationTargetWhere({ key, generation: args.generation }),
            args.afterThreadId === undefined
              ? undefined
              : gt(
                  threadFacetReconciliationTargets.threadId,
                  args.afterThreadId,
                ),
          ),
        )
        .orderBy(asc(threadFacetReconciliationTargets.threadId))
        .limit(limit + 1)
        .all();
      const page = rows.slice(0, limit);
      const ineligibleThreadIds = page
        .filter(({ eligible }) => !eligible)
        .map(({ threadId }) => threadId);
      if (ineligibleThreadIds.length > 0) {
        tx.update(threadFacetReconciliationTargets)
          .set({ discharged: true })
          .where(
            and(
              reconciliationTargetWhere({
                key,
                generation: args.generation,
              }),
              inArray(
                threadFacetReconciliationTargets.threadId,
                ineligibleThreadIds,
              ),
            ),
          )
          .run();
      }
      const nextAfterThreadId =
        rows.length > limit ? (page.at(-1)?.threadId ?? null) : null;
      if (nextAfterThreadId === null) {
        tx.update(threadFacetOwners)
          .set({ censusTerminalDelivered: true, updatedAt: Date.now() })
          .where(
            and(
              ownerWhere(key),
              eq(threadFacetOwners.generation, args.generation),
              eq(threadFacetOwners.state, "reconciling"),
            ),
          )
          .run();
      }
      return {
        threadIds: page
          .filter(({ discharged, eligible }) => !discharged && eligible)
          .map(({ threadId }) => threadId),
        nextAfterThreadId,
      };
    },
    { behavior: "immediate" },
  );
}

export function recordThreadFacetCensusExhausted(
  db: DbConnection,
  args: { generation: number; typeId: ThreadFacetTypeId },
): void {
  db.transaction(
    (tx) => {
      const owner = requireCurrentGeneration(tx, args);
      if (owner.state !== "reconciling") {
        throw new ThreadFacetInvariantError("stale_generation");
      }
      if (!owner.censusTerminalDelivered) {
        throw new ThreadFacetInvariantError("census_not_exhausted");
      }
      const key = facetTypeKey(args.typeId);
      tx.update(threadFacetOwners)
        .set({ censusExhausted: true, updatedAt: Date.now() })
        .where(
          and(
            ownerWhere(key),
            eq(threadFacetOwners.generation, args.generation),
          ),
        )
        .run();
    },
    { behavior: "immediate" },
  );
}

function hasUndischargedReconciliationTargets(
  db: DbQueryConnection,
  args: { generation: number; typeId: ThreadFacetTypeId },
): boolean {
  const key = facetTypeKey(args.typeId);
  return (
    db
      .select({ threadId: threadFacetReconciliationTargets.threadId })
      .from(threadFacetReconciliationTargets)
      .where(
        and(
          reconciliationTargetWhere({ key, generation: args.generation }),
          eq(threadFacetReconciliationTargets.discharged, false),
        ),
      )
      .limit(1)
      .get() !== undefined
  );
}

export function markThreadFacetOwnerGenerationReady(
  db: DbConnection,
  args: { generation: number; typeId: ThreadFacetTypeId },
): void {
  db.transaction(
    (tx) => {
      const owner = requireCurrentGeneration(tx, args);
      if (owner.state !== "reconciling") {
        throw new ThreadFacetInvariantError("stale_generation");
      }
      if (!owner.censusExhausted) {
        throw new ThreadFacetInvariantError("census_not_exhausted");
      }
      dischargeIneligibleReconciliationTargets(tx, {
        key: facetTypeKey(args.typeId),
        generation: args.generation,
      });
      if (hasUndischargedReconciliationTargets(tx, args)) {
        throw new ThreadFacetInvariantError("prior_snapshots_remaining");
      }
      const key = facetTypeKey(args.typeId);
      tx.update(threadFacetOwners)
        .set({ state: "ready", updatedAt: Date.now() })
        .where(
          and(
            ownerWhere(key),
            eq(threadFacetOwners.generation, args.generation),
          ),
        )
        .run();
    },
    { behavior: "immediate" },
  );
}

export function markThreadFacetOwnerUnavailable(
  db: DbConnection,
  args: { typeId: ThreadFacetTypeId },
): void {
  requireDeclaration(db, args.typeId);
  const key = facetTypeKey(args.typeId);
  db.update(threadFacetOwners)
    .set({ state: "unavailable", updatedAt: Date.now() })
    .where(ownerWhere(key))
    .run();
}

export function markThreadFacetOwnerGenerationUnavailable(
  db: DbConnection,
  args: { generation: number; typeId: ThreadFacetTypeId },
): void {
  requireDeclaration(db, args.typeId);
  const key = facetTypeKey(args.typeId);
  db.update(threadFacetOwners)
    .set({ state: "unavailable", updatedAt: Date.now() })
    .where(
      and(ownerWhere(key), eq(threadFacetOwners.generation, args.generation)),
    )
    .run();
}

function ensureCoreParticipantsDeclaration(tx: DbTransaction): void {
  const key = facetTypeKey(CORE_PARTICIPANTS_FACET_TYPE_ID);
  const now = Date.now();
  tx.insert(threadFacetDeclarations)
    .values({
      typeScope: key.typeScope,
      typeOwner: key.typeOwner,
      localName: key.localName,
      memberKind: "principal-key",
      cardinality: "many",
      assignmentScope: "shared-thread",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .run();
  tx.insert(threadFacetOwners)
    .values({
      typeScope: key.typeScope,
      typeOwner: key.typeOwner,
      localName: key.localName,
      assignmentScope: "shared-thread",
      generation: 1,
      state: "ready",
      censusExhausted: true,
      censusTerminalDelivered: true,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .run();
}

interface ProjectedParticipant {
  imageUrl: string | null;
  memberId: string;
  name: string;
}

interface CoreParticipantSourceVersionRow {
  sourceVersion: number;
  threadId: string;
}

function listCoreParticipantSourceVersions(
  db: DbQueryConnection,
  threadIds: readonly string[],
): Map<string, number> {
  const versions = new Map(threadIds.map((threadId) => [threadId, 0]));
  const rows = queryInSqliteVariableBatches({
    values: threadIds,
    dedupeKey: (threadId) => threadId,
    fixedVariableCount: CORE_PARTICIPANT_EVENT_TYPES.length,
    variableCountPerValue: 1,
    queryBatch: (threadIdBatch) =>
      db.all<CoreParticipantSourceVersionRow>(sql`
        SELECT
          ${events.threadId} AS threadId,
          MAX(${events.sequence}) AS sourceVersion
        FROM ${events} INDEXED BY events_thread_type_sequence_idx
        WHERE ${inArray(events.threadId, [...threadIdBatch])}
          AND ${inArray(events.type, [...CORE_PARTICIPANT_EVENT_TYPES])}
        GROUP BY ${events.threadId}
      `),
  });
  for (const row of rows) {
    versions.set(row.threadId, row.sourceVersion);
  }
  return versions;
}

function projectParticipantsByThreadId(
  db: DbQueryConnection,
  threadIds: readonly string[],
): Map<
  string,
  { participants: ProjectedParticipant[]; sourceVersion: number }
> {
  const projected = new Map<
    string,
    { participants: ProjectedParticipant[]; sourceVersion: number }
  >(
    threadIds.map((threadId) => [
      threadId,
      { participants: [], sourceVersion: 0 },
    ]),
  );
  const indexesByThreadId = new Map<string, Map<string, number>>();
  const rows = listStoredEventRowsByThreadIdsAndTypes(db, {
    threadIds,
    types: CORE_PARTICIPANT_EVENT_TYPES,
  });
  for (const row of rows) {
    const target = projected.get(row.threadId);
    if (target === undefined) {
      continue;
    }
    target.sourceVersion = Math.max(target.sourceVersion, row.sequence);
    const parsed = p6rActorSnapshotSchema.safeParse({
      p6rProviderId: row.p6rActorProviderId,
      p6rSubject: row.p6rActorSubject,
      p6rHandle: row.p6rActorHandle,
      p6rDisplayName: row.p6rActorDisplayName,
      p6rImageUrl: row.p6rActorImageUrl,
    });
    if (!parsed.success) {
      continue;
    }
    let memberId: string;
    try {
      memberId = p6rPrincipalKeyForActorSnapshot(parsed.data);
    } catch {
      continue;
    }
    const participant: ProjectedParticipant = {
      memberId,
      name: parsed.data.p6rDisplayName,
      imageUrl: parsed.data.p6rImageUrl,
    };
    const indexes = indexesByThreadId.get(row.threadId);
    if (indexes === undefined) {
      indexesByThreadId.set(row.threadId, new Map([[memberId, 0]]));
      target.participants.push(participant);
      continue;
    }
    const priorIndex = indexes.get(memberId);
    if (priorIndex === undefined) {
      indexes.set(memberId, target.participants.length);
      target.participants.push(participant);
    } else {
      target.participants[priorIndex] = participant;
    }
  }
  return projected;
}

export function ensureCoreParticipantsProjection(
  db: DbConnection,
  threadIds: readonly string[],
): void {
  if (threadIds.length === 0) {
    return;
  }
  const persistedThreadIds = queryInSqliteVariableBatches({
    values: threadIds,
    dedupeKey: (threadId) => threadId,
    fixedVariableCount: 0,
    variableCountPerValue: 1,
    queryBatch: (threadIdBatch) =>
      db
        .select({ threadId: threads.id })
        .from(threads)
        .where(
          and(
            inArray(threads.id, [...threadIdBatch]),
            isNull(threads.deletedAt),
          ),
        )
        .all()
        .map(({ threadId }) => threadId),
  });
  if (persistedThreadIds.length === 0) {
    return;
  }
  const key = facetTypeKey(CORE_PARTICIPANTS_FACET_TYPE_ID);
  const sourceVersions = listCoreParticipantSourceVersions(
    db,
    persistedThreadIds,
  );
  const snapshotVersions = new Map(
    queryInSqliteVariableBatches({
      values: persistedThreadIds,
      dedupeKey: (threadId) => threadId,
      fixedVariableCount: 4,
      variableCountPerValue: 1,
      queryBatch: (threadIdBatch) =>
        db
          .select({
            generation: threadFacetSnapshots.ownerGeneration,
            sourceVersion: threadFacetSnapshots.sourceVersion,
            threadId: threadFacetSnapshots.threadId,
          })
          .from(threadFacetSnapshots)
          .where(
            and(
              eq(threadFacetSnapshots.typeScope, key.typeScope),
              eq(threadFacetSnapshots.typeOwner, key.typeOwner),
              eq(threadFacetSnapshots.localName, key.localName),
              eq(threadFacetSnapshots.assignmentScope, "shared-thread"),
              inArray(threadFacetSnapshots.threadId, [...threadIdBatch]),
            ),
          )
          .all(),
    }).map((row) => [row.threadId, row] as const),
  );
  const staleThreadIds = persistedThreadIds.filter((threadId) => {
    const snapshot = snapshotVersions.get(threadId);
    return (
      snapshot?.generation !== 1 ||
      snapshot.sourceVersion !== sourceVersions.get(threadId)
    );
  });
  if (staleThreadIds.length === 0) {
    return;
  }
  const projected = projectParticipantsByThreadId(db, staleThreadIds);
  db.transaction(
    (tx) => {
      ensureCoreParticipantsDeclaration(tx);
      for (const threadId of staleThreadIds) {
        const target = projected.get(threadId);
        if (target === undefined) {
          continue;
        }
        replaceRelationsInTransaction(tx, {
          typeId: CORE_PARTICIPANTS_FACET_TYPE_ID,
          generation: 1,
          threadId,
          members: target.participants.map(({ memberId }) => memberId),
          maximumMembers: null,
          requireVisibleTarget: false,
          sourceVersion: target.sourceVersion,
        });
        tx.delete(threadFacetPrincipalProfiles)
          .where(
            and(
              eq(threadFacetPrincipalProfiles.typeScope, key.typeScope),
              eq(threadFacetPrincipalProfiles.typeOwner, key.typeOwner),
              eq(threadFacetPrincipalProfiles.localName, key.localName),
              eq(threadFacetPrincipalProfiles.assignmentScope, "shared-thread"),
              eq(threadFacetPrincipalProfiles.threadId, threadId),
            ),
          )
          .run();
        if (target.participants.length > 0) {
          const now = Date.now();
          tx.insert(threadFacetPrincipalProfiles)
            .values(
              target.participants.map((participant, memberPosition) => ({
                typeScope: key.typeScope,
                typeOwner: key.typeOwner,
                localName: key.localName,
                assignmentScope: "shared-thread" as const,
                threadId,
                principalKey: participant.memberId,
                memberPosition,
                displayName: participant.name,
                imageUrl: participant.imageUrl,
                updatedAt: now,
              })),
            )
            .run();
        }
      }
    },
    { behavior: "immediate" },
  );
}

export function listCoreParticipantProfilesByThreadIds(
  db: DbQueryConnection,
  threadIds: readonly string[],
): Map<string, P6rThreadParticipantProfile[]> {
  const result = new Map<string, P6rThreadParticipantProfile[]>();
  if (threadIds.length === 0) {
    return result;
  }
  const key = facetTypeKey(CORE_PARTICIPANTS_FACET_TYPE_ID);
  const rows = queryInSqliteVariableBatches({
    values: threadIds,
    dedupeKey: (threadId) => threadId,
    fixedVariableCount: 4,
    variableCountPerValue: 1,
    queryBatch: (threadIdBatch) =>
      db
        .select({
          threadId: threadFacetRelations.threadId,
          principalKey: threadFacetRelations.memberId,
          memberPosition: threadFacetPrincipalProfiles.memberPosition,
          displayName: threadFacetPrincipalProfiles.displayName,
          imageUrl: threadFacetPrincipalProfiles.imageUrl,
        })
        .from(threadFacetRelations)
        .innerJoin(
          threadFacetPrincipalProfiles,
          and(
            eq(
              threadFacetPrincipalProfiles.typeScope,
              threadFacetRelations.typeScope,
            ),
            eq(
              threadFacetPrincipalProfiles.typeOwner,
              threadFacetRelations.typeOwner,
            ),
            eq(
              threadFacetPrincipalProfiles.localName,
              threadFacetRelations.localName,
            ),
            eq(
              threadFacetPrincipalProfiles.assignmentScope,
              threadFacetRelations.assignmentScope,
            ),
            eq(
              threadFacetPrincipalProfiles.threadId,
              threadFacetRelations.threadId,
            ),
            eq(
              threadFacetPrincipalProfiles.principalKey,
              threadFacetRelations.memberId,
            ),
          ),
        )
        .where(
          and(
            eq(threadFacetRelations.typeScope, key.typeScope),
            eq(threadFacetRelations.typeOwner, key.typeOwner),
            eq(threadFacetRelations.localName, key.localName),
            eq(threadFacetRelations.assignmentScope, "shared-thread"),
            inArray(threadFacetRelations.threadId, [...threadIdBatch]),
          ),
        )
        .orderBy(
          asc(threadFacetRelations.threadId),
          asc(threadFacetPrincipalProfiles.memberPosition),
        )
        .all(),
  });
  rows.sort(
    (left, right) =>
      left.threadId.localeCompare(right.threadId) ||
      left.memberPosition - right.memberPosition,
  );
  for (const row of rows) {
    const profile: P6rThreadParticipantProfile = {
      p6rPrincipalKey: p6rPrincipalKeySchema.parse(row.principalKey),
      p6rDisplayName: row.displayName,
      p6rImageUrl: row.imageUrl,
    };
    const profiles = result.get(row.threadId);
    if (profiles) {
      profiles.push(profile);
    } else {
      result.set(row.threadId, [profile]);
    }
  }
  return result;
}

export function listCoreParticipantProfilePage(
  db: DbQueryConnection,
  args: { afterPosition?: number; pageSize: number; threadId: string },
): CoreParticipantProfilePage {
  const key = facetTypeKey(CORE_PARTICIPANTS_FACET_TYPE_ID);
  const totalCount =
    db
      .select({ count: sql<number>`count(*)` })
      .from(threadFacetRelations)
      .where(
        and(
          eq(threadFacetRelations.typeScope, key.typeScope),
          eq(threadFacetRelations.typeOwner, key.typeOwner),
          eq(threadFacetRelations.localName, key.localName),
          eq(threadFacetRelations.assignmentScope, "shared-thread"),
          eq(threadFacetRelations.threadId, args.threadId),
        ),
      )
      .get()?.count ?? 0;
  const pageSize = Math.min(Math.max(args.pageSize, 1), 100);
  const relation = alias(threadFacetRelations, "participant_page_relation");
  const profile = alias(
    threadFacetPrincipalProfiles,
    "participant_page_profile",
  );
  const rows = db
    .select({
      principalKey: relation.memberId,
      memberPosition: profile.memberPosition,
      displayName: profile.displayName,
      imageUrl: profile.imageUrl,
    })
    .from(relation)
    .innerJoin(
      profile,
      and(
        eq(profile.typeScope, relation.typeScope),
        eq(profile.typeOwner, relation.typeOwner),
        eq(profile.localName, relation.localName),
        eq(profile.assignmentScope, relation.assignmentScope),
        eq(profile.threadId, relation.threadId),
        eq(profile.principalKey, relation.memberId),
      ),
    )
    .where(
      and(
        eq(relation.typeScope, key.typeScope),
        eq(relation.typeOwner, key.typeOwner),
        eq(relation.localName, key.localName),
        eq(relation.assignmentScope, "shared-thread"),
        eq(relation.threadId, args.threadId),
        args.afterPosition === undefined
          ? undefined
          : gt(profile.memberPosition, args.afterPosition),
      ),
    )
    .orderBy(asc(profile.memberPosition))
    .limit(pageSize + 1)
    .all();
  const page = rows.slice(0, pageSize);
  return {
    totalCount,
    profiles: page.map((row) => ({
      p6rPrincipalKey: p6rPrincipalKeySchema.parse(row.principalKey),
      p6rDisplayName: row.displayName,
      p6rImageUrl: row.imageUrl,
    })),
    nextPosition:
      rows.length > pageSize ? (page.at(-1)?.memberPosition ?? null) : null,
  };
}

function relationExistsExpression(key: FacetTypeKey, member?: string) {
  return sql<boolean>`exists (
    select 1 from ${threadFacetRelations} where ${and(
      eq(threadFacetRelations.typeScope, key.typeScope),
      eq(threadFacetRelations.typeOwner, key.typeOwner),
      eq(threadFacetRelations.localName, key.localName),
      eq(threadFacetRelations.assignmentScope, "shared-thread"),
      eq(threadFacetRelations.threadId, threads.id),
      member === undefined
        ? undefined
        : eq(threadFacetRelations.memberId, member),
    )}
  )`;
}

function effectiveCompleteExpression(key: FacetTypeKey) {
  return sql<boolean>`exists (
    select 1 from ${threadFacetSnapshots}
      inner join ${threadFacetOwners} on ${and(
        eq(threadFacetOwners.typeScope, threadFacetSnapshots.typeScope),
        eq(threadFacetOwners.typeOwner, threadFacetSnapshots.typeOwner),
        eq(threadFacetOwners.localName, threadFacetSnapshots.localName),
        eq(
          threadFacetOwners.assignmentScope,
          threadFacetSnapshots.assignmentScope,
        ),
        eq(threadFacetOwners.generation, threadFacetSnapshots.ownerGeneration),
      )}
      where ${and(
        eq(threadFacetSnapshots.typeScope, key.typeScope),
        eq(threadFacetSnapshots.typeOwner, key.typeOwner),
        eq(threadFacetSnapshots.localName, key.localName),
        eq(threadFacetSnapshots.assignmentScope, "shared-thread"),
        eq(threadFacetSnapshots.threadId, threads.id),
        eq(threadFacetOwners.state, "ready"),
      )}
  )`;
}

function validateFacetFilter(
  db: DbQueryConnection,
  filter: ResolvedThreadFacetFilter,
) {
  const declaration = requireDeclaration(db, filter.typeId);
  if (filter.operator === "contains" || filter.operator === "notContains") {
    const member =
      declaration.memberKind === "principal-key"
        ? p6rPrincipalKeySchema.safeParse(filter.member)
        : threadFacetMemberIdSchema.safeParse(filter.member);
    if (
      !member.success ||
      (declaration.memberKind === "enum" &&
        !declaration.members.includes(member.data))
    ) {
      throw new ThreadFacetInvariantError("invalid_member");
    }
  }
  return declaration;
}

function filterExpression(
  db: DbQueryConnection,
  filter: ResolvedThreadFacetFilter,
) {
  validateFacetFilter(db, filter);
  const key = facetTypeKey(filter.typeId);
  switch (filter.operator) {
    case "present":
      return relationExistsExpression(key);
    case "contains":
      return relationExistsExpression(key, filter.member);
    case "absent":
      return and(
        effectiveCompleteExpression(key),
        not(relationExistsExpression(key)),
      );
    case "notContains":
      return and(
        effectiveCompleteExpression(key),
        not(relationExistsExpression(key, filter.member)),
      );
  }
}

function orderExpressions(db: DbQueryConnection, order: ThreadFacetOrder) {
  const declaration = requireDeclaration(db, order.typeId);
  if (declaration.memberKind !== "enum" || declaration.cardinality !== "one") {
    throw new ThreadFacetInvariantError("incompatible_declaration");
  }
  const key = facetTypeKey(order.typeId);
  const rank = sql<number | null>`(
    select ${threadFacetMembers.memberRank}
    from ${threadFacetRelations}
    inner join ${threadFacetMembers} on ${and(
      eq(threadFacetMembers.typeScope, threadFacetRelations.typeScope),
      eq(threadFacetMembers.typeOwner, threadFacetRelations.typeOwner),
      eq(threadFacetMembers.localName, threadFacetRelations.localName),
      eq(threadFacetMembers.memberId, threadFacetRelations.memberId),
    )}
    where ${and(
      eq(threadFacetRelations.typeScope, key.typeScope),
      eq(threadFacetRelations.typeOwner, key.typeOwner),
      eq(threadFacetRelations.localName, key.localName),
      eq(threadFacetRelations.assignmentScope, "shared-thread"),
      eq(threadFacetRelations.threadId, threads.id),
    )}
    limit 1
  )`;
  const present = relationExistsExpression(key);
  const complete = effectiveCompleteExpression(key);
  const rankedState =
    order.unknown === "first" && order.absent === "first"
      ? 2
      : order.unknown === "first" || order.absent === "first"
        ? 1
        : 0;
  const absentState = order.absent === "first" ? 0 : rankedState + 1;
  const unknownState =
    order.unknown === "first"
      ? 0
      : order.absent === "last"
        ? rankedState + 2
        : rankedState + 1;
  const adjustedAbsentState =
    order.unknown === "first" && order.absent === "first" ? 1 : absentState;
  const state = sql<number>`case
    when ${present} then ${rankedState}
    when ${complete} then ${adjustedAbsentState}
    else ${unknownState}
  end`;
  return { rank, state, rankedState };
}

function facetCursorCondition(args: {
  after: ThreadFacetQueryPosition;
  direction: "asc" | "desc";
  rank: ReturnType<typeof sql<number | null>>;
  state: ReturnType<typeof sql<number>>;
  rankedState: number;
}) {
  const afterState = args.after.state;
  if (afterState === null) {
    return undefined;
  }
  if (afterState !== args.rankedState) {
    return or(
      gt(args.state, afterState),
      and(eq(args.state, afterState), gt(threads.id, args.after.threadId)),
    );
  }
  const afterRank = args.after.rank;
  if (afterRank === null) {
    throw new ThreadFacetInvariantError("invalid_member");
  }
  const rankAfter =
    args.direction === "asc"
      ? gt(args.rank, afterRank)
      : lt(args.rank, afterRank);
  return or(
    gt(args.state, afterState),
    and(
      eq(args.state, afterState),
      or(
        rankAfter,
        and(eq(args.rank, afterRank), gt(threads.id, args.after.threadId)),
      ),
    ),
  );
}

export function queryThreadFacetThreadIds(
  db: DbQueryConnection,
  args: QueryThreadFacetIdsArgs,
): ThreadFacetIdPage {
  const filterConditions = args.filters.map((filter) =>
    filterExpression(db, filter),
  );
  const order = args.order ? orderExpressions(db, args.order) : null;
  const cursorCondition =
    args.after === undefined
      ? undefined
      : order === null
        ? or(
            lt(threads.updatedAt, args.after.updatedAt ?? -1),
            and(
              eq(threads.updatedAt, args.after.updatedAt ?? -1),
              gt(threads.id, args.after.threadId),
            ),
          )
        : facetCursorCondition({
            after: args.after,
            direction: args.order?.direction ?? "asc",
            ...order,
          });
  const pageSize = Math.min(Math.max(args.pageSize, 1), 100);
  const selected = db
    .select({
      threadId: threads.id,
      updatedAt: threads.updatedAt,
      state: order?.state ?? sql<null>`null`,
      rank: order?.rank ?? sql<null>`null`,
    })
    .from(threads)
    .where(
      and(
        isNull(threads.deletedAt),
        args.includeHidden ? undefined : eq(threads.visibility, "visible"),
        args.projectId ? eq(threads.projectId, args.projectId) : undefined,
        args.parentThreadId
          ? eq(threads.parentThreadId, args.parentThreadId)
          : undefined,
        args.sourceThreadId
          ? eq(threads.sourceThreadId, args.sourceThreadId)
          : undefined,
        args.sectionId ? eq(threads.sectionId, args.sectionId) : undefined,
        args.unsectioned === true ? isNull(threads.sectionId) : undefined,
        args.hasParent === true
          ? isNotNull(threads.parentThreadId)
          : args.hasParent === false
            ? isNull(threads.parentThreadId)
            : undefined,
        args.originKind ? eq(threads.originKind, args.originKind) : undefined,
        args.originPluginId
          ? eq(threads.originPluginId, args.originPluginId)
          : undefined,
        args.experimental_latestAttentionAtOrAfter === undefined
          ? undefined
          : gte(
              threads.latestAttentionAt,
              args.experimental_latestAttentionAtOrAfter,
            ),
        args.archived === true
          ? isNotNull(threads.archivedAt)
          : args.archived === false
            ? isNull(threads.archivedAt)
            : undefined,
        ...filterConditions,
        cursorCondition,
      ),
    )
    .orderBy(
      ...(order === null
        ? [desc(threads.updatedAt), asc(threads.id)]
        : [
            asc(order.state),
            args.order?.direction === "desc"
              ? desc(order.rank)
              : asc(order.rank),
            asc(threads.id),
          ]),
    )
    .limit(pageSize + 1)
    .all();
  const page = selected.slice(0, pageSize);
  return {
    hasMore: selected.length > pageSize,
    threadIds: page.map(({ threadId }) => threadId),
    positions: page.map((row) => ({
      threadId: row.threadId,
      updatedAt: order === null ? row.updatedAt : null,
      state: order === null ? null : row.state,
      rank: order === null ? null : row.rank,
    })),
  };
}

export function threadFacetCompletenessSignature(
  db: DbQueryConnection,
  typeIds: readonly ThreadFacetTypeId[],
): string {
  return listThreadFacetOwnerProjections(db, typeIds)
    .sort((left, right) => left.typeId.localeCompare(right.typeId))
    .map(
      ({ generation, ownerState, projectionRevision, typeId }) =>
        `${typeId}:${generation}:${ownerState}:${projectionRevision}`,
    )
    .join("|");
}

export function listThreadFacetOwnerProjections(
  db: DbQueryConnection,
  typeIds: readonly ThreadFacetTypeId[],
): ThreadFacetOwnerProjection[] {
  return [...new Set(typeIds)].map((typeId) => {
    requireDeclaration(db, typeId);
    const key = facetTypeKey(typeId);
    const owner = db
      .select({
        generation: threadFacetOwners.generation,
        ownerState: threadFacetOwners.state,
        projectionRevision: threadFacetOwners.projectionRevision,
      })
      .from(threadFacetOwners)
      .where(ownerWhere(key))
      .get();
    return {
      typeId,
      generation: owner?.generation ?? 0,
      ownerState: owner?.ownerState ?? "unavailable",
      projectionRevision: owner?.projectionRevision ?? 0,
    };
  });
}
