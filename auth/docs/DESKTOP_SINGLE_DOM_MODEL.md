# Auth Desktop Single-DOM Model

## Objetivo
Documentar o modelo de janelas desktop-like no modulo auth usando um unico DOM, sem iframes, com estado de visibilidade controlado por JavaScript.

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
- Pagina principal: `GET /auth` (base path configurado por ambiente).
- Endpoint interno: `POST /auth/internal/session/status`.
- Endpoint interno nao e rota de navegacao de UI.

## Checklist para evolucao
- Novas views internas devem ser partials no mesmo DOM.
- Para janela filha, sempre usar `data-parent-window`.
- Evitar `history.pushState` para estados de janela.
- Validar comportamento de back do browser apos alteracoes de UI.
