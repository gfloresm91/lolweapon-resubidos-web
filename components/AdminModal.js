"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";

import TagsInput from "@/components/TagsInput";
import { DEFAULT_LIVE_STATUS_LABEL, LIVE_STATUS_OPTIONS } from "@/lib/animeDbMapping";

const emptyLive = {
  title: "",
  year: "2026",
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

const formSchema = z.object({
  title: z.string().trim().min(1, "El titulo es obligatorio"),
  year: z.string().trim().min(1, "El año es obligatorio"),
  date: z.string().trim().min(1, "La fecha es obligatoria"),
  status: z.string().trim().min(1, "El estado es obligatorio"),
  tags: z.array(z.string().trim()).default([]),
  additional_info: z.string().optional(),
  links: z.object({
    telegram: z.string(),
    okru: z.string(),
    piero: z.string(),
    patreon: z.string(),
  }),
});

function joinLines(items) {
  return Array.isArray(items) ? items.join("\n") : "";
}

function splitLines(value) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
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

export default function AdminModal({ live, isOpen, onClose, onSave, onDelete, isSaving, statuses = LIVE_STATUS_OPTIONS }) {
  const [imageFile, setImageFile] = useState(null);
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      year: "2026",
      date: "",
      status: DEFAULT_LIVE_STATUS_LABEL,
      tags: [],
      additional_info: "",
      links: {
        telegram: "",
        okru: "",
        piero: "",
        patreon: "",
      },
    },
  });

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const source = live || emptyLive;
    reset({
      title: source.title || "",
      year: source.year || "2026",
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
    });
    setImageFile(null);
  }, [isOpen, live, reset]);

  if (!isOpen) {
    return null;
  }

  function onSubmit(form) {
    onSave({
      ...live,
      ...form,
      date: fromDateInputValue(form.date),
      links: {
        telegram: splitLines(form.links.telegram),
        okru: splitLines(form.links.okru),
        piero: splitLines(form.links.piero),
        patreon: splitLines(form.links.patreon),
      },
      imageFile,
    });
  }

  return (
    <div id="edit-modal" className="modal-backdrop">
      <div className="modal-content admin-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close-button" aria-label="Cerrar modal" onClick={onClose}>
          <X size={18} />
        </button>
        <h2 id="modal-title" className="modal-title">
          {live ? "Editar Directo" : "Nuevo Directo"}
        </h2>

        <form className="modal-body" onSubmit={handleSubmit(onSubmit)}>
          <div className="form-row">
            <div className="form-group-modal">
              <label>Titulo del Directo</label>
              <input type="text" id="live-name" className="modal-input" {...register("title")} />
              {errors.title ? <p className="field-error">{errors.title.message}</p> : null}
            </div>
            <div className="form-group-modal">
              <label>Año (Carpeta)</label>
              <select id="live-year" className="modal-input" {...register("year")}>
                {["2026", "2025", "2024", "2023", "2022", "2021", "2020", "2019"].map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              {errors.year ? <p className="field-error">{errors.year.message}</p> : null}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group-modal">
              <label>Fecha Emision</label>
              <input type="date" id="live-date" className="modal-input" {...register("date")} />
              {errors.date ? <p className="field-error">{errors.date.message}</p> : null}
            </div>
            <div className="form-group-modal">
              <label>Estado</label>
              <select id="live-status" className="modal-input" {...register("status")}>
                {(statuses.length ? statuses : LIVE_STATUS_OPTIONS).map((status) => (
                  <option key={status.code || status.label} value={status.label}>
                    {status.label}
                  </option>
                ))}
              </select>
              {errors.status ? <p className="field-error">{errors.status.message}</p> : null}
            </div>
          </div>

          <div className="form-group-modal">
            <label>Etiquetas</label>
            <Controller
              control={control}
              name="tags"
              render={({ field }) => (
                <TagsInput value={field.value || []} onChange={field.onChange} error={errors.tags} />
              )}
            />
          </div>

          <div className="form-group-modal">
            <label>Informacion Adicional (Opcional, soporta saltos de linea)</label>
            <textarea
              id="live-additional-info"
              className="modal-input textarea-links"
              rows="4"
              {...register("additional_info")}
            />
          </div>

          <hr className="modal-hr" />
          <h3 className="modal-subtitle">Enlaces VOD (Un link por linea)</h3>

          <div className="form-row">
            <div className="form-group-modal">
              <label>🌐 Telegram URLs</label>
              <textarea
                id="live-telegram"
                className="modal-input textarea-links"
                rows="4"
                {...register("links.telegram")}
              />
            </div>
            <div className="form-group-modal">
              <label>🇷🇺 OK.RU URLs</label>
              <textarea
                id="live-okru"
                className="modal-input textarea-links"
                rows="4"
                {...register("links.okru")}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group-modal">
              <label>💎 Patreon URLs</label>
              <textarea
                id="live-patreon"
                className="modal-input textarea-links"
                rows="4"
                {...register("links.patreon")}
              />
            </div>
            <div className="form-group-modal">
              <label>🔥 Piero (Drive/Mega) URLs</label>
              <textarea
                id="live-piero"
                className="modal-input textarea-links"
                rows="4"
                {...register("links.piero")}
              />
            </div>
          </div>

          <div className="form-group-modal">
            <label>Opcional: Subir Miniatura</label>
            <input
              type="file"
              id="live-img-file"
              accept="image/*"
              className="modal-input"
              onChange={(event) => setImageFile(event.target.files?.[0] || null)}
            />
            {live?.image ? <div className="current-image-note">Miniatura actual: {live.image}</div> : null}
            {imageFile ? <div className="current-image-note">Nueva imagen: {imageFile.name}</div> : null}
          </div>

          <div className="modal-actions">
            {live ? (
              <button
                type="button"
                id="btn-delete"
                className="btn-modal btn-modal-danger"
                style={{ marginRight: "auto" }}
                onClick={() => onDelete(live.id)}
                disabled={isSaving}
              >
                🗑️ Borrar
              </button>
            ) : null}

            <button type="button" id="btn-cancel" className="btn-modal btn-modal-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" id="btn-save" className="btn-modal btn-modal-primary" disabled={isSaving}>
              {isSaving ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
