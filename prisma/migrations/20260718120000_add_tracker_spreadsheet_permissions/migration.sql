INSERT INTO "PlatformPermission" ("code", "label", "group", "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES
  ('tracker.export', 'Exportar directos a Excel', 'Archivo VOD: Rastreador', 52, true, NOW(), NOW()),
  ('tracker.import', 'Importar actualizaciones desde Excel', 'Archivo VOD: Rastreador', 54, true, NOW(), NOW())
ON CONFLICT ("code") DO UPDATE SET
  "label" = EXCLUDED."label",
  "group" = EXCLUDED."group",
  "sortOrder" = EXCLUDED."sortOrder",
  "isActive" = true,
  "updatedAt" = NOW();

INSERT INTO "PlatformRolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "PlatformRole" r
JOIN "PlatformPermission" p ON p."code" IN ('tracker.export', 'tracker.import')
WHERE r."code" IN ('dios', 'admin')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
