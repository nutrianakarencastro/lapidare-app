-- =============================================================
-- Sincronização Hábito → Meta da Jornada
-- Sentido único: marcar hábito atualiza meta vinculada.
-- Marcar meta NÃO escreve em habitos_logs.
-- =============================================================

-- RPC substitui a escrita direta em habitos_logs nos clientes.
-- Ao registrar o hábito, atualiza automaticamente qualquer meta
-- da jornada ativa que tenha habito_id = p_habito_id.

create or replace function public.paciente_marcar_habito_e_meta(
  p_habito_id uuid,
  p_valor     numeric,
  p_data      date default current_date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Validação: p_habito_id deve existir, pertencer à paciente autenticada e estar ativo.
  -- Se a verificação falhar, a função encerra sem fazer nada (fail-safe silencioso).
  if not exists (
    select 1 from public.habitos
    where id         = p_habito_id
      and paciente_id = auth.uid()
      and ativo       = true
  ) then
    return;
  end if;

  -- 1. Registrar (ou remover) o log do hábito
  if p_valor > 0 then
    insert into public.habitos_logs (habito_id, paciente_id, data, valor)
    values (p_habito_id, auth.uid(), p_data, p_valor)
    on conflict (habito_id, data) do update set valor = excluded.valor;
  else
    delete from public.habitos_logs
    where habito_id   = p_habito_id
      and paciente_id = auth.uid()
      and data        = p_data;
  end if;

  -- 2. Sincronizar meta vinculada na jornada ativa (sentido único: hábito → meta)
  --    Se não houver jornada ativa ou nenhuma meta vinculada, UPDATE afeta 0 linhas — seguro.
  update public.jornadas
  set
    metas_semana = (
      select coalesce(
        jsonb_agg(
          case
            when (m ->> 'habito_id') = p_habito_id::text
            then jsonb_set(m, '{concluida}', to_jsonb(p_valor > 0))
            else m
          end
        ),
        '[]'::jsonb
      )
      from jsonb_array_elements(metas_semana) m
    ),
    updated_at = now()
  where paciente_id = auth.uid();
end;
$$;

revoke execute on function public.paciente_marcar_habito_e_meta(uuid, numeric, date) from public;
grant  execute on function public.paciente_marcar_habito_e_meta(uuid, numeric, date) to authenticated;
