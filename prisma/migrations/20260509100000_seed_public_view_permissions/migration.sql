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
