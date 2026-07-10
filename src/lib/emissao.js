/**
 * Camada de Emissão — Útera
 *
 * Superfície emissiva da Arquitetura da Atenção V2. Reage ao evento
 * recém-criado pelo Motor de Eventos, consulta o Motor de Atenção
 * para resolver quais superfícies emissivas devem materializar o
 * evento, e grava a intenção de emissão em `evento_entregas`.
 *
 * O Motor de Eventos NÃO conhece esta camada. A orquestração é
 * responsabilidade do callsite que executou a ação clínica:
 *
 *   Ação clínica
 *      ↓
 *   Motor de Eventos                     (cria o evento)
 *      ↓
 *   Camada de Emissão                    (reage ao evento criado)
 *      ↓
 *   resolverEmissoes()  ← Motor de Atenção (função pura)
 *      ↓
 *   registrar_emissoes  ← RPC             (grava evento_entregas)
 *
 * Best-effort. Nunca lança. Nunca bloqueia fluxo clínico nem fluxo
 * do Motor de Eventos. Falha em qualquer ponto é registrada como
 * console.warn estruturado.
 *
 * Especificado em:
 *   - ARQUITETURA_DA_ATENCAO_V2.md §§ 5, 8, 9, 11
 *
 * ATENÇÃO — V2.1 (infraestrutura sem envio real):
 *   - Nenhum Adapter Push está conectado. Linhas ficam pendentes.
 *   - NÃO conectar Adapter (Firebase, APNs, Web Push, etc.) sem
 *     antes introduzir Preferências de Atenção com opt-in explícito
 *     por paciente. Enquanto essa camada não existir, qualquer
 *     conexão a provedor externo violaria o princípio "opt-in
 *     obrigatório" (Arquitetura V2 §7).
 */

import { supabase } from './supabase'
import { getTipoDef } from './catalogoTipos'
import { resolverEmissoes } from './attentionEngine'

/**
 * Reage a um evento recém-criado, resolvendo e registrando as
 * intenções de emissão em `evento_entregas`.
 *
 * Best-effort: retornos ou erros são silenciados; nada propaga
 * exceção ao chamador.
 *
 * @param {string} eventoId — id retornado por criar_evento
 * @param {string} tipo     — tipo canônico do evento (do Catálogo)
 * @param {object} [contexto] — reservado para Preferências (próxima sprint)
 * @returns {Promise<void>}
 */
export async function reagirAEventoCriado(eventoId, tipo, contexto = {}) {
  if (!eventoId || !tipo) return

  try {
    const tipoDef = getTipoDef(tipo)
    if (!tipoDef) {
      console.warn('[Útera] Camada de Emissão — tipo desconhecido no Catálogo', {
        tipo,
        eventoId,
      })
      return
    }

    const emissoes = resolverEmissoes(tipoDef, contexto)
    if (emissoes.length === 0) return

    const { error } = await supabase.rpc('registrar_emissoes', {
      p_evento_id: eventoId,
      p_emissoes:  emissoes,
    })

    if (error) {
      console.warn('[Útera] Camada de Emissão — falha ao registrar emissões', {
        eventoId,
        tipo,
        erro: error.message,
      })
    }
  } catch (err) {
    console.warn('[Útera] Camada de Emissão — erro inesperado', err)
  }
}
