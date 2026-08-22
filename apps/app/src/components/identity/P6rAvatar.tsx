import { useEffect, useMemo, useState } from "react";

export function p6rAvatarInitials(p6rDisplayName: string): string {
  const words = p6rDisplayName.trim().split(/\s+/u).filter(Boolean);
  const first = words[0]?.[0] ?? "?";
  const second = words.length > 1 ? (words.at(-1)?.[0] ?? "") : "";
  return `${first}${second}`.toUpperCase();
}

export function p6rSafeAvatarUrl(p6rImageUrl: string | null): string | null {
  if (p6rImageUrl === null) return null;
  try {
    const url = new URL(p6rImageUrl);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Presentation-only avatar for a server-authored profile. The image request is
 * anonymous and carries no referrer; an absent, unsafe, or failed image falls
 * back without changing the profile's identity or availability.
 */
export function P6rAvatar({
  p6rDisplayName,
  p6rImageUrl,
  className,
}: {
  p6rDisplayName: string;
  p6rImageUrl: string | null;
  className: string;
}) {
  const safeImageUrl = useMemo(
    () => p6rSafeAvatarUrl(p6rImageUrl),
    [p6rImageUrl],
  );
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);

  useEffect(() => {
    setFailedImageUrl(null);
  }, [safeImageUrl]);

  if (safeImageUrl !== null && failedImageUrl !== safeImageUrl) {
    return (
      <img
        src={safeImageUrl}
        alt={p6rDisplayName}
        className={className}
        crossOrigin="anonymous"
        referrerPolicy="no-referrer"
        onError={() => setFailedImageUrl(safeImageUrl)}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={p6rDisplayName}
      className={`${className} inline-flex items-center justify-center`}
    >
      {p6rAvatarInitials(p6rDisplayName)}
    </span>
  );
}
