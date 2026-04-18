# TODO GLOBAL - CSS Architecture Visual Board

Status: TODO
Owner: UI Architecture
Scope: Gateway, Usuarios, Mapas, Vendas, Compras, RH
Date: 2026-04-18

---

## 1) North Star

Create a coherent class system across apps with:
- minimal redundancy
- clear desktop vs mobile boundaries
- explicit common vs module-specific ownership
- clean HTML with predictable naming

Success target:
- 30% fewer duplicate class patterns
- 0 ambiguous naming collisions
- 100% pages classified by layer ownership

---

## 2) Visual Progress Board

Legend:
- [ ] not started
- [~] in progress
- [x] done

| Lane | Card | Module | Priority | State | Progress |
|---|---|---|---|---|---|
| Inventory | Shell desktop class map | gateway | High | [ ] | [----------] 0% |
| Inventory | Shell mobile class map | gateway | High | [ ] | [----------] 0% |
| Inventory | Auth + users class map | usuarios | High | [ ] | [----------] 0% |
| Inventory | Table/filter class map | mapas | High | [ ] | [----------] 0% |
| Inventory | Shell baseline class map | vendas | Medium | [ ] | [----------] 0% |
| Inventory | Shell baseline class map | compras | Medium | [ ] | [----------] 0% |
| Inventory | Shell baseline class map | rh | Medium | [ ] | [----------] 0% |
| Governance | Naming contract v1 | global | High | [ ] | [----------] 0% |
| Governance | Common vs specific matrix v1 | global | High | [ ] | [----------] 0% |
| Governance | Synonym dictionary | global | High | [ ] | [----------] 0% |
| Pilot | Desktop pilot mapping | tbd | High | [ ] | [----------] 0% |
| Pilot | Mobile pilot mapping | tbd | High | [ ] | [----------] 0% |

---

## 3) Architecture Layers Map

| Layer | Ownership | What belongs here | What does NOT belong here |
|---|---|---|---|
| Foundation | Global | tokens, base, typography, spacing scale, color scale | module visuals and business-specific variants |
| Layout | Global first | containers, regions, grids, stack flows | component internals |
| Shell Desktop | Global shell | window model, titlebar, desktop workspace patterns | mobile navigation flow |
| Shell Mobile | Global shell | touch-first nav, compact flow, mobile launcher patterns | desktop window mechanics |
| Common Components | Global | button, table, form controls, badges, alerts, pagination | one-off module visuals |
| Module Components | App module | visuals tied to one domain only | reusable cross-module patterns |
| Utilities | Strict global | very small stable helpers only | utility sprawl and one-off hacks |

---

## 4) Decision Matrix (Fast Rule)

Score each candidate class/pattern from 0 to 5.

| Criterion | 0 | 1 |
|---|---|---|
| Reuse in 2+ apps | no | yes |
| Stable over time | no | yes |
| Visual semantics, not business semantics | no | yes |
| Differences are cosmetic only | no | yes |
| No heavy module coupling | no | yes |

Decision:
- 4-5 => promote to common
- 2-3 => keep local and observe
- 0-1 => module-specific

---

## 5) Naming Contract Snapshot

Prefixes:
- l- layout
- c- component
- u- utility
- is- state

Examples:
- c-table
- c-table__toolbar
- c-table--compact
- is-open

Avoid:
- vague names (box, area2, wrapper-new)
- duplicated synonyms for same role
- classes with no visual responsibility

---

## 6) Redundancy Radar

Mark findings as they appear.

| Finding ID | Pattern type | Example class | Suspected duplicate of | Action |
|---|---|---|---|---|
| R-001 | synonym | TODO | TODO | merge to canonical |
| R-002 | wrapper-only | TODO | TODO | remove wrapper |
| R-003 | cosmetic split | TODO | TODO | convert to modifier |
| R-004 | local but reusable | TODO | TODO | promote candidate |

---

## 7) Sprint Plan (No-Code Strategy First)

### Phase A - Inventory
- [ ] map classes in gateway desktop shell
- [ ] map classes in gateway mobile shell
- [ ] map classes in usuarios auth and user management
- [ ] map classes in mapas table/filter pages
- [ ] map classes in vendas/compras/rh shell pages

Exit criteria:
- complete inventory sheet
- top duplicates identified

### Phase B - Governance
- [ ] freeze naming contract v1
- [ ] freeze common vs specific matrix v1
- [ ] publish synonym dictionary v1

Exit criteria:
- shared decision rules approved

### Phase C - Pilot
- [ ] choose one desktop pilot page
- [ ] choose one mobile pilot page
- [ ] produce old-to-new class mapping

Exit criteria:
- pilot plan approved with clear risk log

### Phase D - Rollout
- [ ] execute by small batches per module
- [ ] review with quality checklist
- [ ] track metrics by week

Exit criteria:
- measurable reduction in duplicates
- coherent naming across modules

---

## 8) Quality Gate Checklist (Per PR)

- [ ] every new class has one clear visual responsibility
- [ ] no synonym introduced for existing behavior
- [ ] desktop/mobile split justified by structure or interaction
- [ ] common layer used only with real cross-app reuse
- [ ] no utility added without global justification
- [ ] readability improved in HTML structure

---

## 9) Weekly KPI Dashboard

| KPI | Baseline | Target | Current |
|---|---|---|---|
| duplicate patterns | TODO | -30% | TODO |
| naming collisions | TODO | 0 | TODO |
| pages classified by layer | TODO | 100% | TODO |
| common component reuse rate | TODO | +25% | TODO |

---

## 10) Immediate Next Decisions

- [ ] confirm first desktop pilot page
- [ ] confirm first mobile pilot page
- [ ] confirm canonical naming for table/filter primitives
- [ ] confirm utility class allowlist

If all 4 decisions are approved, start execution planning for first implementation batch.
