"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, MessageSquare, Settings, User } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import AppLink from "@/components/AppLink";
import UserAvatar from "@/components/UserAvatar";

export default function AccountMenu({ user }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const menuRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const currentQuery = searchParams.toString();
  const currentPath = `${pathname || "/"}${currentQuery ? `?${currentQuery}` : ""}`;
  const loginHref = `/login?next=${encodeURIComponent(currentPath)}`;

  useEffect(() => {
    function handlePointerDown(event) {
      if (!menuRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("is-account-menu-open", isOpen);

    return () => {
      document.body.classList.remove("is-account-menu-open");
    };
  }, [isOpen]);

  async function logout() {
    setIsOpen(false);
    await fetch("/api/logout", { method: "POST" });
    router.push("/inicio");
    router.refresh();
  }

  if (!user) {
    return (
      <Link href={loginHref} id="btn-login-top" className="admin-icon-button" aria-label="Iniciar sesión">
        <span className="admin-icon" aria-hidden="true">
          <User size={16} />
        </span>
        <span>Iniciar sesión</span>
      </Link>
    );
  }

  return (
    <div className="account-menu" ref={menuRef}>
      <button
        type="button"
        className="account-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <UserAvatar user={user} />
        <span className="account-trigger-copy">
          <strong>{user.alias || user.login || "Admin"}</strong>
          <em>{user.roleLabel || "Admin"}</em>
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className="account-menu-popover" role="menu">
          <div className="account-menu-header">
            <UserAvatar user={user} className="account-avatar-large" />
            <div>
              <strong>{user.alias || user.login || "Admin"}</strong>
              <span>{user.roleLabel || "Admin"}</span>
            </div>
          </div>
          <Link href="/perfil" className="account-menu-item" role="menuitem" onClick={() => setIsOpen(false)}>
            <Settings size={16} aria-hidden="true" />
            Configurar perfil
          </Link>
          {user.permissions?.includes("support.tickets.view") || user.role === "dios" ? (
            <AppLink href="/sugerencias-reclamos" className="account-menu-item" role="menuitem" onClick={() => setIsOpen(false)}>
              <MessageSquare size={16} aria-hidden="true" />
              Sugerencias/Reclamos
            </AppLink>
          ) : null}
          <button type="button" className="account-menu-item danger" role="menuitem" onClick={logout}>
            <LogOut size={16} aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      ) : null}
    </div>
  );
}
