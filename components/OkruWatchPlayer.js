"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function getOkruEmbedUrl(href) {
  try {
    const url = new URL(href);

    if (!url.hostname.includes("ok.ru")) {
      return "";
    }

    const videoId = url.pathname.match(/\/video(?:embed)?\/(\d+)/)?.[1];

    if (!videoId) {
      return "";
    }

    return `https://ok.ru/videoembed/${videoId}`;
  } catch {
    return "";
  }
}

function clampPartIndex(index, total) {
  return Math.min(Math.max(index, 0), Math.max(total - 1, 0));
}

function isTypingTarget(target) {
  const tagName = target?.tagName?.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || target?.isContentEditable;
}

function buildSafeFilename(title, partNumber) {
  const base = String(title || "resubido")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .toLowerCase();

  return `${base || "resubido"}-parte-${partNumber}.mp4`;
}

export default function OkruWatchPlayer({ links, liveId, title, telegramFallbackHref }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const storageKey = `kala_okru_part_${liveId || pathname}`;
  const playableLinks = useMemo(
    () =>
      (Array.isArray(links) ? links : [])
        .map((href, index) => ({
          href,
          index,
          embedUrl: getOkruEmbedUrl(href),
        }))
        .filter((item) => item.embedUrl),
    [links],
  );
  const [activeIndex, setActiveIndex] = useState(() => {
    const requestedPart = Number(searchParams.get("parte"));
    return Number.isFinite(requestedPart) && requestedPart > 0 ? requestedPart - 1 : 0;
  });
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [isPlayerLoading, setIsPlayerLoading] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [shareLabel, setShareLabel] = useState("Compartir");
  const [cobaltLabel, setCobaltLabel] = useState("Copiar y abrir Cobalt");
  const [copyCommandLabel, setCopyCommandLabel] = useState("Copiar comando");
  const [copyOkruLabel, setCopyOkruLabel] = useState("Copiar link OK.RU");
  const activeLink = playableLinks[activeIndex] || null;
  const activePartLabel = activeLink ? `Parte ${activeIndex + 1}` : "";
  const activePartSummary = activeLink ? `${activePartLabel} de ${playableLinks.length}` : "Sin parte seleccionada";
  const downloadFilename = buildSafeFilename(title, activeIndex + 1);
  const streamlinkCommand = activeLink ? `streamlink "${activeLink.href}" best -o "${downloadFilename}"` : "";

  useEffect(() => {
    function handleKeyDown(event) {
      if (isTypingTarget(event.target)) {
        return;
      }

      if (isDownloadModalOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          setIsDownloadModalOpen(false);
        }
        return;
      }

      if (event.key === "Escape") {
        setIsTheaterMode(false);
      } else if (event.key.toLowerCase() === "t") {
        event.preventDefault();
        setIsTheaterMode((current) => !current);
      } else if (event.key === "ArrowLeft" && playableLinks.length) {
        event.preventDefault();
        updateActivePart(clampPartIndex(activeIndex - 1, playableLinks.length));
      } else if (event.key === "ArrowRight" && playableLinks.length) {
        event.preventDefault();
        updateActivePart(clampPartIndex(activeIndex + 1, playableLinks.length));
      } else if (event.key.toLowerCase() === "c") {
        event.preventDefault();
        copyPartUrl();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, playableLinks.length, isTheaterMode, isDownloadModalOpen, searchParams]);

  useEffect(() => {
    const requestedPart = Number(searchParams.get("parte"));
    let savedPart = 0;

    try {
      savedPart = Number(window.localStorage.getItem(storageKey));
    } catch {
      savedPart = 0;
    }
    const hasRequestedPart = Number.isFinite(requestedPart) && requestedPart > 0;
    const hasSavedPart = Number.isFinite(savedPart) && savedPart > 0;
    const nextIndex = hasRequestedPart ? requestedPart - 1 : hasSavedPart ? savedPart - 1 : 0;
    const clampedIndex = clampPartIndex(nextIndex, playableLinks.length);

    setActiveIndex(clampedIndex);
  }, [playableLinks, searchParams, storageKey]);

  useEffect(() => {
    if (!activeLink) {
      setIsPlayerLoading(false);
      return undefined;
    }

    setIsPlayerLoading(true);
    const fallbackTimeout = window.setTimeout(() => {
      setIsPlayerLoading(false);
    }, 8000);

    return () => window.clearTimeout(fallbackTimeout);
  }, [activeLink]);

  function updateActivePart(index) {
    const params = new URLSearchParams(searchParams.toString());
    const clampedIndex = clampPartIndex(index, playableLinks.length);

    params.set("parte", String(clampedIndex + 1));
    setActiveIndex(clampedIndex);
    try {
      window.localStorage.setItem(storageKey, String(clampedIndex + 1));
    } catch {
      // Some browser privacy modes can block localStorage.
    }

    if (window.location.pathname === pathname) {
      const queryString = params.toString();
      const nextUrl = queryString ? `${pathname}?${queryString}` : pathname;
      if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
        window.history.replaceState(window.history.state, "", nextUrl);
      }
    }
  }

  function buildPartUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set("parte", String(activeIndex + 1));
    return url.toString();
  }

  async function copyText(value, setLabel, resetLabel) {
    try {
      await navigator.clipboard.writeText(value);
      setLabel("Copiado");
      window.setTimeout(() => setLabel(resetLabel), 1600);
    } catch {
      setLabel("No se pudo copiar");
      window.setTimeout(() => setLabel(resetLabel), 1600);
    }
  }

  function copyPartUrl() {
    copyText(buildPartUrl(), setShareLabel, "Compartir");
  }

  function copyStreamlinkCommand() {
    if (!streamlinkCommand) {
      return;
    }

    copyText(streamlinkCommand, setCopyCommandLabel, "Copiar comando");
  }

  function copyOkruUrl() {
    if (!activeLink) {
      return;
    }

    copyText(activeLink.href, setCopyOkruLabel, "Copiar link OK.RU");
  }

  async function copyOkruUrlAndOpenCobalt() {
    if (!activeLink) {
      return;
    }

    window.open("https://cobalt.tools/", "_blank", "noopener,noreferrer");

    try {
      await navigator.clipboard.writeText(activeLink.href);
      setCobaltLabel("Link copiado");
    } catch {
      setCobaltLabel("Abre Cobalt y copia manual");
    }

    window.setTimeout(() => setCobaltLabel("Copiar y abrir Cobalt"), 1800);
  }

  return (
    <div className={`watch-player-stage ${isTheaterMode ? "is-theater" : ""}`}>
      {isTheaterMode ? (
        <button type="button" className="watch-theater-exit" onClick={() => setIsTheaterMode(false)}>
          Salir modo teatro
        </button>
      ) : null}

      <div className="watch-mini-header">
        <div>
          <span>{activePartSummary}</span>
          <strong>{title || "Resubido"}</strong>
        </div>
        <button type="button" className="watch-tool-button" onClick={() => setIsTheaterMode((current) => !current)}>
          {isTheaterMode ? "Salir modo teatro" : "Modo teatro"}
        </button>
      </div>

      <div className="watch-player-topline">
        <span>{activeLink ? `Reproduciendo ${activePartSummary}` : "Sin parte seleccionada"}</span>
      </div>

      {activeLink ? (
        <div className="watch-player-wrap">
          <iframe
            key={activeLink.embedUrl}
            src={activeLink.embedUrl}
            title={`Player OK.RU - ${title || "Resubido"} - ${activePartLabel}`}
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => setIsPlayerLoading(false)}
          />
          {isPlayerLoading ? <div className="watch-loading-overlay">Cargando parte...</div> : null}
        </div>
      ) : (
        <div className="watch-player-placeholder is-telegram-fallback">
          <span className="watch-placeholder-label">Player no disponible</span>
          <p>Este resubido no tiene un link OK.RU reproducible.</p>
          {telegramFallbackHref ? (
            <a href={telegramFallbackHref} target="_blank" rel="noreferrer" className="platform-btn platform-telegram">
              Ver en Telegram
            </a>
          ) : null}
        </div>
      )}

      <div className="watch-link-group">
        <div className="watch-link-group-header">
          <h3>{activeLink ? `OK.RU · ${activePartSummary}` : "OK.RU"}</h3>
          {activeLink ? (
            <div className="watch-link-actions">
              <a
                href={activeLink.href}
                target="_blank"
                rel="noreferrer"
                className="watch-link-action watch-link-action-okru"
              >
                Abrir OK.RU
              </a>
              <button type="button" className="watch-link-action watch-link-action-share" onClick={copyPartUrl}>
                {shareLabel}
              </button>
              <button
                type="button"
                className="watch-link-action watch-link-action-danger"
                onClick={() => setIsDownloadModalOpen(true)}
              >
                Si falla OK.RU
              </button>
            </div>
          ) : null}
        </div>
        {playableLinks.length ? (
          <ol className="detail-link-list">
            {playableLinks.map((item, index) => (
              <li key={`${item.href}-${index}`}>
                <button
                  type="button"
                  className={`platform-btn platform-okru ${index === activeIndex ? "is-active" : ""}`}
                  onClick={() => updateActivePart(index)}
                >
                  Parte {index + 1} de {playableLinks.length}
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="detail-empty">Sin links cargados.</p>
        )}
      </div>

      {isDownloadModalOpen && activeLink ? (
        <div className="modal-backdrop download-modal-backdrop" onClick={() => setIsDownloadModalOpen(false)}>
          <div
            className="modal-content download-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="download-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="download-modal-header">
              <div>
                <span className="detail-section-kicker">Opciones de descarga</span>
                <h2 className="modal-title" id="download-modal-title">
                  Descargar este resubido
                </h2>
              </div>
              <button
                type="button"
                className="modal-close-button"
                aria-label="Cerrar modal de descarga"
                onClick={() => setIsDownloadModalOpen(false)}
              >
                ×
              </button>
            </div>

            <p className="download-modal-note">
              La descarga se hace fuera de esta web. Copiaremos el link de OK.RU para usarlo en Cobalt.
            </p>

            <div className="download-help">
              <section className="download-primary-card">
                <div className="download-step-content">
                  <span>Método recomendado · {activePartSummary}</span>
                  <h3>Usar Cobalt</h3>
                  <p>
                    Cobalt abrirá en otra pestaña. Pega ahí el link copiado para intentar descargar el archivo desde
                    tu navegador.
                  </p>
                  <div className="download-command-actions">
                    <button type="button" className="btn-modal btn-modal-primary" onClick={copyOkruUrlAndOpenCobalt}>
                      {cobaltLabel}
                    </button>
                    <button type="button" className="btn-modal btn-modal-secondary" onClick={copyOkruUrl}>
                      {copyOkruLabel}
                    </button>
                  </div>
                  <p className="download-method-note">
                    Si Cobalt no funciona, prueba el método avanzado con Streamlink. También puedes{" "}
                    <a href={activeLink.href} target="_blank" rel="noreferrer">
                      abrir la parte original en OK.RU
                    </a>
                    .
                  </p>
                </div>
              </section>

              <details className="download-advanced-details">
                <summary>Método avanzado con Streamlink</summary>
                <div className="download-help-body">
                  <p className="download-advanced-intro">
                    Este método requiere instalar herramientas en tu computador y ejecutar un comando en terminal.
                  </p>
                  <section className="download-step">
                    <span className="download-step-label">1</span>
                    <div className="download-step-content">
                      <h3>Instala Streamlink</h3>
                      <p>Streamlink es la herramienta que intentará leer el link de OK.RU y guardar el video.</p>
                      <dl className="download-platform-list">
                        <div>
                          <dt>Windows</dt>
                          <dd>
                            Descarga el instalador oficial desde Releases de Streamlink, ejecútalo y sigue los pasos del
                            instalador.
                          </dd>
                        </div>
                        <div>
                          <dt>macOS</dt>
                          <dd>
                            Instala Homebrew y luego ejecuta <code>brew install streamlink</code>.
                          </dd>
                        </div>
                        <div>
                          <dt>Linux</dt>
                          <dd>
                            Revisa las opciones oficiales para tu distribución. En muchas distros también puedes usar el
                            gestor de paquetes.
                          </dd>
                        </div>
                      </dl>
                      <a href="https://streamlink.github.io/install.html" target="_blank" rel="noreferrer">
                        Guía oficial de Streamlink
                      </a>
                      <a href="https://github.com/streamlink/streamlink/releases" target="_blank" rel="noreferrer">
                        Releases de Streamlink
                      </a>
                      <a href="https://brew.sh/" target="_blank" rel="noreferrer">
                        Homebrew para macOS
                      </a>
                    </div>
                  </section>

                  <section className="download-step">
                    <span className="download-step-label">2</span>
                    <div className="download-step-content">
                      <h3>Instala FFmpeg si Streamlink lo necesita</h3>
                      <p>
                        FFmpeg ayuda a guardar o unir correctamente algunos streams. Si Streamlink funciona sin errores,
                        no necesitas instalarlo de inmediato.
                      </p>
                      <dl className="download-platform-list">
                        <div>
                          <dt>Windows</dt>
                          <dd>
                            En la página oficial, usa una build enlazada en Windows EXE Files. También puedes usar{" "}
                            <code>winget install Gyan.FFmpeg</code>.
                          </dd>
                        </div>
                        <div>
                          <dt>macOS</dt>
                          <dd>
                            Ejecuta <code>brew install ffmpeg</code>.
                          </dd>
                        </div>
                        <div>
                          <dt>Linux</dt>
                          <dd>
                            Usa el gestor de paquetes de tu distribución: <code>sudo apt install ffmpeg</code>,{" "}
                            <code>sudo dnf install ffmpeg</code> o <code>sudo pacman -S ffmpeg</code>.
                          </dd>
                        </div>
                      </dl>
                      <a href="https://ffmpeg.org/download.html" target="_blank" rel="noreferrer">
                        Descargas oficiales de FFmpeg
                      </a>
                    </div>
                  </section>

                  <section className="download-step">
                    <span className="download-step-label">3</span>
                    <div className="download-step-content">
                      <h3>Abre una terminal o consola</h3>
                      <dl className="download-platform-list">
                        <div>
                          <dt>Windows</dt>
                          <dd>
                            Abre el menú Inicio, escribe <code>PowerShell</code> y abre la app. CMD también sirve.
                          </dd>
                        </div>
                        <div>
                          <dt>macOS</dt>
                          <dd>
                            Abre <code>Terminal</code> desde Aplicaciones, Utilidades o buscándola con Spotlight.
                          </dd>
                        </div>
                        <div>
                          <dt>Linux</dt>
                          <dd>Abre la terminal de tu distribución.</dd>
                        </div>
                      </dl>
                    </div>
                  </section>

                  <section className="download-command-card download-step">
                    <span className="download-step-label">4</span>
                    <div className="download-step-content">
                      <h3>Copia y ejecuta este comando</h3>
                      <span>Comando para {activePartSummary}</span>
                      <p>
                        Copia el comando, pégalo en la terminal y presiona Enter. No cierres la ventana hasta que la
                        descarga termine.
                      </p>
                      <code className="download-command-code">{streamlinkCommand}</code>
                      <p className="download-code-hint">
                        Si no ves el comando completo, puedes desplazarlo hacia los lados.
                      </p>
                      <div className="download-command-actions">
                        <button type="button" className="btn-modal btn-modal-primary" onClick={copyStreamlinkCommand}>
                          {copyCommandLabel}
                        </button>
                        <button type="button" className="btn-modal btn-modal-secondary" onClick={copyOkruUrl}>
                          {copyOkruLabel}
                        </button>
                      </div>
                      <div className="download-path-examples">
                        <span>Ejemplos para guardar en Descargas</span>
                        <code>macOS/Linux: -o "~/Downloads/{downloadFilename}"</code>
                        <code>Windows: -o "%USERPROFILE%\Downloads\{downloadFilename}"</code>
                      </div>
                    </div>
                  </section>

                  <section className="download-step download-notes">
                    <span className="download-step-label">Ayuda</span>
                    <div className="download-troubleshooting-list">
                      <div>
                        <h4>No reconoce Streamlink</h4>
                        <p>Cierra y vuelve a abrir la terminal. Si sigue fallando, reinstala Streamlink.</p>
                      </div>
                      <div>
                        <h4>No reconoce FFmpeg</h4>
                        <p>Instala FFmpeg, cierra la terminal y vuelve a abrirla antes de intentar de nuevo.</p>
                      </div>
                      <div>
                        <h4>Falla al guardar o unir el archivo</h4>
                        <p>Instala FFmpeg y vuelve a ejecutar el comando de Streamlink.</p>
                      </div>
                      <div>
                        <h4>Quieres comprobar la instalación</h4>
                        <p>
                          Ejecuta <code>streamlink --version</code> y <code>ffmpeg -version</code>.
                        </p>
                      </div>
                    </div>
                  </section>
                </div>
              </details>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-modal btn-modal-secondary" onClick={() => setIsDownloadModalOpen(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
