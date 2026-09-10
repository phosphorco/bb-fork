import { randomBytes } from "node:crypto";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  not,
  or,
  sql,
} from "drizzle-orm";
import {
  parseThreadFacetTypeId,
  serializeThreadFacetTypeId,
  threadFacetLocalNameSchema,
  type ResolvedThreadFacetFilter,
  type ThreadFacetAssignmentScope,
  type ThreadFacetCardinality,
  type ThreadFacetMemberKind,
  type ThreadFacetOwnerState,
  type ThreadFacetTypeId,
  type ThreadOriginKind,
} from "@bb/domain";
import type { DbConnection, DbQueryConnection } from "../connection.js";
import {
  threadFacetCursorKeys,
  threadFacetDeclarations,
  threadFacetMembers,
  threadFacetOwners,
  threadFacetPrincipalProfiles,
  threadFacetReconciliationTargets,
  threadFacetRelations,
  threadFacetSnapshots,
  threads,
} from "../schema.js";

export const THREAD_FACET_PLUGIN_REPLACEMENT_MEMBER_LIMIT = 64;

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
  }
}

interface FacetKey {
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

export interface ThreadFacetGeneration {
  generation: number;
  typeId: ThreadFacetTypeId;
}

export interface ThreadFacetQueryPosition {
  rank: number | null;
  state: number | null;
  threadId: string;
  updatedAt: number | null;
}

export interface ThreadFacetIdPage {
  hasMore: boolean;
  positions: readonly ThreadFacetQueryPosition[];
  threadIds: readonly string[];
}

export interface CoreParticipantProfile {
  imageUrl: string | null;
  identityKind: "external" | "person";
  p6rDisplayName: string;
  p6rPrincipalKey: string;
}

export interface CoreParticipantSummary {
  nextPosition: number | null;
  profiles: readonly CoreParticipantProfile[];
  totalCount: number;
}

function key(typeId: ThreadFacetTypeId): FacetKey {
  const parts = parseThreadFacetTypeId(typeId);
  return { localName: parts.localName, typeOwner: parts.owner, typeScope: parts.scope };
}

function declarationWhere(value: FacetKey) {
  return and(
    eq(threadFacetDeclarations.typeScope, value.typeScope),
    eq(threadFacetDeclarations.typeOwner, value.typeOwner),
    eq(threadFacetDeclarations.localName, value.localName),
  );
}

function ownerWhere(value: FacetKey) {
  return and(
    eq(threadFacetOwners.typeScope, value.typeScope),
    eq(threadFacetOwners.typeOwner, value.typeOwner),
    eq(threadFacetOwners.localName, value.localName),
    eq(threadFacetOwners.assignmentScope, "shared-thread"),
  );
}

function declarationFromRow(
  db: DbQueryConnection,
  typeId: ThreadFacetTypeId,
): ThreadFacetDeclaration {
  const facetKey = key(typeId);
  const row = db.select().from(threadFacetDeclarations).where(declarationWhere(facetKey)).get();
  if (row === undefined) throw new ThreadFacetInvariantError("facet_unavailable");
  const memberRows = db.select({ memberId: threadFacetMembers.memberId })
    .from(threadFacetMembers)
    .where(and(
      eq(threadFacetMembers.typeScope, facetKey.typeScope),
      eq(threadFacetMembers.typeOwner, facetKey.typeOwner),
      eq(threadFacetMembers.localName, facetKey.localName),
    ))
    .orderBy(asc(threadFacetMembers.memberRank))
    .all();
  return {
    assignmentScope: row.assignmentScope,
    cardinality: row.cardinality,
    memberKind: row.memberKind,
    members: memberRows.map((member) => member.memberId),
    typeId,
  };
}

export function getOrCreateThreadFacetCursorSigningKey(db: DbConnection): string {
  return db.transaction((tx) => {
    tx.insert(threadFacetCursorKeys).values({
      keyId: "primary",
      secret: randomBytes(32).toString("hex"),
      createdAt: Date.now(),
    }).onConflictDoNothing().run();
    const value = tx.select({ secret: threadFacetCursorKeys.secret })
      .from(threadFacetCursorKeys)
      .where(eq(threadFacetCursorKeys.keyId, "primary"))
      .get();
    if (value === undefined) throw new Error("Facet cursor signing key was not persisted");
    return value.secret;
  }, { behavior: "immediate" });
}

export function activatePluginThreadFacetDeclarations(
  db: DbConnection,
  args: {
    declarations: readonly {
      assignmentScope: "shared-thread";
      cardinality: ThreadFacetCardinality;
      localName: string;
      memberKind: "enum";
      members: readonly string[];
    }[];
    ownerPluginId: string;
  },
): readonly { declaration: ThreadFacetDeclaration; generation: number }[] {
  return db.transaction((tx) => {
    const now = Date.now();
    const activated: Array<{ declaration: ThreadFacetDeclaration; generation: number }> = [];
    for (const staged of args.declarations) {
      const localName = threadFacetLocalNameSchema.parse(staged.localName);
      const members = [...staged.members];
      if (members.length > THREAD_FACET_PLUGIN_REPLACEMENT_MEMBER_LIMIT || new Set(members).size !== members.length) {
        throw new ThreadFacetInvariantError("invalid_member");
      }
      if (members.some((member) => !threadFacetLocalNameSchema.safeParse(member).success)) {
        throw new ThreadFacetInvariantError("invalid_member");
      }
      const typeId = serializeThreadFacetTypeId({
        scope: "plugin",
        owner: args.ownerPluginId,
        localName,
      });
      const facetKey = key(typeId);
      const prior = tx.select().from(threadFacetOwners).where(ownerWhere(facetKey)).get();
      const generation = (prior?.generation ?? 0) + 1;
      tx.insert(threadFacetDeclarations).values({
        typeScope: facetKey.typeScope,
        typeOwner: facetKey.typeOwner,
        localName: facetKey.localName,
        memberKind: staged.memberKind,
        cardinality: staged.cardinality,
        assignmentScope: staged.assignmentScope,
        createdAt: now,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: [threadFacetDeclarations.typeScope, threadFacetDeclarations.typeOwner, threadFacetDeclarations.localName],
        set: { memberKind: staged.memberKind, cardinality: staged.cardinality, assignmentScope: staged.assignmentScope, updatedAt: now },
      }).run();
      tx.delete(threadFacetMembers).where(and(
        eq(threadFacetMembers.typeScope, facetKey.typeScope), eq(threadFacetMembers.typeOwner, facetKey.typeOwner), eq(threadFacetMembers.localName, facetKey.localName),
      )).run();
      if (members.length > 0) tx.insert(threadFacetMembers).values(members.map((memberId, memberRank) => ({
        typeScope: facetKey.typeScope, typeOwner: facetKey.typeOwner, localName: facetKey.localName, memberId, memberRank, createdAt: now,
      }))).run();
      tx.insert(threadFacetOwners).values({
        typeScope: facetKey.typeScope, typeOwner: facetKey.typeOwner, localName: facetKey.localName,
        assignmentScope: "shared-thread", generation, state: "reconciling", censusExhausted: false, censusTerminalDelivered: false, projectionRevision: (prior?.projectionRevision ?? 0) + 1, updatedAt: now,
      }).onConflictDoUpdate({
        target: [threadFacetOwners.typeScope, threadFacetOwners.typeOwner, threadFacetOwners.localName, threadFacetOwners.assignmentScope],
        set: { generation, state: "reconciling", censusExhausted: false, censusTerminalDelivered: false, projectionRevision: (prior?.projectionRevision ?? 0) + 1, updatedAt: now },
      }).run();
      const priorTargets = tx.select({ threadId: threadFacetSnapshots.threadId }).from(threadFacetSnapshots).where(and(
        eq(threadFacetSnapshots.typeScope, facetKey.typeScope), eq(threadFacetSnapshots.typeOwner, facetKey.typeOwner), eq(threadFacetSnapshots.localName, facetKey.localName), eq(threadFacetSnapshots.assignmentScope, "shared-thread"),
      )).all();
      if (priorTargets.length > 0) tx.insert(threadFacetReconciliationTargets).values(priorTargets.map(({ threadId }) => ({
        typeScope: facetKey.typeScope, typeOwner: facetKey.typeOwner, localName: facetKey.localName, assignmentScope: "shared-thread" as const, ownerGeneration: generation, threadId, discharged: false,
      }))).onConflictDoNothing().run();
      activated.push({ declaration: declarationFromRow(tx, typeId), generation });
    }
    return activated;
  }, { behavior: "immediate" });
}

function requireGeneration(db: DbQueryConnection, input: ThreadFacetGeneration): FacetKey {
  const facetKey = key(input.typeId);
  const owner = db.select().from(threadFacetOwners).where(ownerWhere(facetKey)).get();
  if (owner === undefined || owner.generation !== input.generation) throw new ThreadFacetInvariantError("stale_generation");
  if (owner.state === "unavailable") throw new ThreadFacetInvariantError("facet_unavailable");
  return facetKey;
}

export function replaceThreadFacetRelationsInGeneration(
  db: DbConnection,
  args: ThreadFacetGeneration & { members: readonly string[]; threadId: string },
): void {
  db.transaction((tx) => {
    const facetKey = requireGeneration(tx, args);
    const declaration = declarationFromRow(tx, args.typeId);
    if (new Set(args.members).size !== args.members.length) throw new ThreadFacetInvariantError("duplicate_member");
    if (declaration.cardinality === "one" && args.members.length > 1) throw new ThreadFacetInvariantError("cardinality_exceeded");
    if (args.members.some((member) => !declaration.members.includes(member))) throw new ThreadFacetInvariantError("invalid_member");
    const thread = tx.select({ id: threads.id }).from(threads).where(and(eq(threads.id, args.threadId), isNull(threads.deletedAt), eq(threads.visibility, "visible"))).get();
    if (thread === undefined) throw new ThreadFacetInvariantError("thread_unavailable");
    tx.delete(threadFacetRelations).where(and(
      eq(threadFacetRelations.typeScope, facetKey.typeScope), eq(threadFacetRelations.typeOwner, facetKey.typeOwner), eq(threadFacetRelations.localName, facetKey.localName), eq(threadFacetRelations.assignmentScope, "shared-thread"), eq(threadFacetRelations.threadId, args.threadId),
    )).run();
    const now = Date.now();
    if (args.members.length > 0) tx.insert(threadFacetRelations).values(args.members.map((memberId) => ({
      typeScope: facetKey.typeScope, typeOwner: facetKey.typeOwner, localName: facetKey.localName, assignmentScope: "shared-thread" as const, threadId: args.threadId, memberId, updatedAt: now,
    }))).run();
    tx.insert(threadFacetSnapshots).values({
      typeScope: facetKey.typeScope, typeOwner: facetKey.typeOwner, localName: facetKey.localName, assignmentScope: "shared-thread", threadId: args.threadId, ownerGeneration: args.generation, sourceVersion: null, updatedAt: now,
    }).onConflictDoUpdate({ target: [threadFacetSnapshots.typeScope, threadFacetSnapshots.typeOwner, threadFacetSnapshots.localName, threadFacetSnapshots.assignmentScope, threadFacetSnapshots.threadId], set: { ownerGeneration: args.generation, sourceVersion: null, updatedAt: now } }).run();
    tx.update(threadFacetReconciliationTargets).set({ discharged: true }).where(and(
      eq(threadFacetReconciliationTargets.typeScope, facetKey.typeScope), eq(threadFacetReconciliationTargets.typeOwner, facetKey.typeOwner), eq(threadFacetReconciliationTargets.localName, facetKey.localName), eq(threadFacetReconciliationTargets.assignmentScope, "shared-thread"), eq(threadFacetReconciliationTargets.ownerGeneration, args.generation), eq(threadFacetReconciliationTargets.threadId, args.threadId),
    )).run();
  }, { behavior: "immediate" });
}

export function listPriorThreadFacetSnapshotTargets(
  db: DbQueryConnection,
  args: ThreadFacetGeneration & { afterThreadId?: string; limit: number },
): { nextAfterThreadId: string | null; threadIds: readonly string[] } {
  const facetKey = requireGeneration(db, args);
  const rows = db.select({ threadId: threadFacetReconciliationTargets.threadId }).from(threadFacetReconciliationTargets).where(and(
    eq(threadFacetReconciliationTargets.typeScope, facetKey.typeScope), eq(threadFacetReconciliationTargets.typeOwner, facetKey.typeOwner), eq(threadFacetReconciliationTargets.localName, facetKey.localName), eq(threadFacetReconciliationTargets.assignmentScope, "shared-thread"), eq(threadFacetReconciliationTargets.ownerGeneration, args.generation), eq(threadFacetReconciliationTargets.discharged, false), args.afterThreadId === undefined ? undefined : gt(threadFacetReconciliationTargets.threadId, args.afterThreadId),
  )).orderBy(asc(threadFacetReconciliationTargets.threadId)).limit(Math.min(Math.max(args.limit, 1), 100) + 1).all();
  const page = rows.slice(0, Math.min(Math.max(args.limit, 1), 100));
  return { threadIds: page.map(({ threadId }) => threadId), nextAfterThreadId: rows.length > page.length ? page.at(-1)?.threadId ?? null : null };
}

export function recordThreadFacetCensusExhausted(db: DbConnection, args: ThreadFacetGeneration): void {
  db.transaction((tx) => {
    const facetKey = requireGeneration(tx, args);
    tx.update(threadFacetOwners).set({ censusExhausted: true, censusTerminalDelivered: true, updatedAt: Date.now() }).where(ownerWhere(facetKey)).run();
  }, { behavior: "immediate" });
}

export function markThreadFacetOwnerGenerationReady(db: DbConnection, args: ThreadFacetGeneration): void {
  db.transaction((tx) => {
    const facetKey = requireGeneration(tx, args);
    const owner = tx.select().from(threadFacetOwners).where(ownerWhere(facetKey)).get();
    if (owner === undefined || !owner.censusExhausted || !owner.censusTerminalDelivered) throw new ThreadFacetInvariantError("census_not_exhausted");
    const outstanding = tx.select({ threadId: threadFacetReconciliationTargets.threadId }).from(threadFacetReconciliationTargets).where(and(
      eq(threadFacetReconciliationTargets.typeScope, facetKey.typeScope), eq(threadFacetReconciliationTargets.typeOwner, facetKey.typeOwner), eq(threadFacetReconciliationTargets.localName, facetKey.localName), eq(threadFacetReconciliationTargets.assignmentScope, "shared-thread"), eq(threadFacetReconciliationTargets.ownerGeneration, args.generation), eq(threadFacetReconciliationTargets.discharged, false),
    )).get();
    if (outstanding !== undefined) throw new ThreadFacetInvariantError("prior_snapshots_remaining");
    tx.update(threadFacetOwners).set({ state: "ready", projectionRevision: owner.projectionRevision + 1, updatedAt: Date.now() }).where(ownerWhere(facetKey)).run();
  }, { behavior: "immediate" });
}

export function markThreadFacetOwnerGenerationUnavailable(db: DbConnection, args: ThreadFacetGeneration): void {
  db.transaction((tx) => {
    const facetKey = requireGeneration(tx, args);
    tx.update(threadFacetOwners).set({ state: "unavailable", updatedAt: Date.now() }).where(ownerWhere(facetKey)).run();
  }, { behavior: "immediate" });
}

export function listThreadFacetOwnerProjections(db: DbQueryConnection, typeIds: readonly ThreadFacetTypeId[]): Array<{ generation: number; ownerState: ThreadFacetOwnerState; projectionRevision: number; typeId: ThreadFacetTypeId }> {
  return typeIds.map((typeId) => {
    const facetKey = key(typeId);
    const row = db.select().from(threadFacetOwners).where(ownerWhere(facetKey)).get();
    if (row === undefined) return { typeId, generation: 0, ownerState: "unavailable", projectionRevision: 0 };
    return { typeId, generation: row.generation, ownerState: row.state, projectionRevision: row.projectionRevision };
  });
}

export function replaceCoreParticipantProfilesInTransaction(db: DbQueryConnection, input: { profiles: readonly CoreParticipantProfile[]; sourceVersion: number; threadId: string }): void {
    const now = Date.now();
    db.insert(threadFacetDeclarations).values({ typeScope: "core", typeOwner: "core", localName: "participants", memberKind: "principal-key", cardinality: "many", assignmentScope: "shared-thread", createdAt: now, updatedAt: now }).onConflictDoNothing().run();
    db.insert(threadFacetOwners).values({ typeScope: "core", typeOwner: "core", localName: "participants", assignmentScope: "shared-thread", generation: 1, state: "ready", censusExhausted: true, censusTerminalDelivered: true, projectionRevision: 1, updatedAt: now }).onConflictDoNothing().run();
    db.delete(threadFacetRelations).where(and(eq(threadFacetRelations.typeScope, "core"), eq(threadFacetRelations.typeOwner, "core"), eq(threadFacetRelations.localName, "participants"), eq(threadFacetRelations.assignmentScope, "shared-thread"), eq(threadFacetRelations.threadId, input.threadId))).run();
    db.delete(threadFacetPrincipalProfiles).where(and(eq(threadFacetPrincipalProfiles.typeScope, "core"), eq(threadFacetPrincipalProfiles.typeOwner, "core"), eq(threadFacetPrincipalProfiles.localName, "participants"), eq(threadFacetPrincipalProfiles.assignmentScope, "shared-thread"), eq(threadFacetPrincipalProfiles.threadId, input.threadId))).run();
    if (input.profiles.length > 0) {
      db.insert(threadFacetRelations).values(input.profiles.map((profile) => ({ typeScope: "core" as const, typeOwner: "core", localName: "participants", assignmentScope: "shared-thread" as const, threadId: input.threadId, memberId: profile.p6rPrincipalKey, updatedAt: now }))).run();
      db.insert(threadFacetPrincipalProfiles).values(input.profiles.map((profile, memberPosition) => ({ typeScope: "core" as const, typeOwner: "core", localName: "participants", assignmentScope: "shared-thread" as const, threadId: input.threadId, principalKey: profile.p6rPrincipalKey, identityKind: profile.identityKind, memberPosition, displayName: profile.p6rDisplayName, imageUrl: profile.imageUrl, updatedAt: now }))).run();
    }
    db.insert(threadFacetSnapshots).values({ typeScope: "core", typeOwner: "core", localName: "participants", assignmentScope: "shared-thread", threadId: input.threadId, ownerGeneration: 1, sourceVersion: input.sourceVersion, updatedAt: now }).onConflictDoUpdate({ target: [threadFacetSnapshots.typeScope, threadFacetSnapshots.typeOwner, threadFacetSnapshots.localName, threadFacetSnapshots.assignmentScope, threadFacetSnapshots.threadId], set: { sourceVersion: input.sourceVersion, updatedAt: now } }).run();
}

export function replaceCoreParticipantProfiles(db: DbConnection, input: { profiles: readonly CoreParticipantProfile[]; sourceVersion: number; threadId: string }): void {
  db.transaction((tx) => replaceCoreParticipantProfilesInTransaction(tx, input), { behavior: "immediate" });
}

export function replaceCoreParticipantProfilesBatch(db: DbConnection, inputs: readonly { profiles: readonly CoreParticipantProfile[]; sourceVersion: number; threadId: string }[]): void {
  db.transaction((tx) => {
    for (const input of inputs) replaceCoreParticipantProfilesInTransaction(tx, input);
  }, { behavior: "immediate" });
}

export function listCoreParticipantProfilesByThreadIds(db: DbQueryConnection, threadIds: readonly string[]): Map<string, CoreParticipantProfile[]> {
  const result = new Map<string, CoreParticipantProfile[]>();
  if (threadIds.length === 0) return result;
  const rows = db.select({ threadId: threadFacetPrincipalProfiles.threadId, p6rPrincipalKey: threadFacetPrincipalProfiles.principalKey, identityKind: threadFacetPrincipalProfiles.identityKind, p6rDisplayName: threadFacetPrincipalProfiles.displayName, imageUrl: threadFacetPrincipalProfiles.imageUrl }).from(threadFacetPrincipalProfiles).where(and(eq(threadFacetPrincipalProfiles.typeScope, "core"), eq(threadFacetPrincipalProfiles.typeOwner, "core"), eq(threadFacetPrincipalProfiles.localName, "participants"), eq(threadFacetPrincipalProfiles.assignmentScope, "shared-thread"), inArray(threadFacetPrincipalProfiles.threadId, [...new Set(threadIds)]))).orderBy(asc(threadFacetPrincipalProfiles.threadId), asc(threadFacetPrincipalProfiles.memberPosition)).all();
  for (const row of rows) {
    const profiles = result.get(row.threadId) ?? [];
    profiles.push({ p6rPrincipalKey: row.p6rPrincipalKey, identityKind: row.identityKind, p6rDisplayName: row.p6rDisplayName, imageUrl: row.imageUrl });
    result.set(row.threadId, profiles);
  }
  return result;
}

export function listCoreParticipantSummariesByThreadIds(
  db: DbQueryConnection,
  threadIds: readonly string[],
  pageSize: number,
): Map<string, CoreParticipantSummary> {
  const ids = [...new Set(threadIds)];
  const result = new Map<string, CoreParticipantSummary>();
  if (ids.length === 0) return result;
  const size = Math.min(Math.max(pageSize, 1), 100);
  const where = and(
    eq(threadFacetPrincipalProfiles.typeScope, "core"),
    eq(threadFacetPrincipalProfiles.typeOwner, "core"),
    eq(threadFacetPrincipalProfiles.localName, "participants"),
    eq(threadFacetPrincipalProfiles.assignmentScope, "shared-thread"),
    inArray(threadFacetPrincipalProfiles.threadId, ids),
  );
  const counts = db.select({
    threadId: threadFacetPrincipalProfiles.threadId,
    totalCount: sql<number>`count(*)`,
  }).from(threadFacetPrincipalProfiles).where(where)
    .groupBy(threadFacetPrincipalProfiles.threadId).all();
  const rows = db.select({
    threadId: threadFacetPrincipalProfiles.threadId,
    p6rPrincipalKey: threadFacetPrincipalProfiles.principalKey,
    identityKind: threadFacetPrincipalProfiles.identityKind,
    p6rDisplayName: threadFacetPrincipalProfiles.displayName,
    imageUrl: threadFacetPrincipalProfiles.imageUrl,
    position: threadFacetPrincipalProfiles.memberPosition,
  }).from(threadFacetPrincipalProfiles).where(and(where, lt(threadFacetPrincipalProfiles.memberPosition, size)))
    .orderBy(asc(threadFacetPrincipalProfiles.threadId), asc(threadFacetPrincipalProfiles.memberPosition)).all();
  const profilesByThreadId = new Map<string, Array<CoreParticipantProfile>>();
  for (const row of rows) {
    const profiles = profilesByThreadId.get(row.threadId) ?? [];
    profiles.push({
      p6rPrincipalKey: row.p6rPrincipalKey,
      identityKind: row.identityKind,
      p6rDisplayName: row.p6rDisplayName,
      imageUrl: row.imageUrl,
    });
    profilesByThreadId.set(row.threadId, profiles);
  }
  for (const threadId of ids) {
    const profiles = profilesByThreadId.get(threadId) ?? [];
    const totalCount = counts.find((count) => count.threadId === threadId)?.totalCount ?? 0;
    result.set(threadId, {
      totalCount,
      profiles,
      nextPosition: totalCount > profiles.length ? profiles.length - 1 : null,
    });
  }
  return result;
}

export function listCoreParticipantProfilePage(db: DbQueryConnection, args: { afterPosition?: number; pageSize: number; threadId: string }): { nextPosition: number | null; profiles: readonly CoreParticipantProfile[]; totalCount: number } {
  const count = db.select({ value: sql<number>`count(*)` }).from(threadFacetPrincipalProfiles).where(and(eq(threadFacetPrincipalProfiles.typeScope, "core"), eq(threadFacetPrincipalProfiles.typeOwner, "core"), eq(threadFacetPrincipalProfiles.localName, "participants"), eq(threadFacetPrincipalProfiles.assignmentScope, "shared-thread"), eq(threadFacetPrincipalProfiles.threadId, args.threadId))).get()?.value ?? 0;
  const rows = db.select({ p6rPrincipalKey: threadFacetPrincipalProfiles.principalKey, identityKind: threadFacetPrincipalProfiles.identityKind, p6rDisplayName: threadFacetPrincipalProfiles.displayName, imageUrl: threadFacetPrincipalProfiles.imageUrl, position: threadFacetPrincipalProfiles.memberPosition }).from(threadFacetPrincipalProfiles).where(and(eq(threadFacetPrincipalProfiles.typeScope, "core"), eq(threadFacetPrincipalProfiles.typeOwner, "core"), eq(threadFacetPrincipalProfiles.localName, "participants"), eq(threadFacetPrincipalProfiles.assignmentScope, "shared-thread"), eq(threadFacetPrincipalProfiles.threadId, args.threadId), args.afterPosition === undefined ? undefined : gt(threadFacetPrincipalProfiles.memberPosition, args.afterPosition))).orderBy(asc(threadFacetPrincipalProfiles.memberPosition)).limit(Math.min(Math.max(args.pageSize, 1), 100) + 1).all();
  const page = rows.slice(0, Math.min(Math.max(args.pageSize, 1), 100));
  return { totalCount: count, profiles: page.map(({ p6rPrincipalKey, identityKind, p6rDisplayName, imageUrl }) => ({ p6rPrincipalKey, identityKind, p6rDisplayName, imageUrl })), nextPosition: rows.length > page.length ? page.at(-1)?.position ?? null : null };
}

function relationExists(facetKey: FacetKey, member?: string) {
  return sql<boolean>`exists (select 1 from ${threadFacetRelations} where ${and(eq(threadFacetRelations.typeScope, facetKey.typeScope), eq(threadFacetRelations.typeOwner, facetKey.typeOwner), eq(threadFacetRelations.localName, facetKey.localName), eq(threadFacetRelations.assignmentScope, "shared-thread"), eq(threadFacetRelations.threadId, threads.id), member === undefined ? undefined : eq(threadFacetRelations.memberId, member))})`;
}

function completeExpression(facetKey: FacetKey) {
  return sql<boolean>`exists (select 1 from ${threadFacetSnapshots} inner join ${threadFacetOwners} on ${and(eq(threadFacetOwners.typeScope, threadFacetSnapshots.typeScope), eq(threadFacetOwners.typeOwner, threadFacetSnapshots.typeOwner), eq(threadFacetOwners.localName, threadFacetSnapshots.localName), eq(threadFacetOwners.assignmentScope, threadFacetSnapshots.assignmentScope), eq(threadFacetOwners.generation, threadFacetSnapshots.ownerGeneration))} where ${and(eq(threadFacetSnapshots.typeScope, facetKey.typeScope), eq(threadFacetSnapshots.typeOwner, facetKey.typeOwner), eq(threadFacetSnapshots.localName, facetKey.localName), eq(threadFacetSnapshots.assignmentScope, "shared-thread"), eq(threadFacetSnapshots.threadId, threads.id), eq(threadFacetOwners.state, "ready"))})`;
}

function filterExpression(db: DbQueryConnection, filter: ResolvedThreadFacetFilter) {
  const declaration = declarationFromRow(db, filter.typeId);
  const facetKey = key(filter.typeId);
  if ((filter.operator === "contains" || filter.operator === "notContains") && (filter.member.length === 0 || (declaration.memberKind === "enum" && !declaration.members.includes(filter.member)))) throw new ThreadFacetInvariantError("invalid_member");
  if (filter.operator === "present") return relationExists(facetKey);
  if (filter.operator === "absent") return and(completeExpression(facetKey), not(relationExists(facetKey)));
  if (filter.operator === "contains") return relationExists(facetKey, filter.member);
  return and(completeExpression(facetKey), not(relationExists(facetKey, filter.member)));
}

export function queryThreadFacetThreadIds(db: DbQueryConnection, args: { after?: ThreadFacetQueryPosition; archived?: boolean; filters: readonly ResolvedThreadFacetFilter[]; includeHidden: boolean; pageSize: number; projectId?: string; parentThreadId?: string; sourceThreadId?: string; sectionId?: string; unsectioned?: boolean; hasParent?: boolean; originKind?: ThreadOriginKind; originPluginId?: string; experimental_latestAttentionAtOrAfter?: number }): ThreadFacetIdPage {
  const conditions = args.filters.map((filter) => filterExpression(db, filter));
  const after = args.after;
  const cursor = after === undefined ? undefined : or(lt(threads.updatedAt, after.updatedAt ?? -1), and(eq(threads.updatedAt, after.updatedAt ?? -1), gt(threads.id, after.threadId)));
  const size = Math.min(Math.max(args.pageSize, 1), 100);
  const rows = db.select({ threadId: threads.id, updatedAt: threads.updatedAt }).from(threads).where(and(isNull(threads.deletedAt), args.includeHidden ? undefined : eq(threads.visibility, "visible"), args.projectId === undefined ? undefined : eq(threads.projectId, args.projectId), args.parentThreadId === undefined ? undefined : eq(threads.parentThreadId, args.parentThreadId), args.sourceThreadId === undefined ? undefined : eq(threads.sourceThreadId, args.sourceThreadId), args.sectionId === undefined ? undefined : eq(threads.sectionId, args.sectionId), args.unsectioned ? isNull(threads.sectionId) : undefined, args.hasParent === undefined ? undefined : args.hasParent ? isNotNull(threads.parentThreadId) : isNull(threads.parentThreadId), args.originKind === undefined ? undefined : eq(threads.originKind, args.originKind), args.originPluginId === undefined ? undefined : eq(threads.originPluginId, args.originPluginId), args.experimental_latestAttentionAtOrAfter === undefined ? undefined : gte(threads.latestAttentionAt, args.experimental_latestAttentionAtOrAfter), args.archived === undefined ? undefined : args.archived ? isNotNull(threads.archivedAt) : isNull(threads.archivedAt), ...conditions, cursor)).orderBy(desc(threads.updatedAt), asc(threads.id)).limit(size + 1).all();
  const page = rows.slice(0, size);
  return { hasMore: rows.length > page.length, threadIds: page.map(({ threadId }) => threadId), positions: page.map((row) => ({ threadId: row.threadId, updatedAt: row.updatedAt, state: null, rank: null })) };
}

export function listThreadIdsMissingCoreParticipantProjection(db: DbQueryConnection, args: { archived?: boolean; includeHidden: boolean; limit: number; projectId?: string; parentThreadId?: string; sourceThreadId?: string; sectionId?: string; unsectioned?: boolean; hasParent?: boolean; originKind?: ThreadOriginKind; originPluginId?: string; experimental_latestAttentionAtOrAfter?: number }): { hasMore: boolean; threadIds: readonly string[] } {
  const size = Math.min(Math.max(args.limit, 1), 200);
  const rows = db.select({ threadId: threads.id }).from(threads).where(and(
    isNull(threads.deletedAt),
    args.includeHidden ? undefined : eq(threads.visibility, "visible"),
    args.projectId === undefined ? undefined : eq(threads.projectId, args.projectId),
    args.parentThreadId === undefined ? undefined : eq(threads.parentThreadId, args.parentThreadId),
    args.sourceThreadId === undefined ? undefined : eq(threads.sourceThreadId, args.sourceThreadId),
    args.sectionId === undefined ? undefined : eq(threads.sectionId, args.sectionId),
    args.unsectioned ? isNull(threads.sectionId) : undefined,
    args.hasParent === undefined ? undefined : args.hasParent ? isNotNull(threads.parentThreadId) : isNull(threads.parentThreadId),
    args.originKind === undefined ? undefined : eq(threads.originKind, args.originKind),
    args.originPluginId === undefined ? undefined : eq(threads.originPluginId, args.originPluginId),
    args.experimental_latestAttentionAtOrAfter === undefined ? undefined : gte(threads.latestAttentionAt, args.experimental_latestAttentionAtOrAfter),
    args.archived === undefined ? undefined : args.archived ? isNotNull(threads.archivedAt) : isNull(threads.archivedAt),
    not(sql`exists (select 1 from ${threadFacetSnapshots} where ${and(eq(threadFacetSnapshots.typeScope, "core"), eq(threadFacetSnapshots.typeOwner, "core"), eq(threadFacetSnapshots.localName, "participants"), eq(threadFacetSnapshots.assignmentScope, "shared-thread"), eq(threadFacetSnapshots.threadId, threads.id), eq(threadFacetSnapshots.ownerGeneration, 1))})`),
  )).orderBy(asc(threads.id)).limit(size + 1).all();
  const page = rows.slice(0, size).map(({ threadId }) => threadId);
  return { threadIds: page, hasMore: rows.length > page.length };
}
