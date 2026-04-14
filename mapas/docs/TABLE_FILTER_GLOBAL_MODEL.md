# TABLE_FILTER_GLOBAL_MODEL

## Objetivo

Definir um contrato unico de filtros de tabela para modulos PDMS com comportamento previsivel e consistente.

## Contrato de query string

- Filtros por coluna: `tf<ColumnKey>`
- Ordenacao: `sortBy`, `sortDir`
- Paginacao: `page`, `pageSize`
- Selecao vazia explicita: `__EMPTY__`

Exemplo:

- `?page=1&pageSize=50&sortBy=data&sortDir=ASC&tfData=2026-04-10&tfData=2026-04-11`

## Regras de backend

1. Sanitizar e normalizar inputs (`trim`, lista unica, limites de pagina/tamanho).
2. Aplicar filtros no SQL no lado servidor (nao depender de filtro local para verdade de dados).
3. Persistir filtros e ordenacao em redirects de pagina invalida.
4. Opcoes de filtro por coluna devem:
   - considerar filtros das outras colunas
   - ignorar o filtro da propria coluna (logica tipo Excel)
5. Tratar selecao vazia com `__EMPTY__` para diferenciar de "sem filtro".

## Regras de frontend

1. Menu por coluna com:
   - ordenacao A-Z / Z-A
   - pesquisa de valores
   - aplicacao explicita
2. Estado visual de coluna:
   - filtrada
   - ordenada
   - filtrada + ordenada
3. Limite do menu dentro da area da listagem (nao ultrapassar esquerda/direita).
4. Persistencia por hidden inputs (`tf*`, `sortBy`, `sortDir`, `page`, `pageSize`).
5. Botao "Limpar filtros" remove `tf*` e volta para pagina 1.

## Filtro base recomendado para tabelas grandes

Aplicar um filtro base antes dos filtros de coluna:

- por ano (`ano`) ou
- por periodo mes/ano (`periodo = YYYY-MM`)

Esse filtro deve entrar na query principal e nas queries de opcoes de filtros.

## Variantes por modulo

Cada modulo pode ter filtro base proprio, mantendo o mesmo contrato global:

- Diario de Caixa: `ano`
- Auditoria Logs: `periodo`

## Observabilidade minima

- Resumo de listagem deve mostrar claramente o contexto filtrado.
- Para filtros base, preferir formato `x de y` quando fizer sentido:
  - `x`: resultado apos filtros de coluna
  - `y`: total do filtro base
