#!/usr/bin/env bash
# Installe et lance Drivly sur Debian (Docker + nginx).
# Usage (depuis la racine du projet, en root ou avec sudo) :
#   chmod +x deploy/install-debian.sh
#   sudo ./deploy/install-debian.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PORT="${DRIVLY_PORT:-80}"
MODE="${1:-docker}"

need_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    echo "Relance en root : sudo $0 $*"
    exit 1
  fi
}

install_docker() {
  if command -v docker >/dev/null 2>&1; then
    echo "Docker déjà présent."
    return
  fi
  echo "Installation de Docker…"
  apt-get update -y
  apt-get install -y ca-certificates curl
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable --now docker
}

open_firewall() {
  if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
    ufw allow "${PORT}/tcp" comment "Drivly"
    echo "UFW : port ${PORT} autorisé."
  else
    echo "Pare-feu UFW inactif ou absent. Ouvre le port ${PORT} si tu as iptables/nftables."
  fi
}

deploy_docker() {
  need_root
  install_docker
  if [[ ! -f .env ]]; then
    cp .env.example .env
    sed -i "s/^DRIVLY_PORT=.*/DRIVLY_PORT=${PORT}/" .env
  fi
  open_firewall
  docker compose up -d --build
  echo
  echo "Drivly tourne."
  echo "  Local  : http://127.0.0.1:${PORT}"
  echo "  Santé  : http://127.0.0.1:${PORT}/health"
  echo "Depuis l’extérieur : http://IP-DU-SERVEUR:${PORT}"
}

install_node() {
  if command -v node >/dev/null 2>&1; then
    echo "Node $(node -v) déjà présent."
    return
  fi
  echo "Installation de Node.js 22…"
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update -y
  apt-get install -y nodejs
}

deploy_nginx() {
  need_root
  install_node
  apt-get update -y
  apt-get install -y nginx rsync
  echo "Build de l’application…"
  if [[ ! -d node_modules ]]; then
    npm ci
  fi
  npm run build
  mkdir -p /var/www/drivly
  rsync -a --delete dist/ /var/www/drivly/
  install -m 0644 deploy/nginx.debian.conf /etc/nginx/sites-available/drivly
  ln -sfn /etc/nginx/sites-available/drivly /etc/nginx/sites-enabled/drivly
  if [[ -f /etc/nginx/sites-enabled/default ]]; then
    rm -f /etc/nginx/sites-enabled/default
  fi
  nginx -t
  systemctl enable --now nginx
  systemctl reload nginx
  open_firewall
  echo
  echo "Drivly est servi par nginx dans /var/www/drivly"
  echo "  http://IP-DU-SERVEUR/"
}

case "${MODE}" in
  docker) deploy_docker ;;
  nginx) deploy_nginx ;;
  *)
    echo "Usage : $0 [docker|nginx]"
    echo "  docker  (défaut)  image nginx, recommandé"
    echo "  nginx             build Node + nginx système"
    exit 1
    ;;
esac
