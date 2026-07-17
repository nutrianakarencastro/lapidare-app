-- =============================================================
-- Migration: 2026-07-16_v2_2_consentimento_push.sql
-- Arquitetura da Atenção V2 — Sprint V2.2 (consentimento e Push)
--
-- Cria a persistência de consentimento de Push por categoria de
-- atenção, a tabela de assinaturas Web Push por dispositivo, e o
-- trigger AFTER INSERT que dispara a Edge Function push-adapter via
-- pg_net lendo apenas o secret dedicado no Vault. O disparo registra
-- motivo de falha em evento_entregas.metadata (best-effort duplo) para
-- diagnóstico sem depender exclusivamente dos logs do Postgres.
--
-- Princípios permanentes desta infraestrutura:
--   - Preferência e subscription são conceitos distintos e uma nunca
--     substitui a outra (ARQ V2 §7).
--   - O trigger nunca conhece conteúdo — envia apenas entrega_id e
--     evento_id. Todo payload permanece em evento_entregas e é lido
--     pelo Adapter (ARQ V2 §9, princípio "Fronteira entre disparo e
--     execução").
--   - Best-effort duro em cada camada: falha em Vault, em pg_net, no
--     provedor externo ou na Edge Function jamais derruba o INSERT
--     clínico em evento_entregas.
--
-- O que NÃO está aqui (deliberado):
--   - Preferências granulares além de categoria (horário, frequência,
--     dispositivo) — sprints futuras.
--   - Retries automáticos e coluna proxima_tentativa_em — entram na
--     V2.5, junto do Worker que os consome.
--   - Worker agendado — migração planejada para V2.5.
--   - Adapters de E-mail e WhatsApp.
--   - Categoria de atenção `reconhecimento` (registrada apenas na
--     documentação; entra no CHECK e no Catálogo quando surgir o
--     primeiro tipo real).
--
-- Provisionamento manual pós-deploy (SQL Editor, uma vez por
-- ambiente, executado com privilégios administrativos):
--   SELECT vault.create_secret(
--     '<64-hex-chars — openssl rand -hex 32>',
--     'push_adapter_secret',
--     'Chave apikey para pg_net -> Edge Function push-adapter'
--   );
--
-- URL da Edge Function: constante c_url na função
-- disparar_push_adapter (§ 8 desta migration). Não é segredo. Ajuste
-- ao aplicar a migration em um novo project_ref do Supabase.
--
-- Especificado em:
--   - ARQUITETURA_DA_ATENCAO_V2.md §§ 7, 8, 9, 11 + Apêndice A
--   - Commits doc-first: cda6824, 5840e84
--
-- Idempotente.
-- =============================================================


-- ── 1. Extensão pg_net ────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_net;


-- ── 2. Tabela preferencias_atencao ────────────────────────────

CREATE TABLE IF NOT EXISTS public.preferencias_atencao (
  paciente_id         UUID        NOT NULL
    REFERENCES public.pacientes(id) ON DELETE CASCADE,

  categoria_atencao   TEXT        NOT NULL
    CHECK (categoria_atencao IN (
      'comunicacao_clinica',
      'lembretes',
      'rastreios'
    )),

  push_ativo          BOOLEAN     NOT NULL DEFAULT FALSE,

  push_ativado_em     TIMESTAMPTZ,
  push_desativado_em  TIMESTAMPTZ,
  atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (paciente_id, categoria_atencao)
);

COMMENT ON TABLE public.preferencias_atencao IS
  'Face dinâmica da política de atenção (ARQ V2 §7). Consentimento por par '
  '(paciente_id, categoria_atencao). Ausência de linha equivale a push_ativo=false '
  '(silêncio default arquitetural permanente). Vocabulário canônico coerente '
  'com CATEGORIAS_ATENCAO no Catálogo (src/lib/catalogoTipos.js).';

COMMENT ON COLUMN public.preferencias_atencao.categoria_atencao IS
  'Categoria de opt-in reconhecida pelo sistema nesta sprint. CHECK restringe '
  'apenas ao vocabulário efetivamente presente no Catálogo — reconhecimento e '
  'quaisquer categorias futuras planejadas na documentação (ARQ V2 §A.3) '
  'exigem ALTER TABLE junto da sprint que introduzir o primeiro tipo real.';


-- ── 3. Tabela push_subscriptions ──────────────────────────────

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  paciente_id     UUID        NOT NULL
    REFERENCES public.pacientes(id) ON DELETE CASCADE,

  endpoint        TEXT        NOT NULL UNIQUE,
  p256dh          TEXT        NOT NULL,
  auth            TEXT        NOT NULL,

  user_agent      TEXT,
  plataforma      TEXT
    CHECK (plataforma IN ('ios', 'android', 'desktop', 'outro')
           OR plataforma IS NULL),

  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultimo_uso_em   TIMESTAMPTZ,

  revogado_em     TIMESTAMPTZ,
  revogado_motivo TEXT
    CHECK (revogado_motivo IN ('endpoint_invalido', 'opt_out', 'usuario_desinstalou')
           OR revogado_motivo IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_push_subs_paciente_ativas
  ON public.push_subscriptions (paciente_id)
  WHERE revogado_em IS NULL;

COMMENT ON TABLE public.push_subscriptions IS
  'Assinaturas Web Push por dispositivo do paciente. Distintas de '
  'preferencias_atencao (ARQ V2 §7): uma responde "qual dispositivo/endpoint '
  'pode receber a entrega?"; a outra "a paciente autorizou esta categoria?". '
  'Uma nunca substitui a outra. Nunca deleta linhas — revogação é sempre '
  'soft (revogado_em + revogado_motivo).';

COMMENT ON COLUMN public.push_subscriptions.endpoint IS
  'URL única gerada pelo provedor push do browser (FCM/Mozilla/Apple). '
  'UNIQUE reflete a realidade física do protocolo Web Push: um endpoint = um '
  'destino de entrega. Em caso de dispositivo compartilhado com múltiplos '
  'logins, o UPSERT em salvar_push_subscription atualiza paciente_id para o '
  'dono atual do login — coerente com a semântica de que a subscription '
  'pertence ao browser/PWA no escopo de origin, não ao usuário lógico.';


-- ── 4. RLS ────────────────────────────────────────────────────

-- preferencias_atencao

ALTER TABLE public.preferencias_atencao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "paciente_ve_suas_prefs" ON public.preferencias_atencao;
CREATE POLICY "paciente_ve_suas_prefs"
  ON public.preferencias_atencao FOR SELECT TO authenticated
  USING (paciente_id = meu_paciente_id());

DROP POLICY IF EXISTS "nutri_ve_prefs_suas_pacientes" ON public.preferencias_atencao;
CREATE POLICY "nutri_ve_prefs_suas_pacientes"
  ON public.preferencias_atencao FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pacientes p
      WHERE p.id       = preferencias_atencao.paciente_id
        AND p.nutri_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "prefs_sem_insert_direto" ON public.preferencias_atencao;
CREATE POLICY "prefs_sem_insert_direto"
  ON public.preferencias_atencao FOR INSERT TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "prefs_sem_update_direto" ON public.preferencias_atencao;
CREATE POLICY "prefs_sem_update_direto"
  ON public.preferencias_atencao FOR UPDATE TO authenticated
  USING (false);

DROP POLICY IF EXISTS "prefs_sem_delete_direto" ON public.preferencias_atencao;
CREATE POLICY "prefs_sem_delete_direto"
  ON public.preferencias_atencao FOR DELETE TO authenticated
  USING (false);

-- push_subscriptions

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Paciente vê apenas suas próprias subscriptions (para UI de gerenciamento).
-- Nutri NÃO tem policy SELECT — dados técnicos de dispositivo não são clínicos.
DROP POLICY IF EXISTS "paciente_ve_suas_subs" ON public.push_subscriptions;
CREATE POLICY "paciente_ve_suas_subs"
  ON public.push_subscriptions FOR SELECT TO authenticated
  USING (paciente_id = meu_paciente_id());

DROP POLICY IF EXISTS "subs_sem_insert_direto" ON public.push_subscriptions;
CREATE POLICY "subs_sem_insert_direto"
  ON public.push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "subs_sem_update_direto" ON public.push_subscriptions;
CREATE POLICY "subs_sem_update_direto"
  ON public.push_subscriptions FOR UPDATE TO authenticated
  USING (false);

DROP POLICY IF EXISTS "subs_sem_delete_direto" ON public.push_subscriptions;
CREATE POLICY "subs_sem_delete_direto"
  ON public.push_subscriptions FOR DELETE TO authenticated
  USING (false);


-- ── 5. RPCs para paciente authenticated ───────────────────────

-- set_preferencia_push: upsert de consentimento por categoria.
-- Não mexe em subscriptions — a subscription é do dispositivo, não da
-- categoria. Desligar uma categoria (V2.2: única) simplesmente pausa
-- emissões daquela categoria; subscription permanece disponível para
-- outras categorias que a paciente venha a ativar no futuro.
DROP FUNCTION IF EXISTS public.set_preferencia_push(TEXT, BOOLEAN);
CREATE OR REPLACE FUNCTION public.set_preferencia_push(
  p_categoria_atencao TEXT,
  p_ativo             BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paciente_id UUID;
BEGIN
  v_paciente_id := meu_paciente_id();

  IF v_paciente_id IS NULL
     OR p_categoria_atencao IS NULL
     OR p_categoria_atencao = '' THEN
    RETURN;  -- silent no-op coerente com padrão best-effort do Motor de Eventos
  END IF;

  INSERT INTO public.preferencias_atencao (
    paciente_id, categoria_atencao, push_ativo,
    push_ativado_em, push_desativado_em, atualizado_em
  ) VALUES (
    v_paciente_id, p_categoria_atencao, p_ativo,
    CASE WHEN p_ativo THEN NOW() ELSE NULL END,
    CASE WHEN p_ativo THEN NULL ELSE NOW() END,
    NOW()
  )
  ON CONFLICT (paciente_id, categoria_atencao) DO UPDATE SET
    push_ativo         = EXCLUDED.push_ativo,
    push_ativado_em    = CASE WHEN EXCLUDED.push_ativo
                              THEN NOW()
                              ELSE preferencias_atencao.push_ativado_em END,
    push_desativado_em = CASE WHEN EXCLUDED.push_ativo
                              THEN preferencias_atencao.push_desativado_em
                              ELSE NOW() END,
    atualizado_em      = NOW();
END $$;

REVOKE EXECUTE ON FUNCTION public.set_preferencia_push(TEXT, BOOLEAN) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.set_preferencia_push(TEXT, BOOLEAN) TO authenticated;


-- salvar_push_subscription: upsert por endpoint. Idempotente. Reativa
-- subscription revogada do mesmo endpoint (mesmo dispositivo, mesma paciente).
DROP FUNCTION IF EXISTS public.salvar_push_subscription(TEXT, TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.salvar_push_subscription(
  p_endpoint    TEXT,
  p_p256dh      TEXT,
  p_auth        TEXT,
  p_user_agent  TEXT,
  p_plataforma  TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paciente_id UUID;
  v_id          UUID;
BEGIN
  v_paciente_id := meu_paciente_id();

  IF v_paciente_id IS NULL
     OR p_endpoint  IS NULL OR p_endpoint = ''
     OR p_p256dh    IS NULL OR p_p256dh   = ''
     OR p_auth      IS NULL OR p_auth     = '' THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.push_subscriptions (
    paciente_id, endpoint, p256dh, auth, user_agent, plataforma
  ) VALUES (
    v_paciente_id, p_endpoint, p_p256dh, p_auth, p_user_agent, p_plataforma
  )
  ON CONFLICT (endpoint) DO UPDATE SET
    paciente_id     = v_paciente_id,
    p256dh          = EXCLUDED.p256dh,
    auth            = EXCLUDED.auth,
    user_agent      = EXCLUDED.user_agent,
    plataforma      = EXCLUDED.plataforma,
    revogado_em     = NULL,
    revogado_motivo = NULL
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.salvar_push_subscription(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.salvar_push_subscription(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;


-- revogar_subscription_por_endpoint: paciente desativa push em UM dispositivo
-- (o dela). Usado por UI de gerenciamento e pelo botão "Desativar neste
-- dispositivo".
DROP FUNCTION IF EXISTS public.revogar_subscription_por_endpoint(TEXT);
CREATE OR REPLACE FUNCTION public.revogar_subscription_por_endpoint(
  p_endpoint TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paciente_id UUID;
BEGIN
  v_paciente_id := meu_paciente_id();

  IF v_paciente_id IS NULL OR p_endpoint IS NULL OR p_endpoint = '' THEN
    RETURN;
  END IF;

  UPDATE public.push_subscriptions
     SET revogado_em     = NOW(),
         revogado_motivo = 'opt_out'
   WHERE endpoint        = p_endpoint
     AND paciente_id     = v_paciente_id
     AND revogado_em IS NULL;
END $$;

REVOKE EXECUTE ON FUNCTION public.revogar_subscription_por_endpoint(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.revogar_subscription_por_endpoint(TEXT) TO authenticated;


-- ── 6. RPCs para o Adapter (executadas com service role) ──────

-- revogar_subscription: chamada pelo Adapter quando provedor retorna 410/404.
-- Atualiza sem filtro por paciente_id (Adapter opera com escopo administrativo).
DROP FUNCTION IF EXISTS public.revogar_subscription(TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.revogar_subscription(
  p_endpoint TEXT,
  p_motivo   TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_endpoint IS NULL OR p_endpoint = ''
     OR p_motivo NOT IN ('endpoint_invalido', 'opt_out', 'usuario_desinstalou') THEN
    RETURN;
  END IF;

  UPDATE public.push_subscriptions
     SET revogado_em     = NOW(),
         revogado_motivo = p_motivo
   WHERE endpoint        = p_endpoint
     AND revogado_em IS NULL;
END $$;

REVOKE EXECUTE ON FUNCTION public.revogar_subscription(TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.revogar_subscription(TEXT, TEXT) TO service_role;


-- marcar_entrega_enviada: Adapter reporta sucesso ao provedor.
-- metadata é acumulado (merge) — nunca sobrescrito.
DROP FUNCTION IF EXISTS public.marcar_entrega_enviada(UUID, JSONB);
CREATE OR REPLACE FUNCTION public.marcar_entrega_enviada(
  p_entrega_id UUID,
  p_metadata   JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_entrega_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.evento_entregas
     SET status      = 'enviado',
         tentado_em  = COALESCE(tentado_em, NOW()),
         entregue_em = NOW(),
         metadata    = COALESCE(metadata, '{}'::jsonb) || COALESCE(p_metadata, '{}'::jsonb)
   WHERE id          = p_entrega_id
     AND status      = 'pendente';
END $$;

REVOKE EXECUTE ON FUNCTION public.marcar_entrega_enviada(UUID, JSONB) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.marcar_entrega_enviada(UUID, JSONB) TO service_role;


-- marcar_entrega_falhou: Adapter reporta falha. erro é estruturado.
DROP FUNCTION IF EXISTS public.marcar_entrega_falhou(UUID, JSONB, JSONB);
CREATE OR REPLACE FUNCTION public.marcar_entrega_falhou(
  p_entrega_id UUID,
  p_erro       JSONB,
  p_metadata   JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_entrega_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.evento_entregas
     SET status     = 'falhou',
         tentado_em = COALESCE(tentado_em, NOW()),
         erro       = COALESCE(p_erro, '{}'::jsonb),
         metadata   = COALESCE(metadata, '{}'::jsonb) || COALESCE(p_metadata, '{}'::jsonb)
   WHERE id         = p_entrega_id
     AND status     = 'pendente';
END $$;

REVOKE EXECUTE ON FUNCTION public.marcar_entrega_falhou(UUID, JSONB, JSONB) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.marcar_entrega_falhou(UUID, JSONB, JSONB) TO service_role;


-- ── 7. Função e trigger de emissão imediata ───────────────────

-- disparar_push_adapter: chamada por trigger AFTER INSERT em evento_entregas
-- quando superfície é 'push'. Lê push_adapter_secret do Vault, faz
-- pg_net.http_post async para a Edge Function com apenas identificadores.
-- NUNCA envia conteúdo — princípio "fronteira entre disparo e execução"
-- (ARQ V2 §9). Best-effort duro em cada exceção.
CREATE OR REPLACE FUNCTION public.disparar_push_adapter()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  -- URL da Edge Function push-adapter neste ambiente Supabase.
  -- Não é segredo; hardcoded como constante da migration para manter
  -- todas as configurações fora do Vault (só segredos vão para o Vault).
  -- Ajuste ao aplicar esta migration em um novo project_ref.
  c_url    CONSTANT TEXT := 'https://rxctaeivmooywppfhidb.supabase.co/functions/v1/push-adapter';
  v_secret TEXT;
BEGIN
  -- MVP V2.2: só push. E-mail/WhatsApp virão em sprints futuras.
  IF NEW.superficie <> 'push' THEN
    RETURN NEW;
  END IF;

  -- Leitura do secret dedicado no Vault. Best-effort.
  BEGIN
    SELECT decrypted_secret INTO v_secret
      FROM vault.decrypted_secrets
     WHERE name = 'push_adapter_secret'
     LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[Utera] disparar_push_adapter: falha ao ler Vault (%)', SQLERRM;
    -- Auditoria non-blocking: registra motivo do não-disparo na própria entrega.
    -- Formato compatível com V2.5 (retries), onde disparo_tentativas será incrementado.
    BEGIN
      UPDATE public.evento_entregas
         SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
           'disparo_erro',       'vault_read_error',
           'disparo_erro_em',    NOW(),
           'disparo_tentativas', 1
         )
       WHERE id = NEW.id;
    EXCEPTION WHEN OTHERS THEN
      NULL;  -- best-effort duplo: falha na auditoria também não propaga
    END;
    RETURN NEW;
  END;

  IF v_secret IS NULL THEN
    RAISE WARNING '[Utera] disparar_push_adapter: secret push_adapter_secret ausente no Vault';
    BEGIN
      UPDATE public.evento_entregas
         SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
           'disparo_erro',       'vault_secret_missing',
           'disparo_erro_em',    NOW(),
           'disparo_tentativas', 1
         )
       WHERE id = NEW.id;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    RETURN NEW;
  END IF;

  -- Chamada async ao Adapter. Body carrega APENAS identificadores.
  -- Nunca título, corpo, rota, categoria, idioma, plataforma ou qualquer
  -- detalhe da projeção. Todo o payload permanece em evento_entregas
  -- (fronteira entre disparo e execução — ARQ V2 §9).
  BEGIN
    PERFORM net.http_post(
      url                  := c_url,
      body                 := jsonb_build_object(
        'entrega_id', NEW.id,
        'evento_id',  NEW.evento_id
      ),
      headers              := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey',       v_secret
      ),
      timeout_milliseconds := 5000
    );
  EXCEPTION WHEN OTHERS THEN
    -- Best-effort duro: falha do pg_net nunca derruba o INSERT clínico.
    RAISE WARNING '[Utera] disparar_push_adapter: falha em net.http_post (%)', SQLERRM;
    BEGIN
      UPDATE public.evento_entregas
         SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
           'disparo_erro',       'pg_net_error',
           'disparo_erro_em',    NOW(),
           'disparo_tentativas', 1
         )
       WHERE id = NEW.id;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END;

  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.disparar_push_adapter() IS
  'Trigger AFTER INSERT em evento_entregas. Para superficie=''push'', chama '
  'Edge Function push-adapter via pg_net.http_post enviando apenas entrega_id '
  'e evento_id no body — jamais conteúdo (ARQ V2 §9). Best-effort duplo: '
  'falha em Vault ou pg_net não derruba o INSERT e registra o motivo em '
  'metadata (disparo_erro, disparo_erro_em, disparo_tentativas) para '
  'diagnóstico sem depender exclusivamente dos logs do Postgres.';

DROP TRIGGER IF EXISTS trg_disparar_push_adapter ON public.evento_entregas;
CREATE TRIGGER trg_disparar_push_adapter
  AFTER INSERT ON public.evento_entregas
  FOR EACH ROW EXECUTE FUNCTION public.disparar_push_adapter();
