import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';
import {
  classificar, metaLabel, REFEICOES_FIXAS, LABEL_REFEICAO, AVISO_HIPOGLICEMIA,
  salvarTimer, removerTimer, lerTimersHoje, timerVencido, timerEsperadoEm,
} from '../../lib/glicemiaUtils.js';
import { dataHojeISO } from '../../lib/utils.js';

function hojeISO() {
  return dataHojeISO();
}

function addDias(iso, n) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function dataBR(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ─── Badge colorido com o valor ──────────────────────────────────────────────
function Badge({ valor, tipo, protocolo }) {
  const cls = classificar(valor, tipo, protocolo);
  const cores = {
    meta:         { bg: 'var(--green-bg)',             cor: 'var(--green)' },
    fora_meta:    { bg: 'var(--red-bg)',               cor: 'var(--red)'   },
    hipoglicemia: { bg: 'var(--orange-bg, #fff7ed)',   cor: 'var(--orange)' },
  };
  const { bg, cor } = cores[cls];
  return (
    <span style={{
      fontSize: 13, fontWeight: 700, padding: '4px 10px',
      borderRadius: 999, background: bg, color: cor, whiteSpace: 'nowrap',
    }}>
      {cls === 'hipoglicemia' ? '⚠ ' : ''}{valor} mg/dL
    </span>
  );
}

// ─── Linha de refeição ────────────────────────────────────────────────────────
function LinhaRefeicao({ label, metaLbl, registro, inputVal, onInputChange, onSalvar, onEditar, onCancelar, salvando, erroMsg }) {
  const temValor = !!registro && !erroMsg;
  const editando = !registro || !!erroMsg;

  return (
    <div style={{
      padding: '14px 16px',
      borderBottom: '0.5px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 100 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--dark)' }}>{label}</div>
          <div style={{ fontSize: 11, color: 'var(--text4)', marginTop: 1 }}>
            Meta: {metaLbl} mg/dL
          </div>
        </div>

        {temValor ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Badge valor={registro.valor_mg_dl} tipo={registro.tipo_refeicao} protocolo={registro.protocolo} />
            <button
              onClick={onEditar}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
              title="Editar"
            >
              <i className="ti ti-pencil" style={{ fontSize: 15, color: 'var(--text3)' }} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              inputMode="numeric"
              placeholder="mg/dL"
              value={inputVal}
              onChange={e => onInputChange(e.target.value.replace(/\D/g, '').slice(0, 3))}
              onKeyDown={e => e.key === 'Enter' && onSalvar()}
              autoFocus={editando}
              style={{
                width: 76, padding: '7px 8px', fontSize: 14, textAlign: 'right',
                borderRadius: 7,
                border: '0.5px solid ' + (erroMsg ? 'var(--red)' : 'var(--border)'),
                fontFamily: 'var(--font-sans)', fontWeight: 600,
              }}
            />
            <button
              onClick={onSalvar}
              disabled={salvando || !inputVal}
              style={{
                background: 'var(--dark)', color: 'var(--white)',
                border: 'none', borderRadius: 7, padding: '7px 12px',
                fontSize: 12, cursor: salvando ? 'default' : 'pointer',
                opacity: !inputVal ? 0.4 : 1,
                fontFamily: 'var(--font-sans)',
              }}
            >
              {salvando ? '…' : 'Salvar'}
            </button>
            {registro && (
              <button
                onClick={onCancelar}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                title="Cancelar"
              >
                <i className="ti ti-x" style={{ fontSize: 15, color: 'var(--text3)' }} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>
      {erroMsg && (
        <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 5 }}>{erroMsg}</div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function DiarioGlicemico() {
  const { profile } = useSession();

  const [modulo, setModulo]     = useState(null);   // null=loading, false=inativo, obj=ativo
  const [dataSel, setDataSel]   = useState(hojeISO());
  const [registros, setRegistros] = useState([]);
  const [inputs, setInputs]     = useState({});     // key → string
  const [editando, setEditando] = useState({});     // key → bool (forçar campo aberto)
  const [salvando, setSalvando] = useState(null);   // key em andamento
  const [erros, setErros]       = useState({});     // key → msg
  const [novoExtra, setNovoExtra] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [timersLocais, setTimersLocais] = useState(() => lerTimersHoje());

  function atualizarTimers() { setTimersLocais(lerTimersHoje()); }

  function iniciarTimer(tipo) {
    salvarTimer(tipo, protocolo);
    atualizarTimers();
  }

  function cancelarTimerLocal(tipo) {
    removerTimer(tipo);
    atualizarTimers();
  }

  // Verificar módulo ativo
  useEffect(() => {
    async function checkModulo() {
      const { data } = await supabase
        .from('paciente_modulos')
        .select('modulo, ativo, config, ativado_em')
        .order('ativado_em', { ascending: false });
      const row = (data ?? []).find(r => r.modulo === 'diario_glicemico_dmg');
      setModulo(row?.ativo ? row : false);
    }
    if (profile) checkModulo();
  }, [profile]);

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase
      .from('diario_glicemico')
      .select('*')
      .eq('data', dataSel)
      .order('tipo_refeicao')
      .order('seq_extra', { ascending: true, nullsFirst: true });

    const regs = data ?? [];
    setRegistros(regs);

    // Preenche inputs com valores existentes
    const inp = {};
    for (const r of regs) {
      const key = r.tipo_refeicao + (r.seq_extra != null ? `_${r.seq_extra}` : '');
      inp[key] = String(r.valor_mg_dl);
    }
    setInputs(inp);
    setEditando({});
    setErros({});
    setNovoExtra(false);
    setCarregando(false);
  }

  useEffect(() => {
    if (modulo) carregar();
  }, [dataSel, modulo]);

  const protocolo = modulo?.config?.protocolo ?? '1h';
  const ehHoje    = dataSel === hojeISO();

  const extras = useMemo(
    () => registros
      .filter(r => r.tipo_refeicao === 'extra')
      .sort((a, b) => (a.seq_extra ?? 0) - (b.seq_extra ?? 0)),
    [registros],
  );

  const proximoSeqExtra = extras.length > 0
    ? Math.max(...extras.map(e => e.seq_extra ?? 0)) + 1
    : 1;

  // Semáforo do dia
  const resumoDia = useMemo(() => {
    if (registros.length === 0) return null;
    const classes = registros.map(r => classificar(r.valor_mg_dl, r.tipo_refeicao, r.protocolo));
    return {
      total:       registros.length,
      meta:        classes.filter(c => c === 'meta').length,
      fora_meta:   classes.filter(c => c === 'fora_meta').length,
      hipoglicemia: classes.filter(c => c === 'hipoglicemia').length,
    };
  }, [registros]);

  const temHipo = registros.some(r => r.valor_mg_dl < 70);

  function getRegistro(tipo, seq = null) {
    return registros.find(r =>
      r.tipo_refeicao === tipo &&
      (seq != null ? r.seq_extra === seq : r.seq_extra == null),
    ) ?? null;
  }

  async function salvar(tipo, seq = null) {
    const key   = tipo + (seq != null ? `_${seq}` : '');
    const vStr  = (inputs[key] ?? '').trim();
    const valor = parseInt(vStr, 10);

    if (!vStr || isNaN(valor) || valor < 40 || valor > 500) {
      setErros(e => ({ ...e, [key]: 'Insira um valor entre 40 e 500 mg/dL.' }));
      return;
    }
    setErros(e => { const n = { ...e }; delete n[key]; return n; });
    setSalvando(key);

    const existing = getRegistro(tipo, seq);

    if (existing) {
      await supabase.from('diario_glicemico')
        .update({ valor_mg_dl: valor, protocolo })
        .eq('id', existing.id);
    } else {
      await supabase.from('diario_glicemico').insert({
        paciente_id:   profile.id,
        data:          dataSel,
        tipo_refeicao: tipo,
        seq_extra:     seq,
        valor_mg_dl:   valor,
        protocolo,
      });
    }

    setSalvando(null);
    if (tipo === 'extra' && !existing) setNovoExtra(false);
    // Remove o timer desta refeição após salvar o valor
    removerTimer(tipo);
    await carregar();
    atualizarTimers();
  }

  // ─── Estados de carregamento ────────────────────────────────────────────────
  if (modulo === null) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
        Carregando…
      </div>
    );
  }

  if (modulo === false) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 32 }}>
        <i className="ti ti-droplet-off" style={{ fontSize: 32, color: 'var(--text4)', marginBottom: 12, display: 'block' }} aria-hidden="true" />
        <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>Módulo não disponível</div>
        <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6 }}>
          O Diário Glicêmico ainda não foi ativado<br />pela sua nutricionista.
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Badge de protocolo */}
      <div style={{ marginBottom: 14 }}>
        <span style={{
          fontSize: 11, padding: '3px 10px', borderRadius: 999, fontWeight: 500,
          background: 'var(--blue-bg, #eff6ff)', color: 'var(--blue)',
          border: '0.5px solid var(--blue)',
        }}>
          Protocolo {protocolo} · pós-prandial {protocolo === '1h' ? '<140' : '<120'} mg/dL
        </span>
      </div>

      {/* Navegação de data */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 14,
      }}>
        <button
          onClick={() => setDataSel(addDias(dataSel, -1))}
          style={{
            background: 'none', border: '0.5px solid var(--border)',
            borderRadius: 7, padding: '6px 10px', cursor: 'pointer',
          }}
        >
          <i className="ti ti-chevron-left" style={{ fontSize: 16 }} aria-hidden="true" />
        </button>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--dark)' }}>
            {dataBR(dataSel)}{ehHoje ? ' · hoje' : ''}
          </div>
          {!ehHoje && (
            <button
              onClick={() => setDataSel(hojeISO())}
              style={{
                fontSize: 11, color: 'var(--blue)', background: 'none',
                border: 'none', cursor: 'pointer', padding: 0,
                fontFamily: 'var(--font-sans)', marginTop: 2,
              }}
            >
              ir para hoje
            </button>
          )}
        </div>

        <button
          onClick={() => setDataSel(addDias(dataSel, 1))}
          disabled={ehHoje}
          style={{
            background: 'none', border: '0.5px solid var(--border)',
            borderRadius: 7, padding: '6px 10px',
            cursor: ehHoje ? 'default' : 'pointer', opacity: ehHoje ? 0.3 : 1,
          }}
        >
          <i className="ti ti-chevron-right" style={{ fontSize: 16 }} aria-hidden="true" />
        </button>
      </div>

      {/* Semáforo do dia */}
      {resumoDia ? (
        <div style={{
          marginBottom: 14, padding: '10px 14px', borderRadius: 10,
          background: resumoDia.hipoglicemia > 0
            ? 'var(--orange-bg, #fff7ed)'
            : resumoDia.fora_meta > 0
            ? 'var(--red-bg)'
            : 'var(--green-bg)',
          border: '0.5px solid ' + (
            resumoDia.hipoglicemia > 0 ? 'var(--orange)'
            : resumoDia.fora_meta > 0  ? 'var(--red)'
            : 'var(--green)'
          ),
          display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center',
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--dark)' }}>
            {resumoDia.total} registro{resumoDia.total > 1 ? 's' : ''}
          </span>
          {resumoDia.meta > 0 && (
            <span style={{ fontSize: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
              {resumoDia.meta} na meta
            </span>
          )}
          {resumoDia.fora_meta > 0 && (
            <span style={{ fontSize: 12, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', display: 'inline-block' }} />
              {resumoDia.fora_meta} fora da meta
            </span>
          )}
          {resumoDia.hipoglicemia > 0 && (
            <span style={{ fontSize: 12, color: 'var(--orange)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--orange)', display: 'inline-block' }} />
              {resumoDia.hipoglicemia} hipoglicemia{resumoDia.hipoglicemia > 1 ? 's' : ''}
            </span>
          )}
        </div>
      ) : !carregando && (
        <div style={{
          marginBottom: 14, padding: '10px 14px', borderRadius: 10,
          background: 'var(--bg2)', border: '0.5px solid var(--border)',
          fontSize: 13, color: 'var(--text3)',
        }}>
          Nenhum registro para {dataBR(dataSel)}.
        </div>
      )}

      {/* Refeições fixas */}
      <div className="card" style={{ padding: 0, marginBottom: 12 }}>
        {REFEICOES_FIXAS.map((tipo, i) => {
          const key = tipo;
          const reg = getRegistro(tipo, null);
          const estaEditando = editando[key] || !reg;
          // Timer para refeições pós-prandiais (não jejum)
          const timer = tipo !== 'jejum'
            ? timersLocais.find(t => t.tipo === tipo)
            : null;
          const timerAtivo   = timer && !timerVencido(timer) && !reg;
          const timerAtraso  = timer && timerVencido(timer) && !reg;
          return (
            <div key={tipo} style={{
              borderBottom: i < REFEICOES_FIXAS.length - 1 ? '0.5px solid var(--border)' : 'none',
            }}>
              <LinhaRefeicao
                label={LABEL_REFEICAO[tipo] + (tipo === 'jejum' ? '' : ` · ${protocolo} pós`)}
                metaLbl={metaLabel(tipo, protocolo)}
                registro={estaEditando ? null : reg}
                inputVal={inputs[key] ?? ''}
                onInputChange={v => setInputs(p => ({ ...p, [key]: v }))}
                onSalvar={() => salvar(tipo, null)}
                onEditar={() => {
                  setInputs(p => ({ ...p, [key]: String(reg.valor_mg_dl) }));
                  setEditando(e => ({ ...e, [key]: true }));
                  setErros(e => { const n = { ...e }; delete n[key]; return n; });
                }}
                onCancelar={() => setEditando(e => ({ ...e, [key]: false }))}
                salvando={salvando === key}
                erroMsg={erros[key]}
              />
              {/* Lembrete pós-prandial — só para refeições sem registro */}
              {tipo !== 'jejum' && !reg && (
                <div style={{
                  padding: '0 16px 11px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  {timerAtivo ? (
                    <>
                      <span style={{ fontSize: 11, color: 'var(--blue)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <i className="ti ti-bell" style={{ fontSize: 12 }} aria-hidden="true" />
                        Lembrete ativo — aferição esperada às {timerEsperadoEm(timer)}
                      </span>
                      <button
                        onClick={() => cancelarTimerLocal(tipo)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: 11, color: 'var(--text3)',
                          fontFamily: 'var(--font-sans)', padding: 0,
                        }}
                      >
                        Cancelar
                      </button>
                    </>
                  ) : timerAtraso ? (
                    <span style={{ fontSize: 11, color: 'var(--orange)', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 500 }}>
                      <i className="ti ti-bell-ringing" style={{ fontSize: 12 }} aria-hidden="true" />
                      Está na hora da sua aferição pós-refeição.
                    </span>
                  ) : (
                    <div>
                      <button
                        onClick={() => iniciarTimer(tipo)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: 11, color: 'var(--text3)',
                          fontFamily: 'var(--font-sans)', padding: 0,
                          display: 'flex', alignItems: 'center', gap: 5,
                        }}
                      >
                        <i className="ti ti-clock" style={{ fontSize: 12 }} aria-hidden="true" />
                        Comecei agora — ativar lembrete ({protocolo})
                      </button>
                      <div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 3, lineHeight: 1.4 }}>
                        Ative um lembrete para o momento ideal da aferição.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Extras */}
      <div className="section-label" style={{ marginBottom: 8 }}>
        Refeições extras{extras.length > 0 ? ` (${extras.length})` : ''}
      </div>

      <div className="card" style={{ padding: 0, marginBottom: 12 }}>
        {extras.map(reg => {
          const key = `extra_${reg.seq_extra}`;
          const estaEditando = editando[key];
          return (
            <div key={reg.id} style={{ borderBottom: '0.5px solid var(--border)' }}>
              <LinhaRefeicao
                label={`Extra ${reg.seq_extra} · ${protocolo} pós`}
                metaLbl={metaLabel('extra', protocolo)}
                registro={estaEditando ? null : reg}
                inputVal={inputs[key] ?? ''}
                onInputChange={v => setInputs(p => ({ ...p, [key]: v }))}
                onSalvar={() => salvar('extra', reg.seq_extra)}
                onEditar={() => {
                  setInputs(p => ({ ...p, [key]: String(reg.valor_mg_dl) }));
                  setEditando(e => ({ ...e, [key]: true }));
                  setErros(e => { const n = { ...e }; delete n[key]; return n; });
                }}
                onCancelar={() => setEditando(e => ({ ...e, [key]: false }))}
                salvando={salvando === key}
                erroMsg={erros[key]}
              />
            </div>
          );
        })}

        {/* Campo novo extra */}
        {novoExtra && (() => {
          const key = `extra_${proximoSeqExtra}`;
          return (
            <div style={{ borderBottom: '0.5px solid var(--border)' }}>
              <LinhaRefeicao
                label={`Extra ${proximoSeqExtra} · ${protocolo} pós`}
                metaLbl={metaLabel('extra', protocolo)}
                registro={null}
                inputVal={inputs[key] ?? ''}
                onInputChange={v => setInputs(p => ({ ...p, [key]: v }))}
                onSalvar={() => salvar('extra', proximoSeqExtra)}
                onEditar={() => {}}
                onCancelar={() => {
                  setNovoExtra(false);
                  setInputs(p => { const n = { ...p }; delete n[key]; return n; });
                  setErros(e => { const n = { ...e }; delete n[key]; return n; });
                }}
                salvando={salvando === key}
                erroMsg={erros[key]}
              />
            </div>
          );
        })()}

        <button
          onClick={() => {
            if (!novoExtra) {
              setNovoExtra(true);
              setInputs(p => ({ ...p, [`extra_${proximoSeqExtra}`]: '' }));
            }
          }}
          disabled={novoExtra}
          style={{
            width: '100%', padding: '12px 16px', background: 'none',
            border: 'none', cursor: novoExtra ? 'default' : 'pointer',
            fontSize: 13, color: novoExtra ? 'var(--text4)' : 'var(--text3)',
            display: 'flex', alignItems: 'center', gap: 8,
            fontFamily: 'var(--font-sans)',
          }}
        >
          <i className="ti ti-plus" style={{ fontSize: 15 }} aria-hidden="true" />
          Adicionar refeição extra
        </button>
      </div>

      {/* Alerta de hipoglicemia */}
      {temHipo && (
        <div style={{
          padding: '12px 14px', borderRadius: 10, marginBottom: 14,
          background: 'var(--orange-bg, #fff7ed)', border: '0.5px solid var(--orange)',
        }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <i className="ti ti-alert-triangle" style={{ fontSize: 18, color: 'var(--orange)', marginTop: 1, flexShrink: 0 }} aria-hidden="true" />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)', marginBottom: 4 }}>
                Atenção: hipoglicemia detectada
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
                {AVISO_HIPOGLICEMIA}
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--text4)', lineHeight: 1.5 }}>
        Registros salvos individualmente. O histórico fica disponível para sua nutricionista.
      </div>
    </>
  );
}
