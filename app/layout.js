import "./globals.css";

import PersistentTwitchPlayer from "@/components/PersistentTwitchPlayer";

export const metadata = {
  title: "Lives Tracker - Archivo Historico",
  description:
    "Archivo historico de directos y VODs. Explora, busca y encuentra todos los streams archivados.",
};

export default function RootLayout({ children }) {
  const twitchLogin = process.env.TWITCH_BROADCASTER_LOGIN || "kalathraslolweapon";

  return (
    <html lang="es" data-theme="dark">
      <body>
        <PersistentTwitchPlayer twitchLogin={twitchLogin} />
        {children}
      </body>
    </html>
  );
}
