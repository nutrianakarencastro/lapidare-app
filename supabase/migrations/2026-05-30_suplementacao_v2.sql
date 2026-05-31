-- =============================================================
-- Suplementação v2
-- 1. Novos campos em suplementos (opcionais)
-- 2. Tabela farmacias (global por nutri)
-- 3. Tabela farmacias_paciente (vínculo + cupom por paciente)
-- Idempotente — cole no SQL Editor do Supabase e clique Run.
-- =============================================================

-- ── 1. Novos campos em suplementos ───────────────────────────────────────────
alter table public.suplementos
  add column if not exists marca            text,
  add column if not exists posologia        text,
  add column if not exists duracao_prevista text,
  add column if not exists link_compra      text,
  add column if not exists cupom_desconto   text,
  add column if not exists objetivo_clinico jsonb not null default '[]';
  -- formato: ["sono_recuperacao", "saude_hormonal", ...]

-- ── 2. Farmácias globais (por nutricionista) ──────────────────────────────────
create table if not exists public.farmacias (
  id              uuid primary key default gen_random_uuid(),
  nutri_id        uuid not null references public.nutris(id) on delete cascade,
  nome            text not null,
  telefone        text,
  link_contato    text,
  codigo_desconto text,    -- cupom padrão global
  arquivo_url     text,    -- link externo para folder, imagem de cupom, etc.
  observacoes     text,
  ordem           int  not null default 0,
  ativa           boolean not null default true,
  created_at      timestamptz not null default now()
);

create index if not exists farmacias_nutri_idx
  on public.farmacias(nutri_id, ativa, ordem);

-- ── 3. Vínculos farmácia ↔ paciente ──────────────────────────────────────────
create table if not exists public.farmacias_paciente (
  id              uuid primary key default gen_random_uuid(),
  farmacia_id     uuid not null references public.farmacias(id) on delete cascade,
  paciente_id     uuid not null references public.pacientes(id) on delete cascade,
  nutri_id        uuid not null references public.nutris(id) on delete cascade,
  codigo_desconto text,    -- sobrescreve o global se preenchido
  ordem           int  not null default 0,
  created_at      timestamptz not null default now(),
  unique (farmacia_id, paciente_id)
);

create index if not exists farmacias_paciente_paciente_idx
  on public.farmacias_paciente(paciente_id);
create index if not exists farmacias_paciente_nutri_idx
  on public.farmacias_paciente(nutri_id);

-- ── 4. RLS ────────────────────────────────────────────────────────────────────
alter table public.farmacias          enable row level security;
alter table public.farmacias_paciente enable row level security;

-- farmacias: nutri gerencia as próprias;
--            paciente lê as que estão vinculadas a ela
drop policy if exists farmacias_nutri_all          on public.farmacias;
drop policy if exists farmacias_select_paciente    on public.farmacias;

create policy farmacias_nutri_all on public.farmacias
  for all
  using  (nutri_id = auth.uid())
  with check (nutri_id = auth.uid());

create policy farmacias_select_paciente on public.farmacias
  for select using (
    exists (
      select 1 from public.farmacias_paciente fp
      where fp.farmacia_id = id
        and fp.paciente_id = auth.uid()
    )
  );

-- farmacias_paciente: nutri gerencia; paciente lê os próprios vínculos
drop policy if exists farmacias_paciente_nutri_all         on public.farmacias_paciente;
drop policy if exists farmacias_paciente_select_paciente   on public.farmacias_paciente;

create policy farmacias_paciente_nutri_all on public.farmacias_paciente
  for all
  using  (nutri_id = auth.uid())
  with check (nutri_id = auth.uid());

create policy farmacias_paciente_select_paciente on public.farmacias_paciente
  for select using (paciente_id = auth.uid());
