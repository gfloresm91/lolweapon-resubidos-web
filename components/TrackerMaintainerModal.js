"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import DatePickerInput from "@/components/DatePickerInput";
import FormSelect from "@/components/FormSelect";
import MaintainerModal from "@/components/MaintainerModal";
import TagCombobox from "@/components/TagCombobox";
import { DEFAULT_LIVE_STATUS_LABEL, LIVE_STATUS_OPTIONS } from "@/lib/animeDbMapping";
import {
  splitLines,
  TRACKER_INFO_MAX_LENGTH,
  TRACKER_TAGS_MAX_COUNT,
  TRACKER_TAG_MAX_LENGTH,
  TRACKER_TITLE_MAX_LENGTH,
  trackerLiveCompactFormSchema,
  trackerLiveFormSchema,
} from "@/lib/trackerValidation";

const currentYear = new Date().getFullYear();
const TRACKER_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const emptyLive = {
  title: "",
  year: String(currentYear),
  date: "",
  status: DEFAULT_LIVE_STATUS_LABEL,
  tags: [],
  links: {
    telegram: [],
    okru: [],
    piero: [],
    patreon: [],
  },
  image: "",
  additional_info: "",
};
function joinLines(items) {
  return Array.isArray(items) ? items.join("\n") : "";
}

function toDateInputValue(date) {
  if (!date) {
    return "";
  }

  const [day = "01", month = "01", year = "1900"] = String(date).split("/");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function fromDateInputValue(date) {
  if (!date) {
    return "";
  }

  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function getFormValues(live) {
  const source = live || emptyLive;

  return {
    title: source.title || "",
    year: source.year || String(currentYear),
    date: toDateInputValue(source.date),
    status: source.status || DEFAULT_LIVE_STATUS_LABEL,
    tags: Array.isArray(source.tags) ? source.tags : [],
    additional_info: source.additional_info || "",
    links: {
      telegram: joinLines(source.links?.telegram),
      okru: joinLines(source.links?.okru),
      piero: joinLines(source.links?.piero),
      patreon: joinLines(source.links?.patreon),
    },
  };
}

function TrackerTagsSelector({ value = [], tags = [], tagCounts = {}, onChange, error }) {
  const [draftTag, setDraftTag] = useState("");
  const selectedTags = Array.isArray(value) ? value : [];
  const availableTags = tags.filter((tag) => !selectedTags.some((selectedTag) => selectedTag.toLowerCase() === tag.toLowerCase()));

  function addTag(tag) {
    const nextTag = String(tag || "").trim();

    if (!nextTag || selectedTags.length >= TRACKER_TAGS_MAX_COUNT || nextTag.length > TRACKER_TAG_MAX_LENGTH) {
      setDraftTag(nextTag);
      return;
    }

    if (selectedTags.some((selectedTag) => selectedTag.toLowerCase() === nextTag.toLowerCase())) {
      setDraftTag("");
      return;
    }

    onChange([...selectedTags, nextTag]);
    setDraftTag("");
  }

  function removeTag(tag) {
    onChange(selectedTags.filter((currentTag) => currentTag !== tag));
  }

  return (
    <div className="tracker-tag-selector">
      <div className="tracker-tag-selector-input">
        <TagCombobox
          value={draftTag}
          tags={availableTags}
          tagCounts={tagCounts}
          onChange={setDraftTag}
          onSelect={addTag}
          placeholder="Buscar o crear tag"
          countLabel="directos"
        />
      </div>
      {selectedTags.length ? (
        <div className="tags-chip-list">
          {selectedTags.map((tag) => (
            <span key={tag} className="tags-chip">
              {tag}
              <button type="button" className="tags-chip-remove" onClick={() => removeTag(tag)} aria-label={`Quitar ${tag}`}>
                x
              </button>
            </span>
          ))}
        </div>
      ) : (
        <span className="tracker-tag-selector-empty">Sin tags agregados.</span>
      )}
      {error ? <p className="field-error">{error.message}</p> : null}
    </div>
  );
}

export default function TrackerMaintainerModal({
  live,
  isOpen,
  onClose,
  onSave,
  isSaving,
  formVariant = "full",
  statuses = LIVE_STATUS_OPTIONS,
  availableTags = [],
  tagCounts = {},
  onDelete = null,
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <TrackerMaintainerModalContent
      key={live?.id || "new"}
      live={live}
      onClose={onClose}
      onSave={onSave}
      isSaving={isSaving}
      formVariant={formVariant}
      statuses={statuses}
      availableTags={availableTags}
      tagCounts={tagCounts}
      onDelete={onDelete}
    />
  );
}

function TrackerMaintainerModalContent({
  live,
  onClose,
  onSave,
  isSaving,
  formVariant,
  statuses,
  availableTags,
  tagCounts,
  onDelete,
}) {
  const isFullForm = formVariant === "full";
  const [imageFile, setImageFile] = useState(null);
  const [imageError, setImageError] = useState("");
  const [isImageCleared, setIsImageCleared] = useState(false);
  const yearOptions = useMemo(() => {
    const baseYears = Array.from({ length: 10 }, (_, index) => String(currentYear - index));
    const sourceYear = String(live?.year || "").trim();
    return Array.from(new Set([sourceYear, ...baseYears].filter(Boolean)));
  }, [live?.year]);
  const statusOptions = useMemo(
    () => (statuses.length ? statuses : LIVE_STATUS_OPTIONS).map((status) => ({ value: status.label, label: status.label })),
    [statuses],
  );
  const imageStatus = imageFile
    ? `Nueva imagen: ${imageFile.name}`
    : live?.image && !isImageCleared
      ? "Miniatura actual"
      : "Sin miniatura";
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    },
    maxFiles: 1,
    maxSize: TRACKER_IMAGE_MAX_BYTES,
    noClick: true,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles[0]) {
        setImageFile(acceptedFiles[0]);
        setImageError("");
        setIsImageCleared(false);
      }
    },
    onDropRejected: (rejections) => {
      const code = rejections[0]?.errors?.[0]?.code;
      setImageFile(null);
      setImageError(code === "file-too-large"
        ? "La miniatura no puede superar 2 MB."
        : "La miniatura debe ser PNG, JPG o WebP.");
    },
  });
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(isFullForm ? trackerLiveFormSchema : trackerLiveCompactFormSchema),
    defaultValues: getFormValues(live),
  });

  function onSubmit(form) {
    const nextLinks = {
      telegram: splitLines(form.links.telegram),
      okru: splitLines(form.links.okru),
      piero: isFullForm ? splitLines(form.links.piero) : (Array.isArray(live?.links?.piero) ? live.links.piero : []),
      patreon: isFullForm ? splitLines(form.links.patreon) : (Array.isArray(live?.links?.patreon) ? live.links.patreon : []),
    };

    onSave({
      ...live,
      ...form,
      image: isFullForm ? (isImageCleared ? "" : live?.image || "") : live?.image || "",
      date: fromDateInputValue(form.date),
      additional_info: isFullForm ? form.additional_info : live?.additional_info || "",
      links: nextLinks,
      imageFile: isFullForm ? imageFile : null,
    });
  }

  return (
    <MaintainerModal
      as="form"
      className="admin-modal tracker-maintainer-modal"
      title={live ? "Editar directo" : "Nuevo directo"}
      subtitle={live?.title || "Completa los datos del registro del rastreador."}
      onClose={onClose}
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      actions={(
        <>
          {live?.id && onDelete ? (
            <button
              type="button"
              className="btn-modal btn-modal-danger tracker-modal-delete-button"
              onClick={() => onDelete(live.id)}
              disabled={isSaving}
            >
              <Trash2 size={16} />
              Eliminar
            </button>
          ) : null}
          <button type="button" className="btn-modal btn-modal-secondary" onClick={onClose} disabled={isSaving}>
            Cancelar
          </button>
          <button type="submit" className="btn-modal btn-modal-primary" disabled={isSaving}>
            {isSaving ? "Guardando..." : live ? "Guardar cambios" : "Crear directo"}
          </button>
        </>
      )}
    >
      <section className="admin-modal-section">
        <h3>Identidad</h3>
        <div className="form-row">
          <div className="form-group-modal">
            <label>Título del directo</label>
            <input type="text" className="modal-input" maxLength={TRACKER_TITLE_MAX_LENGTH} {...register("title")} />
            {errors.title ? <p className="field-error">{errors.title.message}</p> : null}
          </div>
          <div className="form-group-modal">
            <label>Año</label>
            <Controller
              control={control}
              name="year"
              render={({ field }) => (
                <FormSelect
                  id="tracker-live-year"
                  label="Año"
                  value={field.value}
                  options={yearOptions.map((year) => ({ value: year, label: year }))}
                  onChange={field.onChange}
                />
              )}
            />
            {errors.year ? <p className="field-error">{errors.year.message}</p> : null}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group-modal">
            <label>Fecha de emisión</label>
            <Controller
              control={control}
              name="date"
              render={({ field }) => (
                <DatePickerInput
                  value={field.value}
                  onChange={field.onChange}
                  maxDate={new Date(currentYear + 1, 11, 31)}
                  minDate={new Date(currentYear - 15, 0, 1)}
                />
              )}
            />
            {errors.date ? <p className="field-error">{errors.date.message}</p> : null}
          </div>
          <div className="form-group-modal">
            <label>Estado</label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <FormSelect
                  id="tracker-live-status"
                  label="Estado"
                  value={field.value}
                  options={statusOptions}
                  onChange={field.onChange}
                />
              )}
            />
            {errors.status ? <p className="field-error">{errors.status.message}</p> : null}
          </div>
        </div>
      </section>

      <section className="admin-modal-section">
        <h3>{isFullForm ? "Tags y descripción" : "Tags"}</h3>
        <div className="form-group-modal">
          <label>Tags</label>
          <Controller
            control={control}
            name="tags"
            render={({ field }) => (
              <TrackerTagsSelector
                value={field.value || []}
                tags={availableTags}
                tagCounts={tagCounts}
                onChange={field.onChange}
                error={errors.tags}
              />
            )}
          />
        </div>

        {isFullForm ? (
          <div className="form-group-modal">
            <label>Información adicional</label>
            <textarea
              className="modal-input textarea-links"
              rows="4"
              maxLength={TRACKER_INFO_MAX_LENGTH}
              {...register("additional_info")}
            />
            <span className="field-help">Opcional. Soporta saltos de línea.</span>
            {errors.additional_info ? <p className="field-error">{errors.additional_info.message}</p> : null}
          </div>
        ) : null}
      </section>

      {isFullForm ? (
        <section className="admin-modal-section">
          <h3>Imagen</h3>
          <div className="form-group-modal">
            <label>Miniatura local</label>
            <div
              {...getRootProps({
                className: `anime-image-dropzone ${isDragActive ? "is-active" : ""} ${imageError ? "is-error" : ""}`,
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
                <button type="button" className="profile-avatar-clear" onClick={() => setImageFile(null)}>
                  Quitar imagen
                </button>
              ) : live?.image && !isImageCleared ? (
                <button type="button" className="profile-avatar-clear" onClick={() => setIsImageCleared(true)}>
                  Quitar miniatura actual
                </button>
              ) : null}
            </div>
            {live?.image && !imageFile && !isImageCleared ? <div className="current-image-note">{live.image}</div> : null}
            {imageError ? <span className="field-error">{imageError}</span> : null}
          </div>
        </section>
      ) : null}

      <section className="admin-modal-section">
        <h3>Enlaces VOD</h3>
        <p className="admin-modal-help">Ingresa un enlace por línea.</p>
        <div className="form-row">
          <div className="form-group-modal">
            <label>Telegram</label>
            <textarea className="modal-input textarea-links" rows="4" {...register("links.telegram")} />
            {errors.links?.telegram ? <p className="field-error">{errors.links.telegram.message}</p> : null}
          </div>
          <div className="form-group-modal">
            <label>OK.RU</label>
            <textarea className="modal-input textarea-links" rows="4" {...register("links.okru")} />
            {errors.links?.okru ? <p className="field-error">{errors.links.okru.message}</p> : null}
          </div>
        </div>
        {isFullForm ? (
          <div className="form-row">
            <div className="form-group-modal">
              <label>Patreon</label>
              <textarea className="modal-input textarea-links" rows="4" {...register("links.patreon")} />
              {errors.links?.patreon ? <p className="field-error">{errors.links.patreon.message}</p> : null}
            </div>
            <div className="form-group-modal">
              <label>Piero</label>
              <textarea className="modal-input textarea-links" rows="4" {...register("links.piero")} />
              {errors.links?.piero ? <p className="field-error">{errors.links.piero.message}</p> : null}
            </div>
          </div>
        ) : null}
      </section>
    </MaintainerModal>
  );
}
