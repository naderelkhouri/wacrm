#!/usr/bin/env bash
# ==============================================================================
# Deploy wacrm to production (wacrm.admx.tech)
# ==============================================================================
set -euo pipefail

SERVER="root@5.161.30.120"
SSH_KEY="/home/nader/.ssh/admx_control_ed25519"
REMOTE_DIR="/root/stacks/wacrm"

echo "=== [1/4] Build & Typecheck local ==="
npx tsc --noEmit
npm test

echo "=== [2/4] Sincronizando arquivos com o servidor ==="
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  -e "ssh -i $SSH_KEY" \
  ./ "$SERVER:$REMOTE_DIR/"

echo "=== [3/4] Construindo imagem Docker no servidor ==="
ssh -i "$SSH_KEY" "$SERVER" "cd $REMOTE_DIR && docker build -t wacrm:latest ."

echo "=== [4/4] Atualizando stack no Docker Swarm ==="
ssh -i "$SSH_KEY" "$SERVER" "cd $REMOTE_DIR && docker stack deploy -c docker-compose.prod.yml wacrm"

echo "✅ Deploy concluído com sucesso!"
echo "🌐 Acesse: https://wacrm.admx.tech"
