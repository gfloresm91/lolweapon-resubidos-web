# Observabilidad de Nginx

## Objetivo

Resumir cada 15 minutos el tráfico recibido por Nginx sin añadir trabajo al proceso web de Next.js. El resumen separa hosts y excluye los WebSockets cerrados de los percentiles de latencia HTTP.

`trackedRoutes` mide por separado las rutas web y móvil de persistencia de reproducción. Los IDs se normalizan como `:id`, evitando cardinalidad por directo.

## Requisitos del servidor

- `/var/log/nginx/observability.log` debe usar JSON válido y contener `connectionType`.
- El usuario `kalaplex` debe poder leer el log mediante el grupo suplementario `adm` de la unidad.
- El checkout de QA debe existir en `/home/kalaplex/resubidos-qa`.
- Node.js debe estar disponible en el `PATH` de systemd mediante `/usr/bin/env`.

La unidad es `oneshot`: no mantiene un proceso residente. Lee el log por streaming, limita el análisis a los últimos 15 minutos y termina. Se ejecuta con prioridad baja de CPU e I/O.

## Instalación en QA

Desde `/home/kalaplex/resubidos-qa`:

```bash
sudo install -o root -g root -m 0644 \
  deploy/systemd/lolweapon-nginx-metrics.service \
  /etc/systemd/system/lolweapon-nginx-metrics.service

sudo install -o root -g root -m 0644 \
  deploy/systemd/lolweapon-nginx-metrics.timer \
  /etc/systemd/system/lolweapon-nginx-metrics.timer

sudo systemctl daemon-reload
sudo systemctl start lolweapon-nginx-metrics.service
sudo systemctl enable --now lolweapon-nginx-metrics.timer
```

La primera ejecución manual debe terminar correctamente antes de habilitar el timer.

## Verificación

```bash
sudo systemctl status lolweapon-nginx-metrics.service --no-pager
sudo systemctl status lolweapon-nginx-metrics.timer --no-pager
sudo systemctl list-timers lolweapon-nginx-metrics.timer --no-pager
sudo journalctl -u lolweapon-nginx-metrics.service -n 100 --no-pager
```

El servicio inactivo después de una ejecución exitosa es normal para `Type=oneshot`. Debe mostrar `status=0/SUCCESS`; el timer debe permanecer `active (waiting)` con una próxima ejecución programada.

## Ejecución manual

```bash
sudo npm run metrics:nginx -- --minutes 15
```

Para revisar las últimas ejecuciones automáticas:

```bash
sudo journalctl \
  -u lolweapon-nginx-metrics.service \
  --since "1 hour ago" \
  --no-pager
```

## Rollback

Deshabilitar el timer no afecta Nginx ni la aplicación:

```bash
sudo systemctl disable --now lolweapon-nginx-metrics.timer
```

Si se necesita retirar también las unidades instaladas, primero deshabilitar el timer y luego eliminar únicamente estos dos archivos de `/etc/systemd/system/` antes de ejecutar `sudo systemctl daemon-reload`:

- `lolweapon-nginx-metrics.service`
- `lolweapon-nginx-metrics.timer`

El log `/var/log/nginx/observability.log` es independiente y no debe borrarse como parte de este rollback.
