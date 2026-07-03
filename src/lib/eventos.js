import { supabase } from './supabase'

/**
 * Motor de Eventos do Útera — Event Builder
 *
 * Camada única de criação e gestão de eventos.
 * Todos os módulos devem usar estas funções — nunca chamar as RPCs diretamente.
 *
 * Valores esperados:
 *
 *   categoria   → 'comunicacao' | 'saude' | 'conteudo' | 'jornada' | 'sistema'
 *   origem      → 'feedbacks' | 'checkins' | 'orientacoes' | 'biblioteca' |
 *                 'exames' | 'jornada' | 'consulta' | 'suplementacao'
 *   autor_tipo  → 'nutri' | 'paciente' | 'sistema' | 'ia'
 *   dest._tipo  → 'nutri' | 'paciente'
 *
 * dedup_key recomendado:
 *   `${tipo}:${referenciaTipo}:${referenciaId}:${destinatarioId}`
 */

/**
 * Cria um evento no Motor de Eventos.
 * Best-effort: falhas são registradas como warning, nunca propagadas.
 *
 * @returns {Promise<string|null>} ID do evento criado, ou null se falhar
 */
export async function criarEvento({
  pacienteId,
  categoria,
  tipo,
  origem,
  titulo,
  autorTipo,
  destinatarioTipo,
  descricao        = null,
  autorId          = null,
  destinatarioId   = null,
  referenciaTipo   = null,
  referenciaId     = null,
  metadata         = {},
  dedupKey         = null,
}) {
  try {
    const { data, error } = await supabase.rpc('criar_evento', {
      p_paciente_id:       pacienteId,
      p_categoria:         categoria,
      p_tipo:              tipo,
      p_origem:            origem,
      p_titulo:            titulo,
      p_autor_tipo:        autorTipo,
      p_destinatario_tipo: destinatarioTipo,
      p_descricao:         descricao,
      p_autor_id:          autorId,
      p_destinatario_id:   destinatarioId,
      p_referencia_tipo:   referenciaTipo,
      p_referencia_id:     referenciaId,
      p_metadata:          metadata,
      p_dedup_key:         dedupKey,
    })

    if (error) {
      console.warn('[Útera] Motor de Eventos — falha ao criar evento', {
        tipo,
        pacienteId,
        erro: error.message,
      })
      return null
    }

    return data
  } catch (err) {
    console.warn('[Útera] Motor de Eventos — erro inesperado ao criar evento', err)
    return null
  }
}

/**
 * Marca um evento como lido.
 * Idempotente: ignorado se o evento já estiver lido.
 * Best-effort: falhas são registradas como warning, nunca propagadas.
 *
 * @param {string} eventoId
 * @returns {Promise<void>}
 */
export async function marcarEventoLido(eventoId) {
  try {
    const { error } = await supabase.rpc('marcar_evento_lido', {
      p_evento_id: eventoId,
    })

    if (error) {
      console.warn('[Útera] Motor de Eventos — falha ao marcar evento lido', {
        eventoId,
        erro: error.message,
      })
    }
  } catch (err) {
    console.warn('[Útera] Motor de Eventos — erro inesperado ao marcar lido', err)
  }
}

/**
 * Cria um evento de feedback enviado pela nutri.
 * Deve ser chamado apenas no primeiro envio — edições não geram novo evento.
 * Best-effort: falhas são registradas como warning, nunca propagadas.
 *
 * @param {object} params
 * @param {string} params.pacienteId  — pacientes.id (UUID interno)
 * @param {string} params.envioId     — checkin_envios.id
 * @param {string} params.nutriId     — auth.uid() da nutri
 * @returns {Promise<string|null>} ID do evento criado, ou null se falhar
 */
export async function criarEventoFeedback({ pacienteId, envioId, nutriId }) {
  if (!pacienteId || !envioId || !nutriId) {
    console.warn('[Útera] Motor de Eventos — criarEventoFeedback: parâmetros incompletos', {
      pacienteId, envioId, nutriId,
    })
    return null
  }

  return criarEvento({
    pacienteId,
    categoria:        'comunicacao',
    tipo:             'feedback_enviado',
    origem:           'checkins',
    titulo:           'Novo feedback da sua nutricionista',
    autorTipo:        'nutri',
    autorId:          nutriId,
    destinatarioTipo: 'paciente',
    destinatarioId:   pacienteId,
    referenciaTipo:   'checkin_envio',
    referenciaId:     envioId,
    metadata:         { checkin_envio_id: envioId },
    dedupKey:         `feedback_enviado:checkin_envio:${envioId}:${pacienteId}`,
  })
}

/**
 * Encerra um evento (remove da lista de pendências).
 * Idempotente: ignorado se o evento já estiver encerrado ou cancelado.
 * Best-effort: falhas são registradas como warning, nunca propagadas.
 *
 * @param {string} eventoId
 * @returns {Promise<void>}
 */
export async function encerrarEvento(eventoId) {
  try {
    const { error } = await supabase.rpc('encerrar_evento', {
      p_evento_id: eventoId,
    })

    if (error) {
      console.warn('[Útera] Motor de Eventos — falha ao encerrar evento', {
        eventoId,
        erro: error.message,
      })
    }
  } catch (err) {
    console.warn('[Útera] Motor de Eventos — erro inesperado ao encerrar evento', err)
  }
}
