"use client";

import AccountMenu from "@/components/AccountMenu";
import NotificationCenter from "@/components/NotificationCenter";

export default function DetailTopbarActions({ currentUser = null, canManageUsers = false, canViewNotifications = false, canViewAllNotifications = false }) {
  return (
    <div className="topbar-actions">
      {canViewNotifications ? <NotificationCenter user={currentUser} canViewAll={canViewAllNotifications} /> : null}
      <AccountMenu user={currentUser} canManageUsers={canManageUsers} />
    </div>
  );
}
