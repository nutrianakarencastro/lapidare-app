# Central de Eventos do Útera — Arquitetura V1

> Documento de referência arquitetural da Fase C do Motor de Eventos.
> Consolidado antes de qualquer implementação.
> Documento irmão de `MOTOR_EVENTOS_CONVENCOES_V1.md`.
> Data de referência: julho de 2026.

---

## 1. Definição da Central de Eventos

A Central de Eventos é a superfície responsável por orquestrar a atenção do usuário sobre acontecimentos relevantes da jornada clínica, conduzindo-o ao módulo responsável por cada ação ou informação, sem duplicar conteúdo clínico.

Essa é a definição soberana da Central. Toda decisão de arquitetura, produto ou implementação que envolva a Central precisa ser testada contra ela.

A Central não é lista de notificações. Não é caixa de entrada. Não é linha do tempo clínica. Não é dashboard operacional. Ela é uma superfície de orquestração da atenção — e apenas isso.

---

## 2. Responsabilidade exclusiva da Central

A responsabilidade exclusiva da Central é ser o único ponto do Útera que reúne, para o usuário logado e de forma persistente, tudo o que passou a demandar sua atenção — transversalmente a todos os módulos e sem exigir dele conhecimento prévio sobre onde cada acontecimento ocorreu.

Nenhum outro componente do sistema pode cumprir esse papel, e cada alternativa falha em pelo menos uma dimensão crítica:

- **Módulos clínicos** são especializados por domínio e não têm legitimidade para agregar o que ocorre nos outros. Falham na **transversalidade**.
- **Prontuário e Jornada Clínica** estão centrados na paciente, não no usuário logado. Exigem escolha prévia de qual paciente inspecionar, o que é o inverso do que a Central resolve. Falham na **personalização por destinatário**.
- **Feed da nutri** é linha do tempo de atividade — não filtra por pertinência ao destinatário. Falha na **qualidade da informação**.
- **Badges** informam quantidade, não conteúdo. São sinal sem contexto e desaparecem ao serem zerados. Falham na **persistência consultável**.
- **Push, e-mail e WhatsApp** são efêmeros por natureza. Uma mensagem perdida é irrecuperável. Falham na **persistência**.
- **Tabela `eventos`** é dado bruto. Não é interface. Falha em **ser interface**.

A Central é o único convergente de todas essas dimensões: transversal, personalizada por destinatário, persistente, qualitativa, navegável e soberana dentro do produto.

---

## 3. Princípio da orquestração da atenção

A palavra central da responsabilidade da Central não é "evento", não é "notificação", não é "lista". É **atenção**.

A Central não existe para listar eventos. Ela existe para **gerenciar a atenção do usuário**. Os eventos são apenas a matéria-prima utilizada para isso.

Consequências permanentes desse princípio:

- **A Central tem responsabilidade editorial.** Não é obrigada a mostrar todo evento com o mesmo peso. Prioriza, ordena, agrupa e silencia.
- **Atenção é recurso escasso e gerido explicitamente.** Cada elemento na tela consome atenção. Ver tudo é o mesmo que ver nada.
- **A Central é entidade de trânsito, não de destino.** Conduz ao módulo responsável. Nunca é o palco final da ação.
- **Duplicar conteúdo clínico é hostil à própria função da Central.** Fragmenta atenção entre dois lugares que passam a competir pela mesma sessão do usuário.
- **Badges, Push, E-mail e WhatsApp não são canais paralelos.** São outras superfícies de atenção competindo pelo mesmo recurso escasso: a atenção do mesmo usuário.
- **Natureza (informativo/acionável) é insumo da orquestração, não eixo da apresentação.** Alimenta o algoritmo interno; nunca aparece como categoria visível.

---

## 4. Evento, atenção e superfície — distinção conceitual

A arquitetura da Fase C separa três conceitos que antes se confundiam. Manter essa distinção clara é o que preserva a coerência do sistema conforme ele cresce.

**Evento.**
Fato estruturado registrado pelo Motor de Eventos. Representa um acontecimento clínico relevante que ocorreu. É o dado bruto, imutável em espírito, versionado por status (`ativo`, `lido`, `encerrado`, `cancelado`). Não sabe nada sobre atenção, prioridade ou apresentação. Vive na tabela `eventos`.

**Atenção.**
Decisão política sobre o que, de todo o conjunto de eventos, merece o foco do usuário naquele momento e em qual ordem. É computada, não persistida. Depende do destinatário, da superfície-alvo, do contexto e da natureza declarada de cada tipo no Catálogo. Vive no Motor de Atenção.

**Superfície.**
Renderização da atenção em um formato específico para um consumidor específico. Central, badge, dashboard, push, e-mail e WhatsApp são superfícies. Cada uma tem afordâncias, restrições e vocabulários próprios. Nenhuma decide política de atenção — apenas apresenta a atenção que recebe. Vivem na camada de UI e nos canais de entrega.

Evento é o que aconteceu. Atenção é o que importa agora. Superfície é como isso chega ao usuário. As três coisas são distintas. Confundi-las é o que gera acoplamento entre política e apresentação.

---

## 5. Arquitetura em camadas

A Fase C introduz uma camada intermediária entre o Motor de Eventos e as superfícies visíveis. Essa camada é responsável por transformar eventos brutos em atenção organizada.

```
┌──────────────────────────────────────────────────────────┐
│                    DADOS CLÍNICOS                        │
│    checkin_envios · exames · orientacoes · suplementos   │
│                  (fonte de verdade)                      │
└──────────────────────────┬───────────────────────────────┘
                           │  acontecimento
                           ▼
┌──────────────────────────────────────────────────────────┐
│                  MOTOR DE EVENTOS                        │
│      tabela eventos · Event Builder · RPCs               │
│              (captura + ciclo de vida)                   │
└──────────────────────────┬───────────────────────────────┘
                           │  eventos brutos + estados
                           ▼
      ┌─────────────────────────────────────────────┐
      │        CAMADA DE INTERPRETAÇÃO              │
      │                                             │
      │  · Catálogo de Tipos                        │
      │  · Motor de Atenção                         │
      │  · Event Resolver                           │
      └────────────────────┬────────────────────────┘
                           │  atenção organizada +
                           │  contexto de navegação
                           ▼
      ┌─────────────────────────────────────────────┐
      │              SUPERFÍCIES                    │
      │                                             │
      │  Central · Badge · Dashboard ·              │
      │  Push · E-mail · WhatsApp                   │
      │        (apenas apresentação)                │
      └─────────────────────────────────────────────┘
```

**Responsabilidades por camada:**

**Dados Clínicos.**
Fonte de verdade do domínio. Independentes de tudo o mais.

**Motor de Eventos.**
Captura acontecimentos e mantém o ciclo de vida. Não sabe nada sobre atenção, prioridade ou apresentação. É best-effort, RLS-protegido, imutável em espírito. Especificado em `MOTOR_EVENTOS_CONVENCOES_V1.md`.

**Camada de Interpretação.**
Transforma eventos brutos em atenção organizada e contexto de navegação. É composta por três componentes coordenados, cada um com responsabilidade única.

**Superfícies.**
Consomem a atenção organizada e a renderizam em formatos específicos. Não decidem política. A Central é uma superfície — a mais completa e a mais visível — mas não tem privilégios arquiteturais sobre as demais.

**Relação entre superfícies e Motor de Eventos:**

> As superfícies continuam consumindo eventos diretamente do Motor de Eventos — leituras, paginação e transições via RPC. O que muda é que deixam de conhecer as regras de atenção: prioridade, ordem, destaque, agrupamento e silenciamento passam a ser responsabilidade do Motor de Atenção.

Essa formulação é a mais precisa para descrever o contrato. A fonte dos dados continua sendo o Motor de Eventos. O que passa a viver na Camada de Interpretação é a *interpretação* desses dados.

---

## 6. Componentes da Camada de Interpretação

A Camada de Interpretação não é um serviço monolítico. É a coordenação de três componentes com responsabilidades disjuntas:

- **Catálogo de Tipos** — fonte declarativa de verdade sobre cada tipo de evento.
- **Motor de Atenção** — política de organização da atenção.
- **Event Resolver** — resolução de contexto de navegação.

Cada um deles pode ser consultado independentemente pelas superfícies e evolui sob seu próprio regime. A separação é intencional — evita que um componente cresça acumulando responsabilidades que não são suas.

---

## 7. Responsabilidades e limites de cada componente

### 7.1 Catálogo de Tipos

**É:** fonte única de verdade declarativa sobre cada tipo de evento existente no sistema. Descreve, por tipo:

- Natureza (`informativo` | `acionavel`)
- Categoria
- Origem canônica
- Título fixo
- Verbo de ação (apenas para acionáveis — ex: `Responder`, `Analisar`)
- Schema esperado de metadata
- Peso base de atenção (usado pelo Motor de Atenção)
- Política por canal (usada por push, e-mail, WhatsApp — reservado para fases futuras)

**Consumido por:** Event Builder (para obter metadados canônicos ao criar eventos), Motor de Atenção (para classificação e priorização), superfícies (para exibir título, ícone e verbo canônicos).

**Não é:**

- Não computa nada. É puramente declarativo.
- Não conhece eventos concretos — descreve tipos, não instâncias.
- Não decide navegação — isso é do Event Resolver.
- Não decide política — isso é do Motor de Atenção.
- Não contém componentes visuais nem dependências de ambiente — ícones e apresentação visual vivem em módulo separado.

**Portabilidade:** o Catálogo deve ser puramente declarativo e livre de dependências de ambiente (`window`, `document`, cliente supabase específico do browser, componentes React). Isso garante que ele possa ser importado tanto pelo frontend quanto por edge functions server-side quando as fases E, F e G chegarem — sem retrabalho.

**Limite crítico:** o Catálogo é a **projeção executável** do documento de convenções. Toda vez que um novo tipo é adicionado ao sistema, o Catálogo é a única fonte que precisa ser atualizada — as demais camadas herdam a informação automaticamente. Como consequência direta dessa decisão de fonte única de verdade, o Event Builder consome o Catálogo ao construir eventos e nunca hardcoda `tipo`, `categoria`, `origem` ou `titulo`.

---

### 7.2 Motor de Atenção

**É:** camada de política. Dado um conjunto de eventos e um contexto de consulta, decide o que merece atenção agora e como.

**Entrada:**

- Conjunto de eventos brutos.
- Contexto: destinatário, superfície-alvo, momento.
- Opcional: preferências do usuário (reservado para fases futuras).
- Implícito: Catálogo de Tipos.

**Saída:** eventos decorados com:

- **Bucket de atenção** — `requer_acao` | `novidade` | `visto` | `silenciado`.
- **Ordem de exibição** dentro do bucket.
- **Chave de agrupamento** — opcional; superfícies podem colapsar itens que compartilham a chave.
- **Sugestão de destaque** — `alto` | `medio` | `baixo`.
- **Decisão de canal** — para superfícies fora da Central, mapa `superfície → deve exibir?`.
- **Agregados** — contagens por bucket.

**Regras invariantes do V1:**

- Acionáveis ativos sempre no bucket `requer_acao`.
- Informativos ativos sempre no bucket `novidade`.
- Lidos e encerrados recentes no bucket `visto`.
- Ordenação intra-bucket: mais recentes primeiro.
- Nenhum silenciamento no V1 — a política de silenciamento nasce vazia.

**Não é:**

- Não faz queries no banco.
- Não conhece rotas.
- Não conhece HTML, componentes, cores.
- Não persiste nada.
- Não muda estado dos eventos.
- Não é sistema de recomendação, não aprende, não infere hábitos. É determinístico.
- Não conhece SLA nem urgência clínica implícita.

**Comportamento diante de tipo desconhecido:**

Se o Motor de Atenção receber um evento cujo `tipo` não existe no Catálogo (por exemplo, tipo novo em produção antes de o Catálogo do frontend ser atualizado), o comportamento é fail-safe:

- Registra `console.warn` estruturado indicando o tipo não mapeado e o `id` do evento.
- Classifica o evento no bucket `novidade`.
- Atribui destaque `baixo`.
- Nunca lança exceção; nunca omite o evento silenciosamente; nunca quebra a interface consumidora.

Isso segue a mesma filosofia best-effort do Motor de Eventos (§3 das convenções).

**Portabilidade:** o Motor de Atenção deve ser desenhado como conjunto de funções puras, sem dependência de ambiente. Isso garante que a mesma implementação sirva ao browser (Central, Badge) e a edge functions Supabase (Push, E-mail, WhatsApp digest) quando essas fases chegarem — sem retrabalho.

---

### 7.3 Event Resolver

**É:** camada de resolução de navegação. Dado um evento, retorna a decisão de navegação (rota + rótulo + disponibilidade).

**Chaves de decisão:**

- Primária: `referencia_tipo`.
- Secundária: `destinatario_tipo` — a mesma referência pode levar a rotas diferentes para nutri e paciente.

**Comportamento:**

- Se `referencia_tipo` está mapeado, retorna rota + rótulo.
- Se não está mapeado, retorna evento não navegável — a superfície o exibe sem ação de clique.
- Independente do Motor de Atenção — resolve mesmo para eventos silenciados.

**Não é:**

- Não decide se o evento deve ser exibido — isso é do Motor de Atenção.
- Não faz side effects. Só decide.
- Não conhece Motor de Eventos nem Catálogo. Depende apenas do formato do evento.

**Limite crítico:** o mapa do Resolver é a **superfície de contrato** entre o Motor de Eventos e o frontend. Cada `referencia_tipo` novo introduzido no Motor precisa ganhar entrada no Resolver — ou ficará não navegável de forma explícita, o que é comportamento seguro.

---

## 8. Arquitetura permanente × implementação incremental

Princípio explícito da Fase C:

> **A arquitetura conceitual é permanente. A implementação é incremental.**

As três camadas — Catálogo de Tipos, Motor de Atenção e Event Resolver — existem conceitualmente desde o dia um da Fase C. Suas fronteiras, responsabilidades e limites são imutáveis. A implementação de cada uma cresce conforme surgem consumidores reais.

No MVP, cada camada é o mínimo necessário para servir à Central da paciente. Ganhos de sofisticação — silenciamento, agrupamento, preferências, portabilidade servidor — entram apenas quando o segundo consumidor pedir.

Esse princípio evita dois problemas simétricos:

- **Antecipação:** construir engine sofisticada para um único consumidor.
- **Descoberta tardia:** reconhecer a camada só depois de badges e push já terem reimplementado política, forçando refactor caro.

O que importa preservar desde o dia um não é a *quantidade* de código, é a *fronteira*: uma vez que a política vive fora da Central, ela pode crescer sem tocar na interface, e novas superfícies consomem a mesma política sem reinventar.

---

## 9. Escopo mínimo do MVP da Fase C

**Catálogo de Tipos V1.0.**
Módulo declarativo com registro do único tipo hoje existente (`feedback_enviado`), incluindo natureza (`informativo`), categoria, origem, título canônico, schema de metadata e peso base. Estrutura pronta para acomodar os próximos tipos da Fase B.

**Motor de Atenção V1.0.**
Módulo puro com uma única função pública que recebe lista de eventos e contexto de consulta e retorna eventos classificados em buckets e ordenados. Sem silenciamento, sem agrupamento, sem preferências. Escrito como função pura, sem dependência de ambiente.

**Event Resolver V1.0.**
Módulo com mapa de `referencia_tipo` → destino de navegação. Uma única entrada inicial: `checkin_envio`.

**Central da paciente V1.0.**
Superfície integrada ao Início da paciente. Consulta a tabela `eventos` filtrando pelo destinatário logado. Passa os eventos pelo Motor de Atenção. Renderiza cada item usando o Event Resolver para construir a navegação. Sem filtros, sem contadores, sem realtime, sem histórico separado no MVP — apenas a lista ordenada de eventos ativos, seguida dos itens já vistos em zona apagada, e um link discreto para uma tela de anteriores.

**Estratégia de atualização V1.0:** `refetch on mount`. A Central recarrega a lista sempre que a tela é aberta ou revisitada — inclusive ao voltar de uma navegação a um módulo. Realtime, refresh on focus e outras estratégias entram apenas em fases futuras, quando o volume de eventos ou a expectativa de latência exigir.

**Nome visível para a paciente:** *"Novidades"* — ou integrado ao Início sem título próprio, se essa for a escolha de UX.

**Central da nutri V1.1.**
Preparada arquiteturalmente na V1, ativada quando a Fase B expandir os tipos destinados a ela (`check_in_recebido`, `rastreio_solicitado`, `exame_publicado`). Item de menu próprio. Nome visível provisório: *"Pendências"*. Sem agrupamento por paciente na primeira versão; filtro por paciente opcional.

---

## 10. Fluxo canônico da Central da paciente

```
Paciente abre o app
    │
    ▼
Chega no Início
    │
    ▼
Central consulta eventos do destinatário no Motor de Eventos
    │  filtro: destinatario_id = paciente logado
    │  ordem: criado_em DESC
    │
    ▼
Passa a lista pelo Motor de Atenção
    │  classifica em buckets: requer_acao | novidade | visto
    │  ordena intra-bucket
    │
    ▼
Para cada item, resolve navegação via Event Resolver
    │  referencia_tipo → rota + rótulo
    │
    ▼
Renderiza cards em ordem, sem interpretar política
    │
    ▼
Paciente toca em um item
    │
    ▼
Navega ao módulo responsável
    │
    ├── marca evento como lido via marcar_evento_lido()
    │
    └── módulo carrega a entidade específica em foco
```

Nesse fluxo, a Central não toma nenhuma decisão de política. Ela consulta, delega, resolve, renderiza. É superfície pura.

---

## 11. O que a Central deve mostrar

Cada item da Central exibe exclusivamente:

- **Título canônico do tipo** (do Catálogo).
- **Descrição opcional** (do próprio evento, curta).
- **Origem** (ícone do módulo — o `origem` do evento).
- **Nome da paciente** (apenas na versão nutri).
- **Tempo relativo** desde a criação (ex: "há 2 horas").
- **Estado visual** derivado do bucket atribuído pelo Motor de Atenção.

Nada além disso.

O ícone dentro de cada item sinaliza a **origem** — o módulo em que o acontecimento ocorreu — não a natureza do evento. Natureza é vocabulário interno; origem é linguagem que o usuário reconhece.

O verbo implícito ("Responder", "Analisar"), quando presente, é lido do **Catálogo de Tipos** (campo `verbo`) e só aparece em itens do bucket `requer_acao`. Itens em `novidade` mostram apenas o título. Itens em `visto` são discretos por design.

---

## 12. O que a Central deve recusar mostrar

A regra é dura: **tudo que é dado clínico fica no módulo**.

A Central não mostra:

- O texto do feedback da nutri.
- O corpo do exame, o laudo, os valores.
- O texto da orientação, o PDF, o áudio.
- As respostas do check-in.
- O detalhamento do rastreio.
- Quaisquer dados de saúde.

A Central também não mostra:

- Eventos gerados pelo próprio usuário (nutri não vê autoauditoria de seus feedbacks; isso é responsabilidade do prontuário).
- Preview de conteúdo, expansão inline, "leia mais".
- Contadores de tempo do tipo "há 3 dias sem resposta" — urgência clínica desse tipo, se importar, vira evento próprio no Motor.
- Ações em lote, marcação manual como lido, menus de contexto.
- A palavra "evento", "notificação", "acionável" ou "informativo" como categoria visível.

Cada item é um **ponteiro**, nunca um **cartão de dado**. Se um dia a Central começar a renderizar conteúdo clínico dentro dela, terá deixado de ser Central e virado outro módulo — momento no qual a arquitetura perde sua integridade.

---

## 13. Relação futura com badges, dashboards, Push, e-mail e WhatsApp

Todas as superfícies futuras consomem a mesma Camada de Interpretação. A Central não é privilegiada arquiteturalmente — é apenas a primeira e a mais completa.

**Badges (Fase D).**
Contam eventos no bucket `requer_acao` para o destinatário logado. Consultam o mesmo Motor de Atenção que a Central consulta. Isso elimina a inconsistência que existe hoje (badges consultando tabelas clínicas diretamente) e garante que o número exibido no menu é sempre coerente com o que a Central mostra em destaque.

**Dashboard (futuro).**
Consome os agregados retornados pelo Motor de Atenção (contagens por bucket) e apresenta gráficos ou indicadores. Sem duplicar consulta, sem reinventar política.

**Push Notifications (Fase E).**
Consomem a decisão de canal do Motor de Atenção — para cada evento recém-criado, o Motor de Atenção informa se aquela superfície deve disparar entrega. O serviço de push apenas dispara, com o payload calculado a partir do Catálogo e do evento.

**E-mail (Fase F).**
Executado no servidor. Consome o Motor de Atenção em modo digest — bucket de "não visto em N horas" — e monta e-mails periódicos. Mesma política, execução server-side.

**WhatsApp (Fase G).**
Idem. Consome o Motor de Atenção com política de exibição restritiva (apenas eventos declarados no Catálogo como aptos ao canal, para evitar spam).

**Coordenação inter-canal.**
Quando uma superfície processa a atenção (ex: paciente lê o feedback pela Central), o evento passa a estado `lido` no Motor de Eventos. Todas as demais superfícies deixam de exibi-lo automaticamente, porque todas consultam o mesmo estado. O Motor de Atenção não precisa saber quem exibiu antes — a coordenação é feita pelo próprio estado do evento.

Nenhuma dessas superfícies exige mudança na tabela `eventos`, no Event Builder, no Catálogo ou na Central. Cada uma é adicionada como novo consumidor da mesma Camada de Interpretação.

---

## 14. Decisões que ficam fora do MVP

Explicitamente **não** integram a Fase C V1.0:

- **Substituição de badges pelo Motor** (é a Fase D).
- **Push, e-mail e WhatsApp** (Fases E, F e G).
- **Realtime na Central** (assinatura ao vivo de mudanças na tabela `eventos`).
- **Marcação manual como lido** (a leitura é sempre automática ao abrir o módulo).
- **Ações em lote** (marcar tudo como lido, encerrar em massa).
- **Silenciamento por tipo, por remetente ou por horário.**
- **Agrupamento visual por paciente** na Central da nutri.
- **Filtros complexos** (por origem, por categoria, por data).
- **Preferências do usuário sobre atenção** (quiet hours, tipos silenciados).
- **Personalização adaptativa** (Motor de Atenção não aprende, não infere).
- **Preview de conteúdo dentro dos cards.**
- **Coordenação explícita entre canais** (só faz sentido a partir da Fase E).

Cada uma dessas decisões tem espaço arquitetural reservado, mas nenhuma entra no MVP. A regra que orienta essa contenção é a mesma: **sofisticação entra na Camada de Interpretação, não nas superfícies**, e apenas quando o segundo consumidor pedir.

---

## 15. Critérios de aceitação da Fase C

A Fase C está concluída quando:

1. **Documentação:** este documento está publicado na raiz do projeto como referência oficial.
2. **Catálogo de Tipos:** módulo criado, com registro do tipo `feedback_enviado` completo (natureza, categoria, origem, título, schema de metadata, peso base).
3. **Motor de Atenção:** módulo puro criado, com função pública que recebe eventos e contexto e retorna eventos classificados em buckets e ordenados.
4. **Event Resolver:** módulo criado, com mapa de `referencia_tipo` → navegação, contendo entrada inicial para `checkin_envio`.
5. **Central da paciente:** integrada ao Início da paciente, consultando `eventos` filtrados por destinatário, delegando organização ao Motor de Atenção e navegação ao Event Resolver.
6. **Comportamento clínico:** ao tocar em um evento, a paciente é conduzida ao módulo responsável e o evento é marcado como lido (Fase B2 integrada).
7. **Ausência de política nas superfícies:** nenhuma decisão de prioridade, ordem, destaque ou agrupamento vive dentro da Central. Auditoria de código confirma isso.
8. **Ausência de conteúdo clínico na Central:** nenhum feedback, exame, orientação ou resposta clínica é renderizado dentro da Central. Auditoria visual confirma isso.
9. **Portabilidade preservada:** Motor de Atenção, Catálogo e Event Resolver não têm dependência de ambiente (`window`, `document`, cliente supabase específico do browser). Podem ser importados por edge functions no futuro sem refactor.
10. **Fluxo homologado com evento real:** o `feedback_enviado` existente no sistema aparece na Central da paciente, é tocado, conduz ao módulo de check-in e é marcado como lido. Fluxo canônico validado ponta a ponta.

Quando todos os dez critérios estiverem atendidos, a Fase C é considerada concluída e o Útera está pronto para avançar à Fase D (badges consumindo o Motor de Atenção).

---

## Roadmap de continuidade

- **Fase D** — Badges consumindo Catálogo + Motor de Atenção, substituindo queries diretas às tabelas clínicas.
- **Fase E** — Push Notifications como nova superfície consumidora da Camada de Interpretação.
- **Fase F** — E-mail digest e individual, execução server-side reutilizando o Motor de Atenção portável.
- **Fase G** — WhatsApp, canal restritivo com política declarada no Catálogo por tipo.
- **Fase H+** — Preferências do usuário, silenciamento, agrupamento adaptativo, dashboards analíticos.

Cada uma dessas fases adiciona **um novo consumidor** da Camada de Interpretação. Nenhuma exige mudança na tabela `eventos`, no Motor de Eventos, no Event Builder, nem nas superfícies já entregues. Esse é o retorno arquitetural da separação estabelecida na Fase C.
