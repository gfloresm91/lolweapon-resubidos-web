"use client";

import { useMemo, useState } from "react";

function formatDate(value) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function SpaceDrumPage({ data }) {
  const chapters = data?.chapters || [];
  const [selectedChapterId, setSelectedChapterId] = useState(chapters[0]?.id || "");

  const selectedChapter = useMemo(() => {
    return chapters.find((chapter) => chapter.id === selectedChapterId) || chapters[0] || null;
  }, [chapters, selectedChapterId]);

  return (
    <main className="spacedrum-page">
      <section className="spacedrum-hero">
        {data?.heroImage ? <img src={data.heroImage} alt="" className="spacedrum-hero-bg" /> : null}
        <div className="spacedrum-hero-shade" />
        <div className="spacedrum-hero-content">
          <div className="spacedrum-copy">
            {data?.status ? <span className="spacedrum-status">{data.status}</span> : null}
            <h1>{data?.title || "SpaceDrum"}</h1>
            {data?.subtitle ? <p className="spacedrum-subtitle">{data.subtitle}</p> : null}
            {data?.description ? <p className="spacedrum-description">{data.description}</p> : null}

            {data?.links?.length ? (
              <div className="spacedrum-links">
                {data.links.map((link) => (
                  <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
                    {link.label}
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          {data?.coverImage ? (
            <div className="spacedrum-cover">
              <img src={data.coverImage} alt={`Portada de ${data.title || "SpaceDrum"}`} />
            </div>
          ) : null}
        </div>
      </section>

      {data?.meta?.length ? (
        <section className="spacedrum-meta" aria-label="Datos de SpaceDrum">
          {data.meta.map((item) => (
            <div key={item.label} className="spacedrum-meta-item">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </section>
      ) : null}

      <section className="spacedrum-reader-layout">
        <aside className="spacedrum-chapters" aria-label="Capítulos">
          <div className="spacedrum-section-heading">
            <span>Lectura</span>
            <h2>Capítulos</h2>
          </div>

          {chapters.length ? (
            <div className="spacedrum-chapter-list">
              {chapters.map((chapter) => (
                <button
                  key={chapter.id}
                  type="button"
                  className={`spacedrum-chapter-btn ${chapter.id === selectedChapter?.id ? "is-active" : ""}`}
                  onClick={() => setSelectedChapterId(chapter.id)}
                >
                  <strong>{chapter.title}</strong>
                  <span>{formatDate(chapter.releaseDate)} · {chapter.pages.length} páginas</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="spacedrum-empty">No hay capítulos cargados todavía.</div>
          )}
        </aside>

        <section className="spacedrum-reader" aria-label="Lector de manga">
          {selectedChapter ? (
            <>
              <div className="spacedrum-reader-header">
                <div>
                  <span>{formatDate(selectedChapter.releaseDate)}</span>
                  <h2>{selectedChapter.title}</h2>
                  {selectedChapter.summary ? <p>{selectedChapter.summary}</p> : null}
                </div>
              </div>

              <div className="spacedrum-pages">
                {selectedChapter.pages.map((page, index) => (
                  <figure key={`${selectedChapter.id}-${page.image}`} className="spacedrum-page-frame">
                    <img src={page.image} alt={page.alt} loading={index === 0 ? "eager" : "lazy"} />
                    <figcaption>Página {index + 1}</figcaption>
                  </figure>
                ))}
              </div>
            </>
          ) : (
            <div className="spacedrum-empty">Selecciona un capítulo para comenzar.</div>
          )}
        </section>
      </section>
    </main>
  );
}
