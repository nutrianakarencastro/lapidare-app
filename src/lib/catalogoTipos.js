/**
 * Catálogo de Tipos de Evento — Útera
 *
 * Fonte única de verdade declarativa dos metadados canônicos de cada tipo
 * de evento existente no sistema.
 *
 * Puramente declarativo. Sem imports. Sem dependências de ambiente.
 * Deve permanecer portável entre browser e edge functions.
 *
 * Consumido por:
 *   - Event Builder (src/lib/eventos.js) — para obter metadados canônicos ao criar eventos
 *   - Motor de Atenção (src/lib/attentionEngine.js) — para classificação e priorização
 *   - Superfícies — para exibir título, ícone e verbo canônicos
 *
 * Especificado em:
 *   - MOTOR_EVENTOS_CONVENCOES_V1.md §§ 9-15, §17
 *   - CENTRAL_EVENTOS_ARQUITETURA_V1.md §7.1
 *
 * Ao adicionar um novo tipo, atualizar APENAS este arquivo — as demais
 * camadas herdam a informação automaticamente.
 *
 * Formato de cada entrada:
 *
 *   {
 *     tipo:           string  — identificador canônico (§10)
 *     categoria:      string  — 'comunicacao' | 'saude' | 'conteudo' | 'jornada' | 'sistema' (§9)
 *     origem:         string  — módulo onde o acontecimento ocorreu (§11)
 *     titulo:         string  — texto principal do evento (§14)
 *     natureza:       string  — 'informativo' | 'acionavel'
 *     verbo?:         string  — verbo de ação (apenas para acionáveis; ex: 'Responder')
 *     metadataSchema: object  — forma esperada do metadata (documental)
 *   }
 */

export const CATALOGO = {
  feedback_enviado: {
    tipo:      'feedback_enviado',
    categoria: 'comunicacao',
    origem:    'checkins',
    titulo:    'Novo feedback da sua nutricionista',
    natureza:  'informativo',
    metadataSchema: {
      checkin_envio_id: 'uuid',
    },
  },
}

/**
 * Retorna a definição de um tipo, ou undefined se não existir.
 * Nunca lança. Sem side effects.
 *
 * @param {string} tipo
 * @returns {object|undefined}
 */
export function getTipoDef(tipo) {
  return CATALOGO[tipo]
}
