"use client";

import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { Gesture, MediaPlayer, MediaProvider } from "@vidstack/react";
import { PlyrLayout, plyrLayoutIcons } from "@vidstack/react/player/layouts/plyr";
import {
  ArrowLeft,
  ArrowRight,
  Expand,
  Keyboard,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
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
  async getCaptions() { return null; },
  async getVideoQuality() { return null; },
  async getAudioGain() { return null; },
};

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
  const shortcutsButtonRef = useRef(null);
  const shortcutsPanelRef = useRef(null);
  const lastVolumeStateRef = useRef(null);
  const isPlayerReadyRef = useRef(false);
  const [seekFeedback, setSeekFeedback] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);
  const [rateToast, setRateToast] = useState("");
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  const setPlayerRef = useCallback(
    (instance) => {
      playerRef.current = instance;
      if (typeof forwardedRef === "function") forwardedRef(instance);
      else if (forwardedRef) forwardedRef.current = instance;
    },
    [forwardedRef],
  );

  useEffect(() => () => {
    if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    if (actionFeedbackTimerRef.current) window.clearTimeout(actionFeedbackTimerRef.current);
    if (rateToastTimerRef.current) window.clearTimeout(rateToastTimerRef.current);
  }, []);

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

  const shortcutsControl = (
    <button
      ref={shortcutsButtonRef}
      type="button"
      className="plyr__controls__item plyr__control piero-shortcuts-button"
      aria-label="Mostrar atajos de teclado"
      aria-haspopup="dialog"
      aria-expanded={isShortcutsOpen}
      aria-controls="piero-keyboard-shortcuts"
      onClick={() => setIsShortcutsOpen((current) => !current)}
    >
      <Keyboard aria-hidden="true" />
      <span className="plyr__tooltip">Atajos de teclado</span>
    </button>
  );

  return (
    <MediaPlayer
      ref={setPlayerRef}
      className="piero-media-player"
      src={{ src, type: "video/mp4" }}
      title={title || "Resubido de Piero"}
      preload="metadata"
      playsInline
      storage={PIERO_PREFERENCE_STORAGE}
      keyTarget="player"
      keyShortcuts={PIERO_KEY_SHORTCUTS}
      aria-keyshortcuts="Space K M F J L ArrowLeft ArrowRight ArrowUp ArrowDown"
      onLoadStart={() => onLoadStart?.()}
      onLoadedMetadata={() => onLoadedMetadata?.(playerRef.current)}
      onCanPlay={() => {
        isPlayerReadyRef.current = true;
        lastVolumeStateRef.current = {
          muted: Boolean(playerRef.current?.muted),
          volume: Number(playerRef.current?.volume ?? 1),
        };
        onCanPlay?.(playerRef.current);
      }}
      onPlay={() => showActionFeedback("play")}
      onPlaying={() => onPlaying?.()}
      onWaiting={() => onWaiting?.(playerRef.current)}
      onStalled={() => onStalled?.(playerRef.current)}
      onTimeUpdate={(detail) => {
        lastPlaybackTimeRef.current = detail.currentTime;
        onTimeUpdate?.(detail.currentTime, playerRef.current?.duration || 0);
      }}
      onSeeking={showSeekFeedback}
      onRateChange={showRateToast}
      onVolumeChange={handleVolumeChange}
      onPause={() => {
        showActionFeedback("pause");
        onPause?.(playerRef.current);
      }}
      onEnded={() => onEnded?.()}
      onError={(detail) => onError?.(detail)}
    >
      <MediaProvider />
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
      <PlyrLayout
        icons={PIERO_PLYR_ICONS}
        controls={PLYR_CONTROLS}
        seekTime={10}
        speed={PLAYBACK_SPEEDS}
        translations={PIERO_PLAYER_TRANSLATIONS}
        slots={{ beforeSettings: shortcutsControl }}
        clickToPlay
        clickToFullscreen={false}
        displayDuration
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
      {children}
    </MediaPlayer>
  );
});

export default PieroVideoPlayer;
