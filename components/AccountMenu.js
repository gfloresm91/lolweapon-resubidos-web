"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, Settings, User } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

function getInitials(user) {
  const source = user?.alias || user?.login || "Admin";
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

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

  async function logout() {
    setIsOpen(false);
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
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
        <span className="account-avatar" aria-hidden="true">
          {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : getInitials(user)}
        </span>
        <span className="account-trigger-copy">
          <strong>{user.alias || user.login || "Admin"}</strong>
          <em>{user.roleLabel || "Admin"}</em>
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className="account-menu-popover" role="menu">
          <div className="account-menu-header">
            <span className="account-avatar account-avatar-large" aria-hidden="true">
              {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : getInitials(user)}
            </span>
            <div>
              <strong>{user.alias || user.login || "Admin"}</strong>
              <span>{user.roleLabel || "Admin"}</span>
            </div>
          </div>
          <Link href="/perfil" className="account-menu-item" role="menuitem" onClick={() => setIsOpen(false)}>
            <Settings size={16} aria-hidden="true" />
            Configurar perfil
          </Link>
          <button type="button" className="account-menu-item danger" role="menuitem" onClick={logout}>
            <LogOut size={16} aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      ) : null}
    </div>
  );
}
