"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function DetailTopbarActions({ isAdmin }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.refresh();
  }

  if (isAdmin) {
    return (
      <div className="topbar-actions">
        <button type="button" className="admin-icon-button is-logged" onClick={logout}>
          <span className="admin-icon" aria-hidden="true">A</span>
          <span>Salir</span>
        </button>
      </div>
    );
  }

  return (
    <Link href="/login" className="admin-icon-button" aria-label="Iniciar sesion de admin">
      <span className="admin-icon" aria-hidden="true">A</span>
      <span>Admin</span>
    </Link>
  );
}
