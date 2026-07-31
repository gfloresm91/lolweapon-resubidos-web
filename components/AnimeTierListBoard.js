"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toPng } from "html-to-image";
import { AlertTriangle, ArrowDown, ArrowDownAZ, ArrowUp, Copy, Download, Edit3, Eye, EyeOff, Info, Music2, Play, Plus, RotateCcw, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import AnimePosterImage from "@/components/AnimePosterImage";
import AniListSearchModal from "@/components/AniListSearchModal";
import ConfirmModal from "@/components/ConfirmModal";
import { FilterSelect } from "@/components/FiltersBar";
import FormSelect from "@/components/FormSelect";
import MaintainerModal from "@/components/MaintainerModal";

const AnimeImageDropzone = dynamic(() => import("@/components/AnimeImageDropzone"), { ssr: false });

function getPosterStatus(imageFile, imageUrl) {
  if (imageFile) return "Nueva imagen local seleccionada";
  if (imageUrl) return imageUrl.startsWith("/") ? "Imagen local guardada" : "Imagen externa";
  return "Sin imagen";
}

async function uploadThemeImage(file) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/upload", { method: "POST", body: formData });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    throw new Error(data?.error || "No se pudo subir la imagen.");
  }
  return data.path;
}

function stepSequence(value, delta) {
  return String(Math.max(1, (parseInt(value, 10) || 0) + delta));
}

const TIER_COLOR_PRESETS = [
  "#d64545", "#e08a3c", "#d4b23c", "#4caf6e", "#3d9e91",
  "#3f8fd1", "#6f7fd6", "#7c6fd6", "#c26bab", "#748094",
];
const AUTOSAVE_DELAY_MS = 1200;
const SEASON_LABELS = { WINTER: "Invierno", SPRING: "Primavera", SUMMER: "Verano", FALL: "Otoño" };

async function readJson(response) {
  return response.json().catch(() => ({}));
}

function seasonLabel(season) {
  return `${SEASON_LABELS[season.season] || season.season} ${season.year}${season.status === "active" ? " · activa" : ""}`;
}

function normalizeRosterItem(kind, item) {
  if (kind === "animes") {
    return {
      id: item.id,
      entryId: null,
      title: item.title,
      imageUrl: item.imageUrl,
      badge: null,
      isAdult: item.isAdult,
      isDonghua: item.isDonghua,
      isSpoiler: false,
      isHidden: item.isHidden,
      videoUrl: null,
      alternateVideoUrl: null,
      songTitle: null,
    };
  }
  return {
    id: item.id,
    entryId: item.tierListEntryId,
    aniListId: item.aniListId ?? null,
    title: item.animeTitle,
    imageUrl: item.imageUrl,
    badge: item.sequence,
    isAdult: item.isAdult,
    isDonghua: item.isDonghua,
    isSpoiler: item.isSpoiler,
    isHidden: item.isHidden,
    videoUrl: item.videoUrl,
    alternateVideoUrl: item.alternateVideoUrl || null,
    songTitle: item.songTitle,
    artist: item.artist,
    manualType: item.manualType || "",
    rawType: item.type,
    rawSequence: item.rawSequence,
    manualSequence: item.manualSequence,
    rawVideoUrl: item.rawVideoUrl,
    manualVideoUrl: item.manualVideoUrl,
    rawSongTitle: item.rawSongTitle,
    manualSongTitle: item.manualSongTitle,
    rawArtist: item.rawArtist,
    manualArtist: item.manualArtist,
    manualIsAdult: item.manualIsAdult ?? null,
    manualIsDonghua: item.manualIsDonghua ?? null,
    manualVisible: item.manualVisible,
    isManual: Boolean(item.isManual),
  };
}

function applySequenceBadges(roster) {
  const visibleCounts = new Map();
  for (const item of roster) {
    if (item.entryId == null || item.isHidden) continue;
    visibleCounts.set(item.entryId, (visibleCounts.get(item.entryId) || 0) + 1);
  }
  return roster.map((item) => (
    item.entryId != null && (visibleCounts.get(item.entryId) || 0) <= 1 ? { ...item, badge: null } : item
  ));
}

function passesFilters(item, filters, canManageThemes = false) {
  if (item.isSpoiler && !filters.showSpoiler) return false;
  if (item.isManual && !filters.showManual) return false;
  if (item.isAdult) return filters.showAdult;
  if (item.isDonghua) return filters.showDonghua;
  if (item.isManual && canManageThemes) return true;
  return filters.showDefault;
}

function passesEntryFilters(entry, filters, canManageThemes = false) {
  if (entry.isHidden) return filters.showHiddenByAdmin;
  return passesFilters(entry, filters, canManageThemes);
}

function buildContainers(roster, tiers, placements, filters, canManageThemes = false) {
  const itemsById = new Map(roster.map((item) => [item.id, item]));
  const placedIds = new Set(placements.map((placement) => placement.itemId));
  const containers = { _pool: [] };
  for (const tier of tiers) containers[tier.key] = [];

  for (const placement of placements) {
    const item = itemsById.get(placement.itemId);
    if (!item) continue;
    const tierKey = placement.tierKey && containers[placement.tierKey] ? placement.tierKey : null;
    if (item.isHidden) {
      // Ya rankeado en una fila: se mantiene visible con overlay pase lo que pase.
      if (tierKey) { containers[tierKey].push(placement.itemId); continue; }
      // Solo en el pool: se muestra si se activó "Mostrar ocultos" (admin/streamer).
      if (filters.showHiddenByAdmin) containers._pool.push(placement.itemId);
      continue;
    }
    if (!passesFilters(item, filters, canManageThemes)) continue;
    containers[tierKey || "_pool"].push(placement.itemId);
  }

  for (const item of roster) {
    if (placedIds.has(item.id)) continue;
    if (item.isHidden) {
      if (filters.showHiddenByAdmin) containers._pool.push(item.id);
      continue;
    }
    if (!passesFilters(item, filters, canManageThemes)) continue;
    containers._pool.push(item.id);
  }

  return { containers, itemsById };
}

function computeContentCounts(roster, filters, canManageThemes = false) {
  const counts = { default: 0, adult: 0, donghua: 0, spoiler: 0, manual: 0, hiddenByPreferences: 0, hiddenByAdmin: 0 };
  for (const item of roster) {
    if (item.isHidden) { counts.hiddenByAdmin += 1; continue; }
    if (item.isAdult) counts.adult += 1;
    else if (item.isDonghua) counts.donghua += 1;
    else counts.default += 1;
    if (item.isSpoiler) counts.spoiler += 1;
    if (item.isManual) counts.manual += 1;
    if (!passesFilters(item, filters, canManageThemes)) counts.hiddenByPreferences += 1;
  }
  return counts;
}

const DEFAULT_FILTERS = { showDefault: true, showAdult: false, showDonghua: false, showSpoiler: true, showManual: true, showHiddenByAdmin: false };

function collisionDetectionStrategy(args) {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  return rectIntersection(args);
}

function TierListSkeleton() {
  return (
    <div className="tierlist-skeleton" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div className="tierlist-skeleton-row" key={index}>
          <div className="skeleton-block tierlist-skeleton-label" />
          <div className="tierlist-skeleton-drop">
            {Array.from({ length: 3 }).map((__, cardIndex) => (
              <div className="skeleton-block tierlist-skeleton-card" key={cardIndex} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function extractYouTubeId(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") return parsed.pathname.slice(1) || null;
    if (parsed.hostname.includes("youtube.com")) {
      if (parsed.pathname === "/watch") return parsed.searchParams.get("v");
      const match = parsed.pathname.match(/^\/(embed|shorts)\/([^/]+)/);
      if (match) return match[2];
    }
  } catch {
    return null;
  }
  return null;
}

function extractDriveFileId(url) {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("drive.google.com")) return null;
    const match = parsed.pathname.match(/\/file\/d\/([^/]+)/);
    if (match) return match[1];
    return parsed.searchParams.get("id");
  } catch {
    return null;
  }
}

function isOneDriveEmbedUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "1drv.ms" || parsed.hostname.endsWith(".onedrive.live.com") || parsed.hostname === "onedrive.live.com";
  } catch {
    return false;
  }
}

function resolveVideoEmbed(url) {
  if (!url) return null;
  const youTubeId = extractYouTubeId(url);
  if (youTubeId) return { type: "youtube", embedUrl: `https://www.youtube.com/embed/${youTubeId}` };
  const driveId = extractDriveFileId(url);
  if (driveId) return { type: "drive", embedUrl: `https://drive.google.com/file/d/${driveId}/preview` };
  if (isOneDriveEmbedUrl(url)) return { type: "onedrive", embedUrl: url };
  return { type: "video", embedUrl: url };
}

function loadStoredFilters(kind) {
  if (typeof window === "undefined") return DEFAULT_FILTERS;
  try {
    const raw = window.localStorage.getItem(`tierlist-filters-v2-${kind}`);
    return raw ? { ...DEFAULT_FILTERS, ...JSON.parse(raw) } : DEFAULT_FILTERS;
  } catch {
    return DEFAULT_FILTERS;
  }
}

function ItemCard({ item, onOpen, isOverlay = false, canManageThemes = false, onEditItem, onDuplicate, onToggleVisibility }) {
  const sortable = useSortable({ id: item.id, disabled: isOverlay });
  const style = isOverlay ? undefined : {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };

  return (
    <div
      ref={isOverlay ? undefined : sortable.setNodeRef}
      style={style}
      className={`tierlist-card ${item.isHidden ? "is-hidden-by-admin" : ""} ${sortable.isDragging ? "is-dragging" : ""}`}
      {...(isOverlay ? {} : sortable.attributes)}
      {...(isOverlay ? {} : sortable.listeners)}
      onClick={() => item.videoUrl && onOpen?.(item)}
      role={item.videoUrl ? "button" : undefined}
      title={item.title}
    >
      <div className="tierlist-card-media">
        <AnimePosterImage src={item.imageUrl} title={item.title} className="tierlist-card-poster" decorative />
        {item.badge ? <span className="tierlist-card-badge">{item.badge}</span> : null}
        {item.isAdult || item.isDonghua ? (
          <div className="tierlist-card-flags">
            {item.isAdult ? <span className="tierlist-card-flag is-adult">18+</span> : null}
            {item.isDonghua ? <span className="tierlist-card-flag is-donghua">Donghua</span> : null}
          </div>
        ) : null}
        {item.videoUrl ? <span className="tierlist-card-play"><Play size={22} /></span> : null}
        {item.isHidden ? <span className="tierlist-card-hidden-flag">Oculto por administración</span> : null}
      </div>
      <span className="tierlist-card-title">{item.title}</span>
      {canManageThemes ? (
        <div className="tierlist-card-actions">
          <button
            type="button"
            className="icon-tool-button"
            aria-label="Editar tema"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => { event.stopPropagation(); onEditItem?.(item); }}
          >
            <Edit3 size={14} />
          </button>
          <button
            type="button"
            className="icon-tool-button"
            aria-label="Duplicar tema"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => { event.stopPropagation(); onDuplicate?.(item); }}
          >
            <Copy size={14} />
          </button>
          <button
            type="button"
            className={`icon-tool-button ${item.isHidden ? "" : "danger"}`}
            aria-label={item.isHidden ? "Mostrar tema" : "Ocultar tema"}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => { event.stopPropagation(); onToggleVisibility?.(item); }}
          >
            {item.isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function TierRow({ tier, itemIds, itemsById, onOpenItem, onRename, onOpenColorPicker, onDelete, onMove, canMoveUp, canMoveDown, canManageThemes, onEditItem, onDuplicate, onToggleVisibility }) {
  const { setNodeRef } = useDroppable({ id: tier.key });
  const [isEditingLabel, setIsEditingLabel] = useState(false);

  return (
    <div className="tierlist-row">
      <div className="tierlist-row-label" style={{ backgroundColor: tier.color }}>
        {isEditingLabel ? (
          <input
            className="tierlist-row-label-input"
            defaultValue={tier.label}
            autoFocus
            maxLength={40}
            onBlur={(event) => { onRename(tier.key, event.target.value); setIsEditingLabel(false); }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") setIsEditingLabel(false);
            }}
          />
        ) : (
          <button type="button" onClick={() => setIsEditingLabel(true)} title="Renombrar fila">{tier.label}</button>
        )}
      </div>

      <div ref={setNodeRef} className={`tierlist-row-drop ${itemIds.length ? "" : "is-empty"}`}>
        {itemIds.length ? null : <span className="tierlist-row-empty-hint">Arrastra aquí tus animes</span>}
        <SortableContext items={itemIds} strategy={rectSortingStrategy}>
          {itemIds.map((itemId) => {
            const item = itemsById.get(itemId);
            if (!item) return null;
            return (
              <ItemCard
                key={itemId}
                item={item}
                onOpen={onOpenItem}
                canManageThemes={canManageThemes}
                onEditItem={onEditItem}
                onDuplicate={onDuplicate}
                onToggleVisibility={onToggleVisibility}
              />
            );
          })}
        </SortableContext>
      </div>

      <div className="tierlist-row-actions">
        <button type="button" className="icon-tool-button" aria-label="Subir fila" disabled={!canMoveUp} onClick={() => onMove(tier.key, -1)}><ArrowUp size={16} /></button>
        <button type="button" className="icon-tool-button" aria-label="Bajar fila" disabled={!canMoveDown} onClick={() => onMove(tier.key, 1)}><ArrowDown size={16} /></button>
        <button type="button" className="icon-tool-button" aria-label="Cambiar color" onClick={() => onOpenColorPicker(tier)}>
          <span className="tierlist-color-dot" style={{ backgroundColor: tier.color }} />
        </button>
        <button type="button" className="icon-tool-button danger" aria-label="Eliminar fila" onClick={() => onDelete(tier.key)}>
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

function TierColorModal({ tier, onClose, onChange }) {
  const [customColor, setCustomColor] = useState(tier?.color || "#8b5cf6");

  useEffect(() => {
    if (tier) setCustomColor(tier.color);
  }, [tier]);

  if (!tier) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content tierlist-color-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close-button" aria-label="Cerrar" onClick={onClose}><X size={18} /></button>
        <h2 className="modal-title">Color de la fila</h2>
        <p className="field-hint">Elige un color predefinido o crea uno personalizado.</p>

        <div className="tierlist-color-presets">
          {TIER_COLOR_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              className={`tierlist-color-swatch ${tier.color?.toLowerCase() === color ? "is-selected" : ""}`}
              style={{ backgroundColor: color }}
              aria-label={`Usar color ${color}`}
              onClick={() => onChange(color)}
            />
          ))}
        </div>

        <div className="tierlist-color-custom">
          <label htmlFor="tierlist-custom-color">Personalizado</label>
          <div className="tierlist-color-custom-row">
            <input
              id="tierlist-custom-color"
              type="color"
              value={customColor}
              onChange={(event) => { setCustomColor(event.target.value); onChange(event.target.value); }}
            />
            <input
              type="text"
              className="modal-input"
              value={customColor}
              maxLength={7}
              onChange={(event) => setCustomColor(event.target.value)}
              onBlur={(event) => {
                if (/^#[0-9a-fA-F]{6}$/.test(event.target.value)) onChange(event.target.value);
              }}
            />
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-modal btn-modal-primary" onClick={onClose}>Listo</button>
        </div>
      </div>
    </div>
  );
}

export default function AnimeTierListBoard({ kind, title, highlight, subtitle, isAuthenticated, viewToggle, role = "invitado" }) {
  const [seasons, setSeasons] = useState([]);
  const [seasonId, setSeasonId] = useState("");
  const [roster, setRoster] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [placements, setPlacements] = useState([]);
  const [isPublic, setIsPublic] = useState(false);
  const [shareToken, setShareToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [openItem, setOpenItem] = useState(null);
  const [videoError, setVideoError] = useState(false);
  const [videoSource, setVideoSource] = useState("primary");
  const [canManageThemes, setCanManageThemes] = useState(false);
  const [entriesWithoutTheme, setEntriesWithoutTheme] = useState([]);
  const [showEntriesWithoutTheme, setShowEntriesWithoutTheme] = useState(false);
  const [isCreateThemeOpen, setIsCreateThemeOpen] = useState(false);
  const [isAniListSearchOpen, setIsAniListSearchOpen] = useState(false);
  const [createSelectedAnime, setCreateSelectedAnime] = useState(null);
  const [createThemeType, setCreateThemeType] = useState(kind === "ed" ? "ED" : "OP");
  const [createSequence, setCreateSequence] = useState("1");
  const [createIsAdultOverride, setCreateIsAdultOverride] = useState("");
  const [createIsDonghuaOverride, setCreateIsDonghuaOverride] = useState("");
  const [duplicateSourceItemId, setDuplicateSourceItemId] = useState(null);
  const [createImageFile, setCreateImageFile] = useState(null);
  const [createImageError, setCreateImageError] = useState("");
  const [createImagePreviewUrl, setCreateImagePreviewUrl] = useState("");
  const [editingThemeItem, setEditingThemeItem] = useState(null);
  const [editManualType, setEditManualType] = useState("");
  const [editSequence, setEditSequence] = useState("1");
  const [editSequenceTouched, setEditSequenceTouched] = useState(false);
  const [editIsAdultOverride, setEditIsAdultOverride] = useState("");
  const [editIsDonghuaOverride, setEditIsDonghuaOverride] = useState("");
  const [isEditOverrideOpen, setIsEditOverrideOpen] = useState(false);
  const [editImageFile, setEditImageFile] = useState(null);
  const [editImageError, setEditImageError] = useState("");
  const [editImagePreviewUrl, setEditImagePreviewUrl] = useState("");
  const [isEditAniListSearchOpen, setIsEditAniListSearchOpen] = useState(false);
  const [pendingDeleteTheme, setPendingDeleteTheme] = useState(null);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [pendingDeleteTier, setPendingDeleteTier] = useState(null);
  const [colorPickerTier, setColorPickerTier] = useState(null);
  const [poolSearch, setPoolSearch] = useState("");
  const [filters, setFilters] = useState(() => loadStoredFilters(kind));
  const exportRef = useRef(null);
  const autosaveTimer = useRef(null);
  const isFirstLoad = useRef(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const { containers, itemsById } = useMemo(
    () => buildContainers(roster, tiers, placements, filters, canManageThemes),
    [roster, tiers, placements, filters, canManageThemes],
  );

  const contentCounts = useMemo(() => computeContentCounts(roster, filters, canManageThemes), [roster, filters, canManageThemes]);

  const visibleEntriesWithoutTheme = useMemo(
    () => entriesWithoutTheme.filter((entry) => passesEntryFilters(entry, filters, canManageThemes)),
    [entriesWithoutTheme, filters, canManageThemes],
  );

  const poolItemIds = useMemo(() => {
    const ids = containers._pool || [];
    const query = poolSearch.trim().toLowerCase();
    if (!query) return ids;
    return ids.filter((id) => itemsById.get(id)?.title?.toLowerCase().includes(query));
  }, [containers, poolSearch, itemsById]);

  const loadBoard = useCallback(async (nextSeasonId, { silent = false } = {}) => {
    if (!silent) setIsLoading(true);
    try {
      const query = new URLSearchParams({ kind });
      if (nextSeasonId) query.set("seasonId", nextSeasonId);
      const response = await fetch(`/api/anime-tier-list?${query.toString()}`, { cache: "no-store" });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || "No se pudo cargar el tier list.");
      setSeasons(data.seasons || []);
      setSeasonId(String(data.season?.id || ""));
      setRoster(applySequenceBadges((data.roster || []).map((item) => normalizeRosterItem(kind, item))));
      setTiers(data.tiers || []);
      setPlacements(data.placements || []);
      setIsPublic(data.isPublic || false);
      setShareToken(data.shareToken || null);
      setCanManageThemes(Boolean(data.canManageThemes));
      setEntriesWithoutTheme(data.entriesWithoutTheme || []);
      return data;
    } catch (error) {
      toast.error(error.message);
      return null;
    } finally {
      if (!silent) setIsLoading(false);
      isFirstLoad.current = true;
    }
  }, [kind]);

  useEffect(() => { loadBoard(); }, [loadBoard]);

  useEffect(() => {
    window.localStorage.setItem(`tierlist-filters-v2-${kind}`, JSON.stringify(filters));
  }, [kind, filters]);

  useEffect(() => {
    setVideoError(false);
    setVideoSource("primary");
  }, [openItem?.id]);

  useEffect(() => {
    setEditIsAdultOverride(editingThemeItem?.manualIsAdult == null ? "" : String(editingThemeItem.manualIsAdult));
    setEditIsDonghuaOverride(editingThemeItem?.manualIsDonghua == null ? "" : String(editingThemeItem.manualIsDonghua));
    if (editingThemeItem?.isManual) {
      setEditManualType(editingThemeItem.rawType || "OP");
      setEditSequence(String(editingThemeItem.rawSequence || 1));
    } else {
      setEditManualType(editingThemeItem?.manualType || "");
      setEditSequence(String(editingThemeItem?.manualSequence || editingThemeItem?.rawSequence || 1));
      setEditSequenceTouched(false);
      setIsEditOverrideOpen(Boolean(
        editingThemeItem?.manualType
        || editingThemeItem?.manualSequence
        || editingThemeItem?.manualVideoUrl
        || editingThemeItem?.manualSongTitle
        || editingThemeItem?.manualArtist,
      ));
    }
    setEditImageFile(null);
    setEditImageError("");
  }, [editingThemeItem]);

  useEffect(() => {
    if (!createImageFile) {
      setCreateImagePreviewUrl("");
      return undefined;
    }
    const objectUrl = URL.createObjectURL(createImageFile);
    setCreateImagePreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [createImageFile]);

  useEffect(() => {
    if (!editImageFile) {
      setEditImagePreviewUrl("");
      return undefined;
    }
    const objectUrl = URL.createObjectURL(editImageFile);
    setEditImagePreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [editImageFile]);

  const serializedPlacements = useMemo(() => (
    tiers.flatMap((tier) => (containers[tier.key] || []).map((itemId, index) => ({ itemId, tierKey: tier.key, position: index })))
      .concat((containers._pool || []).map((itemId, index) => ({ itemId, tierKey: null, position: index })))
  ), [tiers, containers]);

  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    if (isFirstLoad.current) { isFirstLoad.current = false; return; }

    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(async () => {
      try {
        await fetch("/api/anime-tier-list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save",
            kind,
            seasonId,
            tiers: tiers.map((tier) => ({ key: tier.key, label: tier.label, color: tier.color })),
            placements: serializedPlacements,
          }),
        });
      } catch {
        toast.error("No se pudo guardar tu tier list.");
      }
    }, AUTOSAVE_DELAY_MS);

    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiers, serializedPlacements]);

  function findContainerKey(itemId) {
    return Object.keys(containers).find((key) => containers[key].includes(itemId));
  }

  function handleDragStart(event) {
    setActiveId(event.active.id);
  }

  function handleDragOver(event) {
    const { active, over } = event;
    if (!over) return;
    const activeContainer = findContainerKey(active.id);
    const overContainer = containers[over.id] ? over.id : findContainerKey(over.id);
    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    setPlacements((current) => {
      const next = current.filter((placement) => placement.itemId !== active.id);
      const insertAt = next.filter((placement) => (placement.tierKey ?? "_pool") === overContainer).length;
      next.splice(insertAt, 0, { itemId: active.id, tierKey: overContainer === "_pool" ? null : overContainer });
      return next;
    });
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeContainer = findContainerKey(active.id);
    const overContainer = containers[over.id] ? over.id : findContainerKey(over.id);
    if (!activeContainer || !overContainer) return;

    const items = containers[overContainer];
    const oldIndex = items.indexOf(active.id);
    const newIndex = items.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

    const reordered = arrayMove(items, oldIndex, newIndex);
    setPlacements((current) => {
      const withoutContainer = current.filter((placement) => (placement.tierKey ?? "_pool") !== overContainer);
      const containerPlacements = reordered.map((itemId) => ({
        itemId,
        tierKey: overContainer === "_pool" ? null : overContainer,
      }));
      return [...withoutContainer, ...containerPlacements];
    });
  }

  function addTier() {
    const key = `tier-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setTiers((current) => [...current, { key, label: "Nueva fila", color: TIER_COLOR_PRESETS[current.length % TIER_COLOR_PRESETS.length] }]);
    toast.success("Fila creada. Desplázate al final del tablero para verla.");
  }

  function renameTier(key, label) {
    if (!label.trim()) return;
    setTiers((current) => current.map((tier) => (tier.key === key ? { ...tier, label: label.trim().slice(0, 40) } : tier)));
  }

  function recolorTier(key, color) {
    setTiers((current) => current.map((tier) => (tier.key === key ? { ...tier, color } : tier)));
    setColorPickerTier((current) => (current?.key === key ? { ...current, color } : current));
  }

  function deleteTier(key) {
    setTiers((current) => current.filter((tier) => tier.key !== key));
    setPlacements((current) => current.map((placement) => (
      placement.tierKey === key ? { ...placement, tierKey: null } : placement
    )));
  }

  function requestDeleteTier(key) {
    const hasItems = (containers[key] || []).length > 0;
    if (!hasItems) {
      deleteTier(key);
      return;
    }
    setPendingDeleteTier(tiers.find((tier) => tier.key === key) || { key, label: "esta fila" });
  }

  function confirmDeleteTier() {
    if (!pendingDeleteTier) return;
    deleteTier(pendingDeleteTier.key);
    setPendingDeleteTier(null);
  }

  function moveTier(key, direction) {
    setTiers((current) => {
      const index = current.findIndex((tier) => tier.key === key);
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }

  function requestReset() {
    const hasRankedAnimes = tiers.some((tier) => (containers[tier.key] || []).length > 0);
    if (!hasRankedAnimes) {
      handleReset();
      return;
    }
    setIsResetOpen(true);
  }

  async function handleReset() {
    setIsResetOpen(false);
    try {
      await fetch("/api/anime-tier-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset", kind, seasonId }),
      });
      await loadBoard(seasonId);
      toast.success("Tier list reiniciado.");
    } catch {
      toast.error("No se pudo reiniciar el tier list.");
    }
  }

  async function handleTogglePublic() {
    try {
      const response = await fetch("/api/anime-tier-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-public", kind, seasonId, isPublic: !isPublic }),
      });
      const data = await readJson(response);
      if (!response.ok || !data.success) throw new Error(data.error);
      setIsPublic(data.isPublic);
      setShareToken(data.shareToken);
      toast.success(data.isPublic ? "Tier list publicado." : "Tier list vuelto a privado.");
    } catch (error) {
      toast.error(error.message || "No se pudo cambiar la visibilidad.");
    }
  }

  function copyShareLink() {
    if (!shareToken) return;
    const url = `${window.location.origin}/biblioteca-anime/tier-list/compartido/${shareToken}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado.");
  }

  async function exportImage() {
    if (!exportRef.current) return;
    try {
      const dataUrl = await toPng(exportRef.current, { backgroundColor: "#0f0f14", pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = `tier-list-${kind}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      toast.error("No se pudo exportar la imagen.");
    }
  }

  const activeVideoUrl = videoSource === "alternate" ? openItem?.alternateVideoUrl : openItem?.videoUrl;
  const videoEmbed = activeVideoUrl ? resolveVideoEmbed(activeVideoUrl) : null;
  const triggerThemeLabel = `Agregar ${kind === "ed" ? "ending" : "opening"} manual`;
  const createThemeLabel = `Agregar ${createThemeType === "ED" ? "ending" : "opening"} manual`;

  function switchVideoSource(source) {
    setVideoSource(source);
    setVideoError(false);
  }

  function openCreateTheme() {
    setCreateSelectedAnime(null);
    setCreateThemeType(kind === "ed" ? "ED" : "OP");
    setIsAniListSearchOpen(true);
  }

  function selectCreateAnime(metadata) {
    setIsAniListSearchOpen(false);
    setCreateSelectedAnime({ aniListId: metadata.providerId, title: metadata.title, image: metadata.image });
    setCreateSequence("1");
    setCreateIsAdultOverride("");
    setCreateIsDonghuaOverride("");
    setDuplicateSourceItemId(null);
    setIsCreateThemeOpen(true);
  }

  function openCreateThemeForEntry(entry) {
    if (entry.aniListId) {
      setCreateSelectedAnime({ aniListId: entry.aniListId, title: entry.title, image: entry.imageUrl });
      setCreateIsAdultOverride(entry.manualIsAdult == null ? "" : String(entry.manualIsAdult));
      setCreateIsDonghuaOverride(entry.manualIsDonghua == null ? "" : String(entry.manualIsDonghua));
    } else {
      setCreateSelectedAnime({ isManual: true, title: entry.title, isAdult: entry.isAdult, isDonghua: entry.isDonghua });
      setCreateIsAdultOverride("");
      setCreateIsDonghuaOverride("");
    }
    setCreateThemeType(kind === "ed" ? "ED" : "OP");
    setCreateSequence("1");
    setDuplicateSourceItemId(null);
    setIsCreateThemeOpen(true);
  }

  function duplicateTheme(item) {
    const currentSequence = item.manualSequence ?? item.rawSequence ?? 0;
    if (item.aniListId) {
      setCreateSelectedAnime({ aniListId: item.aniListId, title: item.title, image: item.imageUrl });
      setCreateIsAdultOverride(item.manualIsAdult == null ? "" : String(item.manualIsAdult));
      setCreateIsDonghuaOverride(item.manualIsDonghua == null ? "" : String(item.manualIsDonghua));
    } else {
      setCreateSelectedAnime({ isManual: true, title: item.title, isAdult: item.isAdult, isDonghua: item.isDonghua });
      setCreateIsAdultOverride("");
      setCreateIsDonghuaOverride("");
    }
    setCreateThemeType(kind === "ed" ? "ED" : "OP");
    setCreateSequence(String(currentSequence + 1));
    setDuplicateSourceItemId(item.id);
    setIsCreateThemeOpen(true);
  }

  function sortPoolAlphabetically() {
    const poolIds = containers._pool || [];
    if (poolIds.length < 2) return;
    const sequenceOf = (item) => item?.manualSequence ?? item?.rawSequence ?? 0;
    const sorted = [...poolIds].sort((leftId, rightId) => {
      const left = itemsById.get(leftId);
      const right = itemsById.get(rightId);
      return (left?.title || "").localeCompare(right?.title || "") || sequenceOf(left) - sequenceOf(right);
    });
    const poolIdSet = new Set(poolIds);
    setPlacements((current) => [
      ...current.filter((placement) => !poolIdSet.has(placement.itemId)),
      ...sorted.map((itemId) => ({ itemId, tierKey: null })),
    ]);
    isFirstLoad.current = false;
  }

  function startManualAnimeEntry() {
    setIsAniListSearchOpen(false);
    setCreateSelectedAnime({ isManual: true });
    setCreateSequence("1");
    setDuplicateSourceItemId(null);
    setIsCreateThemeOpen(true);
  }

  function closeCreateTheme() {
    setIsCreateThemeOpen(false);
    setCreateSelectedAnime(null);
    setCreateImageFile(null);
    setCreateImageError("");
    setDuplicateSourceItemId(null);
  }

  async function createTheme(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      action: "create-theme",
      kind,
      seasonId,
      type: createThemeType,
      sequence: form.get("sequence"),
      songTitle: form.get("songTitle"),
      artist: form.get("artist"),
      videoUrl: form.get("videoUrl"),
      alternateVideoUrl: form.get("alternateVideoUrl"),
    };
    if (createSelectedAnime?.isManual) {
      const animeTitle = String(form.get("animeTitle") || "").trim();
      if (!animeTitle) {
        toast.error("Escribe el título del anime.");
        return;
      }
      payload.animeTitle = animeTitle;
      payload.animeIsAdult = form.get("animeIsAdult") === "on";
      payload.animeIsDonghua = form.get("animeIsDonghua") === "on";
    } else if (createSelectedAnime?.aniListId) {
      payload.aniListId = createSelectedAnime.aniListId;
      payload.animeIsAdultOverride = createIsAdultOverride;
      payload.animeIsDonghuaOverride = createIsDonghuaOverride;
    } else {
      toast.error("Busca y selecciona un anime en AniList.");
      return;
    }
    try {
      if (createImageFile) {
        payload.animeImageUrl = await uploadThemeImage(createImageFile);
      }
      const response = await fetch("/api/anime-tier-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readJson(response);
      if (!response.ok || !data.success) throw new Error(data.error);
      setIsCreateThemeOpen(false);
      setCreateSelectedAnime(null);
      setCreateImageFile(null);
      const boardData = await loadBoard(seasonId, { silent: true });
      if (duplicateSourceItemId && data.theme?.id && boardData) {
        const freshPlacements = boardData.placements || [];
        const sourceIndex = freshPlacements.findIndex((placement) => placement.itemId === duplicateSourceItemId);
        if (sourceIndex !== -1) {
          const sourcePlacement = freshPlacements[sourceIndex];
          const next = freshPlacements.filter((placement) => placement.itemId !== data.theme.id);
          next.splice(sourceIndex + 1, 0, { itemId: data.theme.id, tierKey: sourcePlacement.tierKey });
          isFirstLoad.current = false;
          setPlacements(next);
        }
      }
      setDuplicateSourceItemId(null);
      toast.success("Opening/Ending agregado.");
    } catch (error) {
      toast.error(error.message || "No se pudo agregar el tema.");
    }
  }

  async function saveEditTheme(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      action: "update-theme",
      kind,
      id: editingThemeItem.id,
      alternateVideoUrl: form.get("alternateVideoUrl"),
    };
    if (!editingThemeItem.aniListId) {
      payload.manualEntryIsAdult = form.get("animeIsAdult") === "on";
      payload.manualEntryIsDonghua = form.get("animeIsDonghua") === "on";
    } else {
      payload.manualEntryIsAdultOverride = editIsAdultOverride;
      payload.manualEntryIsDonghuaOverride = editIsDonghuaOverride;
    }
    if (editingThemeItem.isManual) {
      payload.type = editManualType;
      payload.sequence = form.get("manualSequence");
      payload.videoUrl = form.get("manualVideoUrl");
      payload.songTitle = form.get("songTitle");
      payload.artist = form.get("artist");
      payload.manualEntryTitle = form.get("manualEntryTitle");
    } else {
      payload.manualType = isEditOverrideOpen ? editManualType : "";
      payload.manualSequence = isEditOverrideOpen
        ? (editSequenceTouched ? form.get("manualSequence") : (editingThemeItem.manualSequence ?? ""))
        : "";
      payload.manualVideoUrl = isEditOverrideOpen ? form.get("manualVideoUrl") : "";
      payload.manualSongTitle = isEditOverrideOpen ? form.get("manualSongTitle") : "";
      payload.manualArtist = isEditOverrideOpen ? form.get("manualArtist") : "";
    }
    try {
      if (editImageFile) {
        payload.manualEntryImageUrl = await uploadThemeImage(editImageFile);
      }
      const response = await fetch("/api/anime-tier-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readJson(response);
      if (!response.ok || !data.success) throw new Error(data.error);
      setEditingThemeItem(null);
      await loadBoard(seasonId, { silent: true });
      toast.success("Tema actualizado.");
    } catch (error) {
      toast.error(error.message || "No se pudo editar el tema.");
    }
  }

  async function applyEditAniListMetadata(metadata) {
    setIsEditAniListSearchOpen(false);
    if (!editingThemeItem) return;
    try {
      const response = await fetch("/api/anime-tier-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "relink-entry", kind, entryId: editingThemeItem.entryId, aniListId: metadata.providerId }),
      });
      const data = await readJson(response);
      if (!response.ok || !data.success) throw new Error(data.error);
      setEditingThemeItem((current) => (current ? { ...current, title: data.entry.title, imageUrl: data.entry.imageUrl, aniListId: data.entry.aniListId } : current));
      setEditIsAdultOverride("");
      setEditIsDonghuaOverride("");
      setEditImageFile(null);
      await loadBoard(seasonId, { silent: true });
      toast.success("Ficha de AniList actualizada.");
    } catch (error) {
      toast.error(error.message || "No se pudo cambiar la ficha de AniList.");
    }
  }

  function handleToggleVisibility(item) {
    if (item.isHidden) {
      restoreTheme(item.id);
    } else {
      setPendingDeleteTheme(item);
    }
  }

  async function restoreTheme(id) {
    try {
      const response = await fetch("/api/anime-tier-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore-theme", kind, id }),
      });
      const data = await readJson(response);
      if (!response.ok || !data.success) throw new Error(data.error);
      await loadBoard(seasonId, { silent: true });
      toast.success("Tema visible de nuevo.");
    } catch (error) {
      toast.error(error.message || "No se pudo mostrar el tema.");
    }
  }

  async function hideTheme() {
    if (!pendingDeleteTheme) return;
    try {
      const response = await fetch("/api/anime-tier-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete-theme", kind, id: pendingDeleteTheme.id }),
      });
      const data = await readJson(response);
      if (!response.ok || !data.success) throw new Error(data.error);
      setPendingDeleteTheme(null);
      await loadBoard(seasonId, { silent: true });
      toast.success("Tema oculto.");
    } catch (error) {
      toast.error(error.message || "No se pudo ocultar el tema.");
    }
  }

  return (
    <main className="tierlist-page">
      <header className="watching-header">
        <h1 className="title">{title} <span className="text-gradient">{highlight}</span></h1>
        <p className="subtitle">{subtitle}</p>
      </header>

      <div className="tierlist-mobile-notice rtfm-notice-panel">
        <div className="rtfm-notice is-info">
          <Info size={18} aria-hidden="true" />
          <p>Por factibilidad técnica, esta página solo está disponible desde tablet en adelante. Entra desde una pantalla más grande para armar tu tier list.</p>
        </div>
      </div>

      <div className="tierlist-desktop-only">
      <section className="tierlist-toolbar" aria-label="Controles del tier list">
        <div className="tierlist-toolbar-top">
          {seasons.length ? (
            <div className="season-calendar-season-field">
              <span>Temporada</span>
              <FilterSelect
                id={`tierlist-${kind}-season`}
                label="Temporada"
                value={seasonId}
                options={seasons.map((season) => ({ value: String(season.id), label: seasonLabel(season) }))}
                onChange={(value) => loadBoard(value)}
              />
            </div>
          ) : null}

          <div className="tierlist-toolbar-actions">
            <button type="button" className="tracker-action-primary" onClick={addTier}><Plus size={16} /> Fila</button>
            <button type="button" className="tracker-action-secondary" onClick={requestReset}><RotateCcw size={16} /> Reiniciar</button>
            <button type="button" className="tracker-action-secondary" onClick={exportImage}><Download size={16} /> Imagen</button>
            {isAuthenticated ? (
              <button type="button" className="tracker-action-secondary" onClick={handleTogglePublic}>{isPublic ? "Hacer privado" : "Compartir"}</button>
            ) : null}
            {isPublic && shareToken ? (
              <button type="button" className="tracker-action-secondary" onClick={copyShareLink}><Copy size={16} /> Copiar link</button>
            ) : null}
          </div>
        </div>

        {seasons.length ? (
          <>
            <div className="season-calendar-toggles">
              <button
                type="button"
                className={`season-calendar-toggle ${filters.showDefault ? "is-active" : ""}`}
                aria-pressed={filters.showDefault}
                onClick={() => setFilters((current) => ({ ...current, showDefault: !current.showDefault }))}
              >
                Mostrar general ({contentCounts.default})
              </button>
              {kind !== "animes" ? (
                <button
                  type="button"
                  className={`season-calendar-toggle ${filters.showSpoiler ? "is-active" : ""}`}
                  aria-pressed={filters.showSpoiler}
                  onClick={() => setFilters((current) => ({ ...current, showSpoiler: !current.showSpoiler }))}
                >
                  Mostrar con spoilers ({contentCounts.spoiler})
                </button>
              ) : null}
              <button
                type="button"
                className={`season-calendar-toggle ${filters.showAdult ? "is-active" : ""}`}
                aria-pressed={filters.showAdult}
                onClick={() => setFilters((current) => ({ ...current, showAdult: !current.showAdult }))}
              >
                Mostrar adulto ({contentCounts.adult})
              </button>
              <button
                type="button"
                className={`season-calendar-toggle ${filters.showDonghua ? "is-active" : ""}`}
                aria-pressed={filters.showDonghua}
                onClick={() => setFilters((current) => ({ ...current, showDonghua: !current.showDonghua }))}
              >
                Mostrar donghua ({contentCounts.donghua})
              </button>
              {canManageThemes ? (
                <button
                  type="button"
                  className={`season-calendar-toggle ${filters.showHiddenByAdmin ? "is-active" : ""}`}
                  aria-pressed={filters.showHiddenByAdmin}
                  onClick={() => setFilters((current) => ({ ...current, showHiddenByAdmin: !current.showHiddenByAdmin }))}
                >
                  Mostrar ocultos ({contentCounts.hiddenByAdmin})
                </button>
              ) : null}
              {canManageThemes && kind !== "animes" ? (
                <button
                  type="button"
                  className={`season-calendar-toggle ${showEntriesWithoutTheme ? "is-active" : ""}`}
                  aria-pressed={showEntriesWithoutTheme}
                  onClick={() => setShowEntriesWithoutTheme((current) => !current)}
                >
                  Sin tema ({entriesWithoutTheme.length})
                </button>
              ) : null}
              {canManageThemes && kind !== "animes" ? (
                <button
                  type="button"
                  className={`season-calendar-toggle ${filters.showManual ? "is-active" : ""}`}
                  aria-pressed={filters.showManual}
                  onClick={() => setFilters((current) => ({ ...current, showManual: !current.showManual }))}
                >
                  Mostrar manuales ({contentCounts.manual})
                </button>
              ) : null}
            </div>
            <p className="season-calendar-summary" aria-live="polite">
              {contentCounts.hiddenByPreferences
                ? `${contentCounts.hiddenByPreferences} ocultos por tus preferencias`
                : "Todo el contenido disponible está visible"}
            </p>
          </>
        ) : null}
      </section>

      {canManageThemes && showEntriesWithoutTheme ? (
        <div className="tierlist-pool">
          <div className="tierlist-pool-header">
            <h2>Sin tema <span className="tierlist-pool-count">({entriesWithoutTheme.length})</span></h2>
          </div>
          {entriesWithoutTheme.length ? (
            visibleEntriesWithoutTheme.length ? (
              <div className="tierlist-row-drop tierlist-pool-drop">
                {visibleEntriesWithoutTheme.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className="tierlist-card is-add-action"
                    onClick={() => openCreateThemeForEntry(entry)}
                    title={`Agregar ${kind === "ed" ? "ending" : "opening"} para ${entry.title}`}
                  >
                    <div className="tierlist-card-media">
                      <AnimePosterImage src={entry.imageUrl} title={entry.title} className="tierlist-card-poster" decorative />
                      {entry.isAdult || entry.isDonghua ? (
                        <div className="tierlist-card-flags">
                          {entry.isAdult ? <span className="tierlist-card-flag is-adult">18+</span> : null}
                          {entry.isDonghua ? <span className="tierlist-card-flag is-donghua">Donghua</span> : null}
                        </div>
                      ) : null}
                      <span className="tierlist-card-play"><Plus size={22} /></span>
                    </div>
                    <span className="tierlist-card-title">{entry.title}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="field-hint">{entriesWithoutTheme.length} ocultos por tus preferencias de filtro.</p>
            )
          ) : (
            <p className="field-hint">Todos los animes de esta temporada ya tienen {kind === "ed" ? "ending" : "opening"} cargado.</p>
          )}
        </div>
      ) : null}

      {viewToggle ? (
        <div className="season-calendar-view-switch-row">{viewToggle}</div>
      ) : null}

      {!isAuthenticated ? (
        <div className="rtfm-notice-panel">
          <div className="rtfm-notice is-warning">
            <AlertTriangle size={18} aria-hidden="true" />
            <p>
              Estás jugando sin sesión: puedes armar tu tier list, pero no se guardará.{" "}
              <a href="/login">Inicia sesión</a> para conservarlo.
            </p>
          </div>
        </div>
      ) : null}

      {role === "invitado" || role === "publico" ? (
        <div className="rtfm-notice-panel">
          <div className="rtfm-notice is-info">
            <Info size={18} aria-hidden="true" />
            <p>
              Este acceso es posiblemente temporal: más adelante los Tier Lists podrían quedar
              disponibles solo para los tiers de pago del Twitch de Kala. No se encariñen mucho.
            </p>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <TierListSkeleton />
      ) : !seasons.length ? (
        <p className="field-hint">Todavía no hay temporadas sincronizadas. Un administrador debe sincronizar una temporada desde el mantenedor correspondiente.</p>
      ) : (
        <div className="tierlist-board">
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetectionStrategy}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="tierlist-rows" ref={exportRef}>
              {tiers.map((tier, index) => (
                <TierRow
                  key={tier.key}
                  tier={tier}
                  itemIds={containers[tier.key] || []}
                  itemsById={itemsById}
                  onOpenItem={setOpenItem}
                  onRename={renameTier}
                  onOpenColorPicker={setColorPickerTier}
                  onDelete={requestDeleteTier}
                  onMove={moveTier}
                  canMoveUp={index > 0}
                  canMoveDown={index < tiers.length - 1}
                  canManageThemes={canManageThemes}
                  onEditItem={setEditingThemeItem}
                  onDuplicate={duplicateTheme}
                  onToggleVisibility={handleToggleVisibility}
                />
              ))}
            </div>

            <div className="tierlist-pool">
              <div className="tierlist-pool-header">
                <h2>Sin rankear <span className="tierlist-pool-count">({containers._pool.length})</span></h2>
                <div className="tierlist-pool-header-actions">
                  <div className="tierlist-pool-buttons">
                    {canManageThemes ? (
                      <button type="button" className="tracker-action-secondary" onClick={openCreateTheme}>
                        <Plus size={16} /> {triggerThemeLabel}
                      </button>
                    ) : null}
                    <button type="button" className="tracker-action-secondary" onClick={sortPoolAlphabetically}>
                      <ArrowDownAZ size={16} /> Ordenar alfabéticamente
                    </button>
                  </div>
                  <label className="tierlist-pool-search">
                    <Search size={15} aria-hidden="true" />
                    <input
                      type="text"
                      value={poolSearch}
                      onChange={(event) => setPoolSearch(event.target.value)}
                      placeholder="Buscar anime..."
                      aria-label="Buscar anime sin rankear"
                    />
                  </label>
                </div>
              </div>
              {poolSearch.trim() && !poolItemIds.length ? (
                <p className="field-hint">Ningún anime sin rankear coincide con "{poolSearch.trim()}".</p>
              ) : null}
              <PoolDroppable
                itemIds={poolItemIds}
                itemsById={itemsById}
                onOpenItem={setOpenItem}
                canManageThemes={canManageThemes}
                onEditItem={setEditingThemeItem}
                onDuplicate={duplicateTheme}
                onToggleVisibility={handleToggleVisibility}
              />
            </div>

            <DragOverlay>
              {activeId && itemsById.get(activeId) ? <ItemCard item={itemsById.get(activeId)} isOverlay /> : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}
      </div>

      <ConfirmModal
        isOpen={isResetOpen}
        title="Reiniciar tier list"
        description="Se borrarán tus filas personalizadas y todas las colocaciones de esta temporada. No se puede deshacer."
        confirmLabel="Reiniciar"
        cancelLabel="Cancelar"
        onCancel={() => setIsResetOpen(false)}
        onConfirm={handleReset}
      />

      <ConfirmModal
        isOpen={Boolean(pendingDeleteTier)}
        title="Eliminar fila"
        description={`Se eliminará la fila "${pendingDeleteTier?.label || ""}". Los animes que tenía volverán a Sin rankear, no se pierden.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onCancel={() => setPendingDeleteTier(null)}
        onConfirm={confirmDeleteTier}
      />

      <TierColorModal tier={colorPickerTier} onClose={() => setColorPickerTier(null)} onChange={(color) => recolorTier(colorPickerTier.key, color)} />

      <ConfirmModal
        isOpen={Boolean(pendingDeleteTheme)}
        title="Ocultar tema"
        description={`Se ocultará "${pendingDeleteTheme?.title || ""}"${pendingDeleteTheme?.badge ? ` #${pendingDeleteTheme.badge}` : ""}. Dejará de ofrecerse a usuarios nuevos; quienes ya lo tengan rankeado lo seguirán viendo marcado como oculto. Puedes volver a mostrarlo cuando quieras.`}
        confirmLabel="Ocultar"
        tone="default"
        cancelLabel="Cancelar"
        onCancel={() => setPendingDeleteTheme(null)}
        onConfirm={hideTheme}
      />

      {isCreateThemeOpen ? (
        <MaintainerModal
          as="form"
          title={createThemeLabel}
          subtitle="Úsalo cuando AnimeThemes.moe todavía no tenga indexado el tema."
          onClose={closeCreateTheme}
          onSubmit={createTheme}
          noValidate
          actions={<><button type="button" className="tracker-action-secondary" onClick={closeCreateTheme}>Cancelar</button><button type="submit" className="tracker-action-primary">Guardar</button></>}
        >
          <div className="notification-form-field">
            <span>Anime</span>
            {createSelectedAnime?.isManual ? (
              <input className="modal-input" name="animeTitle" placeholder="Título del anime" defaultValue={createSelectedAnime?.title || ""} required />
            ) : (
              <div className="tierlist-anime-picked">
                <AnimePosterImage src={createSelectedAnime?.image} title={createSelectedAnime?.title} className="admin-user-avatar" decorative />
                <strong>{createSelectedAnime?.title}</strong>
              </div>
            )}
            <button type="button" className="tracker-action-secondary" onClick={() => setIsAniListSearchOpen(true)}>
              {createSelectedAnime?.aniListId ? "Cambiar ficha AniList" : "Buscar en AniList"}
            </button>
          </div>
          {createSelectedAnime?.isManual ? (
            <div className="tierlist-content-flags">
              <label className="tierlist-content-flag"><input type="checkbox" name="animeIsAdult" defaultChecked={Boolean(createSelectedAnime?.isAdult)} /> Contenido adulto</label>
              <label className="tierlist-content-flag"><input type="checkbox" name="animeIsDonghua" defaultChecked={Boolean(createSelectedAnime?.isDonghua)} /> Donghua</label>
            </div>
          ) : (
            <div className="form-row">
              <div className="notification-form-field">
                <span>Contenido adulto</span>
                <FormSelect
                  value={createIsAdultOverride}
                  onChange={setCreateIsAdultOverride}
                  options={[{ value: "", label: "Usar fuente" }, { value: "true", label: "Sí" }, { value: "false", label: "No" }]}
                />
              </div>
              <div className="notification-form-field">
                <span>Donghua</span>
                <FormSelect
                  value={createIsDonghuaOverride}
                  onChange={setCreateIsDonghuaOverride}
                  options={[{ value: "", label: "Usar fuente" }, { value: "true", label: "Sí" }, { value: "false", label: "No" }]}
                />
              </div>
            </div>
          )}
          <div className="notification-form-field">
            <span>Poster (opcional)</span>
            <AnimeImageDropzone
              hasError={Boolean(createImageError)}
              onFile={(file) => { setCreateImageFile(file); setCreateImageError(""); }}
              onError={(error) => { setCreateImageFile(null); setCreateImageError(error); }}
            />
            <div className="anime-image-uploader-footer">
              <span>{getPosterStatus(createImageFile, createImagePreviewUrl || createSelectedAnime?.image)}</span>
              {createImageFile ? (
                <button type="button" className="profile-avatar-clear" onClick={() => { setCreateImageFile(null); setCreateImageError(""); }}>
                  Quitar imagen
                </button>
              ) : null}
            </div>
            {createImageError ? <span className="field-error">{createImageError}</span> : null}
          </div>
          <div className="form-row">
            <div className="notification-form-field">
              <span>Tipo</span>
              <FormSelect value={createThemeType} onChange={setCreateThemeType} options={[{ value: "OP", label: "Opening" }, { value: "ED", label: "Ending" }]} />
            </div>
            <div className="notification-form-field">
              <span>Número</span>
              <div className="anime-stepper">
                <button type="button" className="btn-step" onClick={() => setCreateSequence((value) => stepSequence(value, -1))}>-</button>
                <input type="text" inputMode="numeric" className="modal-input anime-number-input" name="sequence" value={createSequence} onChange={(event) => setCreateSequence(event.target.value)} required />
                <button type="button" className="btn-step" onClick={() => setCreateSequence((value) => stepSequence(value, 1))}>+</button>
              </div>
            </div>
          </div>
          <label className="notification-form-field"><span>Canción</span><input className="modal-input" name="songTitle" placeholder="Título de la canción" /></label>
          <label className="notification-form-field"><span>Artista</span><input className="modal-input" name="artist" placeholder="Artista o banda" /></label>
          <label className="notification-form-field"><span>Fuente principal</span><input className="modal-input" name="videoUrl" placeholder="https://..." required /></label>
          <label className="notification-form-field"><span>Fuente alternativa (opcional)</span><input className="modal-input" name="alternateVideoUrl" placeholder="YouTube o Drive, por si la fuente principal falla" /></label>
        </MaintainerModal>
      ) : null}

      <AniListSearchModal
        isOpen={isAniListSearchOpen}
        title="Buscar anime en AniList"
        subtitle="Busca el anime al que pertenece este opening/ending."
        emptyText="Busca en AniList para seleccionar una ficha o crea el anime manualmente."
        onClose={() => setIsAniListSearchOpen(false)}
        onSelectMetadata={selectCreateAnime}
        actions={<button type="button" className="btn-modal btn-modal-secondary" onClick={startManualAnimeEntry}>Crear manualmente</button>}
      />

      {editingThemeItem ? (
        <MaintainerModal
          as="form"
          title={`Editar tema · ${editingThemeItem.title}`}
          subtitle={editingThemeItem.isManual ? "Edita los datos del tema." : "Deja un campo vacío para volver a utilizar el valor de la fuente."}
          onClose={() => setEditingThemeItem(null)}
          onSubmit={saveEditTheme}
          noValidate
          actions={<><button type="button" className="tracker-action-secondary" onClick={() => setEditingThemeItem(null)}>Cancelar</button><button type="submit" className="tracker-action-primary">Guardar</button></>}
        >
          <span className={`tierlist-origin-badge ${editingThemeItem.isManual ? "is-manual" : "is-synced"}`}>
            {editingThemeItem.isManual ? "Creado manualmente" : "Sincronizado desde AnimeThemes.moe"}
          </span>
          <div className="notification-form-field">
            <span>Anime</span>
            <div className="tierlist-anime-picked">
              <AnimePosterImage src={editImagePreviewUrl || editingThemeItem.imageUrl} title={editingThemeItem.title} className="admin-user-avatar" decorative />
              <strong>{editingThemeItem.title}</strong>
            </div>
            <button type="button" className="tracker-action-secondary" onClick={() => setIsEditAniListSearchOpen(true)}>Cambiar ficha AniList</button>
          </div>
          {!editingThemeItem.aniListId ? (
            <div className="tierlist-content-flags">
              <label className="tierlist-content-flag"><input type="checkbox" name="animeIsAdult" defaultChecked={editingThemeItem.isAdult} /> Contenido adulto</label>
              <label className="tierlist-content-flag"><input type="checkbox" name="animeIsDonghua" defaultChecked={editingThemeItem.isDonghua} /> Donghua</label>
            </div>
          ) : (
            <div className="form-row">
              <div className="notification-form-field">
                <span>Contenido adulto</span>
                <FormSelect
                  value={editIsAdultOverride}
                  onChange={setEditIsAdultOverride}
                  options={[{ value: "", label: "Usar fuente" }, { value: "true", label: "Sí" }, { value: "false", label: "No" }]}
                />
              </div>
              <div className="notification-form-field">
                <span>Donghua</span>
                <FormSelect
                  value={editIsDonghuaOverride}
                  onChange={setEditIsDonghuaOverride}
                  options={[{ value: "", label: "Usar fuente" }, { value: "true", label: "Sí" }, { value: "false", label: "No" }]}
                />
              </div>
            </div>
          )}
          <div className="notification-form-field">
            <span>Poster</span>
            <AnimeImageDropzone
              hasError={Boolean(editImageError)}
              onFile={(file) => { setEditImageFile(file); setEditImageError(""); }}
              onError={(error) => { setEditImageFile(null); setEditImageError(error); }}
            />
            <div className="anime-image-uploader-footer">
              <span>{getPosterStatus(editImageFile, editingThemeItem.imageUrl)}</span>
              {editImageFile ? (
                <button type="button" className="profile-avatar-clear" onClick={() => { setEditImageFile(null); setEditImageError(""); }}>
                  Quitar imagen
                </button>
              ) : null}
            </div>
            {editImageError ? <span className="field-error">{editImageError}</span> : null}
          </div>
          {editingThemeItem.isManual ? (
            <>
              <label className="notification-form-field"><span>Título</span><input className="modal-input" name="manualEntryTitle" defaultValue={editingThemeItem.title || ""} placeholder="Título del anime" /></label>
              <div className="form-row">
                <div className="notification-form-field">
                  <span>Tipo</span>
                  <FormSelect value={editManualType} onChange={setEditManualType} options={[{ value: "OP", label: "Opening" }, { value: "ED", label: "Ending" }]} />
                </div>
                <div className="notification-form-field">
                  <span>Número</span>
                  <div className="anime-stepper">
                    <button type="button" className="btn-step" onClick={() => setEditSequence((value) => stepSequence(value, -1))}>-</button>
                    <input type="text" inputMode="numeric" className="modal-input anime-number-input" name="manualSequence" value={editSequence} onChange={(event) => setEditSequence(event.target.value)} required />
                    <button type="button" className="btn-step" onClick={() => setEditSequence((value) => stepSequence(value, 1))}>+</button>
                  </div>
                </div>
              </div>
              <label className="notification-form-field"><span>Canción</span><input className="modal-input" name="songTitle" defaultValue={editingThemeItem.songTitle || ""} placeholder="Título de la canción" /></label>
              <label className="notification-form-field"><span>Artista</span><input className="modal-input" name="artist" defaultValue={editingThemeItem.artist || ""} placeholder="Artista o banda" /></label>
              <label className="notification-form-field">
                <span>Fuente principal</span>
                <input className="modal-input" name="manualVideoUrl" defaultValue={editingThemeItem.rawVideoUrl || ""} required />
              </label>
              <label className="notification-form-field">
                <span>Fuente alternativa (opcional)</span>
                <input className="modal-input" name="alternateVideoUrl" defaultValue={editingThemeItem.alternateVideoUrl || ""} placeholder="YouTube o Drive" />
              </label>
            </>
          ) : (
            <>
              {isEditOverrideOpen ? (
                <>
                  <div className="form-row">
                    <div className="notification-form-field">
                      <span>Tipo</span>
                      <FormSelect
                        value={editManualType}
                        onChange={setEditManualType}
                        options={[{ value: "", label: "Usar fuente" }, { value: "OP", label: "Opening" }, { value: "ED", label: "Ending" }]}
                      />
                    </div>
                    <div className="notification-form-field">
                      <span>Número manual</span>
                      <div className="anime-stepper">
                        <button type="button" className="btn-step" onClick={() => { setEditSequenceTouched(true); setEditSequence((value) => stepSequence(value, -1)); }}>-</button>
                        <input type="text" inputMode="numeric" className="modal-input anime-number-input" name="manualSequence" value={editSequence} onChange={(event) => { setEditSequenceTouched(true); setEditSequence(event.target.value); }} />
                        <button type="button" className="btn-step" onClick={() => { setEditSequenceTouched(true); setEditSequence((value) => stepSequence(value, 1)); }}>+</button>
                      </div>
                    </div>
                  </div>
                  <label className="notification-form-field">
                    <span>Canción</span>
                    <input key="song-title-editable" className="modal-input" name="manualSongTitle" defaultValue={editingThemeItem.manualSongTitle || ""} placeholder={editingThemeItem.rawSongTitle || ""} />
                  </label>
                  <label className="notification-form-field">
                    <span>Artista</span>
                    <input key="artist-editable" className="modal-input" name="manualArtist" defaultValue={editingThemeItem.manualArtist || ""} placeholder={editingThemeItem.rawArtist || ""} />
                  </label>
                  <label className="notification-form-field">
                    <span>Fuente principal</span>
                    <input key="video-url-editable" className="modal-input" name="manualVideoUrl" defaultValue={editingThemeItem.manualVideoUrl || ""} placeholder={editingThemeItem.rawVideoUrl || "https://..."} />
                  </label>
                  <p className="field-help">Dejar vacío conserva el valor de la fuente para ese campo puntual; solo se guarda como override lo que escribas acá.</p>
                </>
              ) : (
                <>
                  <div className="form-row">
                    <div className="notification-form-field">
                      <span>Tipo</span>
                      <input className="modal-input" readOnly value={(editingThemeItem.manualType || editingThemeItem.rawType) === "ED" ? "Ending" : "Opening"} />
                    </div>
                    <div className="notification-form-field">
                      <span>Número</span>
                      <input className="modal-input" readOnly value={editingThemeItem.manualSequence || editingThemeItem.rawSequence || ""} />
                    </div>
                  </div>
                  <label className="notification-form-field">
                    <span>Canción</span>
                    <input key="song-title-readonly" className="modal-input" readOnly value={editingThemeItem.songTitle || ""} />
                  </label>
                  <label className="notification-form-field">
                    <span>Artista</span>
                    <input key="artist-readonly" className="modal-input" readOnly value={editingThemeItem.artist || ""} />
                  </label>
                  <label className="notification-form-field">
                    <span>Fuente principal</span>
                    <input key="video-url-readonly" className="modal-input" readOnly value={editingThemeItem.videoUrl || ""} />
                  </label>
                </>
              )}
              <label className="notification-form-field">
                <span>Fuente alternativa (opcional)</span>
                <input className="modal-input" name="alternateVideoUrl" defaultValue={editingThemeItem.alternateVideoUrl || ""} placeholder="YouTube o Drive" />
              </label>
              <button
                type="button"
                className="anime-library-advanced-toggle"
                onClick={() => {
                  if (isEditOverrideOpen) {
                    setEditManualType("");
                    setEditSequenceTouched(false);
                  }
                  setIsEditOverrideOpen((current) => !current);
                }}
              >
                {isEditOverrideOpen ? "Usar valores de la fuente" : "Personalizar estos campos"}
              </button>
            </>
          )}
        </MaintainerModal>
      ) : null}

      <AniListSearchModal
        isOpen={isEditAniListSearchOpen}
        title="Cambiar ficha AniList"
        subtitle="Busca el anime correcto; se actualizará el título y poster para todos los temas de este anime."
        onClose={() => setIsEditAniListSearchOpen(false)}
        onSelectMetadata={applyEditAniListMetadata}
      />

      {openItem ? (
        <div className="modal-backdrop">
          <div className="modal-content tierlist-video-modal" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close-button" aria-label="Cerrar" onClick={() => setOpenItem(null)}><X size={18} /></button>
            <h2 className="modal-title">{openItem.title}{openItem.badge ? ` — #${openItem.badge}` : ""}</h2>
            {openItem.songTitle ? (
              <p className="tierlist-video-song"><Music2 size={14} aria-hidden="true" /> {openItem.songTitle}</p>
            ) : null}
            {openItem.alternateVideoUrl ? (
              <div className="tracker-calendar-view-toggle tierlist-video-source-toggle" role="tablist" aria-label="Fuente del video">
                <button type="button" role="tab" aria-selected={videoSource === "primary"} className={videoSource === "primary" ? "is-active" : ""} onClick={() => switchVideoSource("primary")}>Fuente principal</button>
                <button type="button" role="tab" aria-selected={videoSource === "alternate"} className={videoSource === "alternate" ? "is-active" : ""} onClick={() => switchVideoSource("alternate")}>Fuente alternativa</button>
              </div>
            ) : null}
            {videoEmbed ? (
              videoError ? (
                <p className="field-hint tierlist-video-error">No se pudo cargar el video.</p>
              ) : videoEmbed.type === "video" ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video
                  key={`${openItem.id}-${videoSource}`}
                  src={videoEmbed.embedUrl}
                  poster={openItem.imageUrl || undefined}
                  controls
                  controlsList="nodownload"
                  onContextMenu={(event) => event.preventDefault()}
                  className="tierlist-video-player"
                  onError={() => setVideoError(true)}
                />
              ) : (
                <iframe
                  key={`${openItem.id}-${videoSource}`}
                  src={videoEmbed.embedUrl}
                  title={openItem.title}
                  className="tierlist-video-player tierlist-video-frame"
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen *"
                  allowFullScreen
                />
              )
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}

function PoolDroppable({ itemIds, itemsById, onOpenItem, canManageThemes, onEditItem, onDuplicate, onToggleVisibility }) {
  const { setNodeRef } = useDroppable({ id: "_pool" });
  return (
    <div ref={setNodeRef} className="tierlist-row-drop tierlist-pool-drop">
      <SortableContext items={itemIds} strategy={rectSortingStrategy}>
        {itemIds.map((itemId) => {
          const item = itemsById.get(itemId);
          if (!item) return null;
          return (
            <ItemCard
              key={itemId}
              item={item}
              onOpen={onOpenItem}
              canManageThemes={canManageThemes}
              onEditItem={onEditItem}
              onDuplicate={onDuplicate}
              onToggleVisibility={onToggleVisibility}
            />
          );
        })}
      </SortableContext>
    </div>
  );
}
