INSERT INTO "PlatformPermission" (code, label, "group", "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES
('home.view', 'Ver inicio', 'Inicio', 1, true, NOW(), NOW()),
('anime.tracking.view', 'Ver Viendo', 'Anime: Viendo', 100, true, NOW(), NOW()),
('anime.tracking.create', 'Crear en Viendo', 'Anime: Viendo', 110, true, NOW(), NOW()),
('anime.tracking.update', 'Editar Viendo', 'Anime: Viendo', 120, true, NOW(), NOW()),
('anime.tracking.delete', 'Eliminar de Viendo', 'Anime: Viendo', 130, true, NOW(), NOW()),
('anime.tracking.form.full', 'Formulario completo', 'Anime: Viendo', 140, true, NOW(), NOW()),
('anime.tracking.form.compact', 'Formulario compacto', 'Anime: Viendo', 150, true, NOW(), NOW()),
('anime.completed.view', 'Ver Terminados', 'Anime: Terminados', 160, true, NOW(), NOW()),
('anime.completed.create', 'Crear en Terminados', 'Anime: Terminados', 170, true, NOW(), NOW()),
('anime.completed.update', 'Editar Terminados', 'Anime: Terminados', 180, true, NOW(), NOW()),
('anime.completed.delete', 'Eliminar de Terminados', 'Anime: Terminados', 190, true, NOW(), NOW()),
('anime.completed.form.full', 'Formulario completo', 'Anime: Terminados', 200, true, NOW(), NOW()),
('anime.completed.form.compact', 'Formulario compacto', 'Anime: Terminados', 210, true, NOW(), NOW()),
('spacedrum.view', 'Ver SpaceDrum', 'SpaceDrum', 400, true, NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
label = EXCLUDED.label,
"group" = EXCLUDED."group",
"sortOrder" = EXCLUDED."sortOrder",
"isActive" = true,
"updatedAt" = NOW();

WITH pairs(old_code, new_code) AS (
  VALUES
  ('anime.view', 'anime.tracking.view'),
  ('anime.create', 'anime.tracking.create'),
  ('anime.update', 'anime.tracking.update'),
  ('anime.delete', 'anime.tracking.delete'),
  ('anime.form.full', 'anime.tracking.form.full'),
  ('anime.form.compact', 'anime.tracking.form.compact')
)
INSERT INTO "PlatformRolePermission" ("roleId", "permissionId")
SELECT role_permission."roleId", new_permission.id
FROM "PlatformRolePermission" role_permission
JOIN "PlatformPermission" old_permission ON old_permission.id = role_permission."permissionId"
JOIN pairs ON pairs.old_code = old_permission.code
JOIN "PlatformPermission" new_permission ON new_permission.code = pairs.new_code
ON CONFLICT DO NOTHING;

DELETE FROM "PlatformPermission"
WHERE code IN (
  'anime.view',
  'anime.create',
  'anime.update',
  'anime.delete',
  'anime.form.full',
  'anime.form.compact'
);
