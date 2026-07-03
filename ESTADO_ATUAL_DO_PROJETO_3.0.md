# Estado Atual do Projeto — Útera 3.0

> Documento de continuidade para migração de contexto entre conversas.
> Atualizado após a conclusão da Fase B1 do Motor de Eventos.
> Data de referência: julho de 2026.

---

## 1. Visão Geral do Útera

O Útera é uma plataforma clínica de nutrição funcional desenvolvida por e para nutricionistas. Permite que a nutricionista acompanhe pacientes de forma estruturada, integrando dados clínicos, protocolos, check-ins, jornada terapêutica, biblioteca de conteúdos e comunicação.

O sistema tem dois perfis de uso:
- **Nutri:** painel completo de gestão de pacientes, protocolos e acompanhamento clínico
- **Paciente:** acesso ao próprio acompanhamento (check-ins, feedbacks, orientações, biblioteca)

O projeto está em produção ativa com pacientes reais.

---

## 2. Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Frontend | React (Vite), JavaScript (.jsx/.js) |
| Backend / banco | Supabase (PostgreSQL 17) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Hospedagem | Netlify |
| Repositório | GitHub (`nutrianakarencastro/lapidare-app`) |

Sem TypeScript. Sem framework de estado global. Sem ORM — queries via Supabase JS SDK.

---

## 3. Arquitetura de Usuários

```
auth.users (Supabase Auth)
    │
    ├── nutris (tabela public.nutris — id = auth.users.id)
    │
    └── pacientes (tabela public.pacientes)
            ├── id            UUID interno
            ├── auth_user_id  auth.users.id da paciente
            └── nutri_id      public.nutris.id (= auth.users.id da nutri)
```

**Funções auxiliares de RLS:**
- `meu_paciente_id()` — retorna `pacientes.id` para a paciente autenticada (`auth_user_id = auth.uid()`)
- Nutri é identificada diretamente por `nutri_id = auth.uid()`

---

## 4. Princípios Arquiteturais Consolidados

### Dados clínicos
- Nenhum registro clínico é apagado
- Existe estado ativo, estado respondido e estado encerrado/cancelado quando aplicável
- Histórico é sempre preservado
- Badges representam apenas pendências realmente ativas

### Motor de Eventos
- O evento é secundário ao dado clínico — o dado sempre salva primeiro
- O Motor de Eventos é best-effort: falhas nunca bloqueiam a operação principal
- Nenhum módulo clínico conhece canais de entrega (badge, push, e-mail)
- `origem` representa o módulo onde o acontecimento ocorreu — nunca a ação
- Ações são representadas pelo `tipo` do evento
- A navegação é resolvida pelo frontend via event resolver — sem deep links no banco

---

## 5. Estado dos Módulos

| Módulo | Estado |
|---|---|
| Autenticação e onboarding | Estável |
| Perfil e plano da paciente | Estável |
| Check-ins (envio, templates, agendamento, respostas) | Estável |
| Feedback da nutri sobre check-in | Estável + integrado ao Motor de Eventos |
| Follow-up (anotações privadas da nutri) | Estável |
| Orientações | Estável |
| Biblioteca (PDFs, áudios, ebooks) | Estável |
| Exames | Estável |
| Suplementação | Estável |
| Intestino / Rastreio intestinal | Estável |
| Jornada clínica | Estável |
| Consultas | Estável |
| Documentos da paciente | Estável |
| Condutas | Estável |
| Estratégias | Estável |
| Metas | Estável |
| Anamnese | Estável |
| Diário glicêmico | Estável |
| Hábitos | Estável |
| Ciclo hormonal | Estável |
| Módulos especiais | Estável |
| Motor de Eventos | Fase A e B1 concluídas (ver §6) |
| Central de Eventos | Não iniciada (Fase C) |
| Badges | Ainda consomem queries diretas às tabelas clínicas |

---

## 6. Motor de Eventos — Estado Atual

### Arquitetura em camadas

```
┌─────────────────────────────────────────────┐
│           DADOS CLÍNICOS                    │
│  checkin_envios · exames · orientacoes      │
│  suplementos · jornada · consultas · ...    │
│           (fonte de verdade)                │
└────────────────────┬────────────────────────┘
                     │ acontecimento ocorreu
                     ▼
┌─────────────────────────────────────────────┐
│         MOTOR DE EVENTOS                    │
│  tabela eventos · Event Builder             │
│  criar_evento() · marcar_evento_lido()      │
│  encerrar_evento()                          │
│       (projeção estruturada)                │
└────────────────────┬────────────────────────┘
                     │ consumido por
          ┌──────────┼──────────────┐
          ▼          ▼              ▼
       Badges   Central de     Push / E-mail
                 Eventos        / WhatsApp
              (Fase C)         (Fases E–G)
```

### O que está implementado

**Fase A — Infraestrutura (concluída)**
- Tabela `eventos` com schema completo
- 6 índices (paciente+status, destinatário, tipo, criado_em, referência, dedup_key parcial)
- 5 policies RLS (SELECT para paciente e nutri; INSERT/UPDATE bloqueados diretamente)
- RPC `criar_evento()` com deduplicação por `dedup_key`
- RPC `marcar_evento_lido()` com autorização interna
- RPC `encerrar_evento()` restrita à nutri responsável
- Event Builder (`src/lib/eventos.js`) com `criarEvento()`, `marcarEventoLido()`, `encerrarEvento()`

**Fase B1 — Integração com Feedback (concluída)**
- `criarEventoFeedback({ pacienteId, envioId, nutriId })` adicionada ao Event Builder
- Integração em `RespostasModal.salvarFeedback()` em `Checkins.jsx`
- Evento gerado apenas no primeiro envio de feedback (`!feedbackEm` capturado antes do update)
- Edições posteriores não geram novo evento
- Dedup por `feedback_enviado:checkin_envio:{envioId}:{pacienteId}`

### Schema da tabela `eventos`

```sql
id                UUID        PK
paciente_id       UUID        NOT NULL → pacientes(id)
categoria         TEXT        NOT NULL  -- 'comunicacao'|'saude'|'conteudo'|'jornada'|'sistema'
tipo              TEXT        NOT NULL  -- ex: 'feedback_enviado'
origem            TEXT        NOT NULL  -- ex: 'checkins'
referencia_tipo   TEXT                  -- ex: 'checkin_envio'
referencia_id     UUID
autor_tipo        TEXT        NOT NULL  -- 'nutri'|'paciente'|'sistema'|'ia'
autor_id          UUID
destinatario_tipo TEXT        NOT NULL  -- 'nutri'|'paciente'
destinatario_id   UUID
titulo            TEXT        NOT NULL
descricao         TEXT
metadata          JSONB       DEFAULT '{}'::jsonb
status            TEXT        DEFAULT 'ativo'  -- 'ativo'|'lido'|'encerrado'|'cancelado'
criado_em         TIMESTAMPTZ DEFAULT NOW()
lido_em           TIMESTAMPTZ
encerrado_em      TIMESTAMPTZ
dedup_key         TEXT
```

### Primeiro evento real no sistema

```
tipo:             feedback_enviado
paciente:         Ana Castro
origem:           checkins
status:           ativo
referencia_tipo:  checkin_envio
criado_em:        2026-07-03
```

---

## 7. Decisões Consolidadas

| Decisão | Resolução |
|---|---|
| Deep links no banco | Não — navegação resolvida pelo frontend via event resolver |
| Transações no evento | Não para MVP — best-effort após sucesso da operação principal |
| Triggers para eventos | Não para MVP — chamadas explícitas no fluxo existente |
| INSERT direto em `eventos` | Bloqueado por RLS — apenas via `criar_evento()` (SECURITY DEFINER) |
| `dedup_key` como UNIQUE constraint | Não — dedup gerenciado pela RPC, permitindo recriar após encerramento |
| `destinatarioId` para paciente | `pacientes.id` (UUID interno), não `auth.uid()` |
| Edições geram novo evento | Não — edições atualizam o dado clínico; apenas o primeiro envio gera evento |
| `origem` = módulo ou ação | Módulo onde ocorreu — ações são representadas pelo `tipo` |

---

## 8. Convenções do Motor de Eventos

A especificação completa está em `MOTOR_EVENTOS_CONVENCOES_V1.md` na raiz do projeto.

**Resumo das convenções críticas:**

```
categoria  → 'comunicacao' | 'saude' | 'conteudo' | 'jornada' | 'sistema'
tipo       → {substantivo}_{verbo_particípio}   ex: feedback_enviado
origem     → nome canônico do módulo, minúsculas, sem acentos
             ex: checkins · orientacoes · biblioteca · exames
dedup_key  → {tipo}:{referencia_tipo}:{referencia_id}:{destinatario_id}
titulo     → máx. 60 chars, sem pontuação final, fixo por tipo
metadata   → mínimo intencional, consistente por tipo
```

**Funções do Event Builder (`src/lib/eventos.js`):**
- `criarEvento(params)` — função base, não deve ser chamada diretamente pelos módulos
- `criarEventoFeedback({ pacienteId, envioId, nutriId })` — integração com check-ins
- `marcarEventoLido(eventoId)`
- `encerrarEvento(eventoId)`

---

## 9. Estrutura de Arquivos Relevante

```
src/
  lib/
    eventos.js          ← Event Builder (Motor de Eventos)
    supabase.js         ← cliente Supabase
    session.jsx         ← contexto de autenticação
    checkinDefault.js   ← lógica de templates de check-in
    checkinScheduler.js ← processamento de agendamentos
    utils.js            ← utilitários gerais
  app/
    nutri/
      Checkins.jsx      ← módulo de check-ins + feedback (integrado ao Motor de Eventos)
      Feed.jsx          ← feed da nutri
      PacientePerfil.jsx
      _FollowUp.jsx     ← anotações privadas da nutri
      _Exames.jsx
      _Orientacoes.jsx / _BibliotecaOrientacoes.jsx
      ... (demais módulos)
    paciente/
      Checkin.jsx       ← visualização de check-in e feedback pela paciente
      Inicio.jsx        ← tela inicial da paciente
      Feed.jsx
      ...
  components/
    PacienteLayout.jsx
    CheckinForm.jsx
    ...

supabase/
  migrations/
    2026-07-03_motor_eventos_fase_a.sql   ← infraestrutura do Motor de Eventos
    2026-07-03_checkin_envios_cancelamento.sql
    2026-07-03_rastreio_cancelamento.sql
    ... (migrations anteriores)

MOTOR_EVENTOS_CONVENCOES_V1.md  ← especificação oficial do Motor de Eventos
ESTADO_ATUAL_DO_PROJETO_3.0.md  ← este documento
```

---

## 10. Situação do Git

- Branch: `main`
- Sincronizado com `origin/main`
- Último commit: `feat: integrate feedback with eventos engine`
- Commits da sprint atual (Motor de Eventos):
  - `feat: add eventos engine fase a` — infraestrutura
  - `feat: integrate feedback with eventos engine` — Fase B1 + convenções

---

## 11. Roadmap do Motor de Eventos

```
Fase A  ✅  Infraestrutura (tabela, RLS, RPCs, Event Builder)
Fase B1 ✅  Integração com Feedback (primeiro evento real)
────────────────────────────────────────────────────
Fase B2 ◀── PRÓXIMA SPRINT
        Marcar evento como lido quando a paciente abre
        o feedback na tela de check-in (Checkin.jsx)
────────────────────────────────────────────────────
Fase C      Central de Eventos (interface de listagem)
Fase D      Badges consumindo exclusivamente Motor de Eventos
Fase E      Push Notifications
Fase F      E-mail
Fase G      WhatsApp
```

### Detalhamento da Fase B2

**Objetivo:** fechar o ciclo do evento `feedback_enviado` — quando a paciente visualiza o feedback, o evento deve ser marcado como lido.

**Onde implementar:** `src/app/paciente/Checkin.jsx`

**O que já existe no arquivo:**
```javascript
// Checkin.jsx já tem este useEffect que marca o feedback como lido no banco:
const { error } = await supabase.rpc('marcar_feedback_lido', { p_envio_id: envio.id });
```

**O que falta:** chamar `marcarEventoLido(eventoId)` do Event Builder nesse mesmo ponto. O desafio é ter o `eventoId` disponível — será necessário buscar o evento correspondente ao `checkin_envio` ou passar o ID de outra forma.

**Abordagem sugerida (a validar):** ao carregar o check-in respondido com feedback, buscar o evento ativo de tipo `feedback_enviado` com `referencia_id = envio.id` e chamar `marcarEventoLido()` se encontrado.

---

## 12. Contexto para Retomada

Ao iniciar nova conversa, priorizar:

1. Ler este documento para entender o estado atual
2. Ler `MOTOR_EVENTOS_CONVENCOES_V1.md` para entender as convenções do Motor de Eventos
3. Confirmar com a nutricionista o escopo exato antes de implementar
4. A próxima sprint é a **Fase B2** — marcar evento como lido ao abrir o feedback na tela da paciente
