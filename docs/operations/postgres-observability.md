# Observabilidad de PostgreSQL

## Objetivo

Capturar cada 15 minutos métricas agregadas de la instancia PostgreSQL compartida por producción y QA. El recolector calcula deltas por base sin registrar SQL, parámetros, usuarios ni credenciales.

La solución no requiere `pg_stat_statements`, `track_io_timing`, cambios de configuración ni reiniciar PostgreSQL. La primera ejecución crea la línea base; desde la segunda calcula transacciones y bloques por segundo, además de temporales y deadlocks del intervalo.

El snapshot incluye también `pg_stat_wal`: bytes y registros WAL, full-page images y saturaciones de buffers por intervalo. WAL es global a la instancia compartida; debe correlacionarse con las tasas separadas por base y con `trackedRoutes` de Nginx, no atribuirse directamente a un solo ambiente.

## Instalación en QA

El servicio necesita acceso a Docker. Para no ejecutar como root un archivo modificable desde el checkout, primero se instala una copia propiedad de root:

```bash
sudo install -d -o root -g root -m 0755 /usr/local/lib/lolweapon-observability

sudo install -o root -g root -m 0755 \
  scripts/summarize-postgres-observability.mjs \
  /usr/local/lib/lolweapon-observability/summarize-postgres-observability.mjs

sudo install -o root -g root -m 0644 \
  deploy/systemd/lolweapon-postgres-metrics.service \
  /etc/systemd/system/lolweapon-postgres-metrics.service

sudo install -o root -g root -m 0644 \
  deploy/systemd/lolweapon-postgres-metrics.timer \
  /etc/systemd/system/lolweapon-postgres-metrics.timer

sudo systemctl daemon-reload
sudo systemctl start lolweapon-postgres-metrics.service
```

La ejecución manual debe terminar con `status=0/SUCCESS`. Después se habilita el timer:

```bash
sudo systemctl enable --now lolweapon-postgres-metrics.timer
```

## Verificación

```bash
sudo systemctl status lolweapon-postgres-metrics.service --no-pager
sudo systemctl status lolweapon-postgres-metrics.timer --no-pager
sudo systemctl list-timers lolweapon-postgres-metrics.timer --no-pager
sudo journalctl -u lolweapon-postgres-metrics.service -n 150 --no-pager
```

El servicio queda inactivo después de cada ejecución porque es `oneshot`. En la primera muestra, cada base muestra `baselineOnly: true`; en las siguientes debe ser `false` y aparecer `intervalSeconds`.

## Actualización

Cuando cambie el recolector versionado, volver a instalar la copia root-owned y reiniciar manualmente el servicio una vez antes de esperar al timer:

```bash
sudo install -o root -g root -m 0755 \
  scripts/summarize-postgres-observability.mjs \
  /usr/local/lib/lolweapon-observability/summarize-postgres-observability.mjs

sudo systemctl start lolweapon-postgres-metrics.service
```

## Rollback

```bash
sudo systemctl disable --now lolweapon-postgres-metrics.timer
```

Deshabilitar el timer no modifica ni detiene PostgreSQL. El estado en `/var/lib/lolweapon-observability/postgres-state.json` puede conservarse para una reactivación posterior.
