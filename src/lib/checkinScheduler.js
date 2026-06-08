// Lógica de disparo de agendamentos de check-in.
// Módulo compartilhado entre Checkins.jsx e PacientePerfil.jsx.

import { supabase } from './supabase.js';
import { proximaDataAgendamento } from './checkinDefault.js';

/**
 * Processa agendamentos vencidos para a nutri.
 * Retorna o total de envios criados (0 se nenhum).
 * Quem chama decide como exibir o feedback.
 *
 * agendamentos deve incluir o join: template:checkin_templates(nome, perguntas)
 */
export async function processarAgendamentosVencidos(nutriId, agendamentos) {
  const hoje = new Date().toISOString().slice(0, 10);
  let total = 0;

  for (const ag of agendamentos) {
    if (!ag.ativo) continue;
    if (ag.proximo_envio > hoje) continue;
    if (!ag.template?.perguntas) continue;

    let claim;

    if (ag.frequencia === 'unico') {
      // Agendamento único: desativa após disparar (nunca rola a data)
      const { data } = await supabase
        .from('checkin_agendamentos')
        .update({ ativo: false, ultimo_envio: new Date().toISOString() })
        .eq('id', ag.id)
        .eq('ativo', true)           // só processa se ainda ativo
        .lte('proximo_envio', hoje)
        .select();
      claim = data;
    } else {
      // Recorrente: avança a data para o próximo ciclo
      const nova = proximaDataAgendamento(hoje, ag.frequencia);
      const { data } = await supabase
        .from('checkin_agendamentos')
        .update({ proximo_envio: nova, ultimo_envio: new Date().toISOString() })
        .eq('id', ag.id)
        .lte('proximo_envio', hoje)
        .select();
      claim = data;
    }

    if (!claim || claim.length === 0) continue; // outra aba já processou

    // Determina pacientes-alvo
    let pacientesIds;
    if (ag.paciente_id) {
      pacientesIds = [ag.paciente_id];
    } else {
      const { data: pacs } = await supabase
        .from('pacientes').select('id').eq('nutri_id', nutriId);
      pacientesIds = (pacs ?? []).map(p => p.id);
    }

    if (pacientesIds.length === 0) continue;

    const linhas = pacientesIds.map(pid => ({
      nutri_id:    nutriId,
      paciente_id: pid,
      perguntas:   ag.template.perguntas,
      nome:        ag.template.nome ?? null,
    }));
    const { error } = await supabase.from('checkin_envios').insert(linhas);
    if (!error) total += pacientesIds.length;
  }

  return total;
}

/**
 * Executa um agendamento imediatamente (ação manual da nutri).
 * Não verifica proximo_envio — executa independente da data.
 * Retorna { ok: true } ou { error: string }.
 */
export async function executarAgendamento(ag, nutriId) {
  if (!ag.template?.perguntas) {
    return { error: 'Template sem perguntas.' };
  }

  const { error: envioError } = await supabase.from('checkin_envios').insert({
    nutri_id:    nutriId,
    paciente_id: ag.paciente_id,
    perguntas:   ag.template.perguntas,
    nome:        ag.template.nome ?? null,
  });

  if (envioError) return { error: envioError.message };

  const hoje = new Date().toISOString().slice(0, 10);

  if (ag.frequencia === 'unico') {
    await supabase.from('checkin_agendamentos')
      .update({ ativo: false, ultimo_envio: new Date().toISOString() })
      .eq('id', ag.id);
  } else {
    const nova = proximaDataAgendamento(hoje, ag.frequencia);
    await supabase.from('checkin_agendamentos')
      .update({ proximo_envio: nova, ultimo_envio: new Date().toISOString() })
      .eq('id', ag.id);
  }

  return { ok: true };
}
