function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.7 4.6 12 4.6 12 4.6s-5.7 0-7.5.5a3 3 0 0 0-2.1 2.1C1.9 9 1.9 12 1.9 12s0 3 .5 4.8a3 3 0 0 0 2.1 2.1c1.8.5 7.5.5 7.5.5s5.7 0 7.5-.5a3 3 0 0 0 2.1-2.1c.5-1.8.5-4.8.5-4.8s0-3-.5-4.8ZM9.9 15.3V8.7l5.7 3.3-5.7 3.3Z"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M14.2 10.4 22.7 1h-2l-7.4 8.2L7.4 1H.6l8.9 12.3L.6 23h2l7.8-8.6 6.2 8.6h6.8l-9.2-12.6Zm-2.8 3.1-.9-1.2L3.4 2.5h3l5.8 8 .9 1.2 7.5 10.4h-3l-6.2-8.6Z"
      />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        d="M7.5 2.8h9A4.7 4.7 0 0 1 21.2 7.5v9a4.7 4.7 0 0 1-4.7 4.7h-9a4.7 4.7 0 0 1-4.7-4.7v-9A4.7 4.7 0 0 1 7.5 2.8Z"
      />
      <circle cx="12" cy="12" r="4.1" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" />
    </svg>
  );
}

function PatreonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M4 21.5V2.5h3.7v19H4Zm11.1-5.6a6.7 6.7 0 1 1 0-13.4 6.7 6.7 0 0 1 0 13.4Z" />
    </svg>
  );
}

function SpaceDrumIcon() {
  return (
    <span className="social-link-monogram" aria-hidden="true">
      SD
    </span>
  );
}

const SOCIAL_LINKS = [
  {
    label: "YouTube",
    href: "https://www.youtube.com/user/Lolweapon",
    tone: "youtube",
    icon: <YouTubeIcon />,
  },
  {
    label: "X",
    href: "https://x.com/Lolweapon",
    tone: "x",
    icon: <XIcon />,
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/kalathras_lolweapon/",
    tone: "instagram",
    icon: <InstagramIcon />,
  },
  {
    label: "Patreon",
    href: "https://www.patreon.com/c/Lolweapon/posts",
    tone: "patreon",
    icon: <PatreonIcon />,
  },
  {
    label: "SpaceDrum",
    href: "https://mangaspacedrum.com/#/",
    tone: "spacedrum",
    icon: <SpaceDrumIcon />,
  },
];

export default function SocialLinks({ className = "", compact = false }) {
  return (
    <nav className={`social-links ${className}`.trim()} aria-label="Redes oficiales">
      {SOCIAL_LINKS.map((link) => (
        <a
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noreferrer"
          className={`social-link social-link-${link.tone}`}
          title={link.label}
          aria-label={link.label}
        >
          {compact ? link.icon : link.label}
        </a>
      ))}
    </nav>
  );
}
