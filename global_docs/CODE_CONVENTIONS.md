# PDMS - Convencoes de Codigo

Apendice ao contrato de integracao (`PDMS_APP_INTEGRATION.md`).
Define as convencoes de naming, estrutura de ficheiros e responsabilidades por camada que se aplicam a todas as apps do ecossistema PDMS (`gateway`, `sysadmin`, `mapas`, `vendas`, `compras`, `rh`).

---

## 1. Naming de ficheiros

### Regra geral

Todos os ficheiros de codigo usam **kebab-case**.
Nao usar PascalCase nem camelCase em nomes de ficheiros.

| Camada | Sufixo | Exemplo |
|---|---|---|
| Controller GUI (renders) | `.gui.controller.js` | `users.gui.controller.js` |
| Controller API (JSON/redirect) | `.api.controller.js` | `users.api.controller.js` |
| Service | `.service.js` | `auth.service.js` |
| DAO | `.dao.js` | `users.dao.js` |
| Middleware | `.middleware.js` | `session.middleware.js` |
| Routes | `.routes.js` | `auth.routes.js` |
| Util | sem sufixo fixo | `table-filters.js`, `users-export.js` |
| Local helper (nao exportado) | `.local.js` | `gateway-auth.local.js` |

### Regras especificas

- DAOs que representam colecoes usam o plural: `users.dao.js`, `sessions` seria `session.dao.js` (entidade).
- Services compostos usam hifen: `onedrive-auth.service.js`, `users-filters.service.js`.
- Nunca usar `index.js` para controllers, services ou daos — o nome do ficheiro deve descrever o seu conteudo.

---

## 2. Separacao GUI vs API

Cada app distingue explicitamente controllers de interface de controllers de endpoint.

### `.gui.controller.js`

- Serve **renders** (`res.render()`) e **downloads** (`res.setHeader` + `res.send`).
- Montado no `app.js` sob `requireGatewayAuth` (middleware de autenticacao web).
- Recebe dados de services e passa-os para views EJS.
- Nunca devolve JSON como resposta principal.

### `.api.controller.js`

- Serve **endpoints JSON** e, excecionalmente, redirects de fluxo OAuth.
- Montado em `routes/index.js` (ou ficheiro de routes equivalente) sob `requireGatewaySessionApi`.
- Nunca chama `res.render()`.
- O nome do ficheiro reflecte o dominio: `sysadmin.api.controller.js`, `users.api.controller.js`, `onedrive.api.controller.js`.

### Exemplo: sysadmin

```
controllers/
  sysadmin.api.controller.js   ← session status, change-password
  onedrive.api.controller.js   ← proxy OneDrive → gateway (JSON)
  users.api.controller.js      ← update user (JSON)
  users.gui.controller.js      ← home page, edit page, export (renders/download)
```

### Exemplo: gateway

```
controllers/
  auth.gui.controller.js       ← login pages, set-password page (renders)
  auth.api.controller.js       ← validate-session, refresh-token (JSON)
  onedrive.api.controller.js   ← OAuth callback + JSON endpoints
  apps.controller.js           ← apps launcher page (GUI, unico neste caso)
```

---

## 3. Estrutura de camadas

Toda a app de dominio segue esta estrutura obrigatoria:

```
src/
  app.js                  ← Express app + middlewares + rotas GUI + settings
  server.js               ← bootstrap: carrega .env, porta, inicia HTTP
  controllers/            ← gui.controller e api.controller (ver seccao 2)
  services/               ← logica de negocio, sem acesso direto a DB
  daos/                   ← acesso a DB (queries SQL), sem logica de negocio
  middlewares/            ← session.middleware.js (+ outros se necessario)
  routes/                 ← index.js com todas as rotas API/internal
  utils/                  ← helpers puros sem estado (CSV, filtros, etc.)
  views/                  ← templates EJS
  public/                 ← estilos e scripts estaticos
  db/                     ← pool de ligacao a DB
  config/                 ← configuracao de runtime (basePath, etc.)
  scheduler/              ← jobs periodicos (se existirem)
```

---

## 4. Responsabilidades por camada

### Controller GUI

- Chama services/services de filtro para obter dados.
- Passa dados para `res.render()`.
- Nao contem logica de negocio.
- Nao faz queries a DB diretamente.

### Controller API

- Valida input no limite do sistema (IDs, campos obrigatorios).
- Chama services para executar a acao.
- Devolve JSON com `{ status, message }` ou erros estruturados.
- Nao contem logica de negocio.

### Service

- Contem logica de negocio (validacoes, transformacoes, orquestracao).
- Chama DAOs para acesso a dados.
- Nao usa `req`/`res` — e agnóstico de HTTP.
- Se um service crescer (ex: tem filtros/paginacao separados), extrair para `entity-filters.service.js`.

### DAO

- Apenas queries SQL.
- Devolve rows cruas ou valores escalares.
- Sem logica de negocio.
- Um DAO por entidade principal.

### Utils

- Funcoes puras sem estado e sem dependencias de servicos.
- Usadas por controllers ou services (nao por DAOs).
- Exemplos: `parseTableFiltersFromQuery`, `createCsv`, `createFlatOdf`.

---

## 5. Middleware de sessao

O middleware de autenticacao chama-se sempre `session.middleware.js`.
Exporta:

- `requireGatewayAuth` — para rotas GUI (redireciona para login se invalido)
- `requireGatewaySessionApi` — para rotas API (devolve 401 JSON se invalido)
- `validateGatewaySession` — funcao de validacao reutilizavel (async, sem side effects HTTP)
- `parseSessionToken` — extrai token de `Authorization: Bearer` ou cookie

Nunca usar `auth.middleware.js` como nome — causa confusao com o dominio de autenticacao do gateway.

---

## 6. Tamanho de ficheiros

Regra orientadora: **menos de 200 linhas por ficheiro**.

Se um ficheiro ultrapassar esse limite, avaliar se:
- O ficheiro tem mais do que uma responsabilidade (dividir por dominio).
- Existem helpers inline que devem ir para `utils/`.
- Existem funcoes de filtro/paginacao que devem ir para um service separado.

Esta regra nao e absoluta mas e um sinal de alerta.

---

## 7. Testes

- Os ficheiros de teste espelham o nome do controller/service testado.
- `jest.mock` usa sempre o caminho relativo ao ficheiro testado com o novo nome canónico.
- Quando um controller e dividido (ex: `users.controller.js` → `users.gui.controller.js` + `users.api.controller.js`), os mocks no teste de integracao sao divididos tambem.

---

## 8. Checklist ao criar uma nova app

- [ ] Estrutura de diretorias conforme seccao 3.
- [ ] Ficheiros de controllers com sufixo `.gui.controller.js` / `.api.controller.js`.
- [ ] Middleware de sessao em `middlewares/session.middleware.js`.
- [ ] DAOs com sufixo `.dao.js` em kebab-case.
- [ ] Services com sufixo `.service.js` em kebab-case.
- [ ] Routes em `routes/index.js` (ou `.routes.js` se o gateway tiver multiplos ficheiros).
- [ ] Utils puros em `src/utils/`.
- [ ] README.md atualizado com estrutura real de ficheiros.
- [ ] Testes passam com `npm test -- --runInBand`.
