# Deploy real na VPS Hostinger — runbook

O Alcides confirmou que o plano é uma **VPS** Hostinger (não hospedagem
compartilhada) — dá pra rodar o Next.js exatamente como ele é hoje
(client-side puro, sem API routes), sem precisar reescrever as telas com
ID (`orders/[id]`, `customers/[id]`, `vehicles/[id]`, `admin/[clientId]`)
pra um formato "estático exportável".

O `.github/workflows/deploy.yml` já está pronto e dispara sozinho a cada
push em `main` que toque `frontend-web/**` — mas só funciona depois do
setup manual abaixo (feito uma única vez, por quem tem acesso à VPS).
Até lá, o job falha no passo de SSH (autenticação), sem nenhum efeito —
é seguro deixar mergeado esperando.

## Por que o build acontece DENTRO da VPS, não no GitHub Actions

O app lê as chaves do Firebase de `frontend-web/.env.local`
(`NEXT_PUBLIC_FIREBASE_*`, ver `.env.example`). Em vez de transformar
essas chaves em secrets do GitHub, a ideia é copiar o mesmo
`.env.local` que já existe no Mac do Alcides (seção 6.7 do `CLAUDE.md`)
direto pra dentro da VPS, uma única vez. Assim o workflow só precisa de
3 secrets (acesso SSH) — nunca vê as chaves do Firebase.

## 1. Setup único da VPS (fazer uma vez, via SSH ou terminal do hPanel)

Assumindo Ubuntu (padrão das VPS da Hostinger). Ajustar se for outra
distro.

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

# PM2 — mantém o processo rodando e reinicia sozinho se cair
sudo npm install -g pm2

# Clonar o repositório (na home do usuário usado pra deploy)
cd ~
git clone https://github.com/Alcidesmov/sistema-os.git
cd sistema-os/frontend-web
npm ci
```

⚠️ Se o repositório for privado, o `git clone` acima pede autenticação —
gerar um Personal Access Token no GitHub (mesmo caminho da seção 6.6 do
`CLAUDE.md`) e usar como senha, ou configurar uma chave SSH de deploy.

## 2. Copiar o `.env.local` real pra dentro da VPS

Do Mac do Alcides, com a VPS já com IP/usuário configurado:

```bash
scp frontend-web/.env.local usuario@IP_DA_VPS:~/sistema-os/frontend-web/.env.local
```

(Ou colar o conteúdo direto pelo Gerenciador de Arquivos do hPanel, se
preferir não usar terminal.)

## 3. Primeiro build + subir o processo

Ainda dentro da VPS:

```bash
cd ~/sistema-os/frontend-web
npm run build
pm2 start npm --name mecos-web -- start
pm2 save          # sobrevive a reboot da VPS
pm2 startup       # roda o comando que ele imprimir, uma vez só
```

O Next.js sobe na porta **3000** por padrão.

## 4. Abrir a porta no firewall

```bash
sudo ufw allow 3000
```

(Se o hPanel tiver um firewall próprio de VPS na interface web, também
liberar a porta 3000 lá.)

Nesse ponto, `http://IP_DA_VPS:3000` já deve abrir o MecOS de qualquer
lugar — celular incluso. **Isso já resolve o pedido original** ("acessar
web/mobile"), mesmo sem domínio/HTTPS ainda.

## 5. Configurar os secrets no GitHub

No repositório `sistema-os` → **Settings → Secrets and variables →
Actions → New repository secret**, criar 3:

| Nome | Valor |
|---|---|
| `HOSTINGER_HOST` | IP da VPS |
| `HOSTINGER_USER` | usuário SSH usado no passo 1 |
| `HOSTINGER_PASS` | senha desse usuário |

A partir daqui, todo merge em `main` que mexer em `frontend-web/`
dispara o deploy sozinho: o GitHub Actions entra por SSH, dá
`git pull`, `npm ci`, `npm run build` e reinicia o PM2.

⚠️ Essas credenciais não devem ser digitadas em conversa nenhuma com o
Claude — cadastrar direto no GitHub, pelo link acima.

## O que fica pra depois (não é bloqueio pro deploy funcionar)

- **Domínio + HTTPS**: hoje o acesso é por IP puro na porta 3000. Pra um
  domínio de verdade com `https://`, precisa de um proxy reverso (Nginx)
  na porta 443 apontando pra `localhost:3000` + certificado (Certbot/Let's
  Encrypt) — trabalho futuro, separado deste runbook.
- **Memória da VPS**: `npm run build` do Next.js pode consumir bastante
  RAM. Se o build falhar por falta de memória num plano de VPS pequeno,
  adicionar um arquivo de swap resolve — não coberto aqui até acontecer.
