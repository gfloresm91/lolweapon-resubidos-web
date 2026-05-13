INSERT INTO "PlatformRole" (code, label, "sortOrder", "isActive", "canAdmin", "createdAt", "updatedAt")
VALUES ('invitado', 'Invitado', 100, true, false, NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = NOW();

INSERT INTO "PlatformRolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "PlatformRole" r
JOIN "PlatformPermission" p ON p.code IN (
  'home.view',
  'tracker.view',
  'anime.tracking.view',
  'anime.completed.view'
)
WHERE r.code = 'invitado'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "PlatformRolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "PlatformRole" r
JOIN "PlatformPermission" p ON p.code IN (
  'home.view',
  'tracker.view',
  'anime.tracking.view',
  'anime.completed.view'
)
WHERE r.code = 'publico'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
