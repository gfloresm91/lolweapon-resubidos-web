"use client";

import { useEffect, useMemo, useState } from "react";
import { Edit3, FileImage, History, Layers, Plus, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";

import AuditLogModal from "@/components/AuditLogModal";
import ConfirmModal from "@/components/ConfirmModal";
import { FilterSelect } from "@/components/FiltersBar";
import MaintainerModal from "@/components/MaintainerModal";
import MaintainerStats from "@/components/MaintainerStats";
import MaintainerTable from "@/components/MaintainerTable";
import MaintainerToolbar from "@/components/MaintainerToolbar";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_FORM = {
  id: null,
  language: "es-es",
  legacyId: "",
  title: "",
  releaseDate: "",
  position: 0,
  status: "draft",
  summary: "",
};

const LANGUAGE_LABELS = {
  "es-es": "Español",
  "en-us": "English",
};

const STATUS_LABELS = {
  draft: "Borrador",
  published: "Publicado",
  hidden: "Oculto",
};

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "draft", label: "Borradores" },
  { value: "published", label: "Publicados" },
  { value: "hidden", label: "Ocultos" },
];

const LANGUAGE_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "es-es", label: "Español" },
  { value: "en-us", label: "English" },
];

const TABLE_COLUMNS = [
  { key: "id", label: "ID", sortable: true },
  { key: "chapter", label: "Capítulo", sortable: true },
  { key: "language", label: "Idioma", sortable: true },
  { key: "releaseDate", label: "Fecha", sortable: true },
  { key: "pages", label: "Páginas", sortable: true },
  { key: "status", label: "Estado", sortable: true },
  { key: "actions", label: "Acciones" },
];

function normalizeText(value) {
  return String(value || "").toLowerCase();
}

function getStatusLabel(status) {
  return STATUS_LABELS[status] || STATUS_LABELS.draft;
}

function getLanguageLabel(language) {
  return LANGUAGE_LABELS[language] || language || "Sin idioma";
}

function getNextStatus(chapter) {
  return chapter.status === "published" ? "hidden" : "published";
}

function buildForm(chapter = null) {
  if (!chapter) return { ...DEFAULT_FORM };
  return {
    id: chapter.id,
    language: chapter.language || "es-es",
    legacyId: chapter.legacyId || "",
    title: chapter.title || "",
    releaseDate: chapter.releaseDate || "",
    position: chapter.position ?? 0,
    status: chapter.status || "draft",
    summary: chapter.summary || "",
  };
}

function sortChapters(chapters, sortConfig) {
  const direction = sortConfig.direction === "asc" ? 1 : -1;
  const key = sortConfig.key;

  return [...chapters].sort((left, right) => {
    let leftValue;
    let rightValue;

    if (key === "chapter") {
      leftValue = left.title || left.legacyId || "";
      rightValue = right.title || right.legacyId || "";
    } else if (key === "language") {
      leftValue = getLanguageLabel(left.language);
      rightValue = getLanguageLabel(right.language);
    } else if (key === "pages") {
      leftValue = Number(left.pagesCount || 0);
      rightValue = Number(right.pagesCount || 0);
    } else if (key === "releaseDate") {
      leftValue = left.releaseDate || "";
      rightValue = right.releaseDate || "";
    } else {
      leftValue = left[key] ?? "";
      rightValue = right[key] ?? "";
    }

    if (typeof leftValue === "number" || typeof rightValue === "number") {
      return (Number(leftValue) - Number(rightValue)) * direction;
    }

    return String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true }) * direction;
  });
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return {};
  return JSON.parse(text);
}

export default function PlatformSpaceDrumChaptersPage({
  initialChapters = [],
  canCreate = false,
  canUpdate = false,
  canDelete = false,
  canUpdatePages = false,
  onChaptersChange,
  onOpenPages,
}) {
  const [chapters, setChapters] = useState(initialChapters);
  const [searchQuery, setSearchQuery] = useState("");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState({ key: "id", direction: "desc" });
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingChapter, setEditingChapter] = useState(null);
  const [statusChapter, setStatusChapter] = useState(null);
  const [deleteChapter, setDeleteChapter] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);

  useEffect(() => {
    setChapters(initialChapters);
  }, [initialChapters]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, languageFilter, statusFilter, pageSize]);

  const stats = useMemo(() => {
    const total = chapters.length;
    const published = chapters.filter((chapter) => chapter.status === "published").length;
    const hidden = chapters.filter((chapter) => chapter.status === "hidden").length;
    const draft = chapters.filter((chapter) => chapter.status === "draft").length;
    return { total, published, hidden, draft };
  }, [chapters]);

  const filteredChapters = useMemo(() => {
    const query = normalizeText(searchQuery);
    return chapters.filter((chapter) => {
      const matchesSearch = !query || [
        chapter.id,
        chapter.title,
        chapter.legacyId,
        chapter.releaseDate,
        getLanguageLabel(chapter.language),
        getStatusLabel(chapter.status),
      ].some((value) => normalizeText(value).includes(query));
      const matchesLanguage = languageFilter === "all" || chapter.language === languageFilter;
      const matchesStatus = statusFilter === "all" || chapter.status === statusFilter;
      return matchesSearch && matchesLanguage && matchesStatus;
    });
  }, [chapters, languageFilter, searchQuery, statusFilter]);

  const sortedChapters = useMemo(() => sortChapters(filteredChapters, sortConfig), [filteredChapters, sortConfig]);
  const totalPages = Math.max(1, Math.ceil(sortedChapters.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedChapters = sortedChapters.slice((safePage - 1) * pageSize, safePage * pageSize);
  const paginationFrom = sortedChapters.length ? (safePage - 1) * pageSize + 1 : 0;
  const paginationTo = Math.min(safePage * pageSize, sortedChapters.length);

  function toggleSort(key) {
    setSortConfig((current) => (
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    ));
  }

  async function submitAction(payload, successMessage) {
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/spacedrum/chapters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readJson(response);

      if (response.status === 401) {
        window.location.href = "/login";
        return null;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo guardar el capítulo.");
      }

      setChapters(data.chapters || []);
      onChaptersChange?.(data.chapters || []);
      toast.success(successMessage);
      return data;
    } catch (error) {
      toast.error(error.message || "No se pudo procesar la acción.");
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function saveChapter(event) {
    event.preventDefault();
    const action = editingChapter?.id ? "update" : "create";
    const data = await submitAction(
      { action, chapter: editingChapter },
      action === "create" ? "Capítulo creado." : "Capítulo actualizado.",
    );
    if (data) {
      setEditingChapter(null);
    }
  }

  async function confirmStatusChange() {
    const nextStatus = getNextStatus(statusChapter);
    const data = await submitAction(
      { action: "update-status", id: statusChapter.id, status: nextStatus },
      nextStatus === "published" ? "Capítulo publicado." : "Capítulo ocultado.",
    );
    if (data) {
      setStatusChapter(null);
    }
  }

  async function confirmDelete() {
    const data = await submitAction(
      { action: "delete", id: deleteChapter.id },
      "Capítulo eliminado.",
    );
    if (data) {
      setDeleteChapter(null);
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
          SpaceDrum <span className="text-gradient">capítulos</span>
        </h1>
        <p className="subtitle">Administra los capítulos publicados, borradores y ocultos del lector.</p>
      </header>

      <MaintainerStats
        items={[
          { label: "Capítulos", value: stats.total, color: "purple" },
          { label: "Publicados", value: stats.published, color: "green" },
          { label: "Borradores", value: stats.draft, color: "blue" },
          { label: "Ocultos", value: stats.hidden, color: "orange" },
        ]}
      />

      <section className="tracker-actions" aria-label="Acciones SpaceDrum">
        <div>
          <span className="tracker-actions-label">SpaceDrum</span>
          <p className="tracker-actions-copy">Gestiona el catálogo de capítulos. Las páginas tendrán su propia administración.</p>
        </div>
        <div className="tracker-actions-buttons">
          <button type="button" className="tracker-action-secondary tracker-action-history" onClick={() => setIsAuditOpen(true)}>
            <History size={17} />
            Historial
          </button>
          {canCreate ? (
            <button type="button" className="tracker-action-primary" onClick={() => setEditingChapter(buildForm())}>
              <Plus size={18} />
              Nuevo capítulo
            </button>
          ) : null}
        </div>
      </section>

      <MaintainerToolbar
        searchId="admin-spacedrum-chapters-search"
        searchValue={searchQuery}
        searchPlaceholder="Buscar por ID, título, código, idioma o estado"
        onSearchChange={setSearchQuery}
      >
        <FilterSelect
          id="admin-spacedrum-language-filter"
          label="Idioma"
          value={languageFilter}
          options={LANGUAGE_OPTIONS}
          onChange={setLanguageFilter}
        />
        <FilterSelect
          id="admin-spacedrum-status-filter"
          label="Estado"
          value={statusFilter}
          options={STATUS_OPTIONS}
          onChange={setStatusFilter}
        />
      </MaintainerToolbar>

      <MaintainerTable
        ariaLabel="Capítulos SpaceDrum"
        className="admin-spacedrum-table"
        columns={TABLE_COLUMNS}
        sortConfig={sortConfig}
        onSort={toggleSort}
        isEmpty={!filteredChapters.length}
        emptyText="No hay capítulos con esos filtros."
        pagination={{
          from: paginationFrom,
          to: paginationTo,
          total: sortedChapters.length,
          canPrevious: safePage > 1,
          canNext: safePage < totalPages,
          pageSize,
          pageSizeOptions: PAGE_SIZE_OPTIONS,
          onPageSizeChange: (nextPageSize) => {
            setPageSize(nextPageSize);
            setCurrentPage(1);
          },
          onPrevious: () => setCurrentPage((page) => Math.max(1, page - 1)),
          onNext: () => setCurrentPage((page) => Math.min(totalPages, page + 1)),
        }}
      >
        {paginatedChapters.map((chapter) => (
          <div className="maintainer-table-row admin-spacedrum-row" role="row" key={chapter.id}>
            <span className="admin-user-cell admin-record-id">#{chapter.id}</span>
            <div className="admin-user-cell admin-spacedrum-chapter">
              {chapter.thumbnail ? (
                <img src={chapter.thumbnail} alt="" />
              ) : (
                <span className="admin-spacedrum-thumb-placeholder" aria-hidden="true">SD</span>
              )}
              <div>
                <strong>{chapter.title}</strong>
                <span>{chapter.legacyId || "Sin código"}</span>
              </div>
            </div>
            <span className="admin-user-cell">{getLanguageLabel(chapter.language)}</span>
            <span className="admin-user-cell">{chapter.releaseDate || "Sin fecha"}</span>
            <span className="admin-user-cell">{chapter.pagesCount} páginas</span>
            <span className={`admin-user-status is-spacedrum-${chapter.status || "draft"}`}>
              {getStatusLabel(chapter.status)}
            </span>
            <div className="admin-user-actions">
              {canUpdate ? (
                <button type="button" className="icon-tool-button" aria-label="Editar capítulo" onClick={() => setEditingChapter(buildForm(chapter))}>
                  <Edit3 size={17} />
                </button>
              ) : null}
              {canUpdatePages ? (
                <button
                  type="button"
                  className="icon-tool-button"
                  aria-label="Administrar páginas"
                  onClick={onOpenPages}
                >
                  <FileImage size={17} />
                </button>
              ) : null}
              {canUpdate ? (
                <button
                  type="button"
                  className="icon-tool-button"
                  aria-label={chapter.status === "published" ? "Ocultar capítulo" : "Publicar capítulo"}
                  onClick={() => setStatusChapter(chapter)}
                  disabled={isSaving}
                >
                  <Power size={17} />
                </button>
              ) : null}
              {canDelete ? (
                <button type="button" className="icon-tool-button danger" aria-label="Eliminar capítulo" onClick={() => setDeleteChapter(chapter)} disabled={isSaving}>
                  <Trash2 size={17} />
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </MaintainerTable>

      {editingChapter ? (
        <MaintainerModal
          as="form"
          className="admin-modal spacedrum-chapter-modal"
          title={editingChapter.id ? "Editar capítulo" : "Nuevo capítulo"}
          subtitle="Completa la ficha base del capítulo. Las páginas se gestionarán en una pantalla dedicada."
          onClose={() => setEditingChapter(null)}
          onSubmit={saveChapter}
          noValidate
          actions={(
            <>
              <button type="button" className="btn-modal btn-modal-secondary" onClick={() => setEditingChapter(null)} disabled={isSaving}>
                Cancelar
              </button>
              <button type="submit" className="btn-modal btn-modal-primary" disabled={isSaving}>
                {isSaving ? "Guardando..." : "Guardar capítulo"}
              </button>
            </>
          )}
        >
          <section className="admin-modal-section">
            <h3>Identidad</h3>
            <div className="form-row">
              <div className="form-group-modal">
                <label htmlFor="spacedrum-chapter-language">Idioma</label>
                <select
                  id="spacedrum-chapter-language"
                  className="modal-input"
                  value={editingChapter.language}
                  onChange={(event) => setEditingChapter((current) => ({ ...current, language: event.target.value }))}
                >
                  <option value="es-es">Español</option>
                  <option value="en-us">English</option>
                </select>
              </div>
              <div className="form-group-modal">
                <label htmlFor="spacedrum-chapter-status">Estado</label>
                <select
                  id="spacedrum-chapter-status"
                  className="modal-input"
                  value={editingChapter.status}
                  onChange={(event) => setEditingChapter((current) => ({ ...current, status: event.target.value }))}
                >
                  <option value="draft">Borrador</option>
                  <option value="published">Publicado</option>
                  <option value="hidden">Oculto</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group-modal">
                <label htmlFor="spacedrum-chapter-title">Título</label>
                <input
                  id="spacedrum-chapter-title"
                  className="modal-input"
                  value={editingChapter.title}
                  maxLength={120}
                  onChange={(event) => setEditingChapter((current) => ({ ...current, title: event.target.value }))}
                />
              </div>
              <div className="form-group-modal">
                <label htmlFor="spacedrum-chapter-code">Código interno</label>
                <input
                  id="spacedrum-chapter-code"
                  className="modal-input"
                  value={editingChapter.legacyId}
                  maxLength={120}
                  placeholder="Se genera desde el título si lo dejas vacío"
                  onChange={(event) => setEditingChapter((current) => ({ ...current, legacyId: event.target.value }))}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group-modal">
                <label htmlFor="spacedrum-chapter-date">Fecha</label>
                <input
                  id="spacedrum-chapter-date"
                  className="modal-input"
                  value={editingChapter.releaseDate}
                  placeholder="23 MAY 2024"
                  onChange={(event) => setEditingChapter((current) => ({ ...current, releaseDate: event.target.value }))}
                />
              </div>
              <div className="form-group-modal">
                <label htmlFor="spacedrum-chapter-position">Orden</label>
                <input
                  id="spacedrum-chapter-position"
                  className="modal-input"
                  type="number"
                  value={editingChapter.position}
                  onChange={(event) => setEditingChapter((current) => ({ ...current, position: event.target.value }))}
                />
              </div>
            </div>
          </section>

          <section className="admin-modal-section">
            <h3>Contenido</h3>
            <div className="form-row is-single-column">
              <div className="form-group-modal">
                <label htmlFor="spacedrum-chapter-summary">Resumen</label>
                <textarea
                  id="spacedrum-chapter-summary"
                  className="modal-input textarea-links"
                  value={editingChapter.summary}
                  rows={4}
                  onChange={(event) => setEditingChapter((current) => ({ ...current, summary: event.target.value }))}
                />
              </div>
            </div>
          </section>
        </MaintainerModal>
      ) : null}

      <ConfirmModal
        isOpen={Boolean(statusChapter)}
        title={statusChapter?.status === "published" ? "Ocultar capítulo" : "Publicar capítulo"}
        description={statusChapter?.status === "published"
          ? `${statusChapter?.title} dejará de aparecer en la página pública sin eliminar sus páginas.`
          : `${statusChapter?.title} quedará visible en SpaceDrum.`}
        confirmLabel={statusChapter?.status === "published" ? "Ocultar" : "Publicar"}
        cancelLabel="Cancelar"
        tone={statusChapter?.status === "published" ? "danger" : "default"}
        isLoading={isSaving}
        onCancel={() => setStatusChapter(null)}
        onConfirm={confirmStatusChange}
      />

      <ConfirmModal
        isOpen={Boolean(deleteChapter)}
        title="Eliminar capítulo"
        description={`${deleteChapter?.title || "Este capítulo"} será eliminado junto a sus páginas. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        tone="danger"
        isLoading={isSaving}
        onCancel={() => setDeleteChapter(null)}
        onConfirm={confirmDelete}
      />

      <AuditLogModal
        isOpen={isAuditOpen}
        module="admin.spacedrum.chapters"
        title="Historial de SpaceDrum"
        subtitle="Últimas acciones realizadas en el mantenedor de capítulos."
        onClose={() => setIsAuditOpen(false)}
      />
    </>
  );
}
