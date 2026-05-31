"use client";

import { useEffect, useMemo, useState } from "react";
import { Edit3, History, Plus, Trash2 } from "lucide-react";
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
  chapterId: "",
  image: "",
  alt: "",
  position: 0,
};

const LANGUAGE_LABELS = {
  "es-es": "Español",
  "en-us": "English",
};

const TABLE_COLUMNS = [
  { key: "id", label: "ID", sortable: true },
  { key: "preview", label: "Imagen" },
  { key: "chapter", label: "Capítulo", sortable: true },
  { key: "language", label: "Idioma", sortable: true },
  { key: "position", label: "Página", sortable: true },
  { key: "actions", label: "Acciones" },
];

function normalizeText(value) {
  return String(value || "").toLowerCase();
}

function getLanguageLabel(language) {
  return LANGUAGE_LABELS[language] || language || "Sin idioma";
}

function buildForm(page = null, chapters = []) {
  if (!page) {
    return { ...DEFAULT_FORM, chapterId: chapters[0]?.id || "" };
  }

  return {
    id: page.id,
    chapterId: page.chapterId || "",
    image: page.image || "",
    alt: page.alt || "",
    position: page.position ?? 0,
  };
}

function sortPages(pages, sortConfig) {
  const direction = sortConfig.direction === "asc" ? 1 : -1;
  return [...pages].sort((left, right) => {
    let leftValue = left[sortConfig.key] ?? "";
    let rightValue = right[sortConfig.key] ?? "";

    if (sortConfig.key === "chapter") {
      leftValue = left.chapterTitle || "";
      rightValue = right.chapterTitle || "";
    }

    if (sortConfig.key === "language") {
      leftValue = getLanguageLabel(left.language);
      rightValue = getLanguageLabel(right.language);
    }

    if (["id", "position"].includes(sortConfig.key)) {
      return (Number(leftValue || 0) - Number(rightValue || 0)) * direction;
    }

    return String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true }) * direction;
  });
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return {};
  return JSON.parse(text);
}

export default function PlatformSpaceDrumPagesPage({
  initialPages = [],
  chapters = [],
  canCreate = false,
  canUpdate = false,
  canDelete = false,
  onPagesChange,
  onChaptersChange,
}) {
  const [pages, setPages] = useState(initialPages);
  const [availableChapters, setAvailableChapters] = useState(chapters);
  const [searchQuery, setSearchQuery] = useState("");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [chapterFilter, setChapterFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState({ key: "chapter", direction: "asc" });
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingPage, setEditingPage] = useState(null);
  const [deletePage, setDeletePage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);

  useEffect(() => {
    setPages(initialPages);
  }, [initialPages]);

  useEffect(() => {
    setAvailableChapters(chapters);
  }, [chapters]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, languageFilter, chapterFilter, pageSize]);

  const stats = useMemo(() => {
    const chaptersWithPages = new Set(pages.map((page) => page.chapterId)).size;
    return {
      total: pages.length,
      chapters: chaptersWithPages,
      spanish: pages.filter((page) => page.language === "es-es").length,
      english: pages.filter((page) => page.language === "en-us").length,
    };
  }, [pages]);

  const chapterOptions = useMemo(() => [
    { value: "all", label: "Todos" },
    ...availableChapters.map((chapter) => ({
      value: String(chapter.id),
      label: `${chapter.title} · ${getLanguageLabel(chapter.language)}`,
    })),
  ], [availableChapters]);

  const formChapterOptions = useMemo(() => availableChapters.map((chapter) => ({
    value: String(chapter.id),
    label: `${chapter.title} · ${getLanguageLabel(chapter.language)} · #${chapter.id}`,
  })), [availableChapters]);

  const filteredPages = useMemo(() => {
    const query = normalizeText(searchQuery);
    return pages.filter((page) => {
      const matchesSearch = !query || [
        page.id,
        page.chapterTitle,
        page.chapterLegacyId,
        page.image,
        page.alt,
        getLanguageLabel(page.language),
      ].some((value) => normalizeText(value).includes(query));
      const matchesLanguage = languageFilter === "all" || page.language === languageFilter;
      const matchesChapter = chapterFilter === "all" || String(page.chapterId) === chapterFilter;
      return matchesSearch && matchesLanguage && matchesChapter;
    });
  }, [chapterFilter, languageFilter, pages, searchQuery]);

  const sortedPages = useMemo(() => sortPages(filteredPages, sortConfig), [filteredPages, sortConfig]);
  const totalPages = Math.max(1, Math.ceil(sortedPages.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedPages = sortedPages.slice((safePage - 1) * pageSize, safePage * pageSize);
  const paginationFrom = sortedPages.length ? (safePage - 1) * pageSize + 1 : 0;
  const paginationTo = Math.min(safePage * pageSize, sortedPages.length);

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
      const response = await fetch("/api/admin/spacedrum/pages", {
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
        throw new Error(data.error || "No se pudo guardar la página.");
      }

      setPages(data.pages || []);
      onPagesChange?.(data.pages || []);
      if (data.chapters) {
        setAvailableChapters(data.chapters || []);
        onChaptersChange?.(data.chapters || []);
      }
      toast.success(successMessage);
      return data;
    } catch (error) {
      toast.error(error.message || "No se pudo procesar la acción.");
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function savePage(event) {
    event.preventDefault();
    const action = editingPage?.id ? "update" : "create";
    const data = await submitAction(
      { action, page: editingPage },
      action === "create" ? "Página creada." : "Página actualizada.",
    );
    if (data) {
      setEditingPage(null);
    }
  }

  async function confirmDelete() {
    const data = await submitAction(
      { action: "delete", id: deletePage.id },
      "Página eliminada.",
    );
    if (data) {
      setDeletePage(null);
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
          SpaceDrum <span className="text-gradient">páginas</span>
        </h1>
        <p className="subtitle">Administra las imágenes que componen cada capítulo del lector.</p>
      </header>

      <MaintainerStats
        items={[
          { label: "Páginas", value: stats.total, color: "purple" },
          { label: "Capítulos", value: stats.chapters, color: "green" },
          { label: "Español", value: stats.spanish, color: "blue" },
          { label: "English", value: stats.english, color: "orange" },
        ]}
      />

      <section className="tracker-actions" aria-label="Acciones de páginas SpaceDrum">
        <div>
          <span className="tracker-actions-label">Páginas</span>
          <p className="tracker-actions-copy">Cada imagen pertenece a un capítulo y se ordena por número de página.</p>
        </div>
        <div className="tracker-actions-buttons">
          <button type="button" className="tracker-action-secondary tracker-action-history" onClick={() => setIsAuditOpen(true)}>
            <History size={17} />
            Historial
          </button>
          {canCreate ? (
            <button type="button" className="tracker-action-primary" onClick={() => setEditingPage(buildForm(null, availableChapters))} disabled={!availableChapters.length}>
              <Plus size={18} />
              Nueva página
            </button>
          ) : null}
        </div>
      </section>

      <MaintainerToolbar
        searchId="admin-spacedrum-pages-search"
        searchValue={searchQuery}
        searchPlaceholder="Buscar por ID, capítulo, imagen, idioma o texto alternativo"
        onSearchChange={setSearchQuery}
      >
        <FilterSelect
          id="admin-spacedrum-pages-language-filter"
          label="Idioma"
          value={languageFilter}
          options={[
            { value: "all", label: "Todos" },
            { value: "es-es", label: "Español" },
            { value: "en-us", label: "English" },
          ]}
          onChange={setLanguageFilter}
        />
        <FilterSelect
          id="admin-spacedrum-pages-chapter-filter"
          label="Capítulo"
          value={chapterFilter}
          options={chapterOptions}
          onChange={setChapterFilter}
        />
      </MaintainerToolbar>

      <MaintainerTable
        ariaLabel="Páginas SpaceDrum"
        className="admin-spacedrum-pages-table"
        columns={TABLE_COLUMNS}
        sortConfig={sortConfig}
        onSort={toggleSort}
        isEmpty={!filteredPages.length}
        emptyText="No hay páginas con esos filtros."
        pagination={{
          from: paginationFrom,
          to: paginationTo,
          total: sortedPages.length,
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
        {paginatedPages.map((page) => (
          <div className="maintainer-table-row admin-spacedrum-page-row" role="row" key={page.id}>
            <span className="admin-user-cell admin-record-id">#{page.id}</span>
            <div className="admin-spacedrum-page-preview">
              <img src={page.image} alt="" />
            </div>
            <div className="admin-user-cell admin-spacedrum-page-chapter">
              <strong>{page.chapterTitle}</strong>
              <span>{page.chapterLegacyId || "Sin código"}</span>
            </div>
            <span className="admin-user-cell">{getLanguageLabel(page.language)}</span>
            <span className="admin-user-cell">Página {Number(page.position || 0) + 1}</span>
            <div className="admin-user-actions">
              {canUpdate ? (
                <button type="button" className="icon-tool-button" aria-label="Editar página" onClick={() => setEditingPage(buildForm(page, availableChapters))}>
                  <Edit3 size={17} />
                </button>
              ) : null}
              {canDelete ? (
                <button type="button" className="icon-tool-button danger" aria-label="Eliminar página" onClick={() => setDeletePage(page)} disabled={isSaving}>
                  <Trash2 size={17} />
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </MaintainerTable>

      {editingPage ? (
        <MaintainerModal
          as="form"
          className="admin-modal spacedrum-page-modal"
          title={editingPage.id ? "Editar página" : "Nueva página"}
          subtitle="Asocia una imagen al capítulo correspondiente y define su posición dentro del lector."
          onClose={() => setEditingPage(null)}
          onSubmit={savePage}
          noValidate
          actions={(
            <>
              <button type="button" className="btn-modal btn-modal-secondary" onClick={() => setEditingPage(null)} disabled={isSaving}>
                Cancelar
              </button>
              <button type="submit" className="btn-modal btn-modal-primary" disabled={isSaving}>
                {isSaving ? "Guardando..." : "Guardar página"}
              </button>
            </>
          )}
        >
          <section className="admin-modal-section">
            <h3>Contenido</h3>
            <div className="form-row">
              <div className="form-group-modal">
                <label htmlFor="spacedrum-page-chapter">Capítulo</label>
                <select
                  id="spacedrum-page-chapter"
                  className="modal-input"
                  value={editingPage.chapterId}
                  onChange={(event) => setEditingPage((current) => ({ ...current, chapterId: event.target.value }))}
                >
                  {formChapterOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group-modal">
                <label htmlFor="spacedrum-page-position">Orden</label>
                <input
                  id="spacedrum-page-position"
                  type="number"
                  className="modal-input"
                  value={editingPage.position}
                  onChange={(event) => setEditingPage((current) => ({ ...current, position: event.target.value }))}
                />
                <span className="field-help">Usa 0 para la primera página, 1 para la segunda, etc.</span>
              </div>
            </div>
            <div className="form-row is-single-column">
              <div className="form-group-modal">
                <label htmlFor="spacedrum-page-image">URL de imagen</label>
                <input
                  id="spacedrum-page-image"
                  className="modal-input"
                  value={editingPage.image}
                  onChange={(event) => setEditingPage((current) => ({ ...current, image: event.target.value }))}
                />
              </div>
              <div className="form-group-modal">
                <label htmlFor="spacedrum-page-alt">Texto alternativo</label>
                <input
                  id="spacedrum-page-alt"
                  className="modal-input"
                  value={editingPage.alt}
                  maxLength={160}
                  onChange={(event) => setEditingPage((current) => ({ ...current, alt: event.target.value }))}
                />
              </div>
            </div>
            {editingPage.image ? (
              <div className="spacedrum-page-modal-preview">
                <img src={editingPage.image} alt="" />
              </div>
            ) : null}
          </section>
        </MaintainerModal>
      ) : null}

      <ConfirmModal
        isOpen={Boolean(deletePage)}
        title="Eliminar página"
        description={`La página ${Number(deletePage?.position || 0) + 1} de ${deletePage?.chapterTitle || "este capítulo"} será eliminada definitivamente.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        tone="danger"
        isLoading={isSaving}
        onCancel={() => setDeletePage(null)}
        onConfirm={confirmDelete}
      />

      <AuditLogModal
        isOpen={isAuditOpen}
        module="admin.spacedrum.pages"
        title="Historial de páginas"
        subtitle="Últimas acciones realizadas en las páginas de SpaceDrum."
        onClose={() => setIsAuditOpen(false)}
      />
    </>
  );
}
