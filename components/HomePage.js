"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Radio, Zap } from "lucide-react";
import { Toaster, toast } from "sonner";

import AccountMenu from "@/components/AccountMenu";
import AnimeLibraryPage from "@/components/AnimeLibraryPage";
import AppSidebar from "@/components/AppSidebar";
import AppSidebarShell from "@/components/AppSidebarShell";
import ChangelogPage from "@/components/ChangelogPage";
import ConfirmModal from "@/components/ConfirmModal";
import FiltersBar from "@/components/FiltersBar";
import HomeDashboard from "@/components/HomeDashboard";
import LiveCard from "@/components/LiveCard";
import LoreModal from "@/components/LoreModal";
import NewsGuidePage from "@/components/NewsGuidePage";
import NotificationCenter from "@/components/NotificationCenter";
import NotificationsPage from "@/components/NotificationsPage";
import RtfmPage from "@/components/RtfmPage";
import PlatformNotificationsPage from "@/components/PlatformNotificationsPage";
import PlatformAnimeMaintainerPage from "@/components/PlatformAnimeMaintainerPage";
import PlatformSpaceDrumChaptersPage from "@/components/PlatformSpaceDrumChaptersPage";
import PlatformSpaceDrumImportPage from "@/components/PlatformSpaceDrumImportPage";
import PlatformSpaceDrumPagesPage from "@/components/PlatformSpaceDrumPagesPage";
import PlatformSpaceDrumSettingsPage from "@/components/PlatformSpaceDrumSettingsPage";
import PlatformTagsMaintainerPage from "@/components/PlatformTagsMaintainerPage";
import PlatformTrackerMaintainerPage from "@/components/PlatformTrackerMaintainerPage";
import PlatformUsersPage from "@/components/PlatformUsersPage";
import PlatformRolesPage from "@/components/PlatformRolesPage";
import StatsBar from "@/components/StatsBar";
import TagPanel from "@/components/TagPanel";
import TrackerMaintainerModal from "@/components/TrackerMaintainerModal";
import TrackerCalendarPage from "@/components/TrackerCalendarPage";
import SpaceDrumPage from "@/components/SpaceDrumPage";
import { LIVE_STATUS_OPTIONS } from "@/lib/animeDbMapping";
import { formatPlatformDateTime } from "@/lib/dateTime";

const CARD_DENSITY_STORAGE_KEY = "kala_card_density";
const CARD_DENSITY_VERSION_KEY = "kala_card_density_version";
const CURRENT_CARD_DENSITY_VERSION = "3";
const TABLE_VIEW_MEDIA_QUERY = "(min-width: 768px)";

function normalizeCardDensity(value) {
  return value === "comfortable" || value === "compact" || value === "table" ? value : "comfortable";
}

function getAllTags(lives) {
  return Array.from(
    new Set(
      lives.flatMap((live) => (Array.isArray(live.tags) ? live.tags : [])),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

function getAllYears(lives) {
  return Array.from(
    new Set(
      lives.map((live) => String(live.year || "").trim()).filter(Boolean),
    ),
  ).sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));
}

function getAllStatuses(lives) {
  return Array.from(
    new Set(
      lives.map((live) => String(live.status || "").trim()).filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

function getLiveMonth(live) {
  const [, month = ""] = String(live.date || "").split("/");
  return month.padStart(2, "0");
}

function getAvailableMonths(lives, year) {
  return Array.from(
    new Set(
      lives
        .filter((live) => year === "all" || live.year === year)
        .map(getLiveMonth)
        .filter(Boolean),
    ),
  ).sort((left, right) => Number(left) - Number(right));
}

function parseDate(value) {
  const [day = "01", month = "01", year = "1900"] = String(value || "").split("/");
  return `${year}-${month}-${day}`;
}

function buildSearchHaystack(live) {
  return [live.title, ...(live.tags || []), live.additional_info].join(" ").toLowerCase();
}

function buildId() {
  return `new_${Date.now()}`;
}

const INITIAL_VISIBLE_COUNT = 80;
const LOAD_MORE_COUNT = 80;
const EMPTY_LIST = [];
const EMPTY_OBJECT = {};
const GOD_EXCLUDED_PERMISSION_CODES = new Set(["anime.rating.streamer"]);
const VIEW_LABELS = {
  home: "Inicio",
  rtfm: "RTFM",
  news: "Novedades",
  changelog: "Historial de cambios",
  notifications: "Notificaciones",
  tracker: "Rastreador de directos",
  trackerCalendar: "Calendario de directos",
  myList: "Mi lista",
  myAnimeList: "Mi lista anime",
  animeLibraryTracking: "Viendo",
  animeLibraryCompleted: "Anime terminados",
  platformTracker: "Mantenedor Rastreador",
  platformTags: "Mantenedor Tags",
  platformSpaceDrumChapters: "Mantenedor SpaceDrum",
  platformSpaceDrumPages: "Páginas SpaceDrum",
  platformSpaceDrumSettings: "Configuración SpaceDrum",
  platformSpaceDrumImport: "Importación SpaceDrum",
  platformAnimeTracking: "Mantenedor Viendo",
  platformAnimeCompleted: "Mantenedor Terminados",
  platformUsers: "Usuarios",
  platformRoles: "Roles",
  platformNotifications: "Mantenedor Notificaciones",
  spacedrum: "SpaceDrum",
};

const VIEW_PATHS = {
  home: "/inicio",
  rtfm: "/rtfm",
  news: "/novedades",
  changelog: "/changelog",
  notifications: "/notificaciones",
  tracker: "/rastreador",
  trackerCalendar: "/rastreador/calendario",
  myList: "/mi-lista",
  myAnimeList: "/mi-lista/anime",
  animeLibraryTracking: "/biblioteca-anime/viendo",
  animeLibraryCompleted: "/biblioteca-anime/terminados",
  platformTracker: "/administracion/rastreador",
  platformTags: "/administracion/tags",
  platformSpaceDrumChapters: "/administracion/spacedrum/capitulos",
  platformSpaceDrumPages: "/administracion/spacedrum/paginas",
  platformSpaceDrumSettings: "/administracion/spacedrum/configuracion",
  platformSpaceDrumImport: "/administracion/spacedrum/importacion",
  platformAnimeTracking: "/administracion/biblioteca-anime/viendo",
  platformAnimeCompleted: "/administracion/biblioteca-anime/terminados",
  platformUsers: "/administracion/usuarios",
  platformRoles: "/administracion/roles",
  platformNotifications: "/administracion/notificaciones",
  spacedrum: "/spacedrum",
};
const TRACKER_RETURN_STATE_KEY = "kala_tracker_return_state";
const COMMUNITY_SPREADSHEET_URL = process.env.NEXT_PUBLIC_COMMUNITY_SPREADSHEET_URL
  || "https://onedrive.live.com/:x:/g/personal/87dad8f5b07a6f01/IQABb3qw9djaIICHlm4AAAAAAYc3We7evL0vIGHpS_nUDf8?rtime=ut4s6g6U3kg&redeem=aHR0cHM6Ly8xZHJ2Lm1zL3gvYy84N2RhZDhmNWIwN2E2ZjAxL0lRQUJiM3F3OWRqYUlJQ0hsbTRBQUFBQUFZYzNXZTdldkwwdklHSHBTX25VRGY4";
const DEFAULT_TRACKER_FILTERS = { search: "", year: "all", month: "all", status: "all" };
const DEFAULT_TRACKER_STATE = {
  filters: DEFAULT_TRACKER_FILTERS,
  selectedTag: "",
  visibleCount: INITIAL_VISIBLE_COUNT,
};

function getViewFromPath(pathname) {
  return Object.entries(VIEW_PATHS).find(([, path]) => path === pathname)?.[0] || "home";
}

function getTrackerStateFromSearchParams(searchParams) {
  return {
    filters: {
      search: searchParams.get("search") || searchParams.get("q") || "",
      year: searchParams.get("year") || "all",
      month: searchParams.get("month") || "all",
      status: searchParams.get("status") || "all",
    },
    selectedTag: searchParams.get("tag") || "",
  };
}

function areTrackerFiltersEqual(left, right) {
  return (
    left.search === right.search &&
    left.year === right.year &&
    left.month === right.month &&
    left.status === right.status
  );
}

function areLiveActivityMapsEqual(left = EMPTY_OBJECT, right = EMPTY_OBJECT) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => {
    const leftItem = left[key] || {};
    const rightItem = right[key] || {};
    return (
      rightKeys.includes(key) &&
      leftItem.isSaved === rightItem.isSaved &&
      leftItem.isWatched === rightItem.isWatched &&
      leftItem.savedAt === rightItem.savedAt &&
      leftItem.watchedAt === rightItem.watchedAt &&
      leftItem.updatedAt === rightItem.updatedAt
    );
  });
}

function areSpaceDrumProgressMapsEqual(left = EMPTY_OBJECT, right = EMPTY_OBJECT) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => {
    const leftItem = left[key] || {};
    const rightItem = right[key] || {};
    const leftReadIds = Array.isArray(leftItem.readChapterIds) ? leftItem.readChapterIds : [];
    const rightReadIds = Array.isArray(rightItem.readChapterIds) ? rightItem.readChapterIds : [];

    return (
      rightKeys.includes(key) &&
      leftItem.language === rightItem.language &&
      leftItem.lastChapterId === rightItem.lastChapterId &&
      leftItem.updatedAt === rightItem.updatedAt &&
      leftReadIds.length === rightReadIds.length &&
      leftReadIds.every((id, index) => id === rightReadIds[index])
    );
  });
}

function hasSpaceDrumLibraryContent(data) {
  if (!data) {
    return false;
  }

  if (data.languages) {
    return Object.values(data.languages).some((language) => Array.isArray(language?.chapters) && language.chapters.length > 0);
  }

  return Array.isArray(data.chapters) && data.chapters.length > 0;
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};
  return JSON.parse(text);
}

function wasDiscoveryToastShown(key) {
  try {
    const storageKey = `kala_discovery_${key}`;
    if (window.localStorage.getItem(storageKey)) {
      return true;
    }

    window.localStorage.setItem(storageKey, "1");
    return false;
  } catch {
    return false;
  }
}

export default function HomePage({
  activeView = "home",
  initialLives = EMPTY_LIST,
  initialLiveStatuses = LIVE_STATUS_OPTIONS,
  initialAnimeLibrary = EMPTY_LIST,
  initialPlatformUsers = EMPTY_LIST,
  initialPlatformRoles = EMPTY_LIST,
  initialPlatformPermissions = EMPTY_LIST,
  initialSpaceDrum = null,
  initialSpaceDrumChapters = EMPTY_LIST,
  initialSpaceDrumPages = EMPTY_LIST,
  initialSpaceDrumSettings = EMPTY_LIST,
  initialSpaceDrumImportSummary = null,
  initialSpaceDrumProgress = EMPTY_OBJECT,
  initialYoutubeVideos = EMPTY_LIST,
  initialTwitchStream = null,
  initialTwitchProfile = null,
  initialTwitchChannelInfo = null,
  initialTwitchGame = null,
  initialLiveActivity = EMPTY_OBJECT,
  initialAnimeActivity = EMPTY_OBJECT,
  initialStreamerRatings = EMPTY_OBJECT,
  initialUserRatings = EMPTY_OBJECT,
  initialNotificationsResult = null,
  initialAdminNotificationsResult = null,
  twitchLogin,
  youtubeChannelUrl,
  isAdmin,
  currentUser = null,
  accessPermissions = EMPTY_LIST,
}) {
  const effectivePermissions = useMemo(() => new Set(accessPermissions.length ? accessPermissions : currentUser?.permissions || []), [accessPermissions, currentUser?.permissions]);
  const hasPermission = (permission) => (currentUser?.role === "dios" && !GOD_EXCLUDED_PERMISSION_CODES.has(permission)) || effectivePermissions.has(permission);
  const canManageUsers = hasPermission("users.read");
  const canManageRoles = hasPermission("roles.read");
  const canViewNotifications = hasPermission("notifications.view");
  const canViewAllNotifications = hasPermission("notifications.full.view");
  const canViewNotificationMaintainer = hasPermission("admin.notifications.view");
  const canCreateNotifications = hasPermission("admin.notifications.create");
  const canUpdateNotifications = hasPermission("admin.notifications.update");
  const canDeleteNotifications = hasPermission("admin.notifications.delete");
  const canCreateTracker = hasPermission("tracker.create");
  const canUpdateTracker = hasPermission("tracker.update");
  const canDeleteTracker = hasPermission("tracker.delete");
  const canNotifyTracker = hasPermission("tracker.lives.notify");
  const trackerFormVariant = hasPermission("tracker.form.full")
    ? "full"
    : hasPermission("tracker.form.compact")
      ? "compact"
      : null;
  const canViewTrackerMaintainer = hasPermission("admin.tracker.view");
  const canManageTracker = canViewTrackerMaintainer && (canCreateTracker || canUpdateTracker || canDeleteTracker);
  const canViewTagsMaintainer = hasPermission("admin.tags.view");
  const canCreateTags = hasPermission("tags.create");
  const canUpdateTags = hasPermission("tags.update");
  const canDeleteTags = hasPermission("tags.delete");
  const canCreateTrackingAnime = hasPermission("anime.tracking.create");
  const canUpdateTrackingAnime = hasPermission("anime.tracking.update");
  const canDeleteTrackingAnime = hasPermission("anime.tracking.delete");
  const trackingAnimeFormVariant = hasPermission("anime.tracking.form.full")
    ? "full"
    : hasPermission("anime.tracking.form.compact")
      ? "compact"
      : null;
  const canCreateCompletedAnime = hasPermission("anime.completed.create");
  const canUpdateCompletedAnime = hasPermission("anime.completed.update");
  const canDeleteCompletedAnime = hasPermission("anime.completed.delete");
  const completedAnimeFormVariant = hasPermission("anime.completed.form.full")
    ? "full"
    : hasPermission("anime.completed.form.compact")
      ? "compact"
      : null;
  const canViewTrackingAnimeMaintainer = hasPermission("admin.anime.tracking.view");
  const canViewCompletedAnimeMaintainer = hasPermission("admin.anime.completed.view");
  const canManageTrackingAnime = canViewTrackingAnimeMaintainer && (canCreateTrackingAnime || canUpdateTrackingAnime || canDeleteTrackingAnime);
  const canManageCompletedAnime = canViewCompletedAnimeMaintainer && (canCreateCompletedAnime || canUpdateCompletedAnime || canDeleteCompletedAnime);
  const canViewSpaceDrumChaptersMaintainer = hasPermission("admin.spacedrum.chapters.view");
  const canCreateSpaceDrumChapters = hasPermission("admin.spacedrum.chapters.create");
  const canUpdateSpaceDrumChapters = hasPermission("admin.spacedrum.chapters.update");
  const canDeleteSpaceDrumChapters = hasPermission("admin.spacedrum.chapters.delete");
  const canViewSpaceDrumPagesMaintainer = hasPermission("admin.spacedrum.pages.view");
  const canCreateSpaceDrumPages = hasPermission("admin.spacedrum.pages.create");
  const canUpdateSpaceDrumPages = hasPermission("admin.spacedrum.pages.update");
  const canDeleteSpaceDrumPages = hasPermission("admin.spacedrum.pages.delete");
  const canViewSpaceDrumSettingsMaintainer = hasPermission("admin.spacedrum.settings.view");
  const canUpdateSpaceDrumSettings = hasPermission("admin.spacedrum.settings.update");
  const canViewSpaceDrumImportMaintainer = hasPermission("admin.spacedrum.import.view");
  const canRunSpaceDrumImport = hasPermission("admin.spacedrum.import.run");
  const canManageSpaceDrum = canViewSpaceDrumChaptersMaintainer
    || canViewSpaceDrumPagesMaintainer
    || canViewSpaceDrumSettingsMaintainer
    || canViewSpaceDrumImportMaintainer;
  const isAuthenticated = Boolean(currentUser?.id);
  const searchParams = useSearchParams();
  const [lives, setLives] = useState(initialLives);
  const [liveStatuses, setLiveStatuses] = useState(initialLiveStatuses.length ? initialLiveStatuses : LIVE_STATUS_OPTIONS);
  const [animeLibrary, setAnimeLibrary] = useState(initialAnimeLibrary);
  const [animeActivity, setAnimeActivity] = useState(initialAnimeActivity || {});
  const [animeStreamerRatings, setAnimeStreamerRatings] = useState(initialStreamerRatings || {});
  const [animeUserRatings, setAnimeUserRatings] = useState(initialUserRatings || {});
  const [isAnimeLibraryLoading, setIsAnimeLibraryLoading] = useState(false);
  const [spaceDrumData, setSpaceDrumData] = useState(initialSpaceDrum);
  const [spaceDrumProgress, setSpaceDrumProgress] = useState(initialSpaceDrumProgress || EMPTY_OBJECT);
  const [isSpaceDrumLoading, setIsSpaceDrumLoading] = useState(false);
  const [spaceDrumAdminChapters, setSpaceDrumAdminChapters] = useState(initialSpaceDrumChapters);
  const [spaceDrumAdminPages, setSpaceDrumAdminPages] = useState(initialSpaceDrumPages);
  const [spaceDrumAdminSettings, setSpaceDrumAdminSettings] = useState(initialSpaceDrumSettings);
  const [spaceDrumAdminImportSummary, setSpaceDrumAdminImportSummary] = useState(initialSpaceDrumImportSummary);
  const [currentView, setCurrentView] = useState(activeView);
  const [trackerViewStates, setTrackerViewStates] = useState(() => {
    const queryState = activeView === "tracker" ? getTrackerStateFromSearchParams(searchParams) : null;
    return {
      tracker: queryState
        ? { ...DEFAULT_TRACKER_STATE, filters: queryState.filters, selectedTag: queryState.selectedTag }
        : DEFAULT_TRACKER_STATE,
      trackerCalendar: DEFAULT_TRACKER_STATE,
      myList: DEFAULT_TRACKER_STATE,
    };
  });
  const activeTrackerState = trackerViewStates[currentView] || DEFAULT_TRACKER_STATE;
  const filters = activeTrackerState.filters;
  const selectedTag = activeTrackerState.selectedTag;
  const visibleCount = activeTrackerState.visibleCount;
  const [personalFilter, setPersonalFilter] = useState(activeView === "myList" ? "saved" : "all");
  const [liveActivity, setLiveActivity] = useState(initialLiveActivity || {});
  const [isTagPanelOpen, setIsTagPanelOpen] = useState(false);
  const [isLoreOpen, setIsLoreOpen] = useState(false);
  const [editingLive, setEditingLive] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTwitchActionLoading, setIsTwitchActionLoading] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [pendingNotifyLive, setPendingNotifyLive] = useState(null);
  const [isNotifying, setIsNotifying] = useState(false);
  const [pendingTrackerRestore, setPendingTrackerRestore] = useState(null);
  const [cardDensity, setCardDensity] = useState("comfortable");
  const [isTableViewAvailable, setIsTableViewAvailable] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CARD_DENSITY_STORAGE_KEY);
      const version = window.localStorage.getItem(CARD_DENSITY_VERSION_KEY);
      setCardDensity(saved === "compact" && version !== CURRENT_CARD_DENSITY_VERSION ? "table" : normalizeCardDensity(saved));
    } catch {}
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia(TABLE_VIEW_MEDIA_QUERY);
    const syncTableAvailability = () => setIsTableViewAvailable(mediaQuery.matches);

    syncTableAvailability();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", syncTableAvailability);
      return () => mediaQuery.removeEventListener("change", syncTableAvailability);
    }

    mediaQuery.addListener(syncTableAvailability);
    return () => mediaQuery.removeListener(syncTableAvailability);
  }, []);

  const effectiveCardDensity = cardDensity === "table" && !isTableViewAvailable ? "compact" : cardDensity;

  function setPreferredCardDensity(nextDensity) {
    const normalizedDensity = normalizeCardDensity(nextDensity);
    setCardDensity(normalizedDensity);
    try {
      window.localStorage.setItem(CARD_DENSITY_STORAGE_KEY, normalizedDensity);
      window.localStorage.setItem(CARD_DENSITY_VERSION_KEY, CURRENT_CARD_DENSITY_VERSION);
    } catch {}
  }

  const [isPending, startTransition] = useTransition();
  const deferredSearch = useDeferredValue(filters.search);
  const loadMoreRef = useRef(null);
  const didRestoreTrackerRef = useRef(false);
  const didSyncInitialViewRef = useRef(false);
  const skipVisibleResetRef = useRef({ tracker: false, myList: false });

  useEffect(() => {
    setLives(initialLives);
  }, [initialLives]);

  useEffect(() => {
    setLiveStatuses(initialLiveStatuses.length ? initialLiveStatuses : LIVE_STATUS_OPTIONS);
  }, [initialLiveStatuses]);

  useEffect(() => {
    setLiveActivity((current) => (
      areLiveActivityMapsEqual(current, initialLiveActivity || EMPTY_OBJECT)
        ? current
        : initialLiveActivity || EMPTY_OBJECT
    ));
  }, [initialLiveActivity]);

  useEffect(() => {
    setAnimeLibrary(initialAnimeLibrary);
  }, [initialAnimeLibrary]);

  useEffect(() => {
    setAnimeStreamerRatings(initialStreamerRatings || EMPTY_OBJECT);
  }, [initialStreamerRatings]);

  useEffect(() => {
    setAnimeUserRatings(initialUserRatings || EMPTY_OBJECT);
  }, [initialUserRatings]);

  useEffect(() => {
    setSpaceDrumData(initialSpaceDrum);
  }, [initialSpaceDrum]);

  useEffect(() => {
    setSpaceDrumAdminChapters(initialSpaceDrumChapters);
  }, [initialSpaceDrumChapters]);

  useEffect(() => {
    setSpaceDrumAdminPages(initialSpaceDrumPages);
  }, [initialSpaceDrumPages]);

  useEffect(() => {
    setSpaceDrumAdminSettings(initialSpaceDrumSettings);
  }, [initialSpaceDrumSettings]);

  useEffect(() => {
    setSpaceDrumAdminImportSummary(initialSpaceDrumImportSummary);
  }, [initialSpaceDrumImportSummary]);

  useEffect(() => {
    setSpaceDrumProgress((current) => (
      areSpaceDrumProgressMapsEqual(current, initialSpaceDrumProgress || EMPTY_OBJECT)
        ? current
        : initialSpaceDrumProgress || EMPTY_OBJECT
    ));
  }, [initialSpaceDrumProgress]);

  useEffect(() => {
    if (currentView !== "spacedrum" || !hasPermission("spacedrum.view")) {
      return undefined;
    }

    let isMounted = true;

    async function loadSpaceDrum() {
      if (!hasSpaceDrumLibraryContent(spaceDrumData)) {
        setIsSpaceDrumLoading(true);
      }

      try {
        const response = await fetch("/api/spacedrum", { cache: "no-store" });
        const payload = await response.json().catch(() => null);

        if (!isMounted) {
          return;
        }

        if (response.status === 401) {
          toast.error("No tienes permiso para ver SpaceDrum.");
          return;
        }

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || "No se pudo cargar SpaceDrum.");
        }

        setSpaceDrumData(payload.spacedrum || null);
        setSpaceDrumProgress(payload.progress || EMPTY_OBJECT);
      } catch (error) {
        if (isMounted) {
          toast.error(error.message || "No se pudo cargar SpaceDrum.");
        }
      } finally {
        if (isMounted) {
          setIsSpaceDrumLoading(false);
        }
      }
    }

    loadSpaceDrum();

    return () => {
      isMounted = false;
    };
  }, [currentView, currentUser?.id, effectivePermissions]);

  useEffect(() => {
    const canViewCurrentSpaceDrumAdminView = (
      (currentView === "platformSpaceDrumChapters" && canViewSpaceDrumChaptersMaintainer)
      || (currentView === "platformSpaceDrumPages" && canViewSpaceDrumPagesMaintainer)
      || (currentView === "platformSpaceDrumSettings" && canViewSpaceDrumSettingsMaintainer)
      || (currentView === "platformSpaceDrumImport" && canViewSpaceDrumImportMaintainer)
    );

    if (!canViewCurrentSpaceDrumAdminView) {
      return undefined;
    }

    const endpointByView = {
      platformSpaceDrumChapters: "/api/admin/spacedrum/chapters",
      platformSpaceDrumPages: "/api/admin/spacedrum/pages",
      platformSpaceDrumSettings: "/api/admin/spacedrum/settings",
      platformSpaceDrumImport: "/api/admin/spacedrum/import",
    };

    let isMounted = true;

    async function loadSpaceDrumAdminData() {
      try {
        const response = await fetch(endpointByView[currentView], { cache: "no-store" });
        const payload = await readJsonResponse(response);

        if (!isMounted) {
          return;
        }

        if (response.status === 401) {
          toast.error("Tu sesión ya no es válida. Vuelve a iniciar sesión.");
          window.location.href = "/login";
          return;
        }

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || "No se pudo cargar SpaceDrum administración.");
        }

        if (currentView === "platformSpaceDrumChapters") {
          setSpaceDrumAdminChapters(payload.chapters || []);
        }

        if (currentView === "platformSpaceDrumPages") {
          setSpaceDrumAdminPages(payload.pages || []);
          setSpaceDrumAdminChapters(payload.chapters || []);
        }

        if (currentView === "platformSpaceDrumSettings") {
          setSpaceDrumAdminSettings(payload.settings || []);
        }

        if (currentView === "platformSpaceDrumImport") {
          setSpaceDrumAdminImportSummary(payload.summary || null);
        }
      } catch (error) {
        if (isMounted) {
          toast.error(error.message || "No se pudo cargar SpaceDrum administración.");
        }
      }
    }

    loadSpaceDrumAdminData();

    return () => {
      isMounted = false;
    };
  }, [
    canViewSpaceDrumChaptersMaintainer,
    canViewSpaceDrumImportMaintainer,
    canViewSpaceDrumPagesMaintainer,
    canViewSpaceDrumSettingsMaintainer,
    currentView,
  ]);

  useEffect(() => {
    if (!didSyncInitialViewRef.current) {
      didSyncInitialViewRef.current = true;
      return;
    }

    setCurrentView(activeView);
  }, [activeView]);

  useEffect(() => {
    if (currentView === "myList" && personalFilter === "all") {
      setPersonalFilter("saved");
      return;
    }

    if (currentView === "tracker" && personalFilter !== "all") {
      setPersonalFilter("all");
    }
  }, [currentView, personalFilter]);

  function redirectToLoginWithMessage(message) {
    setEditingLive(null);
    toast.error(message || "Tu sesión de admin ya no es válida. Vuelve a iniciar sesión.");
    window.location.href = "/login";
  }

  function updateTrackerViewState(view, updater) {
    setTrackerViewStates((current) => {
      const previous = current[view] || DEFAULT_TRACKER_STATE;
      const next = typeof updater === "function" ? updater(previous) : updater;

      return {
        ...current,
        [view]: {
          ...DEFAULT_TRACKER_STATE,
          ...previous,
          ...next,
          filters: {
            ...DEFAULT_TRACKER_FILTERS,
            ...(next?.filters || previous.filters || {}),
          },
        },
      };
    });
  }

  function updateCurrentTrackerState(updater) {
    updateTrackerViewState(currentView, updater);
  }

  function setCurrentFilters(updater) {
    updateCurrentTrackerState((previous) => ({
      filters: typeof updater === "function" ? updater(previous.filters) : updater,
    }));
  }

  function setCurrentSelectedTag(updater) {
    updateCurrentTrackerState((previous) => ({
      selectedTag: typeof updater === "function" ? updater(previous.selectedTag) : updater,
    }));
  }

  function setCurrentVisibleCount(updater) {
    updateCurrentTrackerState((previous) => ({
      visibleCount: typeof updater === "function" ? updater(previous.visibleCount) : updater,
    }));
  }

  const stats = useMemo(() => {
    const years = new Set(lives.map((live) => live.year).filter(Boolean));
    const lost = lives.filter((live) => String(live.status || "").toLowerCase().includes("lost")).length;
    return { total: lives.length, years: years.size, lost };
  }, [lives]);

  const preparedLives = useMemo(() => {
    return lives.map((live) => ({
      ...live,
      _searchHaystack: buildSearchHaystack(live),
      _sortDate: parseDate(live.date),
      _month: getLiveMonth(live),
    }));
  }, [lives]);

  const filteredLives = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();

    return [...preparedLives]
      .filter((live) => {
        const searchMatch = !normalizedSearch || live._searchHaystack.includes(normalizedSearch);
        const yearMatch = filters.year === "all" || live.year === filters.year;
        const monthMatch = filters.month === "all" || live._month === filters.month;
        const statusMatch = filters.status === "all" || live.status === filters.status;
        const tagMatch = !selectedTag || (live.tags || []).includes(selectedTag);
        const activity = liveActivity[live.id];
        const personalMatch = personalFilter === "all"
          || (personalFilter === "saved" && activity?.isSaved)
          || (personalFilter === "watched" && activity?.isWatched)
          || (personalFilter === "pending" && activity?.isSaved && !activity?.isWatched);
        return searchMatch && yearMatch && monthMatch && statusMatch && tagMatch && personalMatch;
      })
      .sort((left, right) => right._sortDate.localeCompare(left._sortDate));
  }, [deferredSearch, filters.month, filters.status, filters.year, liveActivity, personalFilter, preparedLives, selectedTag]);

  const visibleLives = useMemo(() => {
    return filteredLives.slice(0, visibleCount);
  }, [filteredLives, visibleCount]);
  const hasMoreLives = visibleLives.length < filteredLives.length;

  const allYears = useMemo(() => getAllYears(lives), [lives]);
  const availableMonths = useMemo(() => getAvailableMonths(lives, filters.year), [filters.year, lives]);
  const allStatuses = useMemo(() => getAllStatuses(lives), [lives]);
  const allTags = useMemo(() => getAllTags(lives), [lives]);
  const tagCounts = useMemo(() => {
    return lives.reduce((counts, live) => {
      (Array.isArray(live.tags) ? live.tags : []).forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
      return counts;
    }, {});
  }, [lives]);
  const personalCounts = useMemo(() => {
    return Object.values(liveActivity).reduce((counts, activity) => {
      if (activity?.isSaved) {
        counts.saved += 1;
      }

      if (activity?.isWatched) {
        counts.watched += 1;
      }

      if (activity?.isSaved && !activity?.isWatched) {
        counts.pending += 1;
      }

      return counts;
    }, { saved: 0, watched: 0, pending: 0 });
  }, [liveActivity]);

  useEffect(() => {
    function handlePathChange(event) {
      const nextPath = event.detail?.path || window.location.pathname;
      setCurrentView(getViewFromPath(nextPath));
    }

    window.addEventListener("popstate", handlePathChange);
    window.addEventListener("kala:navigation", handlePathChange);

    return () => {
      window.removeEventListener("popstate", handlePathChange);
      window.removeEventListener("kala:navigation", handlePathChange);
    };
  }, []);

  useEffect(() => {
    if (currentView !== "tracker") {
      return;
    }

    const queryState = getTrackerStateFromSearchParams(searchParams);

    updateTrackerViewState("tracker", (previous) => ({
      filters: areTrackerFiltersEqual(previous.filters, queryState.filters) ? previous.filters : queryState.filters,
      selectedTag: previous.selectedTag === queryState.selectedTag ? previous.selectedTag : queryState.selectedTag,
    }));
  }, [currentView, searchParams]);

  useEffect(() => {
    if (currentView !== "tracker" || didRestoreTrackerRef.current) {
      return;
    }

    didRestoreTrackerRef.current = true;

    try {
      const rawState = window.sessionStorage.getItem(TRACKER_RETURN_STATE_KEY);

      if (!rawState) {
        return;
      }

      const savedState = JSON.parse(rawState);
      window.sessionStorage.removeItem(TRACKER_RETURN_STATE_KEY);

      if (savedState?.filters) {
        skipVisibleResetRef.current.tracker = true;
        updateTrackerViewState("tracker", {
          filters: {
            search: savedState.filters.search || "",
            year: savedState.filters.year || "all",
            month: savedState.filters.month || "all",
            status: savedState.filters.status || "all",
          },
        });
      }

      updateTrackerViewState("tracker", {
        selectedTag: savedState?.selectedTag || "",
        visibleCount: Math.max(Number(savedState?.visibleCount) || INITIAL_VISIBLE_COUNT, INITIAL_VISIBLE_COUNT),
      });
      setPendingTrackerRestore({
        liveId: savedState?.liveId || "",
        scrollY: Number(savedState?.scrollY) || 0,
      });
    } catch {
      window.sessionStorage.removeItem(TRACKER_RETURN_STATE_KEY);
    }
  }, [currentView]);

  useEffect(() => {
    if (!["home", "tracker", "trackerCalendar", "myList"].includes(currentView) || lives.length) {
      return undefined;
    }

    let isMounted = true;

    async function loadLives() {
      try {
        const response = await fetch("/api/lives", { cache: "no-store" });
        const data = await response.json();

        if (isMounted && response.ok) {
          setLives(data.lives || []);
          setLiveStatuses(data.statuses || LIVE_STATUS_OPTIONS);
        }
      } catch {
        if (isMounted && currentView !== "home") {
          toast.error("No se pudieron cargar los directos.");
        }
      }
    }

    loadLives();

    return () => {
      isMounted = false;
    };
  }, [currentView, lives.length]);

  useEffect(() => {
    if (!["tracker", "trackerCalendar", "myList"].includes(currentView) || !isAuthenticated) {
      return;
    }

    refreshLiveActivity();
  }, [currentView, isAuthenticated]);

  useEffect(() => {
    if (!["animeLibraryTracking", "animeLibraryCompleted", "myAnimeList"].includes(currentView)) {
      return undefined;
    }

    let isMounted = true;

    async function loadAnimeLibrary() {
      if (!animeLibrary.length) {
        setIsAnimeLibraryLoading(true);
      }

      try {
        const response = await fetch("/api/anime-library", { cache: "no-store" });
        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(data?.error || "No se pudo cargar la biblioteca de anime.");
        }

        if (isMounted) {
          setAnimeLibrary(data.animes || []);
          setAnimeActivity(data.activity || {});
          setAnimeStreamerRatings(data.streamerRatings || {});
          setAnimeUserRatings(data.userRatings || {});
        }
      } catch (error) {
        if (isMounted) {
          toast.error(error.message || "No se pudo cargar la biblioteca de anime.");
        }
      } finally {
        if (isMounted) {
          setIsAnimeLibraryLoading(false);
        }
      }
    }

    loadAnimeLibrary();

    return () => {
      isMounted = false;
    };
  }, [currentView, currentUser?.id]);

  useEffect(() => {
    if (skipVisibleResetRef.current[currentView]) {
      skipVisibleResetRef.current[currentView] = false;
      return;
    }

    setCurrentVisibleCount(INITIAL_VISIBLE_COUNT);
  }, [deferredSearch, filters.month, filters.status, filters.year, personalFilter, selectedTag]);

  useEffect(() => {
    if (filters.month === "all" || availableMonths.includes(filters.month)) {
      return;
    }

    setCurrentFilters((current) => ({ ...current, month: "all" }));
  }, [availableMonths, filters.month]);

  useEffect(() => {
    if (currentView !== "tracker" || !pendingTrackerRestore || !visibleLives.length) {
      return;
    }

    const target = pendingTrackerRestore.liveId
      ? document.querySelector(`[data-live-id="${CSS.escape(pendingTrackerRestore.liveId)}"]`)
      : null;

    requestAnimationFrame(() => {
      if (target) {
        target.scrollIntoView({ block: "center" });
      } else {
        window.scrollTo({ top: pendingTrackerRestore.scrollY, behavior: "instant" });
      }

      setPendingTrackerRestore(null);
    });
  }, [currentView, pendingTrackerRestore, visibleLives.length]);


  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 899px)");

    function syncCardDensity(event) {
      if (event.matches) {
        setCardDensity("comfortable");
      }
    }

    syncCardDensity(mediaQuery);
    mediaQuery.addEventListener("change", syncCardDensity);

    return () => mediaQuery.removeEventListener("change", syncCardDensity);
  }, []);

  useEffect(() => {
    if (!["tracker", "myList"].includes(currentView)) {
      return undefined;
    }

    if (!hasMoreLives || !loadMoreRef.current) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          return;
        }

        setCurrentVisibleCount((current) => Math.min(current + LOAD_MORE_COUNT, filteredLives.length));
      },
      {
        root: null,
        rootMargin: "900px 0px",
        threshold: 0,
      },
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [currentView, filteredLives.length, hasMoreLives]);

  async function uploadImage(file) {
    if (!canCreateTracker && !canUpdateTracker && !canCreateTrackingAnime && !canUpdateTrackingAnime && !canCreateCompletedAnime && !canUpdateCompletedAnime) {
      throw new Error("No tienes permiso para subir imágenes.");
    }

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();

    if (response.status === 401) {
      redirectToLoginWithMessage("No autorizado para subir imágenes. Vuelve a iniciar sesión.");
      throw new Error("Sesion expirada");
    }

    if (!response.ok || !data.success) {
      throw new Error(data.error || "No se pudo subir la imagen");
    }

    return data.path;
  }

  async function persistLive(nextLive) {
    if (nextLive?.id && !canUpdateTracker) {
      toast.error("No tienes permiso para editar directos.");
      return;
    }

    if (!nextLive?.id && !canCreateTracker) {
      toast.error("No tienes permiso para crear directos.");
      return;
    }

    setIsSaving(true);

    try {
      let imagePath = nextLive.image || "";

      if (nextLive.imageFile) {
        imagePath = await uploadImage(nextLive.imageFile);
      }

      const payload = {
        ...(nextLive || {}),
        image: imagePath,
      };

      delete payload.imageFile;
      payload.id = payload.id || buildId();

      const response = await fetch("/api/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: nextLive.id ? "upsert" : "create", live: payload }),
      });
      const data = await response.json();

      if (response.status === 401) {
        redirectToLoginWithMessage("No autorizado para guardar cambios. Vuelve a iniciar sesión.");
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo guardar el directo");
      }

      setLives(data.lives);
      setLiveStatuses(data.statuses || liveStatuses);
      setEditingLive(null);
      toast.success("Cambios guardados correctamente.");
    } catch (error) {
      if (error.message !== "Sesión expirada") {
        toast.error(error.message || "No se pudo guardar el directo.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function notifyLive(live) {
    if (!canNotifyTracker) {
      toast.error("No tienes permiso para notificar resubidos.");
      return;
    }

    setIsNotifying(true);

    try {
      const response = await fetch(`/api/lives/${live.dbId}/notify`, { method: "POST" });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data?.error || "No se pudo enviar la notificación.");
      }

      setLives((current) =>
        current.map((l) =>
          l.dbId === live.dbId ? { ...l, notifiedAt: data.notifiedAt } : l,
        ),
      );
      toast.success("Notificación enviada a todos los usuarios.");
    } catch (error) {
      toast.error(error?.message || "No se pudo enviar la notificación.");
    } finally {
      setIsNotifying(false);
      setPendingNotifyLive(null);
    }
  }

  async function deleteLive(id) {
    if (!canDeleteTracker) {
      toast.error("No tienes permiso para eliminar directos.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      const data = await response.json();

      if (response.status === 401) {
        redirectToLoginWithMessage("No autorizado para borrar directos. Vuelve a iniciar sesión.");
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo borrar el directo");
      }

      setLives(data.lives);
      setLiveStatuses(data.statuses || liveStatuses);
      setEditingLive(null);
      setPendingDeleteId(null);
      toast.success("Directo eliminado correctamente.");
    } catch (error) {
      toast.error(error.message || "No se pudo eliminar el directo.");
    } finally {
      setIsSaving(false);
    }
  }

  async function refreshLivesFromServer() {
    try {
      const response = await fetch("/api/lives", { cache: "no-store" });
      const data = await response.json();

      if (response.ok) {
        setLives(data.lives || []);
        setLiveStatuses(data.statuses || LIVE_STATUS_OPTIONS);
      }
    } catch {
      toast.error("No se pudo actualizar el listado de directos.");
    }
  }

  async function refreshLiveActivity() {
    if (!isAuthenticated) {
      return;
    }

    try {
      const response = await fetch("/api/live-activity", { cache: "no-store" });
      const data = await response.json().catch(() => null);

      if (response.ok && data?.success) {
        setLiveActivity(Object.fromEntries((data.activity || []).map((item) => [item.liveId, item])));
      }
    } catch {
      // Personal activity is progressive enhancement; tracker data should still load.
    }
  }

  async function updateLiveActivity(liveId, patch) {
    if (!isAuthenticated) {
      toast.error("Inicia sesión para usar tu lista personal.");
      window.location.href = "/login";
      return;
    }

    const currentActivity = liveActivity[liveId] || { liveId, isSaved: false, isWatched: false };
    const optimisticActivity = {
      ...currentActivity,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    setLiveActivity((current) => ({
      ...current,
      [liveId]: optimisticActivity,
    }));

    try {
      const response = await fetch("/api/live-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liveId, ...patch }),
      });
      const data = await response.json().catch(() => null);

      if (response.status === 401) {
        redirectToLoginWithMessage("Inicia sesión para usar tu lista personal.");
        return;
      }

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "No se pudo guardar tu lista personal.");
      }

      setLiveActivity((current) => ({
        ...current,
        [liveId]: data.activity,
      }));

      if (Object.prototype.hasOwnProperty.call(patch, "isSaved")) {
        toast.success(patch.isSaved
          ? wasDiscoveryToastShown("live_saved")
            ? "Directo guardado."
            : "Directo guardado en Mi lista directos."
          : "Directo quitado de guardados.");
      } else if (Object.prototype.hasOwnProperty.call(patch, "isWatched")) {
        toast.success(patch.isWatched
          ? wasDiscoveryToastShown("live_watched")
            ? "Directo marcado como visto."
            : "Directo marcado como visto. Puedes verlo en Mi lista directos."
          : "Directo marcado como no visto.");
      }
    } catch (error) {
      setLiveActivity((current) => ({
        ...current,
        [liveId]: currentActivity,
      }));
      toast.error(error.message || "No se pudo guardar tu lista personal.");
    }
  }

  function requireLoginForTracker(message) {
    toast(message, {
      action: { label: "Iniciar sesión", onClick: () => { window.location.href = "/login"; } },
    });
  }

  function setPersonalTrackerFilter(nextFilter) {
    if (nextFilter !== "all" && !isAuthenticated) {
      requireLoginForTracker("Inicia sesión para filtrar tu lista personal.");
      return;
    }

    startTransition(() => {
      setPersonalFilter(nextFilter);
    });
  }

  function handleOpenLiveDetail(liveId) {
    saveTrackerReturnState(liveId);

    if (isAuthenticated && !liveActivity[liveId]?.isWatched) {
      updateLiveActivity(liveId, { isWatched: true });
    }
  }

  async function archiveCurrentTwitchLive() {
    if (!canCreateTracker) {
      toast.error("No tienes permiso para crear directos.");
      return;
    }

    setIsTwitchActionLoading(true);

    try {
      const response = await fetch("/api/twitch/archive", { method: "POST" });
      const data = await response.json();

      if (response.status === 401) {
        redirectToLoginWithMessage("No autorizado para crear el card desde Twitch. Vuelve a iniciar sesión.");
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo crear el card desde Twitch");
      }

      if (Array.isArray(data.lives)) {
        setLives(data.lives);
        setLiveStatuses(data.statuses || liveStatuses);
      } else {
        await refreshLivesFromServer();
      }

      toast.success("Card de Twitch creado o actualizado.");
    } catch (error) {
      toast.error(error.message || "No se pudo crear el card desde Twitch.");
    } finally {
      setIsTwitchActionLoading(false);
    }
  }

  async function registerTwitchEventSub() {
    if (!canUpdateTracker) {
      toast.error("No tienes permiso para configurar EventSub.");
      return;
    }

    setIsTwitchActionLoading(true);

    try {
      const response = await fetch("/api/twitch/eventsub/subscribe", { method: "POST" });
      const data = await response.json();

      if (response.status === 401) {
        redirectToLoginWithMessage("No autorizado para registrar EventSub. Vuelve a iniciar sesión.");
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo registrar EventSub");
      }

      toast.success(data.alreadyActive ? "EventSub ya estaba activo para este canal." : "EventSub registrado. Twitch notificará el próximo directo.");
    } catch (error) {
      toast.error(error.message || "No se pudo registrar EventSub.");
    } finally {
      setIsTwitchActionLoading(false);
    }
  }

  function selectView(view) {
    const viewPermissions = {
      home: "home.view",
      rtfm: "rtfm.view",
      news: "news.view",
      changelog: "changelog.view",
      notifications: "notifications.full.view",
      tracker: "tracker.view",
      trackerCalendar: "tracker.calendar.view",
      myList: "tracker.view",
      myAnimeList: "anime.tracking.view",
      animeLibraryTracking: "anime.tracking.view",
      animeLibraryCompleted: "anime.completed.view",
      platformAnimeTracking: "admin.anime.tracking.view",
      platformAnimeCompleted: "admin.anime.completed.view",
      platformTracker: "admin.tracker.view",
      platformTags: "admin.tags.view",
      platformSpaceDrumChapters: "admin.spacedrum.chapters.view",
      platformSpaceDrumPages: "admin.spacedrum.pages.view",
      platformSpaceDrumSettings: "admin.spacedrum.settings.view",
      platformSpaceDrumImport: "admin.spacedrum.import.view",
      platformUsers: "users.read",
      platformRoles: "roles.read",
      platformNotifications: "admin.notifications.view",
      spacedrum: "spacedrum.view",
    };
    const requiredPermission = viewPermissions[view];

    if (requiredPermission && !hasPermission(requiredPermission)) {
      toast.error("No tienes permiso para ver esa pantalla.");
      return;
    }

    const nextPath = VIEW_PATHS[view] || "/inicio";
    window.history.pushState(null, "", nextPath);
    window.dispatchEvent(new CustomEvent("kala:navigation", { detail: { path: nextPath } }));

    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: "instant" });

    if (window.matchMedia("(max-width: 900px)").matches) {
      window.dispatchEvent(new CustomEvent("kala:sidebar:close"));
    }
  }

  function saveTrackerReturnState(liveId) {
    try {
      window.sessionStorage.setItem(
        TRACKER_RETURN_STATE_KEY,
        JSON.stringify({
          filters,
          selectedTag,
          visibleCount,
          liveId,
          sourceView: currentView,
          scrollY: window.scrollY,
        }),
      );
    } catch {
      // Session storage can be unavailable in strict browser modes.
    }
  }

  return (
    <>
      <Toaster position="top-right" richColors closeButton />
      <div className="bg-orb orb-1" aria-hidden="true" />
      <div className="bg-orb orb-2" aria-hidden="true" />
      <div className="bg-orb orb-3" aria-hidden="true" />

      <AppSidebarShell>
        <AppSidebar
          id="main-sidebar"
          activeView={currentView}
          isAdmin={isAdmin}
          canManageUsers={canManageUsers}
          canManageRoles={canManageRoles}
          canManageTracker={canManageTracker}
          canManageTags={canViewTagsMaintainer}
          canManageSpaceDrum={canManageSpaceDrum}
          canManageAnimeTracking={canManageTrackingAnime}
          canManageAnimeCompleted={canManageCompletedAnime}
          isAuthenticated={isAuthenticated}
          canAccess={hasPermission}
          onSelect={selectView}
        />

        <div className="content-shell">
          <header className="topbar" aria-label="Barra superior">
            <div className="topbar-title">
              <span className="topbar-kicker">Archivo VODs</span>
              <span className="topbar-page">{VIEW_LABELS[currentView]}</span>
            </div>

            <div className="topbar-actions">
              {canViewNotifications ? <NotificationCenter user={currentUser} canViewAll={canViewAllNotifications} onViewAll={() => selectView("notifications")} /> : null}
              <AccountMenu user={currentUser} canManageUsers={canManageUsers} />
            </div>
          </header>

          <div className="app-wrapper">
            {currentView === "home" ? (
              <HomeDashboard
                lives={lives}
                youtubeVideos={initialYoutubeVideos}
                twitchStream={initialTwitchStream}
                twitchProfile={initialTwitchProfile}
                twitchChannelInfo={initialTwitchChannelInfo}
                twitchGame={initialTwitchGame}
                twitchLogin={twitchLogin}
                youtubeChannelUrl={youtubeChannelUrl}
                streamlabsUrl={process.env.NEXT_PUBLIC_STREAMLABS_URL}
                onTrackerOpen={() => selectView("tracker")}
              />
            ) : null}

            {currentView === "rtfm" && hasPermission("rtfm.view") ? (
              <RtfmPage
                initialRoles={initialPlatformRoles}
                initialPermissions={initialPlatformPermissions}
                canViewAdminDetails={isAdmin}
                currentUser={currentUser}
              />
            ) : null}

            {currentView === "news" && hasPermission("news.view") ? (
              <NewsGuidePage
                currentUser={currentUser}
                permissions={Array.from(effectivePermissions)}
              />
            ) : null}

            {currentView === "changelog" && hasPermission("changelog.view") ? (
              <ChangelogPage />
            ) : null}

            {currentView === "notifications" && canViewAllNotifications ? <NotificationsPage initialResult={initialNotificationsResult} /> : null}

            {["tracker", "myList"].includes(currentView) ? (
              <>
        <header id="inicio" className="main-header">
          {currentView === "tracker" ? (
            <button type="button" className="header-badge" onClick={() => setIsLoreOpen(true)}>
              <span aria-hidden="true">🚀</span> ARCHIVO HISTORICO
            </button>
          ) : (
            <div className="header-badge"><span aria-hidden="true">⭐</span> LISTA PERSONAL</div>
          )}
          <h1 className="title">
            {currentView === "tracker" ? (
              <>Rastreador de <span className="text-gradient">Directos</span></>
            ) : (
              <>Mi <span className="text-gradient">lista</span></>
            )}
          </h1>
          <p className="subtitle">
            {currentView === "tracker"
              ? "Explora y busca el archivo legendario de VODs y Resubidos."
              : "Tus directos guardados, vistos y por ver en un solo lugar."}
          </p>
        </header>

        {currentView === "tracker" ? (
          <div className="site-notice-container">
          <div className="site-notice-card">
            <span className="notice-badge">INFO</span>
            <p className="notice-text">
              Se utiliza el archivo base de la comunidad. Leer la hoja <strong>RTFM</strong>.
              Creditos a Piero y Redbreake.
            </p>
            <a
              href={COMMUNITY_SPREADSHEET_URL}
              target="_blank"
              rel="noreferrer"
              className="notice-link"
            >
              <span className="link-icon" aria-hidden="true">📂</span> OneDrive
            </a>
          </div>
        </div>
        ) : null}

        {currentView === "tracker" ? <StatsBar stats={stats} /> : null}

        {currentView === "tracker" && (canCreateTracker || canUpdateTracker) ? (
          <section className="tracker-actions public-tracker-actions" aria-label="Acciones del rastreador">
            <div>
              <span className="tracker-actions-label">Rastreador</span>
              <p className="tracker-actions-copy">Gestiona los registros del archivo histórico.</p>
            </div>
            <div className="tracker-actions-buttons">
              {canCreateTracker && trackerFormVariant ? (
                <button type="button" id="btn-add-live" className="tracker-action-primary" onClick={() => setEditingLive({})}>
                  <Plus size={18} />
                  Nuevo directo
                </button>
              ) : null}
              {canCreateTracker ? (
                <button
                  type="button"
                  className="tracker-action-secondary"
                  onClick={archiveCurrentTwitchLive}
                  disabled={isTwitchActionLoading}
                >
                  <Radio size={17} />
                  Crear desde Twitch
                </button>
              ) : null}
              {canUpdateTracker ? (
                <button
                  type="button"
                  className="tracker-action-secondary"
                  onClick={registerTwitchEventSub}
                  disabled={isTwitchActionLoading}
                >
                  <Zap size={17} />
                  Registrar EventSub
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        <FiltersBar
          filters={filters}
          years={allYears}
          months={availableMonths}
          statuses={allStatuses}
          selectedTag={selectedTag}
          onSearchChange={(search) => {
            setCurrentFilters((current) => ({ ...current, search }));
          }}
          onFiltersChange={(partial) =>
            startTransition(() => {
              setCurrentFilters((current) => ({ ...current, ...partial }));
            })
          }
          onTagPanelOpen={() => setIsTagPanelOpen(true)}
          onClearTag={() =>
            startTransition(() => {
              setCurrentSelectedTag("");
            })
          }
        />

        {currentView !== "myList" ? null : (
        <section className={`tracker-personal-panel ${isAuthenticated ? "" : "is-guest"} ${currentView === "myList" ? "is-page" : ""}`} aria-label="Lista personal">
          <div>
            <span className="tracker-actions-label">Mi lista</span>
            <p className="tracker-actions-copy">
              {currentView === "myList"
                ? "Gestiona lo que guardaste y separa lo visto de lo que tienes por ver."
                : isAuthenticated
                  ? "Guarda directos, marca vistos y vuelve rápido a lo que tienes por ver."
                  : "Inicia sesión para guardar directos, marcar vistos y continuar después."}
            </p>
          </div>
          <div className="tracker-personal-filters" role="group" aria-label="Filtros personales">
            {(currentView === "myList"
              ? [
                  { key: "saved", label: "Guardados", count: personalCounts.saved },
                  { key: "pending", label: "Por ver", count: personalCounts.pending },
                  { key: "watched", label: "Vistos", count: personalCounts.watched },
                ]
              : [
                  { key: "all", label: "Todos", count: lives.length },
                  { key: "saved", label: "Mi lista", count: personalCounts.saved },
                  { key: "watched", label: "Vistos", count: personalCounts.watched },
                ]
            ).map((option) => (
              <button
                key={option.key}
                type="button"
                className={`${personalFilter === option.key ? "is-active" : ""} ${option.key !== "all" && option.count === 0 ? "is-empty" : ""}`}
                onClick={() => setPersonalTrackerFilter(option.key)}
              >
                <span>{option.label}</span>
                <strong>{option.count}</strong>
              </button>
            ))}
          </div>
          {!isAuthenticated ? (
            <div className="tracker-personal-auth">
              <a href="/login">Iniciar sesión</a>
              <a href="/registro">Registrarme</a>
            </div>
          ) : null}
        </section>
        )}

        <main>
          {filteredLives.length ? (
            <>
              <div className="results-meta">
                <span>Mostrando {visibleLives.length} de {filteredLives.length} resultados</span>
                {isPending ? <span className="tracker-loading-strip">Actualizando resultados...</span> : null}
                <div className="density-toggle" aria-label="Densidad de tarjetas">
                  <button
                    type="button"
                    className={effectiveCardDensity === "comfortable" ? "is-active" : ""}
                    onClick={() => setPreferredCardDensity("comfortable")}
                  >
                    Cómodo
                  </button>
                  <button
                    type="button"
                    className={effectiveCardDensity === "compact" ? "is-active" : ""}
                    onClick={() => setPreferredCardDensity("compact")}
                  >
                    Compacto
                  </button>
                  <button
                    type="button"
                    className={`density-table-option ${effectiveCardDensity === "table" ? "is-active" : ""}`}
                    onClick={() => setPreferredCardDensity("table")}
                  >
                    Tabla
                  </button>
                </div>
              </div>
              {effectiveCardDensity === "table" ? (
                <div className="lives-compact-shell">
                  <div className="lives-compact-scroll-hint" aria-hidden="true">
                    Desliza horizontalmente para ver más columnas
                  </div>
                  <div id="lives-grid" className="lives-grid lives-grid-compact lives-grid-table">
                    <div className="lives-table-header" role="row" aria-hidden="true">
                      <span>Fecha</span>
                      <span>Título</span>
                      <span>Estado</span>
                      <span>Tags</span>
                      <span>Disponibilidad</span>
                      <span>Acciones</span>
                    </div>
                    {visibleLives.map((live) => (
                      <LiveCard
                        key={live.id}
                        live={live}
                        isAdmin={canUpdateTracker && Boolean(trackerFormVariant)}
                        canNotify={currentView === "tracker" && canNotifyTracker}
                        activity={liveActivity[live.id]}
                        isAuthenticated={isAuthenticated}
                        searchTerm={deferredSearch}
                        onEdit={() => setEditingLive(live)}
                        onNotify={(l) => setPendingNotifyLive(l)}
                        onLoginRequired={requireLoginForTracker}
                        onToggleSaved={(liveId, isSaved) => updateLiveActivity(liveId, { isSaved })}
                        onToggleWatched={(liveId, isWatched) => updateLiveActivity(liveId, { isWatched })}
                        onFilterTag={(tag) =>
                          startTransition(() => {
                            setCurrentSelectedTag(tag);
                          })
                        }
                        onFilterYear={(year) =>
                          startTransition(() => {
                            setCurrentFilters((current) => ({ ...current, year: year || "all", month: "all" }));
                          })
                        }
                        onFilterStatus={(status) =>
                          startTransition(() => {
                            setCurrentFilters((current) => ({ ...current, status: status || "all" }));
                          })
                        }
                        onOpenDetail={handleOpenLiveDetail}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div id="lives-grid" className={`lives-grid ${effectiveCardDensity === "compact" ? "lives-grid-card-compact" : "lives-grid-comfortable"}`}>
                  {visibleLives.map((live) => (
                    <LiveCard
                      key={live.id}
                      live={live}
                      cardDensity={effectiveCardDensity}
                        isAdmin={canUpdateTracker && Boolean(trackerFormVariant)}
                      canNotify={currentView === "tracker" && canNotifyTracker}
                      activity={liveActivity[live.id]}
                      isAuthenticated={isAuthenticated}
                      searchTerm={deferredSearch}
                      onEdit={() => setEditingLive(live)}
                      onNotify={(l) => setPendingNotifyLive(l)}
                      onLoginRequired={requireLoginForTracker}
                      onToggleSaved={(liveId, isSaved) => updateLiveActivity(liveId, { isSaved })}
                      onToggleWatched={(liveId, isWatched) => updateLiveActivity(liveId, { isWatched })}
                      onFilterTag={(tag) =>
                        startTransition(() => {
                          setCurrentSelectedTag(tag);
                        })
                      }
                      onFilterYear={(year) =>
                        startTransition(() => {
                          setCurrentFilters((current) => ({ ...current, year: year || "all", month: "all" }));
                        })
                      }
                      onFilterStatus={(status) =>
                        startTransition(() => {
                          setCurrentFilters((current) => ({ ...current, status: status || "all" }));
                        })
                      }
                      onOpenDetail={handleOpenLiveDetail}
                    />
                  ))}
                </div>
              )}
              {hasMoreLives ? (
                <div ref={loadMoreRef} className="infinite-scroll-sentinel" aria-hidden="true">
                  <span className="infinite-scroll-label">Cargando más resultados…</span>
                </div>
              ) : null}
            </>
          ) : (
              <div className="empty-state">
              <div className="empty-state-icon">VOD</div>
              <div className="empty-state-text">
                {currentView === "myList"
                  ? "Aún no tienes directos en esta vista."
                  : "No hay resultados con esos filtros."}
              </div>
              {currentView === "myList" ? (
                <p className="empty-state-help">
                  Guarda directos desde el rastreador o márcalos como vistos para construir tu lista personal.
                </p>
              ) : null}
              <button
                type="button"
                className="empty-state-action"
                onClick={() => {
                  if (currentView === "myList" && personalCounts.saved + personalCounts.watched === 0) {
                    selectView("tracker");
                    return;
                  }

                  setCurrentFilters({ search: "", year: "all", month: "all", status: "all" });
                  setCurrentSelectedTag("");
                  setPersonalFilter(currentView === "myList" ? "saved" : "all");
                }}
              >
                {currentView === "myList" && personalCounts.saved + personalCounts.watched === 0 ? "Explorar rastreador" : "Limpiar filtros"}
              </button>
            </div>
          )}
        </main>

              </>
            ) : null}

            {currentView === "trackerCalendar" && hasPermission("tracker.calendar.view") ? (
              <TrackerCalendarPage
                lives={lives}
                onOpenDetail={handleOpenLiveDetail}
              />
            ) : null}

            {currentView === "animeLibraryTracking" ? (
              <AnimeLibraryPage
                animes={animeLibrary}
                canCreate={canCreateTrackingAnime && Boolean(trackingAnimeFormVariant)}
                canUpdate={canUpdateTrackingAnime && Boolean(trackingAnimeFormVariant)}
                canDelete={canDeleteTrackingAnime && Boolean(trackingAnimeFormVariant)}
                formVariant={trackingAnimeFormVariant || "compact"}
                isLoading={isAnimeLibraryLoading}
                mode="active"
                cardDensity={effectiveCardDensity}
                onCardDensityChange={setPreferredCardDensity}
                initialActivity={animeActivity}
                initialStreamerRatings={animeStreamerRatings}
                initialUserRatings={animeUserRatings}
                isAuthenticated={isAuthenticated}
                canRate={hasPermission("anime.rating.write")}
                isStreamer={hasPermission("anime.rating.streamer")}
                onAnimesChange={setAnimeLibrary}
                onAnimeActivityChange={setAnimeActivity}
                onUserRatingsChange={setAnimeUserRatings}
                onStreamerRatingsChange={setAnimeStreamerRatings}
              />
            ) : null}

            {currentView === "animeLibraryCompleted" ? (
              <AnimeLibraryPage
                animes={animeLibrary}
                canCreate={canCreateCompletedAnime && Boolean(completedAnimeFormVariant)}
                canUpdate={canUpdateCompletedAnime && Boolean(completedAnimeFormVariant)}
                canDelete={canDeleteCompletedAnime && Boolean(completedAnimeFormVariant)}
                formVariant={completedAnimeFormVariant || "compact"}
                isLoading={isAnimeLibraryLoading}
                mode="completed"
                cardDensity={effectiveCardDensity}
                onCardDensityChange={setPreferredCardDensity}
                initialActivity={animeActivity}
                initialStreamerRatings={animeStreamerRatings}
                initialUserRatings={animeUserRatings}
                isAuthenticated={isAuthenticated}
                canRate={hasPermission("anime.rating.write")}
                isStreamer={hasPermission("anime.rating.streamer")}
                onAnimesChange={setAnimeLibrary}
                onAnimeActivityChange={setAnimeActivity}
                onUserRatingsChange={setAnimeUserRatings}
                onStreamerRatingsChange={setAnimeStreamerRatings}
              />
            ) : null}

            {currentView === "myAnimeList" ? (
              <AnimeLibraryPage
                animes={animeLibrary}
                initialActivity={animeActivity}
                initialStreamerRatings={animeStreamerRatings}
                initialUserRatings={animeUserRatings}
                isAuthenticated={isAuthenticated}
                canRate={hasPermission("anime.rating.write")}
                isStreamer={hasPermission("anime.rating.streamer")}
                isLoading={isAnimeLibraryLoading}
                mode="personal"
                cardDensity={effectiveCardDensity}
                onCardDensityChange={setPreferredCardDensity}
                personalOnly
                onAnimesChange={setAnimeLibrary}
                onAnimeActivityChange={setAnimeActivity}
                onUserRatingsChange={setAnimeUserRatings}
                onStreamerRatingsChange={setAnimeStreamerRatings}
              />
            ) : null}

            {currentView === "spacedrum" && hasPermission("spacedrum.view") ? (
              <SpaceDrumPage
                data={spaceDrumData}
                initialProgress={spaceDrumProgress}
                isAuthenticated={Boolean(currentUser?.id)}
                isLoading={isSpaceDrumLoading}
              />
            ) : null}

            {currentView === "platformUsers" && canManageUsers ? (
              <PlatformUsersPage initialUsers={initialPlatformUsers} initialRoles={initialPlatformRoles} currentUser={currentUser} />
            ) : null}

            {currentView === "platformRoles" && canManageRoles ? (
              <PlatformRolesPage initialRoles={initialPlatformRoles} initialPermissions={initialPlatformPermissions} />
            ) : null}

            {currentView === "platformNotifications" && canViewNotificationMaintainer ? (
              <PlatformNotificationsPage
                initialResult={initialAdminNotificationsResult}
                canCreate={canCreateNotifications}
                canUpdate={canUpdateNotifications}
                canDelete={canDeleteNotifications}
              />
            ) : null}

            {currentView === "platformTracker" && canManageTracker ? (
              <PlatformTrackerMaintainerPage
                initialLives={lives}
                initialStatuses={liveStatuses}
                canCreate={canCreateTracker && Boolean(trackerFormVariant)}
                canUpdate={canUpdateTracker && Boolean(trackerFormVariant)}
                canDelete={canDeleteTracker}
                canNotify={hasPermission("admin.lives.notify")}
                canUpdateTags={canUpdateTags}
                formVariant={trackerFormVariant || "compact"}
                twitchLogin={twitchLogin}
                onLivesChange={setLives}
                onStatusesChange={setLiveStatuses}
              />
            ) : null}

            {currentView === "platformTags" && canViewTagsMaintainer ? (
              <PlatformTagsMaintainerPage
                canCreate={canCreateTags}
                canUpdate={canUpdateTags}
                canDelete={canDeleteTags}
              />
            ) : null}

            {currentView === "platformSpaceDrumChapters" && canViewSpaceDrumChaptersMaintainer ? (
              <PlatformSpaceDrumChaptersPage
                initialChapters={spaceDrumAdminChapters}
                canCreate={canCreateSpaceDrumChapters}
                canUpdate={canUpdateSpaceDrumChapters}
                canDelete={canDeleteSpaceDrumChapters}
                canUpdatePages={canViewSpaceDrumPagesMaintainer}
                onChaptersChange={setSpaceDrumAdminChapters}
                onOpenPages={() => selectView("platformSpaceDrumPages")}
              />
            ) : null}

            {currentView === "platformSpaceDrumPages" && canViewSpaceDrumPagesMaintainer ? (
              <PlatformSpaceDrumPagesPage
                initialPages={spaceDrumAdminPages}
                chapters={spaceDrumAdminChapters}
                canCreate={canCreateSpaceDrumPages}
                canUpdate={canUpdateSpaceDrumPages}
                canDelete={canDeleteSpaceDrumPages}
                onPagesChange={setSpaceDrumAdminPages}
                onChaptersChange={setSpaceDrumAdminChapters}
              />
            ) : null}

            {currentView === "platformSpaceDrumSettings" && canViewSpaceDrumSettingsMaintainer ? (
              <PlatformSpaceDrumSettingsPage
                initialSettings={spaceDrumAdminSettings}
                canUpdate={canUpdateSpaceDrumSettings}
                onSettingsChange={setSpaceDrumAdminSettings}
              />
            ) : null}

            {currentView === "platformSpaceDrumImport" && canViewSpaceDrumImportMaintainer ? (
              <PlatformSpaceDrumImportPage
                initialSummary={spaceDrumAdminImportSummary}
                canRun={canRunSpaceDrumImport}
                onSummaryChange={setSpaceDrumAdminImportSummary}
              />
            ) : null}

            {currentView === "platformAnimeTracking" && canManageTrackingAnime ? (
              <PlatformAnimeMaintainerPage
                initialAnimes={animeLibrary}
                canCreate={canCreateTrackingAnime}
                canUpdate={canUpdateTrackingAnime}
                canDelete={canDeleteTrackingAnime}
                formVariant="full"
                mode="active"
                onAnimesChange={setAnimeLibrary}
              />
            ) : null}

            {currentView === "platformAnimeCompleted" && canManageCompletedAnime ? (
              <PlatformAnimeMaintainerPage
                initialAnimes={animeLibrary}
                canCreate={canCreateCompletedAnime}
                canUpdate={canUpdateCompletedAnime}
                canDelete={canDeleteCompletedAnime}
                formVariant="full"
                mode="completed"
                onAnimesChange={setAnimeLibrary}
              />
            ) : null}
          </div>
          <footer className="persistent-footer">
            <span>Por fans para fans <span aria-hidden="true">💜</span> para Kala</span>
          </footer>
        </div>
      </AppSidebarShell>

      <ConfirmModal
        isOpen={Boolean(pendingNotifyLive)}
        title={pendingNotifyLive?.notifiedAt ? "Reenviar notificación" : "Notificar resubido"}
        description={
          pendingNotifyLive?.notifiedAt
            ? `Este resubido ya fue notificado el ${formatPlatformDateTime(pendingNotifyLive.notifiedAt)}. ¿Enviar de nuevo?`
            : "¿Notificar a todos los usuarios que este resubido está disponible?"
        }
        confirmLabel={pendingNotifyLive?.notifiedAt ? "Sí, reenviar" : "Notificar"}
        cancelLabel="Cancelar"
        isLoading={isNotifying}
        onCancel={() => setPendingNotifyLive(null)}
        onConfirm={() => notifyLive(pendingNotifyLive)}
      />

      <ConfirmModal
        isOpen={Boolean(pendingDeleteId)}
        title="Borrar directo"
        description="Esta acción eliminará el registro del archivo histórico. Puedes volver a crearlo después, pero este cambio se guardará inmediatamente."
        confirmLabel="Sí, borrar"
        cancelLabel="Cancelar"
        tone="danger"
        isLoading={isSaving}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => deleteLive(pendingDeleteId)}
      />

      <LoreModal isOpen={isLoreOpen} onClose={() => setIsLoreOpen(false)} />

      <TrackerMaintainerModal
        live={editingLive && editingLive.id ? editingLive : null}
        isOpen={Boolean(editingLive)}
        onClose={() => setEditingLive(null)}
        onSave={persistLive}
        isSaving={isSaving}
        statuses={liveStatuses}
        availableTags={allTags}
        tagCounts={tagCounts}
        formVariant={trackerFormVariant || "compact"}
        onDelete={canDeleteTracker ? (id) => {
          setEditingLive(null);
          setPendingDeleteId(id);
        } : null}
      />

      <TagPanel
        isOpen={isTagPanelOpen}
        tags={allTags}
        tagCounts={tagCounts}
        selectedTag={selectedTag}
        onClose={() => setIsTagPanelOpen(false)}
        onSelectTag={setCurrentSelectedTag}
        isAdmin={canUpdateTags}
      />
    </>
  );
}
