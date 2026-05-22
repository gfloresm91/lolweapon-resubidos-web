# Workflow: Estado De Deploys

Guía para verificar estado de GitHub Actions, systemd y base de datos.

## 1. GitHub Actions

```bash
gh run list --limit 5
gh run view
```

Si `gh` no está disponible o autenticado, revisar desde GitHub → Actions.

## 2. Producción

```bash
sudo systemctl status resubidos.service
sudo journalctl -u resubidos.service -n 80
git -C /home/kalaplex/resubidos rev-parse --short HEAD
git -C /home/kalaplex/resubidos status --short
```

URL:

- `https://resubidos.lolweapon.com`
- `https://viendo.lolweapon.com`

## 3. QA

```bash
sudo systemctl status resubidos-qa.service
sudo journalctl -u resubidos-qa.service -n 80
git -C /home/kalaplex/resubidos-qa rev-parse --short HEAD
git -C /home/kalaplex/resubidos-qa status --short
```

URL:

- `https://resubidos-qa.lolweapon.com`
- `https://viendo-qa.lolweapon.com`

## 4. Docker / PostgreSQL

```bash
docker ps
docker inspect lolweapon-resubidos-postgres --format '{{range .Mounts}}{{println .Name .Destination}}{{end}}'
```

Producción:

```bash
docker exec lolweapon-resubidos-postgres \
  psql -U lolweapon -d lolweapon_resubidos -c "\dt"
```

QA:

```bash
docker exec lolweapon-resubidos-postgres \
  psql -U lolweapon -d lolweapon_resubidos_qa -c "\dt"
```

## 5. Health Checks Manuales

Probar:

- Login manual.
- Login Twitch.
- `/rastreador`.
- `/biblioteca-anime/viendo`.
- `/biblioteca-anime/terminados`.
- `/administracion/usuarios`.
- Una mutación simple si el deploy incluyó cambios admin.

## 6. Señales De Problema

- `systemctl` en `failed`.
- Logs con errores Prisma o `.prisma/client`.
- Build viejo en Git respecto al commit esperado.
- Error de migración pendiente.
- `DATABASE_URL` apuntando a una BD incorrecta.
- Docker container detenido o DB equivocada.
