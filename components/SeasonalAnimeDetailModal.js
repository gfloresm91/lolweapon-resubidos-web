"use client";

import { useState } from "react";
import { Bookmark, Film, X } from "lucide-react";

import { AniListChip, PlatformChip } from "@/components/SeasonalAnimePlatformChip";

const STATUS_LABELS = {
  RELEASING: "En emisión",
  FINISHED: "Finalizado",
  NOT_YET_RELEASED: "Sin estrenar",
  CANCELLED: "Cancelado",
  HIATUS: "En pausa",
};
const DESCRIPTION_COLLAPSE_LENGTH = 260;

export default function SeasonalAnimeDetailModal({ anime, airing, onToggleFavorite, onClose }) {
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  if (!anime) return null;

  const description = anime.description || "";
  const isLongDescription = description.length > DESCRIPTION_COLLAPSE_LENGTH;

  const metaParts = [
    anime.format,
    anime.episodes ? `${anime.episodes} episodios` : null,
    STATUS_LABELS[anime.status] || null,
  ].filter(Boolean);

  return (
    <div className="modal-backdrop">
      <div
        className="modal-content season-anime-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-label={anime.title}
      >
        <button type="button" className="modal-close-button" aria-label="Cerrar" onClick={onClose}>
          <X size={18} />
        </button>

        <div className="season-anime-detail-hero">
          {anime.trailerUrl ? (
            <iframe
              src={anime.trailerUrl}
              title={`Trailer de ${anime.title}`}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          ) : (
            <>
              {anime.imageUrl ? <img src={anime.imageUrl} alt="" /> : null}
              <div className="season-anime-detail-no-trailer">
                <Film size={18} aria-hidden="true" />
                <span>Sin trailer disponible</span>
              </div>
            </>
          )}
        </div>

        <div className="season-anime-detail-body">
          <div className="season-anime-detail-heading">
            <h2>{anime.title}</h2>
            <button
              type="button"
              className={`season-airing-favorite ${anime.isFavorite ? "is-active" : ""}`}
              aria-pressed={anime.isFavorite}
              aria-label={anime.isFavorite ? `Quitar ${anime.title} de favoritos` : `Agregar ${anime.title} a favoritos`}
              onClick={onToggleFavorite}
            >
              <Bookmark size={18} />
            </button>
          </div>

          {metaParts.length ? <p className="season-anime-detail-meta">{metaParts.join(" · ")}</p> : null}

          {anime.tags?.length ? (
            <div className="season-anime-detail-tags">
              {anime.tags.map((tag) => (
                <span className="season-anime-detail-tag" key={tag}>{tag}</span>
              ))}
            </div>
          ) : null}

          {description ? (
            <div>
              <p className={`season-anime-detail-description ${!isDescriptionExpanded && isLongDescription ? "is-clamped" : ""}`}>
                {description}
              </p>
              {isLongDescription ? (
                <button type="button" className="season-anime-detail-description-toggle" onClick={() => setIsDescriptionExpanded((current) => !current)}>
                  {isDescriptionExpanded ? "Ver menos" : "Ver más"}
                </button>
              ) : null}
            </div>
          ) : null}

          {(airing?.platforms?.length || anime.aniListUrl) ? (
            <div className="season-airing-platforms season-anime-detail-platforms">
              {(airing?.platforms || []).map((platform, index) => (
                <PlatformChip key={`${platform.name || platform.url || index}`} name={platform.name} url={platform.url} />
              ))}
              {anime.aniListUrl ? <AniListChip url={anime.aniListUrl} /> : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
