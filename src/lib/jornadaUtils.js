import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';

export function semanaAtualDe(dataInicio) {
  if (!dataInicio) return 1;
  const diff = Math.floor((new Date() - new Date(dataInicio + 'T12:00:00')) / 86400000);
  return Math.max(1, Math.ceil((diff + 1) / 7));
}

// Atualiza metas_semana localmente e persiste via RPC.
// Usada tanto em Jornada.jsx quanto em Inicio.jsx.
export async function toggleJornadaMeta(jornada, metaId, concluida, setJornada) {
  if (!jornada) return;
  const novas = (jornada.metas_semana ?? []).map(m =>
    m.id === metaId ? { ...m, concluida } : m
  );
  setJornada(j => ({ ...j, metas_semana: novas }));
  await supabase.rpc('paciente_marcar_meta', { p_metas: novas });
}

// Hook para a página Jornada da paciente.
// Não usado em Inicio.jsx (que mantém o batch unificado de queries).
export function useJornada(pacienteId) {
  const [jornada,    setJornada]    = useState(undefined);
  const [historico,  setHistorico]  = useState([]);
  const [habitos,    setHabitos]    = useState([]);
  const [protocolos, setProtocolos] = useState([]);

  useEffect(() => {
    if (!pacienteId) return;
    let active = true;
    async function load() {
      const [jRes, hRes, habRes, protRes] = await Promise.all([
        supabase.from('jornadas')
          .select('fase, nome_fase, objetivo_fase, consulta_numero, data_inicio_fase, duracao_semanas_prevista, metas_semana, proximo_marco, data_proximo_marco, evolucao_resumida')
          .eq('paciente_id', pacienteId)
          .maybeSingle(),
        supabase.from('jornada_historico')
          .select('fase, nome_fase, objetivo_fase, consulta_numero, data_inicio_fase, data_fim_fase, semanas_cumpridas, metas_semana, evolucao_resumida')
          .eq('paciente_id', pacienteId)
          .order('data_inicio_fase', { ascending: true }),
        supabase.from('habitos')
          .select('id, nome, emoji')
          .eq('paciente_id', pacienteId)
          .eq('ativo', true),
        supabase.rpc('paciente_protocolos_ativos_resumo'),
      ]);
      if (!active) return;
      setJornada(jRes.data ?? null);
      setHistorico(hRes.data ?? []);
      setHabitos(habRes.data ?? []);
      setProtocolos(protRes.data ?? []);
    }
    load();
    return () => { active = false; };
  }, [pacienteId]);

  function toggleMeta(metaId, concluida) {
    return toggleJornadaMeta(jornada, metaId, concluida, setJornada);
  }

  return { jornada, historico, habitos, protocolos, loading: jornada === undefined, toggleMeta };
}
