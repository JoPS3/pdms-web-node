# PDMS Standard: Single-DOM Desktop Windows

## Finalidade
Este documento define o padrao global de UI desktop-like para os modulos PDMS. O objetivo e replicar uma experiencia consistente entre `auth`, `mapas`, `vendas`, `compras`, `rh` e futuros modulos.

## Principios
1. Um unico DOM por modulo.
2. Sem iframes para views internas de desktop.
3. URL reflete apenas navegacao entre paginas reais.
4. Navegacao interna de janelas e gerida por estado JavaScript.
5. Back do browser deve regressar ao contexto anterior real (normalmente `/apps`).

## Contrato de Estrutura
Cada modulo deve ter:
- `desktop-page` (body da pagina)
- `desktop-shell` (titlebar e chrome global)
- `desktop-workspace` (icone e dock)
- `desktop-windows-container` (todas as janelas preexistentes)
- `desktop-overlay` (escurecimento)

Estrutura esperada (resumo):
- `desktop-shell`
- `desktop-workspace`
- `desktop-windows-container`
  - `desktop-overlay`
  - `desktop-window` (N instancias, hidden por default)

## Contrato de Janela
Cada janela usa:
- id: `window-<name>`
- close button: `data-close-window="<name>"`
- trigger de abertura: `data-open-window="<name>"`

Para abrir janela filha:
- `data-parent-window="<parent>"`
- `data-hide-window-on-open="1"`

## Comportamento Obrigatorio
- Fechar janela filha restaura a janela pai.
- Fechar janela pai retorna ao contexto anterior (desktop ou pai superior).
- Overlay permanece ativo enquanto existir janela ativa.
- Fecho principal por botao `×`.
- Arrasto por titlebar.

## Regras de Navegacao e Historico
- Nao usar rotas dedicadas para subviews internas de janelas.
- Nao usar `pushState` para alternancia de janelas.
- Endpoint internos (ex.: `/internal/*`) sao API/infra, nao navegacao.
- Browser back deve manter semantica de pagina, nao de estado interno.

## Organizacao de Codigo
### Views
- `views/index.ejs`: shell + workspace + include das janelas.
- `views/partials/desktop/`: uma partial por conteudo de janela.

### Scripts
- `public/scripts/shell.js`: estado global de janelas, drag, open/close, parent-child.

### Styles
- `public/styles/style.css`:
  - base do desktop;
  - base de janela (`.desktop-window`);
  - tamanhos por variante (`.window-<name>`).

## Padrao de Nomes
- Classe base: `.desktop-window`
- Variante: `.desktop-window.window-<name>`
- Trigger de abrir: `data-open-window`
- Trigger de fechar: `data-close-window`

## Padrao de Testes Minimos por Modulo
- Rota principal do modulo responde com sessao valida.
- Endpoint interno protegido responde 401 sem sessao.
- Endpoint interno responde 200 com sessao valida.
- Mudancas de janela nao quebram rota principal.

## Plano de Adocao
1. Migrar views internas iframe-based para partials no mesmo DOM.
2. Introduzir `desktop-windows-container` unico.
3. Centralizar logica em `shell.js` por modulo.
4. Aplicar relacao pai-filho onde houver sub-janela.
5. Validar historico/back em todos os modulos.

## Notas de Implementacao
- Evitar complexidade prematura (minimize/maximize) antes da base comum estabilizar.
- Se necessario multi-janela simultanea, evoluir z-index manager sem alterar contrato base.
- Manter compatibilidade visual entre modulos para reduzir custo cognitivo do utilizador.
