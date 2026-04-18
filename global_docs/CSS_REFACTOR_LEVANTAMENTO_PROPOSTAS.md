# Levantamento e Propostas de Refatoracao CSS/HTML

Status: TODO
Date: 2026-04-18
Scope: gateway, usuarios, mapas, vendas, compras, rh

---

## 1) Levantamento Atual

### 1.1 Entradas SCSS por app

Todas as apps compilam a partir de um entry local app.scss e importam uma base global de templates.

Arquivos:
- gateway/src/public/styles/scss/app.scss
- usuarios/src/public/styles/scss/app.scss
- mapas/src/public/styles/scss/app.scss
- vendas/src/public/styles/scss/app.scss
- compras/src/public/styles/scss/app.scss
- rh/src/public/styles/scss/app.scss

### 1.2 Base global realmente partilhada

Import comum em todas as apps:
- templates/styles/_tokens.scss
- templates/styles/_globals.scss
- templates/styles/shell-desktop/_shell.scss
- templates/styles/shell-desktop/_titlebar.scss
- templates/styles/shell-desktop/_launcher.scss
- templates/styles/shell-mobile/_shell.scss
- templates/styles/shell-mobile/_launcher.scss

Import comum em parte das apps (mapas/usuarios/vendas/compras/rh):
- templates/styles/shell-desktop/_windows.scss
- templates/styles/shell-desktop/_window-menu.scss
- templates/styles/components/_table-filters.scss

Import mobile navigation (gateway/mapas/usuarios):
- templates/styles/shell-mobile/_navigation.scss

### 1.3 Modulos locais SCSS

- gateway/src/public/styles/scss/_auth.scss
- gateway/src/public/styles/scss/_errors.scss
- usuarios/src/public/styles/scss/_auth-module.scss
- mapas/src/public/styles/scss/_mapas-module.scss

Observacao:
- vendas/compras/rh nao tem modulo local ativo e estao quase 100% shell global.

### 1.4 Densidade de classes em views (amostra de maior impacto)

- usuarios/src/views/index.ejs: alta densidade (desktop windows + menus + tabela + formularios)
- mapas/src/views/diario-caixa-list.ejs: alta densidade (filtros por coluna + paginação)
- mapas/src/views/auditoria-logs-list.ejs: alta densidade (filtros + payload collapse)
- vendas/src/views/index.ejs, compras/src/views/index.ejs, rh/src/views/index.ejs: estrutura muito parecida
- gateway/src/views/apps/index.ejs: shell base com componentes mobile e desktop

---

## 2) Problemas Encontrados

### P1 - Taxonomia mista por contexto funcional

Ha mistura de familias de nomes por dominio em componentes visualmente iguais.

Exemplos:
- users-list-table vs diario-table vs auditoria-table
- user-edit-window-* vs window-* vs desktop-window-*

Risco:
- aumenta custo cognitivo e dificulta reutilizacao.

### P2 - Repeticao de estruturas shell entre apps

Markup desktop/mobile muito repetido nas paginas index de modulos.

Exemplos:
- titlebar + dock + desktop-icons repetidos em gateway, mapas, usuarios, vendas, compras, rh

Risco:
- manutencao lenta e risco de divergencia visual.

### P3 - Nomes orientados ao modulo em vez de componente

Parte dos nomes descreve a feature e nao o papel visual.

Exemplos:
- window-session-wrapper, window-users-wrapper, user-edit-window-*

Risco:
- impede promover para camada comum.

### P4 - Estados visuais corretos, mas sem contrato unico

Estados estao bons (is-open, is-active, is-error, is-success), mas ainda sem regra fechada para todos os componentes.

Risco:
- cada app pode criar novos estados sem consistencia.

### P5 - Dependencia de classes utilitarias ad-hoc nas views

Existem pequenos pads de classe sem padrao unico de utilitarios.

Exemplos:
- usos pontuais de classes ou estilo inline para margens e pequenos ajustes.

Risco:
- proliferacao silenciosa de excecoes.

---

## 3) Propostas de Refatoracao (Prioridade)

## Fase 1 - Contrato de nomenclatura (alto impacto, baixo risco)

### Objetivo
Definir taxonomia unica para componentes e layout.

### Proposta
- Prefixos oficiais:
  - l- layout
  - c- component
  - u- utility
  - is- state
- Proibir nomes vagos e sinonimos.
- Regra: 1 classe principal = 1 responsabilidade visual.

### Entregavel
- Documento de naming v1 aprovado.

---

## Fase 2 - Canonicalizar shell desktop/mobile (alto impacto, medio risco)

### Objetivo
Remover divergencia de markup repetido entre apps.

### Proposta
Promover estrutura canónica:
- c-shell-desktop
- c-shell-titlebar
- c-shell-workspace
- c-shell-dock
- c-shell-mobile
- c-shell-mobile-header
- c-shell-mobile-main

Sem alterar comportamentos, apenas convergencia estrutural e de nomes.

### Entregavel
- Mapa antigo -> novo para index de gateway + um modulo piloto.

---

## Fase 3 - Tabelas e filtros (alto impacto, medio risco)

### Objetivo
Consolidar familias de tabela e filtros que ja sao quase comuns.

### Proposta
Criar camada canónica:
- c-table
- c-table__head
- c-table__row
- c-table__cell
- c-table-filters
- c-table-pagination
- c-filter-summary

Manter nomes de dominio apenas como modificadores:
- c-table--users
- c-table--diario
- c-table--auditoria

### Entregavel
- Especificacao de tabela global + migração do primeiro caso.

---

## Fase 4 - Janelas desktop e menu de janela (medio impacto, medio risco)

### Objetivo
Unificar nomenclatura de janelas e sub-secoes.

### Proposta
Trocar familias de feature por componente:
- desktop-window + window-* -> c-window + c-window__titlebar + c-window__content
- window-menu-* -> c-menu + c-menu__item + c-menu__dropdown

Nomes funcionais viram modificadores:
- c-window--session
- c-window--users
- c-window--onedrive

### Entregavel
- Refatoracao por lote em usuarios (maior retorno).

---

## Fase 5 - Utilities com allowlist (medio impacto, baixo risco)

### Objetivo
Controlar proliferacao de classes de ajuste rapido.

### Proposta
Criar allowlist curta:
- u-hidden
- u-visually-hidden
- u-truncate
- u-text-center
- u-nowrap

Tudo fora da allowlist precisa justificativa.

### Entregavel
- Politica de utilitarios para PR review.

---

## 4) Pilotos Recomendados

### Piloto Desktop
usuarios/src/views/index.ejs

Por que:
- concentra titlebar, dock, janelas, menu, tabela, formularios e estados.

### Piloto Mobile
gateway/src/views/apps/index.ejs

Por que:
- baseline simples e transversal para shell mobile.

### Piloto Tabela/Filtros
mapas/src/views/diario-caixa-list.ejs

Por que:
- possui contrato de filtros mais completo e reutilizavel.

---

## 5) Backlog Executavel (sem alterar funcionalidade)

1. Congelar naming contract v1.
2. Criar dicionario de sinonimos atuais -> nome canónico.
3. Definir contrato c-shell desktop/mobile.
4. Definir contrato c-window e c-menu.
5. Definir contrato c-table/c-filter.
6. Executar piloto em usuarios index.
7. Executar piloto mobile em gateway apps.
8. Executar piloto tabela em mapas diario.
9. Medir: classes removidas, duplicacoes eliminadas, legibilidade HTML.
10. Expandir para vendas/compras/rh.

---

## 6) Riscos e Mitigacao

Risco:
- over-generalizacao precoce.
Mitigacao:
- promover para comum so com evidência em 2+ apps.

Risco:
- regressao visual ao renomear em massa.
Mitigacao:
- migracao por lotes pequenos com pilotos e checklist.

Risco:
- mistura de desktop/mobile por pressa.
Mitigacao:
- regra formal: separar so quando ha diferenca estrutural/interacao.

---

## 7) Critérios de Done

- naming contract publicado e aplicado nos pilotos
- sinónimos principais eliminados
- shell desktop/mobile com estrutura coerente
- contratos de window/menu/table documentados
- sem aumento de utilitarios fora da allowlist
- reducao mensuravel de redundancia
