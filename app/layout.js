import "./globals.css";

export const metadata = {
  title: "Lives Tracker - Archivo Historico",
  description:
    "Archivo historico de directos y VODs. Explora, busca y encuentra todos los streams archivados.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
