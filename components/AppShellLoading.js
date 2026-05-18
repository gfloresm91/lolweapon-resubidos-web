export default function AppShellLoading() {
  return (
    <div className="app-shell" aria-busy="true" aria-label="Cargando">
      <div className="content-shell">
        <header className="topbar" aria-hidden="true">
          <div className="topbar-title">
            <div className="shell-loading-kicker skeleton-block" />
            <div className="shell-loading-page skeleton-block" />
          </div>
        </header>
        <main className="app-wrapper">
          <div className="shell-loading-content skeleton-block" />
        </main>
      </div>
    </div>
  );
}
