"use client";

import { useEffect, useMemo, useState } from "react";
import { Edit3, History, Plus, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";

import AniListSearchModal from "@/components/AniListSearchModal";
import { AnimeLibraryModal, AnimePosterPlaceholder, editableFields, getStatusLabel } from "@/components/AnimeLibraryPage";
import AuditLogModal from "@/components/AuditLogModal";
import ConfirmModal from "@/components/ConfirmModal";
import { FilterSelect } from "@/components/FiltersBar";
import MaintainerStats from "@/components/MaintainerStats";
import MaintainerTable from "@/components/MaintainerTable";
import MaintainerToolbar from "@/components/MaintainerToolbar";

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const COMPLETED_STATUSES = new Set(["completed", "paused", "pending", "dropped"]);
const EMPTY_ANIME = {
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
const MODE_CONFIG = {
  active: {
    title: "Mantenedor de anime en seguimiento",
    subtitle: "Administra los animes visibles en Viendo, sus capítulos y datos de biblioteca.",
    createLabel: "Agregar anime",
    emptyText: "No hay animes en seguimiento que coincidan con la búsqueda.",
    defaultWatchStatus: "watching",
    acceptsStatus: (status) => status === "watching" || status === "purchased",
  },
  completed: {
    title: "Mantenedor de anime terminados",
    subtitle: "Administra los animes terminados, pausados, pendientes o dropeados.",
    createLabel: "Nuevo anime terminado",
    emptyText: "No hay animes terminados que coincidan con la búsqueda.",
    defaultWatchStatus: "completed",
    acceptsStatus: (status) => COMPLETED_STATUSES.has(status),
  },
};
const ANIME_COLUMNS = [
  { key: "id", label: "ID", sortable: true },
  { key: "anime", label: "Anime", sortable: true },
  { key: "condition", label: "Seguimiento", sortable: true },
  { key: "progress", label: "Progreso", sortable: true },
  { key: "metadata", label: "Metadata", sortable: true },
  { key: "status", label: "Estado", sortable: true },
  { key: "actions", label: "Acciones" },
];

function getAnimeId(anime) {
  return anime?.id || anime?.key || "-";
}

function formatAnimeId(anime) {
  const id = getAnimeId(anime);
  return id === "-" ? "-" : `#${id}`;
}

function getAnimeTitle(anime) {
  return anime?.titleEs || anime?.title || anime?.tag || anime?.key || "Sin título";
}

function isModeAnime(anime, mode) {
  return MODE_CONFIG[mode].acceptsStatus(anime.watchStatus);
}

function getProgressDetails(anime) {
  const current = parseInt(anime.currentEpisode, 10) || 0;
  const total = parseInt(anime.episodes, 10) || 0;
  const purchased = String(anime.purchased || "").trim();
  const isFullSeason = anime.watchStatus === "purchased" || purchased.toUpperCase() === "ENTERA";

  return {
    watched: `Visto: ${current || 0}/${total || "?"}`,
    purchased: isFullSeason ? "Comprado: temporada entera" : `Comprado: ${purchased || 0}`,
  };
}

function getSortableValue(anime, key) {
  if (key === "id") {
    return getAnimeId(anime);
  }

  if (key === "progress") {
    return parseInt(anime.currentEpisode, 10) || 0;
  }

  if (key === "metadata") {
    return parseInt(anime.year, 10) || 0;
  }

  if (key === "condition") {
    return getStatusLabel(anime.watchStatus);
  }

  if (key === "status") {
    return anime.libraryEnabled === false ? 0 : 1;
  }

  return getAnimeTitle(anime).toLowerCase();
}

function buildCreateDraft(mode) {
  const watchStatus = MODE_CONFIG[mode].defaultWatchStatus;

  return {
    ...EMPTY_ANIME,
    watchStatus,
    purchased: watchStatus === "purchased" ? "ENTERA" : "0",
  };
}

function buildTagFromTitle(title) {
  return String(title || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .slice(0, 48);
}

function mergeUniqueAnimes(...animeGroups) {
  return Array.from(new Map(
    animeGroups.flat().map((anime) => [anime.key || anime.id, anime]),
  ).values());
}

async function uploadImage(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "No se pudo subir la imagen.");
  }

  return data.path;
}

export default function PlatformAnimeMaintainerPage({
  initialAnimes = [],
  mode = "active",
  canCreate = false,
  canUpdate = false,
  canDelete = false,
  formVariant = "full",
  onAnimesChange,
}) {
  const config = MODE_CONFIG[mode] || MODE_CONFIG.active;
  const [animes, setAnimes] = useState(initialAnimes);
  const [searchQuery, setSearchQuery] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [conditionFilter, setConditionFilter] = useState("all");
  const [resubidosFilter, setResubidosFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState({ key: "id", direction: "desc" });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [isCreateStartOpen, setIsCreateStartOpen] = useState(false);
  const [editingAnime, setEditingAnime] = useState(null);
  const [statusAnime, setStatusAnime] = useState(null);
  const [deleteAnime, setDeleteAnime] = useState(null);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(!initialAnimes.length);
  const modeAnimes = useMemo(() => animes.filter((anime) => isModeAnime(anime, mode)), [animes, mode]);
  const hiddenAnimes = useMemo(() => animes.filter((anime) => anime.libraryEnabled === false), [animes]);
  const allVisibleAndHiddenAnimes = useMemo(() => mergeUniqueAnimes(modeAnimes, hiddenAnimes), [hiddenAnimes, modeAnimes]);
  const statusOptions = useMemo(() => {
    const statuses = Array.from(new Set(allVisibleAndHiddenAnimes.map((anime) => anime.watchStatus).filter(Boolean)))
      .sort((left, right) => getStatusLabel(left).localeCompare(getStatusLabel(right), "es"));

    return [
      { value: "all", label: "Todas" },
      ...statuses.map((status) => ({ value: status, label: getStatusLabel(status) })),
    ];
  }, [allVisibleAndHiddenAnimes]);
  const filteredAnimes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const sourceAnimes = visibilityFilter === "hidden"
      ? hiddenAnimes
      : visibilityFilter === "all"
        ? allVisibleAndHiddenAnimes
        : modeAnimes;

    return sourceAnimes
      .filter((anime) => !query || [
        getAnimeId(anime),
        anime.key,
        anime.tag,
        anime.title,
        anime.titleEs,
        anime.year,
        anime.status,
        anime.format,
      ].some((value) => String(value || "").toLowerCase().includes(query)))
      .filter((anime) => {
        if (visibilityFilter === "visible") return anime.libraryEnabled !== false;
        if (visibilityFilter === "hidden") return anime.libraryEnabled === false;
        return true;
      })
      .filter((anime) => conditionFilter === "all" || anime.watchStatus === conditionFilter)
      .filter((anime) => {
        if (resubidosFilter === "with") return Number(anime.resubidosCount || 0) > 0;
        if (resubidosFilter === "without") return Number(anime.resubidosCount || 0) === 0;
        return true;
      })
      .sort((left, right) => {
        const leftValue = getSortableValue(left, sortConfig.key);
        const rightValue = getSortableValue(right, sortConfig.key);
        const direction = sortConfig.direction === "asc" ? 1 : -1;

        if (typeof leftValue === "number" && typeof rightValue === "number") {
          return (leftValue - rightValue) * direction;
        }

        return String(leftValue).localeCompare(String(rightValue), "es", { numeric: true }) * direction;
      });
  }, [allVisibleAndHiddenAnimes, conditionFilter, hiddenAnimes, modeAnimes, resubidosFilter, searchQuery, sortConfig.direction, sortConfig.key, visibilityFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredAnimes.length / pageSize));
  const paginatedAnimes = filteredAnimes.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const paginationFrom = filteredAnimes.length ? ((currentPage - 1) * pageSize) + 1 : 0;
  const paginationTo = Math.min(currentPage * pageSize, filteredAnimes.length);
  const stats = useMemo(() => ({
    total: allVisibleAndHiddenAnimes.length,
    visible: modeAnimes.filter((anime) => anime.libraryEnabled !== false).length,
    withResubidos: allVisibleAndHiddenAnimes.filter((anime) => Number(anime.resubidosCount || 0) > 0).length,
  }), [allVisibleAndHiddenAnimes, modeAnimes]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, visibilityFilter, conditionFilter, resubidosFilter]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (initialAnimes.length) {
      setIsLoading(false);
      return undefined;
    }

    let isMounted = true;

    async function loadAnimes() {
      setIsLoading(true);
      try {
        const response = await fetch("/api/anime-library", { cache: "no-store" });
        const data = await response.json();

        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }

        if (!response.ok || !data.animes) {
          throw new Error(data.error || "No se pudo cargar la biblioteca de anime.");
        }

        if (isMounted) {
          setAnimes(data.animes || []);
          onAnimesChange?.(data.animes || []);
        }
      } catch (error) {
        toast.error(error.message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadAnimes();

    return () => {
      isMounted = false;
    };
  }, [initialAnimes.length, onAnimesChange]);

  function toggleSort(key) {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  function updateAnimes(nextAnimes) {
    setAnimes(nextAnimes);
    onAnimesChange?.(nextAnimes);
  }

  function openCreateFromMetadata(metadata) {
    const draft = {
      ...buildCreateDraft(mode),
      ...metadata,
      tag: buildTagFromTitle(metadata.title),
      titleEs: "",
      watchStatus: MODE_CONFIG[mode].defaultWatchStatus,
      purchased: MODE_CONFIG[mode].defaultWatchStatus === "purchased" ? "ENTERA" : "0",
      currentEpisode: "0",
      libraryEnabled: true,
    };

    setIsCreateStartOpen(false);
    setEditingAnime(draft);
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
        window.location.href = "/login";
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo guardar el anime.");
      }

      updateAnimes(data.animes || []);
      setEditingAnime(null);
      toast.success(form.key ? "Anime actualizado." : "Anime creado.");
    } catch (error) {
      toast.error(error.message || "No se pudo guardar el anime.");
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmStatusChange() {
    if (!statusAnime || !canUpdate) {
      return;
    }

    setIsSaving(true);

    try {
      const anime = {};
      for (const field of editableFields) {
        anime[field] = statusAnime[field];
      }
      anime.libraryEnabled = statusAnime.libraryEnabled === false;

      const response = await fetch("/api/anime-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upsert", key: statusAnime.key, anime }),
      });
      const data = await response.json();

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo cambiar el estado del anime.");
      }

      updateAnimes(data.animes || []);
      setStatusAnime(null);
      toast.success(statusAnime.libraryEnabled === false ? "Anime restaurado." : "Anime ocultado.");
    } catch (error) {
      toast.error(error.message || "No se pudo cambiar el estado del anime.");
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteAnime || !canDelete) {
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/anime-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", key: deleteAnime.key }),
      });
      const data = await response.json();

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo eliminar el anime.");
      }

      updateAnimes(data.animes || []);
      setDeleteAnime(null);
      toast.success("Anime eliminado definitivamente.");
    } catch (error) {
      toast.error(error.message || "No se pudo eliminar el anime.");
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
          {mode === "completed" ? "Anime" : "Anime en"} <span className="text-gradient">{mode === "completed" ? "terminados" : "seguimiento"}</span>
        </h1>
        <p className="subtitle">{config.subtitle}</p>
      </header>

      <MaintainerStats
        items={[
          { label: "Registros", value: stats.total, color: "purple" },
          { label: "Visibles", value: stats.visible, color: "green" },
          { label: "Con resubidos", value: stats.withResubidos, color: "blue" },
        ]}
      />

      <section className="tracker-actions" aria-label="Acciones de anime">
        <div>
          <span className="tracker-actions-label">Biblioteca de anime</span>
          <p className="tracker-actions-copy">{config.title}</p>
        </div>
        <div className="tracker-actions-buttons">
          <button type="button" className="tracker-action-secondary tracker-action-history" onClick={() => setIsAuditOpen(true)}>
            <History size={17} />
            Historial
          </button>
          {canCreate ? (
            <button type="button" className="tracker-action-primary" onClick={() => setIsCreateStartOpen(true)}>
              <Plus size={18} />
              {config.createLabel}
            </button>
          ) : null}
        </div>
      </section>

      <MaintainerToolbar
        searchId={`admin-anime-${mode}-search`}
        searchValue={searchQuery}
        searchPlaceholder="Buscar por ID, título, tag, año o estado"
        onSearchChange={setSearchQuery}
      >
        <FilterSelect
          id={`admin-anime-${mode}-condition-filter`}
          label="Condición"
          value={conditionFilter}
          options={statusOptions}
          onChange={setConditionFilter}
        />
        <FilterSelect
          id={`admin-anime-${mode}-resubidos-filter`}
          label="Resubidos"
          value={resubidosFilter}
          options={[
            { value: "all", label: "Todos" },
            { value: "with", label: "Con resubidos" },
            { value: "without", label: "Sin resubidos" },
          ]}
          onChange={setResubidosFilter}
        />
        <FilterSelect
          id={`admin-anime-${mode}-visibility-filter`}
          label="Estado"
          value={visibilityFilter}
          options={[
            { value: "all", label: "Todos" },
            { value: "visible", label: "Visibles" },
            { value: "hidden", label: "Ocultos" },
          ]}
          onChange={setVisibilityFilter}
        />
      </MaintainerToolbar>

      <MaintainerTable
        ariaLabel={config.title}
        className="admin-anime-table"
        columns={ANIME_COLUMNS}
        sortConfig={sortConfig}
        onSort={toggleSort}
        isLoading={isLoading}
        loadingText="Cargando biblioteca..."
        isEmpty={!filteredAnimes.length}
        emptyText={config.emptyText}
        pagination={{
          from: paginationFrom,
          to: paginationTo,
          total: filteredAnimes.length,
          canPrevious: currentPage > 1,
          canNext: currentPage < totalPages,
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
        {paginatedAnimes.map((anime) => (
          <div className="maintainer-table-row admin-anime-row" role="row" key={anime.key}>
            <span className="admin-user-cell admin-record-id">{formatAnimeId(anime)}</span>
            <div className="admin-user-cell admin-anime-profile">
              {anime.image ? (
                <img src={anime.image} alt="" />
              ) : (
                <AnimePosterPlaceholder title={getAnimeTitle(anime)} className="admin-anime-placeholder" />
              )}
              <div>
                <strong>{getAnimeTitle(anime)}</strong>
                <span>{anime.tag || anime.key ? `Código: ${anime.tag || anime.key}` : "Sin código"}</span>
              </div>
            </div>
            <span className={`anime-library-status status-${anime.watchStatus || "pending"}`}>
              {getStatusLabel(anime.watchStatus)}
            </span>
            <div className="admin-user-cell admin-anime-summary">
              <strong>{getProgressDetails(anime).watched}</strong>
              <small>{getProgressDetails(anime).purchased}</small>
            </div>
            <div className="admin-user-cell admin-anime-summary">
              <strong>{anime.year || "Sin año"}</strong>
              <small>{[anime.format, anime.status].filter(Boolean).join(" · ") || "Sin metadata"}</small>
            </div>
            <span className={`admin-user-status ${anime.libraryEnabled === false ? "is-inactive" : "is-active"}`}>
              {anime.libraryEnabled === false ? "Oculto" : "Visible"}
            </span>
            <div className="admin-user-actions">
              {canUpdate ? (
                <button
                  type="button"
                  className="icon-tool-button"
                  aria-label="Editar anime"
                  onClick={() => setEditingAnime(anime)}
                >
                  <Edit3 size={17} />
                </button>
              ) : null}
              {canUpdate ? (
                <button
                  type="button"
                  className="icon-tool-button"
                  aria-label={anime.libraryEnabled === false ? "Mostrar anime" : "Ocultar anime"}
                  onClick={() => setStatusAnime(anime)}
                  disabled={isSaving}
                >
                  <Power size={17} />
                </button>
              ) : null}
              {canDelete ? (
                <button
                  type="button"
                  className="icon-tool-button danger"
                  aria-label="Eliminar anime"
                  onClick={() => setDeleteAnime(anime)}
                  disabled={isSaving}
                >
                  <Trash2 size={17} />
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </MaintainerTable>

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
              setEditingAnime(buildCreateDraft(mode));
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
        canDelete={false}
        formVariant={formVariant}
        onClose={() => setEditingAnime(null)}
        onSave={saveAnimeMetadata}
        onDelete={() => {}}
      />

      <ConfirmModal
        isOpen={Boolean(statusAnime)}
        title={statusAnime?.libraryEnabled === false ? "Mostrar anime" : "Ocultar anime"}
        description={statusAnime?.libraryEnabled === false
          ? `${getAnimeTitle(statusAnime)} volverá a estar visible en la biblioteca correspondiente.`
          : `${getAnimeTitle(statusAnime)} quedará oculto sin eliminar su metadata.`}
        confirmLabel={statusAnime?.libraryEnabled === false ? "Mostrar" : "Ocultar"}
        cancelLabel="Cancelar"
        tone={statusAnime?.libraryEnabled === false ? "default" : "danger"}
        isLoading={isSaving}
        onCancel={() => setStatusAnime(null)}
        onConfirm={confirmStatusChange}
      />

      <ConfirmModal
        isOpen={Boolean(deleteAnime)}
        title="Eliminar anime"
        description={`${getAnimeTitle(deleteAnime)} será eliminado definitivamente del mantenedor, la biblioteca y sus enlaces de metadata. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        tone="danger"
        isLoading={isSaving}
        onCancel={() => setDeleteAnime(null)}
        onConfirm={confirmDelete}
      />

      <AuditLogModal
        isOpen={isAuditOpen}
        module={mode === "completed" ? "admin.anime.completed" : "admin.anime.tracking"}
        title={mode === "completed" ? "Historial de terminados" : "Historial de viendo"}
        subtitle={`Últimas acciones realizadas en ${config.title.toLowerCase()}.`}
        onClose={() => setIsAuditOpen(false)}
      />
    </>
  );
}
