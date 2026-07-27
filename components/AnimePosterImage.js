"use client";

import { useEffect, useState } from "react";

export function getAnimeInitials(title) {
  return String(title || "AN")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function AnimePosterPlaceholder({ title, className = "" }) {
  return (
    <div className={["poster-placeholder anime-poster-placeholder", className].filter(Boolean).join(" ")}>
      <span>{getAnimeInitials(title)}</span>
    </div>
  );
}

export default function AnimePosterImage({ src, title, className = "", decorative = false }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!src || hasError) {
    return <AnimePosterPlaceholder title={title} className={className} />;
  }

  return (
    <img
      src={src}
      alt={decorative ? "" : title}
      className={className}
      loading="lazy"
      onError={() => setHasError(true)}
    />
  );
}
