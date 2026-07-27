"use client";

import { useEffect, useMemo, useState } from "react";
import { Edit3, History, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import AuditLogModal from "@/components/AuditLogModal";
import ConfirmModal from "@/components/ConfirmModal";
import FormSelect from "@/components/FormSelect";
import MaintainerModal from "@/components/MaintainerModal";
import MaintainerStats from "@/components/MaintainerStats";
import MaintainerTable from "@/components/MaintainerTable";
import MaintainerToolbar from "@/components/MaintainerToolbar";
import Tooltip from "@/components/Tooltip";
import { FilterSelect } from "@/components/FiltersBar";
import { normalizeTag, TAG_CATEGORIES } from "@/lib/tags";

const TAG_COLUMNS = [
  { key: "id", label: "ID", sortable: true },
  { key: "name", label: "Tag", sortable: true },
  { key: "slug", label: "Slug", sortable: true },
  { key: "category", label: "Categoría", sortable: true },
  { key: "categoryCode", label: "Código", sortable: true },
  { key: "liveCount", label: "Directos", sortable: true },
  { key: "animeCount", label: "Animes", sortable: true },
  { key: "source", label: "Asignación", sortable: true },
  { key: "rule", label: "Regla", sortable: true },
  { key: "actions", label: "Acciones" },
];
const DEFAULT_CATEGORY_ICON = "TG";
const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function normalizeCategorySlug(label) {
  return String(label || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildCustomCategoryKey(label, existingCategories) {
  const baseKey = normalizeCategorySlug(label) || "categoria";
  const existingKeys = new Set(existingCategories.map((category) => category.key));
  let key = `custom-${baseKey}`;
  let index = 2;

  while (existingKeys.has(key)) {
    key = `custom-${baseKey}-${index}`;
    index += 1;
  }

  return key;
}

function buildCategoryCatalog(customCategories = []) {
  const baseCategories = TAG_CATEGORIES.filter((category) => category.key !== "other");
  const otherCategory = TAG_CATEGORIES.find((category) => category.key === "other");
  return [...baseCategories, ...customCategories, otherCategory].filter(Boolean);
}

function compareValues(left, right, direction) {
  const modifier = direction === "desc" ? -1 : 1;
  const leftValue = typeof left === "number" ? left : String(left || "").toLowerCase();
  const rightValue = typeof right === "number" ? right : String(right || "").toLowerCase();

  if (leftValue < rightValue) return -1 * modifier;
  if (leftValue > rightValue) return 1 * modifier;
  return 0;
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getRuleDescription(tag) {
  if (tag.isManual) {
    return `Manual; por regla sería ${tag.automaticCategoryLabel || "calculada"}`;
  }

  if (tag.ruleType === "exact") {
    return `Regla exacta: ${tag.ruleValue}`;
  }

  if (tag.ruleType === "keyword") {
    return `Keyword: ${tag.ruleValue}`;
  }

  return "Sin coincidencia; cae en Otros";
}

function getTagSortValue(tag, key) {
  if (key === "category") {
    return tag.categoryLabel;
  }

  if (key === "categoryCode") {
    return tag.categoryCode;
  }

  if (key === "source") {
    return tag.isManual ? "Manual" : "Por regla";
  }

  if (key === "rule") {
    return getRuleDescription(tag);
  }

  return tag[key];
}

export default function PlatformTagsMaintainerPage({
  canCreate = false,
  canUpdate = false,
  canDelete = false,
}) {
  const [tagItems, setTagItems] = useState([]);
  const [customCategories, setCustomCategories] = useState([]);
  const [ruleCategories, setRuleCategories] = useState([]);
  const [overrides, setOverrides] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [usageFilter, setUsageFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState({ key: "id", direction: "desc" });
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [editingTag, setEditingTag] = useState(null);
  const [restoringTag, setRestoringTag] = useState(null);
  const [deletingTag, setDeletingTag] = useState(null);
  const [nextCategory, setNextCategory] = useState("auto");
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [deletingCategory, setDeletingCategory] = useState(null);
  const [categoryDraft, setCategoryDraft] = useState({ key: "", label: "", icon: DEFAULT_CATEGORY_ICON, exactText: "", keywordsText: "", custom: true });
  const [categoryError, setCategoryError] = useState("");
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const categories = useMemo(() => (
    ruleCategories.length ? ruleCategories : buildCategoryCatalog(customCategories)
  ), [customCategories, ruleCategories]);
  const categoryOptions = useMemo(() => [
    { value: "all", label: "Todas" },
    ...categories.map((category) => ({ value: category.key, label: category.label })),
  ], [categories]);
  const editCategoryOptions = useMemo(() => [
    { value: "auto", label: "Por regla" },
    ...categories.map((category) => ({ value: category.key, label: category.label })),
  ], [categories]);
  const sourceOptions = useMemo(() => [
    { value: "all", label: "Todos" },
    { value: "manual", label: "Manual" },
    { value: "auto", label: "Por regla" },
  ], []);
  const usageOptions = useMemo(() => [
    { value: "all", label: "Todos" },
    { value: "with", label: "Con uso" },
    { value: "without", label: "Sin uso" },
  ], []);
  const filteredTags = useMemo(() => {
    const query = normalizeSearchText(searchQuery.trim());

    return tagItems
      .filter((tag) => !query || [
        tag.id,
        tag.name,
        tag.slug,
        tag.categoryLabel,
        tag.categoryCode,
        tag.liveCount,
        `${tag.liveCount || 0} directos`,
        tag.animeCount,
        `${tag.animeCount || 0} animes`,
        tag.isManual ? "Manual" : "Por regla",
        getRuleDescription(tag),
      ].some((value) => normalizeSearchText(value).includes(query)))
      .filter((tag) => categoryFilter === "all" || tag.categoryCode === categoryFilter)
      .filter((tag) => {
        if (sourceFilter === "manual") return tag.isManual;
        if (sourceFilter === "auto") return !tag.isManual;
        return true;
      })
      .filter((tag) => {
        const usageCount = (tag.liveCount || 0) + (tag.animeCount || 0);
        if (usageFilter === "with") return usageCount > 0;
        if (usageFilter === "without") return usageCount === 0;
        return true;
      })
      .sort((left, right) => {
        const key = sortConfig.key;
        const leftValue = getTagSortValue(left, key);
        const rightValue = getTagSortValue(right, key);
        return compareValues(leftValue, rightValue, sortConfig.direction);
      });
  }, [categoryFilter, searchQuery, sortConfig, sourceFilter, tagItems, usageFilter]);
  const stats = useMemo(() => ({
    total: tagItems.length,
    manual: tagItems.filter((tag) => tag.isManual).length,
    categories: categories.length,
  }), [categories.length, tagItems]);
  const paginatedTags = useMemo(() => {
    const start = pageIndex * pageSize;
    return filteredTags.slice(start, start + pageSize);
  }, [filteredTags, pageIndex, pageSize]);
  const paginationFrom = filteredTags.length ? (pageIndex * pageSize) + 1 : 0;
  const paginationTo = Math.min((pageIndex + 1) * pageSize, filteredTags.length);

  useEffect(() => {
    setPageIndex(0);
  }, [categoryFilter, searchQuery, sourceFilter, usageFilter, pageSize]);

  async function loadTags() {
    setIsLoading(true);

    try {
      const response = await fetch("/api/tags", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudieron cargar los tags.");
      }

      setTagItems(Array.isArray(data.tagItems) ? data.tagItems : []);
      setCustomCategories(Array.isArray(data.categories) ? data.categories : []);
      setRuleCategories(Array.isArray(data.ruleCategories) ? data.ruleCategories : []);
      setOverrides(data.overrides && typeof data.overrides === "object" ? data.overrides : {});
    } catch (error) {
      toast.error(error.message || "No se pudieron cargar los tags.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadTags();
  }, []);

  function toggleSort(key) {
    setSortConfig((current) => {
      if (current.key === key) {
        return { key, direction: current.direction === "asc" ? "desc" : "asc" };
      }

      return { key, direction: ["id", "liveCount", "animeCount"].includes(key) ? "desc" : "asc" };
    });
  }

  async function persistTagSettings(nextSettings) {
    setIsSaving(true);

    try {
      const response = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextSettings),
      });
      const data = await response.json();

      if (response.status === 401) {
        window.location.href = "/login";
        return false;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudieron guardar los tags.");
      }

      await loadTags();
      return true;
    } catch (error) {
      toast.error(error.message || "No se pudieron guardar los tags.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  function openEditTag(tag) {
    setEditingTag(tag);
    setNextCategory(tag.isManual ? tag.categoryCode : "auto");
  }

  async function saveTagCategory() {
    if (!editingTag || !canUpdate) {
      return;
    }

    const saved = await persistTagSettings({
      action: "update-tag",
      tag: editingTag.name,
      categoryKey: nextCategory,
    });

    if (saved) {
      setEditingTag(null);
      toast.success("Tag actualizado.");
    }
  }

  async function confirmRestoreAutomaticCategory() {
    if (!restoringTag || !canUpdate) {
      return;
    }

    const saved = await persistTagSettings({
      action: "update-tag",
      tag: restoringTag.name,
      categoryKey: "auto",
    });

    if (saved) {
      setRestoringTag(null);
      toast.success("Categoría por regla restaurada.");
    }
  }

  async function confirmDeleteTag() {
    if (!deletingTag || !canDelete) {
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/tags?slug=${encodeURIComponent(deletingTag.slug)}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo eliminar el tag.");
      }

      setDeletingTag(null);
      await loadTags();
      toast.success("Tag eliminado.");
    } catch (error) {
      toast.error(error.message || "No se pudo eliminar el tag.");
    } finally {
      setIsSaving(false);
    }
  }

  function openCreateCategory() {
    setEditingCategory(null);
    setCategoryDraft({ key: "", label: "", icon: DEFAULT_CATEGORY_ICON, exactText: "", keywordsText: "", custom: true });
    setCategoryError("");
    setIsCategoryModalOpen(true);
  }

  function openEditCategory(category) {
    setEditingCategory(category);
    setCategoryDraft({
      key: category.key,
      label: category.label,
      icon: category.icon || DEFAULT_CATEGORY_ICON,
      exactText: (category.exact || []).join("\n"),
      keywordsText: (category.keywords || []).join("\n"),
      custom: Boolean(category.custom),
    });
    setCategoryError("");
    setIsCategoryModalOpen(true);
  }

  function parseRuleText(value) {
    return Array.from(new Set(
      String(value || "")
        .split(/[\n,]+/)
        .map((item) => normalizeTag(item))
        .filter(Boolean),
    )).sort((left, right) => left.localeCompare(right));
  }

  async function createCategory(event) {
    event.preventDefault();

    if (editingCategory && !canUpdate) {
      return;
    }

    if (!editingCategory && !canCreate) {
      return;
    }

    const label = categoryDraft.label.trim();
    const icon = categoryDraft.icon.trim() || DEFAULT_CATEGORY_ICON;

    if (!label) {
      setCategoryError("El nombre de la categoría es obligatorio.");
      return;
    }

    if (label.length > 40) {
      setCategoryError("La categoría no puede superar 40 caracteres.");
      return;
    }

    const normalizedLabel = normalizeCategorySlug(label);
    const alreadyExists = categories.some((category) => (
      category.key !== editingCategory?.key && normalizeCategorySlug(category.label) === normalizedLabel
    ));

    if (alreadyExists) {
      setCategoryError("Ya existe una categoría con ese nombre.");
      return;
    }

    const nextCategory = {
      key: editingCategory?.key || buildCustomCategoryKey(label, categories),
      label,
      icon,
      exact: parseRuleText(categoryDraft.exactText),
      keywords: parseRuleText(categoryDraft.keywordsText),
      custom: categoryDraft.custom,
    };
    const saved = await persistTagSettings({
      action: editingCategory ? "update-category" : "create-category",
      category: nextCategory,
    });

    if (saved) {
      setIsCategoryModalOpen(false);
      setEditingCategory(null);
      setCategoryDraft({ key: "", label: "", icon: DEFAULT_CATEGORY_ICON, exactText: "", keywordsText: "", custom: true });
      toast.success(editingCategory ? "Categoría actualizada." : "Categoría creada.");
    }
  }

  async function confirmDeleteCategory() {
    if (!deletingCategory || !canDelete) {
      return;
    }

    const saved = await persistTagSettings({
      action: "delete-category",
      categoryKey: deletingCategory.key,
    });

    if (saved) {
      setDeletingCategory(null);
      toast.success("Categoría eliminada.");
    }
  }

  return (
    <>
      <header className="watching-header admin-users-header admin-tags-header">
        <h1 className="title">
          Mantenedor <span className="text-gradient">Tags</span>
        </h1>
        <p className="subtitle">Administra categorías y asignaciones manuales de tags del rastreador.</p>
      </header>

      <MaintainerStats
        items={[
          { label: "Tags", value: stats.total, color: "purple" },
          { label: "Manuales", value: stats.manual, color: "blue" },
          { label: "Categorías", value: stats.categories, color: "green" },
        ]}
      />

      <section className="tracker-actions" aria-label="Acciones de tags">
        <div>
          <span className="tracker-actions-label">Tags</span>
          <p className="tracker-actions-copy">Gestiona cómo se agrupan los tags del rastreador.</p>
        </div>
        <div className="tracker-actions-buttons">
          <button type="button" className="tracker-action-secondary tracker-action-history" onClick={() => setIsAuditOpen(true)}>
            <History size={17} />
            Historial
          </button>
          {canCreate ? (
            <button type="button" className="tracker-action-primary" onClick={openCreateCategory}>
              <Plus size={18} />
              Nueva categoría
            </button>
          ) : null}
        </div>
      </section>

      <section className="tag-category-manager" aria-label="Categorías de tags">
        <div className="tag-category-manager-header">
          <span>Categorías</span>
          <small>{categories.length} configuradas</small>
        </div>
        <div className="tag-category-manager-grid">
          {categories.map((category) => (
            <div key={category.key} className="tag-category-manager-card">
              <div>
                <strong>{category.icon ? <span>{category.icon}</span> : null}{category.label}</strong>
                <small>{category.key} · {(category.keywords || []).length} keywords · {(category.exact || []).length} exactas</small>
              </div>
              <div className="admin-user-actions">
                {canUpdate ? (
                  <Tooltip label="Editar categoría">
                    <button type="button" className="icon-tool-button" aria-label="Editar categoría" onClick={() => openEditCategory(category)}>
                      <Edit3 size={17} />
                    </button>
                  </Tooltip>
                ) : null}
                {canDelete && category.custom ? (
                  <Tooltip label="Eliminar categoría">
                    <button type="button" className="icon-tool-button danger" aria-label="Eliminar categoría" onClick={() => setDeletingCategory(category)}>
                      <Trash2 size={17} />
                    </button>
                  </Tooltip>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      <MaintainerToolbar
        searchId="admin-tags-search"
        searchValue={searchQuery}
        searchPlaceholder="Buscar por ID, tag, slug, categoría, código, uso, asignación o regla"
        onSearchChange={setSearchQuery}
      >
        <FilterSelect
          id="admin-tags-category-filter"
          label="Categoría"
          value={categoryFilter}
          options={categoryOptions}
          onChange={setCategoryFilter}
        />
        <FilterSelect
          id="admin-tags-source-filter"
          label="Asignación"
          value={sourceFilter}
          options={sourceOptions}
          onChange={setSourceFilter}
        />
        <FilterSelect
          id="admin-tags-usage-filter"
          label="Uso"
          value={usageFilter}
          options={usageOptions}
          onChange={setUsageFilter}
        />
      </MaintainerToolbar>

      <MaintainerTable
        ariaLabel="Mantenedor Tags"
        className="admin-tags-table"
        columns={TAG_COLUMNS}
        sortConfig={sortConfig}
        onSort={toggleSort}
        isLoading={isLoading}
        loadingText="Cargando tags..."
        isEmpty={!filteredTags.length}
        emptyText="No hay tags que coincidan con la búsqueda."
        pagination={{
          from: paginationFrom,
          to: paginationTo,
          total: filteredTags.length,
          canPrevious: pageIndex > 0,
          canNext: paginationTo < filteredTags.length,
          pageSize,
          pageSizeOptions: PAGE_SIZE_OPTIONS,
          onPageSizeChange: setPageSize,
          onPrevious: () => setPageIndex((current) => Math.max(current - 1, 0)),
          onNext: () => setPageIndex((current) => (paginationTo < filteredTags.length ? current + 1 : current)),
        }}
      >
        {paginatedTags.map((tag) => (
          <div className="maintainer-table-row admin-tags-row" role="row" key={tag.slug || tag.name}>
            <span className="admin-user-cell admin-record-id">#{tag.id}</span>
            <span className="admin-user-cell admin-tags-name-cell">{tag.name}</span>
            <span className="admin-user-cell admin-tags-slug-cell">{tag.slug}</span>
            <div className="admin-user-cell admin-tags-category-cell">
              {tag.categoryIcon ? <span>{tag.categoryIcon}</span> : null}
              <strong>{tag.categoryLabel}</strong>
            </div>
            <span className="admin-user-cell admin-tags-code-cell">{tag.categoryCode}</span>
            <span className="admin-user-cell admin-tags-count-cell">{tag.liveCount || 0} directos</span>
            <span className="admin-user-cell admin-tags-count-cell">{tag.animeCount || 0} animes</span>
            <span className={`admin-user-status ${tag.isManual ? "is-warning" : "is-active"}`}>
              {tag.isManual ? "Manual" : "Por regla"}
            </span>
            <span className="admin-user-cell admin-tags-rule-cell" title={getRuleDescription(tag)}>{getRuleDescription(tag)}</span>
            <div className="admin-user-actions">
              {canUpdate ? (
                <Tooltip label="Editar tag">
                  <button type="button" className="icon-tool-button" aria-label="Editar tag" onClick={() => openEditTag(tag)}>
                    <Edit3 size={17} />
                  </button>
                </Tooltip>
              ) : null}
              {canUpdate && tag.isManual ? (
                <Tooltip label={`Restaurar por regla: ${tag.automaticCategoryLabel || "categoría calculada"}`}>
                  <button
                    type="button"
                    className="icon-tool-button"
                    aria-label="Usar categoría por regla"
                    onClick={() => setRestoringTag(tag)}
                    disabled={isSaving}
                  >
                    <RotateCcw size={17} />
                  </button>
                </Tooltip>
              ) : null}
              {canDelete ? (
                <Tooltip label={(tag.liveCount || 0) + (tag.animeCount || 0) > 0 ? "No se puede eliminar: el tag tiene registros asociados" : "Eliminar tag"}>
                  <button
                    type="button"
                    className="icon-tool-button danger"
                    aria-label="Eliminar tag"
                    onClick={() => setDeletingTag(tag)}
                    disabled={isSaving || ((tag.liveCount || 0) + (tag.animeCount || 0) > 0)}
                  >
                    <Trash2 size={17} />
                  </button>
                </Tooltip>
              ) : null}
            </div>
          </div>
        ))}
      </MaintainerTable>

      {editingTag ? (
        <MaintainerModal
          className="admin-modal tag-category-create-modal"
          title="Editar tag"
          subtitle={editingTag.name}
          onClose={() => setEditingTag(null)}
          actions={(
            <>
              <button type="button" className="btn-modal btn-modal-secondary" onClick={() => setEditingTag(null)} disabled={isSaving}>
                Cancelar
              </button>
              <button type="button" className="btn-modal btn-modal-primary" onClick={saveTagCategory} disabled={isSaving}>
                {isSaving ? "Guardando..." : "Guardar cambios"}
              </button>
            </>
          )}
        >
          <div className="form-group-modal">
            <label>Categoría</label>
            <FormSelect
              id="admin-tag-category"
              label="Categoría"
              value={nextCategory}
              options={editCategoryOptions}
              onChange={setNextCategory}
            />
          </div>
          <p className="admin-modal-help">
            Por regla usaría {editingTag.automaticCategoryLabel || "la categoría calculada"} según keywords y coincidencias del sistema. Manual fija el tag en la categoría seleccionada.
          </p>
        </MaintainerModal>
      ) : null}

      {isCategoryModalOpen ? (
        <MaintainerModal
          as="form"
          className="admin-modal tag-category-create-modal"
          title={editingCategory ? "Editar categoría" : "Nueva categoría"}
          subtitle={editingCategory ? "Actualiza reglas y presentación de la categoría." : "Crea una categoría personalizada para agrupar tags."}
          onClose={() => setIsCategoryModalOpen(false)}
          noValidate
          onSubmit={createCategory}
          actions={(
            <>
              <button type="button" className="btn-modal btn-modal-secondary" onClick={() => setIsCategoryModalOpen(false)} disabled={isSaving}>
                Cancelar
              </button>
              <button type="submit" className="btn-modal btn-modal-primary" disabled={isSaving}>
                {isSaving ? "Guardando..." : editingCategory ? "Guardar cambios" : "Crear categoría"}
              </button>
            </>
          )}
        >
          <div className="form-row">
            <div className="form-group-modal">
              <label>Nombre</label>
              <input
                type="text"
                className="modal-input"
                maxLength={40}
                value={categoryDraft.label}
                onChange={(event) => {
                  setCategoryDraft((current) => ({ ...current, label: event.target.value }));
                  setCategoryError("");
                }}
              />
            </div>
            <div className="form-group-modal">
              <label>Icono</label>
              <input
                type="text"
                className="modal-input"
                maxLength={4}
                value={categoryDraft.icon}
                onChange={(event) => setCategoryDraft((current) => ({ ...current, icon: event.target.value }))}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group-modal">
              <label>Coincidencias exactas</label>
              <textarea
                className="modal-input modal-textarea"
                value={categoryDraft.exactText}
                onChange={(event) => setCategoryDraft((current) => ({ ...current, exactText: event.target.value }))}
                placeholder="dragonballz&#10;worldtrigger"
              />
              <p className="field-hint">Una por línea o separadas por coma. Coincidencia completa con el tag normalizado.</p>
            </div>
            <div className="form-group-modal">
              <label>Keywords</label>
              <textarea
                className="modal-input modal-textarea"
                value={categoryDraft.keywordsText}
                onChange={(event) => setCategoryDraft((current) => ({ ...current, keywordsText: event.target.value }))}
                placeholder="bleach&#10;naruto&#10;frieren"
              />
              <p className="field-hint">Una por línea o separadas por coma. Se aplican cuando el tag contiene la palabra.</p>
            </div>
          </div>
          {categoryError ? <p className="tag-category-error">{categoryError}</p> : null}
        </MaintainerModal>
      ) : null}

      <ConfirmModal
        isOpen={Boolean(restoringTag)}
        title="Restaurar asignación por regla"
        description={`${restoringTag?.name || "Este tag"} dejará de usar la categoría manual “${restoringTag?.categoryLabel || "actual"}” y volverá a “${restoringTag?.automaticCategoryLabel || "la categoría calculada"}”. Los cambios futuros en las reglas podrán modificar su categoría automáticamente.`}
        confirmLabel="Restaurar por regla"
        cancelLabel="Cancelar"
        tone="primary"
        isLoading={isSaving}
        onCancel={() => setRestoringTag(null)}
        onConfirm={confirmRestoreAutomaticCategory}
      />

      <ConfirmModal
        isOpen={Boolean(deletingTag)}
        title="Eliminar tag"
        description={`${deletingTag?.name || "Este tag"} no tiene directos ni animes asociados. Se eliminará definitivamente y esta acción no se puede deshacer.`}
        confirmLabel="Sí, eliminar"
        cancelLabel="Cancelar"
        tone="danger"
        isLoading={isSaving}
        onCancel={() => setDeletingTag(null)}
        onConfirm={confirmDeleteTag}
      />

      <ConfirmModal
        isOpen={Boolean(deletingCategory)}
        title="Eliminar categoría"
        description={`${deletingCategory?.label || "Esta categoría"} se eliminará si no tiene tags asociados.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        tone="danger"
        isLoading={isSaving}
        onCancel={() => setDeletingCategory(null)}
        onConfirm={confirmDeleteCategory}
      />

      <AuditLogModal
        isOpen={isAuditOpen}
        module="admin.tags"
        title="Historial de tags"
        subtitle="Últimas acciones realizadas en el mantenedor de tags."
        onClose={() => setIsAuditOpen(false)}
      />
    </>
  );
}
