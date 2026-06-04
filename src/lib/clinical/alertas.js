/**
 * BIBLIOTECA CLÍNICA ÚTERA — Etapas 4 e Alertas Funcionais
 *
 * Estrutura de cada alerta (Etapa 4):
 *   - correlacao:          padrão detectado
 *   - interpretacao:       tradução fisiológica
 *   - intensidade:         classificação de relevância
 *   - textoPaciente:       linguagem acolhedora, educativa (nunca patologiza)
 *   - textoNutricionista:  raciocínio clínico técnico
 *   - conscienciaCorporal: gera percepção e vínculo
 *   - microconduta:        orienta sem prescrever
 *   - gatilhoTemporal:     quando disparar
 *
 * Linguagem do app (Etapa 4):
 *   ✅ "Seu corpo está demonstrando sinais compatíveis com…"
 *   ✅ "Esse padrão pode estar associado a…"
 *   ✅ "Alguns sintomas sugerem maior oscilação…"
 *   ❌ Evitar: "Seu cortisol está desregulado", "Você tem dominância estrogênica"
 *
 * Níveis de intensidade:
 *   leve            → sintomas ocasionais / primeira ocorrência / até 2 sintomas
 *   moderado        → recorrência no ciclo / 3 sintomas relacionados
 *   importante      → impacto funcional / ≥4 sintomas / ≥2 ciclos
 *   atencao_clinica → persistente/intenso / progressão / ≥3 ciclos
 *
 * Categorias:
 *   problema          → Módulo A — desequilíbrios funcionais
 *   evolucao_positiva → Módulo B — melhoras e estabilidade
 *   associacao_rotina → Módulo C — correlações com hábitos
 */

// ─── Módulo A — Problemas Funcionais ─────────────────────────────────────────

const MODULO_A = [

  // ── 1. Alertas Glicêmicos ─────────────────────────────────────────────────

  {
    id: 'oscilacao_glicemica_noturna',
    numero: 1,
    nome: 'Oscilação Glicêmica Noturna',
    categoria: 'problema',
    eixos: ['glicemico', 'adrenal'],
    criterios: ['compulsão noturna', 'acordar de madrugada', 'fome intensa', 'irritabilidade'],
    intensidade: {
      leve:            { criterio: 'Até 2 sintomas, episódio único' },
      moderado:        { criterio: '3 sintomas ou recorrência em 2 semanas' },
      importante:      { criterio: '≥4 sintomas por ≥2 ciclos' },
      atencao_clinica: { criterio: '≥4 sintomas intensos por ≥3 ciclos' },
    },
    textoPaciente:        'Seu corpo pode estar mostrando maior instabilidade energética no período noturno.',
    textoNutricionista:   'Padrão compatível com oscilação glicêmica noturna, possivelmente associada a pico de cortisol compensatório e comportamento alimentar hedônico.',
    conscienciaCorporal:  'Nos dias de maior cansaço, sua fome noturna também tende a aumentar.',
    microconduta:         'Priorize refeições mais estruturadas e fontes de proteína ao longo do dia.',
    gatilhoTemporal:      ['Padrão recorrente em ≥3 noites por semana', 'Persistência por ≥2 semanas'],
  },

  {
    id: 'hipoglicemia_reativa',
    numero: 2,
    nome: 'Padrão Compatível com Hipoglicemia Reativa',
    categoria: 'problema',
    eixos: ['glicemico'],
    criterios: ['tremor', 'ansiedade', 'fome rápida', 'sonolência após refeições'],
    intensidade: {
      leve:            { criterio: 'Ocorrência esporádica' },
      moderado:        { criterio: 'Repetição por 2 semanas ou 1 ciclo' },
      importante:      { criterio: '≥3 sintomas associados por ≥2 ciclos' },
      atencao_clinica: { criterio: 'Progressão e impacto no cotidiano' },
    },
    textoPaciente:        'Seu organismo pode estar apresentando maior sensibilidade às oscilações glicêmicas.',
    textoNutricionista:   'Padrão compatível com hipoglicemia reativa e provável hiperinsulinemia compensatória.',
    conscienciaCorporal:  null,
    microconduta:         'Observe como refeições muito refinadas impactam sua energia e saciedade.',
    gatilhoTemporal:      ['Sintomas aparecem 2–3h após refeições ricas em carboidratos simples'],
  },

  {
    id: 'resistencia_metabolica',
    numero: 3,
    nome: 'Resistência Metabólica',
    categoria: 'problema',
    eixos: ['glicemico', 'androgenico'],
    criterios: ['dificuldade de emagrecimento', 'fome frequente', 'energia oscilante', 'acúmulo abdominal'],
    intensidade: {
      leve:            { criterio: '2 sintomas associados' },
      moderado:        { criterio: '3 sintomas por ≥1 ciclo' },
      importante:      { criterio: '4 sintomas por ≥2 ciclos' },
      atencao_clinica: { criterio: 'Progressão e impacto funcional relevante' },
    },
    textoPaciente:        'Seu metabolismo pode estar encontrando mais dificuldade para manter estabilidade energética.',
    textoNutricionista:   'Padrão compatível com resistência à insulina e pior flexibilidade metabólica.',
    conscienciaCorporal:  null,
    microconduta:         null,
    gatilhoTemporal:      ['Presente em ≥3 semanas consecutivas'],
  },

  // ── 2. Alertas Progesterona / Fase Lútea ─────────────────────────────────

  {
    id: 'sensibilidade_fase_lutea',
    numero: 4,
    nome: 'Sensibilidade da Fase Lútea',
    categoria: 'problema',
    eixos: ['progesterona', 'glicemico'],
    criterios: ['irritabilidade', 'compulsão', 'insônia', 'piora pré-menstrual'],
    intensidade: {
      leve:            { criterio: '2 sintomas' },
      moderado:        { criterio: '3 sintomas' },
      importante:      { criterio: '4 sintomas por 2 ciclos consecutivos' },
      atencao_clinica: { criterio: '4 sintomas intensos por ≥3 ciclos' },
    },
    textoPaciente:        'Seu corpo demonstra maior sensibilidade física e emocional nos dias que antecedem a menstruação.',
    textoNutricionista:   'Padrão recorrente compatível com maior vulnerabilidade neuroendócrina na fase lútea, associado à oscilação progesterônica e possível instabilidade glicêmica.',
    conscienciaCorporal:  'Seu sono e sua fome parecem piorar de forma consistente antes da menstruação.',
    microconduta:         'Nos próximos dias, priorize refeições mais estruturadas, horários regulares e estratégias que favoreçam estabilidade energética.',
    gatilhoTemporal:      ['Apareceu em 2 ciclos consecutivos', 'Sintomas ocorreram nos últimos 7 dias antes da menstruação'],
  },

  {
    id: 'sono_vulneravel_lutea',
    numero: 5,
    nome: 'Sono Vulnerável na Fase Lútea',
    categoria: 'problema',
    eixos: ['progesterona', 'adrenal'],
    criterios: ['despertar noturno', 'ansiedade', 'piora pré-menstrual'],
    intensidade: {
      leve:            { criterio: '2 sintomas esporádicos' },
      moderado:        { criterio: 'Recorrência em ≥1 ciclo' },
      importante:      { criterio: 'Recorrência em ≥2 ciclos consecutivos' },
      atencao_clinica: { criterio: 'Persistência por ≥3 ciclos com impacto diurno' },
    },
    textoPaciente:        'Seu padrão de sono parece mais vulnerável em determinados momentos do ciclo.',
    textoNutricionista:   'Padrão compatível com desregulação do sono associada à fase lútea, possivelmente por menor modulação GABAérgica progesterônica.',
    conscienciaCorporal:  'Seu sono parece piorar de forma consistente nos dias que antecedem a menstruação.',
    microconduta:         null,
    gatilhoTemporal:      ['Despertares recorrentes nos 7–10 dias antes da menstruação'],
  },

  {
    id: 'tpm_inflamatoria',
    numero: 6,
    nome: 'TPM Inflamatória',
    categoria: 'problema',
    eixos: ['estrogenico', 'inflamatorio', 'progesterona'],
    criterios: ['retenção', 'dor mamária', 'irritabilidade', 'cefaleia'],
    intensidade: {
      leve:            { criterio: '2 sintomas' },
      moderado:        { criterio: '3 sintomas' },
      importante:      { criterio: '4 sintomas por ≥2 ciclos' },
      atencao_clinica: { criterio: '4 sintomas intensos por ≥3 ciclos' },
    },
    textoPaciente:        'Seu ciclo mostra sinais de maior atividade inflamatória pré-menstrual.',
    textoNutricionista:   'Padrão compatível com TPM de componente inflamatório, possivelmente associado à dominância estrogênica relativa e pior resolução inflamatória.',
    conscienciaCorporal:  null,
    microconduta:         null,
    gatilhoTemporal:      ['Sintomas nos 5–10 dias antes da menstruação', 'Recorrência em ≥2 ciclos'],
  },

  // ── 3. Alertas Estrogênicos ────────────────────────────────────────────────

  {
    id: 'oscilacao_estrogenica',
    numero: 7,
    nome: 'Oscilação Estrogênica Aumentada',
    categoria: 'problema',
    eixos: ['estrogenico'],
    criterios: ['fluxo intenso', 'coágulos', 'edema', 'dor mamária'],
    intensidade: {
      leve:            { criterio: '2 sintomas' },
      moderado:        { criterio: '3 sintomas' },
      importante:      { criterio: '3–4 sintomas por ≥2 ciclos' },
      atencao_clinica: { criterio: '4 sintomas recorrentes por ≥3 ciclos' },
    },
    textoPaciente:        'Seu corpo demonstra sinais compatíveis com maior oscilação estrogênica neste momento.',
    textoNutricionista:   'Padrão compatível com predominância estrogênica relativa, possivelmente associada à baixa oposição progesterônica e comprometimento da metabolização hepática.',
    conscienciaCorporal:  null,
    microconduta:         null,
    gatilhoTemporal:      ['Sintomas no período menstrual ou pré-menstrual', 'Recorrência em ≥2 ciclos'],
  },

  {
    id: 'estrogenio_intestino',
    numero: 8,
    nome: 'Estrogênio + Intestino',
    categoria: 'problema',
    eixos: ['estrogenico', 'intestinal'],
    criterios: ['constipação', 'fluxo intenso', 'distensão', 'dor mamária'],
    intensidade: {
      leve:            { criterio: '2 sintomas' },
      moderado:        { criterio: '3 sintomas' },
      importante:      { criterio: '3 sintomas por ≥2 ciclos' },
      atencao_clinica: { criterio: '4 sintomas recorrentes por ≥3 ciclos' },
    },
    textoPaciente:        'Seu intestino pode estar influenciando a forma como seu organismo lida com os hormônios ao longo do ciclo.',
    textoNutricionista:   'Padrão compatível com aumento da recirculação estrogênica associado à lentificação intestinal e possível comprometimento do estroboloma.',
    conscienciaCorporal:  'Nos ciclos em que o intestino fica mais lento, seus sintomas menstruais tendem a se intensificar.',
    microconduta:         'Observe hidratação, consumo de vegetais e regularidade intestinal ao longo do ciclo.',
    gatilhoTemporal:      ['Constipação presente em ≥50% dos dias do ciclo', 'Repetição por ≥2 ciclos'],
  },

  {
    id: 'retencao_ciclica',
    numero: 9,
    nome: 'Retenção Cíclica',
    categoria: 'problema',
    eixos: ['estrogenico'],
    criterios: ['edema', 'sensação inflamada', 'ganho hídrico'],
    intensidade: {
      leve:            { criterio: '1–2 sintomas esporádicos' },
      moderado:        { criterio: 'Recorrência em ≥2 ciclos' },
      importante:      { criterio: 'Impacto funcional e persistência' },
      atencao_clinica: { criterio: 'Progressão e persistência por ≥3 ciclos' },
    },
    textoPaciente:        'Seu corpo parece apresentar maior retenção em fases específicas do ciclo.',
    textoNutricionista:   'Padrão compatível com retenção hídrica cíclica associada à oscilação estrogênica e/ou baixa progesterona relativa.',
    conscienciaCorporal:  null,
    microconduta:         null,
    gatilhoTemporal:      ['Recorrente nos 5–7 dias antes da menstruação'],
  },

  // ── 4. Alertas Cortisol / Estresse ────────────────────────────────────────

  {
    id: 'sobrecarga_fisiologica',
    numero: 10,
    nome: 'Sobrecarga Fisiológica',
    categoria: 'problema',
    eixos: ['adrenal'],
    criterios: ['acordar cansada', 'fadiga da tarde', 'tensão', 'ansiedade'],
    intensidade: {
      leve:            { criterio: 'Até 2 sintomas' },
      moderado:        { criterio: '3 sintomas relacionados' },
      importante:      { criterio: '≥4 sintomas por ≥2 ciclos' },
      atencao_clinica: { criterio: '≥14 dias consecutivos OU ≥3 semanas no mesmo ciclo' },
    },
    textoPaciente:        'Seu organismo pode estar demonstrando necessidade aumentada de recuperação.',
    textoNutricionista:   'Padrão compatível com sobrecarga do eixo HPA e redução da recuperação fisiológica.',
    conscienciaCorporal:  'Períodos de maior exigência emocional parecem impactar seu nível de energia.',
    microconduta:         'Considere criar momentos consistentes de recuperação ao longo da semana.',
    gatilhoTemporal:      ['≥14 dias consecutivos', '≥3 semanas no mesmo ciclo'],
  },

  {
    id: 'cortisol_fome_noturna',
    numero: 11,
    nome: 'Cortisol + Fome Noturna',
    categoria: 'problema',
    eixos: ['adrenal', 'glicemico'],
    criterios: ['estresse', 'compulsão noturna', 'despertar noturno'],
    intensidade: {
      leve:            { criterio: 'Episódios esporádicos' },
      moderado:        { criterio: 'Recorrência em ≥2 semanas' },
      importante:      { criterio: 'Padrão consolidado por ≥1 ciclo' },
      atencao_clinica: { criterio: 'Progressão e impacto no sono' },
    },
    textoPaciente:        'Períodos de maior tensão parecem impactar sua fome e qualidade do sono.',
    textoNutricionista:   'Correlação consistente entre sobrecarga do eixo HPA e comportamento alimentar hedônico noturno.',
    conscienciaCorporal:  'Dias de maior tensão emocional parecem aumentar sua vontade por doces no período noturno.',
    microconduta:         null,
    gatilhoTemporal:      ['Padrão consistente por ≥3 semanas'],
  },

  {
    id: 'sono_fragmentado',
    numero: 12,
    nome: 'Sono Fragmentado',
    categoria: 'problema',
    eixos: ['adrenal'],
    criterios: ['múltiplos despertares', 'sono leve', 'fadiga matinal'],
    intensidade: {
      leve:            { criterio: 'Ocasional' },
      moderado:        { criterio: 'Recorrente por ≥2 semanas' },
      importante:      { criterio: 'Impacto diurno consistente' },
      atencao_clinica: { criterio: 'Progressão por ≥3 ciclos' },
    },
    textoPaciente:        'Seu padrão de sono pode não estar permitindo recuperação completa.',
    textoNutricionista:   'Padrão compatível com comprometimento das fases de sono reparador, possivelmente associado à desregulação do cortisol noturno.',
    conscienciaCorporal:  null,
    microconduta:         null,
    gatilhoTemporal:      ['≥3 noites por semana com despertares', 'Persistência por ≥2 semanas'],
  },

  // ── 5. Alertas Intestinais ────────────────────────────────────────────────

  {
    id: 'disbiose_funcional',
    numero: 13,
    nome: 'Disbiose Funcional',
    categoria: 'problema',
    eixos: ['intestinal', 'inflamatorio'],
    criterios: ['distensão', 'gases', 'constipação', 'fadiga'],
    intensidade: {
      leve:            { criterio: '2 sintomas' },
      moderado:        { criterio: '3 sintomas por ≥2 semanas' },
      importante:      { criterio: '4 sintomas por ≥2 ciclos' },
      atencao_clinica: { criterio: 'Progressão e impacto hormonal associado' },
    },
    textoPaciente:        'Seu intestino pode estar impactando energia, inflamação e bem-estar geral.',
    textoNutricionista:   'Padrão compatível com disbiose intestinal e comprometimento do estroboloma.',
    conscienciaCorporal:  null,
    microconduta:         null,
    gatilhoTemporal:      ['Presente em ≥50% dos dias do ciclo'],
  },

  {
    id: 'intestino_humor',
    numero: 14,
    nome: 'Intestino + Humor',
    categoria: 'problema',
    eixos: ['intestinal', 'adrenal'],
    criterios: ['distensão', 'ansiedade', 'irritabilidade', 'compulsão'],
    intensidade: {
      leve:            { criterio: '2 sintomas' },
      moderado:        { criterio: '3 sintomas associados' },
      importante:      { criterio: '4 sintomas por ≥2 ciclos' },
      atencao_clinica: { criterio: 'Padrão consolidado e progressivo' },
    },
    textoPaciente:        'Seu eixo intestino-cérebro pode estar influenciando humor e comportamento alimentar.',
    textoNutricionista:   'Padrão compatível com comprometimento do eixo intestino-cérebro e possível alteração na produção de neurotransmissores intestinais.',
    conscienciaCorporal:  'Seu humor parece mais estável quando seu intestino funciona regularmente.',
    microconduta:         null,
    gatilhoTemporal:      ['Recorrência por ≥2 semanas'],
  },

  {
    id: 'sensibilidade_alimentar',
    numero: 15,
    nome: 'Sensibilidade Alimentar Funcional',
    categoria: 'problema',
    eixos: ['intestinal'],
    criterios: ['piora após refeições', 'distensão', 'fadiga', 'névoa mental'],
    intensidade: {
      leve:            { criterio: 'Episódios esporádicos' },
      moderado:        { criterio: 'Recorrência em ≥2 semanas' },
      importante:      { criterio: 'Padrão consistente por ≥1 ciclo' },
      atencao_clinica: { criterio: 'Impacto funcional relevante e progressão' },
    },
    textoPaciente:        'Alguns alimentos parecem impactar significativamente sua disposição e digestão.',
    textoNutricionista:   'Padrão compatível com sensibilidade alimentar funcional e possível comprometimento da barreira intestinal.',
    conscienciaCorporal:  null,
    microconduta:         null,
    gatilhoTemporal:      ['Piora consistente após refeições específicas'],
  },

  // ── 6. Alertas Perimenopausa ───────────────────────────────────────────────

  {
    id: 'transicao_hormonal',
    numero: 16,
    nome: 'Transição Hormonal',
    categoria: 'problema',
    eixos: ['perimenopausa'],
    criterios: ['ciclos espaçando', 'calorões', 'insônia', 'suor noturno'],
    intensidade: {
      leve:            { criterio: '2–3 sintomas esporádicos' },
      moderado:        { criterio: '3–4 sintomas recorrentes' },
      importante:      { criterio: '4 sintomas + mudança progressiva do padrão menstrual' },
      atencao_clinica: { criterio: '≥4 sintomas intensos + progressão por ≥3 ciclos' },
    },
    textoPaciente:        'Seu corpo apresenta sinais compatíveis com transição hormonal.',
    textoNutricionista:   'Padrão compatível com perimenopausa, com oscilação estrogênica e redução progressiva da progesterona.',
    conscienciaCorporal:  'Seu corpo está mostrando maior sensibilidade térmica e alterações de sono nos últimos ciclos.',
    microconduta:         'Sono, manejo do estresse e suporte metabólico tornam-se ainda mais importantes neste momento.',
    gatilhoTemporal:      ['≥4 sintomas associados + mudança progressiva do padrão menstrual'],
  },

  {
    id: 'vulnerabilidade_metabolica_peri',
    numero: 17,
    nome: 'Vulnerabilidade Metabólica da Perimenopausa',
    categoria: 'problema',
    eixos: ['perimenopausa', 'glicemico'],
    criterios: ['aumento abdominal', 'fadiga', 'pior recuperação', 'calorões'],
    intensidade: {
      leve:            { criterio: '2 sintomas' },
      moderado:        { criterio: '3 sintomas' },
      importante:      { criterio: '4 sintomas por ≥2 ciclos' },
      atencao_clinica: { criterio: 'Progressão e impacto funcional relevante' },
    },
    textoPaciente:        'Alterações hormonais podem estar impactando metabolismo, sono e energia.',
    textoNutricionista:   'Padrão compatível com vulnerabilidade metabólica da transição menopausal, com maior risco de resistência insulínica e sarcopenia.',
    conscienciaCorporal:  null,
    microconduta:         null,
    gatilhoTemporal:      ['Presente em ≥2 ciclos consecutivos'],
  },

  // ── 7. Alertas SOP / Androgênicos ─────────────────────────────────────────

  {
    id: 'padrao_androgenico',
    numero: 18,
    nome: 'Padrão Androgênico Funcional',
    categoria: 'problema',
    eixos: ['androgenico'],
    criterios: ['acne', 'oleosidade', 'queda de cabelo', 'pelos'],
    intensidade: {
      leve:            { criterio: '2 sintomas' },
      moderado:        { criterio: '3 sintomas' },
      importante:      { criterio: '3–4 sintomas por ≥2 ciclos' },
      atencao_clinica: { criterio: '4 sintomas intensos por ≥3 ciclos' },
    },
    textoPaciente:        'Seu corpo demonstra sinais de maior atividade androgênica.',
    textoNutricionista:   'Padrão compatível com hiperandrogenismo funcional, possivelmente associado à resistência insulínica e maior atividade de 5-alfa-redutase.',
    conscienciaCorporal:  null,
    microconduta:         null,
    gatilhoTemporal:      ['Sintomas presentes por ≥2 ciclos'],
  },

  {
    id: 'sop_glicemia',
    numero: 19,
    nome: 'SOP + Glicemia',
    categoria: 'problema',
    eixos: ['androgenico', 'glicemico'],
    criterios: ['compulsão', 'acne', 'ciclos irregulares', 'dificuldade de emagrecer'],
    intensidade: {
      leve:            { criterio: '2 sintomas' },
      moderado:        { criterio: '3 sintomas' },
      importante:      { criterio: '4 sintomas por ≥2 ciclos' },
      atencao_clinica: { criterio: '4 sintomas intensos por ≥3 ciclos' },
    },
    textoPaciente:        'Seu padrão hormonal pode estar associado a alterações metabólicas e glicêmicas.',
    textoNutricionista:   'Padrão compatível com SOP insulino-resistente, com provável hiperinsulinemia estimulando produção androgênica ovariana.',
    conscienciaCorporal:  null,
    microconduta:         null,
    gatilhoTemporal:      ['Presente em ≥2 ciclos consecutivos'],
  },

  // ── 8. Alertas Tireoidianos ───────────────────────────────────────────────

  {
    id: 'hipofuncao_tireoidiana',
    numero: 20,
    nome: 'Sinais de Hipofunção Tireoidiana Funcional',
    categoria: 'problema',
    eixos: ['tireoidiano'],
    criterios: ['lentidão', 'frio excessivo', 'queda de cabelo', 'queda de sobrancelhas', 'pele seca', 'intestino lento', 'energia muito baixa'],
    intensidade: {
      leve:            { criterio: '2 sintomas' },
      moderado:        { criterio: '3 sintomas' },
      importante:      { criterio: '4 sintomas por ≥2 semanas' },
      atencao_clinica: { criterio: '5+ sintomas persistentes — considerar avaliação laboratorial' },
    },
    textoPaciente:        'Seu corpo está apresentando sinais que podem indicar maior lentificação metabólica.',
    textoNutricionista:   'Padrão compatível com hipofunção tireoidiana funcional. Considerar rastreio de TSH, T4 livre e T3 livre. Queda do terço externo das sobrancelhas é sinal de alta especificidade. Avaliar carências de iodo, selênio, zinco e ferro.',
    conscienciaCorporal:  'Nos períodos de maior cansaço e frio, perceba se seu raciocínio também está mais lento — esses sinais costumam aparecer juntos.',
    microconduta:         'Priorize alimentos fontes de selênio (castanha-do-pará), iodo (algas, peixes marinhos) e zinco. Avalie qualidade do sono e manejo do cortisol — o estresse crônico pode reduzir conversão T4→T3.',
    gatilhoTemporal:      ['≥3 sintomas por ≥2 semanas consecutivas', 'Queda de sobrancelhas associada a qualquer outro sintoma'],
  },

  {
    id: 'tireoidiano_cortisol',
    numero: 21,
    nome: 'Tireoide + Cortisol',
    categoria: 'problema',
    eixos: ['tireoidiano', 'adrenal'],
    criterios: ['lentidão', 'frio', 'baixa energia', 'sono ruim', 'agitação com cansaço'],
    intensidade: {
      leve:            { criterio: '2 sintomas de cada eixo' },
      moderado:        { criterio: '3+ sintomas combinados' },
      importante:      { criterio: '4+ sintomas com impacto funcional' },
      atencao_clinica: { criterio: 'Padrão persistente por ≥3 semanas' },
    },
    textoPaciente:        'Seu corpo mostra sinais de cansaço profundo que podem estar relacionados ao metabolismo e ao estresse.',
    textoNutricionista:   'Coexistência de padrão tireoidiano e adrenal — considerar supressão de T3 mediada por cortisol elevado cronicamente. O estresse pode inibir a conversão T4→T3 e aumentar T3 reverso.',
    conscienciaCorporal:  'Períodos de maior pressão parecem agravar sua sensação de lentidão e cansaço.',
    microconduta:         'Manejo do estresse é prioritário — sem esse suporte, o suporte nutricional tireoidiano tem resposta limitada.',
    gatilhoTemporal:      ['Padrão presente em ≥2 semanas de alto estresse'],
  },
];

// ─── Módulo B — Evolução Positiva ─────────────────────────────────────────────
// Devem representar 20–30% dos alertas exibidos.
// O app não pode gerar só problemas — isso gera fadiga emocional.

const MODULO_B = [

  {
    id: 'estabilidade_ciclo',
    numero: 23,
    nome: 'Maior Estabilidade do Ciclo',
    categoria: 'evolucao_positiva',
    eixos: ['estrogenico', 'progesterona'],
    criterio: 'Redução ≥30% dos sintomas em comparação ao ciclo anterior',
    textoPaciente:        'Seu ciclo mostrou maior estabilidade neste período.',
    textoNutricionista:   'Observa-se redução global da carga sintomática em comparação aos ciclos anteriores.',
    conscienciaCorporal:  'Seu corpo parece responder positivamente às mudanças implementadas.',
    microconduta:         'Continue observando os hábitos que contribuíram para essa evolução.',
  },

  {
    id: 'melhora_metabolica',
    numero: 24,
    nome: 'Melhora Metabólica',
    categoria: 'evolucao_positiva',
    eixos: ['glicemico'],
    criterio: 'Redução de compulsão e/ou melhora da energia por ≥2 semanas',
    textoPaciente:        'Seu padrão de energia e fome apresentou maior estabilidade nos últimos ciclos.',
    textoNutricionista:   'Observa-se melhora dos marcadores de estabilidade glicêmica e comportamento alimentar.',
    conscienciaCorporal:  null,
    microconduta:         null,
  },

  {
    id: 'reducao_compulsao',
    numero: 25,
    nome: 'Evolução dos Sintomas de Compulsão',
    categoria: 'evolucao_positiva',
    eixos: ['glicemico', 'progesterona'],
    criterio: 'Redução de episódios de compulsão por ≥2 semanas consecutivas',
    textoPaciente:        'Os episódios de compulsão reduziram nas últimas semanas.',
    textoNutricionista:   'Observa-se melhora do comportamento alimentar hedônico, possivelmente associada à maior estabilidade glicêmica.',
    conscienciaCorporal:  null,
    microconduta:         null,
  },

  {
    id: 'melhora_sono',
    numero: 26,
    nome: 'Melhora do Sono',
    categoria: 'evolucao_positiva',
    eixos: ['adrenal'],
    criterio: 'Menos despertares e/ou melhora do escore de sono por ≥2 semanas',
    textoPaciente:        'Seu sono mostrou evolução consistente nas últimas semanas.',
    textoNutricionista:   'Observa-se melhora progressiva dos marcadores subjetivos de recuperação.',
    conscienciaCorporal:  null,
    microconduta:         null,
  },

  {
    id: 'melhora_intestinal',
    numero: 27,
    nome: 'Melhora Intestinal',
    categoria: 'evolucao_positiva',
    eixos: ['intestinal'],
    criterio: 'Regularidade intestinal por ≥10 dias consecutivos',
    textoPaciente:        'Seu intestino mostrou maior regularidade neste mês.',
    textoNutricionista:   'Observa-se melhora da função intestinal, com provável impacto positivo no metabolismo hormonal.',
    conscienciaCorporal:  null,
    microconduta:         null,
  },

  {
    id: 'melhora_energia',
    numero: 28,
    nome: 'Melhora de Energia',
    categoria: 'evolucao_positiva',
    eixos: ['adrenal', 'glicemico'],
    criterio: 'Escore de energia ≥4 por ≥7 dias consecutivos',
    textoPaciente:        'Seu nível de energia apresentou melhora progressiva nos últimos ciclos.',
    textoNutricionista:   'Observa-se melhora dos marcadores de recuperação adrenal e estabilidade energética.',
    conscienciaCorporal:  null,
    microconduta:         null,
  },
];

// ─── Módulo C — Associação de Rotina ─────────────────────────────────────────
// A funcionalidade mais valiosa do app — gera descoberta e vínculo emocional.

const MODULO_C = [

  {
    id: 'sono_compulsao',
    numero: 20,
    nome: 'Associação: Sono × Compulsão',
    categoria: 'associacao_rotina',
    eixos: ['adrenal', 'glicemico'],
    criterio: 'Noites ruins seguidas de aumento de compulsão no dia seguinte',
    textoPaciente:        'Nos dias com pior qualidade de sono, sua vontade por doces tende a aumentar.',
    textoNutricionista:   'Correlação consistente entre privação de sono e aumento do comportamento alimentar hedônico, possivelmente mediada por alterações de grelina e leptina.',
    conscienciaCorporal:  'Seu sono parece influenciar diretamente suas escolhas alimentares.',
    microconduta:         'Observe como pequenas melhorias no sono impactam sua fome ao longo do dia.',
  },

  {
    id: 'estresse_tpm',
    numero: 21,
    nome: 'Associação: Estresse × TPM',
    categoria: 'associacao_rotina',
    eixos: ['adrenal', 'progesterona'],
    criterio: 'Maior estresse em semanas que precedem a menstruação correlacionado com piora dos sintomas',
    textoPaciente:        'Períodos de maior estresse parecem intensificar seus sintomas pré-menstruais.',
    textoNutricionista:   'Correlação compatível com amplificação da vulnerabilidade neuroendócrina da fase lútea por sobrecarga do eixo HPA.',
    conscienciaCorporal:  null,
    microconduta:         null,
  },

  {
    id: 'intestino_ciclo',
    numero: 22,
    nome: 'Associação: Intestino × Ciclo',
    categoria: 'associacao_rotina',
    eixos: ['intestinal', 'estrogenico'],
    criterio: 'Constipação nos dias que antecedem a menstruação correlacionada com piora dos sintomas menstruais',
    textoPaciente:        'Seu ciclo parece mais intenso nos períodos de maior constipação.',
    textoNutricionista:   'Correlação compatível com aumento da recirculação estrogênica associado à lentificação intestinal.',
    conscienciaCorporal:  'Nos períodos de intestino mais lento, seus sintomas menstruais também parecem se intensificar.',
    microconduta:         null,
  },

  {
    id: 'intestino_humor_associacao',
    nome: 'Associação: Intestino × Humor',
    categoria: 'associacao_rotina',
    eixos: ['intestinal', 'adrenal'],
    criterio: 'Dias de intestino regular correlacionados com melhor humor',
    textoPaciente:        'Seu humor parece mais estável quando seu intestino funciona regularmente.',
    textoNutricionista:   'Correlação compatível com eixo intestino-cérebro e produção de serotonina intestinal.',
    conscienciaCorporal:  null,
    microconduta:         null,
  },

  {
    id: 'exercicio_energia_associacao',
    nome: 'Associação: Exercício × Energia',
    categoria: 'associacao_rotina',
    eixos: ['adrenal', 'glicemico'],
    criterio: 'Dias com atividade física correlacionados com melhor humor e menor compulsão',
    textoPaciente:        'Nos dias com movimento físico, seus sintomas emocionais tendem a reduzir.',
    textoNutricionista:   'Correlação compatível com benefícios do exercício na modulação neuroendócrina e sensibilidade insulínica.',
    conscienciaCorporal:  null,
    microconduta:         null,
  },

  {
    id: 'estresse_compulsao_associacao',
    nome: 'Associação: Estresse × Compulsão',
    categoria: 'associacao_rotina',
    eixos: ['adrenal', 'glicemico'],
    criterio: 'Dias emocionalmente intensos correlacionados com maior oscilação alimentar',
    textoPaciente:        'Períodos emocionalmente intensos coincidem com maior oscilação alimentar.',
    textoNutricionista:   'Correlação compatível com comportamento alimentar hedônico mediado por cortisol.',
    conscienciaCorporal:  null,
    microconduta:         null,
  },
];

// ─── Exportação unificada ─────────────────────────────────────────────────────

export const ALERTAS = [...MODULO_A, ...MODULO_B, ...MODULO_C];

export const ALERTAS_PROBLEMA         = MODULO_A;
export const ALERTAS_EVOLUCAO_POSITIVA = MODULO_B;
export const ALERTAS_ASSOCIACAO       = MODULO_C;

// ─── Regras de intensidade (Etapa 4) ─────────────────────────────────────────
export const INTENSIDADE = {
  leve: {
    label: 'Leve',
    cor: '#c4a882',
    corSoft: '#faf3e8',
    criterio: 'Primeira ocorrência ou até 2 sintomas',
  },
  moderado: {
    label: 'Moderado',
    cor: '#854f0b',
    corSoft: '#faeeda',
    criterio: 'Recorrência no ciclo ou 3 sintomas relacionados',
  },
  importante: {
    label: 'Importante',
    cor: '#993556',
    corSoft: '#fbeaf0',
    criterio: '≥4 sintomas ou impacto funcional por ≥2 ciclos',
  },
  atencao_clinica: {
    label: 'Atenção clínica',
    cor: '#7a1a1a',
    corSoft: '#f5e6e6',
    criterio: 'Persistente/intenso, progressão ou ≥3 ciclos',
  },
};

// ─── Linguagem guia (Etapa 4) ─────────────────────────────────────────────────
export const LINGUAGEM = {
  evitar: [
    '"Seu cortisol está desregulado"',
    '"Você está com dominância estrogênica"',
    '"Você apresenta deficiência hormonal"',
  ],
  preferir: [
    '"Seu corpo está demonstrando sinais compatíveis com…"',
    '"Esse padrão pode estar associado a…"',
    '"Alguns sintomas sugerem maior oscilação…"',
    '"Seu ciclo mostra tendência de…"',
  ],
  principios: [
    'Acolher',
    'Explicar',
    'Traduzir fisiologia',
    'Educar',
    'Gerar autonomia',
    'Nunca patologizar',
    'Nunca assustar',
    'Nunca diagnosticar',
  ],
};

export default ALERTAS;
