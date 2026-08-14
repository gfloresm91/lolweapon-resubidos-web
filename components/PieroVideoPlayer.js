"use client";

import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Gesture,
  MediaPlayer,
  MediaProvider,
  TextTrack,
  useCaptionOptions,
  useMediaContext,
  useMediaRemote,
  useMediaState,
  usePlaybackRateOptions,
} from "@vidstack/react";
import { PlyrLayout, plyrLayoutIcons } from "@vidstack/react/player/layouts/plyr";
import {
  ArrowLeft,
  ArrowRight,
  Cast,
  Check,
  ChevronLeft,
  ChevronRight,
  Captions,
  Expand,
  Gauge,
  Keyboard,
  MonitorPlay,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Settings,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

const PLYR_CONTROLS = [
  "play",
  "rewind",
  "fast-forward",
  "current-time",
  "progress",
  "mute+volume",
  "captions",
  "settings",
  "pip",
  "fullscreen",
];

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const PIERO_PREFERENCES_KEY = "kala_piero_player_preferences";
const DEFAULT_SUBTITLE_PREFERENCES = {
  fontFamily: "proportional-sans",
  fontSize: 150,
  textColor: "#FFFFFF",
  textOpacity: 100,
  backgroundColor: "#000000",
  backgroundOpacity: 75,
  windowColor: "#000000",
  windowOpacity: 0,
  edgeStyle: "drop-shadow",
  edgeColor: "#000000",
  position: "bottom",
};

const SUBTITLE_FONT_OPTIONS = [
  { value: "proportional-sans", label: "Sans serif proporcional", css: "Arial, Helvetica, sans-serif", cast: "SANS_SERIF" },
  { value: "proportional-serif", label: "Serif proporcional", css: "Georgia, 'Times New Roman', serif", cast: "SERIF" },
  { value: "monospace-sans", label: "Monoespaciada sans serif", css: "'Roboto Mono', Consolas, monospace", cast: "MONOSPACED_SANS_SERIF" },
  { value: "monospace-serif", label: "Monoespaciada serif", css: "'Courier New', Courier, monospace", cast: "MONOSPACED_SERIF" },
  { value: "casual", label: "Casual", css: "'Comic Sans MS', cursive", cast: "CASUAL" },
  { value: "cursive", label: "Cursiva", css: "cursive", cast: "CURSIVE" },
  { value: "small-caps", label: "Versalitas", css: "Arial, Helvetica, sans-serif", cast: "SMALL_CAPITALS" },
];
const SUBTITLE_SIZE_OPTIONS = [50, 75, 100, 125, 150, 200, 300, 400];
const SUBTITLE_OPACITY_OPTIONS = [0, 25, 50, 75, 100];
const SUBTITLE_COLORS = ["#FFFFFF", "#FFFF00", "#00FF00", "#00FFFF", "#FF0000", "#FF00FF", "#0000FF", "#000000"];
const SUBTITLE_EDGE_OPTIONS = [
  { value: "none", label: "Ninguno" },
  { value: "drop-shadow", label: "Sombra" },
  { value: "raised", label: "Relieve" },
  { value: "depressed", label: "Hundido" },
  { value: "outline", label: "Contorno" },
];
const SUBTITLE_PRESETS = [
  { label: "Predeterminado", value: DEFAULT_SUBTITLE_PREFERENCES },
  { label: "Alto contraste", value: { ...DEFAULT_SUBTITLE_PREFERENCES, textColor: "#FFFF00", backgroundOpacity: 100, edgeStyle: "outline" } },
  { label: "Extra grande", value: { ...DEFAULT_SUBTITLE_PREFERENCES, fontSize: 200, backgroundOpacity: 85 } },
  { label: "Sin fondo", value: { ...DEFAULT_SUBTITLE_PREFERENCES, backgroundOpacity: 0, edgeStyle: "outline" } },
];
const SUBTITLE_COLOR_NAMES = {
  "#FFFFFF": "Blanco", "#FFFF00": "Amarillo", "#00FF00": "Verde", "#00FFFF": "Cian",
  "#FF0000": "Rojo", "#FF00FF": "Magenta", "#0000FF": "Azul", "#000000": "Negro",
};

function normalizeSubtitlePreferences(value) {
  return { ...DEFAULT_SUBTITLE_PREFERENCES, ...(value || {}) };
}

function hexToRgba(hex, opacity) {
  const normalized = String(hex || "#000000").replace("#", "");
  const red = parseInt(normalized.slice(0, 2), 16) || 0;
  const green = parseInt(normalized.slice(2, 4), 16) || 0;
  const blue = parseInt(normalized.slice(4, 6), 16) || 0;
  return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(100, opacity)) / 100})`;
}

function toCastColor(hex, opacity) {
  const alpha = Math.round(Math.max(0, Math.min(100, opacity)) * 2.55)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  return `${hex}${alpha}`;
}

function getSubtitleFont(preferences) {
  return SUBTITLE_FONT_OPTIONS.find((option) => option.value === preferences.fontFamily) || SUBTITLE_FONT_OPTIONS[0];
}

function getSubtitleEdgeStyles(preferences) {
  const color = hexToRgba(preferences.edgeColor, 100);
  switch (preferences.edgeStyle) {
    case "raised": return { shadow: `-1px -1px 0 ${color}, 1px 1px 0 rgba(255,255,255,.45)`, outline: "none" };
    case "depressed": return { shadow: `1px 1px 0 ${color}, -1px -1px 0 rgba(255,255,255,.35)`, outline: "none" };
    case "outline": return { shadow: `-1px -1px 0 ${color}, 1px -1px 0 ${color}, -1px 1px 0 ${color}, 1px 1px 0 ${color}`, outline: "none" };
    case "drop-shadow": return { shadow: `2px 2px 3px ${color}`, outline: "none" };
    default: return { shadow: "none", outline: "none" };
  }
}

function readPieroPreferences() {
  try {
    return JSON.parse(window.localStorage.getItem(PIERO_PREFERENCES_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function writePieroPreference(key, value) {
  try {
    const preferences = readPieroPreferences();
    window.localStorage.setItem(PIERO_PREFERENCES_KEY, JSON.stringify({ ...preferences, [key]: value }));
  } catch {
    // Some browser privacy modes can block localStorage.
  }
}

const PIERO_PREFERENCE_STORAGE = {
  async getVolume() {
    const value = Number(readPieroPreferences().volume);
    return Number.isFinite(value) ? value : null;
  },
  async setVolume(volume) {
    writePieroPreference("volume", volume);
  },
  async getMuted() {
    const value = readPieroPreferences().muted;
    return typeof value === "boolean" ? value : null;
  },
  async setMuted(muted) {
    writePieroPreference("muted", muted);
  },
  async getPlaybackRate() {
    const value = Number(readPieroPreferences().playbackRate);
    return PLAYBACK_SPEEDS.includes(value) ? value : null;
  },
  async setPlaybackRate(playbackRate) {
    writePieroPreference("playbackRate", playbackRate);
  },
  async getTime() { return null; },
  async getLang() { return null; },
  async getCaptions() {
    const value = readPieroPreferences().captions;
    return typeof value === "boolean" ? value : false;
  },
  async setCaptions(captions) {
    writePieroPreference("captions", captions);
  },
  async getVideoQuality() { return null; },
  async getAudioGain() { return null; },
};

function PieroSubtitleTrack({ src, enabled }) {
  const media = useMediaContext();
  const trackRef = useRef(null);

  useEffect(() => {
    if (!src) return undefined;

    const matchesSubtitle = (track) =>
      (track.id === "piero-subtitles-es" || track.src === src) &&
      track.kind === "subtitles" &&
      track.language === "es";
    const existingTrack = Array.from(media.textTracks).find(
      (track) => track.src === src && track.kind === "subtitles" && track.language === "es",
    );
    const track = existingTrack ||
      new TextTrack({
        id: "piero-subtitles-es",
        src,
        kind: "subtitles",
        label: "Español",
        language: "es",
        type: "vtt",
        default: false,
      });
    const createdTrack = !existingTrack;
    trackRef.current = track;
    const removeDuplicates = () => {
      for (const candidate of Array.from(media.textTracks)) {
        if (candidate !== track && matchesSubtitle(candidate)) {
          media.textTracks.remove(candidate);
        }
      }
    };

    media.textTracks.addEventListener("add", removeDuplicates);
    if (createdTrack) media.textTracks.add(track);
    removeDuplicates();

    track.mode = enabled ? "showing" : "disabled";

    return () => {
      media.textTracks.removeEventListener("add", removeDuplicates);
      if (createdTrack) media.textTracks.remove(track);
      if (trackRef.current === track) trackRef.current = null;
    };
  }, [media, src]);

  useEffect(() => {
    if (trackRef.current) trackRef.current.mode = enabled ? "showing" : "disabled";
  }, [enabled]);

  return null;
}

function SubtitleChoiceGroup({ label, value, options, onChange, formatLabel = (option) => option.label ?? String(option) }) {
  return (
    <fieldset className="piero-subtitle-choice-group">
      <legend>{label}</legend>
      <div role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const optionValue = option.value ?? option;
          const isSelected = optionValue === value;
          return (
            <button
              key={optionValue}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={isSelected ? "is-selected" : ""}
              onClick={() => onChange(optionValue)}
            >
              {isSelected ? <Check size={14} aria-hidden="true" /> : <span aria-hidden="true" />}
              {formatLabel(option)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function SubtitleColorPicker({ label, value, onChange }) {
  return (
    <fieldset className="piero-subtitle-colors">
      <legend>{label}</legend>
      <div role="radiogroup" aria-label={label}>
        {SUBTITLE_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            role="radio"
            aria-label={color}
            aria-checked={value === color}
            className={value === color ? "is-selected" : ""}
            style={{ "--subtitle-swatch": color }}
            onClick={() => onChange(color)}
          >
            {value === color ? <Check size={15} aria-hidden="true" /> : null}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function PieroSubtitleAppearance({ preferences, onChange, onReset, section, onOpenSection }) {
  const edge = getSubtitleEdgeStyles(preferences);
  const previewStyle = {
    color: hexToRgba(preferences.textColor, preferences.textOpacity),
    backgroundColor: hexToRgba(preferences.backgroundColor, preferences.backgroundOpacity),
    fontFamily: getSubtitleFont(preferences).css,
    fontSize: `${Math.max(0.7, preferences.fontSize / 100)}rem`,
    fontVariant: preferences.fontFamily === "small-caps" ? "small-caps" : "normal",
    textShadow: edge.shadow,
  };

  const update = (key) => (value) => onChange({ ...preferences, [key]: value });
  const fontLabel = getSubtitleFont(preferences).label;
  const edgeLabel = SUBTITLE_EDGE_OPTIONS.find((option) => option.value === preferences.edgeStyle)?.label;

  if (section) {
    return (
      <div className="piero-subtitle-settings-scroll piero-subtitle-detail-level">
        {section === "text" ? (
          <>
            <SubtitleChoiceGroup label="Familia tipográfica" value={preferences.fontFamily} options={SUBTITLE_FONT_OPTIONS} onChange={update("fontFamily")} />
            <SubtitleChoiceGroup label="Tamaño de fuente" value={preferences.fontSize} options={SUBTITLE_SIZE_OPTIONS} formatLabel={(option) => `${option}%`} onChange={update("fontSize")} />
            <SubtitleColorPicker label="Color del texto" value={preferences.textColor} onChange={update("textColor")} />
            <SubtitleChoiceGroup label="Opacidad del texto" value={preferences.textOpacity} options={SUBTITLE_OPACITY_OPTIONS.filter((value) => value > 0)} formatLabel={(option) => `${option}%`} onChange={update("textOpacity")} />
          </>
        ) : null}
        {section === "background" ? (
          <>
            <SubtitleColorPicker label="Color del fondo" value={preferences.backgroundColor} onChange={update("backgroundColor")} />
            <SubtitleChoiceGroup label="Opacidad del fondo" value={preferences.backgroundOpacity} options={SUBTITLE_OPACITY_OPTIONS} formatLabel={(option) => `${option}%`} onChange={update("backgroundOpacity")} />
          </>
        ) : null}
        {section === "window" ? (
          <>
            <SubtitleColorPicker label="Color de la ventana" value={preferences.windowColor} onChange={update("windowColor")} />
            <SubtitleChoiceGroup label="Opacidad de la ventana" value={preferences.windowOpacity} options={SUBTITLE_OPACITY_OPTIONS} formatLabel={(option) => `${option}%`} onChange={update("windowOpacity")} />
          </>
        ) : null}
        {section === "edge" ? (
          <>
            <SubtitleChoiceGroup label="Estilo del borde" value={preferences.edgeStyle} options={SUBTITLE_EDGE_OPTIONS} onChange={update("edgeStyle")} />
            <SubtitleColorPicker label="Color del borde" value={preferences.edgeColor} onChange={update("edgeColor")} />
            <SubtitleChoiceGroup label="Posición" value={preferences.position} options={[{ value: "bottom", label: "Abajo" }, { value: "top", label: "Arriba" }]} onChange={update("position")} />
          </>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className="piero-subtitle-preview" style={{ backgroundColor: hexToRgba(preferences.windowColor, preferences.windowOpacity) }}>
        <span style={previewStyle}>Así se verán tus subtítulos</span>
      </div>

      <div className="piero-subtitle-settings-scroll">
        <div className="piero-subtitle-presets" aria-label="Estilos rápidos">
          <strong>Estilos rápidos</strong>
          <div>{SUBTITLE_PRESETS.map((preset) => (
            <button key={preset.label} type="button" onClick={() => onChange(preset.value)}>{preset.label}</button>
          ))}</div>
        </div>

        <div className="piero-subtitle-category-list">
          <button type="button" onClick={() => onOpenSection("text")}><span>Texto</span><small>{fontLabel} · {preferences.fontSize}% · {SUBTITLE_COLOR_NAMES[preferences.textColor]}</small><ChevronRight aria-hidden="true" /></button>
          <button type="button" onClick={() => onOpenSection("background")}><span>Fondo</span><small>{SUBTITLE_COLOR_NAMES[preferences.backgroundColor]} · {preferences.backgroundOpacity}%</small><ChevronRight aria-hidden="true" /></button>
          <button type="button" onClick={() => onOpenSection("window")}><span>Ventana</span><small>{SUBTITLE_COLOR_NAMES[preferences.windowColor]} · {preferences.windowOpacity}%</small><ChevronRight aria-hidden="true" /></button>
          <button type="button" onClick={() => onOpenSection("edge")}><span>Bordes y posición</span><small>{edgeLabel} · {preferences.position === "top" ? "Arriba" : "Abajo"}</small><ChevronRight aria-hidden="true" /></button>
        </div>
      </div>

      <footer className="piero-subtitle-settings-footer">
        <button type="button" onClick={onReset}>
          <RotateCcw size={15} aria-hidden="true" />
          <span>Restablecer valores</span>
        </button>
      </footer>
    </>
  );
}

const PIERO_KEY_SHORTCUTS = {
  togglePaused: "k Space",
  toggleMuted: "m M",
  toggleFullscreen: "f F",
  seekBackward: ["j", "J", "ArrowLeft"],
  seekForward: ["l", "L", "ArrowRight"],
  volumeUp: "ArrowUp",
  volumeDown: "ArrowDown",
};

const ACTION_FEEDBACK_ICONS = {
  play: Play,
  pause: Pause,
  volume: Volume2,
  muted: VolumeX,
};

const KEYBOARD_SHORTCUT_GROUPS = [
  { keys: ["Espacio", "K"], label: "Reproducir o pausar", Icon: Play },
  { keys: ["←", "J"], label: "Retroceder 10 segundos", Icon: RotateCcw },
  { keys: ["→", "L"], label: "Adelantar 10 segundos", Icon: RotateCw },
  { keys: ["M"], label: "Silenciar o activar sonido", Icon: Volume2 },
  { keys: ["F"], label: "Pantalla completa", Icon: Expand },
  { keys: ["↑", "↓"], label: "Subir o bajar el volumen", Icon: Volume2 },
];

function SeekBackward10Icon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M4.8 8.5A8.2 8.2 0 1 1 4 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4.8 4.8v3.7H8.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <text x="12" y="15.2" textAnchor="middle" fill="currentColor" fontSize="8.5" fontWeight="800">10</text>
    </svg>
  );
}

function SeekForward10Icon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M19.2 8.5A8.2 8.2 0 1 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M19.2 4.8v3.7h-3.7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <text x="12" y="15.2" textAnchor="middle" fill="currentColor" fontSize="8.5" fontWeight="800">10</text>
    </svg>
  );
}

const PIERO_PLYR_ICONS = {
  ...plyrLayoutIcons,
  Rewind: SeekBackward10Icon,
  FastForward: SeekForward10Icon,
};

function PieroCastControl({ onRequest }) {
  const remote = useMediaRemote();
  const canGoogleCast = useMediaState("canGoogleCast");
  const canAirPlay = useMediaState("canAirPlay");
  const remotePlaybackState = useMediaState("remotePlaybackState");
  const remotePlaybackType = useMediaState("remotePlaybackType");

  if (!canGoogleCast && !canAirPlay) return null;

  const useGoogleCast = remotePlaybackType === "google-cast"
    || (remotePlaybackType !== "airplay" && canGoogleCast);
  const provider = useGoogleCast ? "Google Cast" : "AirPlay";
  const isConnecting = remotePlaybackState === "connecting";
  const isConnected = remotePlaybackState === "connected";
  const label = isConnecting
    ? `Conectando con ${provider}`
    : isConnected
      ? `Transmitiendo mediante ${provider}`
      : `Transmitir mediante ${provider}`;

  function handleCastClick(event) {
    onRequest?.();
    if (useGoogleCast) remote.requestGoogleCast(event);
    else remote.requestAirPlay(event);
  }

  return (
    <button
      type="button"
      className="plyr__controls__item plyr__control piero-cast-button"
      aria-label={label}
      title={label}
      onClick={handleCastClick}
    >
      <Cast aria-hidden="true" />
      <span className="plyr__tooltip">{label}</span>
    </button>
  );
}

function formatRemoteTime(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;

  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function PieroRemotePlaybackView({ title, subtitleSettingsControl, onStop, onPlayHere, onRetry }) {
  const remote = useMediaRemote();
  const remotePlaybackState = useMediaState("remotePlaybackState");
  const remotePlaybackType = useMediaState("remotePlaybackType");
  const remotePlaybackInfo = useMediaState("remotePlaybackInfo");
  const paused = useMediaState("paused");
  const currentTime = useMediaState("currentTime");
  const duration = useMediaState("duration");
  const muted = useMediaState("muted");
  const volume = useMediaState("volume");
  const fullscreen = useMediaState("fullscreen");
  const [connectionHint, setConnectionHint] = useState("");
  const [controlFeedback, setControlFeedback] = useState("");
  const [hasLoadProblem, setHasLoadProblem] = useState(false);
  const feedbackTimerRef = useRef(null);

  useEffect(() => {
    setConnectionHint("");
    setHasLoadProblem(false);
    const hintTimer = window.setTimeout(() => {
      if (remotePlaybackState === "connecting") {
        setConnectionHint("La conexión está tardando más de lo normal.");
      }
    }, 6500);
    const loadTimer = window.setTimeout(() => {
      if (remotePlaybackState === "connected" && !duration) setHasLoadProblem(true);
    }, 8000);

    return () => {
      window.clearTimeout(hintTimer);
      window.clearTimeout(loadTimer);
    };
  }, [remotePlaybackState, duration]);

  useEffect(() => () => {
    if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
  }, []);

  if (remotePlaybackState === "disconnected") return null;

  const provider = remotePlaybackType === "airplay" ? "AirPlay" : "Google Cast";
  const deviceName = remotePlaybackInfo?.deviceName || "tu dispositivo";
  const isConnecting = remotePlaybackState === "connecting";

  function showRemoteFeedback(message) {
    setControlFeedback(message);
    if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = window.setTimeout(() => setControlFeedback(""), 1500);
  }

  function seekRemote(time, message) {
    remote.seek(time);
    showRemoteFeedback(message);
  }

  return (
    <section className="piero-remote-view" aria-live="polite">
      <div className="piero-remote-ambient" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="piero-remote-card">
        <span className={`piero-remote-icon ${isConnecting ? "is-connecting" : ""}`} aria-hidden="true">
          <Cast />
        </span>
        <span className="piero-remote-kicker">
          {isConnecting ? `Conectando mediante ${provider}` : `${provider} conectado`}
        </span>
        <strong>{isConnecting ? `Conectando con ${deviceName}` : `Reproduciendo en ${deviceName}`}</strong>
        <p>{title}</p>
        {isConnecting ? (
          <div className="piero-remote-connection-copy">
            <span>Selecciona un dispositivo en la ventana de Chrome.</span>
            {connectionHint ? <small>{connectionHint}</small> : null}
          </div>
        ) : (
          <span className="piero-remote-session-info">
            {deviceName} · {formatRemoteTime(currentTime)} de {formatRemoteTime(duration)} · {paused ? "Pausado" : "Reproduciendo"}
          </span>
        )}
        {hasLoadProblem ? (
          <div className="piero-remote-load-error" role="alert">
            <strong>No se pudo cargar el video en la TV.</strong>
            <span>Reintenta la carga o vuelve al reproductor de este dispositivo.</span>
          </div>
        ) : null}
        {!isConnecting ? (
          <div className="piero-remote-actions">
            <button
              type="button"
              className="is-primary"
              title="Desconecta la TV y continúa reproduciendo desde este navegador"
              onClick={() => onPlayHere(remotePlaybackType)}
            >
              <MonitorPlay aria-hidden="true" />
              <span>Ver en este dispositivo<small>Desconecta la TV y continúa aquí</small></span>
            </button>
            <button
              type="button"
              title="Desconecta la TV y deja el video pausado en este navegador"
              onClick={() => onStop(remotePlaybackType)}
            >
              <X aria-hidden="true" />
              <span>Finalizar transmisión<small>Desconecta y deja el video pausado</small></span>
            </button>
            {hasLoadProblem ? (
              <button type="button" className="is-retry" onClick={onRetry}>
                <RotateCw aria-hidden="true" />
                <span>Reintentar carga<small>Vuelve a enviar el archivo a la TV</small></span>
              </button>
            ) : null}
          </div>
        ) : (
          <button type="button" className="piero-remote-cancel" onClick={() => onStop(remotePlaybackType)}>
            Cancelar conexión
          </button>
        )}
      </div>
      {controlFeedback ? <span className="piero-remote-feedback" role="status">{controlFeedback}</span> : null}
      {!isConnecting ? (
        <div className="piero-remote-controls" aria-label={`Controles de ${provider}`}>
          <div className="piero-remote-progress">
            <input
              type="range"
              min="0"
              max={Math.max(duration || 0, 0.1)}
              step="0.1"
              value={Math.min(currentTime || 0, duration || 0)}
              aria-label="Progreso de reproducción"
              onChange={(event) => seekRemote(Number(event.target.value), `Posición: ${formatRemoteTime(event.target.value)}`)}
              style={{ "--remote-progress": `${duration ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>
          <div className="piero-remote-control-row">
            <button type="button" aria-label={paused ? "Reproducir" : "Pausar"} onClick={() => {
              if (paused) remote.play();
              else remote.pause();
              showRemoteFeedback(paused ? `Reproduciendo en ${deviceName}` : `Pausado en ${deviceName}`);
            }}>
              {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
            </button>
            <button type="button" aria-label="Retroceder 10 segundos" onClick={() => seekRemote(Math.max(0, currentTime - 10), "Retrocedido 10 segundos")}>
              <SeekBackward10Icon />
            </button>
            <button type="button" aria-label="Adelantar 10 segundos" onClick={() => seekRemote(Math.min(duration, currentTime + 10), "Adelantado 10 segundos")}>
              <SeekForward10Icon />
            </button>
            <span className="piero-remote-time">
              {formatRemoteTime(currentTime)} <i>/</i> {formatRemoteTime(duration)}
            </span>
            <div className="piero-remote-volume">
              <button type="button" aria-label={muted ? "Activar sonido" : "Silenciar"} onClick={() => (muted ? remote.unmute() : remote.mute())}>
                {muted || volume === 0 ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={muted ? 0 : volume}
                aria-label="Volumen del dispositivo receptor"
                onChange={(event) => {
                  remote.changeVolume(Number(event.target.value));
                  showRemoteFeedback(`Volumen: ${Math.round(Number(event.target.value) * 100)}%`);
                }}
              />
            </div>
            <button
              type="button"
              aria-label={fullscreen ? "Salir de pantalla completa" : "Ver controles en pantalla completa"}
              title={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
              onClick={() => (fullscreen ? remote.exitFullscreen() : remote.enterFullscreen())}
            >
              <Expand aria-hidden="true" />
            </button>
            {subtitleSettingsControl}
            <PieroCastControl />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function PieroUnifiedSettings({
  hasSubtitles,
  captionsEnabled,
  onCaptionsEnabledChange,
  onOpen,
  onOpenChange,
  onOpenSubtitleSettings,
  portalTarget,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState("root");
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const hasReportedOpenStateRef = useRef(false);
  const captionOptions = useCaptionOptions({ off: "Desactivado" });
  const speedOptions = usePlaybackRateOptions({ rates: PLAYBACK_SPEEDS, normalLabel: "1×" });
  const captionHint = captionsEnabled
    ? captionOptions.selectedTrack?.label || "Español"
    : "Desactivado";
  const speedHint = speedOptions.selectedValue === "1" ? "1×" : `${speedOptions.selectedValue}×`;
  const titles = {
    root: "Configuración",
    captions: "Subtítulos",
    speed: "Velocidad de reproducción",
  };

  useEffect(() => {
    if (!hasReportedOpenStateRef.current) {
      hasReportedOpenStateRef.current = true;
      if (!isOpen) return;
    }
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handlePointerDown(event) {
      if (
        !rootRef.current?.contains(event.target)
        && !panelRef.current?.contains(event.target)
      ) setIsOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const openView = (nextView) => setView(nextView);
  const goBack = () => setView("root");

  const panel = isOpen ? (
    <>
      <button
        type="button"
        className="piero-mobile-sheet-backdrop"
        aria-label="Cerrar configuración"
        onClick={() => setIsOpen(false)}
      />
      <section
        ref={panelRef}
        className={`piero-unified-settings-panel is-${view}`}
        role="dialog"
        aria-modal="false"
        aria-label={titles[view]}
      >
      <header>
        {view !== "root" ? (
          <button type="button" className="piero-settings-back" onClick={goBack} aria-label={`Volver desde ${titles[view]}`}>
            <ChevronLeft aria-hidden="true" />
            <strong>{titles[view]}</strong>
          </button>
        ) : <strong>{titles[view]}</strong>}
      </header>

      {view === "root" ? (
        <div className="piero-settings-level piero-settings-root">
          {hasSubtitles ? (
            <button type="button" onClick={() => openView("captions")}>
              <Captions aria-hidden="true" />
              <span>Subtítulos</span><small>{captionHint}</small><ChevronRight aria-hidden="true" />
            </button>
          ) : null}
          <button type="button" onClick={() => openView("speed")}>
            <Gauge aria-hidden="true" />
            <span>Velocidad de reproducción</span><small>{speedHint}</small><ChevronRight aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {view === "captions" ? (
        <div className="piero-settings-level piero-settings-options" role="radiogroup" aria-label="Subtítulos">
          {captionOptions.map(({ label, value, select }) => {
            const isSelected = value === "off"
              ? !captionsEnabled
              : captionsEnabled && captionOptions.selectedValue === value;
            return (
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={isSelected ? "is-selected" : ""}
                onClick={(event) => {
                  select(event);
                  onCaptionsEnabledChange?.(value !== "off");
                }}
                key={value}
              >
                <span className="piero-settings-radio" aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
          <button
            type="button"
            className="piero-settings-forward"
            onClick={() => {
              setIsOpen(false);
              onOpenSubtitleSettings?.();
            }}
          >
            <span>Personalizar apariencia</span><small>Apariencia</small><ChevronRight aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {view === "speed" ? (
        <div className="piero-settings-level piero-settings-options" role="radiogroup" aria-label="Velocidad de reproducción">
          {speedOptions.map(({ label, value, select }) => (
            <button
              type="button"
              role="radio"
              aria-checked={speedOptions.selectedValue === value}
              className={speedOptions.selectedValue === value ? "is-selected" : ""}
              onClick={select}
              key={value}
            >
              <span className="piero-settings-radio" aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      ) : null}
      </section>
    </>
  ) : null;

  return (
    <div ref={rootRef} className="piero-unified-settings">
      <button
        type="button"
        className="plyr__controls__item plyr__control piero-unified-settings-trigger"
        aria-label="Configuración"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => {
          setView("root");
          setIsOpen((current) => {
            const next = !current;
            if (next) onOpen?.();
            return next;
          });
        }}
      >
        <Settings aria-hidden="true" />
        <span className="plyr__tooltip">Configuración</span>
      </button>

      {panel && portalTarget ? createPortal(panel, portalTarget) : panel}
    </div>
  );
}

function PieroSubtitleCustomizationPanel({ panelRef, preferences, onChange, onReset, onClose }) {
  const [section, setSection] = useState(null);
  const sectionTitles = {
    text: "Texto",
    background: "Fondo",
    window: "Ventana",
    edge: "Bordes y posición",
  };

  return (
    <section
      ref={panelRef}
      id="piero-subtitle-customization"
      className="piero-subtitle-customization-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="piero-subtitle-customization-title"
    >
      <header>
        {section ? (
          <button
            type="button"
            className="piero-subtitle-customization-back"
            aria-label="Volver a personalizar apariencia"
            onClick={() => setSection(null)}
          >
            <ChevronLeft aria-hidden="true" />
            <span>SUBTÍTULOS</span>
            <strong id="piero-subtitle-customization-title">{sectionTitles[section]}</strong>
          </button>
        ) : <div>
          <span>SUBTÍTULOS</span>
          <strong id="piero-subtitle-customization-title">Personalizar apariencia</strong>
        </div>}
        <button
          type="button"
          className="piero-subtitle-customization-close"
          aria-label="Cerrar personalización"
          onClick={onClose}
        >
          <X size={17} aria-hidden="true" />
        </button>
      </header>
      <div className="piero-subtitle-customization-content">
        <PieroSubtitleAppearance
          preferences={preferences}
          onChange={onChange}
          onReset={onReset}
          section={section || undefined}
          onOpenSection={setSection}
        />
      </div>
    </section>
  );
}

function PieroPlayerChrome({ title, shortcutsControl, subtitleSettingsControl, unifiedSettingsControl, useTouchControls, onStartRemote, onStopRemote, onPlayHere, onRetryRemote }) {
  const remotePlaybackState = useMediaState("remotePlaybackState");
  const isRemote = remotePlaybackState !== "disconnected";

  if (isRemote) {
    return (
      <PieroRemotePlaybackView
        title={title}
        subtitleSettingsControl={subtitleSettingsControl}
        onStop={onStopRemote}
        onPlayHere={onPlayHere}
        onRetry={onRetryRemote}
      />
    );
  }

  return (
    <PlyrLayout
      icons={PIERO_PLYR_ICONS}
      controls={PLYR_CONTROLS}
      seekTime={10}
      speed={PLAYBACK_SPEEDS}
      translations={PIERO_PLAYER_TRANSLATIONS}
      slots={{
        beforeSettings: (
          <>
            <PieroCastControl onRequest={onStartRemote} />
            {shortcutsControl}
          </>
        ),
        settings: unifiedSettingsControl,
      }}
      clickToPlay={!useTouchControls}
      clickToFullscreen={false}
      displayDuration
    />
  );
}

const PIERO_PLAYER_TRANSLATIONS = {
  Audio: "Audio",
  Auto: "Automática",
  Captions: "Subtítulos",
  "Current time": "Tiempo actual",
  Default: "Predeterminado",
  "Disable captions": "Desactivar subtítulos",
  Disabled: "Desactivado",
  Duration: "Duración",
  "Enable captions": "Activar subtítulos",
  "Enter Fullscreen": "Entrar en pantalla completa",
  "Exit Fullscreen": "Salir de pantalla completa",
  Forward: "Adelantar",
  "Go back to previous menu": "Volver al menú anterior",
  Mute: "Silenciar",
  Normal: "1×",
  Pause: "Pausar",
  "Enter PiP": "Abrir imagen en imagen",
  "Exit PiP": "Cerrar imagen en imagen",
  Play: "Reproducir",
  Quality: "Calidad",
  Reset: "Restablecer",
  Rewind: "Retroceder",
  Seek: "Buscar",
  Settings: "Configuración",
  Speed: "Velocidad de reproducción",
  Unmute: "Activar sonido",
  Volume: "Volumen",
};

const PieroVideoPlayer = forwardRef(function PieroVideoPlayer(
  {
    src,
    subtitleSrc,
    title,
    children,
    onLoadStart,
    onLoadedMetadata,
    onCanPlay,
    onPlaying,
    onWaiting,
    onStalled,
    onTimeUpdate,
    onPause,
    onEnded,
    onError,
  },
  forwardedRef,
) {
  const playerRef = useRef(null);
  const lastPlaybackTimeRef = useRef(0);
  const feedbackTimerRef = useRef(null);
  const actionFeedbackTimerRef = useRef(null);
  const rateToastTimerRef = useRef(null);
  const remoteTransitionRef = useRef(null);
  const remotePlaybackStateRef = useRef("disconnected");
  const remoteProviderRef = useRef(null);
  const remoteSyncTimerRef = useRef(null);
  const remoteDisconnectTimerRef = useRef(null);
  const shortcutsButtonRef = useRef(null);
  const shortcutsPanelRef = useRef(null);
  const subtitleSettingsButtonRef = useRef(null);
  const subtitleSettingsPanelRef = useRef(null);
  const lastVolumeStateRef = useRef(null);
  const isPlayerReadyRef = useRef(false);
  const fullscreenPlaybackIntentRef = useRef(false);
  const isFullscreenRef = useRef(false);
  const fullscreenExitGraceUntilRef = useRef(0);
  const fullscreenResumeTimersRef = useRef([]);
  const fullscreenCaptionTimersRef = useRef([]);
  const [seekFeedback, setSeekFeedback] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);
  const [rateToast, setRateToast] = useState("");
  const [castToast, setCastToast] = useState("");
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isSubtitleSettingsOpen, setIsSubtitleSettingsOpen] = useState(false);
  const [subtitlePreferences, setSubtitlePreferences] = useState(DEFAULT_SUBTITLE_PREFERENCES);
  const [areSubtitlePreferencesLoaded, setAreSubtitlePreferencesLoaded] = useState(false);
  const [useTouchControls, setUseTouchControls] = useState(false);
  const [isIOSWebKit, setIsIOSWebKit] = useState(false);
  const [playerElement, setPlayerElement] = useState(null);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);

  const applyCaptionsState = useCallback((enabled) => {
    setCaptionsEnabled(enabled);

    const player = playerRef.current;
    for (const track of Array.from(player?.textTracks || [])) {
      if (track.kind === "subtitles" && track.language === "es") {
        track.mode = enabled ? "showing" : "disabled";
      }
    }

    const playerRoot = player?.el || player;
    const video = playerRoot?.querySelector?.("[data-media-provider] video");
    for (const track of Array.from(video?.textTracks || [])) {
      if (track.kind === "subtitles" && (track.language === "es" || track.label === "Español")) {
        track.mode = enabled ? "showing" : "disabled";
      }
    }
  }, []);

  const syncCaptionsAfterFullscreenChange = useCallback(() => {
    fullscreenCaptionTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    const enabled = readPieroPreferences().captions === true;
    fullscreenCaptionTimersRef.current = [0, 120, 420].map((delay) => window.setTimeout(() => {
      applyCaptionsState(enabled);
    }, delay));
  }, [applyCaptionsState]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(hover: none), (pointer: coarse)");
    const updateTouchControls = () => setUseTouchControls(mediaQuery.matches);

    updateTouchControls();
    if (mediaQuery.addEventListener) mediaQuery.addEventListener("change", updateTouchControls);
    else mediaQuery.addListener(updateTouchControls);

    return () => {
      if (mediaQuery.removeEventListener) mediaQuery.removeEventListener("change", updateTouchControls);
      else mediaQuery.removeListener(updateTouchControls);
    };
  }, []);

  useEffect(() => {
    const navigatorInfo = window.navigator;
    const appleMobile = /iPad|iPhone|iPod/.test(navigatorInfo.userAgent)
      || (navigatorInfo.platform === "MacIntel" && navigatorInfo.maxTouchPoints > 1);
    setIsIOSWebKit(appleMobile);
  }, []);

  useEffect(() => {
    if (!useTouchControls) return undefined;

    let video = null;
    const revealControls = (event) => {
      const controls = playerRef.current?.controls;
      controls?.show(0, event);
      controls?.hide(undefined, event);
    };
    const frameId = window.requestAnimationFrame(() => {
      const player = playerRef.current;
      const playerElement = player?.el || player;
      video = playerElement?.querySelector?.("[data-media-provider] video");
      video?.addEventListener("pointerup", revealControls);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      video?.removeEventListener("pointerup", revealControls);
    };
  }, [src, useTouchControls]);

  useEffect(() => {
    const storedPreferences = readPieroPreferences();
    setSubtitlePreferences(normalizeSubtitlePreferences(storedPreferences.subtitles));
    setCaptionsEnabled(storedPreferences.captions === true);
    setAreSubtitlePreferencesLoaded(true);
  }, []);

  useEffect(() => {
    if (!areSubtitlePreferencesLoaded) return;
    writePieroPreference("subtitles", subtitlePreferences);
  }, [areSubtitlePreferencesLoaded, subtitlePreferences]);

  const showCastToast = useCallback((message) => {
    setRateToast("");
    setCastToast(message);
    if (rateToastTimerRef.current) window.clearTimeout(rateToastTimerRef.current);
    rateToastTimerRef.current = window.setTimeout(() => setCastToast(""), 2600);
  }, []);

  const keepControlsVisible = useCallback((visible) => {
    const controls = playerRef.current?.controls;
    if (!controls) return;
    if (visible) {
      controls.show();
      controls.pause();
    } else {
      controls.resume();
      controls.hide();
    }
  }, []);

  useEffect(() => {
    keepControlsVisible(isShortcutsOpen || isSubtitleSettingsOpen);
  }, [isShortcutsOpen, isSubtitleSettingsOpen, keepControlsVisible]);

  const setPlayerRef = useCallback(
    (instance) => {
      playerRef.current = instance;
      setPlayerElement(instance?.el instanceof Element ? instance.el : null);
      if (typeof forwardedRef === "function") forwardedRef(instance);
      else if (forwardedRef) forwardedRef.current = instance;
    },
    [forwardedRef],
  );

  useEffect(() => () => {
    if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    if (actionFeedbackTimerRef.current) window.clearTimeout(actionFeedbackTimerRef.current);
    if (rateToastTimerRef.current) window.clearTimeout(rateToastTimerRef.current);
    if (remoteSyncTimerRef.current) window.clearTimeout(remoteSyncTimerRef.current);
    if (remoteDisconnectTimerRef.current) window.clearTimeout(remoteDisconnectTimerRef.current);
    fullscreenResumeTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    fullscreenCaptionTimersRef.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const resumeAfterFullscreen = useCallback(() => {
    fullscreenResumeTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    fullscreenResumeTimersRef.current = [0, 180, 520].map((delay) => window.setTimeout(() => {
      const player = playerRef.current;
      if (
        !fullscreenPlaybackIntentRef.current
        || isFullscreenRef.current
        || !player?.paused
        || player.ended
      ) return;

      const playResult = player.play?.();
      playResult?.catch?.(() => {});
    }, delay));
  }, []);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return undefined;

    function handleGoogleCastPromptError(event) {
      remoteTransitionRef.current = null;
      if (event.detail?.code !== "CANCEL") {
        showCastToast("No se pudo abrir Google Cast.");
      }
    }

    function handleRemotePlaybackChange(event) {
      const detail = event.detail;
      if (detail?.state) remotePlaybackStateRef.current = detail.state;
      if (detail?.state === "connecting" && !remoteTransitionRef.current) {
        remoteTransitionRef.current = {
          mode: "casting",
          time: lastPlaybackTimeRef.current,
          shouldPlay: !player.paused,
        };
      }

      if (detail?.state === "connecting" && remoteTransitionRef.current?.mode === "casting") {
        persistVidstackRemoteState(player, remoteTransitionRef.current);
        window.setTimeout(() => {
          if (remoteTransitionRef.current?.mode === "casting") {
            persistVidstackRemoteState(player, remoteTransitionRef.current);
          }
        }, 0);
      }

      if (detail?.state === "connected") {
        showCastToast("Transmisión conectada.");
        if (remoteTransitionRef.current?.mode === "casting") {
          persistVidstackRemoteState(player, remoteTransitionRef.current);
        }
        syncGoogleCastTransition();
      }
      if (detail?.state === "disconnected" && detail.type !== "none") {
        showCastToast("Transmisión finalizada.");

        if (!remoteTransitionRef.current) {
          remoteTransitionRef.current = {
            mode: "returning",
            time: lastPlaybackTimeRef.current,
            shouldPlay: !player.paused,
          };
        }
      }
    }

    function handleProviderChange(event) {
      remoteProviderRef.current = event.detail || null;

      if (event.detail?.type === "google-cast") {
        if (remoteTransitionRef.current?.mode === "casting") {
          persistVidstackRemoteState(player, remoteTransitionRef.current);
        }
        syncGoogleCastTransition();
        return;
      }

    }

    player.addEventListener("google-cast-prompt-error", handleGoogleCastPromptError);
    player.addEventListener("remote-playback-change", handleRemotePlaybackChange);
    player.addEventListener("provider-change", handleProviderChange);

    return () => {
      player.removeEventListener("google-cast-prompt-error", handleGoogleCastPromptError);
      player.removeEventListener("remote-playback-change", handleRemotePlaybackChange);
      player.removeEventListener("provider-change", handleProviderChange);
    };
  }, [showCastToast]);

  useEffect(() => {
    if (!isShortcutsOpen) return undefined;
    const focusFrame = window.requestAnimationFrame(() => {
      shortcutsPanelRef.current?.querySelector("button")?.focus({ preventScroll: true });
    });
    function handlePointerDown(event) {
      if (
        shortcutsPanelRef.current?.contains(event.target) ||
        shortcutsButtonRef.current?.contains(event.target)
      ) return;
      setIsShortcutsOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isShortcutsOpen]);

  useEffect(() => {
    if (!isSubtitleSettingsOpen) return undefined;
    const focusFrame = window.requestAnimationFrame(() => {
      subtitleSettingsPanelRef.current?.querySelector("button")?.focus({ preventScroll: true });
    });
    function handlePointerDown(event) {
      if (
        subtitleSettingsPanelRef.current?.contains(event.target) ||
        subtitleSettingsButtonRef.current?.contains(event.target)
      ) return;
      setIsSubtitleSettingsOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") setIsSubtitleSettingsOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSubtitleSettingsOpen]);

  function showSeekFeedback(targetTime) {
    const difference = targetTime - lastPlaybackTimeRef.current;
    if (Math.abs(Math.abs(difference) - 10) > 1.5) return;
    showDirectionalSeekFeedback(difference < 0 ? "backward" : "forward");
  }

  function showDirectionalSeekFeedback(direction) {
    setSeekFeedback(direction);
    if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = window.setTimeout(() => setSeekFeedback(null), 650);
  }

  function showRateToast(playbackRate) {
    if (!isPlayerReadyRef.current) return;
    setCastToast("");
    setRateToast(`Velocidad: ${playbackRate}×`);
    if (rateToastTimerRef.current) window.clearTimeout(rateToastTimerRef.current);
    rateToastTimerRef.current = window.setTimeout(() => setRateToast(""), 1400);
  }

  function showActionFeedback(action) {
    if (!isPlayerReadyRef.current) return;
    setActionFeedback(action);
    if (actionFeedbackTimerRef.current) window.clearTimeout(actionFeedbackTimerRef.current);
    actionFeedbackTimerRef.current = window.setTimeout(() => setActionFeedback(null), 650);
  }

  function handleVolumeChange(detail) {
    const nextState = { muted: detail.muted, volume: detail.volume };
    const previousState = lastVolumeStateRef.current;
    lastVolumeStateRef.current = nextState;
    if (!isPlayerReadyRef.current || !previousState) return;
    showActionFeedback(detail.muted || detail.volume === 0 ? "muted" : "volume");
  }

  async function restoreRemoteTransition(player) {
    const transition = remoteTransitionRef.current;
    if (!transition || !player) return false;
    if (transition.mode !== "returning") return false;
    if (transition.mode === "returning" && remotePlaybackStateRef.current !== "disconnected") return false;

    const duration = Number(player.duration);
    const safeTime = Number.isFinite(duration) && duration > 0
      ? Math.min(Math.max(transition.time, 0), Math.max(duration - 0.5, 0))
      : Math.max(transition.time, 0);

    player.currentTime = safeTime;
    lastPlaybackTimeRef.current = safeTime;

    try {
      if (transition.shouldPlay) await player.play();
      else await player.pause();
    } catch {
      if (transition.mode === "returning" && transition.shouldPlay) {
        showCastToast("Presiona reproducir para continuar desde el punto guardado.");
      }
    } finally {
      remoteTransitionRef.current = null;
    }

    return true;
  }

  function getGoogleCastPlayer() {
    const provider = playerRef.current?.provider || remoteProviderRef.current;
    if (provider?.type !== "google-cast") return null;
    return provider.player || null;
  }

  function buildCastTextTrackStyle(preferences) {
    const castMedia = window.chrome?.cast?.media;
    if (!castMedia?.TextTrackStyle) return null;
    const style = new castMedia.TextTrackStyle();
    const font = getSubtitleFont(preferences);
    style.foregroundColor = toCastColor(preferences.textColor, preferences.textOpacity);
    style.backgroundColor = toCastColor(preferences.backgroundColor, preferences.backgroundOpacity);
    style.edgeColor = toCastColor(preferences.edgeColor, 100);
    style.windowColor = toCastColor(preferences.windowColor, preferences.windowOpacity);
    style.fontScale = preferences.fontSize / 100;
    style.fontGenericFamily = castMedia.TextTrackFontGenericFamily?.[font.cast] || font.cast;
    style.fontStyle = castMedia.TextTrackFontStyle?.NORMAL || "NORMAL";
    style.edgeType = castMedia.TextTrackEdgeType?.[preferences.edgeStyle.replace("-", "_").toUpperCase()]
      || preferences.edgeStyle.replace("-", "_").toUpperCase();
    style.windowType = castMedia.TextTrackWindowType?.NORMAL || "NORMAL";
    return style;
  }

  function syncCastSubtitleStyle(preferences = subtitlePreferences) {
    const provider = playerRef.current?.provider || remoteProviderRef.current;
    if (provider?.type !== "google-cast") return;
    const castContext = provider.cast || window.cast?.framework?.CastContext?.getInstance?.();
    const session = provider.session || castContext?.getCurrentSession?.();
    const mediaSession = provider.media || session?.getMediaSession?.();
    const castMedia = window.chrome?.cast?.media;
    const style = buildCastTextTrackStyle(preferences);
    if (!mediaSession?.editTracksInfo || !castMedia?.EditTracksInfoRequest || !style) return;
    const activeTrackIds = Array.isArray(mediaSession.activeTrackIds) ? mediaSession.activeTrackIds : null;
    const request = new castMedia.EditTracksInfoRequest(activeTrackIds, style);
    mediaSession.editTracksInfo(request, () => {}, () => {});
  }

  useEffect(() => {
    syncCastSubtitleStyle(subtitlePreferences);
  }, [subtitlePreferences]);

  function persistVidstackRemoteState(player, transition) {
    player?.$state?.savedState?.set?.({
      // The default Cast receiver can remain at 0:00 without loading metadata
      // when the initial LoadRequest uses autoplay=false. Always load first and
      // restore the intended paused state as soon as the receiver is ready.
      paused: transition.mode === "casting" ? false : !transition.shouldPlay,
      currentTime: transition.time,
    });
  }

  function releaseVidstackRemoteProvider(player) {
    player?.$state?.remotePlaybackLoader?.set?.(null);
    player?.$state?.remotePlaybackState?.set?.("disconnected");
    player?.$state?.remotePlaybackType?.set?.("none");
    player?.$state?.remotePlaybackInfo?.set?.(null);
    remotePlaybackStateRef.current = "disconnected";
  }

  function syncGoogleCastTransition(attempt = 0) {
    const transition = remoteTransitionRef.current;
    if (!transition || transition.mode !== "casting") return;

    const castPlayer = getGoogleCastPlayer();
    if (!castPlayer?.isConnected || !castPlayer?.isMediaLoaded) {
      if (attempt === 10) {
        const player = playerRef.current;
        const provider = player?.provider;
        const source = player?.$state?.source?.();
        if (provider?.type === "google-cast" && source) {
          persistVidstackRemoteState(player, transition);
          provider.loadSource(source).catch(() => {
            showCastToast("No se pudo cargar el video en Google Cast.");
          });
        }
      }
      if (attempt < 50) {
        if (remoteSyncTimerRef.current) window.clearTimeout(remoteSyncTimerRef.current);
        remoteSyncTimerRef.current = window.setTimeout(() => syncGoogleCastTransition(attempt + 1), 200);
      }
      return;
    }

    const duration = Number(castPlayer.duration);
    const savedTime = Number(transition.time);
    const safeTime = Number.isFinite(duration) && duration > 0
      ? Math.min(Math.max(savedTime, 0), Math.max(duration - 0.5, 0))
      : Math.max(savedTime, 0);

    castPlayer.currentTime = safeTime;
    castPlayer.controller?.seek();
    lastPlaybackTimeRef.current = safeTime;

    window.setTimeout(() => {
      const shouldBePaused = !transition.shouldPlay;
      if (castPlayer.isPaused !== shouldBePaused) castPlayer.controller?.playOrPause();
      syncCastSubtitleStyle();
      if (remoteTransitionRef.current === transition) remoteTransitionRef.current = null;
    }, 250);
  }

  const ActionFeedbackIcon = actionFeedback ? ACTION_FEEDBACK_ICONS[actionFeedback] : null;

  function closeShortcuts({ restoreFocus = true } = {}) {
    setIsShortcutsOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => shortcutsButtonRef.current?.focus());
  }

  function handleShortcutsKeyDown(event) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    closeShortcuts();
  }

  async function leaveRemotePlayback({ playLocally, remoteType }) {
    const player = playerRef.current;
    if (!player) return;

    try {
      const provider = player.provider || remoteProviderRef.current;
      const castPlayer = getGoogleCastPlayer();
      const estimatedRemoteTime = Number(provider?.media?.getEstimatedTime?.());
      const playerRemoteTime = Number(castPlayer?.currentTime);
      const remoteDuration = Number(castPlayer?.duration);
      const isValidRemoteTime = (value) => Number.isFinite(value)
        && value >= 0
        && (!Number.isFinite(remoteDuration) || remoteDuration <= 0 || value <= remoteDuration + 1);
      const safeRemoteTime = isValidRemoteTime(playerRemoteTime)
        ? playerRemoteTime
        : isValidRemoteTime(estimatedRemoteTime)
          ? estimatedRemoteTime
          : lastPlaybackTimeRef.current;

      remoteTransitionRef.current = {
        mode: "returning",
        time: safeRemoteTime,
        shouldPlay: playLocally,
      };
      lastPlaybackTimeRef.current = safeRemoteTime;
      persistVidstackRemoteState(player, remoteTransitionRef.current);

      if (!playLocally && castPlayer && !castPlayer.isPaused) {
        castPlayer.controller?.playOrPause();
      }

      if (remoteType !== "airplay") {
        const castContext = provider?.cast
          || window.cast?.framework?.CastContext?.getInstance?.();
        if (!castContext) throw new Error("Google Cast no está disponible.");
        const castSession = provider?.session || castContext.getCurrentSession?.();
        if (castSession?.endSession) castSession.endSession(true);
        else castContext.endCurrentSession(true);

        releaseVidstackRemoteProvider(player);

        remoteDisconnectTimerRef.current = window.setTimeout(() => {
          if (castContext.getCurrentSession?.()) {
            castContext.endCurrentSession(true);
            releaseVidstackRemoteProvider(player);
          }
        }, 500);
        return;
      }

      player.remote?.requestAirPlay();
    } catch {
      remoteTransitionRef.current = null;
      showCastToast("No se pudo finalizar la transmisión.");
    }
  }

  function prepareRemotePlayback() {
    const player = playerRef.current;
    if (!player) return;
    remoteTransitionRef.current = {
      mode: "casting",
      time: lastPlaybackTimeRef.current,
      shouldPlay: !player.paused,
    };
    persistVidstackRemoteState(player, remoteTransitionRef.current);
  }

  function retryRemotePlayback() {
    const player = playerRef.current;
    const provider = player?.provider;
    const source = player?.$state?.source?.();
    if (!player || provider?.type !== "google-cast" || !source) {
      showCastToast("No se pudo reintentar la carga en Google Cast.");
      return;
    }

    if (!remoteTransitionRef.current || remoteTransitionRef.current.mode !== "casting") {
      remoteTransitionRef.current = {
        mode: "casting",
        time: lastPlaybackTimeRef.current,
        shouldPlay: false,
      };
    }
    persistVidstackRemoteState(player, remoteTransitionRef.current);
    provider.loadSource(source)
      .then(() => syncGoogleCastTransition())
      .catch(() => showCastToast("No se pudo cargar el video en Google Cast."));
  }

  const shortcutsControl = (
    <button
      ref={shortcutsButtonRef}
      type="button"
      className="plyr__controls__item plyr__control piero-shortcuts-button"
      aria-label="Mostrar atajos de teclado"
      aria-haspopup="dialog"
      aria-expanded={isShortcutsOpen}
      aria-controls="piero-keyboard-shortcuts"
      onClick={() => {
        setIsSubtitleSettingsOpen(false);
        setIsShortcutsOpen((current) => !current);
      }}
    >
      <Keyboard aria-hidden="true" />
      <span className="plyr__tooltip">Atajos de teclado</span>
    </button>
  );

  const unifiedSettingsControl = (
    <PieroUnifiedSettings
      hasSubtitles={Boolean(subtitleSrc)}
      captionsEnabled={captionsEnabled}
      onCaptionsEnabledChange={(enabled) => {
        writePieroPreference("captions", enabled);
        applyCaptionsState(enabled);
      }}
      portalTarget={playerElement}
      onOpenChange={keepControlsVisible}
      onOpen={() => {
        setIsShortcutsOpen(false);
        setIsSubtitleSettingsOpen(false);
      }}
      onOpenSubtitleSettings={() => {
        setIsShortcutsOpen(false);
        setIsSubtitleSettingsOpen(true);
      }}
    />
  );

  const subtitleSettingsControl = subtitleSrc ? (
    <button
      ref={subtitleSettingsButtonRef}
      type="button"
      className="plyr__controls__item plyr__control piero-subtitle-settings-button"
      aria-label="Personalizar subtítulos"
      aria-haspopup="dialog"
      aria-expanded={isSubtitleSettingsOpen}
      aria-controls="piero-subtitle-customization"
      onClick={() => {
        setIsShortcutsOpen(false);
        setIsSubtitleSettingsOpen((current) => !current);
      }}
    >
      <Captions aria-hidden="true" />
      <span className="plyr__tooltip">Personalizar subtítulos</span>
    </button>
  ) : null;

  const subtitleEdge = getSubtitleEdgeStyles(subtitlePreferences);
  const subtitleFont = getSubtitleFont(subtitlePreferences);
  const subtitlePlayerStyles = {
    "--media-user-text-color": hexToRgba(subtitlePreferences.textColor, subtitlePreferences.textOpacity),
    "--media-user-text-bg": hexToRgba(subtitlePreferences.backgroundColor, subtitlePreferences.backgroundOpacity),
    "--media-user-display-bg": hexToRgba(subtitlePreferences.windowColor, subtitlePreferences.windowOpacity),
    "--media-user-font-size": subtitlePreferences.fontSize / 100,
    "--media-user-font-family": subtitleFont.css,
    "--media-user-font-variant": subtitlePreferences.fontFamily === "small-caps" ? "small-caps" : "normal",
    "--media-user-text-shadow": subtitleEdge.shadow,
    "--cue-outline": subtitleEdge.outline,
    "--piero-caption-size": subtitlePreferences.fontSize / 100,
    "--piero-caption-window": hexToRgba(subtitlePreferences.windowColor, subtitlePreferences.windowOpacity),
    "--piero-caption-outline": subtitleEdge.outline,
  };

  return (
    <MediaPlayer
      ref={setPlayerRef}
      className="piero-media-player"
      style={subtitlePlayerStyles}
      data-subtitle-position={subtitlePreferences.position}
      src={{ src, type: "video/mp4" }}
      crossOrigin="anonymous"
      title={title || "Resubido de Piero"}
      preload="metadata"
      playsInline
      storage={PIERO_PREFERENCE_STORAGE}
      keyTarget="player"
      keyShortcuts={PIERO_KEY_SHORTCUTS}
      aria-keyshortcuts="Space K M F J L ArrowLeft ArrowRight ArrowUp ArrowDown"
      onLoadStart={() => onLoadStart?.()}
      onLoadedMetadata={() => onLoadedMetadata?.(playerRef.current)}
      onCanPlay={async () => {
        isPlayerReadyRef.current = true;
        lastVolumeStateRef.current = {
          muted: Boolean(playerRef.current?.muted),
          volume: Number(playerRef.current?.volume ?? 1),
        };
        await restoreRemoteTransition(playerRef.current);
        onCanPlay?.(playerRef.current);
      }}
      onPlay={() => {
        if (isFullscreenRef.current) fullscreenPlaybackIntentRef.current = true;
        showActionFeedback("play");
      }}
      onPlaying={() => {
        fullscreenPlaybackIntentRef.current = true;
        onPlaying?.();
      }}
      onWaiting={() => onWaiting?.(playerRef.current)}
      onStalled={() => onStalled?.(playerRef.current)}
      onTimeUpdate={(detail) => {
        if (remoteTransitionRef.current) return;
        lastPlaybackTimeRef.current = detail.currentTime;
        onTimeUpdate?.(detail.currentTime, playerRef.current?.duration || 0);
      }}
      onSeeking={showSeekFeedback}
      onRateChange={showRateToast}
      onVolumeChange={handleVolumeChange}
      onPause={() => {
        showActionFeedback("pause");
        if (
          !isFullscreenRef.current
          && Date.now() > fullscreenExitGraceUntilRef.current
        ) fullscreenPlaybackIntentRef.current = false;
        if (remoteTransitionRef.current) return;
        onPause?.(playerRef.current);
      }}
      onTextTrackChange={(track) => {
        if (track) {
          setCaptionsEnabled(true);
          writePieroPreference("captions", true);
        } else if (!isFullscreenRef.current) {
          setCaptionsEnabled(false);
          writePieroPreference("captions", false);
        }
      }}
      onFullscreenChange={(isFullscreen) => {
        const player = playerRef.current;
        if (isFullscreen) {
          fullscreenResumeTimersRef.current.forEach((timer) => window.clearTimeout(timer));
          fullscreenPlaybackIntentRef.current = fullscreenPlaybackIntentRef.current
            || Boolean(player && !player.paused);
          isFullscreenRef.current = true;
          syncCaptionsAfterFullscreenChange();
          return;
        }

        fullscreenExitGraceUntilRef.current = Date.now() + 1200;
        isFullscreenRef.current = false;
        syncCaptionsAfterFullscreenChange();
        resumeAfterFullscreen();
      }}
      onEnded={() => {
        fullscreenPlaybackIntentRef.current = false;
        if (remoteTransitionRef.current) return;
        onEnded?.();
      }}
      onError={(detail) => onError?.(detail)}
    >
      <MediaProvider mediaProps={{ disableRemotePlayback: !isIOSWebKit }}>
        {subtitleSrc ? <PieroSubtitleTrack src={subtitleSrc} enabled={captionsEnabled} /> : null}
      </MediaProvider>
      <Gesture
        className="piero-double-gesture is-backward"
        event="dblpointerup"
        action="seek:-10"
        onTrigger={() => showDirectionalSeekFeedback("backward")}
      />
      <Gesture className="piero-double-gesture is-fullscreen" event="dblpointerup" action="toggle:fullscreen" />
      <Gesture
        className="piero-double-gesture is-forward"
        event="dblpointerup"
        action="seek:10"
        onTrigger={() => showDirectionalSeekFeedback("forward")}
      />
      <PieroPlayerChrome
        title={title || "Resubido de Piero"}
        shortcutsControl={shortcutsControl}
        subtitleSettingsControl={subtitleSettingsControl}
        unifiedSettingsControl={unifiedSettingsControl}
        useTouchControls={useTouchControls}
        onStartRemote={prepareRemotePlayback}
        onStopRemote={(remoteType) => leaveRemotePlayback({ playLocally: false, remoteType })}
        onPlayHere={(remoteType) => leaveRemotePlayback({ playLocally: true, remoteType })}
        onRetryRemote={retryRemotePlayback}
      />
      {isShortcutsOpen ? (
        <section
          ref={shortcutsPanelRef}
          id="piero-keyboard-shortcuts"
          className="piero-shortcuts-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="piero-shortcuts-title"
          onKeyDown={handleShortcutsKeyDown}
        >
          <header>
            <div>
              <span>CONTROLES</span>
              <strong id="piero-shortcuts-title">Atajos de teclado</strong>
            </div>
            <button type="button" aria-label="Cerrar atajos" onClick={() => closeShortcuts()}>
              <X size={17} aria-hidden="true" />
            </button>
          </header>
          <dl>
            {KEYBOARD_SHORTCUT_GROUPS.map((shortcut) => {
              const ShortcutIcon = shortcut.Icon;
              return (
                <div key={shortcut.label}>
                  <dt>
                    <ShortcutIcon size={19} aria-hidden="true" />
                    <span>{shortcut.label}</span>
                  </dt>
                  <dd>{shortcut.keys.map((key) => <kbd key={key}>{key}</kbd>)}</dd>
                </div>
              );
            })}
          </dl>
          <p>
            <ArrowLeft size={15} aria-hidden="true" />
            Doble toque o clic en los laterales para saltar 10 segundos.
            <ArrowRight size={15} aria-hidden="true" />
          </p>
        </section>
      ) : null}
      {isSubtitleSettingsOpen ? (
        <>
          <button
            type="button"
            className="piero-mobile-sheet-backdrop"
            aria-label="Cerrar personalización de subtítulos"
            onClick={() => setIsSubtitleSettingsOpen(false)}
          />
          <PieroSubtitleCustomizationPanel
            panelRef={subtitleSettingsPanelRef}
            preferences={subtitlePreferences}
            onChange={setSubtitlePreferences}
            onReset={() => setSubtitlePreferences(DEFAULT_SUBTITLE_PREFERENCES)}
            onClose={() => setIsSubtitleSettingsOpen(false)}
          />
        </>
      ) : null}
      {seekFeedback ? (
        <div className={`piero-seek-feedback is-${seekFeedback}`} aria-hidden="true">
          {seekFeedback === "backward" ? "−10 s" : "+10 s"}
        </div>
      ) : null}
      {ActionFeedbackIcon ? (
        <div className="piero-action-feedback" aria-hidden="true">
          <ActionFeedbackIcon size={30} fill={actionFeedback === "play" ? "currentColor" : "none"} />
        </div>
      ) : null}
      {rateToast ? <div className="piero-player-toast" role="status">{rateToast}</div> : null}
      {castToast ? <div className="piero-player-toast" role="status">{castToast}</div> : null}
      {children}
    </MediaPlayer>
  );
});

export default PieroVideoPlayer;
