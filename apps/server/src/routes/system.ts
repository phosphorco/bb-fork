import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { formatCustomAcpAgentProviderId } from "@bb/config/bb-app-managed-config";
import {
  getAppSettings,
  getAppKeybindingOverrides,
  getExperiments,
  p6rGetPromptStackSettings,
  getStoredFaviconColor,
  getStoredThemeId,
  hasActiveThreadAttention,
  setAppSettings,
  setAppKeybindingOverrides,
  setExperiments,
  p6rSetPromptStackSettings,
  setStoredAppearance,
  p6rClearStoredAppearanceForPrincipalKey,
  p6rSetStoredAppearanceForPrincipalKey,
} from "@bb/db";
import {
  p6rBuildPaletteRoster,
  p6rPersonalAppearanceKey,
  p6rResolveAppearanceSelection,
} from "../services/system/p6r-principal-appearance.js";
import {
  applyAppKeybindingOverrides,
  customThemeNameSchema,
  isBuiltInThemeId,
  resolveCodeTheme,
  type AppKeybindingOverrides,
  type AppTheme,
  type P6rActorSnapshot,
  type P6rPrincipalKey,
} from "@bb/domain";
import { p6rPromptStackCatalogSchema } from "@bb/domain";
import {
  publicApiRoutes,
  typedRoutes,
  type PublicApiSchema,
} from "@bb/server-contract";
import type { Hono } from "hono";
import type { ServerAppDeps, ServerRuntimeConfig } from "../types.js";
import type { PluginService } from "../services/plugins/plugin-service.js";
import {
  P6R_LOCAL_OPERATOR_PROVIDER_ID,
  p6rPrincipalKeyForActor,
} from "../services/identity.js";
import { ApiError } from "../errors.js";
import {
  resolveVoiceTranscriptionEnabled,
  transcribeVoiceInput,
} from "../services/ai/voice-transcription.js";
import {
  listSystemProviderInfos,
  resolveSystemExecutionOptions,
} from "../services/system/execution-options.js";
import { getProviderStates } from "../services/system/provider-states.js";
import { getProviderUsageLimits } from "../services/system/usage-limits.js";
import {
  listCustomThemeNames,
  readCustomThemeCss,
  resolveAppTheme,
  resolveCustomThemeCssPath,
  resolveThemeRootPath,
} from "../services/system/custom-themes.js";
import {
  installGlobalCliSkills,
  listInstallableMachineIds,
  readGlobalCliSkillStatus,
} from "../services/skills/global-skill-install.js";
import { DEFAULT_APP_KEYBINDINGS } from "../services/system/app-keybindings.js";
import { resolvePrimaryHostId } from "../services/hosts/primary-host.js";

const CUSTOM_ACP_LOGO_CONTENT_TYPES = {
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
} as const;

interface SystemConfigRequest {
  url: string;
  header(name: string): string | undefined;
}

function firstForwardedValue(value: string | undefined): string | undefined {
  return value?.split(",", 1)[0]?.trim() || undefined;
}

function effectivePort(url: URL): number | null {
  if (url.port.length > 0) return Number(url.port);
  if (url.protocol === "http:") return 80;
  if (url.protocol === "https:") return 443;
  return null;
}

function resolveSystemServerUrl(
  request: SystemConfigRequest,
  config: Pick<
    ServerRuntimeConfig,
    "appUrl" | "devAppPort" | "isDevelopment" | "serverPort"
  >,
): string {
  if (config.appUrl !== undefined) return config.appUrl.replace(/\/+$/u, "");

  const requestUrl = new URL(request.url);
  const forwardedHost = firstForwardedValue(request.header("x-forwarded-host"));
  if (forwardedHost === undefined) return requestUrl.origin;

  const forwardedProtocol =
    firstForwardedValue(request.header("x-forwarded-proto")) ??
    requestUrl.protocol.replace(/:$/u, "");
  const forwardedUrl = new URL(`${forwardedProtocol}://${forwardedHost}`);
  if (
    config.isDevelopment &&
    config.devAppPort !== undefined &&
    effectivePort(forwardedUrl) === config.devAppPort
  ) {
    forwardedUrl.port = String(config.serverPort);
  }
  return forwardedUrl.origin;
}

export function registerSystemRoutes(
  app: Hono,
  deps: ServerAppDeps,
  pluginService: PluginService,
): void {
  const { del, get, post, put } = typedRoutes<PublicApiSchema>(app, {
    onValidationError: (msg) => new ApiError(400, "invalid_request", msg),
  });
  const routes = publicApiRoutes.system;

  const themeRoot = resolveThemeRootPath(deps.config.dataDir);

  get(routes.attention, (context) =>
    context.json({ hasAttention: hasActiveThreadAttention(deps.db) }),
  );

  function readAppKeybindingOverrides(): AppKeybindingOverrides {
    try {
      return getAppKeybindingOverrides(deps.db);
    } catch (error) {
      deps.logger.error(
        { err: error },
        "Stored keyboard shortcut overrides are invalid; using defaults",
      );
      return [];
    }
  }

  async function resolveSelectedTheme(
    themeId: string,
    faviconColor: AppTheme["faviconColor"],
  ): Promise<AppTheme> {
    const pluginCss = await pluginService.readThemeCss(themeId);
    if (pluginCss !== null) {
      return {
        themeId,
        customCss: pluginCss,
        faviconColor,
        resolvedCodeTheme: resolveCodeTheme(
          pluginService.readThemeCodeTheme(themeId),
          themeId,
        ),
      };
    }
    return resolveAppTheme(themeRoot, themeId, faviconColor);
  }

  async function buildSystemConfigResponse(
    serverUrl: string,
    p6rCurrentPrincipal: P6rActorSnapshot | null,
  ) {
    const keybindingOverrides = readAppKeybindingOverrides();
    const primaryHostId = resolvePrimaryHostId(deps);
    const localHelperPorts = [
      ...new Set([
        deps.config.hostDaemonPort,
        ...deps.hub.listDaemonLocalApiPorts(),
      ]),
    ];
    return {
      p6rCurrentPrincipalProfile:
        p6rCurrentPrincipal === null
          ? null
          : {
              p6rPrincipalKey: p6rPrincipalKeyForActor(p6rCurrentPrincipal),
              ...p6rCurrentPrincipal,
              assurance:
                p6rCurrentPrincipal.p6rProviderId === "claimed"
                  ? ("claimed" as const)
                  : p6rCurrentPrincipal.p6rProviderId ===
                      P6R_LOCAL_OPERATOR_PROVIDER_ID
                    ? ("local-operator" as const)
                    : ("trusted-provider" as const),
            },
      generalSettings: getAppSettings(deps.db),
      keybindings: applyAppKeybindingOverrides(
        DEFAULT_APP_KEYBINDINGS,
        keybindingOverrides,
      ),
      defaultKeybindings: DEFAULT_APP_KEYBINDINGS,
      keybindingOverrides,
      experiments: getExperiments(deps.db),
      appearance: await (async () => {
        const p6rSelection = p6rResolveAppearanceSelection(
          deps.db,
          p6rCurrentPrincipal,
        );
        return resolveSelectedTheme(
          p6rSelection.themeId,
          p6rSelection.faviconColor,
        );
      })(),
      p6rPaletteRoster: p6rBuildPaletteRoster(deps.db),
      customThemes: listCustomThemeNames(themeRoot),
      pluginThemes: pluginService.listThemes(),
      featureFlags: deps.config.featureFlags,
      hostDaemonPort: deps.config.hostDaemonPort,
      localHelperPorts,
      serverUrl,
      primaryHostId,
      primaryHostPlatform:
        primaryHostId === null
          ? null
          : deps.hub.getDaemonPlatformForHost(primaryHostId),
      voiceTranscriptionEnabled: resolveVoiceTranscriptionEnabled(deps),
      dataDir: deps.config.dataDir,
    };
  }

  get(routes.config, async (context) => {
    const serverUrl = resolveSystemServerUrl(context.req, deps.config);
    return context.json(
      await buildSystemConfigResponse(
        serverUrl,
        (context.get("p6rRequestPrincipal") as
          | P6rActorSnapshot
          | null
          | undefined) ?? null,
      ),
    );
  });

  get(routes.promptStacks, (context) =>
    context.json({ stacks: p6rGetPromptStackSettings(deps.db).stacks }),
  );

  put(routes.updatePromptStacks, (context, payload) => {
    const catalog = p6rPromptStackCatalogSchema.parse(payload);
    const current = p6rGetPromptStackSettings(deps.db);
    p6rSetPromptStackSettings(deps.db, {
      ...current,
      stacks: catalog.stacks,
    });
    deps.hub.notifySystem(["config-changed"]);
    return context.json(catalog);
  });

  put(routes.generalSettings, (context, payload) => {
    setAppSettings(deps.db, payload);
    deps.hub.notifySystem(["config-changed"]);
    return context.json(getAppSettings(deps.db));
  });

  put(routes.keyboardSettings, (context, payload) => {
    setAppKeybindingOverrides(deps.db, payload);
    deps.hub.notifySystem(["config-changed"]);
    return context.json(getAppKeybindingOverrides(deps.db));
  });

  put(routes.experiments, (context, payload) => {
    setExperiments(deps.db, { ...getExperiments(deps.db), ...payload });
    // The same kind a config reload broadcasts: every window re-reads
    // /system/config and re-gates its experiment-flagged surfaces.
    deps.hub.notifySystem(["config-changed"]);
    return context.json(getExperiments(deps.db));
  });

  put(routes.appearance, async (context, payload) => {
    const { themeId } = payload;
    const pluginCss = await pluginService.readThemeCss(themeId);
    if (!isBuiltInThemeId(themeId) && pluginCss === null) {
      if (!customThemeNameSchema.safeParse(themeId).success) {
        throw new ApiError(
          400,
          "invalid_request",
          `Invalid theme id '${themeId}'.`,
        );
      }
      if (readCustomThemeCss(themeRoot, themeId) === null) {
        throw new ApiError(
          404,
          "theme_not_found",
          `Custom theme '${themeId}' not found. Create ${resolveCustomThemeCssPath(themeRoot, themeId)} first.`,
        );
      }
    }
    const { faviconColor } = payload;
    setStoredAppearance(deps.db, { themeId, faviconColor });
    // Broadcast like experiments: every window re-reads /system/config and
    // re-applies the active palette.
    deps.hub.notifySystem(["config-changed"]);
    return context.json(await resolveSelectedTheme(themeId, faviconColor));
  });

  // Downstream (p6r): a personal palette override for the requesting
  // principal. The plain appearance route above stays the shared default for
  // everybody; the local operator and unclaimed requests have no personal row
  // (their palette *is* the shared one), so they are rejected here.
  function p6rRequirePersonalAppearanceKey(context: {
    get(key: string): unknown;
  }): P6rPrincipalKey {
    const p6rKey = p6rPersonalAppearanceKey(
      (context.get("p6rRequestPrincipal") as
        | P6rActorSnapshot
        | null
        | undefined) ?? null,
    );
    if (p6rKey === null) {
      throw new ApiError(
        400,
        "invalid_request",
        "A personal palette needs an authenticated principal; this session already follows the shared appearance.",
      );
    }
    return p6rKey;
  }

  async function p6rAssertSelectableThemeId(themeId: string): Promise<void> {
    if (isBuiltInThemeId(themeId)) return;
    if ((await pluginService.readThemeCss(themeId)) !== null) return;
    if (!customThemeNameSchema.safeParse(themeId).success) {
      throw new ApiError(
        400,
        "invalid_request",
        `Invalid theme id '${themeId}'.`,
      );
    }
    if (readCustomThemeCss(themeRoot, themeId) === null) {
      throw new ApiError(
        404,
        "theme_not_found",
        `Custom theme '${themeId}' not found. Create ${resolveCustomThemeCssPath(themeRoot, themeId)} first.`,
      );
    }
  }

  put(routes.p6rPersonalAppearance, async (context, payload) => {
    const p6rKey = p6rRequirePersonalAppearanceKey(context);
    const { themeId, faviconColor } = payload;
    await p6rAssertSelectableThemeId(themeId);
    p6rSetStoredAppearanceForPrincipalKey(deps.db, p6rKey, {
      themeId,
      faviconColor,
    });
    deps.hub.notifySystem(["config-changed"]);
    return context.json(await resolveSelectedTheme(themeId, faviconColor));
  });

  del(routes.p6rPersonalAppearanceClear, async (context) => {
    const p6rKey = p6rRequirePersonalAppearanceKey(context);
    p6rClearStoredAppearanceForPrincipalKey(deps.db, p6rKey);
    deps.hub.notifySystem(["config-changed"]);
    return context.json(
      await resolveSelectedTheme(
        getStoredThemeId(deps.db),
        getStoredFaviconColor(deps.db),
      ),
    );
  });

  get(routes.themes, async (context) =>
    context.json({
      dir: themeRoot,
      custom: listCustomThemeNames(themeRoot),
      plugins: pluginService.listThemes(),
      active: await resolveSelectedTheme(
        getStoredThemeId(deps.db),
        getStoredFaviconColor(deps.db),
      ),
    }),
  );

  post(routes.reloadConfig, async (context) => {
    try {
      await deps.bbAppManagedConfig.reload({ notify: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ApiError(422, "invalid_config", message);
    }
    return context.json({ ok: true });
  });

  get(routes.cliSkillsStatus, async (context, query) =>
    context.json(
      await readGlobalCliSkillStatus(deps, {
        hostIds:
          query.hostIds === undefined
            ? listInstallableMachineIds(deps)
            : query.hostIds.split(",").filter((hostId) => hostId.length > 0),
      }),
    ),
  );

  post(routes.installCliSkills, async (context, body) =>
    context.json(await installGlobalCliSkills(deps, { hostIds: body.hostIds })),
  );

  get(routes.providers, async (context, query) =>
    context.json(await listSystemProviderInfos(deps, query)),
  );

  get(routes.providerLogo, async (context) => {
    const providerId = context.req.param("id");
    // Plugin-registered providers serve the icon snapshot captured at
    // registration; a disabled plugin's registration (and icon) is gone, so
    // the app falls back to its vendored brand marks.
    const registration = deps.providerRegistry.get(providerId);
    if (registration?.icon !== undefined) {
      return context.body(new Uint8Array(registration.icon.bytes), 200, {
        "cache-control": "no-store",
        "content-type": registration.icon.contentType,
        "x-content-type-options": "nosniff",
      });
    }
    const agent = deps.config.customAcpAgents.find(
      (candidate) =>
        formatCustomAcpAgentProviderId(candidate.id) === providerId,
    );
    if (agent?.logo === undefined) {
      throw new ApiError(
        404,
        "provider_logo_not_found",
        `Provider '${providerId}' has no configured logo.`,
      );
    }

    const extension = extname(agent.logo).toLowerCase();
    const contentType =
      CUSTOM_ACP_LOGO_CONTENT_TYPES[
        extension as keyof typeof CUSTOM_ACP_LOGO_CONTENT_TYPES
      ];
    if (contentType === undefined) {
      throw new ApiError(
        415,
        "unsupported_provider_logo",
        `Provider '${providerId}' has an unsupported logo format.`,
      );
    }

    let bytes: Buffer;
    try {
      bytes = await readFile(resolve(deps.config.dataDir, agent.logo));
    } catch {
      throw new ApiError(
        404,
        "provider_logo_not_found",
        `Provider '${providerId}' logo file was not found.`,
      );
    }
    return context.body(new Uint8Array(bytes), 200, {
      "cache-control": "no-store",
      "content-type": contentType,
      "x-content-type-options": "nosniff",
    });
  });

  get(routes.providerStates, async (context, query) =>
    context.json(await getProviderStates(deps, query)),
  );

  get(routes.usageLimits, async (context, query) =>
    context.json(await getProviderUsageLimits(deps, query)),
  );

  get(routes.executionOptions, async (context, query) =>
    context.json(await resolveSystemExecutionOptions(deps, query)),
  );

  post(routes.voiceTranscription, async (context) => {
    const formData = await context.req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new ApiError(400, "invalid_request", "Audio file is required");
    }
    return context.json({
      text: await transcribeVoiceInput(deps, {
        file,
        prompt:
          typeof formData.get("prompt") === "string"
            ? String(formData.get("prompt"))
            : undefined,
      }),
    });
  });

  get(routes.version, async (context, query) =>
    context.json(
      await deps.appVersion.getSystemVersion({
        forceRefresh: query.force === "true",
      }),
    ),
  );
}
