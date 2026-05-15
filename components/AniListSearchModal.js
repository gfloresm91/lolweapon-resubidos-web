"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";

function normalizeComparable(value) {
  return String(value || "").trim().toLowerCase();
}

function getInitials(title) {
  return String(title || "AN")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

async function readJsonResponse(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function metadataIsDuplicate(metadata, animes = [], currentKey = "") {
  const providerId = normalizeComparable(metadata.providerId);
  const providerUrl = normalizeComparable(metadata.providerUrl);
  const title = normalizeComparable(metadata.title);

  return animes.some((anime) => {
    if (currentKey && anime.key === currentKey) {
      return false;
    }

    return (
      (providerId && normalizeComparable(anime.providerId) === providerId)
      || (providerUrl && normalizeComparable(anime.providerUrl) === providerUrl)
      || (title && [anime.title, anime.titleEs].some((value) => normalizeComparable(value) === title))
    );
  });
}

export default function AniListSearchModal({
  isOpen,
  title = "Buscar en AniList",
  subtitle = "Pega una URL de AniList o escribe el título para precargar la metadata.",
  emptyText = "Busca en AniList para seleccionar una ficha.",
  existingAnimes = [],
  currentKey = "",
  onClose,
  onSelectMetadata,
  actions = null,
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setResults([]);
      setIsSearching(false);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  async function searchAniList(event) {
    event.preventDefault();
    const query = search.trim();

    if (!query) {
      toast.error("Ingresa un título o URL de AniList.");
      return;
    }

    setIsSearching(true);

    try {
      const isUrl = /^https?:\/\//i.test(query);
      const response = await fetch("/api/anime-library/anilist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isUrl ? { providerUrl: query } : { search: query }),
      });
      const data = await readJsonResponse(response);

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo buscar en AniList.");
      }

      setResults(data.results?.length ? data.results : data.metadata ? [data.metadata] : []);
    } catch (error) {
      toast.error(error.message || "No se pudo buscar en AniList.");
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content anime-create-start-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close-button" aria-label="Cerrar modal" onClick={onClose}>
          <X size={18} />
        </button>
        <div className="anime-create-start-header">
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>

        <form className="anime-create-search" onSubmit={searchAniList} noValidate>
          <input
            className="modal-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Ej: World Trigger o https://anilist.co/anime/..."
          />
          <button type="submit" className="btn-modal btn-modal-primary" disabled={isSearching}>
            {isSearching ? "Buscando..." : "Buscar"}
          </button>
        </form>

        {results.length ? (
          <div className="anime-create-results" aria-label="Resultados de AniList">
            {results.map((metadata) => {
              const duplicate = metadataIsDuplicate(metadata, existingAnimes, currentKey);

              return (
                <button
                  type="button"
                  className={`anime-create-result ${duplicate ? "is-duplicate" : ""}`}
                  key={metadata.providerId || metadata.providerUrl || metadata.title}
                  onClick={() => {
                    if (duplicate) {
                      toast.error("Este anime ya existe en la biblioteca.");
                      return;
                    }

                    onSelectMetadata(metadata);
                  }}
                >
                  {metadata.image ? <img src={metadata.image} alt="" /> : <span className="admin-user-avatar">{getInitials(metadata.title)}</span>}
                  <span>
                    <strong>{metadata.title}</strong>
                    <small>{[metadata.year, metadata.format, metadata.status].filter(Boolean).join(" · ") || "Sin metadata"}</small>
                    {duplicate ? <em>Ya existe en biblioteca</em> : null}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="anime-create-empty">{emptyText}</p>
        )}

        <div className="modal-actions">
          <button type="button" className="btn-modal btn-modal-secondary" onClick={onClose}>Cancelar</button>
          {actions}
        </div>
      </div>
    </div>
  );
}
