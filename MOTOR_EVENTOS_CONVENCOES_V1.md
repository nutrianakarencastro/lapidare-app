# Motor de Eventos do Útera — Convenções V1

> Documento de referência para integrações ao Motor de Eventos.
> Versão 1 — estabelecida após a Fase A (infraestrutura) e Fase B1 (primeiro módulo integrado: Feedback).

---

## 1. Objetivo

O Motor de Eventos é a camada central de comunicação assíncrona do Útera. Ele captura acontecimentos relevantes do sistema e os disponibiliza de forma estruturada para diferentes consumidores: badges de pendência, Central de Eventos, Push Notifications (futuro) e analytics.

O objetivo central é desacoplar a geração de acontecimentos do seu consumo. Um módulo que salva um feedback não precisa saber se haverá badge, e-mail ou notificação push — ele apenas registra que o acontecimento ocorreu.

---

## 2. Filosofia do Motor de Eventos

O Motor de Eventos **não é um sistema de notificações**.

Notificações são canais — push, e-mail, badge, mensagem. O Motor de Eventos é anterior a isso: ele representa acontecimentos relevantes da jornada clínica da paciente, independentemente de como esses acontecimentos serão comunicados.

O dado clínico continua sendo a fonte de verdade do Útera. Um feedback existe na tabela `checkin_envios`. Um exame existe na tabela `exames`. O evento não substitui esses registros — ele é uma **projeção estruturada** de que aquele acontecimento ocorreu, disponível para ser consumida por qualquer canal presente ou futuro.

Essa separação tem uma consequência arquitetural importante: os módulos clínicos não precisam conhecer os canais de entrega. O módulo de Feedback não sabe se o evento vai gerar um badge, uma notificação push ou um e-mail. Ele apenas registra que o acontecimento ocorreu. Quem decide o que fazer com esse evento são os consumidores — e novos consumidores podem ser adicionados no futuro sem que nenhum módulo clínico precise ser alterado.

Um mesmo evento `feedback_enviado` poderá alimentar, simultaneamente:

- o badge de pendências da paciente;
- a Central de Eventos;
- uma Push Notification;
- um e-mail;
- uma mensagem no WhatsApp.

Cada canal consome o mesmo evento de formas diferentes. O módulo que gerou o evento não precisa saber disso.

Essa separação entre **geração de acontecimentos** e **consumo por canais** é uma decisão arquitetural permanente do Útera.

---

## 3. Princípios arquiteturais

**O evento é secundário ao dado clínico.**
O dado clínico (feedback, check-in, exame) sempre deve ser salvo primeiro. O evento é gerado após a confirmação de sucesso. Uma falha ao gerar o evento nunca deve impedir a operação principal.

**O Motor de Eventos é best-effort.**
Toda chamada ao Event Builder captura exceções internamente. Falhas são registradas como `console.warn` estruturado e o fluxo do módulo continua normalmente.

**Nenhum módulo conhece a estrutura interna do Motor de Eventos.**
Módulos chamam funções específicas do Event Builder (`criarEventoFeedback`, `criarEventoCheckin`, etc.). Nunca chamam `criarEvento()` diretamente, nunca fazem INSERT direto na tabela `eventos`.

**Nenhum registro é apagado.**
Eventos são encerrados, cancelados ou lidos — nunca deletados. Isso garante histórico auditável.

**A navegação é resolvida pelo frontend.**
O banco não armazena rotas ou deep links. O evento contém `referencia_tipo` e `referencia_id`. O frontend possui um event resolver que traduz esses campos em navegação.

**Autoria e destino são sempre explícitos.**
Todo evento declara quem gerou (`autor_tipo` + `autor_id`) e para quem é destinado (`destinatario_tipo` + `destinatario_id`). Isso permite que o Motor de Eventos sirva tanto a nutricionista quanto a paciente sem arquitetura duplicada.

---

## 4. Quando um evento deve ser criado

Um evento deve ser criado quando:

- Uma ação clínica relevante é concluída com sucesso e o destinatário precisa ser notificado ou tomar uma ação em resposta;
- Um conteúdo novo é disponibilizado para a paciente (orientação, podcast, ebook, narrativa);
- Uma pendência clínica é aberta (check-in enviado, rastreio solicitado);
- O sistema detecta uma condição que requer atenção (suplemento atrasado, prazo vencido).

---

## 5. Quando um evento NÃO deve ser criado

Um evento não deve ser criado quando:

- A operação principal falhou — o evento só deve ser gerado após confirmação de sucesso;
- É uma edição de um dado já comunicado (ex: nutri edita feedback já enviado) — a edição não é um novo evento; é uma atualização do dado clínico original;
- A operação é interna e não tem destinatário relevante (ex: nutri atualiza suas próprias anotações de follow-up, que são privadas);
- O acontecimento já está representado por um evento ativo com a mesma `dedup_key` — a deduplicação previne duplicatas.

---

## 6. Ciclo de vida do evento

```
criado_em
    │
    ▼
[ ativo ]  ←── estado inicial após criação
    │
    ├── paciente/nutri lê o evento
    │       ▼
    │   [ lido ]
    │       │
    │       └── (para eventos informativos: estado final)
    │
    └── ação é concluída ou nutri encerra manualmente
            ▼
        [ encerrado ]

[ cancelado ]  ←── evento invalidado antes de ser consumido
                   (uso futuro — não implementado no MVP)
```

**Regras de transição:**

| Transição | Quem executa | RPC |
|---|---|---|
| `ativo` → `lido` | Paciente ou nutri | `marcar_evento_lido()` |
| `ativo/lido` → `encerrado` | Nutri | `encerrar_evento()` |
| `ativo/lido` → `cancelado` | Sistema (V2) | — |

**Timestamps de auditoria:**

- `criado_em` — sempre preenchido na criação
- `lido_em` — preenchido por `marcar_evento_lido()`. Idempotente.
- `encerrado_em` — preenchido por `encerrar_evento()`. Se `lido_em` ainda for NULL, é preenchido junto.

---

## 7. Responsabilidades do Event Builder (`src/lib/eventos.js`)

O Event Builder é a única camada autorizada a criar eventos. Suas responsabilidades:

- Expor funções específicas por domínio (`criarEventoFeedback`, `criarEventoCheckin`, etc.);
- **Consumir o Catálogo de Tipos** para obter os metadados canônicos de cada tipo (`tipo`, `categoria`, `origem`, `titulo`, `natureza`, `verbo`, `peso`, `metadata_schema`);
- Receber do módulo chamador apenas os dados de negócio da instância;
- Construir a `dedup_key` correta para cada tipo de evento, seguindo o formato canônico definido em §13;
- Delegar para `criarEvento()` com tratamento de erro best-effort;
- Validar parâmetros obrigatórios antes de chamar a RPC (guard com `console.warn`).

**Campos declarativos do Catálogo introduzidos pela Arquitetura da Atenção V2** (não persistidos em `eventos` — vivem no Catálogo, consultados por camadas superiores):

- `superficies` — declara projeções de conteúdo por superfície emissiva (push, email, whatsapp). Consumido pela Camada de Emissão via Motor de Atenção. Sem consumidor no Event Builder.
- `categoria_atencao` — declara a categoria de opt-in do tipo (`comunicacao_clinica | lembretes | rastreios | reconhecimento | …`). Ortogonal à `categoria` clínica desta seção (§9). Consumido por Preferências de Atenção. Sem consumidor no Event Builder.
- `prioridade` — declaração orientativa (`alta | media | baixa`) para uso futuro do Motor de Atenção (ordem, agrupamento, quiet hours, digest). Sem consumidor atual.

Esses campos são vocabulário do Catálogo. **A tabela `eventos` não os armazena.** A camada que precisa deles consulta `getTipoDef(evento.tipo)` para lê-los quando necessário.

O Event Builder **não deve**:

- Hardcodar `tipo`, `categoria`, `origem` ou `titulo` — esses metadados vivem no Catálogo;
- Conter lógica clínica ou de negócio além do mapeamento para o formato de evento;
- Fazer queries diretamente ao banco (apenas chama RPCs);
- Lançar exceções para o módulo chamador.

**Relação com o Catálogo:** o Catálogo de Tipos é a fonte única de verdade dos metadados canônicos de cada tipo de evento. O Event Builder é a única camada autorizada a instanciar eventos com esses metadados. Descrição (Catálogo) e instanciação (Event Builder) são camadas distintas — a segunda depende da primeira.

---

## 8. Responsabilidades das RPCs

### `criar_evento()`

- Única porta de entrada para inserção na tabela `eventos`;
- Executa deduplicação: se `dedup_key` fornecida e evento ativo/lido já existe, retorna o ID existente sem inserir;
- Não contém lógica clínica — apenas cria o registro estrutural;
- `SECURITY DEFINER`: INSERT direto na tabela é bloqueado por RLS.

### `marcar_evento_lido()`

- Preenche `lido_em` e muda `status` para `lido`;
- Idempotente: ignorado se `lido_em` já estiver preenchido;
- Verifica autorização internamente: paciente só marca os seus; nutri marca os de suas pacientes.

### `encerrar_evento()`

- Muda `status` para `encerrado`, preenche `encerrado_em`;
- Preenche `lido_em` se ainda for NULL (encerrar implica ciência do evento);
- Restrito à nutri responsável pela paciente.

---

## 9. Padrão para `categoria`

A categoria agrupa eventos por área temática **do domínio clínico**. Usada para filtros macro e agrupamentos na Central de Eventos.

| Valor | Quando usar |
|---|---|
| `comunicacao` | Troca de informações entre nutri e paciente (feedback, mensagens) |
| `saude` | Dados e acompanhamento clínico (check-ins, rastreios, exames, suplementação) |
| `conteudo` | Material disponibilizado à paciente (orientações, podcasts, ebooks, narrativas) |
| `jornada` | Progressão da jornada clínica da paciente |
| `sistema` | Alertas e avisos gerados automaticamente pelo sistema |

**Nota — distinção com `categoria_atencao` (V2).** Esta `categoria` é do dado clínico e permanece a mesma desde a V1. A Arquitetura da Atenção V2 introduziu um segundo eixo declarativo no Catálogo, `categoria_atencao`, que classifica o tipo pelo **eixo de opt-in visto pela paciente** (`comunicacao_clinica`, `lembretes`, `rastreios`, `reconhecimento`, …). Os dois eixos coexistem sem substituição — um mesmo tipo pode ter `categoria='saude'` e `categoria_atencao='lembretes'` (por exemplo, `suplemento_horario`). Detalhes em `ARQUITETURA_DA_ATENCAO_V2.md` §7 e Apêndice A.

---

## 10. Padrão para `tipo`

O tipo identifica o acontecimento específico dentro da categoria. Deve ser um substantivo no particípio passado, descrevendo o que aconteceu.

**Convenção de nomenclatura:** `{substantivo}_{verbo_particípio}`

| Tipo | Categoria | Descrição |
|---|---|---|
| `feedback_enviado` | comunicacao | Nutri enviou feedback em um check-in |
| `check_in_recebido` | saude | Paciente respondeu um check-in |
| `rastreio_solicitado` | saude | Nutri solicitou rastreio intestinal |
| `exame_publicado` | saude | Nutri publicou resultado de exame |
| `orientacao_atribuida` | conteudo | Nutri atribuiu orientação à paciente |
| `podcast_publicado` | conteudo | Novo podcast disponível na biblioteca |
| `documento_publicado` | conteudo | Novo documento disponível |
| `ebook_atribuido` | conteudo | Nutri atribuiu ebook à paciente |
| `narrativa_publicada` | conteudo | Nova narrativa disponível |
| `suplemento_atrasado` | sistema | Sistema detectou suplemento não registrado |
| `consulta_agendada` | jornada | Consulta foi agendada |

Ao criar um novo tipo, deve-se verificar se não existe tipo semelhante, manter a convenção de nomenclatura e documentar nesta tabela.

---

## 11. Padrão para `origem`

A origem indica em qual módulo do sistema o acontecimento ocorreu. Usado para filtros, agrupamentos e analytics por módulo.

| Valor | Módulo responsável |
|---|---|
| `checkins` | Módulo de check-ins (inclui o feedback da nutri sobre o check-in) |
| `orientacoes` | Módulo de orientações |
| `biblioteca` | Módulo de biblioteca (podcasts, ebooks, narrativas) |
| `exames` | Módulo de exames |
| `jornada` | Módulo de jornada clínica |
| `consulta` | Módulo de consultas |
| `suplementacao` | Módulo de suplementação |

**Regra:** `origem` deve corresponder ao nome canônico do módulo onde o acontecimento ocorreu — sempre em minúsculas e sem acentos. Ao adicionar um novo módulo ao sistema, deve-se registrá-lo nesta tabela.

**Princípio fundamental:** `origem` representa o módulo — nunca a ação. Ações como envio de feedback, leitura, encerramento ou resposta devem ser representadas pelo campo `tipo`, não pela `origem`. Exemplo: o evento de feedback enviado pela nutri pertence ao módulo `checkins` (onde o acontecimento ocorreu), não a um módulo `feedbacks` inexistente.

---

## 12. Padrão para `metadata`

O campo `metadata` (JSONB) armazena informações complementares que não cabem nos campos estruturados. Deve ser mínimo e intencional.

**Princípios:**
- Incluir apenas dados que não são deriváveis de `referencia_tipo` + `referencia_id`;
- Priorizar dados úteis para analytics e display futuro sem necessidade de joins;
- Nunca duplicar campos já presentes na estrutura do evento (categoria, tipo, etc.);
- Manter consistência dentro de cada `tipo` — eventos do mesmo tipo sempre têm a mesma estrutura de metadata.

**Padrão por tipo:**

| Tipo | Metadata |
|---|---|
| `feedback_enviado` | `{ "checkin_envio_id": "<uuid>" }` |
| `check_in_recebido` | `{ "checkin_envio_id": "<uuid>", "template_nome": "<string>" }` |
| `exame_publicado` | `{ "exame_tipo": "<string>" }` |
| `suplemento_atrasado` | `{ "suplemento_nome": "<string>", "dias_atraso": <int> }` |

Ao criar um novo tipo de evento, documentar o schema de metadata esperado nesta tabela.

---

## 13. Padrão para `dedup_key`

A `dedup_key` impede que o mesmo acontecimento gere múltiplos eventos ativos. A deduplicação é gerenciada pela RPC `criar_evento()` — não pelo banco (sem constraint UNIQUE na coluna).

**Formato padrão:**
```
{tipo}:{referencia_tipo}:{referencia_id}:{destinatario_id}
```

**Exemplos:**
```
feedback_enviado:checkin_envio:869c9dcf-...:c081ef62-...
check_in_recebido:checkin_envio:869c9dcf-...:0f7ccaa1-...
exame_publicado:exame:3fa2c110-...:c081ef62-...
```

**Regras:**
- Sempre incluir `destinatario_id` no final — garante que dois destinatários diferentes do mesmo objeto não conflitem;
- Para eventos recorrentes por período (ex: suplemento atrasado), incluir a data: `suplemento_atrasado:suplemento:{id}:{paciente_id}:2026-07-03`;
- Se o evento não tiver `referencia_id` natural, usar NULL como `dedup_key` (sem deduplicação);
- A `dedup_key` de um evento encerrado ou cancelado não bloqueia novos eventos — a RPC cria um novo registro nesses casos.

---

## 14. Convenções para `titulo`

O título é o texto principal que a paciente ou a nutri vê no evento. Deve ser claro, direto e orientado ao destinatário.

**Fonte de verdade:** os títulos canônicos vivem no **Catálogo de Tipos**. Esta seção documenta as convenções que orientam a definição de cada título; a tabela abaixo é reflexo do Catálogo, não fonte independente.

**Princípios:**
- Escrito na perspectiva do destinatário (segunda pessoa ou terceira);
- Curto — máximo de 60 caracteres;
- Sem pontuação final;
- Sem variáveis dinâmicas no título (datas, nomes) — usar `descricao` ou `metadata` para isso;
- Consistente: o mesmo `tipo` sempre tem o mesmo título.

**Títulos vigentes (reflexo do Catálogo):**

| Tipo | Título |
|---|---|
| `feedback_enviado` | `Novo feedback da sua nutricionista` |
| `check_in_recebido` | `Nova resposta de check-in recebida` |
| `orientacao_atribuida` | `Nova orientação disponível para você` |
| `exame_publicado` | `Seu resultado de exame está disponível` |
| `podcast_publicado` | `Novo conteúdo disponível na biblioteca` |
| `suplemento_atrasado` | `Suplemento não registrado hoje` |

---

## 15. Convenções para `descricao`

A descrição é opcional e complementa o título com contexto adicional. Deve ser usada quando o título sozinho não for suficiente para o destinatário entender o que fazer.

**Quando usar:**
- Quando houver contexto relevante que não cabe no título;
- Quando o evento requer uma ação específica da destinatária.

**Quando omitir (NULL):**
- Quando o título é autoexplicativo;
- Para eventos informativos simples.

**Formato:** texto livre, até 200 caracteres. Sem markdown.

---

## 16. Boas práticas para integrações futuras

**1. Criar uma função específica no Event Builder para cada módulo.**
Nunca chamar `criarEvento()` diretamente no módulo. A função específica (`criarEventoFeedback`, `criarEventoCheckin`, etc.) encapsula toda a montagem, tornando o módulo agnóstico à estrutura do Motor de Eventos.

**2. Capturar o estado anterior antes da operação principal.**
Se a criação do evento depende de uma condição pré-operação (ex: `!feedbackEm` para saber se é o primeiro feedback), capturar esse valor ANTES do update:
```javascript
const deveCriarEvento = !feedbackEm   // capturado antes do supabase.update()
...
if (deveCriarEvento) await criarEventoFeedback(...)
```

**3. Validar parâmetros obrigatórios na função específica.**
Antes de chamar `criarEvento()`, deve-se verificar se todos os parâmetros obrigatórios do evento estão presentes. Registrar `console.warn` e retornar `null` se algum estiver ausente.

**4. O `destinatarioId` para eventos destinados à paciente é sempre `pacientes.id` (UUID interno).**
Não é o `auth.uid()` da paciente. A RLS usa `meu_paciente_id()` que retorna `pacientes.id`. Garantir que o módulo integrado tenha acesso a esse ID (geralmente disponível no objeto de paciente já carregado).

**5. Respeitar o escopo de cada fase.**
- Eventos gerados apenas onde faz sentido semântico;
- Nunca gerar eventos em fluxos de edição sem decisão explícita;
- Não duplicar eventos por otimismo (ex: gerar evento no envio E no agendamento).

**6. Não criar migrations para cada nova integração.**
A tabela `eventos` é genérica por design. Novas integrações adicionam apenas funções no Event Builder — sem alterar o schema do banco.

**7. Testar sempre via Supabase antes de commitar.**
Verificar: (a) o evento foi criado com todos os campos corretos; (b) uma segunda chamada com a mesma `dedup_key` retorna o mesmo ID sem criar novo registro; (c) o total de registros na tabela `eventos` é o esperado.

---

## 17. Módulo de Feedback — caso oficial de referência

O módulo de Feedback é a primeira integração real do Motor de Eventos e serve como modelo para integrações futuras.

### Contexto

O feedback no Útera é um campo da tabela `checkin_envios` — não uma tabela separada. A nutri responde ao check-in de uma paciente preenchendo o campo `feedback`. A paciente visualiza o feedback na tela de check-in.

### Evento gerado

| Campo | Valor |
|---|---|
| `categoria` | `comunicacao` |
| `tipo` | `feedback_enviado` |
| `origem` | `checkins` |
| `titulo` | `Novo feedback da sua nutricionista` |
| `autor_tipo` | `nutri` |
| `autor_id` | `auth.uid()` da nutri |
| `destinatario_tipo` | `paciente` |
| `destinatario_id` | `pacientes.id` da paciente |
| `paciente_id` | `pacientes.id` da paciente |
| `referencia_tipo` | `checkin_envio` |
| `referencia_id` | `checkin_envios.id` |
| `metadata` | `{ "checkin_envio_id": "<uuid>" }` |
| `dedup_key` | `feedback_enviado:checkin_envio:{envio.id}:{paciente.id}` |

### Condição de criação

O evento é gerado **apenas no primeiro envio** de feedback (`!feedbackEm` antes do update). Edições posteriores atualizam o dado clínico mas não geram novo evento.

### Ponto de integração

`RespostasModal.salvarFeedback()` em `src/app/nutri/Checkins.jsx`, após confirmação de sucesso do `supabase.update()`:

```javascript
const deveCriarEvento = !feedbackEm   // capturado antes do update

const { error } = await supabase.from('checkin_envios').update(updates).eq('id', envio.id)
if (error) { setErroFeedback(error.message); return; }

if (deveCriarEvento) {
  await criarEventoFeedback({
    pacienteId: envio.paciente.id,
    envioId:    envio.id,
    nutriId,
  })
}
```

### Função no Event Builder

```javascript
// src/lib/eventos.js
import { CATALOGO } from './eventoTiposCatalog'

export async function criarEventoFeedback({ pacienteId, envioId, nutriId }) {
  if (!pacienteId || !envioId || !nutriId) {
    console.warn('[Útera] Motor de Eventos — criarEventoFeedback: parâmetros incompletos', ...)
    return null
  }
  const tipoDef = CATALOGO.feedback_enviado
  return criarEvento({
    pacienteId,
    categoria: tipoDef.categoria,
    tipo:      tipoDef.tipo,
    origem:    tipoDef.origem,
    titulo:    tipoDef.titulo,
    autorTipo: 'nutri', autorId: nutriId,
    destinatarioTipo: 'paciente', destinatarioId: pacienteId,
    referenciaTipo: 'checkin_envio', referenciaId: envioId,
    metadata: { checkin_envio_id: envioId },
    dedupKey: `${tipoDef.tipo}:checkin_envio:${envioId}:${pacienteId}`,
  })
}
```

O Event Builder consome o Catálogo para obter os metadados canônicos do tipo. A função específica é responsável apenas pelo mapeamento dos dados de negócio (`pacienteId`, `envioId`, `nutriId`) e pela construção da `dedup_key`. Metadados declarativos (`tipo`, `categoria`, `origem`, `titulo`, `natureza`, `verbo`, `peso`) nunca são hardcoded.

---

## 18. Padrão de encerramento de eventos acionáveis

Eventos declarados no Catálogo como **acionáveis** têm ciclo de vida `ativo → encerrado`. O fechamento não ocorre por leitura — ocorre quando a ação clínica correspondente é concluída no módulo de origem.

### Responsabilidade

O módulo clínico responsável pela ação clínica é quem chama `encerrarEvento(id)` do Event Builder, imediatamente após confirmar o sucesso da operação principal — mesmo padrão best-effort da criação (§17).

### Ponto de integração

O ponto exato é análogo ao de criação: **após confirmação de sucesso da operação clínica**. Falhas na chamada de encerramento nunca devem impedir a operação principal.

### Como o módulo obtém o `id` do evento

Duas estratégias válidas:

1. **Passagem direta** — quando o usuário chega ao módulo pela Central, a Central passa o `eventoId` como contexto de navegação; o módulo o usa diretamente ao concluir a ação.
2. **Busca por referência** — quando o usuário chega ao módulo por outros caminhos, o módulo consulta a tabela `eventos` filtrando por `referencia_tipo`, `referencia_id` e `status IN ('ativo', 'lido')`, e chama `encerrarEvento` no resultado.

Ambas devem coexistir. A Central é caminho primário mas não único.

### Escopo

- Eventos **informativos** não requerem encerramento — fecham pela leitura (`ativo → lido`, estado final).
- Eventos **acionáveis** requerem chamada explícita a `encerrarEvento` no módulo clínico. Sem ela, o evento permanece no bucket `requer_acao` para consumidores da Camada de Interpretação, mesmo após a ação clínica ter sido concluída.

### Registro

Cada tipo acionável do Catálogo deve documentar qual módulo clínico é responsável pelo seu encerramento e em que ponto do fluxo essa chamada ocorre. Isso segue a mesma convenção que §17 estabelece para criação.

---

## Roadmap de Evolução

### Implementado

- **Fase A** — Infraestrutura base: tabela `eventos`, índices, RLS, RPCs (`criar_evento`, `marcar_evento_lido`, `encerrar_evento`) e Event Builder (`src/lib/eventos.js`).
- **Fase B1** — Integração com Feedback: geração de evento `feedback_enviado` ao salvar o primeiro feedback de um check-in.
- **Fase B2** — Marcação como lido ao abrir o feedback na tela da paciente. Ciclo `criado → ativo → lido` fechado ponta a ponta.

### Em especificação

- **Fase C** — Central de Eventos: arquitetura consolidada em `CENTRAL_EVENTOS_ARQUITETURA_V1.md`. Introduz a Camada de Interpretação (Catálogo de Tipos, Motor de Atenção, Event Resolver) entre o Motor de Eventos e as superfícies visíveis. Primeira superfície: Central da paciente integrada ao Início.

### Próximas fases

- **D** — Badges consumindo Catálogo + Motor de Atenção, substituindo queries diretas às tabelas clínicas.
- **E** — Push Notifications: nova superfície consumindo a Camada de Interpretação.
- **F** — E-mail: digest e individual, execução server-side reutilizando o Motor de Atenção portável.
- **G** — WhatsApp: canal restritivo com política declarada no Catálogo por tipo.

> Este roadmap é documentação arquitetural, não um plano de sprint. As fases serão detalhadas e priorizadas conforme o Útera evolui.

---

## Apêndice — Campos da tabela `eventos`

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | UUID | sim (auto) | Identificador único do evento |
| `paciente_id` | UUID | sim | `pacientes.id` — contexto clínico |
| `categoria` | TEXT | sim | Agrupamento macro (ver §9) |
| `tipo` | TEXT | sim | Acontecimento específico (ver §10) |
| `origem` | TEXT | sim | Módulo gerador (ver §11) |
| `referencia_tipo` | TEXT | não | Tipo da entidade referenciada |
| `referencia_id` | UUID | não | ID da entidade referenciada |
| `autor_tipo` | TEXT | sim | `nutri` \| `paciente` \| `sistema` \| `ia` |
| `autor_id` | UUID | não | auth.uid() do autor (null para sistema) |
| `destinatario_tipo` | TEXT | sim | `nutri` \| `paciente` |
| `destinatario_id` | UUID | não | ID do destinatário (null = broadcast) |
| `titulo` | TEXT | sim | Texto principal do evento (ver §14) |
| `descricao` | TEXT | não | Contexto adicional (ver §15) |
| `metadata` | JSONB | sim | Dados complementares (default `{}`) |
| `status` | TEXT | sim | `ativo` \| `lido` \| `encerrado` \| `cancelado` |
| `criado_em` | TIMESTAMPTZ | sim (auto) | Timestamp de criação |
| `lido_em` | TIMESTAMPTZ | não | Preenchido por `marcar_evento_lido()` |
| `encerrado_em` | TIMESTAMPTZ | não | Preenchido por `encerrar_evento()` |
| `dedup_key` | TEXT | não | Chave de deduplicação (ver §13) |
