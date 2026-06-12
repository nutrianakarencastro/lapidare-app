-- Sprint D — Diário Intestinal Recorrente
-- Campo náuseas: mesmo padrão dos outros sintomas (0-3)

ALTER TABLE public.intestino_logs
  ADD COLUMN IF NOT EXISTS nauseas smallint
    CHECK (nauseas BETWEEN 0 AND 3);

COMMENT ON COLUMN public.intestino_logs.nauseas IS
  '0=nenhuma 1=leve 2=moderada 3=forte — campo do diário recorrente (Sprint D)';
