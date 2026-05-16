"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Edit3, X } from "lucide-react";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";

import AniListSearchModal from "@/components/AniListSearchModal";
import ConfirmModal from "@/components/ConfirmModal";
import FormSelect from "@/components/FormSelect";
import TagCombobox from "@/components/TagCombobox";

const ANIME_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

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
const EDIT_STATUS_SELECT_OPTIONS = EDIT_STATUS_OPTIONS.map((option) => ({ value: option.key, label: option.label }));
const VISIBILITY_SELECT_OPTIONS = [
  { value: "true", label: "Sí" },
  { value: "false", label: "No" },
];

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
    titlePrefix: "Anime",
    titleHighlight: "Viendo",
    subtitle: "Animes que estás viendo, con compras parciales, temporada entera o pendientes de compra.",
    createLabel: "Añadir a Viendo",
    empty: "No hay animes en seguimiento con ese filtro.",
    statusOptions: TRACKING_STATUS_OPTIONS,
    acceptsStatus: (status) => status === "purchased" || status === "watching",
  },
  completed: {
    badge: "Biblioteca anime",
    titlePrefix: "Anime",
    titleHighlight: "Terminado",
    subtitle: "Animes terminados, pausados, pendientes o dropeados fuera del seguimiento activo.",
    createLabel: "Añadir a Terminados",
    empty: "No hay animes terminados con ese filtro.",
    statusOptions: COMPLETED_STATUS_OPTIONS,
    acceptsStatus: (status) => ["completed", "paused", "pending", "dropped"].includes(status),
  },
};

export function getStatusLabel(status) {
  return STATUS_LABELS[status] || "Pendiente";
}

export function getInitials(title) {
  return String(title || "AN")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function AnimePosterPlaceholder({ title, className = "" }) {
  return (
    <div className={["poster-placeholder anime-poster-placeholder", className].filter(Boolean).join(" ")}>
      <span>{getInitials(title)}</span>
    </div>
  );
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

export const editableFields = [
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

function getAnimeImageStatus(imageFile, imageUrl) {
  if (imageFile) return "Nueva imagen local seleccionada";
  if (imageUrl) return imageUrl.startsWith("/") ? "Imagen local guardada" : "Imagen externa";
  return "Sin imagen";
}

function normalizeComparable(value) {
  return String(value || "").trim().toLowerCase();
}

function getGeneratedTrackerUrl(form) {
  const tag = String(form?.tag || "").trim();
  const title = String(form?.titleEs || form?.title || "").trim();

  if (tag) {
    return `/rastreador?tag=${encodeURIComponent(tag)}`;
  }

  return title ? `/rastreador?search=${encodeURIComponent(title)}` : "/rastreador";
}

function getDuplicateAnimeError(form, existingAnimes = [], currentKey = "") {
  const providerId = normalizeComparable(form.providerId);
  const providerUrl = normalizeComparable(form.providerUrl);
  const title = normalizeComparable(form.title);
  const titleEs = normalizeComparable(form.titleEs);
  const tag = normalizeComparable(form.tag);
  const animes = existingAnimes.filter((anime) => !currentKey || anime.key !== currentKey);

  const hasDuplicateAniList = animes.some((anime) => (
    (providerId && normalizeComparable(anime.providerId) === providerId)
    || (providerUrl && normalizeComparable(anime.providerUrl) === providerUrl)
  ));

  if (hasDuplicateAniList) {
    return "Ya existe un anime con esa ficha AniList.";
  }

  const hasDuplicateTag = animes.some((anime) => tag && normalizeComparable(anime.tag) === tag);

  if (hasDuplicateTag) {
    return "Ya existe un anime con ese tag.";
  }

  const hasDuplicateTitle = animes.some((anime) => (
    (title && [anime.title, anime.titleEs].some((value) => normalizeComparable(value) === title))
    || (titleEs && [anime.title, anime.titleEs].some((value) => normalizeComparable(value) === titleEs))
  ));

  return hasDuplicateTitle ? "Ya existe un anime con ese título." : "";
}

function getOptionalNumber(value) {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    return null;
  }

  if (!/^\d+$/.test(normalized)) {
    return Number.NaN;
  }

  return Number(normalized);
}

function isValidUrl(value) {
  const normalized = String(value || "").trim();

  if (!normalized) {
    return true;
  }

  try {
    const url = new URL(normalized);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidTrackerUrl(value) {
  const normalized = String(value || "").trim();

  if (!normalized) {
    return true;
  }

  if (/^https?:\/\//i.test(normalized)) {
    return isValidUrl(normalized);
  }

  if (!normalized.startsWith("/")) {
    return false;
  }

  try {
    const url = new URL(normalized, "https://lolweapon.local");
    const allowedParams = new Set(["tag", "search", "q", "year", "month", "status"]);
    return url.pathname === "/rastreador" && [...url.searchParams.keys()].every((key) => allowedParams.has(key));
  } catch {
    return false;
  }
}

function isValidImageValue(value) {
  const normalized = String(value || "").trim();

  if (!normalized || normalized.startsWith("/")) {
    return true;
  }

  return isValidUrl(normalized);
}

function getAnimeFormErrors(form, { validateTrackerUrl = true } = {}) {
  const errors = {};
  const title = String(form.title || "").trim();
  const year = getOptionalNumber(form.year);
  const episodes = getOptionalNumber(form.episodes);
  const currentEpisode = getOptionalNumber(form.currentEpisode);
  const purchasedText = String(form.purchased || "").trim();
  const purchasedEpisodes = purchasedText.toUpperCase() === "ENTERA" ? null : getOptionalNumber(purchasedText);

  if (!title) {
    errors.title = "El título es obligatorio.";
  }

  if (Number.isNaN(year)) {
    errors.year = "El año debe ser numérico.";
  }

  if (year !== null && (year < 1900 || year > 2100)) {
    errors.year = "El año debe estar entre 1900 y 2100.";
  }

  if (Number.isNaN(episodes)) {
    errors.episodes = "Los episodios deben ser numéricos.";
  }

  if (episodes !== null && episodes < 0) {
    errors.episodes = "Los episodios no pueden ser negativos.";
  }

  if (Number.isNaN(currentEpisode)) {
    errors.currentEpisode = "El capítulo visto debe ser numérico.";
  }

  if (currentEpisode !== null && currentEpisode < 0) {
    errors.currentEpisode = "El capítulo visto no puede ser negativo.";
  }

  if (episodes !== null && currentEpisode !== null && currentEpisode > episodes) {
    errors.currentEpisode = "El capítulo visto no puede superar el total de episodios.";
  }

  if (Number.isNaN(purchasedEpisodes)) {
    errors.purchased = "Los capítulos comprados deben ser numéricos o ENTERA.";
  }

  if (purchasedEpisodes !== null && purchasedEpisodes < 0) {
    errors.purchased = "Los capítulos comprados no pueden ser negativos.";
  }

  if (episodes !== null && purchasedEpisodes !== null && purchasedEpisodes > episodes) {
    errors.purchased = "Los capítulos comprados no pueden superar el total de episodios.";
  }

  if (!isValidUrl(form.providerUrl)) {
    errors.providerUrl = "La URL AniList debe ser válida.";
  }

  if (!isValidImageValue(form.image)) {
    errors.image = "La imagen por URL debe ser válida.";
  }

  if (validateTrackerUrl && form.trackerUrl && !isValidTrackerUrl(form.trackerUrl)) {
    errors.trackerUrl = "La URL resubidos debe apuntar a /rastreador o ser una URL válida.";
  }

  return errors;
}

export function AnimeLibraryModal({ anime, existingAnimes = [], isOpen, isSaving, formVariant = "full", canDelete = false, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(() => toEditableAnime(anime));
  const [imageFile, setImageFile] = useState(null);
  const [imageError, setImageError] = useState("");
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [isAdvancedMetadataOpen, setIsAdvancedMetadataOpen] = useState(false);
  const [isTrackerUrlOpen, setIsTrackerUrlOpen] = useState(false);
  const [isAniListSearchOpen, setIsAniListSearchOpen] = useState(false);
  const [isClearAniListConfirmOpen, setIsClearAniListConfirmOpen] = useState(false);
  const [availableTags, setAvailableTags] = useState([]);
  const [tagCounts, setTagCounts] = useState({});
  const restorablePurchasedRef = useRef(getRestorablePurchasedValue(anime));

  useEffect(() => {
    if (isOpen) {
      const nextForm = toEditableAnime(anime);
      setForm(nextForm);
      restorablePurchasedRef.current = getRestorablePurchasedValue(anime);
      setImageFile(null);
      setImageError("");
      setFieldErrors({});
      setIsAdvancedMetadataOpen(false);
      setIsTrackerUrlOpen(Boolean(nextForm.trackerUrl));
      setIsAniListSearchOpen(false);
      setIsClearAniListConfirmOpen(false);
    }
  }, [anime, isOpen]);

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(imageFile);
    setImagePreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    let isMounted = true;

    async function loadTags() {
      try {
        const response = await fetch("/api/tags", { cache: "no-store" });
        const data = await response.json();

        if (isMounted && response.ok && data.success) {
          setAvailableTags(Array.isArray(data.tags) ? data.tags : []);
          setTagCounts(data.tagCounts && typeof data.tagCounts === "object" ? data.tagCounts : {});
        }
      } catch {
        if (isMounted) {
          setAvailableTags([]);
          setTagCounts({});
        }
      }
    }

    loadTags();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field] && !(field === "titleEs" && current.title)) {
        return current;
      }

      const nextErrors = { ...current };
      delete nextErrors[field];
      if (field === "titleEs") {
        delete nextErrors.title;
      }
      return nextErrors;
    });
  }

  function updateImageFile(file, error = "") {
    setImageFile(file);
    setImageError(error);
    if (error) {
      setFieldErrors((current) => ({ ...current, imageFile: error }));
      return;
    }

    setFieldErrors((current) => {
      if (!current.imageFile) {
        return current;
      }

      const nextErrors = { ...current };
      delete nextErrors.imageFile;
      return nextErrors;
    });
  }

  function clearImageFile() {
    updateImageFile(null);
  }

  function stepValue(value, step) {
    if (String(value || "").toUpperCase() === "ENTERA") {
      return step > 0 ? "ENTERA" : "0";
    }

    return String(Math.max((parseInt(value, 10) || 0) + step, 0));
  }

  function submit(event) {
    event.preventDefault();

    const normalizedForm = isCompactForm && !String(form.title || "").trim()
      ? { ...form, title: String(form.titleEs || "").trim() }
      : form;
    const nextErrors = getAnimeFormErrors(normalizedForm, { validateTrackerUrl: !isCompactForm });
    if (imageError) {
      nextErrors.imageFile = imageError;
    }
    const duplicateError = getDuplicateAnimeError(normalizedForm, existingAnimes, anime?.key || "");
    if (duplicateError) {
      nextErrors.form = duplicateError;
    }

    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      if (nextErrors.year || nextErrors.episodes || nextErrors.providerUrl || nextErrors.image) {
        setIsAdvancedMetadataOpen(true);
      }
      if (nextErrors.trackerUrl) {
        setIsTrackerUrlOpen(true);
      }
      toast.error("Revisa los campos marcados antes de guardar.");
      return;
    }

    onSave({
      ...normalizedForm,
      purchased: normalizedForm.watchStatus === "purchased" ? "ENTERA" : normalizedForm.purchased,
      imageFile,
    });
  }

  function restoreAnime() {
    onSave({ ...form, imageFile, libraryEnabled: true });
  }

  function updateWatchStatus(status) {
    setFieldErrors((current) => {
      if (!current.purchased) {
        return current;
      }

      const nextErrors = { ...current };
      delete nextErrors.purchased;
      return nextErrors;
    });

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

  function applyAniListMetadata(metadata) {
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
    setIsAniListSearchOpen(false);
    setIsAdvancedMetadataOpen(true);
    toast.success("Ficha AniList actualizada. Revisa antes de guardar.");
  }

  function clearAniListMetadata() {
    setForm((current) => ({
      ...current,
      description: "",
      provider: "",
      providerId: "",
      providerUrl: "",
      year: "",
      episodes: "",
      format: "",
      status: "",
    }));
    setFieldErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors.providerUrl;
      delete nextErrors.year;
      delete nextErrors.episodes;
      return nextErrors;
    });
    setIsClearAniListConfirmOpen(false);
    toast.success("Ficha AniList desvinculada.");
  }

  const isCreating = !anime?.key;
  const isPersistedHidden = !isCreating && anime?.libraryEnabled === false;
  const isCompactForm = formVariant === "compact";
  const previewImage = imagePreviewUrl || form.image;
  const imageStatus = getAnimeImageStatus(imageFile, form.image);
  const generatedTrackerUrl = getGeneratedTrackerUrl(form);
  const hasAniListMetadata = Boolean(form.provider || form.providerId);
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    },
    maxFiles: 1,
    maxSize: ANIME_IMAGE_MAX_BYTES,
    noClick: true,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles[0]) {
        updateImageFile(acceptedFiles[0]);
      }
    },
    onDropRejected: (rejections) => {
      const code = rejections[0]?.errors?.[0]?.code;
      if (code === "file-too-large") {
        updateImageFile(null, "La imagen no puede superar 2 MB.");
        return;
      }
      updateImageFile(null, "La imagen debe ser PNG, JPG o WebP.");
    },
  });

  if (!isOpen) {
    return null;
  }

  return (
    <>
    <div className="modal-backdrop">
      <div className="modal-content anime-library-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close-button" aria-label="Cerrar modal" onClick={onClose}>
          <X size={18} />
        </button>
        <div className="anime-library-modal-header">
          <div>
            <h2 className="modal-title">{isCreating ? "Añadir anime" : "Editar anime"}</h2>
            <p className="modal-subtitle">{form.tag || form.title || "Nueva ficha de seguimiento"}</p>
          </div>
        </div>

        <form className="modal-body" onSubmit={submit}>
          <div className="anime-library-modal-grid">
            <aside className="anime-library-modal-preview">
              {previewImage ? (
                <img src={previewImage} alt={form.title} />
              ) : (
                <AnimePosterPlaceholder title={form.title} />
              )}
              <div className="anime-library-preview-details">
                <strong>{form.titleEs || form.title || "Sin título"}</strong>
                <span>{[form.year, form.format, form.status].filter(Boolean).join(" · ") || "Sin metadata"}</span>
                <span>{form.episodes ? `${form.episodes} episodios` : "Episodios sin definir"}</span>
                <span>{form.tag ? `Tag: ${form.tag}` : "Sin tag de resubidos"}</span>
                <span>{form.libraryEnabled === false ? "Oculto" : getStatusLabel(form.watchStatus)}</span>
              </div>
              {form.providerUrl ? (
                <a className="anime-library-provider-link" href={form.providerUrl} target="_blank" rel="noreferrer">
                  Abrir ficha externa
                </a>
              ) : (
                <span className="anime-library-provider-link is-disabled">Sin ficha externa</span>
              )}
            </aside>

            <div className="anime-library-modal-fields">
              <h3 className="modal-subtitle">Datos de biblioteca</h3>
              <button
                type="button"
                className="anime-library-metadata-button anime-library-metadata-button-primary"
                onClick={() => setIsAniListSearchOpen(true)}
                disabled={isSaving}
              >
                {hasAniListMetadata ? "Cambiar ficha AniList" : "Buscar en AniList"}
              </button>
              <div className={`form-row ${isCompactForm ? "is-single-column" : ""}`}>
                {!isCompactForm ? (
                  <div className="form-group-modal">
                    <label>Tag de resubidos</label>
                    <TagCombobox
                      value={form.tag}
                      tags={availableTags}
                      tagCounts={tagCounts}
                      onChange={(nextTag) => updateField("tag", nextTag)}
                    />
                    <span className="field-help">Se usa para enlazar VODs del rastreador con esta ficha.</span>
                  </div>
                ) : null}
                <div className="form-group-modal">
                  <label>Título visible</label>
                  <input
                    className="modal-input"
                    value={form.titleEs}
                    aria-invalid={isCompactForm && Boolean(fieldErrors.title)}
                    aria-describedby={isCompactForm && fieldErrors.title ? "anime-title-visible-error" : undefined}
                    onChange={(event) => updateField("titleEs", event.target.value)}
                  />
                  {isCompactForm && fieldErrors.title ? <span id="anime-title-visible-error" className="field-error">{fieldErrors.title}</span> : null}
                </div>
              </div>

              <div className={`form-row ${isCompactForm ? "is-single-column" : ""}`}>
                <div className="form-group-modal">
                  <label>Estado seguimiento</label>
                  <FormSelect
                    id="anime-watch-status"
                    label="Estado seguimiento"
                    value={form.watchStatus}
                    options={EDIT_STATUS_SELECT_OPTIONS}
                    onChange={updateWatchStatus}
                  />
                </div>
                {!isCompactForm ? (
                  <div className="form-group-modal">
                    <label>Mostrar en biblioteca</label>
                    <FormSelect
                      id="anime-library-enabled"
                      label="Mostrar en biblioteca"
                      value={form.libraryEnabled ? "true" : "false"}
                      options={VISIBILITY_SELECT_OPTIONS}
                      onChange={(value) => updateField("libraryEnabled", value === "true")}
                    />
                  </div>
                ) : null}
              </div>

              {!isCompactForm ? (
                <>
                  <div className="form-group-modal">
                    <label>Enlace resubidos generado</label>
                    <input className="modal-input" value={generatedTrackerUrl} readOnly />
                    <span className="field-help">Se genera automáticamente desde el tag o el título. Puedes reemplazarlo con una URL personalizada.</span>
                  </div>

                  <button
                    type="button"
                    className="anime-library-advanced-toggle anime-library-tracker-url-toggle"
                    onClick={() => setIsTrackerUrlOpen((current) => !current)}
                  >
                    {isTrackerUrlOpen ? "Ocultar URL personalizada" : "Usar URL personalizada de resubidos"}
                  </button>
                </>
              ) : null}

              {!isCompactForm && isTrackerUrlOpen ? (
                <div className="form-group-modal">
                  <label>URL personalizada de resubidos</label>
                  <input
                    className="modal-input"
                    placeholder="/rastreador?tag=bleach&status=done"
                    value={form.trackerUrl}
                    aria-invalid={Boolean(fieldErrors.trackerUrl)}
                    aria-describedby={fieldErrors.trackerUrl ? "anime-tracker-url-error" : undefined}
                    onChange={(event) => updateField("trackerUrl", event.target.value)}
                  />
                  <span className="field-help">Opcional. Usa /rastreador?tag=..., /rastreador?search=..., /rastreador?q=..., year, month o status si necesitas un filtro específico.</span>
                  {fieldErrors.trackerUrl ? <span id="anime-tracker-url-error" className="field-error">{fieldErrors.trackerUrl}</span> : null}
                </div>
              ) : null}

              <hr className="modal-hr" />
              <h3 className="modal-subtitle">Seguimiento</h3>
              <div className="form-row">
                <div className="form-group-modal">
                  <label>Capítulo actual visto</label>
                  <div className="anime-stepper">
                    <button type="button" className="btn-step" onClick={() => updateField("currentEpisode", stepValue(form.currentEpisode, -1))}>
                      -
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="modal-input anime-number-input"
                      value={form.currentEpisode}
                      aria-invalid={Boolean(fieldErrors.currentEpisode)}
                      aria-describedby={fieldErrors.currentEpisode ? "anime-current-episode-error" : undefined}
                      onChange={(event) => updateField("currentEpisode", event.target.value)}
                    />
                    <button type="button" className="btn-step" onClick={() => updateField("currentEpisode", stepValue(form.currentEpisode, 1))}>
                      +
                    </button>
                  </div>
                  {isCompactForm && form.episodes ? <span className="field-help">Total configurado: {form.episodes} episodios.</span> : null}
                  {fieldErrors.currentEpisode ? <span id="anime-current-episode-error" className="field-error">{fieldErrors.currentEpisode}</span> : null}
                </div>

                <div className="form-group-modal">
                  <label>Capítulos comprados</label>
                  <div className="anime-stepper">
                    <button type="button" className="btn-step" onClick={() => updateField("purchased", stepValue(form.purchased, -1))}>
                      -
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="modal-input anime-number-input"
                      value={form.purchased}
                      aria-invalid={Boolean(fieldErrors.purchased)}
                      aria-describedby={fieldErrors.purchased ? "anime-purchased-error" : undefined}
                      onChange={(event) => updateField("purchased", event.target.value)}
                    />
                    <button type="button" className="btn-step" onClick={() => updateField("purchased", stepValue(form.purchased, 1))}>
                      +
                    </button>
                  </div>
                  {fieldErrors.purchased ? <span id="anime-purchased-error" className="field-error">{fieldErrors.purchased}</span> : null}
                </div>
              </div>

              <hr className="modal-hr" />
              <h3 className="modal-subtitle">Ficha visible</h3>
              <div className={`form-row ${isCompactForm ? "is-single-column" : ""}`}>
                {!isCompactForm ? (
                  <div className="form-group-modal">
                      <label>Título original</label>
                      <input
                        className="modal-input"
                        value={form.title}
                        readOnly={hasAniListMetadata}
                        aria-invalid={Boolean(fieldErrors.title)}
                        aria-describedby={fieldErrors.title ? "anime-title-error" : undefined}
                        onChange={(event) => updateField("title", event.target.value)}
                      />
                      {fieldErrors.title ? <span id="anime-title-error" className="field-error">{fieldErrors.title}</span> : null}
                      {hasAniListMetadata ? <span className="field-help">Gestionado por la ficha AniList seleccionada.</span> : null}
                  </div>
                ) : null}
                <div className="form-group-modal">
                  <label>Poster / Imagen local</label>
                  <div
                    {...getRootProps({
                      className: `anime-image-dropzone ${isDragActive ? "is-active" : ""} ${fieldErrors.imageFile ? "is-error" : ""}`,
                    })}
                  >
                    <input {...getInputProps()} />
                    <strong>{isDragActive ? "Suelta la imagen aquí" : "Arrastra una imagen aquí"}</strong>
                    <span>PNG, JPG o WebP. Máximo 2 MB.</span>
                    <button type="button" className="btn-modal btn-modal-secondary" onClick={open}>
                      Seleccionar imagen
                    </button>
                  </div>
                  <div className="anime-image-uploader-footer">
                    <span>{imageStatus}</span>
                    {imageFile ? (
                      <button type="button" className="profile-avatar-clear" onClick={clearImageFile}>
                        Quitar imagen
                      </button>
                    ) : null}
                  </div>
                  {fieldErrors.imageFile ? <span className="field-error">{fieldErrors.imageFile}</span> : null}
                </div>
              </div>

              <div className="form-group-modal">
                <label>Sinopsis personalizada</label>
                <textarea
                  className="modal-input textarea-links anime-library-textarea"
                  value={form.descriptionEs}
                  onChange={(event) => updateField("descriptionEs", event.target.value)}
                />
              </div>

              {!isCompactForm ? (
                <button
                  type="button"
                  className="anime-library-advanced-toggle"
                  onClick={() => setIsAdvancedMetadataOpen((current) => !current)}
                >
                  {isAdvancedMetadataOpen ? "Ocultar datos de AniList" : "Ver datos de AniList"}
                </button>
              ) : null}

              {!isCompactForm && isAdvancedMetadataOpen ? (
                <div className="anime-library-advanced-panel">
                  <hr className="modal-hr" />
                  <h3 className="modal-subtitle">Datos de AniList</h3>
                  {hasAniListMetadata ? <p className="field-help anime-library-section-help">Estos campos quedan bloqueados cuando la ficha está vinculada a AniList. Usa “Cambiar ficha AniList” si necesitas reemplazarlos.</p> : null}

                  <div className="form-group-modal">
                    <label>URL AniList</label>
                    <input
                      className="modal-input"
                      placeholder="https://anilist.co/anime/19/MONSTER/"
                      value={form.providerUrl}
                      readOnly={hasAniListMetadata}
                      aria-invalid={Boolean(fieldErrors.providerUrl)}
                      aria-describedby={fieldErrors.providerUrl ? "anime-provider-url-error" : undefined}
                      onChange={(event) => updateField("providerUrl", event.target.value)}
                    />
                    {fieldErrors.providerUrl ? <span id="anime-provider-url-error" className="field-error">{fieldErrors.providerUrl}</span> : null}
                    {hasAniListMetadata ? <span className="field-help">Para cambiar esta URL usa “Cambiar ficha AniList”.</span> : null}
                  </div>

                  <div className="form-row">
                    <div className="form-group-modal">
                      <label>Año</label>
                      <input
                        className="modal-input"
                        value={form.year}
                        readOnly={hasAniListMetadata}
                        aria-invalid={Boolean(fieldErrors.year)}
                        aria-describedby={fieldErrors.year ? "anime-year-error" : undefined}
                        onChange={(event) => updateField("year", event.target.value)}
                      />
                      {fieldErrors.year ? <span id="anime-year-error" className="field-error">{fieldErrors.year}</span> : null}
                    </div>
                    <div className="form-group-modal">
                      <label>Episodios</label>
                      <input
                        className="modal-input"
                        value={form.episodes}
                        readOnly={hasAniListMetadata}
                        aria-invalid={Boolean(fieldErrors.episodes)}
                        aria-describedby={fieldErrors.episodes ? "anime-episodes-error" : undefined}
                        onChange={(event) => updateField("episodes", event.target.value)}
                      />
                      {fieldErrors.episodes ? <span id="anime-episodes-error" className="field-error">{fieldErrors.episodes}</span> : null}
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group-modal">
                      <label>Formato</label>
                      <input className="modal-input" value={form.format} readOnly={hasAniListMetadata} onChange={(event) => updateField("format", event.target.value)} />
                    </div>
                    <div className="form-group-modal">
                      <label>Estado AniList</label>
                      <input className="modal-input" value={form.status} readOnly={hasAniListMetadata} onChange={(event) => updateField("status", event.target.value)} />
                    </div>
                  </div>

                  <div className="form-group-modal">
                    <label>Imagen por URL</label>
                    <input
                      className="modal-input"
                      value={form.image}
                      readOnly={hasAniListMetadata}
                      aria-invalid={Boolean(fieldErrors.image)}
                      aria-describedby={fieldErrors.image ? "anime-image-error" : undefined}
                      onChange={(event) => updateField("image", event.target.value)}
                    />
                    {fieldErrors.image ? <span id="anime-image-error" className="field-error">{fieldErrors.image}</span> : null}
                    {form.image ? <p className="current-image-note">{form.image}</p> : null}
                  </div>

                  <div className="form-group-modal">
                    <label>Sinopsis AniList</label>
                    <textarea
                      className="modal-input textarea-links anime-library-textarea"
                      value={form.description}
                      readOnly={hasAniListMetadata}
                      onChange={(event) => updateField("description", event.target.value)}
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group-modal">
                      <label>Proveedor externo</label>
                      <input className="modal-input" value={form.provider} readOnly={hasAniListMetadata} onChange={(event) => updateField("provider", event.target.value)} />
                    </div>
                    <div className="form-group-modal">
                      <label>ID AniList</label>
                      <input className="modal-input" value={form.providerId} readOnly={hasAniListMetadata} onChange={(event) => updateField("providerId", event.target.value)} />
                    </div>
                  </div>
                  {hasAniListMetadata ? (
                    <button
                      type="button"
                      className="btn-modal btn-modal-danger anime-library-clear-metadata-button"
                      onClick={() => setIsClearAniListConfirmOpen(true)}
                      disabled={isSaving}
                    >
                      Quitar ficha AniList
                    </button>
                  ) : null}
                </div>
              ) : null}
              {fieldErrors.form ? <p className="field-error">{fieldErrors.form}</p> : null}
            </div>
          </div>

          <div className="modal-actions">
            {isPersistedHidden && canDelete ? (
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
              {isSaving ? "Guardando..." : isCreating ? "Crear anime" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
    <AniListSearchModal
      existingAnimes={existingAnimes}
      currentKey={anime?.key || ""}
      isOpen={isAniListSearchOpen}
      title={hasAniListMetadata ? "Cambiar ficha AniList" : "Buscar en AniList"}
      subtitle="Selecciona una ficha para actualizar solo la metadata externa. No se modificarán el tag, seguimiento, capítulos ni textos personalizados."
      emptyText="Busca en AniList para seleccionar una ficha."
      onClose={() => setIsAniListSearchOpen(false)}
      onSelectMetadata={applyAniListMetadata}
    />
    <ConfirmModal
      isOpen={isClearAniListConfirmOpen}
      title="Quitar ficha AniList"
      description="Se desvinculará la metadata externa de AniList y se limpiarán sus campos asociados. Los datos propios de biblioteca se mantendrán."
      confirmLabel="Sí, quitar ficha"
      cancelLabel="Cancelar"
      tone="danger"
      isLoading={isSaving}
      onCancel={() => setIsClearAniListConfirmOpen(false)}
      onConfirm={clearAniListMetadata}
    />
    </>
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

function buildTagFromTitle(title) {
  return String(title || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .slice(0, 48);
}

export default function AnimeLibraryPage({
  animes: initialAnimes = [],
  isAdmin = false,
  canCreate = isAdmin,
  canUpdate = isAdmin,
  canDelete = isAdmin,
  formVariant = "full",
  isLoading = false,
  mode = "active",
  onAnimesChange,
}) {
  const [animes, setAnimes] = useState(initialAnimes);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOption, setSortOption] = useState(mode === "completed" ? "title-asc" : "purchased-desc");
  const [isCreateStartOpen, setIsCreateStartOpen] = useState(false);
  const [editingAnime, setEditingAnime] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDeleteKey, setPendingDeleteKey] = useState(null);
  const pageConfig = PAGE_CONFIG[mode] || PAGE_CONFIG.active;
  const canManageAnime = canCreate || canUpdate || canDelete;

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
        return canManageAnime;
      }

      return pageConfig.acceptsStatus(anime.watchStatus || "pending");
    });
  }, [animes, canManageAnime, mode, pageConfig]);

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

  async function uploadAnimeImage(file) {
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
    if (form?.key && !canUpdate) {
      toast.error("No tienes permiso para editar anime.");
      return;
    }

    if (!form?.key && !canCreate) {
      toast.error("No tienes permiso para crear anime.");
      return;
    }

    setIsSaving(true);

    try {
      const anime = {};
      let imagePath = form.image || "";

      if (form.imageFile) {
        imagePath = await uploadAnimeImage(form.imageFile);
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

  function openCreateFromMetadata(metadata) {
    setIsCreateStartOpen(false);
    setEditingAnime({
      ...getNewAnimeDraft(mode),
      ...metadata,
      tag: buildTagFromTitle(metadata.title),
      titleEs: "",
      currentEpisode: "0",
      purchased: "0",
      libraryEnabled: true,
    });
  }

  async function deleteAnimeMetadata(key) {
    if (!canDelete) {
      toast.error("No tienes permiso para eliminar anime.");
      return;
    }

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

      {canCreate ? (
        <section className="tracker-actions" aria-label="Acciones de biblioteca anime">
          <div>
            <span className="tracker-actions-label">Gestión</span>
            <p className="tracker-actions-copy">
              Gestiona animes {mode === "completed" ? "terminados" : "en seguimiento"} antes o después de crear sus tags.
            </p>
          </div>
          <button type="button" className="tracker-action-primary" onClick={() => setIsCreateStartOpen(true)}>
            <span className="tracker-action-icon">+</span>
            {pageConfig.createLabel || "Añadir anime"}
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
              ...(canManageAnime ? [{ key: "hidden", label: `Ocultos (${stats.hidden})` }] : []),
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
                  className={`anime-card anime-library-card ${canUpdate ? "is-admin" : ""}`}
                >
                  {canUpdate ? (
                    <button
                      type="button"
                      className="anime-edit-indicator"
                      aria-label={`Editar ${anime.titleEs || anime.title || "anime"}`}
                      onClick={() => setEditingAnime(anime)}
                    >
                      <Edit3 size={14} />
                      Editar
                    </button>
                  ) : null}
                  <div className="poster-container anime-library-poster">
                    {anime.image ? (
                      <img src={anime.image} alt={anime.title} className="poster-img" loading="lazy" />
                    ) : (
                      <AnimePosterPlaceholder title={anime.titleEs || anime.title} />
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

      <AniListSearchModal
        existingAnimes={animes}
        isOpen={isCreateStartOpen}
        title="Buscar en AniList"
        subtitle="Pega una URL de AniList o escribe el título para precargar la metadata antes de crear la ficha."
        emptyText="Busca en AniList para seleccionar una ficha o crea el anime manualmente."
        onClose={() => setIsCreateStartOpen(false)}
        onSelectMetadata={openCreateFromMetadata}
        actions={(
          <button
            type="button"
            className="btn-modal btn-modal-secondary"
            onClick={() => {
              setIsCreateStartOpen(false);
              setEditingAnime(getNewAnimeDraft(mode));
            }}
          >
            Crear manualmente
          </button>
        )}
      />

      <AnimeLibraryModal
        anime={editingAnime}
        existingAnimes={animes}
        isOpen={Boolean(editingAnime)}
        isSaving={isSaving}
        formVariant={formVariant}
        canDelete={canDelete}
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
