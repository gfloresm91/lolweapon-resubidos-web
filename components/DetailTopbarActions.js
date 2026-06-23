"use client";

import AccountMenu from "@/components/AccountMenu";
import NotificationCenter from "@/components/NotificationCenter";

export default function DetailTopbarActions({ currentUser = null, canManageUsers = false }) {
  return (
    <div className="topbar-actions">
      <NotificationCenter user={currentUser} />
      <AccountMenu user={currentUser} canManageUsers={canManageUsers} />
    </div>
  );
}
