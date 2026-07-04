/**
 * Event Resolver — Útera
 *
 * Traduz a referência estruturada de um evento em destino de navegação (rota).
 *
 * Puramente declarativo. Sem side effects. Sem dependência de ambiente.
 * Nunca conhece componentes React — retorna apenas rotas ou identificadores
 * canônicos. A resolução rota → componente permanece responsabilidade do
 * roteador da aplicação.
 *
 * Chaves de decisão:
 *   - primária:   referencia_tipo
 *   - secundária: destinatario_tipo (a mesma referência pode levar a rotas
 *                 diferentes para nutri e paciente)
 *
 * Comportamento fail-safe: referência não mapeada retorna { disponivel: false }.
 * A superfície apresenta o evento sem ação de clique.
 *
 * Especificado em:
 *   - CENTRAL_EVENTOS_ARQUITETURA_V1.md §7.3
 *
 * Ao adicionar um novo `referencia_tipo` no sistema, adicionar entrada aqui —
 * ou o evento ficará não navegável de forma explícita (comportamento seguro).
 */

const MAPA = {
  checkin_envio: {
    paciente: (id) => ({
      rota:   `/paciente/checkin/${id}`,
      rotulo: 'Ver check-in',
    }),
    // Entrada para 'nutri' será adicionada quando a Central da nutri entrar
    // (Fase C V1.1), junto com o roteamento correspondente da tela de check-ins
    // da nutri para um envio específico.
  },
}

/**
 * Resolve destino de navegação para um evento.
 *
 * @param {object} evento — precisa carregar `referencia_tipo`, `referencia_id`
 *                          e `destinatario_tipo`
 * @returns {{ rota: string, rotulo: string, disponivel: true }
 *          | { disponivel: false }}
 */
export function resolverNavegacao(evento) {
  const referenciaTipo   = evento?.referencia_tipo
  const referenciaId     = evento?.referencia_id
  const destinatarioTipo = evento?.destinatario_tipo

  if (!referenciaTipo || !referenciaId || !destinatarioTipo) {
    return { disponivel: false }
  }

  const entradaTipo = MAPA[referenciaTipo]
  if (!entradaTipo) return { disponivel: false }

  const construtor = entradaTipo[destinatarioTipo]
  if (typeof construtor !== 'function') return { disponivel: false }

  const { rota, rotulo } = construtor(referenciaId)
  return { rota, rotulo, disponivel: true }
}
