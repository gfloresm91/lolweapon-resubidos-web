const PIERO_VIDEO_HOSTS = new Set(["drive.kala-vods.com"]);

export const PIERO_PREVIEW_FRAME_COUNT = 5;

// Escalera de anchos del poster (16:9). Debe coincidir con POSTER_SIZES de
// scripts/generate-vod-posters.py y con el manifest (version 2).
export const PIERO_POSTER_WIDTHS = [320, 640, 960, 1280];

// Valor de `sizes` para el poster como banner superior de la card comoda.
// Aproxima el ancho de la tarjeta: ~560 px en desktop (rejilla de 2 columnas),
// ~700 px en tablet a una columna y ~92vw en movil.
export const PIERO_POSTER_BANNER_SIZES =
  "(min-width: 900px) 560px, (min-width: 640px) 700px, 92vw";

function buildSrcset(resourceBase) {
  return PIERO_POSTER_WIDTHS.map((width) => `${resourceBase}.poster-${width}.webp ${width}w`).join(", ");
}

export function getPieroPosterResources(value) {
  try {
    const videoUrl = new URL(String(value || ""));

    if (!PIERO_VIDEO_HOSTS.has(videoUrl.hostname.toLowerCase()) || !videoUrl.pathname.toLowerCase().endsWith(".mp4")) {
      return null;
    }

    const lastSlash = videoUrl.pathname.lastIndexOf("/");
    const directory = videoUrl.pathname.slice(0, lastSlash + 1);
    const filename = videoUrl.pathname.slice(lastSlash + 1, -4);
    const resourceBase = `${videoUrl.origin}/posters${directory}${filename}`;

    return {
      // Alias de tamano medio: `src` por defecto y compatibilidad.
      posterUrl: `${resourceBase}.poster.webp`,
      // Para <img srcset> con descriptores `w` + `sizes` (banner de la card comoda).
      posterSrcset: buildSrcset(resourceBase),
      // Para construir srcset con descriptores de densidad en tamanos fijos
      // (miniatura de la tabla): [{ width, url }].
      posterSources: PIERO_POSTER_WIDTHS.map((width) => ({
        width,
        url: `${resourceBase}.poster-${width}.webp`,
      })),
      previewUrl: `${resourceBase}.preview.webp`,
      manifestUrl: `${resourceBase}.preview.json`,
    };
  } catch {
    return null;
  }
}

export function getLivePosterResources(live) {
  const links = Array.isArray(live?.links?.piero) ? live.links.piero : [];

  for (const link of links) {
    const resources = getPieroPosterResources(link);
    if (resources) return resources;
  }

  return null;
}
