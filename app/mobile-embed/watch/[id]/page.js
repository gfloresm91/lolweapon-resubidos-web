import { notFound } from "next/navigation";

import { getLiveById } from "@/lib/repositories/liveRepository";
import MobileEmbedPlayer from "./MobileEmbedPlayer";

// Página liviana sin header/nav del sitio - existe solo para que el WebView del lado mobile monte
// el mismo OkruWatchPlayer que ya funciona en producción, sin tocarlo. Ver packages/internal-media
// (repo mobile) para el lado que consume esto. No requiere auth propia: mismo criterio que
// /api/mobile/v1/lives (browsing es público, sincronizar progreso sí requiere login y eso lo hace
// el lado nativo por su cuenta, no esta página).
export default async function MobileEmbedWatchPage({ params }) {
  const { id } = await params;
  const liveId = Number(id);
  if (!Number.isInteger(liveId)) notFound();

  const live = await getLiveById(liveId);
  if (!live) notFound();

  const okruLinks = Array.isArray(live.links?.okru) ? live.links.okru : [];
  const pieroLinks = Array.isArray(live.links?.piero) ? live.links.piero : [];

  return (
    <div style={{ background: "#000", minHeight: "100vh" }}>
      <MobileEmbedPlayer okruLinks={okruLinks} pieroLinks={pieroLinks} liveId={liveId} title={live.title} />
    </div>
  );
}
