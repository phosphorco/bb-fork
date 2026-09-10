import { useEffect, useMemo, useState } from "react";
import { useProfiles } from "@/app-shell";
import { useSystemConfig } from "@/data/system";
import type { ProfileIdentityContext } from "./contracts";
import { getNativeRecoveryRepository } from "./native-repository";
import {
  buildRecoveryNamespaceId,
  buildRecoveryServerProfileKey,
} from "./recovery-namespace";

/**
 * Last server-authored principal for the active profile. Cached context may be
 * used offline; a live system response replaces it before any new persistence.
 */
export function useRecoveryNamespace(): ProfileIdentityContext | null {
  const { activeProfile } = useProfiles();
  const system = useSystemConfig({ enabled: Boolean(activeProfile) });
  const [cached, setCached] = useState<ProfileIdentityContext | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!activeProfile) return;
    void getNativeRecoveryRepository()
      .then((repository) =>
        repository.getProfileIdentityContext(
          activeProfile.id,
          activeProfile.serverUrl,
        ),
      )
      .then((context) => {
        if (cancelled) return;
        setCached(
          context?.serverUrl === activeProfile.serverUrl ? context : null,
        );
      });
    return () => {
      cancelled = true;
    };
  }, [activeProfile]);

  const live = useMemo<ProfileIdentityContext | null>(() => {
    if (!activeProfile || !system.data) return null;
    const principal = system.data.p6rCurrentPrincipalProfile ?? null;
    return {
      profileId: activeProfile.id,
      serverUrl: activeProfile.serverUrl,
      namespaceId: buildRecoveryNamespaceId({
        profileId: activeProfile.id,
        serverUrl: activeProfile.serverUrl,
        principalKey: principal?.p6rPrincipalKey ?? null,
      }),
      principalKey: principal?.p6rPrincipalKey ?? null,
      providerId: principal?.p6rProviderId ?? null,
      subject: principal?.p6rSubject ?? null,
      ownerState: principal ? "resolved" : "read-only",
      source: "live",
      updatedAt: system.dataUpdatedAt,
    };
  }, [activeProfile, system.data, system.dataUpdatedAt]);

  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    void getNativeRecoveryRepository().then(async (repository) => {
      if (cancelled) return;
      await repository.putProfileIdentityContext(live, {
        serverProfileKey: buildRecoveryServerProfileKey(live),
      });
      if (!cancelled) setCached(live);
    });
    return () => {
      cancelled = true;
    };
  }, [live]);

  const eligibleCached =
    cached &&
    activeProfile &&
    cached.profileId === activeProfile.id &&
    cached.serverUrl === activeProfile.serverUrl
      ? cached
      : null;
  return live ?? eligibleCached;
}
