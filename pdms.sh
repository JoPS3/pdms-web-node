#!/usr/bin/env bash
# pdms.sh — gestão de módulos PDMS via PM2
#
# Uso:
#   ./pdms.sh start           — inicia todos os módulos
#   ./pdms.sh restart         — reinicia e aplica variáveis de ambiente actuais
#   ./pdms.sh clean-restart   — delete + start (limpa estado PM2 antigo)
#   ./pdms.sh stop            — para todos os módulos
#   ./pdms.sh status          — estado de todos os processos PM2
#   ./pdms.sh logs <nome>     — logs de um módulo (ex: pdms-gateway)
#
# Módulos geridos:
#   pdms-gateway (6000), pdms-sysadmin (6001), pdms-mapas (6002)
#   pdms-vendas (6003), pdms-compras (6004), pdms-rh (6005)

set -e

MODULES=(
  "gateway:pdms-gateway"
  "sysadmin:pdms-sysadmin"
  "mapas:pdms-mapas"
  "vendas:pdms-vendas"
  "compras:pdms-compras"
  "rh:pdms-rh"
)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cmd="${1}"

case "$cmd" in
  start)
    echo "A iniciar módulos PDMS..."
    for entry in "${MODULES[@]}"; do
      dir="${entry%%:*}"
      name="${entry##*:}"
      echo ""
      echo "  → $name"
      pm2 start "$SCRIPT_DIR/$dir/ecosystem.config.cjs" --only "$name"
    done
    echo ""
    pm2 status
    ;;

  restart)
    echo "A reiniciar módulos PDMS (com update-env)..."
    for entry in "${MODULES[@]}"; do
      dir="${entry%%:*}"
      name="${entry##*:}"
      echo ""
      echo "  → $name"
      pm2 restart "$SCRIPT_DIR/$dir/ecosystem.config.cjs" --only "$name" --update-env
    done
    echo ""
    pm2 status
    ;;

  clean-restart)
    echo "A fazer clean-restart dos módulos PDMS (delete + start)..."
    for entry in "${MODULES[@]}"; do
      dir="${entry%%:*}"
      name="${entry##*:}"
      echo ""
      echo "  → $name (delete)"
      pm2 delete "$name" 2>/dev/null || true
    done
    echo ""
    echo "A iniciar módulos PDMS (fresh)..."
    for entry in "${MODULES[@]}"; do
      dir="${entry%%:*}"
      name="${entry##*:}"
      echo ""
      echo "  → $name"
      pm2 start "$SCRIPT_DIR/$dir/ecosystem.config.cjs" --only "$name"
    done
    echo ""
    pm2 status
    ;;

  stop)
    echo "A parar módulos PDMS..."
    for entry in "${MODULES[@]}"; do
      name="${entry##*:}"
      echo ""
      echo "  → $name"
      pm2 stop "$name"
    done
    echo ""
    pm2 status
    ;;

  status)
    pm2 status
    ;;

  logs)
    target="${2}"
    if [[ -z "$target" ]]; then
      echo "Erro: indica o nome do módulo. Ex: ./pdms.sh logs pdms-gateway"
      exit 1
    fi
    pm2 logs "$target"
    ;;

  *)
    echo ""
    echo "Uso: ./pdms.sh <comando> [argumento]"
    echo ""
    echo "  start          Inicia todos os módulos"
    echo "  restart        Reinicia todos os módulos e actualiza variáveis de ambiente"
    echo "  clean-restart  Delete + start (limpa estado PM2 antigo, força fresh start)"
    echo "  stop           Para todos os módulos"
    echo "  status         Mostra o estado PM2 de todos os processos"
    echo "  logs <name>    Mostra logs de um módulo (ex: pdms-gateway)"
    echo ""
    echo "Módulos geridos:"
    for entry in "${MODULES[@]}"; do
      dir="${entry%%:*}"
      name="${entry##*:}"
      echo "  $name  ($dir/ecosystem.config.cjs)"
    done
    echo ""
    exit 1
    ;;
esac
