-- Sprint A — Classificação Clínica das Pacientes
-- Sem CHECK constraint: opções controladas pelo frontend, permitindo expansão sem migration futura.

ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS categoria_clinica text;

COMMENT ON COLUMN public.pacientes.categoria_clinica IS
  'Foco clínico principal da paciente (hormonios, fertilidade_tentantes, gestacional, etc.)
   Valores controlados pelo frontend — sem CHECK para facilitar expansão futura.';
