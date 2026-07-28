"use client";

import { siAnilist } from "simple-icons";

import { getBadgeForeground, getPlatformBadge } from "@/lib/animeCalendarPlatforms";

export function PlatformChip({ name, url, className = "" }) {
  const badge = getPlatformBadge(name);
  const style = { "--platform-color": badge.color, "--platform-foreground": badge.foreground };
  const content = (
    <>
      <span className="season-airing-platform-badge" aria-hidden="true">
        {badge.path ? <svg viewBox="0 0 24 24" fill="currentColor"><path d={badge.path} /></svg> : badge.initials}
      </span>
      {name || "Plataforma"}
    </>
  );

  return url ? (
    <a className={`season-airing-platform ${className}`.trim()} style={style} href={url} target="_blank" rel="noreferrer">{content}</a>
  ) : (
    <span className={`season-airing-platform is-static ${className}`.trim()} style={style}>{content}</span>
  );
}

export function AniListChip({ url, className = "" }) {
  const style = { "--platform-color": `#${siAnilist.hex}`, "--platform-foreground": getBadgeForeground(`#${siAnilist.hex}`) };
  return (
    <a className={`season-airing-platform is-anilist ${className}`.trim()} style={style} href={url} target="_blank" rel="noreferrer">
      <span className="season-airing-platform-badge" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d={siAnilist.path} /></svg>
      </span>
      AniList
    </a>
  );
}
