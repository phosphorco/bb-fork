import { useEffect, useState, type FormEvent } from "react";
import { p6rNormalizeHandle } from "@bb/domain";
import { Button } from "@bb/shared-ui/button";
import { Input } from "@bb/shared-ui/input";
import { SettingsSection } from "@/components/ui/settings-section";
import {
  p6rClearClaimedIdentity,
  p6rSetClaimedDisplayName,
  useP6rClaimedIdentity,
} from "@/lib/claimed-identity-store";

/**
 * Remote-session identity editor: the claimed display name/p6rHandle this browser
 * attaches to its requests for attribution and presence. Only offered in the
 * settings nav for remote sessions (desktop/localhost run as the local
 * operator and send no identity).
 */
export function P6rIdentitySettingsSection() {
  const identity = useP6rClaimedIdentity();
  const [p6rDisplayName, setDisplayName] = useState(
    identity?.p6rDisplayName ?? "",
  );
  // Re-seed the field when the identity changes elsewhere (first-load dialog,
  // another tab via the storage event).
  useEffect(() => {
    setDisplayName(identity?.p6rDisplayName ?? "");
  }, [identity?.p6rDisplayName]);
  const p6rHandle = p6rNormalizeHandle(p6rDisplayName);
  const isDirty = p6rDisplayName.trim() !== (identity?.p6rDisplayName ?? "");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    p6rSetClaimedDisplayName(p6rDisplayName);
  };

  return (
    <SettingsSection
      title="Identity"
      description="How you appear to other people using this bb: message attribution, presence avatars, and p6rTyping indicators. Self-reported — it never grants or restricts access."
    >
      <form className="space-y-3" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <label
            className="text-sm font-medium text-foreground"
            htmlFor="p6r-claimed-identity-display-name"
          >
            Display name
          </label>
          <Input
            id="p6r-claimed-identity-display-name"
            value={p6rDisplayName}
            placeholder="e.g. Alice"
            maxLength={128}
            autoCorrect="off"
            spellCheck={false}
            onChange={(event) => setDisplayName(event.target.value)}
          />
          <p className="text-xs text-subtle-foreground/75">
            {p6rHandle.length > 0
              ? `You appear as @${p6rHandle}`
              : "No identity claimed — your actions show as the machine owner."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={!isDirty || p6rHandle.length === 0}
          >
            Save
          </Button>
          {identity !== null ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                p6rClearClaimedIdentity();
                setDisplayName("");
              }}
            >
              Clear identity
            </Button>
          ) : null}
        </div>
      </form>
    </SettingsSection>
  );
}
