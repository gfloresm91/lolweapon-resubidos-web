#!/usr/bin/env bash
# Deploy script para resubidos (prod) y resubidos-qa (QA)
#
# Uso:
#   ./scripts/deploy.sh          # despliega en el directorio actual
#   ./scripts/deploy.sh prod     # despliega producción  (/home/kalaplex/resubidos)
#   ./scripts/deploy.sh qa       # despliega QA          (/home/kalaplex/resubidos-qa)

set -euo pipefail

# ── Configuración ─────────────────────────────────────────────────────────────

PROD_DIR="/home/kalaplex/resubidos"
QA_DIR="/home/kalaplex/resubidos-qa"
PROD_SERVICE="resubidos.service"
QA_SERVICE="resubidos-qa.service"
GIT_BRANCH="${GIT_BRANCH:-$(git -C "$APP_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")}"
ENV_FILE=".env"
BACKUP_DIR_NAME=".next_backup"

# ── Resolución de entorno ──────────────────────────────────────────────────────

ENV_ARG="${1:-}"

if [[ "$ENV_ARG" == "prod" ]]; then
  APP_DIR="$PROD_DIR"
  SERVICE="$PROD_SERVICE"
elif [[ "$ENV_ARG" == "qa" ]]; then
  APP_DIR="$QA_DIR"
  SERVICE="$QA_SERVICE"
else
  # Sin argumento: usar directorio actual si es una app conocida
  CURRENT_DIR="$(pwd)"
  if [[ "$CURRENT_DIR" == "$PROD_DIR" ]]; then
    APP_DIR="$PROD_DIR"
    SERVICE="$PROD_SERVICE"
  elif [[ "$CURRENT_DIR" == "$QA_DIR" ]]; then
    APP_DIR="$QA_DIR"
    SERVICE="$QA_SERVICE"
  else
    echo "ERROR: Ejecuta desde $PROD_DIR o $QA_DIR, o pasa 'prod' / 'qa' como argumento."
    exit 1
  fi
fi

# ── Helpers ────────────────────────────────────────────────────────────────────

log()     { echo "[$(date '+%H:%M:%S')] $*"; }
success() { echo "[$(date '+%H:%M:%S')] ✓ $*"; }
error()   { echo "[$(date '+%H:%M:%S')] ✗ ERROR: $*" >&2; }

rollback() {
  error "Fallo en el deploy. Intentando rollback..."
  if [[ -d "$APP_DIR/$BACKUP_DIR_NAME" ]]; then
    rm -rf "$APP_DIR/.next"
    mv "$APP_DIR/$BACKUP_DIR_NAME" "$APP_DIR/.next"
    log "Build anterior restaurado."
  fi
  sudo systemctl restart "$SERVICE" || true
  error "Rollback completado. Revisa los logs: journalctl -u $SERVICE -n 50"
  exit 1
}

# ── Inicio ─────────────────────────────────────────────────────────────────────

log "=== Deploy → $SERVICE (dir: $APP_DIR) ==="
cd "$APP_DIR"

# Verificar que el .env existe
if [[ ! -f "$ENV_FILE" ]]; then
  error "No se encontró $APP_DIR/$ENV_FILE"
  exit 1
fi

# ── 1. Backup de la build actual ───────────────────────────────────────────────

if [[ -d ".next" ]]; then
  log "Haciendo backup del build actual..."
  rm -rf "$BACKUP_DIR_NAME"
  cp -r .next "$BACKUP_DIR_NAME"
  success "Backup en $APP_DIR/$BACKUP_DIR_NAME"
else
  log "No hay build previo, omitiendo backup."
fi

# ── 2. Backup de la base de datos ─────────────────────────────────────────────

if [[ -f "$ENV_FILE" ]]; then
  log "Haciendo backup de la base de datos..."
  bash scripts/backup-postgres.sh && success "Backup DB completado." || {
    error "No se pudo hacer backup de la DB. Continuando de todas formas..."
  }
fi

# ── 3. Git pull ────────────────────────────────────────────────────────────────

trap rollback ERR

log "Descargando cambios (git pull origin $GIT_BRANCH)..."
git pull origin "$GIT_BRANCH"
success "Código actualizado. Commit: $(git rev-parse --short HEAD)"

# ── 4. Dependencias ────────────────────────────────────────────────────────────

log "Instalando dependencias (npm ci)..."
npm ci --prefer-offline
success "Dependencias instaladas."

# ── 5. Build ───────────────────────────────────────────────────────────────────

log "Construyendo la aplicación (npm run build)..."
npm run build
success "Build completado."

# ── 6. Migraciones de base de datos ───────────────────────────────────────────

log "Ejecutando migraciones de Prisma..."
npx prisma migrate deploy
success "Migraciones aplicadas."

# ── 7. Reiniciar servicio ──────────────────────────────────────────────────────

log "Reiniciando $SERVICE..."
sudo systemctl restart "$SERVICE"
sleep 3

if systemctl is-active --quiet "$SERVICE"; then
  success "$SERVICE está corriendo."
else
  error "$SERVICE no está activo después del reinicio."
  rollback
fi

# ── 8. Limpieza ────────────────────────────────────────────────────────────────

trap - ERR
rm -rf "$BACKUP_DIR_NAME"

# ── Resumen ────────────────────────────────────────────────────────────────────

log ""
log "=== Deploy completado ==="
log "  Servicio : $SERVICE"
log "  Commit   : $(git rev-parse --short HEAD)"
log "  Logs     : journalctl -u $SERVICE -f"
