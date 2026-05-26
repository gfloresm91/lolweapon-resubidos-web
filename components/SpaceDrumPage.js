"use client";

import {
  ArrowUp,
  BookOpenCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Globe2,
  ListTree,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

const LANGUAGE_OPTIONS = [
  { code: "es-es", label: "Español", shortLabel: "ES", chapterLabel: "Capítulos" },
  { code: "en-us", label: "English", shortLabel: "EN", chapterLabel: "Chapters" },
];
const STORAGE_LANGUAGE_KEY = "spacedrum_language";
const STORAGE_LAST_READ_PREFIX = "spacedrum_last_read";
const STORAGE_READER_POSITION_PREFIX = "spacedrum_reader_position";
const SECOND_PAGE_THUMBNAIL_TITLES = new Set([
  "Ciclo 1.1",
  "Ciclo 2",
  "Ciclo 3",
  "Ciclo 4",
  "Ciclo 5",
  "Cycle 1",
  "Cycle 2",
  "Cycle 3",
  "Cycle 4",
  "Cycle 5",
]);

function formatDate(value, language) {
  if (!value) {
    return language === "en-us" ? "No date" : "Sin fecha";
  }

  return new Intl.DateTimeFormat(language === "en-us" ? "en-US" : "es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function getLibrary(data) {
  if (data?.languages) {
    return data;
  }

  return {
    defaultLanguage: data?.language || "es-es",
    languages: {
      [data?.language || "es-es"]: data,
    },
  };
}

function getLanguageCopy(language) {
  if (language === "en-us") {
    return {
      eyebrow: "Official manga",
      read: "Read",
      previous: "Previous",
      next: "Next",
      last: "Latest chapter",
      top: "Top",
      page: "Page",
      pages: "pages",
      chaptersCount: "chapters",
      readChapter: "Read chapter",
      backToChapters: "Choose chapter",
      continueReading: "Continue reading",
      orderLabel: "Chapter order",
      readingOrder: "Reading order",
      latestFirst: "Latest first",
      lastRead: "Last read",
      empty: "There are no chapters loaded yet.",
      emptyAdmin: "There are no imported chapters. Run DATA_SOURCE=postgres npm run db:import:spacedrum:remote.",
      select: "Choose a chapter",
      original: "Original site",
      credits: "Credits",
      script: "Script / Story",
      art: "Art",
      support: "Support the project",
      progress: "Your progress",
      readProgress: "read",
      loggedProgress: "Your reading progress is saved to your account.",
    };
  }

  return {
    eyebrow: "Manga oficial",
    read: "Leer",
    previous: "Anterior",
    next: "Siguiente",
    last: "Último capítulo",
    top: "Subir",
    page: "Página",
    pages: "páginas",
    chaptersCount: "capítulos",
    readChapter: "Leer capítulo",
    backToChapters: "Seleccionar capítulo",
      continueReading: "Continuar lectura",
      orderLabel: "Orden de capítulos",
      readingOrder: "Orden de lectura",
      latestFirst: "Más recientes primero",
    lastRead: "Última lectura",
    empty: "No hay capítulos cargados todavía.",
    emptyAdmin: "No hay capítulos importados. Ejecuta DATA_SOURCE=postgres npm run db:import:spacedrum:remote.",
    select: "Selecciona un capítulo",
    original: "Sitio original",
    credits: "Créditos",
    script: "Guion / Historia",
    art: "Arte",
    support: "Apoyar el proyecto",
    progress: "Tu progreso",
    readProgress: "leídos",
    loggedProgress: "Tu avance de lectura se guarda en tu cuenta.",
  };
}

function getLinkKind(link) {
  const label = String(link?.label || "").toLowerCase();
  const url = String(link?.url || "").toLowerCase();

  if (label.includes("guion") || label.includes("script")) {
    return "script";
  }

  if (label.includes("arte") || label.includes("art:") || label.includes("artist") || url.includes("soritha")) {
    return "art";
  }

  if (label.includes("comprar") || label.includes("buy") || label.includes("buscalibre") || label.includes("volume") || url.includes("amzn")) {
    return "shop";
  }

  return "reference";
}

function getLinkDisplayLabel(link) {
  return String(link?.label || "")
    .replace(/^Guion:\s*/i, "")
    .replace(/^Script:\s*/i, "")
    .replace(/^Arte:\s*/i, "")
    .replace(/^Art:\s*/i, "")
    .trim();
}

function getStoredLanguage() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(STORAGE_LANGUAGE_KEY) || "";
}

function getStoredLastRead(language) {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(`${STORAGE_LAST_READ_PREFIX}_${language}`) || "";
}

function getStoredReaderPosition(language, chapterId) {
  if (typeof window === "undefined" || !language || !chapterId) {
    return 0;
  }

  const value = Number(window.localStorage.getItem(`${STORAGE_READER_POSITION_PREFIX}_${language}_${chapterId}`));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function setStoredReaderPosition(language, chapterId, value) {
  if (typeof window === "undefined" || !language || !chapterId) {
    return;
  }

  window.localStorage.setItem(
    `${STORAGE_READER_POSITION_PREFIX}_${language}_${chapterId}`,
    String(Math.max(0, Math.round(value || 0))),
  );
}

function normalizeChapterQuery(value) {
  return String(value || "").trim();
}

function findMatchingChapter(nextChapters, currentChapter, fallbackId) {
  if (!nextChapters.length) {
    return "";
  }

  if (!currentChapter) {
    return fallbackId || nextChapters[0].id;
  }

  return nextChapters.find((chapter) => chapter.title === currentChapter.title)?.id
    || nextChapters.find((chapter) => chapter.title.replace(/cycle/i, "ciclo") === currentChapter.title.replace(/cycle/i, "ciclo"))?.id
    || nextChapters[currentChapter.position || 0]?.id
    || fallbackId
    || nextChapters[0].id;
}

function getChapterThumbnailPage(chapter) {
  if (SECOND_PAGE_THUMBNAIL_TITLES.has(chapter?.title) && chapter?.pages?.[1]) {
    return chapter.pages[1];
  }

  return chapter?.pages?.[0] || chapter?.pages?.[1] || null;
}

export default function SpaceDrumPage({ data, initialProgress = {}, isAuthenticated = false, isLoading = false }) {
  const searchParams = useSearchParams();
  const readerTopRef = useRef(null);
  const pageRefs = useRef([]);
  const restoreScrollRef = useRef({ chapterId: "", done: false });
  const library = useMemo(() => getLibrary(data), [data]);
  const availableLanguages = useMemo(() => {
    return LANGUAGE_OPTIONS.filter((option) => library.languages?.[option.code]?.chapters?.length);
  }, [library]);
  const fallbackLanguage = availableLanguages[0]?.code || library.defaultLanguage || "es-es";
  const queryLanguage = searchParams.get("lang");
  const queryChapter = normalizeChapterQuery(searchParams.get("chapter"));
  const initialLanguage = availableLanguages.some((option) => option.code === queryLanguage)
    ? queryLanguage
    : fallbackLanguage;
  const [selectedLanguage, setSelectedLanguage] = useState(initialLanguage);
  const currentLanguage = availableLanguages.some((option) => option.code === selectedLanguage)
    ? selectedLanguage
    : fallbackLanguage;
  const languageData = library.languages?.[currentLanguage] || {};
  const chapters = useMemo(() => {
    return (languageData.chapters || []).map((chapter, position) => ({ ...chapter, position }));
  }, [languageData.chapters]);
  const initialChapterId = chapters.some((chapter) => chapter.id === queryChapter)
    ? queryChapter
    : chapters[0]?.id || "";
  const [selectedChapterId, setSelectedChapterId] = useState(initialChapterId);
  const [isReaderOpen, setIsReaderOpen] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [chapterOrder, setChapterOrder] = useState("reading");
  const [progressByLanguage, setProgressByLanguage] = useState(initialProgress || {});
  const copy = getLanguageCopy(currentLanguage);

  const selectedChapterIndex = useMemo(() => {
    const index = chapters.findIndex((chapter) => chapter.id === selectedChapterId);
    return index >= 0 ? index : 0;
  }, [chapters, selectedChapterId]);
  const selectedChapter = chapters[selectedChapterIndex] || null;
  const previousChapter = selectedChapterIndex > 0 ? chapters[selectedChapterIndex - 1] : null;
  const nextChapter = selectedChapterIndex < chapters.length - 1 ? chapters[selectedChapterIndex + 1] : null;
  const latestChapter = chapters.at(-1) || null;
  const currentProgress = progressByLanguage[currentLanguage] || {};
  const readChapterIds = useMemo(
    () => new Set(Array.isArray(currentProgress.readChapterIds) ? currentProgress.readChapterIds : []),
    [currentProgress.readChapterIds],
  );
  const orderedChapters = useMemo(
    () => (chapterOrder === "latest" ? [...chapters].reverse() : chapters),
    [chapterOrder, chapters],
  );
  const [lastReadChapterId, setLastReadChapterId] = useState(currentProgress.lastChapterId || "");
  const lastReadChapter = chapters.find((chapter) => chapter.id === lastReadChapterId) || null;
  const hasNoData = !availableLanguages.length;
  const referenceLinks = (languageData.links || []).filter((link) => getLinkKind(link) === "reference");
  const shopLinks = (languageData.links || []).filter((link) => getLinkKind(link) === "shop");
  const scriptLinks = (languageData.links || []).filter((link) => getLinkKind(link) === "script");
  const artLinks = (languageData.links || []).filter((link) => getLinkKind(link) === "art");
  const readCount = chapters.filter((chapter) => readChapterIds.has(chapter.id)).length;
  const currentPageLabel = selectedChapter?.pages?.length
    ? `${copy.page} ${Math.min(currentPageIndex + 1, selectedChapter.pages.length)} / ${selectedChapter.pages.length}`
    : "";

  useEffect(() => {
    setProgressByLanguage(initialProgress || {});
  }, [initialProgress]);

  useEffect(() => {
    const storedLanguage = getStoredLanguage();
    if (!queryLanguage && availableLanguages.some((option) => option.code === storedLanguage)) {
      setSelectedLanguage(storedLanguage);
    }
  }, [availableLanguages, queryLanguage]);

  useEffect(() => {
    if (!chapters.length) {
      setSelectedChapterId("");
      setLastReadChapterId("");
      return;
    }

    const persistedLastRead = progressByLanguage[currentLanguage]?.lastChapterId || "";
    const storedLastRead = getStoredLastRead(currentLanguage);
    const nextLastRead = persistedLastRead || storedLastRead;
    setLastReadChapterId(chapters.some((chapter) => chapter.id === nextLastRead) ? nextLastRead : "");

    setSelectedChapterId((currentId) => {
      if (chapters.some((chapter) => chapter.id === currentId)) {
        return currentId;
      }

      if (queryChapter && chapters.some((chapter) => chapter.id === queryChapter)) {
        return queryChapter;
      }

      return chapters[0].id;
    });
  }, [chapters, currentLanguage, progressByLanguage, queryChapter]);

  useEffect(() => {
    if (!currentLanguage || !selectedChapter?.id) {
      return;
    }

    window.localStorage.setItem(STORAGE_LANGUAGE_KEY, currentLanguage);

    if (window.location.pathname !== "/spacedrum") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    params.set("lang", currentLanguage);
    if (isReaderOpen) {
      params.set("chapter", selectedChapter.id);
    } else {
      params.delete("chapter");
    }
    const queryString = params.toString();
    const nextUrl = queryString ? `/spacedrum?${queryString}` : "/spacedrum";

    if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, [currentLanguage, isReaderOpen, selectedChapter?.id]);

  useEffect(() => {
    setCurrentPageIndex(0);
    pageRefs.current = [];
    restoreScrollRef.current = { chapterId: selectedChapter?.id || "", done: false };
  }, [selectedChapter?.id]);

  useEffect(() => {
    if (!isReaderOpen || !selectedChapter?.id) {
      return undefined;
    }

    const nodes = pageRefs.current.filter(Boolean);
    if (!nodes.length) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const nextIndex = Number(visibleEntry?.target?.dataset?.pageIndex);
        if (Number.isInteger(nextIndex)) {
          setCurrentPageIndex(nextIndex);
        }
      },
      {
        root: null,
        rootMargin: "-25% 0px -55% 0px",
        threshold: [0.1, 0.35, 0.6],
      },
    );

    nodes.forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  }, [isReaderOpen, selectedChapter?.id, selectedChapter?.pages?.length]);

  useEffect(() => {
    if (!isReaderOpen || !selectedChapter?.id || restoreScrollRef.current.done) {
      return;
    }

    const storedPosition = getStoredReaderPosition(currentLanguage, selectedChapter.id);
    restoreScrollRef.current.done = true;

    if (!storedPosition) {
      return;
    }

    window.setTimeout(() => {
      window.scrollTo({ top: storedPosition, behavior: "smooth" });
    }, 120);
  }, [currentLanguage, isReaderOpen, selectedChapter?.id]);

  useEffect(() => {
    if (!isReaderOpen || !selectedChapter?.id) {
      return undefined;
    }

    let frame = 0;
    const savePosition = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        setStoredReaderPosition(currentLanguage, selectedChapter.id, window.scrollY);
      });
    };

    window.addEventListener("scroll", savePosition, { passive: true });

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", savePosition);
      setStoredReaderPosition(currentLanguage, selectedChapter.id, window.scrollY);
    };
  }, [currentLanguage, isReaderOpen, selectedChapter?.id]);

  useEffect(() => {
    if (!isReaderOpen) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.target?.tagName === "INPUT" || event.target?.tagName === "TEXTAREA" || event.target?.isContentEditable) {
        return;
      }

      if (event.key === "Escape") {
        returnToChapters();
      }

      if (event.key === "ArrowLeft" && previousChapter) {
        selectChapter(previousChapter.id);
      }

      if (event.key === "ArrowRight" && nextChapter) {
        selectChapter(nextChapter.id);
      }

      if (event.key === "Home") {
        event.preventDefault();
        scrollToReaderTop();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isReaderOpen, nextChapter, previousChapter]);

  function selectLanguage(language) {
    const currentChapter = selectedChapter;
    const nextChapters = library.languages?.[language]?.chapters || [];
    setSelectedLanguage(language);
    setSelectedChapterId(findMatchingChapter(nextChapters, currentChapter, nextChapters[0]?.id || ""));
  }

  function selectChapter(chapterId, shouldScroll = true) {
    setSelectedChapterId(chapterId);
    setLastReadChapterId(chapterId);
    setCurrentPageIndex(0);
    setProgressByLanguage((current) => {
      const currentLanguageProgress = current[currentLanguage] || {};
      const nextReadIds = new Set(currentLanguageProgress.readChapterIds || []);
      nextReadIds.add(chapterId);
      return {
        ...current,
        [currentLanguage]: {
          ...currentLanguageProgress,
          language: currentLanguage,
          lastChapterId: chapterId,
          readChapterIds: Array.from(nextReadIds),
        },
      };
    });
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`${STORAGE_LAST_READ_PREFIX}_${currentLanguage}`, chapterId);
    }
    if (isAuthenticated) {
      fetch("/api/spacedrum-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: currentLanguage, chapterId, markRead: true }),
      }).catch(() => {
        // Reading still works if the progress save fails.
      });
    }
    setIsReaderOpen(true);
    if (shouldScroll) {
      requestAnimationFrame(() => {
        readerTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  function scrollToReaderTop() {
    readerTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function returnToChapters() {
    setIsReaderOpen(false);
    requestAnimationFrame(() => {
      readerTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <main className="spacedrum-page">
      <section className="spacedrum-shell">
        {languageData.heroImage ? (
          <img src={languageData.heroImage} alt="" className="spacedrum-shell-bg" />
        ) : null}
        <div className="spacedrum-intro">
          <div className="spacedrum-copy">
            <span className="spacedrum-status">
              <BookOpenCheck aria-hidden="true" />
              {copy.eyebrow}
            </span>
            <div className="spacedrum-title-lockup">
              {languageData.coverImage ? (
                <div className="spacedrum-cover">
                  <img src={languageData.coverImage} alt={`Portada de ${languageData.title || "SpaceDrum"}`} />
                </div>
              ) : null}
              <div>
                <h1>{languageData.title || "SpaceDrum"}</h1>
                {languageData.subtitle ? <p className="spacedrum-subtitle">{languageData.subtitle}</p> : null}
              </div>
            </div>
            {languageData.description ? <p className="spacedrum-description">{languageData.description}</p> : null}
            <div className="spacedrum-facts" aria-label="Datos destacados">
              {languageData.status ? <span>{languageData.status}</span> : null}
              {isAuthenticated && chapters.length ? <span>{readCount}/{chapters.length} {copy.readProgress}</span> : null}
            </div>
          </div>

          <div className="spacedrum-actions">
            {availableLanguages.length > 1 ? (
              <div className="spacedrum-language-switch" aria-label="Idioma">
                <Globe2 aria-hidden="true" />
                {availableLanguages.map((language) => (
                  <button
                    key={language.code}
                    type="button"
                    className={language.code === currentLanguage ? "is-active" : ""}
                    onClick={() => selectLanguage(language.code)}
                  >
                    <span>{language.shortLabel}</span>
                    <strong>{language.label}</strong>
                  </button>
                ))}
              </div>
            ) : null}

            {isAuthenticated && chapters.length ? (
              <div className="spacedrum-progress-card">
                <span>
                  <Sparkles aria-hidden="true" />
                  {copy.progress}
                </span>
                <strong>{readCount}/{chapters.length}</strong>
                <small>{copy.loggedProgress}</small>
                {lastReadChapter ? (
                  <button type="button" onClick={() => selectChapter(lastReadChapter.id)}>
                    <BookOpenCheck aria-hidden="true" />
                    {copy.continueReading}
                  </button>
                ) : null}
              </div>
            ) : null}

            {referenceLinks.length ? (
              <div className="spacedrum-links spacedrum-reference-links">
                {referenceLinks.map((link) => (
                  <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
                    {link.label}
                    <ExternalLink aria-hidden="true" />
                  </a>
                ))}
              </div>
            ) : null}

          </div>
        </div>

        {scriptLinks.length || artLinks.length || shopLinks.length ? (
          <div className="spacedrum-credits" aria-label={copy.credits}>
            {scriptLinks.length ? (
              <div>
                <span>{copy.script}</span>
                <strong>LOLWEAPON</strong>
                <div>
                  {scriptLinks.map((link) => (
                    <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
                      {getLinkDisplayLabel(link)}
                      <ExternalLink aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
            {artLinks.length ? (
              <div>
                <span>{copy.art}</span>
                <strong>Soritha</strong>
                <div>
                  {artLinks.map((link) => (
                    <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
                      {getLinkDisplayLabel(link)}
                      <ExternalLink aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
            {shopLinks.length ? (
              <div className="spacedrum-support-card">
                <span className="spacedrum-links-label">{copy.support}</span>
                <div>
                  {shopLinks.map((link) => (
                    <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="spacedrum-shop-link">
                      {link.label}
                      <ExternalLink aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {languageData.meta?.length ? (
          <div className="spacedrum-meta" aria-label="Datos de SpaceDrum">
            {languageData.meta.map((item) => (
              <div key={`${currentLanguage}-${item.label}`} className="spacedrum-meta-item">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section
        className={`spacedrum-chapters ${isReaderOpen ? "is-reader-open" : ""}`}
        aria-label={copy.select}
        ref={!isReaderOpen ? readerTopRef : null}
      >
        <div className="spacedrum-section-heading">
          <div>
            <span>{copy.read}</span>
            <h2>{LANGUAGE_OPTIONS.find((item) => item.code === currentLanguage)?.chapterLabel || "Capítulos"}</h2>
          </div>
          <div className="spacedrum-section-actions">
            <div className="spacedrum-order-toggle" aria-label={copy.orderLabel}>
              <button
                type="button"
                className={chapterOrder === "reading" ? "is-active" : ""}
                onClick={() => setChapterOrder("reading")}
              >
                {copy.readingOrder}
              </button>
              <button
                type="button"
                className={chapterOrder === "latest" ? "is-active" : ""}
                onClick={() => setChapterOrder("latest")}
              >
                {copy.latestFirst}
              </button>
            </div>
            <button
              type="button"
              className="spacedrum-quick-button"
              disabled={!latestChapter}
              onClick={() => latestChapter && selectChapter(latestChapter.id)}
            >
              <ListTree aria-hidden="true" />
              {copy.last}
            </button>
            {lastReadChapter ? (
              <button
                type="button"
                className="spacedrum-quick-button spacedrum-quick-button-accent"
                onClick={() => selectChapter(lastReadChapter.id)}
              >
                <BookOpenCheck aria-hidden="true" />
                {copy.continueReading}
              </button>
            ) : null}
          </div>
        </div>

        {lastReadChapter ? (
          <div className="spacedrum-mobile-continue">
            <button
              type="button"
              className="spacedrum-quick-button spacedrum-quick-button-accent"
              onClick={() => selectChapter(lastReadChapter.id)}
            >
              <BookOpenCheck aria-hidden="true" />
              {copy.continueReading}
            </button>
          </div>
        ) : null}

        {isAuthenticated && chapters.length ? (
          <div className="spacedrum-reading-progress" aria-label={copy.progress}>
            <span>
              <strong>{readCount}</strong> / {chapters.length} {copy.readProgress}
            </span>
            <div>
              <i style={{ width: `${Math.min(100, Math.round((readCount / chapters.length) * 100))}%` }} />
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <div className="spacedrum-empty">Cargando capítulos de SpaceDrum...</div>
        ) : chapters.length ? (
          <div className="spacedrum-chapter-grid">
            {orderedChapters.map((chapter) => {
              const isLastRead = chapter.id === lastReadChapter?.id;
              const isRead = readChapterIds.has(chapter.id);
              const thumbnailPage = getChapterThumbnailPage(chapter);

              return (
                <article
                  key={chapter.id}
                  className={`spacedrum-chapter-card ${chapter.id === selectedChapter?.id ? "is-active" : ""}`}
                >
                  <span className="spacedrum-chapter-thumb">
                    {thumbnailPage?.image ? (
                      <img src={thumbnailPage.image} alt="" loading="lazy" />
                    ) : (
                      <span className="spacedrum-chapter-placeholder" aria-hidden="true">{chapter.title?.[0] || "S"}</span>
                    )}
                    {isLastRead || isRead ? (
                      <span className={`spacedrum-chapter-state ${isLastRead ? "is-last" : "is-read"}`}>
                        {isLastRead ? copy.lastRead : currentLanguage === "en-us" ? "Read" : "Leído"}
                      </span>
                    ) : null}
                    <span className="spacedrum-chapter-number">{chapter.title}</span>
                  </span>
                  <span className="spacedrum-chapter-date">{formatDate(chapter.releaseDate, currentLanguage)}</span>
                  <strong>{chapter.title}</strong>
                  <small>{chapter.pages.length} {copy.pages}</small>
                  <button
                    type="button"
                    className="spacedrum-chapter-action"
                    onClick={() => selectChapter(chapter.id)}
                  >
                    {copy.readChapter}
                    <ChevronRight aria-hidden="true" />
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="spacedrum-empty">{hasNoData ? copy.emptyAdmin : copy.empty}</div>
        )}
      </section>

      {isReaderOpen ? (
        <section
          className="spacedrum-reader"
          aria-label="Lector de manga"
          ref={readerTopRef}
        >
          {selectedChapter ? (
            <>
              <div className="spacedrum-reader-toolbar">
                <div>
                  <span>{formatDate(selectedChapter.releaseDate, currentLanguage)}</span>
                  <h2>{selectedChapter.title}</h2>
                  <small>
                    {selectedChapter.pages.length} {copy.pages} · {currentPageLabel}
                  </small>
                </div>
                <div className="spacedrum-reader-controls">
                  <button type="button" className="spacedrum-nav-button spacedrum-nav-button-secondary" onClick={returnToChapters}>
                    <ListTree aria-hidden="true" />
                    {copy.backToChapters}
                  </button>
                  <button
                    type="button"
                    className="spacedrum-nav-button"
                    disabled={!previousChapter}
                    onClick={() => previousChapter && selectChapter(previousChapter.id)}
                  >
                    <ChevronLeft aria-hidden="true" />
                    {copy.previous}
                  </button>
                  <button type="button" className="spacedrum-nav-button" onClick={scrollToReaderTop}>
                    <ArrowUp aria-hidden="true" />
                    {copy.top}
                  </button>
                  <button
                    type="button"
                    className="spacedrum-nav-button"
                    disabled={!nextChapter}
                    onClick={() => nextChapter && selectChapter(nextChapter.id)}
                  >
                    {copy.next}
                    <ChevronRight aria-hidden="true" />
                  </button>
                </div>
              </div>

              {selectedChapter.summary ? <p className="spacedrum-reader-summary">{selectedChapter.summary}</p> : null}

              <div className="spacedrum-pages">
                {selectedChapter.pages.map((page, index) => (
                  <figure
                    key={`${selectedChapter.id}-${page.image}`}
                    className="spacedrum-page-frame"
                    data-page-index={index}
                    ref={(node) => {
                      pageRefs.current[index] = node;
                    }}
                  >
                    <img src={page.image} alt={page.alt} loading={index === 0 ? "eager" : "lazy"} />
                  </figure>
                ))}
              </div>

              <div className="spacedrum-reader-footer">
                <button
                  type="button"
                  className="spacedrum-nav-button"
                  disabled={!previousChapter}
                  onClick={() => previousChapter && selectChapter(previousChapter.id)}
                >
                  <ChevronLeft aria-hidden="true" />
                  {copy.previous}
                </button>
                <button type="button" className="spacedrum-nav-button" onClick={scrollToReaderTop}>
                  <ArrowUp aria-hidden="true" />
                  {copy.top}
                </button>
                <button
                  type="button"
                  className="spacedrum-nav-button"
                  disabled={!nextChapter}
                  onClick={() => nextChapter && selectChapter(nextChapter.id)}
                >
                  {copy.next}
                  <ChevronRight aria-hidden="true" />
                </button>
              </div>
            </>
          ) : (
            <div className="spacedrum-empty">{hasNoData ? copy.emptyAdmin : copy.select}</div>
          )}
        </section>
      ) : null}
    </main>
  );
}
