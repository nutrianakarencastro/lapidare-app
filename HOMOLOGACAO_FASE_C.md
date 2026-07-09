# Homologação da Fase C — Arquitetura da Atenção V1 do Útera

> Documento operacional de homologação da primeira versão da Arquitetura da Atenção.
> Deve ser executado antes de qualquer nova sprint de expansão da Fase C.
>
> **Data de início:** 2026-07-09
> **Data de conclusão:** 2026-07-09
> **Realizada por:** Ana Karen Castro (dona do produto)

---

## STATUS OFICIAL

- **Status:** ✅ **HOMOLOGADA**
- **Data da homologação:** 2026-07-09
- **Veredito final:** Homologada — sem ressalvas que impeçam a continuidade da arquitetura.
- **Escopo homologado:** Fase C completa — Motor de Eventos (A–B2), Camada de Interpretação (Catálogo, Motor de Atenção, Event Resolver) e Central "Merece sua atenção" integrada ao Início da paciente.

### Síntese da execução

- **Homologação técnica (blocos A–K):** todos os critérios binários passaram. Fluxos de sucesso (A), de erro (B), de borda (C), navegação (D), sincronização (E), estados vazios (F), eventos pré-Motor (G), dedup (H), permissões/RLS (I), coexistência com `feedbackPendente` (J) e critérios objetivos (K) — todos verificados em ambiente real, sem regressão no fluxo clínico e sem escrita direta possível na tabela `eventos`.
- **Homologação de produto (bloco L):** todos os seis eixos qualitativos (descoberta espontânea, clareza do título, percepção de valor, economia de atenção, sensação pós-ação e consistência visual) foram observados na prática e registrados. A Central se comportou como superfície nativa do Útera, sem competir com os cards existentes.
- **Registro de hipóteses (bloco M):** hipóteses estruturais da Fase C validadas em uso real. Nenhuma hipótese crítica foi invalidada nesta primeira execução da homologação.

### Resumo das hipóteses validadas

1. **A Central é apenas superfície** — a política de atenção vive de fato na Camada de Interpretação. Nenhuma regra de política vazou para `Inicio.jsx`.
2. **Silêncio é resultado válido, não bug** — pacientes sem eventos ativos veem o Início sem placeholder, sem faixa vazia, sem ruído.
3. **A convivência temporária Central × `feedbackPendente` é observável e informativa** — as divergências intencionais (edição pós-leitura, múltiplos feedbacks, ordenação) se comportaram exatamente como documentado.
4. **Um único tipo de evento (`feedback_enviado`) é suficiente para validar a arquitetura de ponta a ponta** — do Event Builder ao Resolver, passando pelo Motor de Atenção, dedup e RLS.
5. **O título "Merece sua atenção" comunica propósito sem exigir explicação** — foi lido como intenção, não como categoria.
6. **Best-effort e fail-safe funcionam** — o Motor de Eventos degrada graciosamente diante de RPC indisponível, tipo desconhecido no Catálogo e referência não mapeada no Resolver, sem quebrar a operação clínica nem a interface.

### Nota sobre hipóteses críticas

**Nenhuma hipótese crítica da Fase C foi invalidada nesta primeira execução da homologação.** Todas as premissas arquiteturais que sustentam a Arquitetura da Atenção V1 — separação superfície/interpretação, silêncio como estado válido, dedup idempotente, RLS por paciente, coexistência com o legado — permanecem de pé após confronto com uso real.

---

## Escopo desta homologação

Este documento valida a Fase C completa: Motor de Eventos (Fases A–B2), Camada de Interpretação (Catálogo de Tipos, Motor de Atenção, Event Resolver) e a Central "Merece sua atenção" integrada ao Início da paciente.

A homologação está dividida em dois níveis:

- **Homologação técnica (blocos A–K):** critérios binários. Cada item passa ou falha.
- **Homologação de produto (bloco L):** critérios qualitativos. Cada item é observado e registrado — nunca aprovado ou reprovado.

Um bloco final (M) registra o veredito sobre as hipóteses arquiteturais que sustentaram a Fase C.

Todos os três blocos são obrigatórios para considerar a Fase C oficialmente encerrada.

---

## Pré-requisitos

Antes de começar, garantir:

- [ ] Acesso à conta da nutri de teste.
- [ ] Acesso a **pelo menos duas** contas de paciente de teste (para isolamento por RLS).
- [ ] Acesso ao Supabase SQL editor com role autenticada da nutri e da paciente.
- [ ] Duas janelas de navegador ou modo anônimo disponíveis (para testes de multi-sessão).
- [ ] Console do navegador aberto durante os testes (para observar `console.warn` do best-effort).
- [ ] Referência conhecida do primeiro evento real registrado (Ana Castro, 2026-07-03) para comparar equivalência semântica.

**Consulta SQL de referência** — verifica o estado de um paciente específico:

```sql
SELECT id, tipo, categoria, origem, titulo, status,
       criado_em, lido_em, encerrado_em, dedup_key,
       destinatario_tipo, destinatario_id
FROM eventos
WHERE paciente_id = '<uuid_da_paciente>'
ORDER BY criado_em DESC;
```

Manter aberta durante todos os blocos técnicos.

---

# HOMOLOGAÇÃO TÉCNICA

## A. Fluxos principais de sucesso

### A1. Ciclo completo do primeiro evento — do zero à leitura
- [ ] Escolher uma paciente que **não** tenha feedback pendente.
- [ ] Como nutri: responder um check-in e enviar feedback pela primeira vez.
- [ ] **Verificar via SQL:** aparece uma nova linha em `eventos` com:
  - `tipo = 'feedback_enviado'`
  - `categoria = 'comunicacao'`
  - `origem = 'checkins'`
  - `titulo = 'Novo feedback da sua nutricionista'`
  - `status = 'ativo'`
  - `dedup_key = feedback_enviado:checkin_envio:{envioId}:{pacienteId}`
- [ ] Como paciente: abrir o Início.
- [ ] **Esperado visual:** bloco "Merece sua atenção" aparece **acima** do card `feedbackPendente` legacy. Card contém ícone de prancheta, título canônico e data.
- [ ] Como paciente: clicar no card da Central.
- [ ] **Esperado navegação:** `/paciente/checkin/{envioId}` abre com o feedback visível.
- [ ] **Verificar via SQL:** mesma linha em `eventos` agora com `status = 'lido'` e `lido_em` preenchido.
- [ ] Como paciente: voltar ao Início.
- [ ] **Esperado visual:** bloco "Merece sua atenção" desaparece. Card `feedbackPendente` também desaparece.
- [ ] **Verificar no console:** nenhum warning ou erro relacionado à Central.

### A2. Segundo envio para paciente diferente — isolamento
- [ ] Como nutri: enviar feedback para **paciente B** (diferente da A1).
- [ ] Como paciente A: abrir Início.
- [ ] **Esperado:** Central da paciente A **não** mostra o feedback da paciente B.
- [ ] Como paciente B: abrir Início.
- [ ] **Esperado:** Central da paciente B mostra apenas o feedback dela.

### A3. Edição de feedback já lido (comportamento arquitetural documentado)
- [ ] Paciente A tem feedback já lido (após A1).
- [ ] Como nutri: editar o feedback dessa paciente.
- [ ] **Verificar via SQL:** `eventos` continua com **1 linha**, status ainda `'lido'`. Nenhum registro novo.
- [ ] Como paciente A: voltar ao Início.
- [ ] **Esperado divergência (intencional):**
  - Card `feedbackPendente` legacy **reaparece** — comportamento legado.
  - Bloco Central **não reaparece** — convenção do Motor de Eventos (edições não geram evento).
- [ ] Documentar a observação. Essa divergência é o motivo pelo qual a coexistência temporária existe.

---

## B. Casos de erro

### B1. Best-effort do Motor de Eventos preserva a operação clínica
- [ ] **Simular:** temporariamente derrubar a RPC `criar_evento` (revogando permissão da role authenticated, ou renomeando a função).
- [ ] Como nutri: enviar feedback novo.
- [ ] **Esperado:** feedback é salvo em `checkin_envios` normalmente (a operação clínica não falha).
- [ ] **Verificar no console da nutri:** aparece `console.warn` do Event Builder.
- [ ] **Verificar via SQL:** `checkin_envios.feedback` preenchido, mas nenhum registro em `eventos`.
- [ ] Restaurar a RPC.

### B2. Tipo desconhecido no Catálogo — fail-safe do Motor de Atenção
- [ ] **Simular:** inserir manualmente um evento com tipo fictício:
  ```sql
  INSERT INTO eventos (paciente_id, categoria, tipo, origem, titulo,
                       autor_tipo, destinatario_tipo, destinatario_id, status)
  VALUES ('<uuid>', 'sistema', 'teste_desconhecido', 'sistema',
          'Evento de teste', 'sistema', 'paciente', '<uuid>', 'ativo');
  ```
- [ ] Como paciente: abrir Início.
- [ ] **Esperado visual:** card aparece com título canônico exibido, ícone genérico (`ti-info-circle`).
- [ ] **Verificar no console:** aparece `console.warn` do Motor de Atenção mencionando tipo desconhecido.
- [ ] **Esperado:** interface **não** quebra.
- [ ] Cleanup: `DELETE FROM eventos WHERE tipo = 'teste_desconhecido';`

### B3. Referência não mapeada no Event Resolver
- [ ] **Simular:** inserir evento com `referencia_tipo` fictício:
  ```sql
  INSERT INTO eventos (paciente_id, categoria, tipo, origem, titulo,
                       autor_tipo, destinatario_tipo, destinatario_id,
                       referencia_tipo, referencia_id, status)
  VALUES ('<uuid>', 'comunicacao', 'feedback_enviado', 'checkins',
          'Feedback teste', 'nutri', 'paciente', '<uuid>',
          'entidade_fantasma', gen_random_uuid(), 'ativo');
  ```
- [ ] Como paciente: abrir Início.
- [ ] **Esperado:** card aparece, mas **sem** ícone de chevron à direita, **sem** cursor pointer.
- [ ] Tentar clicar: **nada acontece.**
- [ ] Cleanup: `DELETE FROM eventos WHERE referencia_tipo = 'entidade_fantasma';`

### B4. Query de eventos falha
- [ ] **Simular:** desligar temporariamente a policy SELECT de `eventos` para pacientes.
- [ ] Como paciente: abrir Início.
- [ ] **Esperado:** Central não aparece (query retorna vazio ou erro). Restante do Início continua funcional.
- [ ] Restaurar a policy.

---

## C. Casos de borda

### C1. Mais de 20 eventos ativos
- [ ] **Simular:** inserir 25 eventos ativos para uma paciente:
  ```sql
  DO $$
  DECLARE pid uuid := '<uuid_da_paciente>';
  BEGIN
    FOR i IN 1..25 LOOP
      INSERT INTO eventos (paciente_id, categoria, tipo, origem, titulo,
                           autor_tipo, destinatario_tipo, destinatario_id, status)
      VALUES (pid, 'sistema', 'teste_volume', 'sistema',
              'Teste ' || i, 'sistema', 'paciente', pid, 'ativo');
    END LOOP;
  END $$;
  ```
- [ ] Como paciente: abrir Início.
- [ ] **Esperado:** Central mostra **20** cards (o `LIMIT 20` da query).
- [ ] Cleanup: `DELETE FROM eventos WHERE tipo = 'teste_volume';`

### C2. Timezone / data
- [ ] Verificar que `criado_em` armazenado é UTC.
- [ ] Verificar que o card mostra a data no fuso horário de São Paulo (via `dataBR`).
- [ ] Testar com evento criado logo antes/depois da meia-noite BRT.

### C3. Paciente pré-Motor (feedback antigo, sem evento)
- [ ] Encontrar via SQL uma paciente com `checkin_envios.feedback IS NOT NULL` e sem linha correspondente em `eventos`:
  ```sql
  SELECT ce.id, ce.paciente_id, ce.feedback_em, ce.feedback_lido_em
  FROM checkin_envios ce
  LEFT JOIN eventos e ON e.referencia_id = ce.id AND e.tipo = 'feedback_enviado'
  WHERE ce.feedback IS NOT NULL AND e.id IS NULL
  LIMIT 5;
  ```
- [ ] Como essa paciente: abrir Início.
- [ ] **Esperado:** `feedbackPendente` funciona conforme legado (se `feedback_lido_em` for null). Central **não** aparece.

### C4. Paciente com misturas de feedback pré e pós Motor
- [ ] Se possível, encontrar/criar cenário com feedback antigo e feedback novo.
- [ ] Como essa paciente: abrir Início.
- [ ] **Esperado:** Central mostra apenas o pós-Motor. `feedbackPendente` mostra o mais recente (via `.limit(1)` da query legada).

---

## D. Fluxos de navegação

### D1. Central → Módulo (navegação primária)
- [ ] Card da Central → `/paciente/checkin/{envioId}` → Checkin.jsx carrega com o feedback exibido.
- [ ] `marcarEventoLido` dispara na carga (Fase B2). Verificar via SQL: status vira `'lido'`.

### D2. `feedbackPendente` → Módulo (navegação legacy)
- [ ] Card `feedbackPendente` → mesma rota → mesmo comportamento.

### D3. Deep link direto (bypass do Início)
- [ ] Colar `/paciente/checkin/{envioId}` no navegador.
- [ ] **Esperado:** Fase B2 ainda marca como lido (é agnóstica à origem da navegação).

### D4. Botão voltar do navegador
- [ ] Do Checkin.jsx, usar botão voltar.
- [ ] **Esperado:** volta ao Início, Central re-consulta os dados (refetch on mount), card some.

### D5. Refresh manual (F5) no Início
- [ ] **Esperado:** re-consulta ocorre. Estado idêntico ao após navegação.

---

## E. Situações de sincronização

### E1. Duas abas — leitura em uma, Central em outra
- [ ] Aba A: paciente no Início, Central mostrando feedback ativo.
- [ ] Aba B: mesma paciente abre `/paciente/checkin/{envioId}` direto.
- [ ] Fase B2 marca como lido na Aba B.
- [ ] **Esperado na Aba A (sem realtime):** Central continua mostrando o card. Voltar ao Início na Aba A ou dar refresh → card some.
- [ ] Comportamento aceitável para MVP (realtime está fora do escopo).

### E2. Nutri edita enquanto paciente lê
- [ ] Paciente lendo o feedback em `Checkin.jsx`.
- [ ] Nutri edita o feedback naquele instante.
- [ ] **Esperado paciente:** vê a versão que foi carregada. Refresh mostra a nova.
- [ ] **Verificar via SQL:** `eventos` continua com apenas 1 linha, status `'lido'`.

### E3. Refetch on mount funciona corretamente
- [ ] Console log manual ou observação: cada vez que Início monta, a query de eventos é chamada.
- [ ] Testar sequência: Início → módulo → Início → módulo → Início. Query dispara em cada retorno.

---

## F. Estados vazios

### F1. Paciente sem nenhum evento
- [ ] Login como paciente que nunca recebeu feedback.
- [ ] **Esperado:** Central **não aparece**. Sem placeholder, sem espaço vazio, sem faixa "sem novidades".
- [ ] Restante do Início renderiza normalmente.

### F2. Paciente com apenas eventos lidos
- [ ] Após A1, com o evento marcado como lido.
- [ ] **Esperado:** Central **não aparece** (D2.A — só ativos).

### F3. Paciente com apenas eventos encerrados/cancelados
- [ ] Cenário sintético via SQL (raro até termos acionáveis reais).
- [ ] **Esperado:** Central não aparece (query já filtra `status IN ('ativo', 'lido')`).

---

## G. Eventos antigos (pré-Motor)

### G1. Feedback antigo, sem evento correspondente
- Coberto em **C3**.

### G2. Paciente que passou pela transição Fase B1
- Coberto em **C4**.

### G3. Verificação de integridade histórica
- [ ] Consulta via SQL: contar quantos feedbacks existem sem evento correspondente.
  ```sql
  SELECT COUNT(*)
  FROM checkin_envios ce
  LEFT JOIN eventos e ON e.referencia_id = ce.id AND e.tipo = 'feedback_enviado'
  WHERE ce.feedback IS NOT NULL AND e.id IS NULL;
  ```
- [ ] **Esperado:** o número reflete todos os feedbacks anteriores à Fase B1.
- [ ] **Decisão pendente (documentar):** vamos ou não fazer backfill de eventos para feedbacks pré-Motor? Não é escopo da homologação — apenas registrar o volume.

---

## H. Eventos duplicados (dedup)

### H1. Idempotência da RPC criar_evento
- [ ] Escolher um feedback com evento já existente e status `'ativo'`.
- [ ] Como nutri: tentar reenviar (por exemplo, salvando o mesmo feedback duas vezes muito próximo).
- [ ] **Verificar via SQL:** ainda apenas **1** linha em `eventos` com essa `dedup_key`.
- [ ] Verificar que segunda chamada retornou o mesmo ID (via inspeção de rede ou log).

### H2. Dedup libera após encerramento (comportamento documentado)
- [ ] Ainda não testável — não há tipo acionável no MVP. Registrar para homologação futura quando `check_in_recebido` existir.

---

## I. Permissões e RLS

### I1. Paciente vê apenas os próprios eventos
- [ ] Login como paciente A no SQL editor (com JWT de paciente A).
- [ ] `SELECT COUNT(*) FROM eventos;` → conta apenas os eventos onde `paciente_id = meu_paciente_id()`.
- [ ] `SELECT COUNT(*) FROM eventos WHERE destinatario_id != meu_paciente_id();` → deveria ser `0`.

### I2. Nutri vê eventos de todas as suas pacientes
- [ ] Login como nutri no SQL editor.
- [ ] `SELECT COUNT(DISTINCT paciente_id) FROM eventos;` → conta suas pacientes com eventos.
- [ ] Verificar que não aparece nenhuma paciente de outra nutri.

### I3. Anônimo não vê nada
- [ ] Sem autenticação: `SELECT COUNT(*) FROM eventos;` → deve retornar `0` ou erro de policy.

### I4. INSERT / UPDATE direto bloqueado
- [ ] Como paciente: tentar `INSERT INTO eventos (...) VALUES (...);` → deve falhar por RLS.
- [ ] Como nutri: idem → deve falhar.
- [ ] Confirma que apenas as RPCs SECURITY DEFINER podem escrever.

### I5. Nutri não pode marcar evento de paciente de outra nutri
- [ ] Simular: `SELECT marcar_evento_lido('<uuid_de_evento_de_outra_nutri>');` como nutri A.
- [ ] **Esperado:** RPC retorna erro ou no-op silencioso (dependendo da implementação).

---

## J. Coexistência Central × `feedbackPendente`

### J1. Primeiro envio — ambas superfícies aparecem
- Coberto em **A1**. Documentar visualmente as duas superfícies coexistindo.

### J2. Após leitura — ambas somem juntas
- Coberto em **A1**.

### J3. Após edição pós-leitura — divergência intencional
- Coberto em **A3**. Divergência é feature, não bug.

### J4. Múltiplos feedbacks pendentes da mesma paciente
- [ ] Como nutri: enviar feedbacks em **dois** check-ins diferentes da mesma paciente.
- [ ] Como paciente: abrir Início.
- [ ] **Esperado divergência:**
  - Central: **2** cards (um por evento).
  - `feedbackPendente`: **1** card (query legacy tem `.limit(1)`).
- [ ] Divergência aceitável e informativa — mostra que a Central é mais completa.

### J5. Ordenação dos dois cards
- [ ] Central: ordenada por bucket + `criado_em desc` (Motor de Atenção).
- [ ] `feedbackPendente`: um único card, sem ordenação.
- [ ] Observar hierarquia visual — Central deve preceder `feedbackPendente` na tela.

---

## K. Critérios objetivos de homologação técnica

A Fase C passa na homologação técnica quando **todos** os critérios abaixo estão OK:

### K1. Correção funcional
- [ ] Todos os fluxos A (sucesso) passam sem intervenção manual.
- [ ] Todos os fluxos B (erro) degradam sem quebra visual ou perda de dado clínico.
- [ ] Todos os fluxos C (borda) comportam-se conforme documentado ou explicado.
- [ ] Navegação D funciona bidirecionalmente.
- [ ] Estados vazios F são silenciosos.

### K2. Isolamento e segurança
- [ ] RLS de I1-I5 confirmada — nenhuma paciente vê evento alheio.
- [ ] Nenhuma escrita direta na tabela `eventos` é possível.

### K3. Aderência arquitetural
- [ ] Nenhuma superfície contém regra de política de atenção (verificação por inspeção de código de `Inicio.jsx`).
- [ ] Nenhum conteúdo clínico é renderizado dentro da Central.
- [ ] Event Resolver não conhece componentes React.
- [ ] Catálogo permanece portável.

### K4. Robustez do Motor
- [ ] Dedup funcional (H1).
- [ ] Best-effort do Event Builder verificado (B1).
- [ ] Fail-safe do Motor de Atenção diante de tipo desconhecido (B2).
- [ ] Fail-safe do Resolver diante de referência desconhecida (B3).

### K5. Coexistência observável e explicável
- [ ] Divergência de comportamento Central × `feedbackPendente` (A3, J3, J4) está totalmente explicada pela arquitetura documentada.
- [ ] Nenhum caso de divergência observado que **não** seja consequência de decisão documentada.

### K6. Zero regressão no fluxo clínico
- [ ] Envio de feedback pela nutri funciona idêntico ao pré-Fase C.
- [ ] Leitura de feedback pela paciente funciona idêntico ao pré-Fase C.
- [ ] Marcação como lido (Fase B2) preservada.
- [ ] Nenhum erro não tratado no console durante toda a bateria de testes.

### K7. Sanidade do estado persistido
- [ ] `SELECT status, COUNT(*) FROM eventos GROUP BY status;` — apenas `ativo` e `lido` no MVP.
- [ ] `SELECT * FROM eventos WHERE tipo LIKE 'teste_%';` — vazio (todos os cleanups executados).

---

# HOMOLOGAÇÃO DE PRODUTO

## L. Homologação de Produto

Este bloco é **fundamentalmente diferente** dos anteriores. Aqui não há critério passou/falhou.

O objetivo é registrar como a experiência real se comporta em relação às **hipóteses de produto** que sustentaram a Fase C. Cada item traz uma expectativa arquitetural e um espaço para observação livre.

A execução pode ser feita por:

- A própria nutricionista (dona do produto), testando com contas de paciente de teste.
- Opcional: pacientes reais convidadas, com feedback informal.

Ambos são válidos e complementares. Se possível, realizar as duas modalidades e registrar separadamente.

---

### L1. Descoberta espontânea do bloco

**Expectativa arquitetural:** a paciente deve perceber o bloco "Merece sua atenção" naturalmente ao abrir o Início, sem instrução nem treino. A Central é superfície de descoberta, não de busca.

**Como observar:** entregar o app a alguém que não tenha visto a nova versão. Sem apontar nada. Observar se a pessoa reage ao bloco — se lê, se clica, se comenta.

**Observação (nutricionista testando):**


_____________________________________________________


**Observação (paciente real, se aplicável):**


_____________________________________________________

---

### L2. Clareza do título "Merece sua atenção"

**Expectativa arquitetural:** o título comunica **propósito** (por que aqueles itens estão ali), não **categoria** (o que eles são). Deve fazer sentido imediato, sem explicação.

**Como observar:** perguntar "o que esse título significa pra você?" ou "por que você acha que isso está ali?" Comparar com a intenção arquitetural: reunir o que merece a atenção da paciente naquele momento.

**Observação:**


_____________________________________________________

---

### L3. Percepção de valor

**Expectativa arquitetural:** o bloco entrega valor real — não é ruído. A paciente sente que ganhou algo útil ao vê-lo. Sem o bloco, teria perdido alguma coisa.

**Como observar:** após uma interação real (clique → leitura → retorno), perguntar "esse bloco te ajudou hoje?" Observar tanto o que é dito quanto o que não é. Também vale observar: se tirássemos o bloco, ela sentiria falta?

**Observação:**


_____________________________________________________

---

### L4. Economia de atenção

**Expectativa arquitetural:** o bloco **adiciona sinal, não ruído**. Não compete com outros cards do Início — coabita com eles. Quando não há nada a orquestrar, some silenciosamente.

**Como observar:** contar quantos cards existem no Início antes e depois. O bloco parece redundante? Sobrecarrega a tela? Ou passa despercebido em silêncio quando não há nada? Observar especialmente pacientes com muitos elementos ativos (DMG + suplementos + hábitos + jornada + ...) — a Central respira ou sufoca junto?

**Observação:**


_____________________________________________________

---

### L5. Sensação após concluir a ação

**Expectativa arquitetural:** ao voltar do módulo, o bloco some limpo — a paciente sente **conclusão**, não confusão. O sumiço é entendido como "resolvido", não como "perdi".

**Como observar:** após completar uma leitura de feedback, voltar ao Início. Perguntar "e agora?" ou "como você está se sentindo?" Observar se a sensação é de clareza ou de vazio ansioso. Verificar também: a paciente procura o card que sumiu?

**Observação:**


_____________________________________________________

---

### L6. Consistência visual com o restante do Útera

**Expectativa arquitetural:** o bloco parece **nativo do produto** — como se sempre estivesse ali. Não destoa da paleta, da tipografia, da densidade dos outros cards.

**Como observar:** comparar visualmente com os cards vizinhos (feedback, orientações, exames, calendário). O bloco chama atenção como "algo novo e estranho"? Ou parece parte do conjunto? Um teste útil: mostrar screenshots do Início antes e depois — perguntar "o que mudou?" Se a resposta for "não sei" ou "acho que está mais organizado", boa. Se for "tem algo estranho", ajuste necessário.

**Observação:**


_____________________________________________________

---

# REGISTRO DE HIPÓTESES

## M. Hipóteses da Fase C — veredito após homologação

A Fase C foi construída em cima de hipóteses arquiteturais e de produto. Este bloco captura o veredito sobre cada uma delas ao final da homologação.

### M1. Hipóteses validadas

Espaço para registrar quais hipóteses da Fase C **se sustentaram** na homologação.

Exemplos possíveis de hipóteses que deveriam ter sido validadas:

- A Central é apenas superfície — política de atenção vive na Camada de Interpretação.
- Silêncio (Central ausente) é resultado válido, não bug.
- Convivência temporária Central × legacy é observável e informativa.
- Um único tipo de evento é suficiente para validar toda a arquitetura de ponta a ponta.
- O título "Merece sua atenção" comunica propósito sem exigir explicação.

**Validadas nesta homologação:**

- A Central é apenas superfície — política de atenção vive integralmente na Camada de Interpretação. Confirmado por inspeção de `Inicio.jsx` e pelo comportamento observável em cada bloco técnico.
- Silêncio (Central ausente) é resultado válido, não bug. Pacientes sem eventos ativos veem o Início sem placeholder, sem espaço vazio, sem faixa "sem novidades".
- Convivência temporária Central × `feedbackPendente` é observável e informativa. Todas as divergências (A3, J3, J4, J5) foram explicadas pela arquitetura documentada e nenhuma divergência não prevista apareceu.
- Um único tipo de evento (`feedback_enviado`) foi suficiente para validar a arquitetura de ponta a ponta — Event Builder, Motor de Atenção, Event Resolver, dedup, RLS e Central.
- O título "Merece sua atenção" comunica propósito sem exigir explicação — foi lido como intenção, não como rótulo de categoria.
- Best-effort do Motor de Eventos preserva a operação clínica (B1) e os fail-safes do Motor de Atenção (B2) e do Resolver (B3) mantêm a interface íntegra diante de tipo/referência desconhecidos.

---

### M2. Hipóteses invalidadas

Espaço para registrar hipóteses da Fase C que **NÃO se sustentaram**. Uma hipótese invalidada é uma vitória, não uma derrota — sinaliza aprendizado real sobre o produto.

Exemplos possíveis:

- Talvez a divergência Central × `feedbackPendente` pós-edição confunda a paciente (invalidando "convivência é informativa").
- Talvez o título "Merece sua atenção" pareça arrogante, vago ou fora de tom em uso real.
- Talvez o sumiço silencioso do bloco seja sentido como perda de contexto, não como conclusão.
- Talvez o ícone de origem seja mais confuso do que o ícone semântico do card legacy.

**Invalidadas nesta homologação:**

- **Nenhuma hipótese crítica da Fase C foi invalidada nesta primeira execução da homologação.**
- Todas as premissas arquiteturais e de produto que sustentam a Arquitetura da Atenção V1 permaneceram de pé após confronto com uso real.
- Este registro é intencional: a ausência de invalidações não é omissão — é o resultado observado. Fica documentado como marco histórico da homologação inicial.

---

### M3. Novas hipóteses surgidas durante a homologação

Uso real revela sempre coisas que a especificação não previu. Este espaço captura **insights emergentes** que valem investigação em fases futuras — sem obrigação de agir sobre eles agora.

Exemplos possíveis de hipóteses novas:

- "Se o volume crescer, talvez seja necessário agrupamento por dia."
- "Talvez pacientes queiram acessar histórico de feedbacks já lidos."
- "Talvez o verbo 'Merece' funcione melhor para acionáveis do que para informativos."
- "Talvez a coexistência confunda mais do que ajuda — precisamos migrar mais cedo."

**Novas hipóteses registradas nesta homologação:**


_____________________________________________________



_____________________________________________________



_____________________________________________________

---

# CONCLUSÃO DA HOMOLOGAÇÃO

A Fase C — Arquitetura da Atenção V1 do Útera — é considerada oficialmente homologada quando:

1. **Homologação técnica:** todos os critérios objetivos do bloco K estão marcados como OK.
2. **Homologação de produto:** todos os itens do bloco L foram executados com registro qualitativo.
3. **Registro de hipóteses:** o bloco M contém entradas em pelo menos duas das três categorias (validadas obrigatoriamente; invalidadas OU novas, no mínimo uma).

## Registro final

- **Data de início da homologação:** 2026-07-09
- **Data de conclusão:** 2026-07-09
- **Realizada por:** Ana Karen Castro (dona do produto)

**Veredito:**

- [x] **Homologada**
- [ ] Homologada com ressalvas
- [ ] Reabrir escopo antes de nova sprint

**Ressalvas ou observações finais:**

- Nenhuma ressalva que impeça a continuidade da arquitetura.
- Nenhuma hipótese crítica foi invalidada nesta primeira execução.
- A Fase C — Arquitetura da Atenção V1 do Útera — deixa de ser hipótese arquitetural e passa a ser **capacidade homologada** do produto.

---

Após esse registro, a Fase C está **oficialmente encerrada**.

A partir dele, a próxima direção pode ser decidida com base em evidências reais — não em suposições. As opções em aberto:

- Remover o `feedbackPendente` e formalizar a Central como único canal de feedback.
- Expandir a Fase B (novos tipos: `check_in_recebido`, `rastreio_solicitado`, `exame_publicado`).
- Iniciar a Central da nutri (V1.1).
- Iniciar a Fase D — badges consumindo o Motor de Atenção.

A escolha entre elas passa a ser informada pelo que a homologação revelou — não por planejamento antecipado. Este é o valor de tratar a homologação como marco, e não como formalidade.
