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

- Por paciente, para cada superfície emissiva declarável, um estado de habilitação (`ligada` | `desligada`).
- Reservado para fases futuras: granularidade por categoria, por horário (quiet hours), por frequência.

**O que Preferências de Atenção não é:**

- Não é configuração de UI. Não vive no frontend.
- Não é lida diretamente por superfícies. Só o Motor de Atenção a consulta.
- Não silencia eventos — silencia superfícies. Um evento silenciado em Push ainda aparece na Central se a Central for elegível.
- Não substitui o `status` do evento. Preferência decide se emite; `status` decide se ainda vale exibir.

**Consequência arquitetural.**

Preferência de canal deixa de ser configuração de UI e passa a ser configuração da política de atenção. Uma paciente que diga "não quero Push, quero só E-mail" está reconfigurando **quais superfícies pertencem à sua política de atenção** — não está desligando uma feature.

Essa formulação é o que preserva a coerência do eixo: mesmo a preferência do usuário é lida como um input da política única, nunca como um flag distribuído por vários canais.

**Default no MVP — decisão arquitetural permanente.**

Toda superfície emissiva nasce **desligada** para toda paciente. O opt-in é explícito e obrigatório: nenhuma superfície emissiva pode ser ativada sem consentimento consciente da paciente. Silêncio é o comportamento default do sistema — coerente com o princípio "silêncio é resultado válido" da Fase C, agora elevado ao nível de superfície emissiva.

Esta é decisão de arquitetura, não de configuração de produto. Nenhuma implementação futura da V2 pode inverter esse default sem revisar este documento. Push, E-mail e WhatsApp permanecem intrinsecamente opt-in — nunca opt-out — enquanto a Arquitetura da Atenção do Útera existir.

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
