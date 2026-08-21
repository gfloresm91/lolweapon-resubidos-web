"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

import OkruWatchPlayer from "@/components/OkruWatchPlayer";

// Mismo selector que ya usa PieroVideoPlayer.js internamente para encontrar el <video> real dentro
// del media provider de Vidstack (no hay shadow DOM de por medio, confirmado por su propio código).
// OK.RU es un <iframe> de un tercero - nunca va a matchear este selector, así que si lo encontramos
// sabemos que la fuente activa es Piero sin necesidad de leer estado de OkruWatchPlayer (no se toca
// ese componente, así que no hay otra forma de saber qué parte está activa desde afuera).
const VIDEO_SELECTOR = "[data-media-provider] video";

function postToNative(message) {
  window.ReactNativeWebView?.postMessage(JSON.stringify(message));
}

export default function MobileEmbedPlayer({ okruLinks, pieroLinks, liveId, title }) {
  const searchParams = useSearchParams();
  const resumeSeconds = Number(searchParams.get("resume"));
  // El lado nativo agrega este flag cuando el usuario está logueado (ver PieroPlayer.tsx en el repo
  // mobile) - esta página no tiene su propia sesión (ver comentario de page.js), así que es la única
  // forma de saber el estado de auth acá. Con isAuthenticated=true, OkruWatchPlayer deja de leer y
  // escribir localStorage por completo (ver su propio comentario de props) - el seek de resumeSeconds
  // de más abajo (loadedmetadata) queda como la única fuente de posición inicial, sin que
  // restorePieroProgress (canplay, más tarde en el ciclo de vida) lo pise con un valor local viejo.
  const isAuthenticated = searchParams.get("authenticated") === "1";
  // Igual que resumeSeconds/isAuthenticated: el lado nativo agrega este flag cuando su propio toggle
  // "Reproducción automática" está prendido (ver archive/[id].tsx). Con esto, OkruWatchPlayer reusa su
  // propio overlay "parte completada" con cuenta regresiva de 7s (el mismo mecanismo que ya tiene la
  // web) en vez de necesitar una cuenta regresiva nativa aparte.
  const forcedAutoAdvance = searchParams.get("autoAdvance") === "1";
  const seekedRef = useRef(false);
  const lastNotifiedPartIndexRef = useRef(Math.max(0, Number(searchParams.get("parte") || "1") - 1));

  useEffect(() => {
    seekedRef.current = false;
    let currentVideo = null;
    let detach = null;

    function resolvePartIndex(video) {
      const src = video.currentSrc || video.src || "";
      const index = pieroLinks.findIndex((href) => src.includes(href) || href.includes(src));
      return index >= 0 ? index : 0;
    }

    function attach(video) {
      currentVideo = video;

      // No capturar el índice una sola vez acá - cuando el MutationObserver detecta el <video> nuevo,
      // Vidstack todavía puede no haberle asignado el src real (llega un instante después), así que
      // resolvePartIndex podría devolver un índice viejo/erróneo si quedara cerrado sobre ese momento.
      // Se resuelve de nuevo en cada evento y también al llegar loadedmetadata (por si el primer
      // intento, acá abajo, fue antes de que el src estuviera listo).
      function syncPartIndex() {
        const partIndex = resolvePartIndex(video);
        // El overlay interno de OkruWatchPlayer puede avanzar de parte sin recargar el WebView (clic
        // manual en "Reproducir Parte X" o la cuenta regresiva de auto-avance) - sin esto, los tabs
        // nativos "Parte 1"/"Parte 2" de archive/[id].tsx se quedan pegados en la parte anterior.
        if (partIndex !== lastNotifiedPartIndexRef.current) {
          lastNotifiedPartIndexRef.current = partIndex;
          postToNative({ type: "partChanged", partIndex });
        }
        return partIndex;
      }

      const emit = (type) => () => {
        // El MutationObserver puede detectar el <video> nuevo antes de que Vidstack le asigne el src
        // real (queda vacío un instante) - reintentar acá en vez de solo una vez en loadedmetadata,
        // que en la práctica no siempre llega a dispararse a tiempo. timeupdate es frecuente y barato
        // de recalcular, así que esto se autocorrige apenas arranca la reproducción real.
        const partIndex = syncPartIndex();
        postToNative({
          type,
          source: "piero",
          partIndex,
          currentTime: video.currentTime,
          duration: Number.isFinite(video.duration) ? video.duration : null,
        });
      };

      const onTimeUpdate = emit("timeupdate");
      const onPause = emit("pause");
      const onEnded = emit("ended");

      video.addEventListener("timeupdate", onTimeUpdate);
      video.addEventListener("pause", onPause);
      video.addEventListener("ended", onEnded);

      syncPartIndex();
      video.addEventListener("loadedmetadata", syncPartIndex);

      if (!seekedRef.current && Number.isFinite(resumeSeconds) && resumeSeconds > 0) {
        seekedRef.current = true;
        const seek = () => {
          video.currentTime = resumeSeconds;
        };
        if (video.readyState >= 1) seek();
        else video.addEventListener("loadedmetadata", seek, { once: true });
      }

      return () => {
        video.removeEventListener("timeupdate", onTimeUpdate);
        video.removeEventListener("pause", onPause);
        video.removeEventListener("ended", onEnded);
        video.removeEventListener("loadedmetadata", syncPartIndex);
      };
    }

    // Cambiar de parte reemplaza el <video> (PieroVideoPlayer lo remonta con un key nuevo por
    // link), así que un MutationObserver detecta el reemplazo sin necesitar hooks de React.
    const tryFind = () => {
      const el = document.querySelector(VIDEO_SELECTOR);
      if (el && el !== currentVideo) {
        if (detach) detach();
        detach = attach(el);
      }
    };

    tryFind();
    const observer = new MutationObserver(tryFind);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (detach) detach();
    };
  }, [pieroLinks, resumeSeconds]);

  return (
    <>
      {/* Esta página solo la carga el WebView de la app (nadie la linkea desde el sitio), así que
          es seguro ocultar acá el chrome que apps/internal reconstruye nativo (título, modo
          teatro, tabs de fuente, selector de partes, acciones abrir/descargar/compartir) sin tocar
          OkruWatchPlayer.js - queda visible solo watch-player-wrap/watch-player-placeholder (el
          video/iframe real). Como el botón que activa modo teatro queda oculto, ese estado nunca
          se puede alcanzar. */}
      <style>{`
        .watch-mini-header,
        .watch-theater-exit,
        .watch-player-topline,
        .watch-link-group {
          display: none !important;
        }
      `}</style>
      <OkruWatchPlayer
        okruLinks={okruLinks}
        pieroLinks={pieroLinks}
        liveId={String(liveId)}
        title={title}
        isAuthenticated={isAuthenticated}
        forcedAutoAdvance={forcedAutoAdvance}
      />
    </>
  );
}
