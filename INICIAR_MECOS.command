#!/bin/bash
# MecOS — duplo clique para iniciar
cd "$(dirname "$0")/frontend-web"

# garante que node/npm estão no PATH mesmo fora do Terminal padrão
export PATH="$HOME/.local/bin:$PATH"

echo "=============================================="
echo "  MecOS — Sistema de Ordens de Serviço"
echo "=============================================="

# instala dependências na primeira execução
if [ ! -d "node_modules" ]; then
  echo "Primeira execução: instalando dependências (2-3 min)..."
  npm install
  echo "Dependências instaladas."
fi

echo "Iniciando... o navegador abre sozinho em alguns segundos."
echo "Para encerrar: feche esta janela ou pressione Ctrl+C."

( sleep 3 && open "http://localhost:3000" ) &

npm run dev
