DO $$
DECLARE
  guest_role_id INTEGER;
  public_role_id INTEGER;
BEGIN
  SELECT "id" INTO guest_role_id
  FROM "PlatformRole"
  WHERE "code" = 'invitado';

  IF guest_role_id IS NULL THEN
    RETURN;
  END IF;

  SELECT "id" INTO public_role_id
  FROM "PlatformRole"
  WHERE "code" = 'publico';

  IF EXISTS (SELECT 1 FROM "PlatformUser" WHERE "roleId" = guest_role_id) THEN
    IF public_role_id IS NULL THEN
      RAISE EXCEPTION 'No se puede retirar invitado: falta el rol publico para reasignar usuarios.';
    END IF;

    UPDATE "PlatformUser"
    SET "roleId" = public_role_id,
        "roleSource" = 'manual',
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "roleId" = guest_role_id;
  END IF;

  DELETE FROM "PlatformRole"
  WHERE "id" = guest_role_id;
END $$;
