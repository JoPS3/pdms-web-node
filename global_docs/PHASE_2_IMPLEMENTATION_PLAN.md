# Phase 2: Explicit Token Propagation - Historical Note

Este documento era um plano de implementacao.

O contrato atual e mantido em:

- `global_docs/TOKEN_EVOLUTION_MULTI_DOMAIN.md`
- `global_docs/PDMS_APP_INTEGRATION.md`
- `global_docs/GATEWAY_ACCESS_MODEL.md`

## Estado

Phase 2 foi implementada e e mandatoria.

## Regras vigentes

1. Bearer-first para comunicacao entre servicos.
2. Gateway como fonte unica de validacao de sessao.
3. `connect.sid` apenas para compatibilidade de navegacao MPA.
4. Navegacao canonica das apps por `/apps/<app>` via gateway.

## Nota

Nao usar este ficheiro como especificacao ativa de desenvolvimento.
