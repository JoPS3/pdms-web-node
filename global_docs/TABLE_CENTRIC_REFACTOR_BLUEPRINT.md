# PDMS Table-Centric Refactor Blueprint

## Objetivo
Definir um plano base para evoluir cada app do ecossistema PDMS de uma organizacao centrada no modulo para uma organizacao centrada nas tabelas de BD e nas features associadas.

Este documento e um esboco de trabalho para as proximas sessoes.

## Contexto e decisao
- O modelo arquitetural por app mantem-se MPA (com progressive enhancement no frontend).
- A mudanca proposta e estrutural interna: separar responsabilidades por tabela/feature e nao por "controller unico da app".
- A separacao futura por servidores (uma app por host) nao exige SPA; exige fronteiras claras, contratos estaveis e baixo acoplamento.

## Alinhamento com contrato backend atual

Este blueprint deve ser executado em alinhamento com o contrato backend consolidado no gateway (reforco iniciado em 2026-04-17 e 2026-04-18):

1. Autenticacao Bearer-first e validacao de sessao via gateway.
2. Refresh fallback no gateway quando aplicavel.
3. Separacao objetiva por camada: controller, service, dao, view.
4. Ficheiros compactos e concisos como regra de manutencao.

O objetivo nao e apenas reorganizar pastas, mas reduzir acoplamento e tornar cada camada previsivel.

## Principios de desenho
1. Vertical slice por tabela/feature.
2. Um controller por feature (evitar mega-controller da app).
3. Rotas por feature, agregadas por um index de rotas.
4. Views e partials proximas da feature que as usa.
5. Contratos de filtros/paginacao/sort normalizados entre features.
6. DAO por contexto de dados (sem logica de UI no DAO).
7. Service opcional para regras de negocio reutilizaveis.
8. Testes por feature (controller, DAO e fluxo de rota).

## Modelo alvo por app (template)
Sugestao de estrutura para cada modulo (mapas, vendas, compras, rh, etc.):

```text
<app>/src/
  app.js
  server.js
  routes/
    index.js
    features/
      <feature-a>.routes.js
      <feature-b>.routes.js
  controllers/
    features/
      <feature-a>.controller.js
      <feature-b>.controller.js
  services/
    features/
      <feature-a>.service.js
      <feature-b>.service.js
  daos/
    features/
      <feature-a>.dao.js
      <feature-b>.dao.js
  views/
    features/
      <feature-a>/
        list.ejs
        detail.ejs
        partials/
      <feature-b>/
        list.ejs
        detail.ejs
        partials/
  public/
    scripts/
      features/
        <feature-a>.js
        <feature-b>.js
    styles/
      features/
        <feature-a>.css
        <feature-b>.css
```

Nota:
- O shell global da app pode continuar centralizado.
- O conteudo funcional deve sair de views genericas e aproximar-se da feature/tabela.

## Convencoes recomendadas

### Naming
- Feature baseada em contexto funcional/tabela dominante.
- Exemplo em mapas:
  - diario_caixa -> feature "diario-caixa"
  - auditoria_logs -> feature "auditoria-logs"

### Controllers
- Devem orquestrar request/response apenas.
- Devem delegar regras para services e acesso a dados para DAOs.
- Devem evitar utilitarios gigantes dentro do mesmo ficheiro.

### DAOs
- Um DAO por tabela principal (ou agregado pequeno e coeso).
- Metodos explicitos:
  - list/count/listTableFilterOptions
  - getById
  - upsert/create/update/delete (quando aplicavel)

### Views
- Uma pasta por feature.
- Partials de feature dentro da propria pasta da feature.
- Evitar partials "globais" para detalhes que so uma feature usa.

### Scripts frontend
- Um script por feature (mais shell comum quando necessario).
- Contrato uniforme para filtros de tabela (`tf*`, `sortBy`, `sortDir`, `__EMPTY__`).

## Mapa inicial para mapas (referencia)

### Estado atual observado
- Rotas principais da app: `/`, `/diario-caixa`, `/auditoria-logs`.
- Um controller grande em `mapas.controller.js` com responsabilidades de duas features.

### Alvo para mapas
1. Criar `controllers/features/diario-caixa.controller.js`.
2. Criar `controllers/features/auditoria-logs.controller.js`.
3. Criar `routes/features/diario-caixa.routes.js`.
4. Criar `routes/features/auditoria-logs.routes.js`.
5. Manter `routes/index.js` apenas como agregador.
6. Mover views para:
   - `views/features/diario-caixa/`
   - `views/features/auditoria-logs/`
7. Manter shell e elementos partilhados fora das features.

## Fases de execucao (por app)

### Fase 0 - Inventario
- Listar tabelas de BD realmente usadas pela app.
- Mapear endpoints, views, scripts e DAO atuais por tabela.
- Identificar pontos de acoplamento alto.

### Fase 1 - Separar rotas e controllers
- Extrair controllers por feature sem alterar comportamento.
- Criar routers por feature e integrar no index.
- Garantir compatibilidade de URLs existentes.

### Fase 2 - Separar views e assets
- Mover views/partials para pastas por feature.
- Mover JS/CSS para `public/scripts/features` e `public/styles/features`.
- Preservar shell e layout comuns.

### Fase 3 - Endurecer contratos e testes
- Consolidar contrato de filtros/sort/paginacao.
- Cobrir cada feature com testes de rota/controller e regressao.
- Medir impacto em logs e erros de runtime.

### Fase 4 - Preparacao para multi-servidor
- Externalizar URLs internas por env (sem localhost hardcoded em logica).
- Definir timeouts/retries e observabilidade para chamadas entre apps.
- Formalizar APIs internas por app (entrada/saida/erros esperados).

## Criterios de aceite por feature
- Sem regressao funcional visivel.
- URLs e query params existentes continuam a funcionar.
- Controller da feature com responsabilidade unica.
- View da feature isolada em pasta propria.
- Testes minimos a passar.

## Checklist curto por feature
- [ ] Router dedicado criado
- [ ] Controller dedicado criado
- [ ] DAO/service alinhados
- [ ] Views/partials movidas para pasta da feature
- [ ] Script/CSS da feature isolados
- [ ] Testes de regressao executados

## Riscos e mitigacoes
- Risco: quebra de includes EJS apos mover views.
  - Mitigacao: migrar por passos pequenos e validar render de cada rota.
- Risco: divergencia de contrato de filtros entre features.
  - Mitigacao: utilitarios partilhados para parse/sync de query params.
- Risco: controller novo ainda ficar grande.
  - Mitigacao: limite de responsabilidade e extracao para service.

## Proximos passos sugeridos
1. Aplicar Fase 0 e Fase 1 em mapas.
2. Validar padrao em mapas antes de replicar para vendas/compras/rh.
3. Criar um "template de feature" para acelerar proximas migracoes.

## Documento relacionado
- `global_docs/PDMS_SHELL_SPA_MPA_MODEL.md`
- `mapas/docs/TABLE_FILTER_GLOBAL_MODEL.md`
