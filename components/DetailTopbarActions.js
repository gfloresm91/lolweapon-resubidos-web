"use client";

import AccountMenu from "@/components/AccountMenu";

export default function DetailTopbarActions({ currentUser = null, canManageUsers = false }) {
  return (
    <div className="topbar-actions">
      <AccountMenu user={currentUser} canManageUsers={canManageUsers} />
    </div>
  );
}
