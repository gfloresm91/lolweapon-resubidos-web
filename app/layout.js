import "@vidstack/react/player/styles/base.css";
import "@vidstack/react/player/styles/plyr/theme.css";
import "./globals.css";

import PersistentTwitchPlayer from "@/components/PersistentTwitchPlayer";

export const metadata = {
  title: "Lives Tracker - Archivo Historico",
  description:
    "Archivo historico de directos y VODs. Explora, busca y encuentra todos los streams archivados.",
};

export default function RootLayout({ children }) {
  const twitchLogin = process.env.NEXT_PUBLIC_TWITCH_EMBED_LOGIN
    || process.env.TWITCH_BROADCASTER_LOGIN
    || "kalathraslolweapon";

  return (
    <html lang="es" data-theme="dark" suppressHydrationWarning>
      <head>
        <meta
          name="format-detection"
          content="telephone=no, date=no, email=no, address=no"
        />
      </head>
      <body>
        <PersistentTwitchPlayer twitchLogin={twitchLogin} />
        {children}
      </body>
    </html>
  );
}
