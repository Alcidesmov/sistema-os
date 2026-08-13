# Integração eNotas / Nota Gateway API — Referência Técnica (MecOS)

> Substitui o placeholder anterior deste arquivo. O placeholder antigo continha
> endpoints inventados (`POST /api/nfe`, `Authorization: Bearer {TOKEN}`) que
> **não correspondem a nada verificado** — não copie nada do histórico do Git
> deste arquivo sem checar contra este documento.

## ⚠️ Nome do produto mudou: eNotas → "Nota Gateway"

A API antiga (`developer.enotasgw.com.br`) está **fora do ar**
(`connect ECONNREFUSED`). O produto foi rebatizado **Nota Gateway**, mesma
empresa (eNotas), documentação nova em `docs.notagateway.com.br`. A central
de ajuda ao cliente final continua em `atendimento.enotas.com.br`. Use
**apenas** `docs.notagateway.com.br` como referência de API daqui pra frente.

## Como ler este documento — legenda de confiabilidade

Este documento combina duas pesquisas:

1. Uma varredura da Central de Ajuda da eNotas (`atendimento.enotas.com.br`),
   com artigos excelentes sobre **regras fiscais** (CST, CSOSN, IBPT,
   retenções por município, cancelamento) mas que **não é a referência de
   API**.
2. Leitura direta da **referência de API real**, em
   `docs.notagateway.com.br` — essa parte tem method/path/schema **confirmados
   por leitura direta da doc interativa**, não por inferência.

Cada afirmação técnica abaixo vem marcada:

- **✅ CONFIRMADO** — veio literalmente de um artigo da Central de Ajuda da
  eNotas que foi lido nesta pesquisa. Cito o artigo.
- **⚠️ NÃO CONFIRMADO NESTA PESQUISA** — é convenção geral conhecida de
  gateways de NF-e/NFS-e brasileiros (e, no caso específico da eNotas,
  conhecimento geral prévio sobre o produto), mas **não apareceu em nenhuma
  página lida nesta pesquisa**. Trate como ponto de partida plausível, não
  como contrato de API. **Valide no Swagger/painel antes de escrever código
  que dependa disso.**
- **❓ DESCONHECIDO** — não há informação nem por confirmação nem por
  inferência razoável. Vai para a seção 9 (GAPS).

Todos os nomes de campo, JSON e paths técnicos foram mantidos no idioma
original (inglês/português conforme a própria API usa).

---

## 0. Nosso caso de uso (contexto para todo o resto do doc)

MecOS é um sistema de gestão de oficina mecânica. Modelo de dados relevante
(retirado de `frontend-web/lib/types/index.ts` e `firebase/firestore.rules`
deste repositório):

- `clients/{clientId}` = **uma oficina** (tenant do MecOS; `clientId` é o
  `uid` do dono da oficina no Firebase Auth). Tem campo `cnpj?`. **Este é o
  "empresa" que precisa existir cadastrado na eNotas** — não confundir com
  `Customer` abaixo.
- `clients/{clientId}/...` (subcoleções, incluindo presumivelmente `orders`,
  `customers`, `vehicles`) — tudo isolado por oficina via Firestore Rules
  (`request.auth.uid == clientId`).
- `Customer` = o cliente **da oficina** (dono do carro que foi consertado).
  É o **tomador/destinatário** da nota fiscal.
- `Order` = a ordem de serviço, com:
  - `status: OrderStatus` (`draft | quoted | approved | in_progress |
    completed | invoiced`)
  - `items: OrderLineItem[]`, cada item com `type: 'service' | 'part'`
  - `invoiceRequested?: boolean` — setado pelo dono da oficina
  - `invoiceId?: string` — hoje existe mas é genérico; **vamos precisar
    expandir este modelo**, ver seção 8.

Ponto crítico de design que **não é resolvido pela API da eNotas nem pelos
artigos pesquisados**: uma `Order` pode ter `items` mistos (`part` e
`service` na mesma OS). NF-e cobre produtos, NFS-e cobre serviços — são
documentos fiscais diferentes, potencialmente com regras municipais/estaduais
diferentes. Isso é decisão de produto/fiscal, não themos técnico da eNotas.
Ver GAP correspondente na seção 9.

---

## 1. Autenticação

### ✅ CONFIRMADO (leitura direta de `docs.notagateway.com.br/reference/incluir-empresa` e `.../reference/autenticação`)

- **Base URL da API:** `https://api.notagateway.com.br`
- **Esquema:** API Key única por conta, via **HTTP Basic Auth**:
  ```
  Authorization: Basic {APIKey}
  ```
  (a doc mostra literalmente `Basic {APIKey}` — **não confirmado** se isso é
  `Basic base64(APIKEY + ":")` no formato Basic-Auth padrão RFC 7617, ou se
  a própria API Key crua já vai no header sem base64 extra. **Testar os dois
  formatos** contra um endpoint simples tipo "consultar empresa" antes de
  assumir.)
- **Headers obrigatórios em toda requisição:**
  ```
  Accept: application/json
  Content-Type: application/json
  Authorization: Basic {APIKey}
  ```
- **Obtenção da chave:** pelo **Dashboard da Nota Gateway** (não documentado
  o caminho exato do menu nesta leitura — procurar em
  Configurações/Integração ao logar).
- **Erro de auth confirmado:** APIKey ausente/inválida → **HTTP 401**, corpo
  com código de erro **`AUT002`**.
- **Uma única API Key por conta MecOS gerencia múltiplas `empresas`** — ver
  seção 3, isso resolve o gap de multi-tenant que era o mais crítico deste
  documento.

### ⚠️ Ainda não confirmado

- Se existe **rotação/expiração de chave**.
- Se sandbox/homologação usa uma API Key **separada** da de produção (ver
  seção 2).

### Recomendação operacional

- Guardar a API Key da Nota Gateway como **Firebase Secret** (Cloud
  Functions v2 `defineSecret` / Secret Manager), nunca em
  `functions.config()` (obsoleto) nem hardcoded no repo. Como confirmado
  acima, é **uma única chave para a conta MecOS inteira** — não precisa de
  um cofre de segredos por-tenant.
- Nunca logar a API Key em `functions:log` (ela vai para o Cloud Logging do
  GCP, que não é o lugar para segredo em texto puro).

---

## 2. Ambientes (sandbox vs produção)

**⚠️ NÃO CONFIRMADO NESTA PESQUISA.** Nenhuma página lida menciona URLs base,
nem a existência formal de ambiente de homologação/sandbox.

### ✅ Base URL confirmada (única, leitura direta de `docs.notagateway.com.br`)

```
https://api.notagateway.com.br
```
(**não** `api.enotasgw.com.br` — esse domínio é do produto antigo/rebranding
anterior; usar sempre `notagateway.com.br` daqui pra frente.)

### ⚠️ Sandbox/homologação — não é uma URL separada, é config por-empresa

O cadastro de empresa (seção 3.0) tem dois objetos separados dentro do
**mesmo** `POST /v1/empresas`: `configuracoesNFSeHomologacao` e
`configuracoesNFSeProducao`. Isso sugere fortemente que **não existe uma
segunda base URL de sandbox** — homologação é um **modo/config dentro da
mesma empresa/conta**, não um ambiente de infraestrutura separado.

Pontos ainda não confirmados:

- Como selecionar qual modo (homologação vs produção) usar **em cada
  chamada de emissão** — campo no body? Nenhuma das páginas lidas mostrou
  isso explicitamente para o endpoint de emissão (seção 4.0).
- Se homologação transita de verdade com SEFAZ/prefeitura de teste, ou é
  mockado.
- Se `empresa` cadastrada com config de homologação precisa de passo extra
  para "promover" pra produção, ou os dois modos coexistem sempre (o
  schema sugere que sim, já que os dois objetos de config existem lado a
  lado no mesmo cadastro).

**Recomendação:** antes de emitir a primeira nota real, testar contra
`configuracoesNFSeHomologacao` e confirmar no dashboard da Nota Gateway como
alternar entre os dois modos.

---

## 3. Setup de empresa (`empresa`) — o que precisa existir na eNotas antes de emitirmos por uma oficina

Isso define o **fluxo de onboarding que o MecOS precisa construir** para cada
oficina (cada `clients/{clientId}`) antes do botão "emitir NF" funcionar.

### 3.0 ✅ CONFIRMADO — endpoints reais de cadastro (leitura direta de `docs.notagateway.com.br`)

**Cadastrar/atualizar empresa:**
```
POST https://api.notagateway.com.br/v1/empresas
Authorization: Basic {APIKey}
Content-Type: application/json
```
- Omitir `id` no body → cria empresa nova. Informar `id` → atualiza a
  existente.
- Campos principais do body: `cnpj` (obrigatório, só números),
  `inscricaoMunicipal`, `inscricaoEstadual`, `razaoSocial`, `nomeFantasia`,
  `optanteSimplesNacional` (bool), `mei` (bool), `emiteNFSeNacional` (bool),
  `incentivadorCultural` (bool), `email`, `telefoneComercial`,
  `codigoServicoMunicipal`, `descricaoServico`, `aliquotaIss`,
  `regimeEspecialTributacao`, `regimeApuracaoTributosSN`, `cnae`,
  `codigoNBS`, `receitaBrutaAcumulada`, `anexoEnquadramentoSimplesNacional`,
  `dataInicioAtividadeSimplesNacional`, objeto `endereco` (`codigoIbgeUf`,
  `codigoIbgeCidade`, `pais`, `uf`, `cidade`, `logradouro`, `numero`,
  `complemento`, `bairro`, `cep`), e objetos `configuracoesNFSeHomologacao` /
  `configuracoesNFSeProducao` (cada um com `sequencialNFe`, `serieNFe`,
  `sequencialLoteNFe`, `usuarioAcessoProvedor`, `senhaAcessoProvedor`,
  `tokenAcessoProvedor` — sugere que **cada empresa tem config de
  homologação E produção separadas dentro do mesmo cadastro**, reforçando que
  sandbox pode não ser um ambiente 100% separado, ver seção 2).
- **Resposta de sucesso (200):** `{ "empresaId": "string" }` — **este é o
  `empresaId` a guardar em `Client.enotasEmpresaId`** e usar no path de todo
  endpoint subsequente (`/v1/empresas/{empresaId}/...`).
- Erros: `400` corpo inválido, `401`/`403` array com `codigo`+`mensagem`,
  `500` erro interno.
- **✅ RESOLVE O GAP MULTI-TENANT:** o campo `id` opcional (presente = update,
  ausente = create) confirma que **uma única conta/API Key cria e gerencia N
  empresas**, cada uma recebendo seu próprio `empresaId` distinto. Não é
  "uma API Key por empresa" — é uma API Key por conta MecOS, com N
  `empresaId` dentro dela. Isso simplifica bastante o cofre de segredos: um
  único `ENOTAS_API_KEY` no projeto inteiro, e `enotasEmpresaId` como campo
  normal (não-secreto) em cada `Client`.

**Vincular certificado digital à empresa:**
```
POST https://api.notagateway.com.br/v1/empresas/{empresaId}/certificadoDigital
Authorization: Basic {APIKey}
```
- Body: **multipart/form-data** (não JSON puro, apesar do header
  `Content-Type: application/json` genérico documentado alhures — a doc
  avisa que o "API Explorer" interativo do site não consegue executar este
  endpoint por causa do tipo de mídia; usar Postman ou código nativo).
  Campos: `arquivo` (o `.pfx`/`.p12`, certificado tipo **A1**, como binário)
  e `senha` (string, senha do certificado).
  - Confirma nossa suposição da conversa: **cada empresa (oficina) tem seu
    próprio certificado digital**, vinculado individualmente via este
    endpoint — não há certificado compartilhado do MecOS.
- Resposta de sucesso (200): `{}` vazio.
- ❓ Não documentado: expiração/renovação do certificado, nem se A3
  (token/hardware) é suportado — assumir que não, é raro em APIs de emissão
  em nuvem.

Isso resolve boa parte do fluxo de onboarding: **o MecOS pode fazer isso
tudo via API**, sem exigir que o dono da oficina crie uma conta própria na
Nota Gateway — o próprio backend do MecOS cria a `empresa` (endpoint acima)
e faz upload do certificado que o dono da oficina envia pela nossa UI.

### 3.1 Dados cadastrais da empresa (⚠️ convenção geral, não confirmada nos artigos lidos)

Como em qualquer gateway de NF-e/NFS-e brasileiro, uma `empresa` normalmente
precisa, no mínimo:

- CNPJ, Razão Social, Nome Fantasia
- Endereço completo (usado no cabeçalho da nota)
- **Inscrição Estadual** (obrigatória para NF-e — produtos) e/ou
  **Inscrição Municipal** (obrigatória para NFS-e — serviços), conforme a
  oficina emita um, outro, ou os dois tipos de documento
- **Regime tributário**: Simples Nacional vs Regime Normal (RPA) — isso
  **é confirmado como crítico** pelos artigos de CST/CSOSN (seção 4): uma
  empresa em Simples Nacional que recebe CST em vez de CSOSN é **rejeitada**
  com erro 590 (✅ confirmado, ver seção 7).
- **Certificado Digital** (A1, arquivo `.pfx`/`.p12` + senha) — a
  necessidade de configurar um certificado digital dentro da eNotas para a
  empresa emitir notas é **✅ confirmada** (mencionada de passagem no artigo
  de credenciamento SEFAZ-PR, ver 3.3), mas o **endpoint/fluxo exato de
  upload** (API vs. só manual no painel) **não está confirmado**. Certificado
  A3 (token/hardware) tipicamente não é suportado por APIs de emissão em
  nuvem — **não confirmado para eNotas especificamente**.

### 3.2 Regime tributário determina o campo a preencher na nota (✅ confirmado)

Fonte: *"CST ICMS e CSOSN: O que é e como informar corretamente nas emissões
na SEFAZ"* e *"Equivalência entre CST ICMS e CSOSN"*.

- Empresa em **Regime Normal de Tributação** (CRT = 3) → usa **CST**
  (Código de Situação Tributária).
- Empresa em **Simples Nacional** (CRT = 1) → usa **CSOSN** (Código de
  Situação da Operação no Simples Nacional).
- Enviar o código errado para o regime da empresa gera rejeição (erro 590,
  seção 7).
- **Implicação de onboarding:** o cadastro da oficina no MecOS precisa
  capturar o regime tributário dela (Simples Nacional vs Regime
  Normal/RPA) **antes** da primeira emissão, porque isso muda qual campo o
  nosso backend deve montar (`situacaoTributaria` recebe CST ou CSOSN
  dependendo disso — ver seção 4). Hoje o tipo `Client` no MecOS **não tem**
  esse campo — precisa ser adicionado (ver seção 8).
- A tabela de equivalência CST↔CSOSN completa está na seção 4.4, útil se a
  oficina trocar de regime tributário e precisarmos re-mapear.

### 3.3 Credenciamento estadual/municipal fora da API (✅ confirmado para PR, padrão provável em outros estados/municípios)

Fonte: *"Como realizar o credenciamento e liberação de emissores na SEFAZ
PR (NF-e)"*.

Para oficinas **no Paraná** emitindo **NF-e**, existe um passo **manual,
fora da API eNotas**, obrigatório antes da primeira emissão:

1. O responsável (sócio ou contador da oficina) faz login em
   `https://receita.pr.gov.br/login` com CPF/senha (não é credencial eNotas).
2. Menu **UPD > Autorização de Uso > Cadastro de Autorização de Uso**.
3. Informa o CNPJ da **eNotas** (não da oficina) como software emissor:
   **`14.422.279/0001-06`** (ENOTAS DESENVOLVIMENTO DE SOFTWARES LTDA).
4. Seleciona o sistema "eNotas" e informa a Inscrição Estadual (CAD/ICMS) da
   oficina.
5. Seleciona o documento fiscal "NF-e" e confirma.
6. **Passo que não pode ser pulado:** depois disso, é preciso abrir um
   ticket de suporte em
   `https://atendimento.enotas.com.br/hc/pt-br/requests/new` com o título
   exato **"Liberação de empresa - SEFAZ PARANÁ"**, informando o CNPJ da
   oficina no corpo. A eNotas precisa "aceitar"/vincular manualmente do lado
   dela. **Sem isso, a emissão de NF-e falha com rejeição 203** (`Emissor
   não habilitado para emissão da NF-e`) mesmo que o passo 1-5 tenha sido
   concluído.
7. Login no portal da Receita/PR **não exige certificado digital** — só
   CPF+senha. Mas o **certificado digital continua sendo necessário dentro
   da eNotas** para emitir de fato (requisito geral, não específico do PR).

**Implicação de produto:** isso é **estado-específico**. Não há confirmação
sobre quais outros estados (para NF-e) ou quais municípios (para NFS-e) têm
um passo manual equivalente — provavelmente vários têm, dado como o sistema
tributário brasileiro é fragmentado por SEFAZ estadual e prefeitura
municipal. **Nosso fluxo de onboarding de oficina precisa, no mínimo,
perguntar UF (e para NFS-e, o município) e checar com o suporte eNotas se há
um passo de credenciamento manual equivalente para aquela UF/município antes
de prometer emissão automática ao dono da oficina.** Ver GAP na seção 9.

### 3.4 Checklist de onboarding por oficina (derivado do que está confirmado + convenção geral)

Para cada `clients/{clientId}` antes de habilitar o botão de emissão:

- [ ] CNPJ, Razão Social, endereço completo cadastrados na eNotas como
      `empresa` (⚠️ endpoint exato não confirmado)
- [ ] Regime tributário informado (Simples Nacional vs Regime Normal) — ✅
      necessário, campo hoje ausente no `Client` do MecOS
- [ ] Inscrição Estadual cadastrada, se for emitir NF-e (peças)
- [ ] Inscrição Municipal cadastrada, se for emitir NFS-e (serviços)
- [ ] Certificado Digital A1 configurado na eNotas para a empresa
- [ ] Se UF = PR e for emitir NF-e: credenciamento manual SEFAZ-PR + ticket
      de liberação (seção 3.3) — ✅ confirmado como obrigatório
- [ ] Se for emitir NF-e: verificar se a UF da oficina tem passo de
      credenciamento manual equivalente ao do PR (❓ desconhecido para outras
      UFs — perguntar ao suporte eNotas)
- [ ] Se for emitir NFS-e: verificar particularidades do município (ex.:
      Brasília/DF tem regra própria de retenção de impostos, seção 4.5) —
      cada município tem "manual de integração" próprio segundo os artigos
      lidos

---

## 4. Emissão de nota — endpoint(s) e corpo da requisição

### 4.0 ✅ CONFIRMADO — endpoint de disparo e fluxo assíncrono completo

Fonte: leitura direta de `docs.notagateway.com.br/docs/fluxo-geral`.

```
POST https://api.notagateway.com.br/v1/empresas/{empresaId}/nfes
Authorization: Basic {APIKey}
```

**Fluxo completo (confirmado, é assíncrono — resolve o gap 6 antigo):**

1. MecOS envia `POST .../nfes` para cada nota, incluindo um campo
   **`idExterno`** — usado para linkar a nota à nossa `Order`. **A Nota
   Gateway rejeita duas notas com o mesmo `idExterno`** (dedupe nativo —
   podemos usar `order.id` diretamente como `idExterno`, é idempotência de
   graça, resolve o gap 13 antigo).
2. A nota entra numa **fila interna** da Nota Gateway (transmissão
   controlada/sequencial para a prefeitura/SEFAZ).
3. A resposta síncrona do POST retorna um **identificador interno da nota**
   (`nfeId` — nome exato do campo de resposta não confirmado, mas a doc
   chama o conceito de "nfeId"). **Guardar isso imediatamente.**
4. A Nota Gateway transmite para o órgão competente (prefeitura/SEFAZ) com
   estratégia própria de escolha de canal.
5. Monitoramento periódico do status na prefeitura/SEFAZ, com **retry
   automático de até 48h** em casos de instabilidade do órgão.
6. Resultado final é consolidado e o status da nota é finalizado na
   plataforma.
7. **Webhook** é disparado para nosso endpoint quando o status muda —
   "near-real-time". **Confirma que webhook existe de fato** (não é mais
   suposição — mas o payload exato e o endpoint de registro continuam não
   confirmados, ver seção 6).

**Implicação direta pro nosso `emitInvoicesBatch` (seção 8.2):** o desenho
como assíncrono que já estava no pseudocódigo estava certo — a chamada POST
só confirma "aceito na fila", **não** o resultado fiscal. Usar `order.id`
como `idExterno` para idempotência nativa em vez de inventar um esquema
próprio de dedupe.

### 4.1 Fragmentos de campos confirmados via artigos de regras fiscais

- Existe um campo de nível superior **`observacoes`** (string) usado para o
  texto de transparência fiscal (Lei 12.741/2012) — ✅ confirmado, ver 4.6.
- Existe um objeto **`servico`** (usado em emissão de NFS-e) com, no mínimo,
  os campos: `descricao`, `issRetidoFonte` (boolean),
  `codigoServicoMunicipio`, `itemListaServicoLC116`, `cnae`,
  `descricaoServicoMunicipio` — ✅ confirmado, ver 4.5.
- Existe (em algum nível — não confirmado se dentro de `servico` ou irmão
  dele) um objeto **`impostos.icms`** (usado em emissão de NF-e) com os
  campos `situacaoTributaria` (string — CST de 2 dígitos ou CSOSN de 3
  dígitos) e `origem` (integer — código da Tabela A) — ✅ confirmado, ver 4.4.
- Existem, no nível do serviço (irmãos de `servico`, aparentemente),
  campos de retenção: `aliquotaCofins`, `aliquotaCsll`, `aliquotaInss`,
  `aliquotaIr`, `aliquotaPis`, `valorCofins`, `valorCsll`, `valorInss`,
  `valorIr`, `valorPis` — ✅ confirmado, ver 4.5.

### 4.2 ⚠️ Estrutura de referência não confirmada — validar no Swagger antes de codar

Juntando os fragmentos confirmados acima com a convenção geral de gateways
de NF-e/NFS-e brasileiros, o corpo de emissão **provavelmente** tem um
formato próximo a isto — **trate como esqueleto para orientar o
desenvolvimento, não como contrato**:

```jsonc
// POST /empresas/{empresaId}/notas   <-- path e método NÃO confirmados
{
  "idExterno": "mecos-order-<orderId>",      // ⚠️ não confirmado — nome real do campo de idempotência/referência externa é desconhecido
  "cliente": {                                // ⚠️ estrutura não confirmada
    "nome": "...",
    "cpfCnpj": "...",
    "email": "...",
    "endereco": { "...": "..." }
  },
  "observacoes": "Valor aproximado de tributos incidentes nessa nota fiscal: R$ 558,72 (Federal: R$ 430,40; Estadual: R$ 0,00 e Municipal: R$ 128,32) - Fonte: IBPT. Conforme Lei 12.741/2012 (Lei da Transparência Fiscal).", // ✅ confirmado: formato do texto (fonte: artigo IBPT)

  // --- Caminho NFS-e (serviços) ---
  "servico": {                                // ✅ confirmado: nome do objeto e destes campos internos
    "descricao": "Troca de óleo e filtro",
    "issRetidoFonte": false,                  // ✅ confirmado (boolean)
    "codigoServicoMunicipio": "412",          // ✅ confirmado (exemplo do artigo Brasília/DF)
    "itemListaServicoLC116": "04.12",         // ✅ confirmado
    "cnae": "8630504",                        // ✅ confirmado
    "descricaoServicoMunicipio": "Consulta Odontologica" // ✅ confirmado (nome do campo — valor do exemplo do artigo é de outro segmento, adaptar)
  },
  // campos de retenção automática — usar null quando o município retém automaticamente (caso confirmado: Brasília/DF)
  "aliquotaCofins": null, "aliquotaCsll": null, "aliquotaInss": null,
  "aliquotaIr": null, "aliquotaPis": null,
  "valorCofins": null, "valorCsll": null, "valorInss": null,
  "valorIr": null, "valorPis": null,          // ✅ confirmado (nomes dos 10 campos, fonte: artigo Brasília/DF)

  // --- Caminho NF-e (produtos/peças) ---
  "itens": [                                  // ⚠️ nome do array/estrutura de item não confirmado
    {
      "descricao": "Filtro de óleo",
      "quantidade": 1,
      "valorUnitario": 45.00,
      "impostos": {
        "icms": {
          "situacaoTributaria": "102", // ✅ confirmado: CSOSN (3 díg.) se Simples Nacional, ou CST (2 díg.) se Regime Normal — Tabela B
          "origem": 0                 // ✅ confirmado: inteiro da Tabela A (origem da mercadoria)
        }
      }
    }
  ]
}
```

**Não implemente contra este esqueleto sem antes confirmar no Swagger real
da eNotas**: nomes como `cliente`, `itens`, `idExterno`, o path do endpoint,
e se NF-e/NFS-e são o **mesmo endpoint** (discriminado pela presença de
`servico` vs `itens`) ou **endpoints separados** (`/nfes` vs `/nfses`) — nada
disso apareceu nos artigos pesquisados.

### 4.3 Regra prática: CST vs CSOSN — qual usar

Fonte: *"CST ICMS e CSOSN..."* + *"Equivalência entre CST ICMS e CSOSN"*.

- Verificar `regimeTributario` da `empresa` (oficina) cadastrada:
  - **Simples Nacional (CRT=1)** → `situacaoTributaria` recebe um **CSOSN de
    3 dígitos** (ex.: `"101"`, `"102"`, `"103"`, `"201"`, `"202"`, `"203"`,
    `"300"`, `"400"`, `"500"`, `"900"`).
  - **Regime Normal/RPA (CRT=3)** → `situacaoTributaria` recebe um **CST**
    (Tabela B, 2 dígitos — ex.: `"00"`, `"20"`, `"40"`, `"41"`, `"60"`).
- Enviar CST para empresa em Simples Nacional → **rejeição 590** (seção 7).
- O primeiro dígito do CST "completo" de 3 dígitos mostrado no DANFE é na
  verdade a **origem** (Tabela A) concatenada com o CST de 2 dígitos da
  Tabela B — mas no JSON de emissão, **origem é um campo `origem` separado**,
  não parte da string `situacaoTributaria` (quando o regime é Regime
  Normal). Exemplo do artigo: CST "000" no DANFE = origem `0` (nacional) +
  tributação `00` (integral).
- **Gotcha adicional (cliente não-contribuinte de ICMS):** fonte *"O que
  fazer quando o seu cliente não é contribuinte de ICMS"** — se o
  `Customer` (tomador) não é contribuinte de ICMS, o CST usado precisa ser
  um dos seguintes, senão a nota é rejeitada com erro 508:
  `00` (Tributada integralmente), `20` (Com redução da Base de Cálculo),
  `40` (Isenta), `41` (Não tributada), `60` (ICMS cobrado anteriormente por
  Substituição Tributária). **Implicação:** o cadastro de `Customer` no
  MecOS provavelmente precisa de um flag "é contribuinte de ICMS?" (hoje não
  existe no tipo `Customer`) para o backend escolher o CST certo — mas isso
  só é relevante para NF-e (peças), não para NFS-e.

### 4.4 Tabelas de referência para `impostos.icms` (✅ confirmado, transcrito de imagens do artigo)

**Tabela A — Origem da Mercadoria** (campo `origem`, inteiro):

| Dígito | Origem |
|---|---|
| 0 | Nacional, exceto as indicadas nos códigos 3, 4, 5 e 8 |
| 1 | Estrangeira: importação direta, exceto a indicada no código 6 |
| 2 | Estrangeira: adquirida no mercado interno, exceto a indicada no código 7 |
| 3 | Nacional: mercadoria/bem com conteúdo de importação > 40% e ≤ 70% |
| 4 | Nacional: produção em conformidade com processos produtivos básicos (Decreto-Lei 288/1967, Leis 8.248/1991, 8.387/1991, 10.176/2001...) — *texto cortado na imagem-fonte do artigo, resto ilegível* |
| 5 | Nacional: mercadoria/bem com Conteúdo de Importação ≤ 40% |
| 6 | Estrangeira: importação direta, sem similar nacional (lista Camex) e gás natural |
| 7 | Estrangeira: adquirida no mercado interno, sem similar nacional (lista Camex) e gás natural |
| 8 | Nacional: mercadoria/bem com Conteúdo de Importação > 70% |

**Tabela B — Regime de Tributação / CST** (campo `situacaoTributaria` quando
Regime Normal, 2 dígitos):

| Código | Regime de Tributação |
|---|---|
| 00 | Tributada integralmente |
| 10 | Tributada e com cobrança do ICMS por substituição tributária |
| 20 | Com redução de base de cálculo |
| 30 | Isenta ou não tributada e com cobrança do ICMS por substituição tributária |
| 40 | Isenta |
| 41 | Não tributada |
| 50 | Suspensão |
| 51 | Diferimento |
| 60 | ICMS cobrado anteriormente por substituição tributária |
| 70 | Com redução de base de cálculo e cobrança do ICMS por substituição tributária |
| 90 | Outras |

**Tabela CSOSN** (campo `situacaoTributaria` quando Simples Nacional, 3
dígitos):

| Código | Descrição |
|---|---|
| 101 | Tributada pelo Simples Nacional com permissão de crédito |
| 102 | Tributada pelo Simples Nacional sem permissão de crédito |
| 103 | Isenção do ICMS no Simples Nacional para faixa de receita bruta |
| 201 | Tributada com permissão de crédito + cobrança ICMS por substituição tributária |
| 202 | Tributada sem permissão de crédito + cobrança ICMS por substituição tributária |
| 203 | Isenção por faixa de receita bruta + cobrança ICMS por substituição tributária |
| 300 | Imune |
| 400 | Não tributada pelo Simples Nacional |
| 500 | ICMS cobrado anteriormente por substituição tributária (substituído) ou por antecipação |
| 900 | Outros |

**Tabela de equivalência CST ↔ CSOSN** (útil se a oficina mudar de regime
tributário):

| CSOSN | CST equivalente(s) |
|---|---|
| 101 | 00, 20, 90 |
| 102 | 00, 20, 90 |
| 103 | 40, 90 |
| 201 | 10, 30, 70, 90 |
| 202 | 10, 30, 70, 90 |
| 203 | 10, 30, 70, 90 |
| 300 | 40, 41 |
| 400 | 40, 50 |
| 500 | 60 |
| 900 | 00, 20, 51, 90 |

> ⚠️ O próprio artigo-fonte avisa: a escolha exata "precisa ser analisada
> caso a caso" e recomenda validação com contabilidade — produtos isentos no
> Simples podem ser tributados normalmente no RPA, exceto os sob
> substituição tributária. **Não hardcode uma tabela fixa de "produto →
> CST/CSOSN" sem revisão contábil.**

### 4.5 Regras de retenção de NFS-e — exemplo Brasília/DF (✅ confirmado, mas município-específico)

Fonte: *"Como realizar a retenção de impostos em uma NFS-e em Brasília/DF"*.

- Para reter **ISS** na fonte: enviar `"issRetidoFonte": true` dentro de
  `servico`, e informar também a alíquota no JSON (o artigo não mostra o
  nome exato do campo de alíquota do ISS no exemplo).
- Para **CSLL, PIS, COFINS, IR e INSS**: em Brasília/DF a prefeitura retém
  automaticamente — os campos correspondentes devem ser enviados como
  **`null`** (não omitidos, não zero): `aliquotaCofins`, `aliquotaCsll`,
  `aliquotaInss`, `aliquotaIr`, `aliquotaPis`, `valorCofins`, `valorCsll`,
  `valorInss`, `valorIr`, `valorPis`.
- **Isso é comportamento específico de Brasília/DF.** O mesmo artigo cita
  que outros municípios (ex.: Caxias do Sul/RS, em outro artigo não
  pesquisado aqui) têm regras diferentes ("deduções" em vez de retenção
  automática). **Não generalizar esta regra para todos os municípios** — cada
  prefeitura tem seu próprio "manual de integração".
- **Implicação de produto:** se o MecOS atender oficinas em múltiplos
  municípios, o backend de emissão de NFS-e precisa de lógica
  **por-município** para decidir quais campos de retenção populam com valor
  real vs `null`. Isso não escala bem como `if/else` hardcoded — considerar
  guardar uma tabela de configuração por município (mesmo que comece só com
  Brasília/DF e cresça sob demanda).

### 4.6 Campo `observacoes` — Lei da Transparência Fiscal / IBPT (✅ confirmado)

Fonte: *"Valor aproximado dos tributos IBPT - De olho no imposto"*.

- A Lei 12.741/2012 exige que a nota informe o valor aproximado dos tributos
  federais/estaduais/municipais embutidos no preço.
- eNotas resolve isso via o campo texto livre `observacoes`. Exemplo literal
  do artigo:
  ```
  "observacoes": "Valor aproximado de tributos incidentes nessa nota fiscal: R$ 558,72 (Federal: R$ 430,40; Estadual: R$ 0,00 e Municipal: R$ 128,32) - Fonte: IBPT. Conforme Lei 12.741/2012 (Lei da Transparência Fiscal)."
  ```
- As alíquotas IBPT por município **mudam com frequência** — o artigo
  recomenda não fixar valores hardcoded.
- Opção sugerida pelo artigo (fora da eNotas): serviço terceiro **"De Olho
  no Imposto"**, com API própria para consultar alíquotas por produto/serviço
  e por município. Cadastro nesse portal é por CNPJ e gera um token
  separado (não é a API key da eNotas). **Não avaliamos se vale a pena
  integrar isso desde o MVP** — para o MVP do MecOS, pode ser aceitável usar
  uma estimativa fixa/conservadora em `observacoes` e revisar depois, mas
  isso é decisão de produto, não bloqueio técnico.

---

## 5. Consulta de status e download de XML/PDF/DANFE

### 5.1 ⚠️ Não confirmado: endpoint de consulta

Nenhum artigo lido documenta `GET /empresas/{empresaId}/notas/{id}` (ou
equivalente) nem o formato do response. Convenção geral esperada: um GET
por id de nota retornando status atual (`Pendente`/`Processando`/
`Emitida`/`Negada`/`Cancelada` ou similar) e provavelmente links de
download prontos (`linkDownloadPDF`, `linkDownloadXML`, etc. — nomes
inventados como exemplo, **não confirmados**).

### 5.2 O que está confirmado sobre os documentos gerados

- **DANFE**: eNotas emite **apenas a versão completa do DANFE**. **Não emite
  DANFE Simplificado/Etiqueta.** Não construir nenhuma feature esperando
  optar por DANFE em formato etiqueta — a opção não existe na eNotas. (Fonte:
  *"DANFE simplificado: o que é?"*)
- **Carta de Correção (CC-e)**: não é algo que se "baixa" via API/eNotas de
  forma direta segundo o artigo pesquisado — o artigo instrui o **cliente
  final** a consultar manualmente no site da SEFAZ do estado
  ("Consultar NF-e Completa" → inserir chave de acesso → rolar até "Dados da
  NF-e" → "Carta de correção"). Uma CC-e **não altera** valores/dados
  cadastrais da nota, então nem sempre é necessário nem baixá-la — mas se o
  MecOS quiser oferecer isso na UI, **não há confirmação de um endpoint
  eNotas para isso**; teria que ser via link direto para o portal da SEFAZ,
  usando a chave de acesso da nota. (Fonte: *"Como imprimir uma carta de
  correção"*)
- **Cancelamento de NFS-e**: **✅ ponto crítico** — a integração da eNotas
  **não gera XML de cancelamento para notas de serviço (NFS-e)**. Apenas o
  **PDF** da nota é atualizado com a informação de cancelamento. Se o MecOS
  quiser mostrar/guardar o XML de cancelamento de uma NFS-e, **não vai
  vir da eNotas** — teria que ser exportado manualmente do portal da
  prefeitura específica. (Fonte: *"Como identificar o motivo do cancelamento
  de um NFS-e"*) Isso não foi dito para NF-e (produtos) — não assumir que o
  mesmo vale para NF-e sem confirmar.
- **Motivo do cancelamento de NFS-e**: o texto de motivo enviado à
  prefeitura é **padronizado pela prefeitura**, não customizável via API —
  cada município define no próprio manual de integração o texto padrão.
  Aparece na tag `MOTIVOCANCEL` do XML da prefeitura (não do eNotas). Não
  esperar poder mandar um motivo de cancelamento livre e ele aparecer
  fielmente refletido para o usuário final.

### 5.3 Recomendação de implementação dado o que sabemos

- Guardar **o id da nota retornado pela eNotas** (nome do campo desconhecido,
  ver seção 8) no documento da `Order` assim que a emissão for aceita, e
  tratar o **webhook** (seção 6) como fonte de verdade para status final —
  não montar polling agressivo em `GET .../notas/{id}` sem confirmar
  primeiro se esse endpoint existe e qual o rate limit (❓ desconhecido).
- Para NF-e, planejar guardar 3 links possíveis: XML, PDF (DANFE completo),
  e possivelmente um link de "consulta pela chave de acesso" no site da
  SEFAZ (útil para o cliente final buscar CC-e, já que isso não vem
  encapsulado pela eNotas).
- Para NFS-e, **não assumir que sempre haverá um XML de cancelamento
  disponível** — o campo de XML pode ficar vazio/nulo após cancelamento,
  mesmo que tenha existido para a emissão original. Cobrir esse caso na UI
  ("XML de cancelamento não disponível — nota cancelada, ver PDF").

---

## 6. Webhook — registro e payload

### 6.1 ⚠️ Registro do webhook — não confirmado

Nenhum artigo lido documenta um endpoint de API para registrar URL de
webhook (ex.: `POST /empresas/{empresaId}/webhooks`). É comum em produtos
eNotas esse tipo de configuração ser feita **pelo painel/dashboard** em vez
de via API — mas isso **não está confirmado** nesta pesquisa. **Ação
concreta antes de codar:** procurar no painel eNotas (seção
Configurações/Integrações) uma tela de "Webhook" ou "Notificações"; se não
existir lá, procurar no Swagger por um recurso `webhooks`.

### 6.2 ⚠️ Eventos e payload — não confirmados

Nenhuma página documenta os nomes exatos de eventos nem o schema do corpo
enviado ao nosso endpoint. O placeholder antigo deste arquivo citava
`nfe.emitted` / `nfe.rejected` como se fossem confirmados — **não são**,
foram inventados. Convenção plausível a validar: eventos separados para
emissão bem-sucedida, rejeição, e cancelamento (nosso caso de uso pede os
três: emitted, rejected, cancelled).

O que dá para inferir com razoável confiança, cruzando os artigos fiscais:

- Um evento de **NFS-e cancelada** provavelmente **não incluirá um link de
  XML de cancelamento** no payload (porque a eNotas não gera esse XML para
  NFS-e — seção 5.2) — o handler do webhook não deve dar erro/assumir campo
  obrigatório se `xmlCancelamento` (nome hipotético) vier ausente/nulo
  especificamente para eventos de NFS-e.
- Um evento de **rejeição** provavelmente carrega um código de rejeição
  heterogêneo (numérico tipo SEFAZ — `508`, `203` — ou alfanumérico tipo
  prefeitura — `GW116`, `E330`, `E093`/`E090`) — ver seção 7. **Guardar o
  código E a mensagem crus**, não tentar mapear para um enum fechado desde
  já.

### 6.3 Recomendações de implementação do endpoint de webhook (boas práticas gerais, independente de confirmação)

- **Verificar autenticidade do webhook antes de confiar no payload.**
  ❓ Desconhecido se a eNotas assina o webhook (header HMAC, secret
  compartilhado) ou usa outro mecanismo (IP allowlist, token na query
  string). **Não implementar o handler assumindo que qualquer POST recebido
  é legítimo** até confirmar isso — trate como TODO de segurança
  bloqueante antes de ir para produção.
- **Idempotência**: gateways de webhook tipicamente reenviam em caso de
  timeout/erro do nosso lado. ❓ Desconhecido se a eNotas envia um id de
  evento único (`eventId`) reutilizável para deduplicar. Na ausência de
  confirmação, usar como chave de dedupe a combinação
  `(idNotaENotas, status, timestamp)` armazenada junto ao pedido, e tornar o
  handler idempotente por design (um `set` com merge no Firestore, não um
  `increment`/append cego).
- **Responder rápido com 200** e processar de forma assíncrona se
  necessário — padrão geral para não disparar retries desnecessários de
  qualquer gateway de webhook.
- **Guardar o payload bruto** recebido (ex.: em um campo `rawWebhookPayload`
  ou em uma subcoleção de log) antes de qualquer transformação — dado que o
  schema exato não está confirmado, isso é essencial para debug nas
  primeiras semanas de integração e para não perder dado se descobrirmos
  depois que interpretamos um campo errado.

---

## 7. Tratamento de erros e códigos comuns

### 7.1 Códigos confirmados nesta pesquisa

| Código | Documento | Situação | Mensagem/causa | Ação recomendada |
|---|---|---|---|---|
| **508** | NF-e | Cliente não é contribuinte de ICMS mas o CST usado é incompatível | `"508 - CST incompatível na operação com Não Contribuinte [nItem:1]."` | Usar apenas CST `00`, `20`, `40`, `41` ou `60` quando `Customer` não é contribuinte de ICMS (seção 4.3); corrigir e retransmitir a nota |
| **590** | NF-e | Empresa em Simples Nacional recebeu CST em vez de CSOSN | `"Rejeição: Informado CST para emissor do Simples Nacional"` | Verificar `regimeTributario` da empresa antes de montar `situacaoTributaria` (seção 4.3) |
| **203** | NF-e | Emissor (oficina) não habilitado — específico de SEFAZ-PR sem credenciamento | `"Rejeição 203: Emissor não habilitado para emissão da NF-e"` | Completar credenciamento manual SEFAZ-PR + ticket de liberação (seção 3.3) antes da 1ª emissão para oficinas no PR |
| **GW116** | NFS-e (cancelamento) | Mencionado apenas como título de artigo relacionado, não aberto nesta pesquisa: *"Rejeição ao cancelar NFS-e: Código: GW116 Descrição: Prefeitura não suporta cancelamento de forma automática"* | — | ❓ Buscar esse artigo antes de implementar cancelamento de NFS-e — algumas prefeituras aparentemente **não suportam cancelamento automático** via API, o que muda o fluxo (precisaria de cancelamento manual/processo alternativo) |
| E330 | NFS-e | Mencionado só como título: *"Rejeição na emissão de NFS-e em Franca/SP: Código E330..."* | — | ❓ Não pesquisado — específico do município Franca/SP |
| E093 / E090 | NFS-e | Mencionado só como título: *"Rejeição na emissão de NFS-e em Brasília/DF: Código E093/E090 (RPS série/número inválido)"* | — | ❓ Não pesquisado — sugere que RPS (série/número) precisa ser gerenciado corretamente pelo nosso lado para Brasília/DF |

### 7.2 Padrão arquitetural para lidar com erros (inferido dos exemplos acima)

Os códigos de erro **não são um espaço uniforme controlado pela eNotas** —
são majoritariamente códigos de rejeição da **SEFAZ estadual** (numéricos,
ex. `508`, `203`, `590`) ou da **prefeitura municipal** (alfanuméricos,
prefixo variável, ex. `GW116`, `E330`, `E093`), repassados pela eNotas. Isso
implica:

- **Não construir um enum fechado de "todos os erros possíveis"** — o
  espaço é aberto (por UF × por município). Novos municípios atendidos =
  potencialmente novos códigos nunca vistos.
- **Sempre persistir código + mensagem crus** retornados (seja via resposta
  síncrona da emissão, seja via webhook de rejeição) em um campo tipo
  `Order.invoiceError: { code: string, message: string, raw: unknown }`, e
  **mostrar isso na UI para o dono da oficina** de forma legível, já que
  boa parte desses erros exige ação humana (corrigir CST, completar
  credenciamento, ajustar cadastro do cliente) — não são recuperáveis com
  retry automático.
- Separar erros em duas categorias operacionais:
  1. **Erros de configuração/cadastro** (590, 203, e provavelmente GW116) —
     resolvidos ajustando cadastro da empresa/cliente ou completando um
     passo de credenciamento; **retry automático não resolve**.
  2. **Erros de dados da nota** (508, provavelmente E330/E093/E090) —
     resolvidos ajustando os dados daquela OS específica (CST do item,
     numeração de RPS); retry automático **também não resolve** sem
     correção prévia dos dados enviados.
  - Ou seja: **nenhum dos erros confirmados é do tipo "transiente, retry
    ajuda"**. Isso sugere que o batch de emissão não deve re-tentar
    automaticamente pedidos que já falharam sem intervenção — deve marcar
    como `invoiceStatus: 'error'` e esperar correção manual + reenvio
    explícito.

---

## 8. Plano de implementação — Firebase Function de emissão em lote (MecOS)

### 8.1 Mudanças de schema necessárias antes de codar

**`Client`** (`frontend-web/lib/types/index.ts`) — adicionar:
```ts
interface Client {
  // ...existing fields
  enotasEmpresaId?: string        // id da empresa cadastrada na eNotas (⚠️ nome do campo/endpoint de cadastro não confirmado, seção 3)
  regimeTributario?: 'simples_nacional' | 'regime_normal'  // ✅ necessário, seção 3.2/4.3
  inscricaoEstadual?: string      // necessário para NF-e
  inscricaoMunicipal?: string     // necessário para NFS-e
}
```

**`Customer`** — adicionar (necessário só para itens tipo `part`/NF-e, seção 4.3):
```ts
interface Customer {
  // ...existing fields
  contribuinteIcms?: boolean      // define quais CST são válidos (erro 508 se errado)
}
```

**`Order`** — expandir o hoje-genérico `invoiceId?: string`:
```ts
interface Order {
  // ...existing fields
  invoiceStatus?: 'pending' | 'processing' | 'emitted' | 'rejected' | 'cancelled' | 'error'
  invoiceType?: 'nfe' | 'nfse' | 'both'   // decisão de produto pendente, ver GAP 9.9
  nfeId?: string          // id da nota de produtos na eNotas, se houver
  nfseId?: string         // id da nota de serviço na eNotas, se houver
  nfeXmlUrl?: string
  nfePdfUrl?: string       // DANFE completo (nunca simplificado — seção 5.2)
  nfseXmlUrl?: string      // pode ficar ausente após cancelamento (seção 5.2)
  nfsePdfUrl?: string
  invoiceError?: { code: string; message: string; raw?: unknown }
  invoiceRequestedAt?: number
  invoiceEmittedAt?: number
}
```

### 8.2 Function 1 — emissão em lote (`emitInvoicesBatch`)

Local sugerido: `firebase/src/index.ts` (ou um módulo novo
`firebase/src/enotas.ts` importado de lá — hoje `index.ts` só tem o
placeholder `helloWorld`).

Trigger: `functions.https.onCall` (chamado pelo botão "emitir em lote" do
frontend) **e/ou** `functions.pubsub.schedule(...)` para rodar
periodicamente — o pedido original menciona os dois modos ("Periodicamente
ou via botão"), então implementar como uma função interna reutilizável
chamada por ambos os triggers.

Pseudocódigo:

```
function emitInvoicesBatch(clientId?: string):
    # se clientId for passado (chamada via botão de um dono de oficina
    # específico), restringe a essa oficina; se não, roda para todas
    # (chamada agendada)
    clientsToProcess = clientId ? [clientId] : getAllActiveClients()

    for client in clientsToProcess:
        # 1. Pré-condição: oficina precisa ter empresa eNotas configurada
        if not client.enotasEmpresaId:
            log.warn(f"Client {client.id} sem enotasEmpresaId, pulando")
            continue

        orders = query(
            `clients/${client.id}/orders`,
            where status == 'completed'
            and invoiceRequested == true
            and invoiceStatus not in ['emitted', 'processing']  # evita reprocessar
        )

        for order in orders:
            try:
                emitInvoiceForOrder(client, order)
            catch e:
                # não deixar 1 pedido com erro travar o lote inteiro
                updateOrder(order.id, {
                    invoiceStatus: 'error',
                    invoiceError: { code: e.code ?? 'unknown', message: e.message, raw: e.raw }
                })
                log.error(...)
                continue


function emitInvoiceForOrder(client, order):
    parts    = order.items.filter(i => i.type == 'part')
    services = order.items.filter(i => i.type == 'service')

    # DECISÃO DE PRODUTO PENDENTE (ver GAP 9.9): emitir NF-e e/ou NFS-e
    # separadamente conforme houver items de cada tipo. Pseudocódigo assume
    # "pode ser os dois", ajustar quando a decisão de negócio estiver clara.

    updateOrder(order.id, { invoiceStatus: 'processing', invoiceRequestedAt: now() })

    if services.length > 0:
        nfseResponse = enotasClient.emitirNFSe({
            empresaId: client.enotasEmpresaId,
            cliente: mapCustomerToDestinatario(order.customer, order.contribuinteIcms),
            servico: buildServicoPayload(services, client.municipio),  # seção 4.5 — lógica por-município
            observacoes: buildIbptObservacao(services),                 # seção 4.6
            idExterno: `mecos-${order.id}-servico`,  # ⚠️ nome do campo não confirmado — usar mesmo assim para rastreabilidade nossa, se aceito
        })
        updateOrder(order.id, { nfseId: nfseResponse.id })   # nome do campo id não confirmado, adaptar ao schema real

    if parts.length > 0:
        nfeResponse = enotasClient.emitirNFe({
            empresaId: client.enotasEmpresaId,
            cliente: mapCustomerToDestinatario(order.customer, order.contribuinteIcms),
            itens: parts.map(p => buildItemComICMS(p, client.regimeTributario)),  # seção 4.3/4.4
            observacoes: buildIbptObservacao(parts),
            idExterno: `mecos-${order.id}-produto`,
        })
        updateOrder(order.id, { nfeId: nfeResponse.id })

    # status final (emitted/rejected) chega via webhook (seção 6), não aqui —
    # a chamada de emissão provavelmente só confirma "aceito para
    # processamento", não o resultado fiscal final (⚠️ não confirmado se a
    # emissão é síncrona ou assíncrona — tratar como assíncrona por segurança)


function buildItemComICMS(part, regimeTributario):
    situacaoTributaria = regimeTributario == 'simples_nacional'
        ? lookupCsosnParaProduto(part)   # requer cadastro de CSOSN por ServiceItem — hoje não existe, ver GAP
        : lookupCstParaProduto(part)
    return {
        descricao: part.description,
        quantidade: part.quantity,
        valorUnitario: part.unitPrice,
        impostos: { icms: { situacaoTributaria, origem: part.origemMercadoria ?? 0 } }
    }
```

**Observação de schema adicional implícita no pseudocódigo acima:**
`ServiceItem` (peças) provavelmente precisa ganhar um campo tipo
`csosn`/`cst` e `origemMercadoria` próprios (não existe hoje), porque a
alíquota/situação tributária é por-produto, não por-oficina — o regime
tributário só decide **qual tabela** (CST vs CSOSN) usar, não o código em
si.

### 8.3 Function 2 — webhook receptor (`enotasWebhook`)

```
function enotasWebhook(req, res):
    # 0. TODO BLOQUEANTE: validar autenticidade antes de produção (seção 6.3)
    if not verifyEnotasSignature(req):   # mecanismo desconhecido, ver GAP 9.4
        return res.status(401).send()

    payload = req.body
    logRawWebhookPayload(payload)   # sempre guardar cru antes de interpretar

    # ⚠️ nomes de campo abaixo são hipóteses a validar contra o payload real
    notaId = payload.idNota ?? payload.id
    eventType = payload.evento ?? payload.status   # "emitted"/"rejected"/"cancelled" — nomes reais desconhecidos

    order = findOrderByNotaId(notaId)   # requer índice: notaId -> order.
                                          # Como notaId pode ser nfeId OU nfseId,
                                          # a lookup precisa checar os dois campos
                                          # (collectionGroup query em `orders`
                                          # com where nfeId == notaId OR nfseId == notaId
                                          # -- Firestore não suporta OR nativo entre
                                          # campos diferentes; fazer 2 queries)
    if not order:
        log.error(f"Webhook para nota desconhecida: {notaId}")
        return res.status(200).send()   # 200 mesmo assim para não gerar retry infinito

    switch eventType:
        case 'emitted' | 'autorizada':
            update(order, {
                invoiceStatus: 'emitted',
                invoiceEmittedAt: now(),
                nfeXmlUrl / nfseXmlUrl: payload.linkXML,   # nomes reais desconhecidos
                nfePdfUrl / nfsePdfUrl: payload.linkPDF,
                status: 'invoiced'   # atualiza também o status geral da OS
            })
        case 'rejected' | 'negada':
            update(order, {
                invoiceStatus: 'rejected',
                invoiceError: { code: payload.codigo, message: payload.motivo, raw: payload }
            })
        case 'cancelled' | 'cancelada':
            update(order, {
                invoiceStatus: 'cancelled',
                # NFS-e cancelada: NÃO esperar XML de cancelamento (seção 5.2)
                nfsePdfUrl: payload.linkPDF ?? order.nfsePdfUrl,
            })
        default:
            log.warn(f"Evento desconhecido: {eventType}")

    return res.status(200).send()
```

### 8.4 Itens de infraestrutura a resolver antes do primeiro deploy real

- Adicionar `axios` (já está em `firebase/package.json`) como cliente HTTP
  para chamar a eNotas — ok, já disponível.
- Definir a API Key da eNotas como Secret do Cloud Functions v2
  (`firebase functions:secrets:set ENOTAS_API_KEY`), **não**
  `functions.config()` (o projeto está em `firebase-functions@^4`, que
  ainda suporta `functions.config()`, mas isso está sendo descontinuado pelo
  Firebase — preferir `defineSecret` desde já).
- `firestore.rules` atual só define acesso para o dono da oficina
  (`request.auth.uid == clientId`). A function de webhook roda com
  privilégio de admin (Admin SDK) e não passa pelas rules — ok — mas
  **nenhuma rule cliente-side deve permitir que o próprio dono da oficina
  escreva diretamente em `invoiceStatus`/`nfeId`/`nfseId`** (esses campos
  devem ser graváveis só pelo backend). Vale revisar `firestore.rules` para
  restringir escrita desses campos especificamente, já que hoje a rule é
  "tudo ou nada" por `clientId`.
- Rate limiting da eNotas é ❓ desconhecido — para o lote, processar pedidos
  **sequencialmente com pequeno delay** (ou um limite de concorrência baixo,
  ex. 2-3 em paralelo) até termos confirmação de limites, para não arriscar
  bloqueio da conta.

---

## 9. GAPS / PRECISA CONFIRMAR

### 9.0 Resolvidos na 2ª pesquisa (leitura direta de `docs.notagateway.com.br`)

- ~~Autenticação exata~~ → ✅ `Authorization: Basic {APIKey}`, base URL
  `https://api.notagateway.com.br`, ver seção 1. Só falta confirmar o
  detalhe fino de encoding (base64 do `APIKey:` ou chave crua).
- ~~Modelo multi-empresa/multi-tenant~~ → ✅ **CONFIRMADO: uma única API Key
  de conta MecOS gerencia N `empresas`** via `POST /v1/empresas` (uma
  chamada por oficina, retorna `empresaId` distinto cada vez). Não precisa
  de cofre de segredos por-tenant — um único `ENOTAS_API_KEY`. Ver seção 3.0.
- ~~Endpoint de emissão~~ → ✅ `POST /v1/empresas/{empresaId}/nfes`, ver
  seção 4.0. Ainda falta o schema **completo** do body (o que documentamos
  são fragmentos de campos fiscais, seção 4.1-4.2) e se NF-e/NFS-e usam o
  mesmo path ou paths distintos (o path encontrado usa `/nfes` genérico,
  mas não confirmamos se serve para os dois tipos ou só NFS-e).
- ~~Cadastro de empresa~~ → ✅ `POST /v1/empresas`, schema completo
  confirmado, ver seção 3.0.
- ~~Certificado digital~~ → ✅ `POST /v1/empresas/{empresaId}/certificadoDigital`,
  multipart com `.pfx`/`.p12` + senha, ver seção 3.0.
- ~~Síncrono vs. assíncrono~~ → ✅ **Assíncrono, confirmado**: fila interna →
  transmissão → monitoramento (retry até 48h) → webhook. Ver seção 4.0.
- ~~Idempotência na emissão~~ → ✅ campo `idExterno`, duplicatas são
  rejeitadas pela própria Nota Gateway. Usar `order.id`. Ver seção 4.0.
- ~~Webhook existe?~~ → ✅ confirmado que existe e dispara "near-real-time"
  no fluxo (seção 4.0, passo 7). Só o **payload exato e o endpoint de
  registro continuam não confirmados** (ver 9.1 abaixo).

### 9.1 Ainda em aberto

1. **URLs base de sandbox** — o cadastro de empresa (seção 3.0) tem objetos
   `configuracoesNFSeHomologacao` **e** `configuracoesNFSeProducao`
   separados dentro do mesmo cadastro de empresa, o que sugere que
   homologação não é uma "conta separada" mas um **modo dentro da mesma
   empresa** — precisa confirmar como selecionar qual modo usar em cada
   chamada de emissão (`ambienteEmissao` no body? endpoint diferente?).
2. **Registro de webhook**: via API ou só manual no painel por-empresa? Se
   for manual por-empresa, isso precisa entrar no checklist de onboarding
   (seção 3.4) como mais um passo humano por oficina.
3. **Payload exato do webhook** por tipo de evento (nomes de campos, se
   inclui XML/PDF/DANFE como link ou como base64, nome/formato do
   identificador da nota) e **mecanismo de autenticidade** (assinatura
   HMAC? secret compartilhado? IP allowlist?) — bloqueante de segurança
   antes de produção (seção 6.3).
4. **Divisão NF-e/NFS-e por Order mista**: quando uma OS tem peças e mão de
   obra juntas, o correto fiscal/de produto é emitir 1 NF-e + 1 NFS-e
   separadas (como o pseudocódigo da seção 8.2 assume), ou existe algum
   fluxo de nota combinada? Isso é tanto uma dúvida de API quanto uma
   decisão de negócio/fiscal — vale confirmar com contador também, não só
   com suporte eNotas. Relacionado: o endpoint de emissão confirmado
   (`/v1/empresas/{empresaId}/nfes`, seção 4.0) não deixa claro se serve
   para NF-e e NFS-e igualmente ou se há um path irmão (`/nfses`?) — checar
   antes de assumir "um endpoint só".
5. **Lista mestra de códigos de erro/rejeição**: existe uma referência
   única com todos os códigos possíveis (agregando SEFAZ estadual +
   prefeituras municipais), ou o único jeito de descobrir novos códigos é
   na prática (como os títulos "GW116", "E330", "E093/E090" vistos só de
   relance nesta pesquisa, sem detalhe)?
6. **Rate limits**: requisições por segundo/minuto para emissão e consulta
   — nada encontrado. Importante para dimensionar o `emitInvoicesBatch`
   (paralelismo/backoff).
7. **Credenciamento manual por UF/município**: o passo SEFAZ-PR (seção
   3.3) é peculiar do Paraná, ou outras UFs (para NF-e) e municípios (para
   NFS-e) têm processos manuais equivalentes? Precisamos de uma lista
   completa para desenhar o onboarding de oficina de forma genérica em vez
   de descobrir estado por estado à medida que clientes aparecem.
8. **Idempotência/retry do webhook**: a Nota Gateway reenvia webhook em caso
   de timeout do nosso endpoint? Existe `eventId` único para dedupe? (Isto é
   sobre o *webhook*; a idempotência da *emissão em si* já está resolvida
   via `idExterno`, seção 4.0.)
9. **Consulta/download**: endpoint de `GET` por id de nota existe (para
   consultar status manualmente, fora do webhook)? Retorna links prontos de
   XML/PDF/DANFE ou é preciso um endpoint separado por tipo de arquivo?
10. **Tabela A, linha "4" (Origem Nacional — processos produtivos
    básicos)**: o texto-fonte (imagem do artigo) está cortado após "Leis
    n° 8.248/1991, 8.387/1991, 10.176/2001 e...". Baixa prioridade
    (cosmético), mas convém completar a partir da legislação (é uma lei
    conhecida — Lei 11.484/2007, provável candidata) ou re-consultar o
    artigo-fonte com a imagem em melhor resolução.
11. **Schema completo de NFS-e** (objeto `cliente`/`tomador` completo,
    todos os campos de `servico`, resposta exata do POST de emissão) — as
    páginas `docs.notagateway.com.br/reference/nfse-intro` e
    `/reference/criar-nfse` **não renderizaram o schema completo** via
    fetch direto (provavelmente JS client-side, tipo Swagger interativo).
    **Próximo passo recomendado:** abrir essas páginas num browser de
    verdade (não fetch) para pegar o schema OpenAPI completo, ou pedir ao
    suporte da Nota Gateway o arquivo `openapi.json`/`swagger.json` direto.

---

## Fontes consultadas

### Documentação técnica real da API (`docs.notagateway.com.br` — ✅ confiável, leitura direta)

- [Incluir/atualizar empresa — POST /v1/empresas](https://docs.notagateway.com.br/reference/incluir-empresa)
- [Vincular certificado digital — POST /v1/empresas/{empresaId}/certificadoDigital](https://docs.notagateway.com.br/reference/vincular-certificado-empresa)
- [Autenticação](https://docs.notagateway.com.br/reference/autentica%C3%A7%C3%A3o)
- [Fluxo geral de emissão](https://docs.notagateway.com.br/docs/fluxo-geral)
- [Sobre a API - NFS-e (intro, não renderizou schema completo via fetch)](https://docs.notagateway.com.br/reference/nfse-intro)

Domínios antigos que redirecionam para os acima (não usar diretamente,
manter só por referência histórica): `docs.enotasgw.com.br`. O domínio
`developer.enotasgw.com.br` está **fora do ar**.

### Central de Ajuda / regras fiscais (`atendimento.enotas.com.br` — artigos de regra fiscal, não de API)

- [Valor aproximado dos tributos IBPT - De olho no imposto](https://atendimento.enotas.com.br/hc/pt-br/articles/35774181682701-Valor-aproximado-dos-tributos-IBPT-De-olho-no-imposto)
- [O que fazer quando o seu cliente não é contribuinte de ICMS](https://atendimento.enotas.com.br/hc/pt-br/articles/35773772520461-O-que-fazer-quando-o-seu-cliente-n%C3%A3o-%C3%A9-contribuinte-de-ICMS)
- [DANFE simplificado: o que é?](https://atendimento.enotas.com.br/hc/pt-br/articles/35773747064205-DANFE-simplificado-o-que-%C3%A9)
- [Equivalência entre CST ICMS e CSOSN](https://atendimento.enotas.com.br/hc/pt-br/articles/35773667675917-Equival%C3%AAncia-entre-CST-ICMS-e-CSOSN)
- [CST ICMS e CSOSN: O que é e como informar corretamente nas emissões na SEFAZ](https://atendimento.enotas.com.br/hc/pt-br/articles/35773649490701-CST-ICMS-e-CSOSN-O-que-%C3%A9-e-como-informar-corretamente-nas-emiss%C3%B5es-na-SEFAZ)
- [Como realizar o credenciamento e liberação de emissores na SEFAZ PR (NF-e)](https://atendimento.enotas.com.br/hc/pt-br/articles/35773508997389-Como-realizar-o-credenciamento-e-libera%C3%A7%C3%A3o-de-emissores-na-SEFAZ-PR-NF-e)
- [Como realizar a retenção de impostos em uma NFS-e em Brasília/DF](https://atendimento.enotas.com.br/hc/pt-br/articles/35773508194189-Como-realizar-a-reten%C3%A7%C3%A3o-de-impostos-em-uma-NFS-e-em-Bras%C3%ADlia-DF)
- [Como imprimir uma carta de correção](https://atendimento.enotas.com.br/hc/pt-br/articles/35773463675789-Como-imprimir-uma-carta-de-corre%C3%A7%C3%A3o)
- [Como identificar o motivo do cancelamento de um NFS-e](https://atendimento.enotas.com.br/hc/pt-br/articles/35773472744973-Como-identificar-o-motivo-do-cancelamento-de-um-NFS-e)
