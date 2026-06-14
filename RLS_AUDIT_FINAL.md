# RLS_AUDIT_FINAL.md
## Sprint 31.0 — Auditoria Definitiva de RLS Pós Sprint B.1
### Criado: 2026-06-13 | Atualizado: 2026-06-14 | Útera

---

## CONTEXTO

A Sprint B.1 (2026-06-09) introduziu a separação entre entidade clínica e entidade de acesso:

```
ANTES: pacientes.id = auth.uid()  (1:1 garantido)
DEPOIS: pacientes.auth_user_id = auth.uid()  (pacientes.id é UUID independente)
```

O padrão antigo `paciente_id = auth.uid()` em policies e RPCs quebra silenciosamente
para qualquer paciente criada após a Sprint B.1.

---

## LEGENDAS

- **✅ FECHADO** — corrigido e homologado
- **⚠️ INCERTO** — conflito de ordem de aplicação; verificar no DB antes de migrar

---

## MÓDULOS FECHADOS

| tabela / recurso | sprint de correção | homologado em |
|---|---|---|
| `suplementos` + `suplementos_logs` | hotfix 2026-06-12 | ✅ 2026-06-12 |
| `farmacias_parceiras` | hotfix 2026-06-12 | ✅ 2026-06-12 |
| `prescricoes` + Storage `prescricoes` | hotfix 2026-06-12 | ✅ 2026-06-12 |
| `alem_nutricao` | hotfix 2026-06-12 | ✅ 2026-06-12 |
| `habitos` SELECT | Sprint 31.0B.1 | ✅ 2026-06-13 |
| `habitos_logs` SELECT + WRITE | Sprint 31.0B.1 | ✅ 2026-06-13 |
| `paciente_marcar_habito_e_meta()` | Sprint 31.0B.1 | ✅ 2026-06-13 |
| `diario_glicemico` SELECT + INSERT + UPDATE | Sprint 31.0B.1 | ✅ 2026-06-13 |
| `paciente_modulos` SELECT | Sprint 31.0B.1 | ✅ 2026-06-13 |
| `intestino_logs` ALL | Sprint 31.0B.1 | ✅ 2026-06-13 |
| `intestino_rastreio_solicitacoes` SELECT + UPDATE | Sprint 31.0B.1 | ✅ 2026-06-13 |
| `ciclo_perfil` ALL + FK auth.users → pacientes | Sprint 31.0B.2 | ✅ 2026-06-14 |
| `ciclo_sintomas_diarios` ALL | Sprint 31.0B.2 | ✅ 2026-06-14 |
| `ciclo_periodos` ALL | Sprint 31.0B.2 | ✅ 2026-06-14 |
| `peso_registros` SELECT | Sprint 31.0B.3 | ✅ 2026-06-14 |
| Storage `avaliacoes` SELECT | Sprint 31.0B.3 | ✅ 2026-06-14 |
| `fotos_evolucao` SELECT + INSERT + DELETE | Sprint 31.0B.3 | ✅ 2026-06-14 |
| Storage `fotos_evolucao` SELECT + INSERT + DELETE | Sprint 31.0B.3 | ✅ 2026-06-14 |
| `feed_pratos` SELECT + INSERT + UPDATE + DELETE | Sprint 31.0B.3 | ✅ 2026-06-14 |
| Storage `fotos_pratos` SELECT + INSERT + DELETE | Sprint 31.0B.3 | ✅ 2026-06-14 |
| `documentos` SELECT | Sprint 31.0B.3 | ✅ 2026-06-14 |
| Storage `documentos` SELECT | Sprint 31.0B.3 | ✅ 2026-06-14 |
| `orientacoes_pacientes` + `orientacoes` + Storage + RPCs | B.5.1 + B.5.2 | ✅ 2026-06-14 |

**Corrigidos antes da Sprint 31.0 (B.5.x):**

| tabela / recurso | corrigido por |
|---|---|
| `jornadas` SELECT + `paciente_marcar_meta()` | B.5.1 + sprint_jornada1 |
| `jornada_historico` SELECT | B.5.2 |
| `consultas` SELECT | B.5.2 |
| `checkin_templates` + `checkin_envios` + `checkin_agendamentos` | B.5.2 |
| `exames_avaliacoes` + `exames_arquivos` + `exames_pedidos` + Storage `exames` | B.5.2 |
| `pacientes` SELECT + UPDATE self | B.5.1 |
| `paciente_protocolos_ativos_resumo()` | Sprint 30.5 |

**Bugs adicionais corrigidos durante Sprint 31.0B.2:**

| arquivo | correção | commit |
|---|---|---|
| `Ciclo.jsx` — `FormSintomas.salvar()` | `''` → `null` antes do upsert (CHECK constraints) | 41df942 |
| `Ciclo.jsx` — `ModalDia.salvarSangramento()` | Segundo caminho de escrita sem sanitize | b9c9350 |
| `Ciclo.jsx` — bloco sangramento | Ocultar por estado clínico; nulificar campos dependentes | 2a85c78 |

---

## PENDENTE — Sprint 31.0B.4

### ⚠️ RPCs de confirmação de consulta

**SITUAÇÃO:** INCERTO — conflito de ordem de aplicação entre migrations do mesmo dia.

`2026-06-09_b5_1_rls_criticas.sql` corrigiu `paciente_confirmar_consulta()` e
`paciente_visualizar_consulta()` com `meu_paciente_id()`.
`2026-06-09_consultas_confirmacao.sql` (alfabeticamente posterior, mesmo dia) pode ter
reescrito ambas com `paciente_id = auth.uid()`.

**Verificar antes de qualquer migration:**
```sql
SELECT routine_name,
  CASE
    WHEN routine_definition ILIKE '%meu_paciente_id()%'        THEN '✅ OK'
    WHEN routine_definition ILIKE '%paciente_id = auth.uid()%' THEN '❌ QUEBRADO'
    ELSE '⚠️ checar manualmente'
  END AS status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('paciente_confirmar_consulta', 'paciente_visualizar_consulta');
```

**RISCO:** Confirmação de presença e remarcação de consulta não funcionam para novas pacientes.

**MIGRATION:** SIM (condicional — aplicar somente se verificação retornar ❌ QUEBRADO)

---

## TABELA-RESUMO FINAL

| tabela / recurso | status | sprint |
|---|---|---|
| `suplementos` + `suplementos_logs` | ✅ FECHADO | hotfix 2026-06-12 |
| `farmacias_parceiras` | ✅ FECHADO | hotfix 2026-06-12 |
| `prescricoes` + Storage | ✅ FECHADO | hotfix 2026-06-12 |
| `alem_nutricao` | ✅ FECHADO | hotfix 2026-06-12 |
| `habitos` SELECT | ✅ FECHADO | 31.0B.1 |
| `habitos_logs` SELECT + WRITE | ✅ FECHADO | 31.0B.1 |
| `paciente_marcar_habito_e_meta()` | ✅ FECHADO | 31.0B.1 |
| `diario_glicemico` (3 policies) | ✅ FECHADO | 31.0B.1 |
| `paciente_modulos` SELECT | ✅ FECHADO | 31.0B.1 |
| `intestino_logs` ALL | ✅ FECHADO | 31.0B.1 |
| `intestino_rastreio_solicitacoes` SELECT+UPDATE | ✅ FECHADO | 31.0B.1 |
| `ciclo_perfil` ALL + FK | ✅ FECHADO | 31.0B.2 |
| `ciclo_sintomas_diarios` ALL | ✅ FECHADO | 31.0B.2 |
| `ciclo_periodos` ALL | ✅ FECHADO | 31.0B.2 |
| `peso_registros` SELECT | ✅ FECHADO | 31.0B.3 |
| Storage `avaliacoes` SELECT | ✅ FECHADO | 31.0B.3 |
| `fotos_evolucao` SELECT+INSERT+DELETE | ✅ FECHADO | 31.0B.3 |
| Storage `fotos_evolucao` | ✅ FECHADO | 31.0B.3 |
| `feed_pratos` SELECT+INSERT+UPDATE+DELETE | ✅ FECHADO | 31.0B.3 |
| Storage `fotos_pratos` | ✅ FECHADO | 31.0B.3 |
| `documentos` SELECT | ✅ FECHADO | 31.0B.3 |
| Storage `documentos` SELECT | ✅ FECHADO | 31.0B.3 |
| `orientacoes_pacientes` + RPCs | ✅ FECHADO | B.5.1 + B.5.2 |
| `paciente_confirmar_consulta()` | ⚠️ INCERTO | 31.0B.4 |
| `paciente_visualizar_consulta()` | ⚠️ INCERTO | 31.0B.4 |

---

## PROGRESSO DA SPRINT 31.0

```
Fechados:    23 módulos  ████████████████████░░  92%
Incertos:     2 módulos  (Sprint 31.0B.4 — RPCs de consulta)
─────────────────────────────────────────────────────────────
Total auditados: 25 módulos
```

---

_Atualizado em: 2026-06-14 | Sprint 31.0B.3 homologada_
