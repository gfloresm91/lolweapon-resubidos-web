"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import ConfirmModal from "@/components/ConfirmModal";

const STATUS_OPTIONS = [
  { key: "all", label: "Todos" },
  { key: "watching", label: "Comprado" },
  { key: "completed", label: "Terminados" },
  { key: "purchased", label: "Entera" },
  { key: "paused", label: "Pausados" },
  { key: "pending", label: "Pendientes" },
  { key: "dropped", label: "Dropeados" },
];

const TRACKING_STATUS_OPTIONS = [
  { key: "all", label: "Todos" },
  { key: "purchased", label: "Entera" },
  { key: "watching", label: "Caps comprados" },
  { key: "unpaid", label: "Sin comprar" },
];

const CAPS_SORT_OPTIONS = [
  { value: "purchased-desc", label: "Más caps comprados" },
  { value: "purchased-asc", label: "Menos caps comprados" },
  { value: "episodes-desc", label: "Más episodios" },
  { value: "episodes-asc", label: "Menos episodios" },
];

const ALPHA_SORT_OPTIONS = [
  { value: "title-asc", label: "A-Z" },
  { value: "title-desc", label: "Z-A" },
  { value: "episodes-desc", label: "Más episodios" },
  { value: "episodes-asc", label: "Menos episodios" },
  { value: "year-desc", label: "Más recientes" },
  { value: "year-asc", label: "Más antiguos" },
];

const EDIT_STATUS_OPTIONS = STATUS_OPTIONS.filter((option) => option.key !== "all");

const emptyAnime = {
  key: "",
  tag: "",
  title: "",
  titleEs: "",
  image: "",
  description: "",
  descriptionEs: "",
  provider: "",
  providerId: "",
  providerUrl: "",
  trackerUrl: "",
  year: "",
  episodes: "",
  currentEpisode: "0",
  purchased: "0",
  format: "",
  status: "",
  watchStatus: "watching",
  libraryEnabled: true,
};

const STATUS_LABELS = {
  watching: "Comprado",
  completed: "Terminado",
  purchased: "Entera",
  paused: "Pausado",
  pending: "Pendiente",
  dropped: "Dropeado",
};

const COMPLETED_STATUS_OPTIONS = [
  { key: "all", label: "Todos" },
  { key: "completed", label: "Terminados" },
  { key: "paused", label: "Pausados" },
  { key: "dropped", label: "Dropeados" },
];

const PAGE_CONFIG = {
  active: {
    badge: "Biblioteca anime",
    titlePrefix: "Anime en",
    titleHighlight: "Seguimiento",
    subtitle: "Animes con temporada entera, capítulos comprados o pendientes de compra.",
    empty: "No hay animes en seguimiento con ese filtro.",
    statusOptions: TRACKING_STATUS_OPTIONS,
    acceptsStatus: (status) => status === "purchased" || status === "watching",
  },
  completed: {
    badge: "Biblioteca anime",
    titlePrefix: "Anime",
    titleHighlight: "Terminado",
    subtitle: "Animes terminados, pausados, pendientes o dropeados fuera del seguimiento activo.",
    empty: "No hay animes terminados con ese filtro.",
    statusOptions: COMPLETED_STATUS_OPTIONS,
    acceptsStatus: (status) => ["completed", "paused", "pending", "dropped"].includes(status),
  },
};

function getStatusLabel(status) {
  return STATUS_LABELS[status] || "Pendiente";
}

function getInitials(title) {
  return String(title || "AN")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function AnimeLibrarySortSelect({ options = CAPS_SORT_OPTIONS, value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef(null);
  const selectedOption = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!selectRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function selectOption(nextValue) {
    onChange(nextValue);
    setIsOpen(false);
  }

  return (
    <div ref={selectRef} className="filter-select anime-library-sort-select">
      <button
        type="button"
        className={`filter-select-button ${isOpen ? "is-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="filter-select-label">Orden</span>
        <strong>{selectedOption.label}</strong>
        <span className="filter-select-chevron" aria-hidden="true">⌄</span>
      </button>

      {isOpen ? (
        <div className="filter-select-menu" role="listbox" aria-label="Orden">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`filter-select-option ${option.value === value ? "is-selected" : ""}`}
              role="option"
              aria-selected={option.value === value}
              onClick={() => selectOption(option.value)}
            >
              <span>{option.label}</span>
              {option.value === value ? <span aria-hidden="true">✓</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const editableFields = [
  "tag",
  "title",
  "titleEs",
  "image",
  "description",
  "descriptionEs",
  "provider",
  "providerId",
  "providerUrl",
  "trackerUrl",
  "year",
  "episodes",
  "currentEpisode",
  "purchased",
  "format",
  "status",
  "watchStatus",
  "libraryEnabled",
];

function toEditableAnime(anime) {
  const editableAnime = {
    ...emptyAnime,
    ...(anime || {}),
    currentEpisode: anime?.currentEpisode || "0",
    purchased: anime?.watchStatus === "purchased" ? "ENTERA" : anime?.purchased || "0",
    libraryEnabled: anime?.libraryEnabled !== false,
  };

  for (const field of editableFields) {
    if (field !== "libraryEnabled") {
      editableAnime[field] = editableAnime[field] ?? "";
    }
  }

  return editableAnime;
}

function getRestorablePurchasedValue(anime) {
  const value = String(anime?.purchased || "").trim();
  return value && value.toUpperCase() !== "ENTERA" ? value : "0";
}

function AnimeLibraryModal({ anime, isOpen, isSaving, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(() => toEditableAnime(anime));
  const [imageFile, setImageFile] = useState(null);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const restorablePurchasedRef = useRef(getRestorablePurchasedValue(anime));

  useEffect(() => {
    if (isOpen) {
      setForm(toEditableAnime(anime));
      restorablePurchasedRef.current = getRestorablePurchasedValue(anime);
      setImageFile(null);
      setIsFetchingMetadata(false);
    }
  }, [anime, isOpen]);

  if (!isOpen) {
    return null;
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function stepValue(value, step) {
    if (String(value || "").toUpperCase() === "ENTERA") {
      return step > 0 ? "ENTERA" : "0";
    }

    return String(Math.max((parseInt(value, 10) || 0) + step, 0));
  }

  function submit(event) {
    event.preventDefault();

    if (!form.title.trim()) {
      toast.error("El titulo es obligatorio.");
      return;
    }

    onSave({
      ...form,
      purchased: form.watchStatus === "purchased" ? "ENTERA" : form.purchased,
      imageFile,
    });
  }

  function restoreAnime() {
    onSave({ ...form, imageFile, libraryEnabled: true });
  }

  function updateWatchStatus(status) {
    if (status === "purchased") {
      setForm((current) => {
        if (String(current.purchased || "").trim().toUpperCase() !== "ENTERA") {
          restorablePurchasedRef.current = String(current.purchased || "0");
        }

        return {
          ...current,
          watchStatus: "purchased",
          purchased: "ENTERA",
        };
      });
      return;
    }

    setForm((current) => ({
      ...current,
      watchStatus: status,
      purchased: String(current.purchased || "").toUpperCase() === "ENTERA"
        ? restorablePurchasedRef.current
        : current.purchased,
    }));
  }

  async function fetchAniListMetadata() {
    const search = [form.title, form.titleEs, form.tag].map((value) => String(value || "").trim()).find(Boolean);
    const providerUrl = String(form.providerUrl || "").trim();
    const providerId = String(form.providerId || "").trim();

    if (!search && !providerUrl && !providerId) {
      toast.error("Ingresa un titulo, tag o URL de AniList.");
      return;
    }

    setIsFetchingMetadata(true);

    try {
      const response = await fetch("/api/anime-library/anilist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId, providerUrl, search }),
      });
      const data = await response.json();

      if (response.status === 401) {
        toast.error("Tu sesion de admin expiro. Vuelve a iniciar sesion.");
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo buscar metadata en AniList.");
      }

      const metadata = data.metadata || {};
      setForm((current) => ({
        ...current,
        title: metadata.title || current.title,
        image: metadata.image || current.image,
        description: metadata.description || current.description,
        provider: metadata.provider || current.provider,
        providerId: metadata.providerId || current.providerId,
        providerUrl: metadata.providerUrl || current.providerUrl,
        year: metadata.year || current.year,
        episodes: metadata.episodes || current.episodes,
        format: metadata.format || current.format,
        status: metadata.status || current.status,
      }));
      setImageFile(null);
      toast.success("Metadata cargada desde AniList. Revisa antes de guardar.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsFetchingMetadata(false);
    }
  }

  const isCreating = !anime?.key;
  const isPersistedHidden = !isCreating && anime?.libraryEnabled === false;
  const isMobilePurchased = form.watchStatus === "purchased" || String(form.purchased || "").toUpperCase() === "ENTERA";

  return (
    <div className="modal-backdrop">
      <div className="modal-content anime-library-modal" onClick={(event) => event.stopPropagation()}>
        <div className="anime-library-modal-header">
          <div>
            <h2 className="modal-title">{isCreating ? "Añadir anime" : "Editar anime"}</h2>
            <p className="modal-subtitle">{form.tag || form.title || "Nueva ficha de seguimiento"}</p>
          </div>
          <span className={`anime-library-status status-${form.libraryEnabled === false ? "hidden" : form.watchStatus || "pending"}`}>
            {form.libraryEnabled === false ? "Oculto" : getStatusLabel(form.watchStatus)}
          </span>
        </div>

        <form className="modal-body" onSubmit={submit}>
          <div className="anime-library-modal-grid">
            <aside className="anime-library-modal-preview">
              {form.image ? (
                <img src={form.image} alt={form.title} />
              ) : (
                <div className="poster-placeholder">{getInitials(form.title)}</div>
              )}
              <a className="anime-library-provider-link anime-library-mobile-hidden" href={form.providerUrl || "#"} target="_blank" rel="noreferrer">
                {form.providerUrl ? "Abrir ficha externa" : "Sin ficha externa"}
              </a>
              <button
                type="button"
                className="anime-library-metadata-button anime-library-mobile-hidden"
                onClick={fetchAniListMetadata}
                disabled={isSaving || isFetchingMetadata}
              >
                {isFetchingMetadata ? "Buscando..." : "Completar desde AniList"}
              </button>
            </aside>

            <div className="anime-library-modal-fields">
              <h3 className="modal-subtitle anime-library-mobile-hidden">Información principal</h3>
              <div className="form-row">
                <div className="form-group-modal">
                  <label>Título AniList</label>
                  <input className="modal-input" value={form.title} onChange={(event) => updateField("title", event.target.value)} />
                </div>
                <div className="form-group-modal anime-library-mobile-hidden">
                  <label>Título personalizado</label>
                  <input className="modal-input" value={form.titleEs} onChange={(event) => updateField("titleEs", event.target.value)} />
                </div>
              </div>

              <div className="form-group-modal anime-library-mobile-only anime-library-mobile-field">
                <label>URL AniList</label>
                <input
                  className="modal-input"
                  placeholder="https://anilist.co/anime/19/MONSTER/"
                  value={form.providerUrl}
                  onChange={(event) => updateField("providerUrl", event.target.value)}
                />
              </div>

              <button
                type="button"
                className="anime-library-metadata-button anime-library-mobile-only"
                onClick={fetchAniListMetadata}
                disabled={isSaving || isFetchingMetadata}
              >
                {isFetchingMetadata ? "Buscando..." : "Completar desde AniList"}
              </button>

              <div className="form-group-modal anime-library-mobile-only anime-library-mobile-field anime-library-mobile-field-after-action">
                <label>Título personalizado</label>
                <input className="modal-input" value={form.titleEs} onChange={(event) => updateField("titleEs", event.target.value)} />
              </div>

              <div className="form-group-modal anime-library-mobile-only anime-library-mobile-field">
                <label>Sinopsis personalizada</label>
                <textarea
                  className="modal-input textarea-links anime-library-textarea"
                  value={form.descriptionEs}
                  onChange={(event) => updateField("descriptionEs", event.target.value)}
                />
              </div>

              <div className="form-group-modal anime-library-mobile-hidden">
                <label>Tag del rastreador</label>
                <input
                  className="modal-input"
                  placeholder="Ej: WorldTrigger"
                  value={form.tag}
                  onChange={(event) => updateField("tag", event.target.value)}
                />
              </div>

              <div className="form-group-modal anime-library-mobile-hidden">
                <label>Imagen por URL</label>
                <input className="modal-input" value={form.image} onChange={(event) => updateField("image", event.target.value)} />
                {form.image ? <p className="current-image-note">{form.image}</p> : null}
              </div>

              <div className="form-group-modal">
                <label>Poster / Imagen local</label>
                <input
                  type="file"
                  accept="image/*"
                  className="modal-input"
                  onChange={(event) => setImageFile(event.target.files?.[0] || null)}
                />
              </div>

              <div className="form-row anime-library-mobile-hidden">
                <div className="form-group-modal">
                  <label>Estado biblioteca</label>
                  <select className="modal-input" value={form.watchStatus} onChange={(event) => updateWatchStatus(event.target.value)}>
                    {EDIT_STATUS_OPTIONS.map((option) => (
                      <option key={option.key} value={option.key}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group-modal">
                  <label>Mostrar en biblioteca</label>
                  <select
                    className="modal-input"
                    value={form.libraryEnabled ? "true" : "false"}
                    onChange={(event) => updateField("libraryEnabled", event.target.value === "true")}
                  >
                    <option value="true">Sí</option>
                    <option value="false">No</option>
                  </select>
                </div>
              </div>

              <hr className="modal-hr" />
              <h3 className="modal-subtitle anime-library-mobile-hidden">Seguimiento</h3>
              <h3 className="modal-subtitle anime-library-mobile-only anime-library-mobile-section-title">Capítulo Actual</h3>
              <div className="form-row">
                <div className="form-group-modal">
                  <label>Capítulo actual visto</label>
                  <div className="anime-stepper">
                    <button type="button" className="btn-step" onClick={() => updateField("currentEpisode", stepValue(form.currentEpisode, -1))}>
                      -
                    </button>
                    <input
                      type="text"
                      className="modal-input anime-number-input"
                      value={form.currentEpisode}
                      onChange={(event) => updateField("currentEpisode", event.target.value)}
                    />
                    <button type="button" className="btn-step" onClick={() => updateField("currentEpisode", stepValue(form.currentEpisode, 1))}>
                      +
                    </button>
                  </div>
                </div>

                <div className="form-group-modal">
                  <label>Capítulos comprados</label>
                  <div className="anime-stepper">
                    <button type="button" className="btn-step" onClick={() => updateField("purchased", stepValue(form.purchased, -1))}>
                      -
                    </button>
                    <input
                      type="text"
                      className="modal-input anime-number-input"
                      value={form.purchased}
                      onChange={(event) => updateField("purchased", event.target.value)}
                    />
                    <button type="button" className="btn-step" onClick={() => updateField("purchased", stepValue(form.purchased, 1))}>
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div className="anime-library-mobile-status">
                <h3 className="modal-subtitle">Estado</h3>
                <button
                  type="button"
                  className="anime-library-switch-row"
                  onClick={() => updateWatchStatus("watching")}
                >
                  <span>Comprado</span>
                  <span className={`anime-library-switch ${form.watchStatus === "watching" && !isMobilePurchased ? "is-on" : ""}`} />
                </button>
                <button
                  type="button"
                  className="anime-library-switch-row"
                  onClick={() => updateWatchStatus("completed")}
                >
                  <span>Terminados</span>
                  <span className={`anime-library-switch ${form.watchStatus === "completed" ? "is-on" : ""}`} />
                </button>
                <button
                  type="button"
                  className="anime-library-switch-row"
                  onClick={() => updateWatchStatus("purchased")}
                >
                  <span>Entera</span>
                  <span className={`anime-library-switch ${isMobilePurchased ? "is-on" : ""}`} />
                </button>
                <button
                  type="button"
                  className="anime-library-switch-row"
                  onClick={() => updateWatchStatus("dropped")}
                >
                  <span>Dropeado</span>
                  <span className={`anime-library-switch ${form.watchStatus === "dropped" ? "is-on" : ""}`} />
                </button>
              </div>

              <hr className="modal-hr anime-library-mobile-hidden" />
              <h3 className="modal-subtitle anime-library-mobile-hidden">Metadata</h3>
              <div className="form-row anime-library-mobile-hidden">
                <div className="form-group-modal">
                  <label>Año</label>
                  <input className="modal-input" value={form.year} onChange={(event) => updateField("year", event.target.value)} />
                </div>
                <div className="form-group-modal">
                  <label>Episodios</label>
                  <input className="modal-input" value={form.episodes} onChange={(event) => updateField("episodes", event.target.value)} />
                </div>
              </div>

              <div className="form-row anime-library-mobile-hidden">
                <div className="form-group-modal">
                  <label>Formato</label>
                  <input className="modal-input" value={form.format} onChange={(event) => updateField("format", event.target.value)} />
                </div>
                <div className="form-group-modal">
                  <label>Estado AniList</label>
                  <input className="modal-input" value={form.status} onChange={(event) => updateField("status", event.target.value)} />
                </div>
              </div>

              <div className="form-group-modal anime-library-mobile-hidden">
                <label>Sinopsis personalizada</label>
                <textarea
                  className="modal-input textarea-links anime-library-textarea"
                  value={form.descriptionEs}
                  onChange={(event) => updateField("descriptionEs", event.target.value)}
                />
              </div>

              <div className="form-group-modal anime-library-mobile-hidden">
                <label>Sinopsis AniList</label>
                <textarea
                  className="modal-input textarea-links anime-library-textarea"
                  value={form.description}
                  onChange={(event) => updateField("description", event.target.value)}
                />
              </div>

              <hr className="modal-hr anime-library-mobile-hidden" />
              <h3 className="modal-subtitle anime-library-mobile-hidden">Proveedor</h3>
              <div className="form-row anime-library-mobile-hidden">
                <div className="form-group-modal">
                  <label>Provider</label>
                  <input className="modal-input" value={form.provider} onChange={(event) => updateField("provider", event.target.value)} />
                </div>
                <div className="form-group-modal">
                  <label>Provider ID</label>
                  <input className="modal-input" value={form.providerId} onChange={(event) => updateField("providerId", event.target.value)} />
                </div>
              </div>

          <div className="form-group-modal anime-library-mobile-hidden">
            <label>Provider URL</label>
            <input className="modal-input" value={form.providerUrl} onChange={(event) => updateField("providerUrl", event.target.value)} />
          </div>

          <div className="form-group-modal anime-library-mobile-hidden">
            <label>URL resubidos</label>
            <input className="modal-input" value={form.trackerUrl} onChange={(event) => updateField("trackerUrl", event.target.value)} />
          </div>
            </div>
          </div>

          <div className="modal-actions">
            {isPersistedHidden ? (
              <button type="button" className="btn-modal btn-modal-danger" onClick={() => onDelete(anime.key)} disabled={isSaving}>
                Eliminar definitivamente
              </button>
            ) : null}
            {isPersistedHidden ? (
              <button type="button" className="btn-modal btn-modal-primary" onClick={restoreAnime} disabled={isSaving}>
                Restaurar
              </button>
            ) : null}
            <button type="button" className="btn-modal btn-modal-secondary" onClick={onClose} disabled={isSaving}>
              Cancelar
            </button>
            <button type="submit" className="btn-modal btn-modal-primary" disabled={isSaving}>
              {isSaving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function isFullSeason(anime) {
  return anime?.watchStatus === "purchased";
}

function getPurchasedCount(anime) {
  return parseInt(anime?.purchased, 10) || 0;
}

function getPurchaseLabel(anime) {
  if (isFullSeason(anime)) {
    return "Entera";
  }

  const purchasedCount = getPurchasedCount(anime);
  return purchasedCount > 0 ? `${purchasedCount} cap${purchasedCount > 1 ? "s" : ""}` : "Sin comprar";
}

function getEpisodeProgress(anime) {
  const current = Math.max(parseInt(anime?.currentEpisode, 10) || 0, 0);
  const total = Math.max(parseInt(anime?.episodes, 10) || 0, 0);

  if (!total) {
    return { current, total, percent: 0 };
  }

  return {
    current,
    total,
    percent: Math.min(Math.round((current / total) * 100), 100),
  };
}

function getSortablePurchasedEpisodes(anime) {
  if (isFullSeason(anime)) {
    return Number.MAX_SAFE_INTEGER;
  }

  return getPurchasedCount(anime);
}

function getNewAnimeDraft(mode) {
  return {
    watchStatus: mode === "completed" ? "completed" : "watching",
  };
}

export default function AnimeLibraryPage({
  animes: initialAnimes = [],
  isAdmin = false,
  isLoading = false,
  mode = "active",
  onAnimesChange,
}) {
  const [animes, setAnimes] = useState(initialAnimes);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOption, setSortOption] = useState(mode === "completed" ? "title-asc" : "purchased-desc");
  const [editingAnime, setEditingAnime] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDeleteKey, setPendingDeleteKey] = useState(null);
  const pageConfig = PAGE_CONFIG[mode] || PAGE_CONFIG.active;

  useEffect(() => {
    setAnimes(initialAnimes);
  }, [initialAnimes]);

  useEffect(() => {
    setStatusFilter("all");
    setSortOption(mode === "completed" ? "title-asc" : "purchased-desc");
  }, [mode]);

  const pageAnimes = useMemo(() => {
    return animes.filter((anime) => {
      if (anime.libraryEnabled === false) {
        return isAdmin;
      }

      return pageConfig.acceptsStatus(anime.watchStatus || "pending");
    });
  }, [animes, isAdmin, mode, pageConfig]);

  const stats = useMemo(() => {
    const visiblePageAnimes = pageAnimes.filter((anime) => anime.libraryEnabled !== false);
    const counts = visiblePageAnimes.reduce((acc, anime) => {
      const status = anime.watchStatus || "pending";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    const fullSeasons = visiblePageAnimes.filter((anime) => isFullSeason(anime)).length;
    const purchasedEpisodes = visiblePageAnimes
      .filter((anime) => !isFullSeason(anime))
      .reduce((sum, anime) => sum + getPurchasedCount(anime), 0);
    const partiallyPurchased = visiblePageAnimes
      .filter((anime) => !isFullSeason(anime) && getPurchasedCount(anime) > 0)
      .length;
    const pendingPurchases = visiblePageAnimes
      .filter((anime) => !isFullSeason(anime) && getPurchasedCount(anime) === 0)
      .length;

    return {
      total: visiblePageAnimes.length,
      watching: counts.watching || 0,
      completed: counts.completed || 0,
      purchased: counts.purchased || 0,
      pending: counts.pending || 0,
      paused: counts.paused || 0,
      dropped: counts.dropped || 0,
      fullSeasons,
      partiallyPurchased,
      purchasedEpisodes,
      pendingPurchases,
      hidden: pageAnimes.filter((anime) => anime.libraryEnabled === false).length,
    };
  }, [pageAnimes]);

  const statItems = mode === "active"
    ? [
        { value: stats.total, label: "Total Animes", color: "purple" },
        { value: stats.fullSeasons, label: "Temporada Entera", color: "green" },
        { value: stats.partiallyPurchased, label: "Con Caps Comprados", color: "blue", detail: `${stats.purchasedEpisodes} caps en total` },
        { value: stats.pendingPurchases, label: "Sin Comprar", color: "orange" },
      ]
    : [
        { value: stats.total, label: "Total", color: "purple" },
        { value: stats.completed, label: "Terminados", color: "green" },
        { value: stats.paused, label: "Pausados", color: "orange" },
        { value: stats.dropped, label: "Dropeados", color: "red" },
      ];

  const filteredAnimes = useMemo(() => {
    const query = search.trim().toLowerCase();

    const results = pageAnimes.filter((anime) => {
      if (statusFilter === "hidden") {
        return anime.libraryEnabled === false && (!query || [
          anime.title,
          anime.titleEs,
          anime.tag,
        ].filter(Boolean).join(" ").toLowerCase().includes(query));
      }

      if (anime.libraryEnabled === false) {
        return false;
      }

      const status = anime.watchStatus || "pending";
      const statusMatch = statusFilter === "all"
        || (statusFilter === "purchased" && isFullSeason(anime))
        || (statusFilter === "watching" && !isFullSeason(anime) && getPurchasedCount(anime) > 0)
        || (statusFilter === "unpaid" && !isFullSeason(anime) && getPurchasedCount(anime) === 0)
        || (mode !== "active" && status === statusFilter);
      const searchMatch = !query || [
        anime.title,
        anime.titleEs,
        anime.tag,
      ].filter(Boolean).join(" ").toLowerCase().includes(query);

      return statusMatch && searchMatch;
    });

    if (mode === "completed") {
      const direction = sortOption.endsWith("desc") ? -1 : 1;

      if (sortOption.startsWith("episodes") || sortOption.startsWith("year")) {
        const field = sortOption.startsWith("episodes") ? "episodes" : "year";

        return [...results].sort((left, right) => {
          const leftValue = Math.max(parseInt(left?.[field], 10) || 0, 0);
          const rightValue = Math.max(parseInt(right?.[field], 10) || 0, 0);

          if (leftValue !== rightValue) {
            return (leftValue - rightValue) * direction;
          }

          return (left.titleEs || left.title || "").localeCompare(right.titleEs || right.title || "");
        });
      }

      return [...results].sort((left, right) => (
        (left.titleEs || left.title || "").localeCompare(right.titleEs || right.title || "") * direction
      ));
    }

    return [...results].sort((left, right) => {
      const isEpisodeSort = sortOption.startsWith("episodes");
      const leftValue = isEpisodeSort
        ? Math.max(parseInt(left?.episodes, 10) || 0, 0)
        : getSortablePurchasedEpisodes(left);
      const rightValue = isEpisodeSort
        ? Math.max(parseInt(right?.episodes, 10) || 0, 0)
        : getSortablePurchasedEpisodes(right);
      const direction = sortOption.endsWith("asc") ? 1 : -1;

      if (leftValue !== rightValue) {
        return (leftValue - rightValue) * direction;
      }

      return (left.title || "").localeCompare(right.title || "");
    });
  }, [mode, pageAnimes, search, sortOption, statusFilter]);

  async function uploadImage(file) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "No se pudo subir la imagen");
    }

    return data.path;
  }

  async function saveAnimeMetadata(form) {
    setIsSaving(true);

    try {
      const anime = {};
      let imagePath = form.image || "";

      if (form.imageFile) {
        imagePath = await uploadImage(form.imageFile);
      }

      for (const field of editableFields) {
        anime[field] = form[field];
      }

      anime.image = imagePath;

      const response = await fetch("/api/anime-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upsert", key: form.key, anime }),
      });
      const data = await response.json();

      if (response.status === 401) {
        toast.error("Tu sesion de admin expiro. Vuelve a iniciar sesion.");
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo guardar la metadata.");
      }

      const nextAnimes = data.animes || [];
      setAnimes(nextAnimes);
      onAnimesChange?.(nextAnimes);
      setEditingAnime(null);
      toast.success(form.key ? "Metadata guardada correctamente." : "Anime creado correctamente.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteAnimeMetadata(key) {
    setIsSaving(true);

    try {
      const response = await fetch("/api/anime-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", key }),
      });
      const data = await response.json();

      if (response.status === 401) {
        toast.error("Tu sesion de admin expiro. Vuelve a iniciar sesion.");
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo eliminar el anime.");
      }

      const nextAnimes = data.animes || [];
      setAnimes(nextAnimes);
      onAnimesChange?.(nextAnimes);
      setEditingAnime(null);
      setPendingDeleteKey(null);
      toast.success("Anime eliminado definitivamente.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <header className="watching-header anime-library-header">
        <div className="header-badge">
          <span className="dot" />
          {pageConfig.badge}
        </div>
        <h1 className="title">
          {pageConfig.titlePrefix} <span className="text-gradient">{pageConfig.titleHighlight}</span>
        </h1>
        <p className="subtitle">{pageConfig.subtitle}</p>
      </header>

      <section className="watching-stats">
        {statItems.map((item) => (
          <div className="watching-stat" key={item.label}>
            <span className={`watching-stat-value ${item.color}`}>{item.value}</span>
            <span className="watching-stat-label">{item.label}</span>
            {item.detail ? <span className="watching-stat-detail">{item.detail}</span> : null}
          </div>
        ))}
      </section>

      {isAdmin ? (
        <section className="tracker-actions" aria-label="Acciones de biblioteca anime">
          <div>
            <span className="tracker-actions-label">Administración</span>
            <p className="tracker-actions-copy">
              Gestiona animes {mode === "completed" ? "terminados" : "en seguimiento"} antes o después de crear sus tags.
            </p>
          </div>
          <button type="button" className="tracker-action-primary" onClick={() => setEditingAnime(getNewAnimeDraft(mode))}>
            <span className="tracker-action-icon">+</span>
            Añadir anime
          </button>
        </section>
      ) : null}

      <div className="watching-controls">
        <input
          type="search"
          className="search-input"
          placeholder="Buscar anime o tag..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {pageConfig.statusOptions.length > 1 ? (
          <>
            {[
              ...pageConfig.statusOptions,
              ...(isAdmin ? [{ key: "hidden", label: `Ocultos (${stats.hidden})` }] : []),
            ].map((option) => (
              <button
                key={option.key}
                type="button"
                className={`watching-filter-btn ${statusFilter === option.key ? "active" : ""}`}
                onClick={() => setStatusFilter(option.key)}
              >
                {option.label}
              </button>
            ))}
          </>
        ) : null}
        <AnimeLibrarySortSelect
          options={mode === "completed" ? ALPHA_SORT_OPTIONS : CAPS_SORT_OPTIONS}
          value={sortOption}
          onChange={setSortOption}
        />
      </div>

      <main>
        {isLoading ? (
          <div className="empty-state">
            <div className="empty-state-icon">AN</div>
            <div className="empty-state-text">Cargando biblioteca...</div>
          </div>
        ) : filteredAnimes.length ? (
          <div className="anime-grid anime-library-grid">
            {filteredAnimes.map((anime) => {
              const fullSeason = isFullSeason(anime);
              const purchasedCount = getPurchasedCount(anime);
              const purchaseLabel = getPurchaseLabel(anime);
              const synopsis = anime.descriptionEs || anime.description;
              const episodeProgress = getEpisodeProgress(anime);
              const archiveMeta = [
                anime.year,
                anime.episodes ? `${anime.episodes} eps` : null,
                anime.format,
              ].filter(Boolean);
              const hoverMeta = [
                anime.year,
                anime.episodes ? `${anime.episodes} eps` : null,
                anime.format,
              ].filter(Boolean).join(" · ");

              return (
                <article
                  key={anime.key}
                  className={`anime-card anime-library-card ${isAdmin ? "is-admin" : ""}`}
                  onClick={isAdmin ? () => setEditingAnime(anime) : undefined}
                >
                  {isAdmin ? <span className="anime-edit-indicator">Editar</span> : null}
                  <div className="poster-container anime-library-poster">
                    {anime.image ? (
                      <img src={anime.image} alt={anime.title} className="poster-img" loading="lazy" />
                    ) : (
                      <div className="poster-placeholder">{getInitials(anime.title)}</div>
                    )}
                    <div className="poster-overlay" />
                    {mode === "completed" || anime.libraryEnabled === false ? (
                      <span className={`anime-library-status status-${anime.libraryEnabled === false ? "hidden" : anime.watchStatus || "pending"}`}>
                        {anime.libraryEnabled === false ? "Oculto" : getStatusLabel(anime.watchStatus)}
                      </span>
                    ) : null}
                    <div className="title-overlay">
                      <h2 className="anime-title">{anime.titleEs || anime.title}</h2>
                    </div>
                    {episodeProgress.total ? (
                      <div
                        className={`anime-library-watch-progress ${mode === "completed" ? "archive-progress" : ""}`}
                        aria-label={`Progreso visto ${episodeProgress.current} de ${episodeProgress.total} episodios`}
                        title={`${episodeProgress.current}/${episodeProgress.total} episodios vistos`}
                      >
                        <span style={{ width: `${episodeProgress.percent}%` }} />
                      </div>
                    ) : null}
                    {synopsis || hoverMeta ? (
                      <div className="anime-library-hover-info">
                        {hoverMeta ? <p className="anime-library-hover-meta">{hoverMeta}</p> : null}
                        {synopsis ? <p className="anime-library-hover-description">{synopsis}</p> : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="anime-card-body anime-library-body">
                    {mode === "completed" ? (
                      <div className="anime-library-archive-meta">
                        {archiveMeta.length ? (
                          <span>{archiveMeta.join(" · ")}</span>
                        ) : (
                          <span>Metadata pendiente</span>
                        )}
                        {episodeProgress.total ? (
                          <span>Visto: {episodeProgress.current}/{episodeProgress.total}</span>
                        ) : null}
                      </div>
                    ) : (
                      <div className="anime-library-progress-line">
                        <span>
                          Cap. {episodeProgress.current}
                          {episodeProgress.total ? ` de ${episodeProgress.total}` : " actual"}
                        </span>
                        <span className="anime-library-progress-separator" />
                        {fullSeason ? (
                          <span className="badge-entera">Entera</span>
                        ) : (
                          <span className={`badge-count ${purchasedCount === 0 ? "zero" : ""}`}>
                            {purchaseLabel}
                          </span>
                        )}
                      </div>
                    )}
                    <a
                      href={anime.trackerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="anime-tracker-button"
                      onClick={(event) => event.stopPropagation()}
                    >
                      Ver resubidos
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">AN</div>
            <div className="empty-state-text">{pageConfig.empty}</div>
          </div>
        )}
      </main>

      <AnimeLibraryModal
        anime={editingAnime}
        isOpen={Boolean(editingAnime)}
        isSaving={isSaving}
        onClose={() => setEditingAnime(null)}
        onSave={saveAnimeMetadata}
        onDelete={(key) => setPendingDeleteKey(key)}
      />

      <ConfirmModal
        isOpen={Boolean(pendingDeleteKey)}
        title="Eliminar anime"
        description="Esta entrada se borrará del archivo de metadata. Si viene de un tag del rastreador, podría volver a aparecer como ficha generada."
        confirmLabel="Sí, eliminar"
        cancelLabel="Cancelar"
        tone="danger"
        isLoading={isSaving}
        onCancel={() => setPendingDeleteKey(null)}
        onConfirm={() => deleteAnimeMetadata(pendingDeleteKey)}
      />
    </>
  );
}
