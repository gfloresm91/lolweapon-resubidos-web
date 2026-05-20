"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Radio, Zap } from "lucide-react";
import { Toaster, toast } from "sonner";

import AccountMenu from "@/components/AccountMenu";
import AnimeLibraryPage from "@/components/AnimeLibraryPage";
import AppSidebar from "@/components/AppSidebar";
import ConfirmModal from "@/components/ConfirmModal";
import FiltersBar from "@/components/FiltersBar";
import HomeDashboard from "@/components/HomeDashboard";
import LiveCard from "@/components/LiveCard";
import LoreModal from "@/components/LoreModal";
import PlatformAnimeMaintainerPage from "@/components/PlatformAnimeMaintainerPage";
import PlatformTagsMaintainerPage from "@/components/PlatformTagsMaintainerPage";
import PlatformTrackerMaintainerPage from "@/components/PlatformTrackerMaintainerPage";
import PlatformUsersPage from "@/components/PlatformUsersPage";
import PlatformRolesPage from "@/components/PlatformRolesPage";
import StatsBar from "@/components/StatsBar";
import TagPanel from "@/components/TagPanel";
import TrackerMaintainerModal from "@/components/TrackerMaintainerModal";
import SpaceDrumPage from "@/components/SpaceDrumPage";
import { LIVE_STATUS_OPTIONS } from "@/lib/animeDbMapping";

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
const VIEW_LABELS = {
  home: "Inicio",
  tracker: "Rastreador de directos",
  myList: "Mi lista",
  myAnimeList: "Mi lista anime",
  animeLibraryTracking: "Viendo",
  animeLibraryCompleted: "Anime terminados",
  platformTracker: "Mantenedor Rastreador",
  platformTags: "Mantenedor Tags",
  platformAnimeTracking: "Mantenedor Viendo",
  platformAnimeCompleted: "Mantenedor Terminados",
  platformUsers: "Usuarios",
  platformRoles: "Roles",
  spacedrum: "SpaceDrum",
};

const VIEW_PATHS = {
  home: "/inicio",
  tracker: "/rastreador",
  myList: "/mi-lista",
  myAnimeList: "/mi-lista/anime",
  animeLibraryTracking: "/biblioteca-anime/viendo",
  animeLibraryCompleted: "/biblioteca-anime/terminados",
  platformTracker: "/administracion/rastreador",
  platformTags: "/administracion/tags",
  platformAnimeTracking: "/administracion/biblioteca-anime/viendo",
  platformAnimeCompleted: "/administracion/biblioteca-anime/terminados",
  platformUsers: "/administracion/usuarios",
  platformRoles: "/administracion/roles",
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
  initialYoutubeVideos = EMPTY_LIST,
  initialTwitchStream = null,
  initialTwitchProfile = null,
  initialTwitchChannelInfo = null,
  initialTwitchGame = null,
  initialLiveActivity = EMPTY_OBJECT,
  initialAnimeActivity = EMPTY_OBJECT,
  twitchLogin,
  youtubeChannelUrl,
  isAdmin,
  currentUser = null,
  accessPermissions = EMPTY_LIST,
}) {
  const isSpaceDrumEnabled = process.env.NEXT_PUBLIC_ENABLE_SPACEDRUM === "true";
  const effectivePermissions = useMemo(() => new Set(accessPermissions.length ? accessPermissions : currentUser?.permissions || []), [accessPermissions, currentUser?.permissions]);
  const hasPermission = (permission) => currentUser?.role === "dios" || effectivePermissions.has(permission);
  const canManageUsers = hasPermission("users.read");
  const canManageRoles = hasPermission("roles.read");
  const canCreateTracker = hasPermission("tracker.create");
  const canUpdateTracker = hasPermission("tracker.update");
  const canDeleteTracker = hasPermission("tracker.delete");
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
  const isAuthenticated = Boolean(currentUser?.id);
  const searchParams = useSearchParams();
  const [lives, setLives] = useState(initialLives);
  const [liveStatuses, setLiveStatuses] = useState(initialLiveStatuses.length ? initialLiveStatuses : LIVE_STATUS_OPTIONS);
  const [animeLibrary, setAnimeLibrary] = useState(initialAnimeLibrary);
  const [isAnimeLibraryLoading, setIsAnimeLibraryLoading] = useState(false);
  const [currentView, setCurrentView] = useState(activeView);
  const [isSidebarOpen, setIsSidebarOpen] = useState(null);
  const [trackerViewStates, setTrackerViewStates] = useState(() => {
    const queryState = activeView === "tracker" ? getTrackerStateFromSearchParams(searchParams) : null;
    return {
      tracker: queryState
        ? { ...DEFAULT_TRACKER_STATE, filters: queryState.filters, selectedTag: queryState.selectedTag }
        : DEFAULT_TRACKER_STATE,
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
  const [pendingTrackerRestore, setPendingTrackerRestore] = useState(null);
  const [cardDensity, setCardDensity] = useState("comfortable");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("kala_card_density");
      if (saved === "comfortable" || saved === "compact") {
        setCardDensity(saved);
      }
    } catch {}
  }, []);
  const [isPending, startTransition] = useTransition();
  const deferredSearch = useDeferredValue(filters.search);
  const loadMoreRef = useRef(null);
  const didRestoreTrackerRef = useRef(false);
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
    if (!["tracker", "myList"].includes(currentView) || lives.length) {
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
        if (isMounted) {
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
    if (!["tracker", "myList"].includes(currentView) || !isAuthenticated) {
      return;
    }

    refreshLiveActivity();
  }, [currentView, isAuthenticated]);

  useEffect(() => {
    if (!["animeLibraryTracking", "animeLibraryCompleted", "myAnimeList"].includes(currentView) || animeLibrary.length) {
      return undefined;
    }

    let isMounted = true;

    async function loadAnimeLibrary() {
      setIsAnimeLibraryLoading(true);

      try {
        const response = await fetch("/api/anime-library", { cache: "no-store" });
        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(data?.error || "No se pudo cargar la biblioteca de anime.");
        }

        if (isMounted) {
          setAnimeLibrary(data.animes || []);
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
  }, [animeLibrary.length, currentView]);

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
    const mediaQuery = window.matchMedia("(min-width: 901px)");

    function syncSidebarState(event) {
      setIsSidebarOpen(event.matches);
    }

    setIsSidebarOpen(mediaQuery.matches);
    mediaQuery.addEventListener("change", syncSidebarState);

    return () => mediaQuery.removeEventListener("change", syncSidebarState);
  }, []);

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
  }, [filteredLives.length, hasMoreLives]);

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

      await refreshLivesFromServer();
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

      toast.success("EventSub registrado. Twitch notificará el próximo directo.");
    } catch (error) {
      toast.error(error.message || "No se pudo registrar EventSub.");
    } finally {
      setIsTwitchActionLoading(false);
    }
  }

  function selectView(view) {
    const viewPermissions = {
      home: "home.view",
      tracker: "tracker.view",
      myList: "tracker.view",
      myAnimeList: "anime.tracking.view",
      animeLibraryTracking: "anime.tracking.view",
      animeLibraryCompleted: "anime.completed.view",
      platformAnimeTracking: "admin.anime.tracking.view",
      platformAnimeCompleted: "admin.anime.completed.view",
      platformTracker: "admin.tracker.view",
      platformTags: "admin.tags.view",
      platformUsers: "users.read",
      platformRoles: "roles.read",
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
      setIsSidebarOpen(false);
    }
  }

  function toggleSidebar() {
    setIsSidebarOpen((current) => {
      if (current === null) {
        return !window.matchMedia("(min-width: 901px)").matches;
      }

      return !current;
    });
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

      <div className={`app-shell ${isSidebarOpen === false ? "is-sidebar-closed" : ""}`}>
        <button
          type="button"
          className={`hamburger-button ${isSidebarOpen ? "is-open" : ""}`}
          aria-label={isSidebarOpen === false ? "Abrir menu" : "Cerrar menu"}
          aria-expanded={Boolean(isSidebarOpen)}
          aria-controls="main-sidebar"
          onClick={toggleSidebar}
        >
          <span />
          <span />
          <span />
        </button>

        {isSidebarOpen ? (
          <button
            type="button"
            className="sidebar-overlay"
            aria-label="Cerrar menu"
            onClick={() => setIsSidebarOpen(false)}
          />
        ) : null}

        <AppSidebar
          id="main-sidebar"
          activeView={currentView}
          className={`${isSidebarOpen ? "is-open" : ""} ${isSidebarOpen === false ? "is-closed" : ""}`}
          isAdmin={isAdmin}
          canManageUsers={canManageUsers}
          canManageRoles={canManageRoles}
          canManageTracker={canManageTracker}
          canManageTags={canViewTagsMaintainer}
          canManageAnimeTracking={canManageTrackingAnime}
          canManageAnimeCompleted={canManageCompletedAnime}
          isAuthenticated={isAuthenticated}
          isSpaceDrumEnabled={isSpaceDrumEnabled}
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
          <details className="tracker-actions tracker-admin-actions" aria-label="Acciones del rastreador">
            <summary className="tracker-admin-summary">
              <div>
                <span className="tracker-actions-label">Gestión</span>
                <p className="tracker-actions-copy">Herramientas de administración del archivo.</p>
              </div>
              <span className="tracker-admin-summary-pill">Acciones</span>
            </summary>
            <div className="tracker-admin-actions-body">
              {canCreateTracker ? (
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
                  Crear card desde Twitch
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
          </details>
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
                    className={cardDensity === "comfortable" ? "is-active" : ""}
                    onClick={() => {
                      setCardDensity("comfortable");
                      try { window.localStorage.setItem("kala_card_density", "comfortable"); } catch {}
                    }}
                  >
                    Cómodo
                  </button>
                  <button
                    type="button"
                    className={cardDensity === "compact" ? "is-active" : ""}
                    onClick={() => {
                      setCardDensity("compact");
                      try { window.localStorage.setItem("kala_card_density", "compact"); } catch {}
                    }}
                  >
                    Compacto
                  </button>
                </div>
              </div>
              <div id="lives-grid" className={`lives-grid lives-grid-${cardDensity}`}>
                {cardDensity === "compact" ? (
                  <div className="lives-table-header" role="row" aria-hidden="true">
                    <span>Fecha</span>
                    <span>Título</span>
                    <span>Estado</span>
                    <span>Tags</span>
                    <span>Disponibilidad</span>
                    <span>Acciones</span>
                  </div>
                ) : null}
                {visibleLives.map((live) => (
                  <LiveCard
                    key={live.id}
                    live={live}
                    isAdmin={canUpdateTracker}
                    activity={liveActivity[live.id]}
                    isAuthenticated={isAuthenticated}
                    searchTerm={deferredSearch}
                    onEdit={() => setEditingLive(live)}
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

            {currentView === "animeLibraryTracking" ? (
              <AnimeLibraryPage
                animes={animeLibrary}
                canCreate={canCreateTrackingAnime && Boolean(trackingAnimeFormVariant)}
                canUpdate={canUpdateTrackingAnime && Boolean(trackingAnimeFormVariant)}
                canDelete={canDeleteTrackingAnime && Boolean(trackingAnimeFormVariant)}
                formVariant={trackingAnimeFormVariant || "compact"}
                isLoading={isAnimeLibraryLoading}
                mode="active"
                initialActivity={initialAnimeActivity}
                isAuthenticated={isAuthenticated}
                onAnimesChange={setAnimeLibrary}
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
                initialActivity={initialAnimeActivity}
                isAuthenticated={isAuthenticated}
                onAnimesChange={setAnimeLibrary}
              />
            ) : null}

            {currentView === "myAnimeList" ? (
              <AnimeLibraryPage
                animes={animeLibrary}
                initialActivity={initialAnimeActivity}
                isAuthenticated={isAuthenticated}
                isLoading={isAnimeLibraryLoading}
                mode="personal"
                personalOnly
                onAnimesChange={setAnimeLibrary}
              />
            ) : null}

            {isSpaceDrumEnabled && currentView === "spacedrum" ? (
              <SpaceDrumPage data={initialSpaceDrum} />
            ) : null}

            {currentView === "platformUsers" && canManageUsers ? (
              <PlatformUsersPage initialUsers={initialPlatformUsers} initialRoles={initialPlatformRoles} currentUser={currentUser} />
            ) : null}

            {currentView === "platformRoles" && canManageRoles ? (
              <PlatformRolesPage initialRoles={initialPlatformRoles} initialPermissions={initialPlatformPermissions} />
            ) : null}

            {currentView === "platformTracker" && canManageTracker ? (
              <PlatformTrackerMaintainerPage
                initialLives={lives}
                initialStatuses={liveStatuses}
                canCreate={canCreateTracker}
                canUpdate={canUpdateTracker}
                canDelete={canDeleteTracker}
                canUpdateTags={canUpdateTags}
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
      </div>

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
