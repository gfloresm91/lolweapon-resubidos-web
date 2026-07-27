export default function LiveDetailLoading() {
  return (
    <>
      <div className="bg-orb orb-1" aria-hidden="true" />
      <div className="bg-orb orb-2" aria-hidden="true" />
      <div className="bg-orb orb-3" aria-hidden="true" />

      <div className="app-shell live-detail-app-shell">
        <div className="content-shell">
          <header className="topbar" aria-hidden="true">
            <div className="topbar-title">
              <span className="topbar-kicker">Archivo VOD</span>
              <span className="topbar-page">Resubido</span>
            </div>
          </header>

          <main className="app-wrapper live-detail-page" aria-busy="true" aria-label="Cargando resubido">
            <div className="live-detail-shell">
              <div className="detail-skeleton-back skeleton-block" />

              <div className="detail-skeleton-nav">
                <div className="skeleton-block" />
                <div className="skeleton-block" />
              </div>

              <div className="watch-layout">
                <section className="watch-main-column">
                  <div className="detail-skeleton-player skeleton-block" />

                  <div className="watch-title-block">
                    <div className="watch-title-row">
                      <div className="detail-skeleton-title skeleton-block" />
                      <div className="detail-skeleton-actions">
                        <div className="skeleton-block" />
                        <div className="skeleton-block" />
                      </div>
                    </div>
                    <div className="detail-skeleton-meta">
                      <div className="skeleton-block" />
                      <div className="skeleton-block" />
                      <div className="skeleton-block" />
                    </div>
                  </div>

                  <div className="detail-skeleton-description skeleton-block" />
                </section>

                <aside className="watch-side-panel">
                  <div className="detail-skeleton-card skeleton-block" />
                </aside>
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
