#!/usr/bin/env bash
# ==============================================================================
# Deploy wacrm to production (wacrm.admx.tech)
# ==============================================================================
set -euo pipefail

SERVER="root@5.161.30.120"
SSH_KEY="/home/nader/.ssh/admx_control_ed25519"
REMOTE_DIR="/root/stacks/wacrm"

echo "=== [1/5] Verificação de tipos e testes ==="
npx tsc --noEmit
npm test

echo "=== [2/5] Build Next.js para produção (standalone) ==="
NEXT_PUBLIC_SITE_URL="https://wcloudapi.dev" \
NEXT_PUBLIC_APP_LOCALE="pt-BR" \
NEXT_PUBLIC_SUPABASE_URL="https://api-db.admx.tech" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg1NTM1NDI2LCJleHAiOjIxMDA4OTU0MjZ9.azgQJhy7QawNIwjg_dUqWwsX3KefX8jkgTOTGRtGbM8" \
NEXT_PUBLIC_DJANGO_API_URL="https://api-crm.admx.tech" \
npm run build

echo "=== [3/5] Empacotando bundle standalone ==="
tar -czf bundle.tar.gz public Dockerfile.standalone docker-compose.prod.yml .dockerignore .next/standalone .next/static

echo "=== [4/5] Enviando bundle para o servidor de produção ==="
scp -i "$SSH_KEY" bundle.tar.gz "$SERVER:$REMOTE_DIR/bundle.tar.gz"
rm -f bundle.tar.gz

echo "=== [5/5] Construindo imagem Docker e atualizando Swarm ==="
ssh -i "$SSH_KEY" "$SERVER" "cd $REMOTE_DIR && \
  tar -xzf bundle.tar.gz && \
  docker build -f Dockerfile.standalone -t wacrm:latest . && \
  docker stack deploy -c docker-compose.prod.yml wacrm && \
  docker service update --image wacrm:latest --force wacrm_app"

echo "✅ Deploy concluído com sucesso!"
echo "🌐 Acesse: https://wcloudapi.dev"
