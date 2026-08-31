export const PUBLIC_ACCESS_PERMISSION_CODES = Object.freeze([
  "home.view",
  "notifications.view",
  "rtfm.view",
  "news.view",
  "changelog.view",
  "tracker.view",
  "anime.tracking.view",
  "anime.completed.view",
  "anime.tierlist.animes.view",
  "anime.tierlist.openings.view",
]);

export const PUBLIC_ACCESS_PERMISSIONS = Object.freeze([
  { code: "home.view", label: "Ver inicio", group: "Acceso público", sortOrder: 1 },
  { code: "notifications.view", label: "Ver campana de notificaciones", group: "Acceso público", sortOrder: 2 },
  { code: "rtfm.view", label: "Ver RTFM", group: "Acceso público", sortOrder: 3 },
  { code: "news.view", label: "Ver novedades", group: "Acceso público", sortOrder: 4 },
  { code: "changelog.view", label: "Ver historial de cambios", group: "Acceso público", sortOrder: 5 },
  { code: "tracker.view", label: "Ver rastreador", group: "Acceso público", sortOrder: 6 },
  { code: "anime.tracking.view", label: "Ver anime en emisión", group: "Acceso público", sortOrder: 7 },
  { code: "anime.completed.view", label: "Ver anime terminado", group: "Acceso público", sortOrder: 8 },
  { code: "anime.tierlist.animes.view", label: "Ver Tier List de animes", group: "Acceso público", sortOrder: 9 },
  { code: "anime.tierlist.openings.view", label: "Ver Tier List de openings y endings", group: "Acceso público", sortOrder: 10 },
]);

export const PUBLIC_VISITOR_ROLE = Object.freeze({
  code: "visitante",
  label: "Visitante",
  sortOrder: 1000,
  isActive: true,
  canAdmin: false,
  permissions: PUBLIC_ACCESS_PERMISSION_CODES,
});

export function withPublicAccessPermissions(permissionCodes = []) {
  return Array.from(new Set([...PUBLIC_ACCESS_PERMISSION_CODES, ...(permissionCodes || [])]));
}

export function hasPublicAccessPermission(permissionCode) {
  return PUBLIC_ACCESS_PERMISSION_CODES.includes(permissionCode);
}

export function withPublicVisitorRole(roles = []) {
  return [PUBLIC_VISITOR_ROLE, ...(roles || []).filter((role) => role.code !== "invitado" && role.code !== PUBLIC_VISITOR_ROLE.code)];
}

export function withPublicPermissionDefinitions(permissions = []) {
  const publicCodes = new Set(PUBLIC_ACCESS_PERMISSION_CODES);
  return [
    ...PUBLIC_ACCESS_PERMISSIONS,
    ...(permissions || []).filter((permission) => !publicCodes.has(permission.code)),
  ];
}
