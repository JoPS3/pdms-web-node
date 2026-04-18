# [DEPRECATED] Checklist de Migracao Single-DOM (PDMS)

## Status
- Deprecated em 2026-04-18.
- Este checklist nao deve ser usado para novas implementacoes.

## Motivo
- A estrategia ativa passou para shell SPA (navegacao/menu) + apps MPA (funcionalidades reais).
- O fluxo de migracao single-DOM por modulo nao representa mais o caminho principal.

## Documento substituto
- Ver `global_docs/PDMS_SHELL_SPA_MPA_MODEL.md`.
- Manter este ficheiro apenas para referencia historica.

## Objetivo
Aplicar o padrao de desktop-like em um unico DOM para modulos novos/existentes, mantendo navegacao de pagina separada da navegacao interna de janelas.

## Ordem recomendada
1. `vendas`
2. `compras`
3. `rh`

## 1) Preparacao por modulo
- [ ] Confirmar `basePath` e `gatewayBasePath` no modulo.
- [ ] Confirmar middleware de autenticacao gateway ativo nas rotas protegidas.
- [ ] Garantir que a rota principal do modulo (`GET /<modulo>`) renderiza `index.ejs`.

## 2) Estrutura de views (single DOM)
- [ ] Em `views/index.ejs`, criar/validar:
  - [ ] `desktop-shell`
  - [ ] `desktop-workspace`
  - [ ] `desktop-windows-container`
  - [ ] `desktop-overlay`
- [ ] Criar janela base por feature com `id="window-<name>"` e `hidden` por default.
- [ ] Mover conteudos internos para partials em `views/partials/desktop/`.
- [ ] Evitar iframes para subviews internas.

## 3) Contrato de eventos no HTML
- [ ] Trigger de abertura usa `data-open-window="<name>"`.
- [ ] Botao de fecho usa `data-close-window="<name>"`.
- [ ] Para janela filha:
  - [ ] `data-parent-window="<parent>"`
  - [ ] `data-hide-window-on-open="1"`

## 4) Script global de janelas
- [ ] Criar/atualizar `public/scripts/shell.js` com:
  - [ ] `activeWindow`
  - [ ] `windowParent`
  - [ ] `hiddenOnOpen`
- [ ] Implementar `openWindow(windowId, options)`.
- [ ] Implementar `closeWindow(windowId)` com restauracao de parent.
- [ ] Implementar drag por titlebar.
- [ ] Nao usar `history.pushState` para mudancas internas de janela.

## 5) CSS padrao
- [ ] Definir base `.desktop-window`.
- [ ] Definir tamanhos por variante:
  - [ ] `.desktop-window.window-<name>`
- [ ] Garantir overlay ativo enquanto existir janela ativa.
- [ ] Garantir `pointer-events` corretos para icons/dock quando janela esta aberta.

## 6) Historico e navegacao
- [ ] Confirmar que URL do browser permanece na rota principal do modulo durante navegacao interna.
- [ ] Confirmar que botao Back do browser regressa ao contexto real anterior (ex.: `/apps`).
- [ ] Confirmar que endpoints `/internal/*` nao aparecem como navegacao no browser.

## 7) Endpoints internos
- [ ] Manter endpoints internos para estado/dados (ex.: sessao) via API.
- [ ] Proteger endpoints internos com middleware apropriado (401 sem sessao).

## 8) Testes minimos por modulo
- [ ] `GET /<modulo>/health` responde 200.
- [ ] `GET /<modulo>/` redireciona sem sessao.
- [ ] `GET /<modulo>/` responde 200 com sessao valida.
- [ ] Endpoint interno responde 401 sem sessao.
- [ ] Endpoint interno responde 200 com sessao valida.

## 9) QA manual (UI)
- [ ] Abrir janela principal pelo icone desktop.
- [ ] Abrir janela filha a partir da principal.
- [ ] Fechar filha e validar retorno a mae.
- [ ] Fechar mae e validar retorno ao desktop.
- [ ] Validar drag nas janelas ativas.
- [ ] Validar comportamento mobile sem desktop shell.

## 10) Entrega por modulo
- [ ] Atualizar docs internas do modulo em `/<modulo>/docs/`.
- [ ] Atualizar docs globais apenas se contrato global mudar.
- [ ] Executar testes do modulo.
- [ ] Commit com mensagem clara de migracao single-dom.
- [ ] Push e validacao no ambiente (pm2/nginx).

## Nota de consistencia
Este checklist segue o padrao documentado em:
- `global_docs/deprecated/DEPRECATED_PDMS_SINGLE_DOM_WINDOWS_STANDARD.md`
- `auth/docs/DESKTOP_SINGLE_DOM_MODEL.md`
