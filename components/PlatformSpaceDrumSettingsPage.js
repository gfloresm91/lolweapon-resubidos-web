"use client";

import { useEffect, useMemo, useState } from "react";
import { History, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import AuditLogModal from "@/components/AuditLogModal";
import { FilterSelect } from "@/components/FiltersBar";
import MaintainerStats from "@/components/MaintainerStats";

const LANGUAGE_OPTIONS = [
  { value: "es-es", label: "Español" },
  { value: "en-us", label: "English" },
];

const EMPTY_SETTINGS = {
  language: "es-es",
  title: "SpaceDrum",
  subtitle: "",
  status: "",
  coverImage: "",
  heroImage: "",
  description: "",
  meta: [],
  links: [],
};

function cloneSettings(settings) {
  return {
    ...EMPTY_SETTINGS,
    ...(settings || {}),
    meta: Array.isArray(settings?.meta) ? settings.meta.map((item) => ({ ...item })) : [],
    links: Array.isArray(settings?.links) ? settings.links.map((item) => ({ ...item })) : [],
  };
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return {};
  return JSON.parse(text);
}

export default function PlatformSpaceDrumSettingsPage({
  initialSettings = [],
  canUpdate = false,
  onSettingsChange,
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [language, setLanguage] = useState(initialSettings[0]?.language || "es-es");
  const selectedSettings = useMemo(
    () => settings.find((item) => item.language === language) || settings[0] || EMPTY_SETTINGS,
    [language, settings],
  );
  const [form, setForm] = useState(() => cloneSettings(selectedSettings));
  const [isSaving, setIsSaving] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);

  useEffect(() => {
    setSettings(initialSettings);
  }, [initialSettings]);

  useEffect(() => {
    setForm(cloneSettings(selectedSettings));
  }, [selectedSettings]);

  const stats = useMemo(() => ({
    languages: settings.length,
    links: selectedSettings.links?.length || 0,
    meta: selectedSettings.meta?.length || 0,
    chapters: selectedSettings.chaptersCount || 0,
  }), [selectedSettings, settings.length]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateCollection(collection, index, field, value) {
    setForm((current) => ({
      ...current,
      [collection]: current[collection].map((item, itemIndex) => (
        itemIndex === index ? { ...item, [field]: value } : item
      )),
    }));
  }

  function addCollectionItem(collection) {
    setForm((current) => ({
      ...current,
      [collection]: [...current[collection], collection === "meta" ? { label: "", value: "" } : { label: "", url: "" }],
    }));
  }

  function removeCollectionItem(collection, index) {
    setForm((current) => ({
      ...current,
      [collection]: current[collection].filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  async function saveSettings(event) {
    event.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/spacedrum/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: form }),
      });
      const data = await readJson(response);

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo guardar la configuración.");
      }

      setSettings(data.settings || []);
      onSettingsChange?.(data.settings || []);
      toast.success("Configuración guardada.");
    } catch (error) {
      toast.error(error.message || "No se pudo guardar la configuración.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <header className="watching-header admin-users-header">
        <div className="header-badge">
          <span className="dot" />
          ADMINISTRACIÓN
        </div>
        <h1 className="title">
          SpaceDrum <span className="text-gradient">configuración</span>
        </h1>
        <p className="subtitle">Edita la ficha pública, imágenes, créditos, links y datos editoriales por idioma.</p>
      </header>

      <MaintainerStats
        items={[
          { label: "Idiomas", value: stats.languages, color: "purple" },
          { label: "Capítulos", value: stats.chapters, color: "green" },
          { label: "Links", value: stats.links, color: "blue" },
          { label: "Datos", value: stats.meta, color: "orange" },
        ]}
      />

      <section className="tracker-actions" aria-label="Acciones de configuración SpaceDrum">
        <div>
          <span className="tracker-actions-label">Configuración</span>
          <p className="tracker-actions-copy">Estos cambios afectan la portada pública de SpaceDrum, sin modificar capítulos ni páginas.</p>
        </div>
        <div className="tracker-actions-buttons">
          <button type="button" className="tracker-action-secondary tracker-action-history" onClick={() => setIsAuditOpen(true)}>
            <History size={17} />
            Historial
          </button>
        </div>
      </section>

      <form className="spacedrum-settings-form" onSubmit={saveSettings} noValidate>
        <section className="spacedrum-settings-panel">
          <div className="spacedrum-settings-header">
            <div>
              <span className="tracker-actions-label">Idioma</span>
              <h2>{form.title || "SpaceDrum"}</h2>
            </div>
            <FilterSelect
              id="admin-spacedrum-settings-language"
              label="Idioma"
              value={language}
              options={LANGUAGE_OPTIONS}
              onChange={setLanguage}
            />
          </div>

          <div className="form-row">
            <div className="form-group-modal">
              <label htmlFor="spacedrum-settings-title">Título</label>
              <input
                id="spacedrum-settings-title"
                className="modal-input"
                value={form.title}
                maxLength={80}
                onChange={(event) => updateField("title", event.target.value)}
                disabled={!canUpdate}
              />
            </div>
            <div className="form-group-modal">
              <label htmlFor="spacedrum-settings-status">Estado</label>
              <input
                id="spacedrum-settings-status"
                className="modal-input"
                value={form.status}
                maxLength={80}
                onChange={(event) => updateField("status", event.target.value)}
                disabled={!canUpdate}
              />
            </div>
          </div>

          <div className="form-row is-single-column">
            <div className="form-group-modal">
              <label htmlFor="spacedrum-settings-subtitle">Subtítulo</label>
              <input
                id="spacedrum-settings-subtitle"
                className="modal-input"
                value={form.subtitle}
                maxLength={120}
                onChange={(event) => updateField("subtitle", event.target.value)}
                disabled={!canUpdate}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group-modal">
              <label htmlFor="spacedrum-settings-cover">Logo / portada</label>
              <input
                id="spacedrum-settings-cover"
                className="modal-input"
                value={form.coverImage}
                onChange={(event) => updateField("coverImage", event.target.value)}
                disabled={!canUpdate}
              />
            </div>
            <div className="form-group-modal">
              <label htmlFor="spacedrum-settings-hero">Imagen de fondo</label>
              <input
                id="spacedrum-settings-hero"
                className="modal-input"
                value={form.heroImage}
                onChange={(event) => updateField("heroImage", event.target.value)}
                disabled={!canUpdate}
              />
            </div>
          </div>

          <div className="form-row is-single-column">
            <div className="form-group-modal">
              <label htmlFor="spacedrum-settings-description">Sinopsis</label>
              <textarea
                id="spacedrum-settings-description"
                className="modal-input textarea-links spacedrum-settings-description"
                value={form.description}
                rows={9}
                onChange={(event) => updateField("description", event.target.value)}
                disabled={!canUpdate}
              />
            </div>
          </div>
        </section>

        <section className="spacedrum-settings-panel">
          <div className="spacedrum-settings-section-title">
            <div>
              <span className="tracker-actions-label">Links</span>
              <h2>Créditos y apoyo</h2>
            </div>
            {canUpdate ? (
              <button type="button" className="tracker-action-secondary" onClick={() => addCollectionItem("links")}>
                <Plus size={16} />
                Agregar link
              </button>
            ) : null}
          </div>
          <div className="spacedrum-settings-list">
            {form.links.map((link, index) => (
              <div className="spacedrum-settings-list-row" key={`link-${index}`}>
                <input
                  className="modal-input"
                  value={link.label}
                  placeholder="Etiqueta"
                  onChange={(event) => updateCollection("links", index, "label", event.target.value)}
                  disabled={!canUpdate}
                />
                <input
                  className="modal-input"
                  value={link.url}
                  placeholder="URL"
                  onChange={(event) => updateCollection("links", index, "url", event.target.value)}
                  disabled={!canUpdate}
                />
                {canUpdate ? (
                  <button type="button" className="icon-tool-button danger" aria-label="Quitar link" onClick={() => removeCollectionItem("links", index)}>
                    <Trash2 size={16} />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="spacedrum-settings-panel">
          <div className="spacedrum-settings-section-title">
            <div>
              <span className="tracker-actions-label">Datos</span>
              <h2>Indicadores públicos</h2>
            </div>
            {canUpdate ? (
              <button type="button" className="tracker-action-secondary" onClick={() => addCollectionItem("meta")}>
                <Plus size={16} />
                Agregar dato
              </button>
            ) : null}
          </div>
          <div className="spacedrum-settings-list">
            {form.meta.map((item, index) => (
              <div className="spacedrum-settings-list-row" key={`meta-${index}`}>
                <input
                  className="modal-input"
                  value={item.label}
                  placeholder="Etiqueta"
                  onChange={(event) => updateCollection("meta", index, "label", event.target.value)}
                  disabled={!canUpdate}
                />
                <input
                  className="modal-input"
                  value={item.value}
                  placeholder="Valor"
                  onChange={(event) => updateCollection("meta", index, "value", event.target.value)}
                  disabled={!canUpdate}
                />
                {canUpdate ? (
                  <button type="button" className="icon-tool-button danger" aria-label="Quitar dato" onClick={() => removeCollectionItem("meta", index)}>
                    <Trash2 size={16} />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        {canUpdate ? (
          <div className="spacedrum-settings-actions">
            <button type="submit" className="btn-modal btn-modal-primary" disabled={isSaving}>
              <Save size={16} />
              {isSaving ? "Guardando..." : "Guardar configuración"}
            </button>
          </div>
        ) : null}
      </form>

      <AuditLogModal
        isOpen={isAuditOpen}
        module="admin.spacedrum.settings"
        title="Historial de configuración"
        subtitle="Últimas acciones realizadas en la configuración de SpaceDrum."
        onClose={() => setIsAuditOpen(false)}
      />
    </>
  );
}
