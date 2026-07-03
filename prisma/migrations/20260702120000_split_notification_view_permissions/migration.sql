INSERT INTO "PlatformPermission" ("code", "label", "group", "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES
  ('notifications.view', 'Ver campana de notificaciones', 'Plataforma: Notificaciones', 2, true, NOW(), NOW()),
  ('notifications.full.view', 'Ver todas las notificaciones', 'Plataforma: Notificaciones', 3, true, NOW(), NOW())
ON CONFLICT ("code") DO UPDATE SET
  "label" = EXCLUDED."label",
  "group" = EXCLUDED."group",
  "sortOrder" = EXCLUDED."sortOrder",
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = NOW();

INSERT INTO "PlatformRolePermission" ("roleId", "permissionId", "assignedAt")
SELECT role."id", permission."id", NOW()
FROM "PlatformRole" role
JOIN "PlatformPermission" permission ON permission."code" = 'notifications.view'
WHERE role."code" = 'invitado'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
