-- Eixo Perimenopausa: novos campos em ciclo_sintomas_diarios
-- calorons e suor_noturno já existem — apenas os 4 campos abaixo são adicionados

alter table public.ciclo_sintomas_diarios
  add column if not exists despertar_noturno boolean not null default false,
  add column if not exists dor_articular     boolean not null default false,
  add column if not exists fluxo_muito_maior boolean not null default false,
  add column if not exists fluxo_muito_menor boolean not null default false;
