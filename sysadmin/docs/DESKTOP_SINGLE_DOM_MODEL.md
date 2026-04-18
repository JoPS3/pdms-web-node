# Sysadmin Desktop Single-DOM Model

## Objetivo
Documentar o modelo de janelas desktop-like no modulo sysadmin usando um unico DOM, sem iframes, com estado de visibilidade controlado por JavaScript.

## Decisao de Arquitetura
- URL do browser representa apenas navegacao real entre paginas.
- Navegacao interna de janelas (Sessao, Detalhes, Utilizadores) nao altera rota.
- Back do browser retorna para o contexto anterior real (ex.: `/apps`).

## Estrutura Base
- `desktop-page`: body da pagina.
- `desktop-shell`: titlebar, relogio, logout e chrome visual do desktop.
- `desktop-workspace`: wallpaper, icones e dock.
- `desktop-windows-container`: container global das janelas.
- `desktop-overlay`: escurecimento quando existe janela ativa.

## Janelas Atuais
- `window-session`: launcher da area de sessao.
- `window-session-info`: janela filha pequena para detalhes da sessao.
- `window-users`: launcher da area de utilizadores.

## Relacao Pai-Filho
Fluxo implementado:
1. Desktop abre `window-session`.
2. Sessao abre `window-session-info` com parent `session`.
3. Fechar `window-session-info` restaura `window-session`.
4. Fechar `window-session` volta ao desktop.

Implementacao via atributos em trigger:
- `data-open-window="session-info"`
- `data-parent-window="session"`
- `data-hide-window-on-open="1"`

## Estado no JavaScript
Arquivo: `src/public/scripts/shell.js`

Estados principais:
- `activeWindow`: janela visivel no topo.
- `windowParent`: mapa de relacao filho -> pai.
- `hiddenOnOpen`: identifica pai ocultado ao abrir filha.

Operacoes principais:
- `openWindow(windowId, options)`:
  - abre janela alvo;
  - opcionalmente define parent;
  - opcionalmente oculta parent;
  - ativa overlay.
- `closeWindow(windowId)`:
  - fecha janela alvo;
  - restaura parent se existir;
  - remove overlay apenas quando nao ha parent ativo.

## Tamanhos de Janela
- `window-session`: media/grande para launcher.
- `window-session-info`: menor para visualizacao de detalhes.
- `window-users`: maior para atalhos e futuras listas.

Definidos no CSS por classes especificas:
- `.desktop-window.window-session`
- `.desktop-window.window-session-info`
- `.desktop-window.window-users`

## Regras de UX
- Fecho de janela apenas no botao `×` do titlebar.
- Arrasto apenas pelo titlebar.
- Sem resize (intencional neste momento).
- Sem alteracao de URL durante navegacao interna.

## Endpoints e Roteamento
- Pagina principal: `GET /sysadmin` (base path configurado por ambiente).
- Endpoint interno: `POST /sysadmin/internal/session/status`.
- Endpoint interno nao e rota de navegacao de UI.

## Checklist para evolucao
- Novas views internas devem ser partials no mesmo DOM.
- Para janela filha, sempre usar `data-parent-window`.
- Evitar `history.pushState` para estados de janela.
- Validar comportamento de back do browser apos alteracoes de UI.

## Extensao: Janela Users List (Paridade com mapas)

### Objetivo
Aplicar na listagem de utilizadores do modulo sysadmin o mesmo modelo funcional e visual das listagens em mapas:
1. Filtros por coluna.
2. Ordenacao no menu de filtro.
3. Paginacao server-side.
4. Reabertura de janela apos submit via query `openWindow`.

### Ficheiros envolvidos
- `src/views/app/index.ejs`
- `src/views/users/window-users-list.ejs`
- `src/public/scripts/table-filters.js`
- `src/public/scripts/shell.js`
- `src/public/styles/style.css`
- `src/controllers/users.gui.controller.js`
- `src/services/users-filters.service.js`

### Estrutura de views adotada (padrao fixo)

```
src/views/
  app/
  session/
  users/
  onedrive/
  errors/
```

Regra de arquitetura UI do modulo:
1. `app/` para composicao da shell.
2. Uma pasta por icon/area funcional interna (`session`, `users`, `onedrive`).
3. `errors/` para paginas de erro renderizadas por `app.js` e controllers.

### Contrato implementado
1. Query params suportados:
  - `page`, `pageSize`, `sortBy`, `sortDir`
  - `tf*` por coluna (`tfUserName`, `tfFullName`, `tfEmail`, `tfRole`, `tfIsAuthorized`)
  - `openWindow=users-list`
2. Sentinela de vazio explicito: `__EMPTY__`.
3. Menu de janela (`Ficheiro`, `Ordenar`, `Filtros`) alinhado com a estrutura usada em mapas.

### Estrategia final de ciclo de vida da janela
Para previsibilidade:
1. `openWindow('users-list')` no shell executa rebuild limpo por defeito.
2. Rebuild limpo remove `tf*`, `page`, `sortBy`, `sortDir` e volta com `openWindow=users-list`.
3. Na restauracao via query, usa-se `skipRebuild: true` para abrir exatamente o estado enviado pelo servidor.
4. O parametro `openWindow` e removido da URL apos abertura (one-shot), evitando reopen involuntario em refresh.

## Incidentes Reais e Resolucao

### 1) Icones de desktop deixaram de abrir janelas
- Sintoma: clique em `Sessao`/`Utilizadores` sem efeito.
- Causa raiz: duplicacao/regressao em metodos de lifecycle no `shell.js`.
- Resolucao: consolidacao de `openWindow`/`closeWindow` e limpeza de duplicados.
- Regra: qualquer refactor de shell deve preservar a tabela de janelas registadas no `init()`.

### 2) Menu da users-list diferente de mapas
- Sintoma: alinhamento e comportamento visual divergentes.
- Causa raiz: menu renderizado em local estrutural diferente (conteudo vs janela).
- Resolucao: mover markup do menu para nivel de janela, como sibling do conteudo.
- Regra: paridade visual exige paridade de estrutura, nao apenas CSS.

### 3) Filtro/ordenacao devolviam 404
- Sintoma: submit de menu terminava em rota inexistente.
- Causa raiz: `action` do form e links auxiliares com path incorreto.
- Resolucao: apontar `form action` para a rota valida do modulo (`basePath + '/'`).
- Regra: validar sempre endpoints reais antes de ligar ações de submit.

### 4) Janela fechava/reabria de forma inesperada
- Sintoma: estados estranhos apos aplicar filtros ou refrescar browser.
- Causa raiz: parametro `openWindow` permanecia na URL.
- Resolucao: limpeza de `openWindow` por `history.replaceState` apos restore.
- Regra: `openWindow` e gatilho temporario, nunca estado persistente de navegacao.

### 5) Semantica de `Todos` inconsistente com pesquisa
- Sintoma: combinacoes de pesquisa + toggles resultavam em selecoes inesperadas.
- Causa raiz: logica de `Todos` sem distinguir universo completo de opcoes visiveis.
- Resolucao: `Todos` passa a operar apenas no subconjunto visivel quando ha pesquisa ativa.
- Regra: pesquisa no menu altera o escopo de selecao.

### 6) Labels de filtros mostravam chave tecnica
- Sintoma: titulo do menu aparecia com key interna em vez do texto do cabecalho.
- Causa raiz: label lida do `key` e nao do header real.
- Resolucao: obter label do `th .table-filter-head span`.
- Regra: UX deve refletir nomenclatura visivel ao utilizador.

### 7) Botoes de filtro mudavam estado ao abrir menu
- Sintoma: parecia filtro aplicado sem ter clicado em `Aplicar`.
- Causa raiz: estilo atrelado a `aria-expanded=true`.
- Resolucao: remover estilo de ativo por abertura e manter apenas `is-filtered`/`is-sorted`.
- Regra: feedback visual deve representar estado aplicado, nao estado transitivo de UI.

### 8) Contraste baixo no corpo da tabela
- Sintoma: texto dificil de ler em certas combinacoes de fundo.
- Causa raiz: heranca de cores apos ajustes de tema.
- Resolucao: definir explicitamente cores de `tbody` e conteudo de celulas.
- Regra: qualquer mudanca de tema exige verificacao de contraste em dados reais.

## Checklist de regressao do sysadmin
1. Abrir `Utilizadores` e depois `Lista de Utilizadores` funciona em desktop sem recarregar manualmente.
2. Fechar `users-list` restaura `users` quando aplicavel.
3. `Aplicar` em filtros reabre `users-list` e mantem estado esperado.
4. Ordenacao no menu submete de imediato e volta para `page=1`.
5. `Limpar todos os filtros` remove `tf*`.
6. Refresh manual nao reabre janela por efeito colateral de query antiga.
7. Sem resultados, a tabela mostra `Sem registos.` e a pagina continua funcional.

## Notas para proximas migracoes (vendas/compras/rh)
1. Reutilizar o contrato `tf* + sort + page + __EMPTY__ + openWindow one-shot`.
2. Preservar semantica de menu (sort imediato, filtro em aplicar).
3. Manter teste manual minimo com foco em lifecycle de janela e nao apenas SQL.
