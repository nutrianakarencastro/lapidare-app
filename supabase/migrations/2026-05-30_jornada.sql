-- Jornada Útera: fase ativa e histórico de fases encerradas

-- ── Fase ativa (uma linha por paciente) ─────────────────────────────────────
create table if not exists public.jornadas (
  id                        uuid primary key default gen_random_uuid(),
  paciente_id               uuid not null references public.pacientes(id) on delete cascade,
  nutri_id                  uuid not null references public.nutris(id) on delete cascade,

  fase                      integer not null default 1,
  nome_fase                 text not null default 'Fase 1',
  objetivo_fase             text,

  data_inicio_fase          date not null default current_date,
  duracao_semanas_prevista  integer not null default 4,

  metas_semana              jsonb not null default '[]',
  -- formato: [{ id: uuid, texto: text, concluida: boolean }]

  proximo_marco             text,
  data_proximo_marco        date,

  consulta_numero           integer,                -- opcional — ex: 1, 2, 3

  evolucao_resumida         text,   -- visível à paciente
  observacoes               text,   -- interno — nunca retornado na query da paciente

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- Garante uma única jornada ativa por paciente
create unique index if not exists jornadas_paciente_idx
  on public.jornadas(paciente_id);

create index if not exists jornadas_nutri_idx
  on public.jornadas(nutri_id);

-- ── Histórico de fases encerradas (imutável após inserção) ──────────────────
create table if not exists public.jornada_historico (
  id                  uuid primary key default gen_random_uuid(),
  paciente_id         uuid not null references public.pacientes(id) on delete cascade,
  nutri_id            uuid not null references public.nutris(id) on delete cascade,

  fase                integer not null,
  nome_fase           text not null,
  objetivo_fase       text,

  data_inicio_fase    date not null,
  data_fim_fase       date not null default current_date,
  semanas_cumpridas   integer not null,

  consulta_numero     integer,                -- snapshot do número da consulta no momento do encerramento

  metas_semana        jsonb not null default '[]',
  evolucao_resumida   text,
  observacoes         text,   -- interno

  arquivado_em        timestamptz not null default now()
);

create index if not exists jornada_historico_paciente_idx
  on public.jornada_historico(paciente_id, data_inicio_fase asc);

create index if not exists jornada_historico_nutri_idx
  on public.jornada_historico(nutri_id);

-- ── Row Level Security ───────────────────────────────────────────────────────
alter table public.jornadas          enable row level security;
alter table public.jornada_historico enable row level security;

-- Nutri: acesso total às suas pacientes
drop policy if exists jornadas_nutri              on public.jornadas;
drop policy if exists jornada_historico_nutri     on public.jornada_historico;
create policy jornadas_nutri              on public.jornadas          for all using (nutri_id = auth.uid());
create policy jornada_historico_nutri     on public.jornada_historico for all using (nutri_id = auth.uid());

-- Paciente: somente leitura da própria linha
drop policy if exists jornadas_paciente_select           on public.jornadas;
drop policy if exists jornada_historico_paciente_select  on public.jornada_historico;
create policy jornadas_paciente_select           on public.jornadas          for select using (paciente_id = auth.uid());
create policy jornada_historico_paciente_select  on public.jornada_historico for select using (paciente_id = auth.uid());

-- Paciente: sem acesso direto de UPDATE — usa RPC abaixo
drop policy if exists jornadas_paciente_update on public.jornadas;

-- RPC: única forma da paciente escrever em jornadas (somente metas_semana)
create or replace function public.paciente_marcar_meta(p_metas jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.jornadas
  set    metas_semana = p_metas,
         updated_at   = now()
  where  paciente_id = auth.uid();
end;
$$;

-- Apenas a paciente autenticada pode chamar esta função
revoke execute on function public.paciente_marcar_meta(jsonb) from public;
grant  execute on function public.paciente_marcar_meta(jsonb) to authenticated;
