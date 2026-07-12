"use client";

import { useEffect, useState } from "react";

export function getUserInitials(user) {
  const source = user?.alias || user?.login || "Usuario";
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function UserAvatar({ user, src, className = "" }) {
  const avatarUrl = src || user?.avatarUrl || "";
  const [failedAvatarUrl, setFailedAvatarUrl] = useState("");
  const shouldShowImage = Boolean(avatarUrl) && failedAvatarUrl !== avatarUrl;

  useEffect(() => {
    setFailedAvatarUrl("");
  }, [avatarUrl]);

  return (
    <span className={`account-avatar ${className}`.trim()} aria-hidden="true">
      {shouldShowImage ? (
        <img
          src={avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          decoding="async"
          onError={() => setFailedAvatarUrl(avatarUrl)}
        />
      ) : (
        getUserInitials(user)
      )}
    </span>
  );
}
