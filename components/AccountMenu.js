"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import { useRouter } from "next/navigation";

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
  const menuRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

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
      <Link href="/login" id="btn-login-top" className="admin-icon-button" aria-label="Iniciar sesion de admin">
        <span className="admin-icon" aria-hidden="true">A</span>
        <span>Admin</span>
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
