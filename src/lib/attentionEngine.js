/**
 * Motor de Atenção — Útera
 *
 * Camada de política de atenção da Fase C. Recebe eventos brutos e retorna
 * eventos classificados em buckets e ordenados intra-bucket.
 *
 * Puramente determinístico. Sem side effects. Sem dependência de ambiente.
 * Consumido por superfícies (Central, badge, dashboard) e, futuramente,
 * por edge functions server-side (push, e-mail, WhatsApp digest).
 *
 * Especificado em:
 *   - CENTRAL_EVENTOS_ARQUITETURA_V1.md §7.2
 *
 * Comportamento diante de tipo desconhecido é fail-safe:
 *   console.warn + bucket 'novidade' + destaque 'baixo' — nunca lança.
 */

import { getTipoDef } from './catalogoTipos'

export const BUCKETS = {
  REQUER_ACAO: 'requer_acao',
  NOVIDADE:    'novidade',
  VISTO:       'visto',
}

const ORDEM_BUCKET = {
  [BUCKETS.REQUER_ACAO]: 0,
  [BUCKETS.NOVIDADE]:    1,
  [BUCKETS.VISTO]:       2,
}

/**
 * Classifica e ordena um conjunto de eventos.
 *
 * Regras invariantes V1:
 *   - Tipo `acionavel` + status `ativo`   → bucket `requer_acao`
 *   - Tipo `informativo` + status `ativo` → bucket `novidade`
 *   - Status `lido` | `encerrado` | `cancelado` → bucket `visto`
 *   - Ordenação intra-bucket: `criado_em` desc
 *   - Tipo desconhecido no Catálogo: bucket `novidade` + destaque `baixo` + console.warn
 *
 * @param {Array<object>} eventos — eventos brutos (formato da tabela `eventos`)
 * @param {object}        [contexto] — { destinatarioTipo, destinatarioId, superficie, momento }
 * @returns {Array<object>} eventos decorados com { bucket, destaque, ordem }
 */
export function classificarEventos(eventos, contexto = {}) {
  // Reservado para uso futuro — silenciamento, políticas por superfície,
  // agrupamento e decisão de canal (Central §7.2). V1 ainda não consome.
  void contexto

  if (!Array.isArray(eventos)) return []

  const decorados = eventos.map((evento) => {
    const { bucket, destaque } = decidirClassificacao(evento)
    return { ...evento, bucket, destaque }
  })

  decorados.sort((a, b) => {
    const diff = ORDEM_BUCKET[a.bucket] - ORDEM_BUCKET[b.bucket]
    if (diff !== 0) return diff
    return String(b.criado_em ?? '').localeCompare(String(a.criado_em ?? ''))
  })

  const contadoresPorBucket = {}
  return decorados.map((evento) => {
    const atual = (contadoresPorBucket[evento.bucket] ?? -1) + 1
    contadoresPorBucket[evento.bucket] = atual
    return { ...evento, ordem: atual }
  })
}

function decidirClassificacao(evento) {
  const status = evento?.status

  if (status === 'lido' || status === 'encerrado' || status === 'cancelado') {
    return { bucket: BUCKETS.VISTO, destaque: 'baixo' }
  }

  const tipoDef = getTipoDef(evento?.tipo)
  if (!tipoDef) {
    console.warn('[Útera] Motor de Atenção — tipo desconhecido no Catálogo', {
      tipo:     evento?.tipo,
      eventoId: evento?.id,
    })
    return { bucket: BUCKETS.NOVIDADE, destaque: 'baixo' }
  }

  if (tipoDef.natureza === 'acionavel') {
    return { bucket: BUCKETS.REQUER_ACAO, destaque: 'alto' }
  }
  return { bucket: BUCKETS.NOVIDADE, destaque: 'medio' }
}
