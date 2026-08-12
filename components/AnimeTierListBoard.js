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
import { AlertTriangle, ArrowDown, ArrowDownAZ, ArrowUp, Copy, Download, Edit3, Eye, EyeOff, FileEdit, Globe, Info, Music2, Play, Plus, RotateCcw, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import AnimePosterImage from "@/components/AnimePosterImage";
import AniListSearchModal from "@/components/AniListSearchModal";
import ConfirmModal from "@/components/ConfirmModal";
import { FilterSelect } from "@/components/FiltersBar";
import FormSelect from "@/components/FormSelect";
import MaintainerModal from "@/components/MaintainerModal";
import VideoSourcesField from "@/components/VideoSourcesField";

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
      isNsfw: false,
      isHidden: item.isHidden,
      videoUrl: null,
      primarySourceLabel: null,
      alternateVideoUrls: [],
      songTitle: null,
    };
  }
  return {
    id: item.id,
    entryId: item.tierListEntryId,
    aniListId: item.aniListId ?? null,
    title: item.animeTitle,
    rawTitle: item.rawAnimeTitle || "",
    manualTitle: item.manualAnimeTitle ?? null,
    imageUrl: item.imageUrl,
    badge: item.sequence,
    isAdult: item.isAdult,
    isDonghua: item.isDonghua,
    isNsfw: item.isNsfw,
    isHidden: item.isHidden,
    isEntryHidden: Boolean(item.isEntryHidden),
    isDeletedByAdmin: Boolean(item.isDeletedByAdmin),
    isDraft: Boolean(item.isDraft),
    videoUrl: item.videoUrl,
    primarySourceLabel: item.primarySourceLabel || null,
    alternateVideoUrls: Array.isArray(item.alternateVideoUrls) ? item.alternateVideoUrls : [],
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
  const siblingCounts = new Map();
  for (const item of roster) {
    if (item.entryId == null) continue;
    siblingCounts.set(item.entryId, (siblingCounts.get(item.entryId) || 0) + 1);
  }
  return roster.map((item) => {
    const hasSiblings = item.entryId != null && (siblingCounts.get(item.entryId) || 0) > 1;
    const hasMeaningfulSequence = item.badge != null && item.badge > 1;
    return hasSiblings || hasMeaningfulSequence ? item : { ...item, badge: null };
  });
}

function passesFilters(item, filters, canManageThemes = false) {
  // Modo revisión: aísla una sola categoría. Los interruptores de "ocultar" siguen aplicando
  // encima (salvo el que sería contradictorio con el propio modo activo), para poder combinar
  // por ejemplo "Solo manuales" + "Ocultar adulto".
  if (filters.focusMode) {
    const matchesFocus = {
      adult: () => Boolean(item.isAdult),
      donghua: () => Boolean(item.isDonghua),
      manual: () => canManageThemes && Boolean(item.isManual),
      synced: () => canManageThemes && !item.isManual,
    }[filters.focusMode]?.() ?? true;
    if (!matchesFocus) return false;
  }
  if (filters.focusMode !== "adult" && item.isAdult && filters.hideAdult) return false;
  if (filters.focusMode !== "donghua" && item.isDonghua && filters.hideDonghua) return false;
  return true;
}

function passesEntryFilters(entry, filters, canManageThemes = false) {
  if (entry.isHidden) return filters.showHiddenByAdmin;
  return passesFilters(entry, filters, canManageThemes);
}

function buildBoardContainers(roster, tiers, placements, filters, canManageThemes = false) {
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
      if (tierKey) containers[tierKey].push(placement.itemId);
      continue;
    }
    if (!passesFilters(item, filters, canManageThemes)) continue;
    containers[tierKey || "_pool"].push(placement.itemId);
  }

  for (const item of roster) {
    if (placedIds.has(item.id)) continue;
    if (item.isHidden) continue;
    if (!passesFilters(item, filters, canManageThemes)) continue;
    containers._pool.push(item.id);
  }

  return { containers, itemsById };
}

// Sin tema/Borradores/Ocultos son mutuamente excluyentes: un tema eliminado prevalece sobre
// un borrador. A propósito NO depende de "placements": rankear o mover algo no cambia si es
// oculto/borrador, así que separarlo evita recalcular esto (y re-renderizar el panel completo
// de Administración) en cada evento de arrastre normal.
function buildReviewPools(roster, filters, canManageThemes = false) {
  const hiddenPoolItems = [];
  const draftPoolItems = [];
  const publishedPoolItems = [];
  for (const item of roster) {
    if (!passesFilters(item, filters, canManageThemes)) continue;
    if (!item.isHidden) {
      if (filters.showPublished) publishedPoolItems.push(item);
      continue;
    }
    if (item.isDraft) {
      if (filters.showDrafts) draftPoolItems.push(item);
    } else if (filters.showHiddenByAdmin) {
      hiddenPoolItems.push(item);
    }
  }

  // Ocultos/Borradores/Publicados no se pueden reordenar a mano: se listan siempre alfabéticamente.
  const sequenceOf = (item) => item?.manualSequence ?? item?.rawSequence ?? 0;
  const sortByTitle = (items) => [...items]
    .sort((left, right) => (left.title || "").localeCompare(right.title || "") || sequenceOf(left) - sequenceOf(right))
    .map((item) => item.id);

  return {
    hiddenPoolItemIds: sortByTitle(hiddenPoolItems),
    draftPoolItemIds: sortByTitle(draftPoolItems),
    publishedPoolItemIds: sortByTitle(publishedPoolItems),
  };
}

// Conteos crudos por propiedad: fijos, no dependen del estado actual de los filtros.
// Adulto/Donghua suman también "Sin tema", porque Ocultar adulto/donghua también los filtra ahí.
function computeContentCounts(roster, entriesWithoutTheme = []) {
  const counts = {
    total: 0, adult: 0, donghua: 0, hiddenByAdmin: 0, drafts: 0, visibleAdult: 0, visibleDonghua: 0,
  };
  for (const item of roster) {
    // Adulto/Donghua cuentan sobre todo el roster (Publicados, Borradores y Ocultos incluidos):
    // en modo admin "Ocultar adulto/donghua" filtra los 4 paneles, así que ese contador debe
    // reflejarlos a todos. visibleAdult/visibleDonghua quedan acotados a lo publicado (mismo
    // universo que "total"), que es lo único que un usuario normal puede llegar a ver.
    if (item.isAdult) counts.adult += 1;
    if (item.isDonghua) counts.donghua += 1;
    if (item.isDraft) { counts.drafts += 1; continue; }
    if (item.isHidden) { counts.hiddenByAdmin += 1; continue; }
    counts.total += 1;
    if (item.isAdult) counts.visibleAdult += 1;
    if (item.isDonghua) counts.visibleDonghua += 1;
  }
  for (const entry of entriesWithoutTheme) {
    if (entry.isAdult) counts.adult += 1;
    if (entry.isDonghua) counts.donghua += 1;
  }
  return counts;
}

function countVisibleRoster(roster, filters, canManageThemes = false) {
  return roster.reduce((total, item) => (
    !item.isHidden && passesFilters(item, filters, canManageThemes) ? total + 1 : total
  ), 0);
}

const DEFAULT_FILTERS = {
  hideAdult: true,
  hideDonghua: false,
  showHiddenByAdmin: false,
  showEntriesWithoutTheme: false,
  showDrafts: false,
  showPublished: false,
  focusMode: "",
};

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

function ItemCard({ item, onOpen, isOverlay = false, canManageThemes = false, onEditItem, onDuplicate, onToggleVisibility, onMarkAsDraft, onPublish }) {
  const sortable = useSortable({ id: item.id, disabled: isOverlay });
  const style = isOverlay ? undefined : {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };
  const showFourActions = canManageThemes && !item.isDraft && Boolean(onMarkAsDraft);

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
        {item.isDraft ? (
          <span className="tierlist-card-hidden-flag">Borrador</span>
        ) : item.isHidden ? (
          <span className="tierlist-card-hidden-flag">Oculto por administración</span>
        ) : null}
      </div>
      <span className="tierlist-card-title">{item.title}</span>
      {canManageThemes ? (
        <div className={`tierlist-card-actions ${showFourActions ? "tierlist-card-actions-grid" : ""}`}>
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
          {item.isDraft ? (
            <button
              type="button"
              className="icon-tool-button"
              aria-label="Publicar tema"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => { event.stopPropagation(); onPublish?.(item); }}
            >
              <Globe size={14} />
            </button>
          ) : (
            <button
              type="button"
              className={`icon-tool-button ${item.isHidden ? "" : "danger"}`}
              aria-label={item.isHidden ? "Mostrar tema" : "Ocultar tema"}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => { event.stopPropagation(); onToggleVisibility?.(item); }}
            >
              {item.isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
          )}
          {showFourActions ? (
            <button
              type="button"
              className="icon-tool-button"
              aria-label="Pasar a borrador"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => { event.stopPropagation(); onMarkAsDraft?.(item); }}
            >
              <FileEdit size={14} />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function TierRow({ tier, itemIds, itemsById, onOpenItem, onRename, onOpenColorPicker, onDelete, onMove, canMoveUp, canMoveDown, canManageThemes, onEditItem, onDuplicate, onToggleVisibility, onMarkAsDraft, onPublish }) {
  const { setNodeRef } = useDroppable({ id: tier.key });
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelHeight, setLabelHeight] = useState(null);
  const labelRef = useRef(null);

  function startEditingLabel() {
    if (labelRef.current) setLabelHeight(labelRef.current.getBoundingClientRect().height);
    setIsEditingLabel(true);
  }

  function stopEditingLabel() {
    setIsEditingLabel(false);
    setLabelHeight(null);
  }

  return (
    <div className="tierlist-row">
      <div
        ref={labelRef}
        className="tierlist-row-label"
        style={{ backgroundColor: tier.color, ...(isEditingLabel && labelHeight ? { height: `${labelHeight}px` } : {}) }}
      >
        {isEditingLabel ? (
          <textarea
            className="tierlist-row-label-input"
            defaultValue={tier.label}
            autoFocus
            maxLength={80}
            onFocus={(event) => event.target.select()}
            onBlur={(event) => { onRename(tier.key, event.target.value); stopEditingLabel(); }}
            onKeyDown={(event) => {
              if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
              if (event.key === "Escape") stopEditingLabel();
            }}
          />
        ) : (
          <button type="button" onClick={startEditingLabel} title="Renombrar fila">{tier.label}</button>
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
                onMarkAsDraft={onMarkAsDraft}
                onPublish={onPublish}
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
  // Modo usuario siempre por defecto, incluso para admins: nunca arranca en modo admin por accidente.
  const [viewMode, setViewMode] = useState("user");
  const [entriesWithoutTheme, setEntriesWithoutTheme] = useState([]);
  const [isCreateThemeOpen, setIsCreateThemeOpen] = useState(false);
  const [isCreatingTheme, setIsCreatingTheme] = useState(false);
  const [createRequestKey, setCreateRequestKey] = useState("");
  const [isAniListSearchOpen, setIsAniListSearchOpen] = useState(false);
  const [createSelectedAnime, setCreateSelectedAnime] = useState(null);
  const [createTitleValue, setCreateTitleValue] = useState("");
  const [createTitleTouched, setCreateTitleTouched] = useState(false);
  const [createThemeType, setCreateThemeType] = useState(kind === "ed" ? "ED" : "OP");
  const [createSequence, setCreateSequence] = useState("1");
  const [createIsAdultOverride, setCreateIsAdultOverride] = useState("");
  const [createIsDonghuaOverride, setCreateIsDonghuaOverride] = useState("");
  const [duplicateSourceItemId, setDuplicateSourceItemId] = useState(null);
  const [createImageFile, setCreateImageFile] = useState(null);
  const [createImageError, setCreateImageError] = useState("");
  const [createImagePreviewUrl, setCreateImagePreviewUrl] = useState("");
  const [createAlternateSources, setCreateAlternateSources] = useState([]);
  const [editAlternateSources, setEditAlternateSources] = useState([]);
  const [editPrimaryUrlValue, setEditPrimaryUrlValue] = useState("");
  const [editPrimaryUrlTouched, setEditPrimaryUrlTouched] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState("");
  const [editTitleTouched, setEditTitleTouched] = useState(false);
  const [editSongTitleValue, setEditSongTitleValue] = useState("");
  const [editSongTitleTouched, setEditSongTitleTouched] = useState(false);
  const [editArtistValue, setEditArtistValue] = useState("");
  const [editArtistTouched, setEditArtistTouched] = useState(false);
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
  const [pendingDeleteEntry, setPendingDeleteEntry] = useState(null);
  const [pendingDraftTheme, setPendingDraftTheme] = useState(null);
  const [pendingPublishTheme, setPendingPublishTheme] = useState(null);
  const [pendingRemoveTheme, setPendingRemoveTheme] = useState(null);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [pendingDeleteTier, setPendingDeleteTier] = useState(null);
  const [colorPickerTier, setColorPickerTier] = useState(null);
  const [poolSearch, setPoolSearch] = useState("");
  const [adminSearch, setAdminSearch] = useState("");
  const [filters, setFilters] = useState(() => loadStoredFilters(kind));
  const exportRef = useRef(null);
  const autosaveTimer = useRef(null);
  const isFirstLoad = useRef(true);
  const skipNextFilterSaveRef = useRef(false);
  const dragOverRafRef = useRef(null);
  const pendingDragOverEventRef = useRef(null);
  const isCreatingThemeRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // En modo usuario, incluso un admin ve el tablero exactamente como un usuario sin permisos
  // (sin botones ni panel de administración): así el rendimiento del ranking nunca se ve afectado.
  const isAdminView = canManageThemes && viewMode === "admin";
  const showBoard = viewMode === "user";

  const { containers, itemsById } = useMemo(
    () => buildBoardContainers(roster, tiers, placements, filters, isAdminView),
    [roster, tiers, placements, filters, isAdminView],
  );

  const { hiddenPoolItemIds, draftPoolItemIds, publishedPoolItemIds } = useMemo(
    () => buildReviewPools(roster, filters, isAdminView),
    [roster, filters, isAdminView],
  );

  const contentCounts = useMemo(() => computeContentCounts(roster, entriesWithoutTheme), [roster, entriesWithoutTheme]);
  const visibleRosterCount = useMemo(
    () => countVisibleRoster(roster, filters, isAdminView),
    [roster, filters, isAdminView],
  );

  const visibleEntriesWithoutTheme = useMemo(
    () => entriesWithoutTheme.filter((entry) => passesEntryFilters(entry, filters, isAdminView)),
    [entriesWithoutTheme, filters, isAdminView],
  );

  const entryDuplicateCounts = useMemo(() => {
    const counts = new Map();
    for (const entry of entriesWithoutTheme) {
      const groupKey = entry.duplicateGroupId || entry.id;
      counts.set(groupKey, (counts.get(groupKey) || 0) + 1);
    }
    return counts;
  }, [entriesWithoutTheme]);

  const entryDuplicatePositions = useMemo(() => {
    const groups = new Map();
    for (const entry of entriesWithoutTheme) {
      const groupKey = entry.duplicateGroupId || entry.id;
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey).push(entry);
    }
    const positions = new Map();
    for (const members of groups.values()) {
      [...members].sort((left, right) => left.id - right.id).forEach((member, index) => positions.set(member.id, index + 1));
    }
    return positions;
  }, [entriesWithoutTheme]);

  const searchedEntriesWithoutTheme = useMemo(() => {
    const query = adminSearch.trim().toLowerCase();
    if (!query) return visibleEntriesWithoutTheme;
    return visibleEntriesWithoutTheme.filter((entry) => entry.title?.toLowerCase().includes(query));
  }, [visibleEntriesWithoutTheme, adminSearch]);

  const searchedDraftPoolItemIds = useMemo(() => {
    const query = adminSearch.trim().toLowerCase();
    if (!query) return draftPoolItemIds;
    return draftPoolItemIds.filter((id) => itemsById.get(id)?.title?.toLowerCase().includes(query));
  }, [draftPoolItemIds, adminSearch, itemsById]);

  const searchedHiddenPoolItemIds = useMemo(() => {
    const query = adminSearch.trim().toLowerCase();
    if (!query) return hiddenPoolItemIds;
    return hiddenPoolItemIds.filter((id) => itemsById.get(id)?.title?.toLowerCase().includes(query));
  }, [hiddenPoolItemIds, adminSearch, itemsById]);

  const searchedPublishedPoolItemIds = useMemo(() => {
    const query = adminSearch.trim().toLowerCase();
    if (!query) return publishedPoolItemIds;
    return publishedPoolItemIds.filter((id) => itemsById.get(id)?.title?.toLowerCase().includes(query));
  }, [publishedPoolItemIds, adminSearch, itemsById]);

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

  useEffect(() => { loadBoard(seasonId); }, [loadBoard]);

  useEffect(() => {
    skipNextFilterSaveRef.current = true;
    setFilters(loadStoredFilters(kind));
  }, [kind]);

  useEffect(() => () => {
    if (dragOverRafRef.current) cancelAnimationFrame(dragOverRafRef.current);
  }, []);

  useEffect(() => {
    if (skipNextFilterSaveRef.current) {
      skipNextFilterSaveRef.current = false;
      return;
    }
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
    setEditAlternateSources(Array.isArray(editingThemeItem?.alternateVideoUrls)
      ? editingThemeItem.alternateVideoUrls.map((source) => ({ id: crypto.randomUUID(), ...source }))
      : []);
    setEditPrimaryUrlValue(editingThemeItem?.videoUrl || "");
    setEditPrimaryUrlTouched(false);
    setEditTitleValue(editingThemeItem?.title || "");
    setEditTitleTouched(false);
    setEditSongTitleValue(editingThemeItem?.songTitle || "");
    setEditSongTitleTouched(false);
    setEditArtistValue(editingThemeItem?.artist || "");
    setEditArtistTouched(false);
  }, [editingThemeItem]);

  useEffect(() => {
    if (isCreateThemeOpen) {
      setCreateAlternateSources([]);
    }
  }, [isCreateThemeOpen]);

  useEffect(() => {
    setCreateTitleValue(createSelectedAnime?.title || "");
    setCreateTitleTouched(false);
  }, [createSelectedAnime]);

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
    if (dragOverRafRef.current) {
      cancelAnimationFrame(dragOverRafRef.current);
      dragOverRafRef.current = null;
    }
    pendingDragOverEventRef.current = null;
    setActiveId(event.active.id);
  }

  function processDragOver(event) {
    const { active, over } = event;
    if (!over) return;
    const activeContainer = findContainerKey(active.id);
    const overContainer = containers[over.id] ? over.id : findContainerKey(over.id);
    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    setPlacements((current) => {
      // Si el ítem ya está en el contenedor destino no se toca el estado (evita renders de más).
      const alreadyThere = current.some((placement) => (
        placement.itemId === active.id && (placement.tierKey ?? "_pool") === overContainer
      ));
      if (alreadyThere) return current;

      const next = current.filter((placement) => placement.itemId !== active.id);
      const insertAt = next.filter((placement) => (placement.tierKey ?? "_pool") === overContainer).length;
      next.splice(insertAt, 0, { itemId: active.id, tierKey: overContainer === "_pool" ? null : overContainer });
      return next;
    });
  }

  // Throttleado a un procesamiento por frame: dnd-kit puede disparar "over" muchas veces por
  // frame (auto-scroll, pointermove de alta frecuencia), y encadenar un setState por cada uno
  // es lo que puede disparar "Maximum update depth exceeded". requestAnimationFrame corta esa
  // cadena sincrónica sin perder la vista previa en vivo ni las animaciones de dnd-kit.
  function handleDragOver(event) {
    pendingDragOverEventRef.current = event;
    if (dragOverRafRef.current) return;
    dragOverRafRef.current = requestAnimationFrame(() => {
      dragOverRafRef.current = null;
      const pendingEvent = pendingDragOverEventRef.current;
      pendingDragOverEventRef.current = null;
      if (pendingEvent) processDragOver(pendingEvent);
    });
  }

  function handleDragEnd(event) {
    if (dragOverRafRef.current) {
      cancelAnimationFrame(dragOverRafRef.current);
      dragOverRafRef.current = null;
    }
    pendingDragOverEventRef.current = null;

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
    setTiers((current) => current.map((tier) => (tier.key === key ? { ...tier, label: label.trim().slice(0, 80) } : tier)));
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

  const videoSources = useMemo(() => {
    if (!openItem) return [];
    return [
      { key: "primary", label: openItem.primarySourceLabel || "Fuente principal", url: openItem.videoUrl },
      ...(openItem.alternateVideoUrls || []).map((source, index) => ({
        key: `alt-${index}`,
        label: source.label || "Fuente alternativa",
        url: source.url,
      })),
    ].filter((source) => source.url);
  }, [openItem]);
  const activeVideoUrl = videoSources.find((source) => source.key === videoSource)?.url || videoSources[0]?.url;
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
    setCreateRequestKey(crypto.randomUUID());
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
    setCreateSequence(String(entryDuplicatePositions.get(entry.id) || 1));
    setDuplicateSourceItemId(null);
    setCreateRequestKey(crypto.randomUUID());
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
    setCreateRequestKey(crypto.randomUUID());
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
    setCreateRequestKey(crypto.randomUUID());
    setIsCreateThemeOpen(true);
  }

  function closeCreateTheme() {
    if (isCreatingThemeRef.current) return;
    setIsCreateThemeOpen(false);
    setCreateSelectedAnime(null);
    setCreateImageFile(null);
    setCreateImageError("");
    setDuplicateSourceItemId(null);
  }

  async function createTheme(event) {
    event.preventDefault();
    if (isCreatingThemeRef.current) return;
    isCreatingThemeRef.current = true;
    setIsCreatingTheme(true);
    const form = new FormData(event.currentTarget);
    const submitterVisible = event.nativeEvent.submitter?.dataset.visible;
    const payload = {
      action: "create-theme",
      createRequestKey,
      kind,
      seasonId,
      type: createThemeType,
      sequence: form.get("sequence"),
      songTitle: form.get("songTitle"),
      artist: form.get("artist"),
      videoUrl: form.get("videoUrl"),
      primarySourceLabel: form.get("primarySourceLabel"),
      alternateVideoUrls: createAlternateSources,
    };
    if (typeof submitterVisible === "string") {
      payload.manualVisible = submitterVisible === "true";
    }
    if (createSelectedAnime?.isManual) {
      const animeTitle = String(form.get("animeTitle") || "").trim();
      if (!animeTitle) {
        toast.error("Escribe el título del anime.");
        isCreatingThemeRef.current = false;
        setIsCreatingTheme(false);
        return;
      }
      payload.animeTitle = animeTitle;
      payload.animeIsAdult = form.get("animeIsAdult") === "on";
      payload.animeIsDonghua = form.get("animeIsDonghua") === "on";
    } else if (createSelectedAnime?.aniListId) {
      payload.aniListId = createSelectedAnime.aniListId;
      payload.animeIsAdultOverride = createIsAdultOverride;
      payload.animeIsDonghuaOverride = createIsDonghuaOverride;
      if (createTitleTouched) payload.manualEntryTitle = createTitleValue;
    } else {
      toast.error("Busca y selecciona un anime en AniList.");
      isCreatingThemeRef.current = false;
      setIsCreatingTheme(false);
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
    } finally {
      isCreatingThemeRef.current = false;
      setIsCreatingTheme(false);
    }
  }

  async function saveEditTheme(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const submitterVisible = event.nativeEvent.submitter?.dataset.visible;
    const payload = {
      action: "update-theme",
      kind,
      id: editingThemeItem.id,
      primarySourceLabel: form.get("primarySourceLabel"),
      alternateVideoUrls: editAlternateSources,
    };
    if (editingThemeItem.isDraft && typeof submitterVisible === "string") {
      payload.manualVisible = submitterVisible === "true";
    }
    if (!editingThemeItem.aniListId) {
      payload.manualEntryIsAdult = form.get("animeIsAdult") === "on";
      payload.manualEntryIsDonghua = form.get("animeIsDonghua") === "on";
      payload.manualEntryTitle = form.get("manualEntryTitle");
    } else {
      payload.manualEntryIsAdultOverride = editIsAdultOverride;
      payload.manualEntryIsDonghuaOverride = editIsDonghuaOverride;
      payload.manualEntryTitle = editTitleTouched ? editTitleValue : editingThemeItem.manualTitle;
    }
    if (editingThemeItem.isManual) {
      payload.type = editManualType;
      payload.sequence = form.get("manualSequence");
      payload.videoUrl = form.get("manualVideoUrl");
      payload.songTitle = form.get("songTitle");
      payload.artist = form.get("artist");
    } else {
      payload.manualType = isEditOverrideOpen ? editManualType : "";
      payload.manualSequence = isEditOverrideOpen
        ? (editSequenceTouched ? form.get("manualSequence") : (editingThemeItem.manualSequence ?? ""))
        : "";
      payload.manualVideoUrl = isEditOverrideOpen
        ? (editPrimaryUrlTouched ? editPrimaryUrlValue : editingThemeItem.manualVideoUrl)
        : "";
      payload.manualSongTitle = isEditOverrideOpen
        ? (editSongTitleTouched ? editSongTitleValue : editingThemeItem.manualSongTitle)
        : "";
      payload.manualArtist = isEditOverrideOpen
        ? (editArtistTouched ? editArtistValue : editingThemeItem.manualArtist)
        : "";
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
      restoreTheme(item);
    } else {
      setPendingDeleteTheme(item);
    }
  }

  async function restoreTheme(item) {
    try {
      const response = await fetch("/api/anime-tier-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore-theme", kind, id: item.id }),
      });
      const data = await readJson(response);
      if (!response.ok || !data.success) throw new Error(data.error);
      await loadBoard(seasonId, { silent: true });
      const hiddenByContentFilter = (item.isDonghua && filters.hideDonghua && filters.focusMode !== "donghua")
        || (item.isAdult && filters.hideAdult && filters.focusMode !== "adult");
      toast.success(item.isEntryHidden
        ? "Tema publicado, pero el anime asociado continúa oculto por administración."
        : hiddenByContentFilter
          ? `Tema publicado. Sigue oculto por el filtro ${item.isDonghua && filters.hideDonghua ? "Ocultar donghua" : "Ocultar adulto"}.`
          : "Tema publicado y visible de nuevo.");
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

  function requestPublishTheme(item) {
    setPendingPublishTheme(item);
  }

  async function confirmPublishTheme() {
    if (!pendingPublishTheme) return;
    try {
      const response = await fetch("/api/anime-tier-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-theme-visibility", kind, id: pendingPublishTheme.id, manualVisible: true }),
      });
      const data = await readJson(response);
      if (!response.ok || !data.success) throw new Error(data.error);
      setPendingPublishTheme(null);
      await loadBoard(seasonId, { silent: true });
      toast.success("Tema publicado.");
    } catch (error) {
      toast.error(error.message || "No se pudo publicar el tema.");
    }
  }

  function requestDraftTheme(item) {
    setPendingDraftTheme(item);
  }

  async function confirmDraftTheme() {
    if (!pendingDraftTheme) return;
    try {
      const response = await fetch("/api/anime-tier-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-theme-visibility", kind, id: pendingDraftTheme.id, manualVisible: false }),
      });
      const data = await readJson(response);
      if (!response.ok || !data.success) throw new Error(data.error);
      setPendingDraftTheme(null);
      await loadBoard(seasonId, { silent: true });
      toast.success("Tema pasado a borrador.");
    } catch (error) {
      toast.error(error.message || "No se pudo pasar el tema a borrador.");
    }
  }

  function requestRemoveTheme(item) {
    setPendingRemoveTheme(item);
  }

  async function confirmRemoveTheme() {
    if (!pendingRemoveTheme) return;
    try {
      const response = await fetch("/api/anime-tier-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove-theme", kind, id: pendingRemoveTheme.id }),
      });
      const data = await readJson(response);
      if (!response.ok || !data.success) throw new Error(data.error);
      setPendingRemoveTheme(null);
      await loadBoard(seasonId, { silent: true });
      toast.success("Tema eliminado. Queda visible solo en administración.");
    } catch (error) {
      toast.error(error.message || "No se pudo eliminar el tema.");
    }
  }

  async function toggleEntryVisibility(entry) {
    try {
      const response = await fetch("/api/anime-tier-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-entry", kind, id: entry.id, manualVisible: Boolean(entry.isHidden) }),
      });
      const data = await readJson(response);
      if (!response.ok || !data.success) throw new Error(data.error);
      await loadBoard(seasonId, { silent: true });
      toast.success(entry.isHidden ? "Anime visible de nuevo." : "Anime ocultado.");
    } catch (error) {
      toast.error(error.message || "No se pudo actualizar el anime.");
    }
  }

  async function confirmDeleteEntry() {
    if (!pendingDeleteEntry) return;
    try {
      const response = await fetch("/api/anime-tier-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete-entry", kind, id: pendingDeleteEntry.id }),
      });
      const data = await readJson(response);
      if (!response.ok || !data.success) throw new Error(data.error);
      setPendingDeleteEntry(null);
      await loadBoard(seasonId, { silent: true });
      toast.success("Anime eliminado. Queda visible solo en administración.");
    } catch (error) {
      toast.error(error.message || "No se pudo eliminar el anime.");
    }
  }

  // Se separa en un useMemo porque este panel puede tener cientos de nodos (Sin temas/Borradores/
  // Ocultos): sin esto, cada evento de arrastre en el tablero (que solo cambia `placements`)
  // forzaría reconstruir toda esta sección de nuevo aunque su contenido no haya cambiado.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const adminReviewPanel = useMemo(() => (
    isAdminView && (filters.showEntriesWithoutTheme || filters.showDrafts || filters.showHiddenByAdmin || filters.showPublished) ? (
      <div className="tierlist-pool tierlist-pool-pending">
        <div className="tierlist-pool-header">
          <h2>
            Administración{" "}
            <span className="tierlist-pool-count">
              ({entriesWithoutTheme.length + contentCounts.drafts + contentCounts.hiddenByAdmin + contentCounts.total} en total)
            </span>
          </h2>
          <div className="tierlist-pool-header-actions">
            <div className="tierlist-pool-buttons">
              <button type="button" className="tracker-action-secondary" onClick={openCreateTheme}>
                <Plus size={16} /> {triggerThemeLabel}
              </button>
            </div>
            <label className="tierlist-pool-search">
              <Search size={15} aria-hidden="true" />
              <input
                type="text"
                value={adminSearch}
                onChange={(event) => setAdminSearch(event.target.value)}
                placeholder="Buscar anime..."
                aria-label="Buscar anime en administración"
              />
            </label>
          </div>
        </div>

        {filters.showEntriesWithoutTheme ? (
          <div className="tierlist-pool-subsection">
            <h3 className="tierlist-pool-subsection-title">
              Sin temas{" "}
              <span className="tierlist-pool-count">
                ({searchedEntriesWithoutTheme.length < entriesWithoutTheme.length
                  ? `${searchedEntriesWithoutTheme.length} de ${entriesWithoutTheme.length}`
                  : entriesWithoutTheme.length})
              </span>
            </h3>
            {entriesWithoutTheme.length ? (
              visibleEntriesWithoutTheme.length ? (
                searchedEntriesWithoutTheme.length ? (
                <div className="tierlist-row-drop tierlist-pool-drop">
                  {searchedEntriesWithoutTheme.map((entry) => (
                    <div
                      key={entry.id}
                      className={`tierlist-card is-add-action ${entry.isHidden ? "is-hidden-by-admin" : ""}`}
                      onClick={() => openCreateThemeForEntry(entry)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => { if (event.key === "Enter") openCreateThemeForEntry(entry); }}
                      title={`Agregar ${kind === "ed" ? "ending" : "opening"} para ${entry.title}`}
                    >
                      <div className="tierlist-card-media">
                        <AnimePosterImage src={entry.imageUrl} title={entry.title} className="tierlist-card-poster" decorative />
                        {(entryDuplicateCounts.get(entry.duplicateGroupId || entry.id) || 1) > 1 ? (
                          <span className="tierlist-card-badge">{entryDuplicateCounts.get(entry.duplicateGroupId || entry.id)}</span>
                        ) : null}
                        {entry.isAdult || entry.isDonghua ? (
                          <div className="tierlist-card-flags">
                            {entry.isAdult ? <span className="tierlist-card-flag is-adult">18+</span> : null}
                            {entry.isDonghua ? <span className="tierlist-card-flag is-donghua">Donghua</span> : null}
                          </div>
                        ) : null}
                        <span className="tierlist-card-play"><Plus size={22} /></span>
                        {entry.isHidden ? <span className="tierlist-card-hidden-flag">Oculto por administración</span> : null}
                      </div>
                      <span className="tierlist-card-title">{entry.title}</span>
                      <div className="tierlist-card-actions">
                        <button
                          type="button"
                          className="icon-tool-button"
                          aria-label="Editar"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => { event.stopPropagation(); openCreateThemeForEntry(entry); }}
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          type="button"
                          className={`icon-tool-button ${entry.isHidden ? "" : "danger"}`}
                          aria-label={entry.isHidden ? "Mostrar" : "Ocultar"}
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => { event.stopPropagation(); toggleEntryVisibility(entry); }}
                        >
                          {entry.isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        <button
                          type="button"
                          className="icon-tool-button danger"
                          aria-label="Eliminar"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => { event.stopPropagation(); setPendingDeleteEntry(entry); }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                ) : (
                  <p className="field-hint">Ningún anime sin tema coincide con &quot;{adminSearch.trim()}&quot;.</p>
                )
              ) : (
                <p className="field-hint">{entriesWithoutTheme.length} ocultos por tus preferencias de filtro.</p>
              )
            ) : (
              <p className="field-hint">Todos los animes de esta temporada ya tienen {kind === "ed" ? "ending" : "opening"} cargado.</p>
            )}
          </div>
        ) : null}

        {filters.showDrafts ? (
          <div className="tierlist-pool-subsection">
            <h3 className="tierlist-pool-subsection-title">
              Borradores{" "}
              <span className="tierlist-pool-count">
                ({searchedDraftPoolItemIds.length < contentCounts.drafts
                  ? `${searchedDraftPoolItemIds.length} de ${contentCounts.drafts}`
                  : contentCounts.drafts})
              </span>
            </h3>
            {draftPoolItemIds.length ? (
              searchedDraftPoolItemIds.length ? (
              <div className="tierlist-row-drop tierlist-pool-drop">
                {searchedDraftPoolItemIds.map((id) => {
                  const item = itemsById.get(id);
                  if (!item) return null;
                  return (
                    <div
                      key={id}
                      className="tierlist-card is-draft"
                      onClick={() => item.videoUrl && setOpenItem(item)}
                      onKeyDown={(event) => { if (item.videoUrl && (event.key === "Enter" || event.key === " ")) setOpenItem(item); }}
                      role={item.videoUrl ? "button" : undefined}
                      tabIndex={item.videoUrl ? 0 : undefined}
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
                      </div>
                      <span className="tierlist-card-title">{item.title}</span>
                      <div className="tierlist-card-actions tierlist-card-actions-grid">
                        <button type="button" className="icon-tool-button" aria-label="Editar tema" onClick={(event) => { event.stopPropagation(); setEditingThemeItem(item); }}>
                          <Edit3 size={14} />
                        </button>
                        <button type="button" className="icon-tool-button" aria-label="Duplicar tema" onClick={(event) => { event.stopPropagation(); duplicateTheme(item); }}>
                          <Copy size={14} />
                        </button>
                        <button type="button" className="icon-tool-button danger" aria-label="Ocultar tema" onClick={(event) => { event.stopPropagation(); setPendingDeleteTheme(item); }}>
                          <EyeOff size={14} />
                        </button>
                        <button type="button" className="icon-tool-button" aria-label="Publicar tema" onClick={(event) => { event.stopPropagation(); requestPublishTheme(item); }}>
                          <Globe size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              ) : (
                <p className="field-hint">Ningún borrador coincide con &quot;{adminSearch.trim()}&quot;.</p>
              )
            ) : (
              <p className="field-hint">No hay borradores con los filtros actuales.</p>
            )}
          </div>
        ) : null}

        {filters.showHiddenByAdmin ? (
          <div className="tierlist-pool-subsection">
            <h3 className="tierlist-pool-subsection-title">
              Ocultos{" "}
              <span className="tierlist-pool-count">
                ({searchedHiddenPoolItemIds.length < contentCounts.hiddenByAdmin
                  ? `${searchedHiddenPoolItemIds.length} de ${contentCounts.hiddenByAdmin}`
                  : contentCounts.hiddenByAdmin})
              </span>
            </h3>
            {hiddenPoolItemIds.length ? (
              searchedHiddenPoolItemIds.length ? (
              <div className="tierlist-row-drop tierlist-pool-drop">
                {searchedHiddenPoolItemIds.map((id) => {
                  const item = itemsById.get(id);
                  if (!item) return null;
                  return (
                    <div
                      key={id}
                      className="tierlist-card is-hidden-by-admin"
                      onClick={() => item.videoUrl && setOpenItem(item)}
                      onKeyDown={(event) => { if (item.videoUrl && (event.key === "Enter" || event.key === " ")) setOpenItem(item); }}
                      role={item.videoUrl ? "button" : undefined}
                      tabIndex={item.videoUrl ? 0 : undefined}
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
                      </div>
                      <span className="tierlist-card-title">{item.title}</span>
                      <div className="tierlist-card-actions">
                        <button type="button" className="icon-tool-button" aria-label="Mostrar tema" onClick={(event) => { event.stopPropagation(); handleToggleVisibility(item); }}>
                          <Eye size={14} />
                        </button>
                        <button type="button" className="icon-tool-button" aria-label="Pasar a borrador" onClick={(event) => { event.stopPropagation(); setPendingDraftTheme(item); }}>
                          <FileEdit size={14} />
                        </button>
                        <button type="button" className="icon-tool-button danger" aria-label="Eliminar tema" onClick={(event) => { event.stopPropagation(); setPendingRemoveTheme(item); }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              ) : (
                <p className="field-hint">Ningún tema oculto coincide con &quot;{adminSearch.trim()}&quot;.</p>
              )
            ) : (
              <p className="field-hint">No hay temas ocultos con los filtros actuales.</p>
            )}
          </div>
        ) : null}

        {filters.showPublished ? (
          <div className="tierlist-pool-subsection">
            <h3 className="tierlist-pool-subsection-title">
              Publicados{" "}
              <span className="tierlist-pool-count">
                ({searchedPublishedPoolItemIds.length < contentCounts.total
                  ? `${searchedPublishedPoolItemIds.length} de ${contentCounts.total}`
                  : contentCounts.total})
              </span>
            </h3>
            {publishedPoolItemIds.length ? (
              searchedPublishedPoolItemIds.length ? (
              <div className="tierlist-row-drop tierlist-pool-drop">
                {searchedPublishedPoolItemIds.map((id) => {
                  const item = itemsById.get(id);
                  if (!item) return null;
                  return (
                    <div
                      key={id}
                      className="tierlist-card"
                      onClick={() => item.videoUrl && setOpenItem(item)}
                      onKeyDown={(event) => { if (item.videoUrl && (event.key === "Enter" || event.key === " ")) setOpenItem(item); }}
                      role={item.videoUrl ? "button" : undefined}
                      tabIndex={item.videoUrl ? 0 : undefined}
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
                      </div>
                      <span className="tierlist-card-title">{item.title}</span>
                      <div className="tierlist-card-actions tierlist-card-actions-grid">
                        <button type="button" className="icon-tool-button" aria-label="Editar tema" onClick={(event) => { event.stopPropagation(); setEditingThemeItem(item); }}>
                          <Edit3 size={14} />
                        </button>
                        <button type="button" className="icon-tool-button" aria-label="Duplicar tema" onClick={(event) => { event.stopPropagation(); duplicateTheme(item); }}>
                          <Copy size={14} />
                        </button>
                        <button type="button" className="icon-tool-button danger" aria-label="Ocultar tema" onClick={(event) => { event.stopPropagation(); setPendingDeleteTheme(item); }}>
                          <EyeOff size={14} />
                        </button>
                        <button type="button" className="icon-tool-button" aria-label="Pasar a borrador" onClick={(event) => { event.stopPropagation(); setPendingDraftTheme(item); }}>
                          <FileEdit size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              ) : (
                <p className="field-hint">Ningún tema publicado coincide con &quot;{adminSearch.trim()}&quot;.</p>
              )
            ) : (
              <p className="field-hint">No hay temas publicados con los filtros actuales.</p>
            )}
          </div>
        ) : null}
      </div>
    ) : null
  ), [
    isAdminView,
    filters.showEntriesWithoutTheme,
    filters.showDrafts,
    filters.showHiddenByAdmin,
    filters.showPublished,
    adminSearch,
    searchedEntriesWithoutTheme,
    entriesWithoutTheme,
    visibleEntriesWithoutTheme,
    entryDuplicateCounts,
    kind,
    searchedDraftPoolItemIds,
    draftPoolItemIds,
    searchedPublishedPoolItemIds,
    publishedPoolItemIds,
    searchedHiddenPoolItemIds,
    hiddenPoolItemIds,
    itemsById,
    triggerThemeLabel,
    contentCounts,
  ]);

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
      {kind !== "animes" ? (
        <div className="rtfm-notice-panel">
          <div className="rtfm-notice is-info">
            <Info size={18} aria-hidden="true" />
            <p>Créditos al bueno de cerchupy por su continuo compromiso en los tiers.</p>
          </div>
        </div>
      ) : null}
      {canManageThemes ? (
        <div className="season-calendar-view-switch-row">
          <div className="tracker-calendar-view-toggle" role="tablist" aria-label="Modo de vista">
            <button type="button" role="tab" aria-selected={viewMode === "user"} className={viewMode === "user" ? "is-active" : ""} onClick={() => setViewMode("user")}>Usuario</button>
            <button type="button" role="tab" aria-selected={viewMode === "admin"} className={viewMode === "admin" ? "is-active" : ""} onClick={() => setViewMode("admin")}>Administración</button>
          </div>
        </div>
      ) : null}

      <section className="tierlist-toolbar" aria-label="Controles del tier list">
        {showBoard ? (
          <div className="tierlist-toolbar-top">
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
        ) : null}

        {seasons.length ? (
          <>
            <div className="tierlist-filter-groups">
              <div className="tierlist-filter-group">
                <span className="tierlist-filter-group-label">Temporada</span>
                <FilterSelect
                  id={`tierlist-${kind}-season`}
                  label="Temporada"
                  value={seasonId}
                  options={seasons.map((season) => ({ value: String(season.id), label: seasonLabel(season) }))}
                  onChange={(value) => loadBoard(value)}
                />
              </div>

              <div className="tierlist-filter-group">
                <span className="tierlist-filter-group-label">Ocultar</span>
                <div className="season-calendar-toggles">
                  <button
                    type="button"
                    disabled={filters.focusMode === "adult"}
                    className={`season-calendar-toggle ${filters.hideAdult ? "is-active" : ""}`}
                    aria-pressed={filters.hideAdult}
                    onClick={() => setFilters((current) => ({ ...current, hideAdult: !current.hideAdult }))}
                  >
                    Adulto ({isAdminView ? contentCounts.adult : contentCounts.visibleAdult})
                  </button>
                  <button
                    type="button"
                    disabled={filters.focusMode === "donghua"}
                    className={`season-calendar-toggle ${filters.hideDonghua ? "is-active" : ""}`}
                    aria-pressed={filters.hideDonghua}
                    onClick={() => setFilters((current) => ({ ...current, hideDonghua: !current.hideDonghua }))}
                  >
                    Donghua ({isAdminView ? contentCounts.donghua : contentCounts.visibleDonghua})
                  </button>
                </div>
              </div>

              <div className="tierlist-filter-group">
                <span className="tierlist-filter-group-label">Ver</span>
                <FormSelect
                  value={filters.focusMode || ""}
                  onChange={(value) => setFilters((current) => ({ ...current, focusMode: value }))}
                  options={[
                    { value: "", label: "Todo" },
                    { value: "adult", label: "Solo adulto" },
                    { value: "donghua", label: "Solo donghua" },
                    ...(isAdminView && kind !== "animes" ? [
                      { value: "manual", label: "Solo manuales" },
                      { value: "synced", label: "Solo sincronizados" },
                    ] : []),
                  ]}
                />
              </div>

              {isAdminView ? (
                <div className="tierlist-filter-group">
                  <span className="tierlist-filter-group-label">Administración</span>
                  <div className="season-calendar-toggles tierlist-admin-toggles">
                    {kind !== "animes" ? (
                      <button
                        type="button"
                        className={`season-calendar-toggle ${filters.showEntriesWithoutTheme ? "is-active" : ""}`}
                        aria-pressed={filters.showEntriesWithoutTheme}
                        onClick={() => setFilters((current) => ({ ...current, showEntriesWithoutTheme: !current.showEntriesWithoutTheme }))}
                      >
                        Sin temas ({entriesWithoutTheme.length})
                      </button>
                    ) : null}
                    {kind !== "animes" ? (
                      <button
                        type="button"
                        className={`season-calendar-toggle ${filters.showDrafts ? "is-active" : ""}`}
                        aria-pressed={filters.showDrafts}
                        onClick={() => setFilters((current) => ({ ...current, showDrafts: !current.showDrafts }))}
                      >
                        Borradores ({contentCounts.drafts})
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={`season-calendar-toggle ${filters.showHiddenByAdmin ? "is-active" : ""}`}
                      aria-pressed={filters.showHiddenByAdmin}
                      onClick={() => setFilters((current) => ({ ...current, showHiddenByAdmin: !current.showHiddenByAdmin }))}
                    >
                      Ocultos ({contentCounts.hiddenByAdmin})
                    </button>
                    {kind !== "animes" ? (
                      <button
                        type="button"
                        className={`season-calendar-toggle ${filters.showPublished ? "is-active" : ""}`}
                        aria-pressed={filters.showPublished}
                        onClick={() => setFilters((current) => ({ ...current, showPublished: !current.showPublished }))}
                      >
                        Publicados ({contentCounts.total})
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
            {showBoard ? (
              <p className="season-calendar-summary" aria-live="polite">
                {visibleRosterCount < contentCounts.total
                  ? `${visibleRosterCount} visibles de ${contentCounts.total} · ${contentCounts.total - visibleRosterCount} ocultos por tus filtros`
                  : `Mostrando los ${contentCounts.total} disponibles`}
              </p>
            ) : null}
          </>
        ) : null}
      </section>

      {viewToggle ? (
        <div className="season-calendar-view-switch-row">{viewToggle}</div>
      ) : null}

      {adminReviewPanel}

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
      ) : !showBoard ? (
        !adminReviewPanel ? (
          <p className="field-hint">Activá alguno de los filtros de Administración de arriba (Sin temas, Borradores, Ocultos o Publicados) para empezar a gestionar.</p>
        ) : null
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
                  canManageThemes={isAdminView}
                  onEditItem={setEditingThemeItem}
                  onDuplicate={duplicateTheme}
                  onToggleVisibility={handleToggleVisibility}
                  onMarkAsDraft={requestDraftTheme}
                  onPublish={requestPublishTheme}
                />
              ))}
            </div>

            <div className="tierlist-pool">
              <div className="tierlist-pool-header">
                <h2>Sin rankear <span className="tierlist-pool-count">({containers._pool.length})</span></h2>
                <div className="tierlist-pool-header-actions">
                  <div className="tierlist-pool-buttons">
                    {isAdminView ? (
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
              {!poolItemIds.length ? (
                <p className="field-hint">
                  {poolSearch.trim()
                    ? `Ningún anime sin rankear coincide con "${poolSearch.trim()}".`
                    : "No hay nada sin rankear con los filtros actuales."}
                </p>
              ) : null}
              <PoolDroppable
                itemIds={poolItemIds}
                itemsById={itemsById}
                onOpenItem={setOpenItem}
                canManageThemes={isAdminView}
                onEditItem={setEditingThemeItem}
                onDuplicate={duplicateTheme}
                onToggleVisibility={handleToggleVisibility}
                onMarkAsDraft={requestDraftTheme}
                onPublish={requestPublishTheme}
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

      <ConfirmModal
        isOpen={Boolean(pendingDraftTheme)}
        title="Pasar a borrador"
        description={`"${pendingDraftTheme?.title || ""}"${pendingDraftTheme?.badge ? ` #${pendingDraftTheme.badge}` : ""} pasará a borrador. Dejará de ofrecerse a usuarios nuevos hasta que lo publiques de nuevo; quienes ya lo tengan rankeado lo seguirán viendo marcado como oculto.`}
        confirmLabel="Pasar a borrador"
        tone="default"
        cancelLabel="Cancelar"
        onCancel={() => setPendingDraftTheme(null)}
        onConfirm={confirmDraftTheme}
      />

      <ConfirmModal
        isOpen={Boolean(pendingPublishTheme)}
        title="Publicar tema"
        description={`Se publicará "${pendingPublishTheme?.title || ""}"${pendingPublishTheme?.badge ? ` #${pendingPublishTheme.badge}` : ""}. Quedará visible para todos los usuarios.`}
        confirmLabel="Publicar"
        tone="default"
        cancelLabel="Cancelar"
        onCancel={() => setPendingPublishTheme(null)}
        onConfirm={confirmPublishTheme}
      />

      <ConfirmModal
        isOpen={Boolean(pendingRemoveTheme)}
        title="Eliminar tema"
        description={`Se eliminará "${pendingRemoveTheme?.title || ""}"${pendingRemoveTheme?.badge ? ` #${pendingRemoveTheme.badge}` : ""}. Dejará de aparecer en el tablero por completo; quedará visible únicamente en administración.`}
        confirmLabel="Eliminar"
        tone="danger"
        cancelLabel="Cancelar"
        onCancel={() => setPendingRemoveTheme(null)}
        onConfirm={confirmRemoveTheme}
      />

      <ConfirmModal
        isOpen={Boolean(pendingDeleteEntry)}
        title="Eliminar anime"
        description={`Se eliminará "${pendingDeleteEntry?.title || ""}" de esta temporada. Quedará visible únicamente en administración; no se puede restaurar desde aquí.`}
        confirmLabel="Eliminar"
        tone="danger"
        cancelLabel="Cancelar"
        onCancel={() => setPendingDeleteEntry(null)}
        onConfirm={confirmDeleteEntry}
      />

      {isCreateThemeOpen ? (
        <MaintainerModal
          as="form"
          title={createThemeLabel}
          subtitle="Úsalo cuando AnimeThemes.moe todavía no tenga indexado el tema."
          onClose={closeCreateTheme}
          onSubmit={createTheme}
          noValidate
          actions={(
            <>
              <button type="button" className="tracker-action-secondary" disabled={isCreatingTheme} onClick={closeCreateTheme}>Cancelar</button>
              <button type="submit" data-visible="false" className="tracker-action-secondary" disabled={isCreatingTheme}>{isCreatingTheme ? "Guardando…" : "Guardar como borrador"}</button>
              <button type="submit" data-visible="true" className="tracker-action-primary" disabled={isCreatingTheme}>{isCreatingTheme ? "Publicando…" : "Publicar"}</button>
            </>
          )}
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
            <>
              <label className="notification-form-field">
                <span>Título</span>
                <input
                  className="modal-input"
                  value={createTitleValue}
                  onChange={(event) => { setCreateTitleTouched(true); setCreateTitleValue(event.target.value); }}
                />
              </label>
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
            </>
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
          <span className="notification-form-field-label">Fuentes</span>
          <div className="form-row tierlist-primary-source-row">
            <input className="modal-input" name="primarySourceLabel" defaultValue="Fuente principal" required />
            <input className="modal-input" name="videoUrl" placeholder="https://..." required />
          </div>
          <VideoSourcesField sources={createAlternateSources} onChange={setCreateAlternateSources} />
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
          actions={editingThemeItem.isDraft ? (
            <>
              <button type="button" className="tracker-action-secondary" onClick={() => setEditingThemeItem(null)}>Cancelar</button>
              <button type="submit" data-visible="false" className="tracker-action-secondary">Guardar como borrador</button>
              <button type="submit" data-visible="true" className="tracker-action-primary">Publicar</button>
            </>
          ) : (
            <>
              <button type="button" className="tracker-action-secondary" onClick={() => setEditingThemeItem(null)}>Cancelar</button>
              <button type="submit" className="tracker-action-primary">Guardar</button>
            </>
          )}
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
            <>
              <label className="notification-form-field"><span>Título</span><input className="modal-input" name="manualEntryTitle" defaultValue={editingThemeItem.title || ""} placeholder="Título del anime" required /></label>
              <div className="tierlist-content-flags">
                <label className="tierlist-content-flag"><input type="checkbox" name="animeIsAdult" defaultChecked={editingThemeItem.isAdult} /> Contenido adulto</label>
                <label className="tierlist-content-flag"><input type="checkbox" name="animeIsDonghua" defaultChecked={editingThemeItem.isDonghua} /> Donghua</label>
              </div>
            </>
          ) : (
            <>
              <label className="notification-form-field">
                <span>Título</span>
                <input
                  className="modal-input"
                  value={editTitleValue}
                  onChange={(event) => { setEditTitleTouched(true); setEditTitleValue(event.target.value); }}
                />
              </label>
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
            </>
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
              <span className="notification-form-field-label">Fuentes</span>
              <div className="form-row tierlist-primary-source-row">
                <input className="modal-input" name="primarySourceLabel" defaultValue={editingThemeItem.primarySourceLabel || "Fuente principal"} required />
                <input className="modal-input" name="manualVideoUrl" defaultValue={editingThemeItem.rawVideoUrl || ""} required />
              </div>
              <VideoSourcesField sources={editAlternateSources} onChange={setEditAlternateSources} />
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
                    <input
                      key="song-title-editable"
                      className="modal-input"
                      value={editSongTitleValue}
                      onChange={(event) => { setEditSongTitleTouched(true); setEditSongTitleValue(event.target.value); }}
                    />
                  </label>
                  <label className="notification-form-field">
                    <span>Artista</span>
                    <input
                      key="artist-editable"
                      className="modal-input"
                      value={editArtistValue}
                      onChange={(event) => { setEditArtistTouched(true); setEditArtistValue(event.target.value); }}
                    />
                  </label>
                  <span className="notification-form-field-label">Fuentes</span>
                  <div className="form-row tierlist-primary-source-row">
                    <input className="modal-input" name="primarySourceLabel" defaultValue={editingThemeItem.primarySourceLabel || "Fuente principal"} required />
                    <input
                      key="video-url-editable"
                      className="modal-input"
                      value={editPrimaryUrlValue}
                      onChange={(event) => { setEditPrimaryUrlTouched(true); setEditPrimaryUrlValue(event.target.value); }}
                    />
                  </div>
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
                  <span className="notification-form-field-label">Fuentes</span>
                  <div className="form-row tierlist-primary-source-row">
                    <input className="modal-input" name="primarySourceLabel" defaultValue={editingThemeItem.primarySourceLabel || "Fuente principal"} required />
                    <input key="video-url-readonly" className="modal-input" readOnly value={editingThemeItem.videoUrl || ""} />
                  </div>
                </>
              )}
              <VideoSourcesField sources={editAlternateSources} onChange={setEditAlternateSources} />
              <button
                type="button"
                className="anime-library-advanced-toggle"
                onClick={() => {
                  if (isEditOverrideOpen) {
                    setEditManualType("");
                    setEditSequenceTouched(false);
                    setEditPrimaryUrlValue(editingThemeItem.videoUrl || "");
                    setEditPrimaryUrlTouched(false);
                    setEditSongTitleValue(editingThemeItem.songTitle || "");
                    setEditSongTitleTouched(false);
                    setEditArtistValue(editingThemeItem.artist || "");
                    setEditArtistTouched(false);
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
            {openItem.artist ? <p className="tierlist-video-artist" title={openItem.artist}>Artista: {openItem.artist}</p> : null}
            {videoSources.length > 1 ? (
              <div className="tracker-calendar-view-toggle tierlist-video-source-toggle" role="tablist" aria-label="Fuente del video">
                {videoSources.map((source) => (
                  <button
                    key={source.key}
                    type="button"
                    role="tab"
                    aria-selected={videoSource === source.key}
                    className={videoSource === source.key ? "is-active" : ""}
                    onClick={() => switchVideoSource(source.key)}
                  >
                    {source.label}
                  </button>
                ))}
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
                  referrerPolicy="no-referrer"
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

function PoolDroppable({ itemIds, itemsById, onOpenItem, canManageThemes, onEditItem, onDuplicate, onToggleVisibility, onMarkAsDraft, onPublish }) {
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
              onMarkAsDraft={onMarkAsDraft}
              onPublish={onPublish}
            />
          );
        })}
      </SortableContext>
    </div>
  );
}
