export * from "./api-types.js";
export * from "./api/thread-tabs.js";
export * from "./common.js";
export * from "./errors.js";
export * from "./public-api.js";
export * from "./thread-timeline.js";

export { typedRoutes } from "@bb/hono-typed-routes";

// Selected re-exports from @bb/domain so contract consumers don't need a
// direct @bb/domain dependency. Keep these explicit: starring another
// package's barrel would absorb its entire surface.
export {
  TERMINAL_COLS_MAX,
  TERMINAL_DATA_MAX_BASE64_LENGTH,
  TERMINAL_DATA_MAX_BYTES,
  TERMINAL_ROWS_MAX,
} from "@bb/domain";

export {
  changedMessageLenientSchema,
  changedMessageSchema,
  ENVIRONMENT_CHANGE_KINDS,
  environmentChangedMessageSchema,
  environmentChangeKindSchema,
  HOST_CHANGE_KINDS,
  hostChangedMessageSchema,
  hostChangeKindSchema,
  p6rPresenceSummaryMessageLenientSchema,
  p6rPresenceSummaryMessageSchema,
  p6rPresenceViewerSchema,
  p6rClaimedIdentityClaimSchema,
  p6rClaimedIdentityMessageSchema,
  pingMessageSchema,
  pongMessageLenientSchema,
  pongMessageSchema,
  PROJECT_CHANGE_KINDS,
  projectChangedMessageSchema,
  projectChangeKindSchema,
  realtimeSubscriptionTargetKey,
  realtimeSubscriptionTargetSchema,
  systemChangedMessageSchema,
  systemChangeKindSchema,
  SYSTEM_CHANGE_KINDS,
  threadChangedMessageSchema,
  threadChangeKindSchema,
  threadChangeMetadataSchema,
  THREAD_CHANGE_KINDS,
  p6rThreadPresenceMessageLenientSchema,
  p6rThreadPresenceMessageSchema,
} from "@bb/domain";

export type {
  ChangedMessage,
  ClientMessage,
  EnvironmentChangeKind,
  EnvironmentChangedMessage,
  HostChangeKind,
  HostChangedMessage,
  P6rPresenceSummaryMessage,
  P6rPresenceViewer,
  P6rClaimedIdentity,
  P6rClaimedIdentityClaim,
  P6rClaimedIdentityMessage,
  PingMessage,
  PongMessage,
  ProjectChangeKind,
  ProjectChangedMessage,
  RealtimeSubscriptionTarget,
  SubscribeMessage,
  SystemChangeKind,
  SystemChangedMessage,
  ThreadChangeMetadata,
  ThreadChangeKind,
  ThreadChangedMessage,
  P6rThreadPresenceMessage,
  UnsubscribeMessage,
  JsonValue,
} from "@bb/domain";
