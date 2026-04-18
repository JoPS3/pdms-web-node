# pdms-web-node

## Global docs index

### Destaques backend (2026-04-17 e 2026-04-18)

- Contrato de autenticacao e validacao de sessao consolidado no gateway e propagado para sub-apps.
- Contrato Bearer-first e refresh fallback definido para browser e service-to-service.
- Direcao de refatoracao de backend reforcada: separacao objetiva por camada (controller, service, dao, view).
- Regra de manutencao: ficheiros pequenos e coesos, com responsabilidade unica.
- Gateway e referencia atual de implementacao deste modelo (autenticacao, proxy canonico, validacao e refresh).

### Ativos (contrato atual)

- `GATEWAY_ACCESS_MODEL.md`: modelo atual de acesso, proxy canonico e autenticacao Bearer-first.
- `PDMS_APP_INTEGRATION.md`: contrato de integracao entre gateway e sub-apps (source of truth operacional).
- `CODE_CONVENTIONS.md`: convencoes de naming, estrutura de ficheiros e responsabilidades por camada (apendice ao contrato).
- `PDMS_SHELL_SPA_MPA_MODEL.md`: estrategia atual de shell SPA (menu/janelas) e apps MPA (funcionalidades reais), incluindo padrao canonico de views (`app/`, uma pasta por icon, `errors/`).
- `TOKEN_EVOLUTION_MULTI_DOMAIN.md`: estado atual da evolucao de tokens e roadmap Phase 3.
- `TABLE_CENTRIC_REFACTOR_BLUEPRINT.md`: blueprint estrutural por feature/tabela (controller/route/view por slice).

### Ativos (planeamento/reforco)

- `CSS_REFACTOR_LEVANTAMENTO_PROPOSTAS.md`: proposta de evolucao da arquitetura CSS.
- `TODO_CSS_ARCHITECTURE_VISUAL_BOARD.md`: quadro de execucao para normalizacao visual.

### Historicos / Deprecated

- `deprecated/DEPRECATED_PDMS_SINGLE_DOM_WINDOWS_STANDARD.md`: deprecated em 2026-04-18 (substituido por `PDMS_SHELL_SPA_MPA_MODEL.md`).
- `deprecated/DEPRECATED_CHECKLIST_SINGLE_DOM_MIGRATION.md`: deprecated em 2026-04-18 (substituido por `PDMS_SHELL_SPA_MPA_MODEL.md`).
- `PHASE_2_IMPLEMENTATION_PLAN.md`: referencia historica (nao usar como contrato atual).