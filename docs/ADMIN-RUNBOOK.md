# Administrador do sistema — runbook

Desde a v0.5.0, cadastrar oficina não é mais autosserviço pela tela de
login. É ação exclusiva de quem tem um documento em `platformAdmins/{uid}`
no Firestore — e essa coleção só pode ser escrita manualmente, pelo
console do Firebase (a regra é `write: if false`, ver
`firebase/firestore.rules`). Este documento é o passo a passo pra criar
o **primeiro** administrador.

## 0. Pré-requisito: publicar a regra nova

Sem isso nada abaixo funciona — siga `CLAUDE.md` seção 6.10 (colar
`firebase/firestore.rules` no console → Firestore Database → Regras →
Publicar).

## 1. Criar (ou localizar) o usuário de autenticação

Console do Firebase → projeto `sistema-os-ef1ef` → **Authentication** →
**Users**.

⚠️ **Antes de clicar em "Add user"**, procure na lista se já existe uma
conta com o e-mail que vai virar admin (ex.: `35alcides@gmail.com`). Se
já existir, **use essa conta** — não crie uma segunda. Anote o **UID**
dela (coluna da tabela).

Se não existir: clique em **Add user**, informe e-mail e senha, e copie o
UID gerado.

## 2. Criar o documento em `platformAdmins`

Console do Firebase → **Firestore Database** → aba **Dados**.

1. Se a coleção `platformAdmins` ainda não existir, crie-a.
2. Novo documento, **ID = o UID copiado no passo 1** (não deixar
   autogerar).
3. Campos:
   - `email` (string) — o e-mail da conta
   - `name` (string, opcional) — nome de exibição
   - `createdAt` (number) — `Date.now()` de quando você fez isso, em
     milissegundos (ou qualquer timestamp; não é lido por regra nenhuma)

## 3. Entrar

Logue em `/login` com esse e-mail. O app resolve `platformAdmins/{uid}`
no primeiro carregamento e manda pra `/admin` automaticamente (ver
`lib/hooks/useClientId.tsx`).

## ⚠️ Colisão conhecida: e-mail do admin e a oficina órfã "35alcides"

O `CLAUDE.md` já documenta um `clients/{clientId}` órfão com
`name: "35alcides"`, criado pelo bootstrap automático (removido nesta
versão) quando alguém logou com `35alcides@gmail.com` antes de existir
um fluxo de administração. Isso quer dizer que **provavelmente já existe
um `users/{uid}` apontando pra essa oficina vazia** com esse e-mail.

Isso não quebra nada: o roteamento (`useClientId.tsx`) resolve os dois
papéis ao mesmo tempo — se a pessoa é `platformAdmin` **e** também tem
`users/{uid}` (mesmo que pra uma oficina órfã), ela cai na área de
oficina normalmente ao entrar, e usa o link **"⚙ Administração do
sistema"** no rodapé do menu (`DashboardShell`) pra entrar em `/admin`
quando precisar administrar. Se não tiver nenhuma oficina vinculada, cai
direto em `/admin`.

A oficina órfã aparece na lista de `/admin` como qualquer outra — nome
"35alcides", sem CNPJ. **Não foi apagada nem investigada mais a fundo**;
decidir o que fazer com ela é do Alcides, não automático (o admin
sistêmico não lê o conteúdo de dentro de nenhuma oficina — só o cadastro
raso — então não dá pra confirmar por aqui se ela tem dado real ou está
vazia).

## O que o administrador do sistema PODE e NÃO PODE fazer

Por desenho da regra (`firebase/firestore.rules`), deliberadamente
estreito ao que foi pedido — "é ele quem cadastra novas oficinas,
ninguém mais":

- **Pode**: criar oficina + gestor inicial (`/admin/nova`), listar
  oficinas com seu cadastro raso (nome, CNPJ, gestor, situação),
  suspender/reativar uma oficina.
- **Não pode**: ler ou escrever clientes, veículos, ordens de serviço,
  catálogo, notas fiscais ou a lista de funcionários de NENHUMA oficina.
  A regra não concede `read`/`write` na subárvore
  `clients/{clientId}/{document=**}` pra `platformAdmin` — só pra quem é
  `isMember()` daquela oficina especificamente.
