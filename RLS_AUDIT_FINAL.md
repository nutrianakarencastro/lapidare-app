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
- **🔧 PENDENTE** — identificado, aguarda Sprint 31.0B.3 ou B.4
- **⚠️ INCERTO** — conflito de ordem de aplicação; verificar no DB

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
| `ciclo_perfil` ALL + FK auth.users → pacientes | Sprint 31.0B.2 | ✅ 2026-06-13 |
| `ciclo_sintomas_diarios` ALL | Sprint 31.0B.2 | ✅ 2026-06-14 |
| `ciclo_periodos` ALL | Sprint 31.0B.2 | ✅ 2026-06-14 |

**Corrigidos antes da Sprint 31.0 (B.5.x):**

| tabela / recurso | corrigido por |
|---|---|
| `jornadas` SELECT + `paciente_marcar_meta()` | B.5.1 + sprint_jornada1 |
| `jornada_historico` SELECT | B.5.2 |
| `consultas` SELECT | B.5.2 |
| `checkin_templates` + `checkin_envios` + `checkin_agendamentos` | B.5.2 |
| `orientacoes_pacientes` + `orientacoes` + RPCs de orientação | B.5.1 + B.5.2 |
| `exames_avaliacoes` + `exames_arquivos` + `exames_pedidos` + Storage `exames` | B.5.2 |
| `pacientes` SELECT + UPDATE self | B.5.1 |
| `paciente_protocolos_ativos_resumo()` | Sprint 30.5 |

**Bug adicional corrigido durante Sprint 31.0B.2:**

| arquivo | correção | commit |
|---|---|---|
| `Ciclo.jsx` — `FormSintomas.salvar()` | `''` → `null` antes do upsert (CHECK constraints) | 41df942 |
| `Ciclo.jsx` — `ModalDia.salvarSangramento()` | Segundo caminho não coberto pelo sanitize | b9c9350 |
| `Ciclo.jsx` — bloco sangramento | Ocultar por estado clínico; nulificar campos dependentes | 2a85c78 |

---

## MÓDULOS PENDENTES — Sprint 31.0B.3 e B.4

### 🔧 Sprint 31.0B.3 — peso_registros, fotos_evolucao, feed_pratos, documentos

──────────────────────────────

**TABELA / RECURSO:** `peso_registros` (tabela) — SELECT

**SITUAÇÃO:** ❌ QUEBRADO
```sql
-- setup.sql ~L473
create policy peso_select_paciente on public.peso_registros
  for select using (paciente_id = auth.uid());
```
**RISCO:** Tela Progresso não carrega gráfico de peso nem medidas.

**CORREÇÃO:**
```sql
DROP POLICY IF EXISTS peso_select_paciente ON public.peso_registros;
CREATE POLICY peso_select_paciente ON public.peso_registros
  FOR SELECT USING (paciente_id = meu_paciente_id());
```
**MIGRATION:** SIM | **PRIORIDADE:** ⭐⭐⭐⭐

──────────────────────────────

**TABELA / RECURSO:** Storage `avaliacoes` (PDF Body3D) — SELECT

**SITUAÇÃO:** ❌ QUEBRADO
```sql
-- 2026-06-01d_peso_registros_pdf.sql L41
-- Path: {paciente_id}/{registro_id}.pdf
AND (storage.foldername(name))[1] = auth.uid()::text
```
**RISCO:** PDF de avaliação corporal não carrega.

**CORREÇÃO:**
```sql
DROP POLICY IF EXISTS "avaliacoes_paciente_select" ON storage.objects;
CREATE POLICY "avaliacoes_paciente_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'avaliacoes'
    AND (storage.foldername(name))[1] = meu_paciente_id()::text
  );
```
**MIGRATION:** SIM | **PRIORIDADE:** ⭐⭐⭐⭐

──────────────────────────────

**TABELA / RECURSO:** `fotos_evolucao` (tabela) — SELECT + INSERT + DELETE

**SITUAÇÃO:** ❌ QUEBRADO
```sql
-- setup.sql ~L568-585
create policy fotos_evolucao_select on public.fotos_evolucao
  for select using (paciente_id = auth.uid() or ...);
create policy fotos_evolucao_insert_paciente on public.fotos_evolucao
  for insert with check (paciente_id = auth.uid());
create policy fotos_evolucao_delete on public.fotos_evolucao
  for delete using (paciente_id = auth.uid() or ...);
```
**RISCO:** Fotos de evolução não carregam. Upload silenciosamente rejeitado.

**CORREÇÃO:**
```sql
DROP POLICY IF EXISTS fotos_evolucao_select ON public.fotos_evolucao;
DROP POLICY IF EXISTS fotos_evolucao_insert_paciente ON public.fotos_evolucao;
DROP POLICY IF EXISTS fotos_evolucao_delete ON public.fotos_evolucao;

CREATE POLICY fotos_evolucao_select ON public.fotos_evolucao
  FOR SELECT USING (
    paciente_id = meu_paciente_id()
    OR EXISTS (SELECT 1 FROM public.pacientes p WHERE p.id = paciente_id AND p.nutri_id = auth.uid())
  );
CREATE POLICY fotos_evolucao_insert_paciente ON public.fotos_evolucao
  FOR INSERT WITH CHECK (paciente_id = meu_paciente_id());
CREATE POLICY fotos_evolucao_delete ON public.fotos_evolucao
  FOR DELETE USING (
    paciente_id = meu_paciente_id()
    OR EXISTS (SELECT 1 FROM public.pacientes p WHERE p.id = paciente_id AND p.nutri_id = auth.uid())
  );
```
**MIGRATION:** SIM | **PRIORIDADE:** ⭐⭐⭐⭐

──────────────────────────────

**TABELA / RECURSO:** Storage `fotos_evolucao` — SELECT + INSERT + DELETE

**SITUAÇÃO:** ❌ QUEBRADO
```sql
-- 2026-05-22_evolucao_csv_links.sql L186-214
-- Path: {paciente_id}/arquivo.jpg
split_part(name, '/', 1) = auth.uid()::text
```
**RISCO:** Upload e download de fotos falham no Storage.

**CORREÇÃO:** substituir `auth.uid()::text` por `meu_paciente_id()::text` nas policies SELECT e INSERT da paciente.

**MIGRATION:** SIM | **PRIORIDADE:** ⭐⭐⭐⭐

──────────────────────────────

**TABELA / RECURSO:** `feed_pratos` — INSERT + DELETE

**SITUAÇÃO:** ❌ QUEBRADO
```sql
-- setup.sql ~L491-503
create policy feed_insert_paciente on public.feed_pratos
  for insert with check (paciente_id = auth.uid());
create policy feed_delete_paciente on public.feed_pratos
  for delete using (paciente_id = auth.uid());
```
**RISCO:** Paciente não consegue postar nem excluir fotos de refeição.

**CORREÇÃO:**
```sql
DROP POLICY IF EXISTS feed_insert_paciente ON public.feed_pratos;
DROP POLICY IF EXISTS feed_delete_paciente ON public.feed_pratos;
CREATE POLICY feed_insert_paciente ON public.feed_pratos
  FOR INSERT WITH CHECK (paciente_id = meu_paciente_id());
CREATE POLICY feed_delete_paciente ON public.feed_pratos
  FOR DELETE USING (paciente_id = meu_paciente_id());
```
**MIGRATION:** SIM | **PRIORIDADE:** ⭐⭐⭐

──────────────────────────────

**TABELA / RECURSO:** `documentos` (tabela) — SELECT

**SITUAÇÃO:** ❌ QUEBRADO
```sql
-- 2026-06-03_documentos.sql L63
CREATE POLICY "paciente_select_documentos" ON public.documentos
  FOR SELECT USING (paciente_id = auth.uid());
```
**RISCO:** Tela Documentos aparece vazia.

**CORREÇÃO:**
```sql
DROP POLICY IF EXISTS "paciente_select_documentos" ON public.documentos;
CREATE POLICY "paciente_select_documentos" ON public.documentos
  FOR SELECT USING (paciente_id = meu_paciente_id());
```
**MIGRATION:** SIM | **PRIORIDADE:** ⭐⭐⭐

──────────────────────────────

**TABELA / RECURSO:** Storage `documentos` — SELECT (paciente)

**SITUAÇÃO:** ❌ QUEBRADO
```sql
-- 2026-06-03_documentos.sql L109
AND EXISTS (
  SELECT 1 FROM public.documentos
  WHERE pdf_path = name AND paciente_id = auth.uid()  -- ← errado
)
```
**RISCO:** Download de PDF de documento falha mesmo se tabela for corrigida.

**CORREÇÃO:**
```sql
DROP POLICY IF EXISTS "documentos_paciente_select" ON storage.objects;
CREATE POLICY "documentos_paciente_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documentos'
    AND EXISTS (
      SELECT 1 FROM public.documentos
      WHERE pdf_path = name AND paciente_id = meu_paciente_id()
    )
  );
```
**MIGRATION:** SIM | **PRIORIDADE:** ⭐⭐⭐

──────────────────────────────

**TABELA / RECURSO:** `orientacoes_pacientes` SELECT (verificar)

**SITUAÇÃO:** ⚠️ VERIFICAR — B.5.2 corrigiu, mas `get_orientacoes_da_paciente()` RPC
foi corrigida em B.5.1. Homologar que orientações aparecem no app da paciente.

**MIGRATION:** NÃO (correção já aplicada) | **PRIORIDADE:** ⭐⭐⭐

──────────────────────────────

### 🔧 Sprint 31.0B.4 — RPCs de confirmação de consulta

──────────────────────────────

**TABELA / RECURSO:** `paciente_visualizar_consulta()` + `paciente_confirmar_consulta()` (RPCs)

**SITUAÇÃO:** ⚠️ INCERTO — conflito de ordem de aplicação

`2026-06-09_b5_1_rls_criticas.sql` corrigiu com `meu_paciente_id()`.
`2026-06-09_consultas_confirmacao.sql` (alfabeticamente posterior) pode ter reescrito com `auth.uid()`.

**VERIFICAÇÃO ANTES DA MIGRATION:**
```sql
SELECT routine_name,
  CASE
    WHEN routine_definition ILIKE '%meu_paciente_id()%' THEN '✅ OK'
    WHEN routine_definition ILIKE '%paciente_id = auth.uid()%' THEN '❌ QUEBRADO'
    ELSE '⚠️ checar manualmente'
  END AS status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('paciente_confirmar_consulta', 'paciente_visualizar_consulta');
```

**RISCO:** Confirmação de consulta e remarcação não funcionam para novas pacientes.

**MIGRATION:** SIM (condicional) | **PRIORIDADE:** ⭐⭐⭐⭐

──────────────────────────────

---

## TABELA-RESUMO ATUALIZADA

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
| `peso_registros` SELECT | 🔧 PENDENTE | 31.0B.3 |
| Storage `avaliacoes` SELECT | 🔧 PENDENTE | 31.0B.3 |
| `fotos_evolucao` SELECT+INSERT+DELETE | 🔧 PENDENTE | 31.0B.3 |
| Storage `fotos_evolucao` | 🔧 PENDENTE | 31.0B.3 |
| `feed_pratos` INSERT+DELETE | 🔧 PENDENTE | 31.0B.3 |
| `documentos` SELECT | 🔧 PENDENTE | 31.0B.3 |
| Storage `documentos` SELECT | 🔧 PENDENTE | 31.0B.3 |
| `orientacoes_pacientes` (verificar) | ⚠️ VERIFICAR | 31.0B.3 |
| `paciente_confirmar_consulta()` | ⚠️ INCERTO | 31.0B.4 |
| `paciente_visualizar_consulta()` | ⚠️ INCERTO | 31.0B.4 |

---

## PROGRESSO DA SPRINT 31.0

```
Fechados:    14 módulos  ████████████░░░░░░  64%
Pendentes:    8 módulos
Incertos:     3 módulos
─────────────────────────────────────────────
Total auditados: 25 módulos
```

---

_Atualizado em: 2026-06-14 | Sprint 31.0B.2 concluída_
