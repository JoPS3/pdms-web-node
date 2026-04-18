# [DEPRECATED] PDMS Standard: Single-DOM Desktop Windows

## Status
- Deprecated em 2026-04-18.
- Este documento deixou de ser contrato ativo de arquitetura.

## Motivo
- A estrategia atual do projeto adotou shell SPA para navegacao/launcher e apps MPA para funcionalidades reais.
- O modelo de janelas single-DOM por modulo deixou de ser baseline obrigatoria.

## Documento substituto
- Ver `global_docs/PDMS_SHELL_SPA_MPA_MODEL.md` como referencia atual.
- Manter este ficheiro apenas para contexto historico.

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

## Tabelas em Janelas (Contrato Global)
Quando uma listagem vive dentro de uma `desktop-window`, o modulo deve seguir este contrato para evitar desvios de UX entre `auth`, `mapas` e restantes modulos.

### Contrato de Query Params
- Filtros por coluna: `tf<Coluna>` (ex.: `tfRole`, `tfUserName`).
- Paginacao: `page`, `pageSize`.
- Ordenacao: `sortBy`, `sortDir` (`ASC`/`DESC`).
- Reabertura da janela apos submit server-side: `openWindow=<window-id>`.
- Sentinela de selecao vazia explicita: `__EMPTY__`.

Regras:
1. O submit de filtro/ordenacao nunca pode apontar para rota inexistente.
2. `openWindow` e one-shot: apos reabrir a janela, remover o param da URL com `replaceState`.
3. Nao usar `pushState` para representar estado interno de menu/filtro.

### Comportamento de Menu de Filtros
1. Botoes de cabecalho:
  - estado visual ativo apenas com filtro aplicado (`is-filtered`) ou ordenacao ativa (`is-sorted`);
  - abrir menu nao deve colorir como se filtro estivesse aplicado.
2. Ordenacao no menu:
  - aplica imediatamente e reseta `page` para `1`.
3. Filtros no menu:
  - alteracoes de checkboxes sao locais ate `Aplicar`;
  - `Aplicar` persiste `tf*`, reseta `page` para `1`, e submete.
4. Opcao `Todos`:
  - sem pesquisa ativa: atua sobre todas as opcoes;
  - com pesquisa ativa: atua apenas sobre opcoes visiveis;
  - pesquisa + nenhum selecionado implica filtro explicito vazio (`__EMPTY__`).

### Contrato Backend para Opcoes de Filtro
Cada coluna deve devolver opcoes distintas com semantica "Excel-like":
1. Aplicar filtros das outras colunas.
2. Ignorar filtro da propria coluna durante a recolha das opcoes.
3. Manter normalizacao consistente de booleanos e vazios.

### Politica de Reabertura da Janela
Para listagens sensiveis a estado antigo:
1. Reabrir pode forcar rebuild server-side da janela (estrategia deterministica).
2. Rebuild deve limpar estado volatil local (filtros/pagina/sort antigos), exceto quando a abertura vem de restauracao explicita da query atual.
3. A restauracao por query deve permitir um bypass controlado do rebuild (ex.: `skipRebuild`).

### Checklist de Regressao (Obrigatorio)
1. Clique no icone abre janela correta.
2. Fechar janela filha restaura pai.
3. Submit de filtro/ordenacao nao devolve 404.
4. `openWindow` nao fica preso na URL apos reabrir.
5. Refresh manual do browser nao causa reabertura inesperada de janela.
6. `Todos` com pesquisa respeita apenas itens visiveis.
7. Corpo da tabela mantem contraste de leitura em todos os estados visuais.
