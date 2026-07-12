# Arquitetura da Atenção do Útera — V2

> Documento de referência arquitetural da evolução da Arquitetura da Atenção do Útera.
> V2 estende a V1 (Fase C) preservando seu eixo conceitual: **atenção como domínio único**.
> Consolidado antes de qualquer implementação.
> Documento irmão de `CENTRAL_EVENTOS_ARQUITETURA_V1.md`, `MOTOR_EVENTOS_CONVENCOES_V1.md` e `HOMOLOGACAO_FASE_C.md`.
> Data de referência: julho de 2026.

---

## 1. De onde partimos e o que muda

A V1 da Arquitetura da Atenção foi homologada na Fase C. Ela estabeleceu:

- O **Motor de Eventos** como fonte de verdade dos acontecimentos clínicos.
- A **Camada de Interpretação** — Catálogo de Tipos, Motor de Atenção, Event Resolver — como política única de organização da atenção.
- A **Central** como primeira superfície consumidora dessa política.

A V1 provou, com o tipo `feedback_enviado` percorrendo o sistema de ponta a ponta, que a separação entre **fato**, **atenção** e **superfície** era arquiteturalmente sustentável.

A V2 responde à próxima pergunta natural:

> Quando adicionarmos Badge, Push, E-mail e WhatsApp, essas coisas são novas features ou são novas materializações da mesma atenção?

A resposta desta arquitetura é definitiva: são novas **materializações**. O domínio permanece um só. O que muda não é a arquitetura — é o vocabulário de superfícies que a arquitetura precisa acomodar.

---

## 2. Atenção como domínio único

O eixo da arquitetura do Útera não é notificação. Não é canal. Não é entrega. É **atenção**.

Atenção é o recurso escasso da paciente. Cada elemento visual, sonoro ou textual que competir por esse recurso pertence ao mesmo domínio — e precisa ser regido pela mesma política. Tratar Push como um sistema separado de "notificações" recria, em outro lugar, a decisão que a Fase C já tomou uma vez: onde vive a política sobre o que merece atenção.

**A resposta continua sendo:** a política vive no Motor de Atenção. Sempre. Independentemente de a materialização ser um card na Central, um número no Badge, uma vibração no telefone, um assunto na caixa de entrada ou uma mensagem no WhatsApp.

Consequência permanente desse princípio:

- **Não existem "canais" com política própria.** Todo canal é superfície. Toda superfície consome a mesma política.
- **Não existem sistemas paralelos de notificação.** Push, E-mail e WhatsApp não são recriações do Motor de Atenção com nomes diferentes — são leitores autorizados dele.
- **Não existem preferências de canal desconectadas da política.** Preferências alimentam o Motor de Atenção; nunca vivem em silos por canal.
- **Silêncio continua sendo resultado válido.** Uma superfície que não materializa nada porque a política decidiu por silêncio não é falha — é comportamento correto.

---

## 3. Superfície de atenção — definição

Uma **superfície de atenção** é qualquer materialização, para uma paciente ou nutricionista, de um item da política de atenção.

Central é superfície. Badge é superfície. Push é superfície. E-mail é superfície. WhatsApp é superfície. Uma futura chamada de voz seria superfície. Um cartão físico impresso e enviado por correio seria superfície.

O que caracteriza uma superfície de atenção:

- **Consome a política de atenção.** Não a decide.
- **Materializa um item já resolvido.** Título, conteúdo, estado — nada disso é definido pela superfície.
- **Respeita as preferências que a política já aplicou.** Não filtra por conta própria depois.
- **Reporta seu estado à arquitetura, quando aplicável.** Superfícies emissivas registram entregas; superfícies observacionais registram leitura via o Motor de Eventos, como já fazem hoje.

O que uma superfície de atenção **não é**:

- Não é o dono do conteúdo. O conteúdo canônico vive no Catálogo de Atenção.
- Não é o dono da regra. A regra de exibição vive no Motor de Atenção.
- Não é o dono da entrega. A execução vive nos Adapters de Canal.

Superfície é o ponto de contato com a paciente. Nada mais.

---

## 4. Superfícies observacionais × emissivas — dois tipos, uma arquitetura

Superfícies de atenção têm duas naturezas distintas. Essa distinção **não cria duas arquiteturas**. Ela apenas nomeia dois modos de materialização dentro da mesma arquitetura.

**Superfícies observacionais.**

- Central da paciente, Central da nutri, Badge.
- Não têm entrega. Existem como projeção do estado atual.
- A paciente abre o app, a superfície consulta a política, renderiza o que a política disse.
- Se a paciente nunca abrir, a superfície nunca renderiza — e isso está correto.
- Não podem "falhar em entregar". Ou renderizam, ou não são invocadas.
- Rastreamento de estado: usa o próprio `status` do evento (`ativo`, `lido`, `encerrado`).

**Superfícies emissivas.**

- Push, E-mail, WhatsApp.
- Têm entrega. Um adapter dispara, uma vez, contra um sistema externo.
- Podem falhar. Retries importam. "Já foi entregue?" precisa ser resposta rastreável.
- São efeito colateral: no instante em que o evento é criado (ou em que uma decisão temporal manda emitir), algo é emitido para fora.
- Rastreamento de estado: usa uma nova tabela — `evento_entregas` — que grava intenção e resultado de cada emissão.

**O que separa as duas categorias:**

| Dimensão | Observacional | Emissiva |
|---|---|---|
| Direção | Puxa (leitura sob demanda) | Empurra (execução no ato) |
| Estado | Deriva do evento | Deriva do registro de entrega |
| Falha possível | Não renderizar | Não entregar |
| Rastreabilidade | Estado do evento | Linha em `evento_entregas` |
| Momento | Leitura da superfície | Criação do evento (ou schedule) |

**O que une as duas categorias:**

Ambas são **superfícies** — consumidoras da política de atenção. Ambas são regidas pelo Motor de Atenção. Ambas puxam conteúdo do Catálogo de Atenção. Ambas obedecem às Preferências de Atenção da paciente. Nenhuma decide política.

A distinção observacional × emissiva é interna à camada de superfícies — não bifurca a arquitetura acima delas.

---

## 5. Motor de Atenção como política única

Na V1, o Motor de Atenção decidia como um evento se transformava em item de atenção **da Central**. Na V2, o Motor de Atenção decide como um evento se transforma em item de atenção **para toda superfície elegível** — Central, Badge, Push, E-mail, WhatsApp.

O escopo cresce. O eixo não muda.

**Perguntas que o Motor de Atenção passa a responder por evento:**

- Em quais superfícies este evento existe para esta paciente?
- Em qual bucket, com qual ordem, com qual destaque?
- Com qual projeção de conteúdo em cada superfície?
- Sujeito a quais preferências dinâmicas da paciente?

**Entradas do Motor de Atenção V2:**

- Conjunto de eventos (ou um evento individual, na criação).
- Contexto: destinatário, superfície-alvo (ou "todas as elegíveis"), momento.
- Implícito: Catálogo de Atenção estendido.
- Implícito: Preferências de Atenção da paciente.

**Saídas do Motor de Atenção V2:**

- Para consultas de superfície observacional: eventos decorados com bucket, ordem, destaque, chave de agrupamento e projeção de conteúdo para aquela superfície.
- Para resolução em momento de criação: mapa `superfície emissiva → deve emitir?`, e, quando `sim`, projeção de conteúdo para aquela superfície (título curto, corpo curto, template, variáveis).

**Regras invariantes preservadas da V1:**

- Determinismo — nada de aprendizado, nada de inferência estatística.
- Determinismo temporal — mesma entrada, mesmo momento, mesma saída.
- Fail-safe diante de tipo desconhecido, referência desconhecida ou superfície desconhecida.
- Nenhuma persistência de política — o motor não guarda estado.
- Nenhuma escrita direta em tabelas clínicas nem em `eventos`.

**Regras novas da V2:**

- Consulta Preferências de Atenção da paciente antes de decidir superfícies emissivas.
- Se o Catálogo declara conteúdo para uma superfície, o Motor devolve esse conteúdo resolvido; se não declara, a superfície é considerada não elegível para aquele tipo.
- Se as Preferências desligam uma superfície, o Motor não a inclui na saída — sem exceção, sem log de erro, apenas silêncio válido.

---

## 6. Catálogo de Atenção estendido — conteúdo por superfície

O Catálogo de Tipos da V1 declarava, por tipo: natureza, categoria, origem, título, verbo, schema de metadata, peso base. Na V2, ele passa a declarar também **projeções de conteúdo por superfície**.

**Estrutura declarativa por tipo (V2):**

- Campos herdados da V1 — inalterados.
- **Elegibilidade de superfícies:** conjunto de superfícies em que este tipo pode existir.
- **Projeção observacional:** conteúdo para Central e Badge — herdado do título canônico e do bucket, sem mudança.
- **Projeção push:** título curto (limite de caracteres), corpo curto, categoria de push.
- **Projeção email:** assunto, preview text, corpo canônico.
- **Projeção whatsapp:** identificador de template aprovado, mapa de variáveis.

**Princípio da declaração estática.**

O Catálogo continua sendo puramente declarativo. Ele descreve o que existe. Não computa. Não decide política. Não sabe da paciente concreta. Não conhece Preferências.

Se um tipo não declara projeção para uma superfície, ele é intrinsecamente inelegível para aquela superfície. Isso é intencional — o Catálogo é o vocabulário permitido.

**Portabilidade.**

O Catálogo permanece livre de dependências de ambiente. Isso é ainda mais crítico na V2, porque agora o Catálogo será consumido também por edge functions server-side (adapters de push, email, whatsapp).

**Limite crítico.**

O Catálogo permanece a única fonte de verdade sobre tipos. Adicionar Push a um tipo existente é **uma edição no Catálogo** — não é uma mudança na Central, no Motor de Atenção, nos Adapters ou nas Preferências. A cadeia inteira herda a nova elegibilidade a partir da declaração.

---

## 7. Preferências de Atenção — configuração dinâmica da paciente

Preferências de Atenção é o modelo de dados novo introduzido na V2. Ele carrega a face **dinâmica** da política, complementando a face **estática** do Catálogo.

**O que Preferências de Atenção descreve:**

- Por paciente, por **categoria de atenção** (vocabulário definido no Catálogo — ver Apêndice A), para cada superfície emissiva declarável, um estado de habilitação (`ligada` | `desligada`).
- Reservado para fases futuras: granularidade por horário (quiet hours), por frequência, por remetente.

**Granularidade do modelo — por categoria de atenção, não por tipo.**

A tabela `preferencias_atencao` tem chave lógica composta `(paciente_id, categoria_atencao)`. A paciente consente ou dispensa uma **categoria** inteira — não um tipo específico. Assim, quando novos tipos são adicionados ao Catálogo dentro de uma categoria já autorizada, eles herdam automaticamente o consentimento existente; quando surge uma categoria nova, ela nasce desligada e exige opt-in próprio.

Essa granularidade evita dois problemas simétricos:

- **Excesso de configuração:** obrigar a paciente a autorizar tipo-a-tipo (feedback, material, orientação, documento…) transformaria a tela de Preferências em painel de auditoria. A paciente não pensa em `feedback_enviado` — pensa em "comunicação da minha nutri".
- **Consentimento genérico enganoso:** reduzir tudo a um switch único ("push do Útera on/off") faz com que uma autorização dada hoje para receber feedback seja silenciosamente reinterpretada, no futuro, como autorização para receber lembretes, suplementos e rastreios — interrupções qualitativamente diferentes. A paciente teria consentido com algo que não conhecia.

Categoria de atenção é o nível certo de granularidade: agrupa o suficiente para ser inteligível para a paciente e específico o bastante para preservar o contrato de opt-in ao longo da evolução do sistema.

**O que Preferências de Atenção não é:**

- Não é configuração de UI. Não vive no frontend.
- Não é lida diretamente por superfícies. Só o Motor de Atenção a consulta.
- Não silencia eventos — silencia superfícies. Um evento silenciado em Push ainda aparece na Central se a Central for elegível.
- Não substitui o `status` do evento. Preferência decide se emite; `status` decide se ainda vale exibir.

**Consequência arquitetural.**

Preferência de canal deixa de ser configuração de UI e passa a ser configuração da política de atenção. Uma paciente que diga "não quero Push, quero só E-mail" está reconfigurando **quais superfícies pertencem à sua política de atenção** — não está desligando uma feature.

Essa formulação é o que preserva a coerência do eixo: mesmo a preferência do usuário é lida como um input da política única, nunca como um flag distribuído por vários canais.

**Default no MVP — decisão arquitetural permanente.**

Toda superfície emissiva nasce **desligada** para toda paciente, em **todas as categorias de atenção**. O opt-in é explícito, obrigatório e por-categoria: nenhuma superfície emissiva pode ser ativada sem consentimento consciente da paciente sobre a categoria específica. Silêncio é o comportamento default do sistema — coerente com o princípio "silêncio é resultado válido" da Fase C, agora elevado ao nível de superfície emissiva e de categoria.

Esta é decisão de arquitetura, não de configuração de produto. Nenhuma implementação futura da V2 pode inverter esse default sem revisar este documento. Push, E-mail e WhatsApp permanecem intrinsecamente opt-in — nunca opt-out — enquanto a Arquitetura da Atenção do Útera existir. Categorias novas que passarem a existir no Catálogo entram automaticamente desligadas para toda paciente e exigem consentimento próprio.

---

## 8. `evento_entregas` — estado de execução, não política

`evento_entregas` é a nova tabela introduzida pela V2. Ela grava **intenção e resultado de emissão** por superfície emissiva.

**Estrutura conceitual (não normativa neste documento):**

- Referência ao `evento`.
- Superfície emissiva alvo (`push` | `email` | `whatsapp`).
- Estado atual (`pendente` | `enviado` | `falhou`).
- Timestamps de criação, tentativa, entrega.
- Payload emitido (para auditoria e retries).
- Erro estruturado (quando falhou).

**Uma linha por par (evento × superfície emissiva).**

Se o Motor de Atenção decidir, no momento de criação de um evento, que ele deve ir para Push e E-mail mas não para WhatsApp, a tabela ganha **duas linhas**: uma para Push, uma para E-mail. Não ganha linha para WhatsApp — a ausência de linha é a expressão de que aquela superfície não é elegível.

**O que `evento_entregas` NÃO é:**

- **Não é política.** A tabela só grava o que a política já decidiu.
- **Não é fonte de verdade da atenção.** A fonte de verdade é `eventos`.
- **Não é canal.** É estado interno da arquitetura, não conhece Firebase, APNs, SMTP nem Meta.
- **Não é o que a Central lê.** Central lê `eventos` como sempre.

**Idempotência.**

`(evento_id, superficie)` é a chave lógica de idempotência da emissão. Duas tentativas de gravar a mesma linha resultam em uma única linha — mesma disciplina do `dedup_key` do Motor de Eventos, aplicada agora à camada de emissão.

**Retenção.**

Registros de entrega são preservados para auditoria. A política de retenção fica em aberto para fases futuras — não é decisão do MVP.

---

## 9. Adapters de Canal — executores sem lógica

Adapters de Canal são os componentes **mais burros** da arquitetura da V2 — e é isso que os torna arquiteturalmente saudáveis.

**O que um adapter faz:**

- Recebe uma linha de `evento_entregas` já resolvida (payload pronto, superfície alvo definida).
- Chama o provedor externo daquela superfície (Firebase, APNs, SMTP, Meta).
- Reporta o resultado de volta à tabela (`enviado`, `falhou`, timestamp).

**O que um adapter não faz:**

- Não decide se deve emitir — a decisão já foi tomada pelo Motor de Atenção.
- Não formata conteúdo — o conteúdo veio pronto do Catálogo, resolvido pelo Motor.
- Não conhece paciente. Só conhece endereço de entrega (device token, e-mail, número).
- Não conhece preferências. Se recebeu a linha, é porque a preferência foi respeitada acima.
- Não conhece outros adapters. Não coordena com eles.
- Não sabe se o evento é `feedback_enviado`, `check_in_recebido` ou outro tipo. Só sabe o payload.

**Um adapter por superfície emissiva.**

Push Adapter, E-mail Adapter, WhatsApp Adapter. Cada um é implementação de uma interface homogênea: `entregar(linha_de_entrega) → resultado`. A interface é o contrato; o resto é implementação específica.

**Portabilidade e localização.**

Adapters de canal vivem no servidor (edge functions Supabase, workers dedicados ou serviços externos). O frontend não conhece adapters. Adapters não conhecem o frontend.

---

## 10. Disciplina anti-imperativa do Motor de Atenção

O crescimento de escopo do Motor de Atenção na V2 introduz um risco novo: **o motor pode virar imperativo em vez de declarativo**.

Se o motor começar a acumular ifs do tipo *"se canal Push e horário 22h e paciente é premium e evento é feedback e feedback foi editado nas últimas 24h..."*, a arquitetura perde a elegância que a Fase C conquistou.

**Regra permanente da V2:**

> O Motor de Atenção só sabe **declarações**. Ele lê Catálogo, lê Preferências, lê estado do evento, e devolve resolução.

**Sinal de alerta:**

Toda vez que uma decisão pareça exigir código imperativo dentro do Motor de Atenção, isso é sinal de que **falta uma declaração** no Catálogo ou nas Preferências. A evolução correta é aumentar o vocabulário declarativo — nunca meter lógica no motor.

**Exemplos concretos dessa disciplina:**

- Quiet hours não é um `if` no motor — é um campo declarativo em Preferências.
- Fallback push → email não é um `if` no motor — é uma declaração no Catálogo por tipo, ou uma política declarativa separada.
- Frequência máxima não é um `if` no motor — é uma declaração no Catálogo ou uma tabela de contagem consultada declarativamente.
- Agrupamento entre tipos afins não é um `if` no motor — é um campo `chave_agrupamento` declarativo no Catálogo.
- Ordem de exibição, agrupamento de push e comportamento sob quiet hours não são cálculos — leem uma propriedade declarativa `prioridade` do Catálogo (valores canônicos: `alta | media | baixa`).
- Escopo de opt-in não é um `if` no motor — é a propriedade declarativa `categoria_atencao` do Catálogo cruzada com a linha correspondente de Preferências de Atenção.

Quando não houver como declarar, e a decisão for genuinamente imperativa, isso deve virar **uma discussão arquitetural** — não uma linha de código escondida no motor.

Essa disciplina é a única coisa que sustenta a promessa de que o Motor de Atenção continua sendo **política única, e não caixa de regras específicas**.

---

## 11. Dois gatilhos temporais

O Motor de Atenção V2 é invocado em dois momentos temporais distintos. A função é a mesma — a política é uma só. Só o gatilho muda.

**Gatilho 1 — Criação do evento.**

- Momento: imediatamente após o Event Builder registrar um novo evento em `eventos`.
- Objetivo: resolver quais superfícies **emissivas** devem receber o evento agora.
- Ação: para cada superfície emissiva elegível (Catálogo × Preferências), grava uma linha em `evento_entregas` com payload resolvido pelo Motor.
- Best-effort: se o Motor falhar aqui, o evento clínico está salvo, a Central ainda funciona, apenas as superfícies emissivas não disparam. Aceitável.

**Gatilho 2 — Leitura por superfície observacional.**

- Momento: quando a Central ou o Badge são renderizados.
- Objetivo: resolver a projeção observacional dos eventos do destinatário.
- Ação: o Motor devolve os eventos decorados por bucket, ordem, destaque e projeção. Superfície renderiza.
- Já é o comportamento da V1.

**O que NÃO é gatilho temporal do Motor:**

- Não há gatilho por schedule regular no MVP (nada de "roda o motor a cada hora"). Isso pode existir em fases futuras (digest de e-mail) mas não é premissa da arquitetura.
- Não há gatilho por mudança de status. Quando o evento vira `lido`, `encerrado` ou `cancelado`, superfícies observacionais deixam de exibi-lo naturalmente (query filtra). Nenhuma reemissão é necessária. Nenhuma superfície emissiva se retrata.

**Coordenação inter-gatilhos.**

A coordenação é feita pelo próprio `status` do evento (herdado da V1) e pelo `estado` da linha em `evento_entregas` (novo). O Motor de Atenção não precisa se lembrar do que já disparou — a resposta está sempre nas tabelas. Isso preserva o princípio de que o motor não persiste estado.

---

## 12. Arquitetura em camadas — diagrama V2

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
      │  · Catálogo de Atenção (estático)           │
      │  · Preferências de Atenção (dinâmico) [V2]  │
      │  · Motor de Atenção (política única)        │
      │  · Event Resolver                           │
      └────────────────────┬────────────────────────┘
                           │
        ┌──────────────────┴──────────────────┐
        │                                     │
        ▼                                     ▼
┌────────────────────────┐        ┌─────────────────────────┐
│  SUPERFÍCIES           │        │  SUPERFÍCIES            │
│  OBSERVACIONAIS        │        │  EMISSIVAS         [V2] │
│                        │        │                         │
│  · Central paciente    │        │  · Push                 │
│  · Central nutri       │        │  · E-mail               │
│  · Badge               │        │  · WhatsApp             │
│                        │        │                         │
│  Consultam a política  │        │  Materializadas via     │
│  sob demanda           │        │  evento_entregas        │
└────────────────────────┘        └────────────┬────────────┘
                                               │
                                               ▼
                                  ┌─────────────────────────┐
                                  │   evento_entregas [V2]  │
                                  │   (estado de execução)  │
                                  └────────────┬────────────┘
                                               │
                                               ▼
                                  ┌─────────────────────────┐
                                  │   ADAPTERS DE CANAL[V2] │
                                  │                         │
                                  │  Push · E-mail ·        │
                                  │  WhatsApp               │
                                  │                         │
                                  │  Executores sem lógica  │
                                  └─────────────────────────┘
```

**Responsabilidades por camada — o que muda na V2:**

- **Dados Clínicos:** inalterado.
- **Motor de Eventos:** inalterado.
- **Camada de Interpretação:** ganha Preferências de Atenção; o Motor de Atenção expande escopo mas preserva disciplina.
- **Superfícies:** ganham categorização (observacional × emissiva); Central e Badge inalteradas em contrato.
- **`evento_entregas`:** novo. Estado de execução, não política.
- **Adapters de Canal:** novo. Execução, não política.

---

## 13. MVP da V2 — Push com `feedback_enviado`

O MVP da V2 valida a forma da arquitetura com o mesmo tipo que validou a V1: `feedback_enviado`.

**Escopo mínimo do MVP:**

- **Um tipo:** `feedback_enviado`.
- **Uma superfície emissiva ativada:** Push.
- **Uma preferência:** push on/off por paciente.
- **Uma tabela nova:** `evento_entregas`.
- **Um adapter:** Push Adapter (com implementação técnica ainda a definir em documento próprio).
- **Uma extensão de Catálogo:** projeção push para `feedback_enviado` (título curto, corpo curto).
- **Um gatilho novo:** invocação do Motor de Atenção em modo emissivo na criação do evento.

**O que o MVP faz:**

- Nutri envia feedback → Event Builder cria evento como hoje.
- Motor de Atenção é invocado em modo emissivo.
- Motor consulta Catálogo: `feedback_enviado` declara projeção push? Sim.
- Motor consulta Preferências: essa paciente tem push ligado? Se sim → grava linha em `evento_entregas` para Push.
- Push Adapter (server-side) lê a linha, dispara, reporta resultado.
- Central da paciente continua funcionando como na V1, inalterada.

**O que o MVP NÃO faz:**

- Não implementa E-mail nem WhatsApp — apenas os declara como superfícies futuras no Catálogo com projeção vazia.
- Não implementa fallback push → email.
- Não implementa batching, digest, quiet hours, prioridades cross-canal.
- Não implementa preferências granulares por categoria ou horário.
- Não implementa retries automáticos — falha é `falhou`, ponto.
- Não implementa Badge. Badge permanece como capítulo próprio (Fase D no roadmap original), em documento e homologação separados. A V2 tem foco em Push como primeira superfície emissiva; Badge é superfície observacional e evolui em outra frente.

**Princípio de contenção do MVP:**

Toda sofisticação de política é tentação. A regra da V1 se aplica: **sofisticação entra na Camada de Interpretação, não nas superfícies**, e apenas quando o segundo consumidor pedir. E-mail e WhatsApp são o "segundo consumidor" que justificará expansão real.

---

## 14. Homologação da V2 — critérios de aceitação

A V2 da Arquitetura da Atenção está concluída quando:

1. **Documentação:** este documento está publicado na raiz do projeto como referência oficial.
2. **Catálogo de Atenção estendido:** `feedback_enviado` declara projeção push (título curto, corpo curto) além dos campos já existentes.
3. **Preferências de Atenção:** modelo de dados criado, com um único campo funcional — push on/off por paciente. Default: desligado.
4. **`evento_entregas`:** tabela criada, com estrutura mínima (evento, superfície, estado, timestamps, payload, erro).
5. **Motor de Atenção V2:** função de resolução em modo emissivo implementada e integrada ao gatilho de criação.
6. **Push Adapter:** implementação técnica que consome `evento_entregas`, dispara contra o provedor de push e reporta resultado.
7. **Fluxo homologado:** nutri envia feedback para paciente com push ligado → paciente recebe notificação; nutri envia feedback para paciente com push desligado → nenhuma notificação; falha simulada do provedor → linha `evento_entregas` marcada como `falhou`, operação clínica preservada.
8. **Central inalterada:** Central da paciente continua funcionando exatamente como após a Fase C, sem regressão.
9. **Ausência de política nos adapters:** Push Adapter não contém nenhuma condicional que decida se deve emitir. Auditoria de código confirma.
10. **Ausência de política em `evento_entregas`:** a tabela é apenas estado; nenhuma view, trigger ou constraint decide política. Auditoria de banco confirma.
11. **Preservação da disciplina anti-imperativa:** revisão do Motor de Atenção V2 confirma que toda decisão é resolvida por leitura declarativa (Catálogo, Preferências, estado do evento), sem lógica específica de canal.
12. **Homologação de produto:** documento próprio `HOMOLOGACAO_ATENCAO_V2.md` preparado nos mesmos moldes de `HOMOLOGACAO_FASE_C.md`, cobrindo blocos técnicos, de produto e de hipóteses. O nome evita conflito com a Fase D reservada ao Badge — a V2 é uma evolução da Arquitetura da Atenção, não a Fase D do roadmap original.

Quando todos os doze critérios estiverem atendidos, a V2 é considerada homologada e o Útera está apto a receber as superfícies emissivas subsequentes.

---

## 15. Decisões que ficam fora do MVP da V2

Explicitamente **não** integram a V2 MVP:

- **E-mail** como superfície emissiva ativa (declarada no Catálogo, não implementada).
- **WhatsApp** como superfície emissiva ativa (declarada no Catálogo, não implementada).
- **Badge consumindo Motor de Atenção** (Fase D independente, mesmo escopo arquitetural).
- **Fallback cross-canal** (push falhou → email 30min depois).
- **Coordenação entre canais** (se WhatsApp foi lido, cancela email).
- **Quiet hours e frequência máxima.**
- **Preferências granulares** (por categoria, por horário, por remetente).
- **Digest / batching** de E-mail e WhatsApp.
- **Retries automáticos** de entregas falhadas.
- **Realtime na Central** (herdado da lista da V1, permanece fora).
- **Política de retenção** de `evento_entregas`.
- **Templates WhatsApp** aprovados na Business API.

Cada uma dessas decisões tem espaço arquitetural reservado. Nenhuma entra no MVP. A regra da V1 permanece: **sofisticação entra na Camada de Interpretação, não nas superfícies, e apenas quando o segundo consumidor pedir**.

---

## 16. Aplicabilidade temporal — a V2 não retroage

A arquitetura de emissão da V2 aplica-se **apenas a eventos criados após o seu deploy**. Não há backfill.

**O que isso significa concretamente:**

- Eventos criados antes do deploy da V2 continuam existindo em `eventos`, com estado e conteúdo intactos.
- Esses eventos continuam sendo consumidos pela Central e por futuras superfícies observacionais normalmente, sem regressão.
- Nenhuma linha em `evento_entregas` é gerada retroativamente para eventos históricos.
- Nenhuma emissão de Push, E-mail ou WhatsApp é disparada com base em eventos anteriores ao deploy.

**Justificativa arquitetural:**

- Backfill de Push seria intrusivo — pacientes receberiam notificações sobre feedbacks antigos que já leram na Central, quebrando o contrato de "silêncio é resultado válido".
- Backfill de E-mail ou WhatsApp seria inconsistente — o consentimento explícito exigido pela V2 não pôde existir no passado, logo qualquer emissão retroativa violaria o próprio princípio de opt-in permanente da arquitetura.
- Backfill introduziria descontinuidade histórica na tabela `evento_entregas` — algumas linhas com timestamps que não correspondem ao momento real da entrega, poluindo a auditoria futura.

**Consequência operacional:**

O corte é temporal e absoluto: `evento.criado_em >= deploy_v2_timestamp`. Eventos criados um segundo antes do deploy pertencem ao mundo pré-V2 e nunca serão emitidos. Eventos criados um segundo depois entram na arquitetura de emissão pela primeira vez.

A V2 é uma arquitetura para o presente em diante — não uma releitura do passado.

---

## 17. Roadmap de evolução — sem colocar canais no centro

A evolução da V2 segue princípio inverso ao roadmap tradicional de "features de notificação". Cada passo adiciona **uma capacidade da política**, não um canal:

- **V2.0 — MVP:** Push como primeira superfície emissiva. Um tipo, uma preferência, um adapter.
- **V2.1 — Preferências granulares:** paciente pode desligar push por categoria (ex: só quer push para acionáveis, não para informativos). Extensão declarativa em Preferências.
- **V2.2 — Segunda superfície emissiva (E-mail):** valida a abstração. Se E-mail entrar sem tocar em Motor, Catálogo estrutural ou Central, a arquitetura da V2 se confirma.
- **V2.3 — Política de silêncio temporal:** quiet hours, frequência máxima. Declarativas em Preferências, consumidas pelo Motor.
- **V2.4 — Coordenação entre superfícies:** política declarativa por tipo — "se push já foi entregue e lido, não emitir email". Declarada no Catálogo, aplicada pelo Motor.
- **V2.5 — WhatsApp:** superfície emissiva mais complexa (templates aprovados, janela de 24h). Mesma arquitetura, adapter mais elaborado.
- **V2.6 — Digest / batching:** para superfícies onde emissão imediata é ruído, política declarativa de agrupamento temporal.
- **V2.7+ — Retenção, analytics, dashboards de entrega:** consumidores adicionais da tabela `evento_entregas`.

**O que este roadmap NÃO faz:**

- Não trata cada canal como projeto próprio.
- Não cria "sistema de push", "sistema de email", "sistema de whatsapp" independentes.
- Não coloca canais como eixo do planejamento.

Cada passo é uma expansão declarativa da política única. Cada canal é apenas o adapter necessário para materializar essa política em mais uma superfície. **O eixo permanece atenção.**

---

## 18. Relação com a V1 — o que permanece intacto

Este documento estende a V1 sem invalidar nenhuma de suas decisões. Especificamente:

- **Definição da Central** (V1 §1–§3): intacta. Central continua sendo superfície observacional de orquestração da atenção.
- **Distinção evento × atenção × superfície** (V1 §4): intacta. A V2 apenas nomeia dois tipos de superfície.
- **Motor de Eventos** (V1 §5, `MOTOR_EVENTOS_CONVENCOES_V1.md`): intacto. Continua sendo fonte de verdade dos acontecimentos.
- **Event Resolver** (V1 §7.3): intacto. Continua resolvendo navegação para superfícies observacionais.
- **Best-effort e fail-safe** (V1 §7.2): estendidos para a nova camada de emissão. Falha em adapter não derruba operação clínica; falha em Motor emissivo não derruba criação de evento.
- **Portabilidade** (V1 §7.1, §7.2): reforçada. Catálogo e Motor precisam ser importáveis por edge functions agora — deixa de ser reserva para o futuro e vira requisito imediato do MVP da V2.
- **Homologação da Fase C** (`HOMOLOGACAO_FASE_C.md`): permanece marco histórico. A V2 não a invalida — herda-a como base sobre a qual constrói.

**Regressões proibidas.**

Nenhuma implementação da V2 pode:

- Modificar a Central de forma que ela deixe de ser superfície observacional pura.
- Introduzir política em superfícies (observacionais ou emissivas).
- Criar caminhos de emissão que contornem o Motor de Atenção.
- Persistir política em `evento_entregas`.
- Espalhar preferências por múltiplas tabelas específicas de canal.

Qualquer proposta que viole esses limites é sinal de que a arquitetura está sendo distorcida — e deve ser rediscutida, não implementada.

---

## Encerramento

A V2 da Arquitetura da Atenção não é um sistema novo. É a mesma arquitetura da V1, agora com vocabulário suficiente para acomodar superfícies que empurram — não só superfícies que puxam.

O ganho arquitetural não vem de código. Vem de disciplina:

- Atenção continua sendo o eixo.
- Superfícies continuam sendo consumidoras.
- Política continua vivendo em um único lugar.
- Silêncio continua sendo resultado válido.

Quando esse documento for a referência sob a qual o primeiro Push do Útera for construído, a implementação será consequência natural — como foi a Central na V1.

---

# Apêndice A — Vocabulário planejado de eventos e sequência de sprints

Este apêndice consolida o roadmap de eventos que a Arquitetura da Atenção V2 vai acomodar, distinguindo os que nascem de ações humanas dos que dependem de condições temporais. É documento vivo — cada sprint concreta a fatia correspondente e o apêndice permanece como referência do que ainda está por vir.

**Nada aqui está implementado além de `feedback_enviado`.** Este apêndice descreve intenção arquitetural, não estado corrente.

**Disciplina permanente do Catálogo:** o `catalogoTipos.js` reflete apenas capacidades implementadas — tipos com consumidor real no código. Este apêndice registra também capacidades planejadas: tipos que virão, categorias reservadas, políticas declarativas antecipadas. O momento em que uma linha deste apêndice entra no Catálogo é o momento em que a sprint correspondente começa.

---

## A.1 Duas naturezas de origem dos eventos

Todo evento em `eventos` nasce em um de dois modos:

**Acontecimentos imediatos.**
Uma ação humana no ato — nutri clica em salvar, atribui um material, publica uma orientação; ou uma paciente completa uma resposta. O evento é criado dentro do fluxo dessa ação, síncrono à operação clínica, pelos módulos clínicos existentes.

**Acontecimentos temporais.**
Uma condição de horário, prazo ou recorrência — chegou 8h, a consulta é amanhã, o check-in vence em duas horas, o rastreio do dia ainda não foi preenchido. Ninguém clicou; o tempo passou. Estes exigem um novo produtor: o **Scheduler**.

Esta distinção é do produtor, não do consumidor. Uma vez que o evento existe em `eventos`, a Camada de Interpretação e as superfícies não distinguem sua origem — atenção é atenção.

---

## A.2 Scheduler como novo produtor temporal

O Scheduler é a próxima capacidade arquitetural a ser introduzida. Ele:

- **Vive fora da Arquitetura da Atenção** — é módulo produtor, comparável aos módulos clínicos.
- **Só cria eventos.** Consulta `criar_evento` como qualquer outro módulo. Nunca conhece `evento_entregas`, nunca conhece Adapters, nunca conhece superfícies.
- **É best-effort e idempotente.** Roda em cadência regular; se executar duas vezes na mesma janela, `dedup_key` derivada de `(tipo, referência, janela_temporal)` garante uma única linha em `eventos`.
- **Fluxo canônico:**

```
Configuração temporal
    ↓
Scheduler (Edge Function em cron)
    ↓
Motor de Eventos (RPC criar_evento)
    ↓
[eventos]
    ↓
Motor de Atenção
    ↓
Superfícies (Central, Badge, Push, ...)
```

- **Introdução em sprint própria** (V2.5) — mesmo peso arquitetural que a V2.1 teve para introduzir a Camada de Emissão. Cada capacidade arquitetural nova é validada com um único consumidor concreto antes de ser expandida.

---

## A.3 Vocabulário canônico do Catálogo — categorias de atenção e prioridade

O Catálogo, além dos campos herdados da V1 (`categoria` clínica, `origem`, `titulo`, `natureza`, `metadataSchema`) e da V2.1 (`superficies`), passa a declarar por tipo duas novas propriedades:

- **`categoria_atencao`** — a que categoria de atenção o tipo pertence, para efeito de Preferências de Atenção (§7 do corpo principal). É o eixo de opt-in visto pela paciente.
- **`prioridade`** — orientação declarativa sobre relevância relativa. Valores canônicos: `alta | media | baixa`.

Essas propriedades vivem no Catálogo — não em `eventos`, não em `evento_entregas`. São vocabulário, não estado.

**Distinção categoria clínica × categoria de atenção.**

O Útera opera com dois eixos de classificação, ortogonais e coexistentes:

- **`categoria` (herdada da V1)** — classifica o evento no domínio clínico (`comunicacao | saude | conteudo | jornada | sistema`). Usada por telas clínicas, relatórios, filtros de dado clínico. Não determina opt-in.
- **`categoria_atencao` (V2)** — classifica o evento no domínio da atenção (`comunicacao_clinica | lembretes | rastreios | reconhecimento | …`). Determina opt-in. É o eixo consumido por Preferências de Atenção.

Um mesmo tipo pode ter categoria clínica `'saude'` e categoria de atenção `'lembretes'`. Um `suplemento_horario` exemplifica: dado clínico é saúde; o tipo de atenção que ele solicita da paciente é lembrete.

**Vocabulário planejado de categorias de atenção.**

| Categoria | Descrição | Estado |
|---|---|---|
| `comunicacao_clinica` | Mensagens diretas da nutri para a paciente — feedback e, no futuro, materiais, orientações e documentos. | Ativa a partir da V2.2 |
| `lembretes` | Avisos sobre consultas, check-ins e outros compromissos. | Reservada — primeiro tipo entra na V2.4 (`checkin_disponivel`). |
| `rastreios` | Convites diários para registrar ciclo, intestino e hábitos. | Reservada — primeiros tipos entram na V2.8. |
| `reconhecimento` | Marcos, evoluções e conquistas ao longo da jornada. **Única categoria que recompensa em vez de cobrar**; regras de emissão qualitativamente distintas (mais raras, mais ricas) quando entrar. | Categoria futura — registrada nesta documentação, **ainda não presente no Catálogo**. Entra quando surgir o primeiro tipo real dela. |

O mapa `CATEGORIAS_ATENCAO` do `catalogoTipos.js` contém, em cada sprint, apenas as categorias que já têm pelo menos um tipo declarado. Categorias futuras vivem neste apêndice, não no código.

**Prioridade — reservada para consumo futuro.**

`prioridade` é declarada agora para evitar migração de Catálogo depois. Nenhum código do MVP a consome. Usos previstos (não implementados):

- Ordem de exibição intra-bucket na Central.
- Agrupamento de push (só combinar itens de prioridade próxima).
- Comportamento sob quiet hours (baixa é silenciada à noite; alta atravessa).
- Digest de e-mail (baixa e média agrupam por dia; alta chega no ato).

Sugestões de prioridade por tipo aparecem nos blocos da §A.4. São sugestões — a decisão final vive no Catálogo quando o tipo entra em uma sprint.

---

## A.4 Matriz de tipos de evento

Cada bloco descreve um tipo do vocabulário planejado. Todos usam o mesmo Catálogo declarativo. Central e Badge são superfícies observacionais implícitas para todo tipo; Push é a superfície emissiva declarada explicitamente por `superficies.push` no Catálogo.

### Comunicação nutri → paciente

**`feedback_enviado`** — *implementado*
- **Origem:** nutri salva feedback pela primeira vez em `checkin_envios`.
- **Categoria clínica:** `comunicacao`.
- **Categoria de Atenção:** `comunicacao_clinica`.
- **Natureza:** informativo.
- **Prioridade:** `media`.
- **Disparo:** imediato.
- **Encerra:** paciente abre `Checkin.jsx` (`marcar_evento_lido`).
- **Push texto:** *"Novo feedback / Sua nutricionista respondeu seu check-in."*
- **Risco de excesso:** baixo.
- **Sprint:** **V2.2** — primeiro Push real conectado à infraestrutura da V2.1.

### Publicações e atribuições

**`material_atribuido`**, **`orientacao_publicada`**, **`documento_atualizado`**
- **Origem:** ações da nutri de atribuir, publicar ou atualizar conteúdo.
- **Categoria clínica:** `conteudo` (materiais / orientações) ou `jornada` (documentos).
- **Categoria de Atenção:** `comunicacao_clinica` (herdam o mesmo opt-in de `feedback_enviado`).
- **Natureza:** informativo.
- **Prioridade sugerida:** `baixa` (conteúdo assíncrono, não bloqueia).
- **Disparo:** imediato.
- **Encerra:** paciente abre o conteúdo.
- **Risco de excesso:** médio para atribuições em lote → mitigação via dedup por sessão (`lote_id` na metadata) e agrupamento declarativo no Catálogo.
- **Sprint:** **V2.3**.

### Check-ins

**`checkin_disponivel`** — imediato
- **Origem:** `INSERT INTO checkin_envios` (via `checkinScheduler.js` existente ou envio manual).
- **Categoria clínica:** `saude`.
- **Categoria de Atenção:** `lembretes` — primeira introdução da categoria; entra desligada por default e exige opt-in próprio.
- **Natureza:** acionável.
- **Prioridade sugerida:** `media`.
- **Encerra:** paciente responde o check-in.
- **Sprint:** **V2.4**.

**`checkin_lembrete_pendente`** — temporal
- **Origem:** Scheduler detecta envio sem resposta antes do vencimento.
- **Categoria clínica:** `saude`.
- **Categoria de Atenção:** `lembretes`.
- **Natureza:** acionável.
- **Prioridade sugerida:** `alta` (prazo próximo).
- **Disparo:** uma vez por envio, N horas antes de vencer.
- **Encerra:** paciente responde ou envio vence.
- **Sprint:** **V2.6** (depende do Scheduler).

### Consultas

**`consulta_lembrete`** — temporal
- **Origem:** Scheduler varre consultas próximas.
- **Categoria clínica:** `jornada`.
- **Categoria de Atenção:** `lembretes`.
- **Natureza:** informativo.
- **Prioridade sugerida:** `alta` (compromisso marcado).
- **Disparo:** D-1 dia; opcionalmente D-1 hora.
- **Encerra:** horário da consulta passa.
- **Push texto (D-1):** *"Consulta amanhã / Amanhã às HH:MM com sua nutri."*
- **Sprint:** **V2.6** — primeiro validador do Scheduler junto com `checkin_lembrete_pendente`.

### Suplementos

**`suplemento_horario`** — temporal recorrente
- **Origem:** Scheduler cruza `plano_suplementacao` com horários configurados.
- **Categoria clínica:** `saude`.
- **Categoria de Atenção:** `lembretes` (herda o mesmo opt-in de check-ins e consultas).
- **Natureza:** acionável.
- **Prioridade sugerida:** `media`.
- **Disparo:** todo dia, nos horários configurados pela paciente.
- **Encerra:** paciente registra tomada ou janela expira.
- **Agregação obrigatória:** **um evento por horário, nunca por suplemento.** Metadata carrega a lista de suplementos daquele horário.
- **Risco de excesso:** crítico sem agregação. Ver §A.6.
- **Sprint:** **V2.7**.

### Rastreios diários

**`rastreio_lembrete_ciclo`**, **`rastreio_lembrete_intestino`**, **`rastreio_lembrete_habitos`** — temporais recorrentes
- **Origem:** Scheduler diário, no horário configurado pela paciente.
- **Categoria clínica:** `saude`.
- **Categoria de Atenção:** `rastreios` — primeira introdução da categoria; entra desligada por default e exige opt-in próprio.
- **Natureza:** acionável.
- **Prioridade sugerida:** `baixa` (não bloqueia nada).
- **Encerra:** paciente registra o dia, ou o dia vira.
- **Agrupamento:** três tipos distintos no Catálogo, com `chave_agrupamento` compartilhada — o Motor de Atenção pode consolidar em uma única emissão push quando coincidirem na mesma janela, preservando vocabulário rico e evitando excesso.
- **Sprint:** **V2.8**.

---

## A.5 Sequência aprovada de sprints da V2

| Sprint | Escopo | Introduz capacidade nova? |
|---|---|---|
| **V2.0** | Documento arquitetural | Fundação conceitual |
| **V2.1** | Infraestrutura de emissão (`evento_entregas` + RPC + Catálogo estendido) | Camada de Emissão |
| **V2.2** | Primeiro Push real com `feedback_enviado` | Preferências de Atenção por categoria (`comunicacao_clinica`) + Adapter Push + Service Worker + Prompt educativo |
| **V2.3** | `material_atribuido`, `orientacao_publicada`, `documento_atualizado` (todos em `comunicacao_clinica`) | Atualizações imediatas herdando opt-in existente |
| **V2.4** | `checkin_disponivel` | Primeira introdução da categoria `lembretes` — opt-in próprio |
| **V2.5** | **Scheduler** como produtor temporal | Novo módulo produtor |
| **V2.6** | `consulta_lembrete` + `checkin_lembrete_pendente` | Primeiros consumidores temporais |
| **V2.7** | `suplemento_horario` com agregação por horário | Política de agregação declarativa |
| **V2.8** | Rastreios diários (ciclo, intestino, hábitos) com agrupamento no Motor de Atenção | Primeira introdução da categoria `rastreios` + consolidação cross-tipo |

Cada sprint é validada com o mínimo de consumidores capaz de provar a arquitetura da capacidade que introduz — o mesmo princípio que fez a V2.1 usar só `feedback_enviado`.

**Nota sobre a categoria `reconhecimento`:** não tem sprint prevista neste roadmap. Entrará quando o Útera decidir explicitamente introduzir marcos e conquistas como parte da experiência. É a única categoria do vocabulário arquitetural cujo momento de entrada é dirigido por produto, não por infraestrutura.

---

## A.6 Riscos transversais reconhecidos

- **Suplementos sem agregação são inaceitáveis.** 5 suplementos × 3 horários = 15 pushes/dia — inviável. A V2.7 é obrigada a implementar agregação por horário desde o primeiro dia.
- **Rastreios diários coincidentes.** Três pushes/dia é ruído; o Motor de Atenção deve consolidar via `chave_agrupamento` declarativa no Catálogo (opção adotada).
- **Fuso horário.** MVP assume BRT (America/Sao_Paulo). Múltiplos fusos ficam para depois.
- **Cadência do cron.** `every 5 minutes` cobre a maioria dos casos; suplementos com precisão de minuto exigem `every 1 minute` com custo maior. Decisão da V2.7.
- **Idempotência do Scheduler.** Cron rodando duas vezes na mesma janela não pode gerar dois eventos. `dedup_key` derivada da janela temporal é a garantia.
- **Encerramento de eventos temporais.** Um `suplemento_horario` das 8h não faz sentido às 14h. Auto-encerramento após janela evita poluição da Central. Decisão da V2.7.
- **Emissão da categoria `reconhecimento`.** Quando entrar, a categoria terá regras qualitativamente distintas das demais (mais rara, mais rica, possivelmente com imagem, potencialmente noturna). Não pode simplesmente reusar a política de `comunicacao_clinica` — a Sprint que a introduzir precisa desenhar sua própria política declarativa.

---

## A.7 Nota sobre este apêndice

Este apêndice **não** modifica o corpo principal do documento (§§ 1–18). Ele estende o vocabulário de eventos e o roadmap concreto que a Arquitetura da Atenção V2 vai processar, mantendo o corpo principal como referência arquitetural estável.

Novos tipos futuros — não previstos aqui — devem ser adicionados a este apêndice antes de qualquer implementação, na mesma disciplina que a V2.1 seguiu para adicionar `feedback_enviado` ao Catálogo.

Novas categorias de atenção seguem a mesma disciplina: entram primeiro no §A.3 deste apêndice como reservadas, e só migram para o Catálogo (`CATEGORIAS_ATENCAO` em `catalogoTipos.js`) no momento em que a sprint correspondente traz o primeiro tipo consumidor.
