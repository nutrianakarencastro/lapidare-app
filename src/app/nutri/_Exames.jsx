import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { dataBR } from '../../lib/utils.js';

const CATEGORIAS = [
  { id: 'sangue',     label: 'Sangue',     emoji: '🩸' },
  { id: 'urina',      label: 'Urina',      emoji: '💧' },
  { id: 'saliva',     label: 'Saliva',     emoji: '🫧' },
  { id: 'fezes',      label: 'Fezes',      emoji: '🔬' },
  { id: 'intestinal', label: 'Intestinal', emoji: '🦠' },
  { id: 'genetico',   label: 'Genético',   emoji: '🧬' },
  { id: 'hormonal',   label: 'Hormonal',   emoji: '⚡' },
  { id: 'microbiota', label: 'Microbiota', emoji: '🦠' },
  { id: 'toxicidade', label: 'Toxicidade', emoji: '🧪' },
  { id: 'imagem',     label: 'Imagem',     emoji: '🖼️' },
  { id: 'outro',      label: 'Outro',      emoji: '📄' },
];

const STATUS_OPTS = [
  { id: 'solicitado',           label: 'Solicitado' },
  { id: 'aguardando_resultado', label: 'Aguardando resultado' },
  { id: 'recebido',             label: 'Recebido' },
  { id: 'avaliado',             label: 'Avaliado' },
];

const inpSt = {
  width: '100%', boxSizing: 'border-box',
  padding: '7px 10px', borderRadius: 6,
  border: '0.5px solid var(--border, #e0dbd4)',
  fontSize: 13, fontFamily: 'var(--font-sans)',
  background: 'var(--white)', color: 'var(--dark)',
};

const taSt = { ...inpSt, resize: 'vertical', minHeight: 72 };

function SecLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, letterSpacing: 1, textTransform: 'uppercase',
      color: 'var(--text3, var(--muted))', fontWeight: 500,
      marginBottom: 6, marginTop: 14,
    }}>{children}</div>
  );
}

function catEmoji(cat) {
  return CATEGORIAS.find(c => c.id === cat)?.emoji ?? '📄';
}

export default function Exames({ pacienteId, nutriId }) {
  const [avaliacoes, setAvaliacoes]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [openId, setOpenId]           = useState(null);
  const [editando, setEditando]       = useState({});
  const [criando, setCriando]         = useState(false);
  const [novoForm, setNovoForm]       = useState({ titulo: '', data_avaliacao: today() });
  const [novoArq, setNovoArq]         = useState(arqVazio());
  const [fileKey, setFileKey]         = useState(0);
  const [uploadando, setUploadando]   = useState(false);
  const [salvando, setSalvando]       = useState(false);
  const [feedback, setFeedback]       = useState(null);

  function today() { return new Date().toISOString().slice(0, 10); }
  function arqVazio() {
    return { tipo: 'pedido', categoria: 'sangue', titulo: '', status: 'solicitado', data_recebimento: '', file: null };
  }

  function ok(msg) { setFeedback({ tipo: 'ok', msg }); setTimeout(() => setFeedback(null), 3000); }
  function erro(msg) { setFeedback({ tipo: 'erro', msg }); }

  useEffect(() => { carregar(); }, [pacienteId]);

  async function carregar() {
    setLoading(true);
    const { data } = await supabase
      .from('exames_avaliacoes')
      .select('*, exames_arquivos(*)')
      .eq('paciente_id', pacienteId)
      .order('data_avaliacao', { ascending: false });
    setAvaliacoes(data ?? []);
    setLoading(false);
  }

  function abrirEdicao(av) {
    setOpenId(av.id);
    setEditando({
      titulo:               av.titulo               ?? '',
      data_avaliacao:       av.data_avaliacao        ?? today(),
      data_coleta:          av.data_coleta           ?? '',
      conquistas:           av.conquistas            ?? '',
      impacto_nos_sintomas: av.impacto_nos_sintomas  ?? '',
      evolucao_resumida:    av.evolucao_resumida     ?? '',
      pontos_atencao:       av.pontos_atencao        ?? '',
      proximos_passos:      av.proximos_passos       ?? '',
      avaliacao_funcional:  av.avaliacao_funcional   ?? '',
    });
    setNovoArq(arqVazio());
    setFileKey(k => k + 1);
    setFeedback(null);
  }

  function fecharEdicao() { setOpenId(null); setFeedback(null); }

  async function criarAvaliacao() {
    if (!novoForm.data_avaliacao) return;
    setSalvando(true);
    const { data, error } = await supabase
      .from('exames_avaliacoes')
      .insert({ paciente_id: pacienteId, nutri_id: nutriId, created_by: nutriId, titulo: novoForm.titulo || null, data_avaliacao: novoForm.data_avaliacao })
      .select('*, exames_arquivos(*)')
      .single();
    setSalvando(false);
    if (error) { erro(error.message); return; }
    setAvaliacoes(prev => [data, ...prev]);
    setCriando(false);
    setNovoForm({ titulo: '', data_avaliacao: today() });
    abrirEdicao(data);
  }

  async function salvarCampos(id) {
    setSalvando(true);
    const { error } = await supabase
      .from('exames_avaliacoes')
      .update({
        titulo:               editando.titulo               || null,
        data_avaliacao:       editando.data_avaliacao,
        data_coleta:          editando.data_coleta          || null,
        conquistas:           editando.conquistas           || null,
        impacto_nos_sintomas: editando.impacto_nos_sintomas || null,
        evolucao_resumida:    editando.evolucao_resumida    || null,
        pontos_atencao:       editando.pontos_atencao       || null,
        proximos_passos:      editando.proximos_passos      || null,
        avaliacao_funcional:  editando.avaliacao_funcional  || null,
      })
      .eq('id', id);
    setSalvando(false);
    if (error) { erro(error.message); return; }
    ok('Campos salvos.');
    setAvaliacoes(prev => prev.map(a => a.id === id ? { ...a, ...editando } : a));
  }

  async function duplicarAvaliacao(av) {
    const { data, error } = await supabase
      .from('exames_avaliacoes')
      .insert({
        paciente_id: pacienteId, nutri_id: nutriId, created_by: nutriId,
        titulo: `Cópia de ${av.titulo || 'Avaliação'}`,
        data_avaliacao: today(),
        conquistas:           av.conquistas           ?? null,
        impacto_nos_sintomas: av.impacto_nos_sintomas ?? null,
        evolucao_resumida:    av.evolucao_resumida    ?? null,
        pontos_atencao:       av.pontos_atencao       ?? null,
        proximos_passos:      av.proximos_passos      ?? null,
        avaliacao_funcional:  av.avaliacao_funcional  ?? null,
      })
      .select('*, exames_arquivos(*)')
      .single();
    if (error) { erro(error.message); return; }
    setAvaliacoes(prev => [data, ...prev]);
    abrirEdicao(data);
  }

  async function excluirAvaliacao(av) {
    if (!window.confirm('Excluir esta avaliação e todos os seus arquivos?')) return;
    const paths = (av.exames_arquivos ?? []).map(a => a.storage_path).filter(Boolean);
    if (paths.length > 0) await supabase.storage.from('exames').remove(paths);
    await supabase.from('exames_avaliacoes').delete().eq('id', av.id);
    setAvaliacoes(prev => prev.filter(a => a.id !== av.id));
    if (openId === av.id) fecharEdicao();
  }

  async function adicionarArquivo(avaliacaoId) {
    const { file, tipo, categoria, titulo, status, data_recebimento } = novoArq;
    if (!file) { erro('Selecione um arquivo PDF.'); return; }
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      erro('Apenas arquivos PDF são aceitos.'); return;
    }
    if (file.size > 10 * 1024 * 1024) { erro('Tamanho máximo: 10 MB.'); return; }
    setUploadando(true);
    const path = `${pacienteId}/${avaliacaoId}/${Date.now()}-${tipo}.pdf`;
    const { error: upErr } = await supabase.storage.from('exames').upload(path, file);
    if (upErr) { setUploadando(false); erro(upErr.message); return; }
    const { data: row, error: dbErr } = await supabase
      .from('exames_arquivos')
      .insert({
        avaliacao_id: avaliacaoId, paciente_id: pacienteId, nutri_id: nutriId,
        tipo, categoria, titulo: titulo || null, status,
        data_recebimento: data_recebimento || null,
        storage_path: path, nome_arquivo: file.name,
      })
      .select()
      .single();
    setUploadando(false);
    if (dbErr) {
      await supabase.storage.from('exames').remove([path]);
      erro(dbErr.message); return;
    }
    ok('Arquivo enviado.');
    setNovoArq(arqVazio());
    setFileKey(k => k + 1);
    setAvaliacoes(prev => prev.map(a =>
      a.id === avaliacaoId ? { ...a, exames_arquivos: [...(a.exames_arquivos ?? []), row] } : a
    ));
  }

  async function excluirArquivo(arq, avaliacaoId) {
    if (!window.confirm('Excluir este arquivo?')) return;
    await supabase.storage.from('exames').remove([arq.storage_path]);
    await supabase.from('exames_arquivos').delete().eq('id', arq.id);
    setAvaliacoes(prev => prev.map(a =>
      a.id === avaliacaoId ? { ...a, exames_arquivos: (a.exames_arquivos ?? []).filter(f => f.id !== arq.id) } : a
    ));
  }

  async function alterarStatus(arq, novoStatus, avaliacaoId) {
    const updates = {
      status: novoStatus,
      data_recebimento: (novoStatus === 'recebido' || novoStatus === 'avaliado') && !arq.data_recebimento
        ? today() : arq.data_recebimento,
    };
    const { error } = await supabase.from('exames_arquivos').update(updates).eq('id', arq.id);
    if (error) { erro(`Erro ao atualizar status: ${error.message}`); return; }
    setAvaliacoes(prev => prev.map(a =>
      a.id === avaliacaoId
        ? { ...a, exames_arquivos: (a.exames_arquivos ?? []).map(f => f.id === arq.id ? { ...f, ...updates } : f) }
        : a
    ));
  }

  if (loading) return <div style={{ padding: 16, color: 'var(--text3)' }}>Carregando…</div>;

  return (
    <div style={{ padding: '12px 0' }}>
      {/* Feedback */}
      {feedback && (
        <div style={{
          margin: '0 0 12px', padding: '8px 12px', borderRadius: 8, fontSize: 12,
          background: feedback.tipo === 'ok' ? '#f0fdf4' : '#fff0f0',
          color: feedback.tipo === 'ok' ? '#166534' : '#c0392b',
          border: `0.5px solid ${feedback.tipo === 'ok' ? '#bbf7d0' : '#f5c0c0'}`,
        }}>
          {feedback.msg}
        </div>
      )}

      {/* Botão nova avaliação */}
      {!criando && (
        <button
          className="btn"
          onClick={() => { setCriando(true); fecharEdicao(); }}
          style={{ marginBottom: 14 }}>
          + Nova avaliação
        </button>
      )}

      {/* Form de criação */}
      {criando && (
        <div style={{
          background: 'var(--paper, var(--bg-soft))',
          border: '0.5px solid var(--border, #e0dbd4)',
          borderRadius: 10, padding: 14, marginBottom: 14,
        }}>
          <SecLabel>Nova avaliação</SecLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <input
              style={inpSt}
              placeholder="Título (ex: Avaliação Jul/2026)"
              value={novoForm.titulo}
              onChange={e => setNovoForm(f => ({ ...f, titulo: e.target.value }))}
            />
            <input
              type="date" style={inpSt}
              value={novoForm.data_avaliacao}
              onChange={e => setNovoForm(f => ({ ...f, data_avaliacao: e.target.value }))}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={criarAvaliacao} disabled={salvando}>
              {salvando ? 'Criando…' : 'Criar'}
            </button>
            <button className="btn ghost" onClick={() => setCriando(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Lista de avaliações */}
      {avaliacoes.length === 0 && !criando && (
        <div style={{ color: 'var(--text3)', fontSize: 13 }}>
          Nenhuma avaliação de exames ainda.
        </div>
      )}

      {avaliacoes.map(av => {
        const isOpen = openId === av.id;
        const arquivos = (av.exames_arquivos ?? []).slice().sort((a, b) =>
          new Date(a.created_at) - new Date(b.created_at)
        );

        return (
          <div key={av.id} style={{
            border: `0.5px solid ${isOpen ? 'var(--dark)' : 'var(--border, #e0dbd4)'}`,
            borderRadius: 10, marginBottom: 10, overflow: 'hidden',
          }}>
            {/* Cabeçalho do card */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px',
              background: isOpen ? 'var(--dark)' : 'var(--white)',
              cursor: 'pointer',
            }} onClick={() => isOpen ? fecharEdicao() : abrirEdicao(av)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 500, fontSize: 13,
                  color: isOpen ? 'var(--dark-text, #faf8f5)' : 'var(--dark)',
                }}>
                  {av.titulo || 'Sem título'}
                </div>
                <div style={{
                  fontSize: 11,
                  color: isOpen ? 'var(--dark-muted, rgba(255,255,255,.6))' : 'var(--text3)',
                  marginTop: 2,
                }}>
                  {av.data_avaliacao && dataBR(av.data_avaliacao)}
                  {arquivos.length > 0 && ` · ${arquivos.length} arquivo${arquivos.length !== 1 ? 's' : ''}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button
                  className="btn ghost"
                  style={{ fontSize: 11, padding: '3px 8px' }}
                  onClick={e => { e.stopPropagation(); duplicarAvaliacao(av); }}>
                  Duplicar
                </button>
                <button
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                    color: isOpen ? 'var(--dark-muted, rgba(255,255,255,.6))' : 'var(--red)',
                    fontSize: 14,
                  }}
                  onClick={e => { e.stopPropagation(); excluirAvaliacao(av); }}>
                  <i className="ti ti-trash" aria-hidden="true" />
                </button>
                <i
                  className={`ti ti-chevron-${isOpen ? 'up' : 'down'}`}
                  style={{ fontSize: 14, color: isOpen ? 'var(--dark-text, #faf8f5)' : 'var(--text3)' }}
                  aria-hidden="true"
                />
              </div>
            </div>

            {/* Painel de edição */}
            {isOpen && (
              <div style={{ padding: 14, background: 'var(--white)' }}>

                {/* Campos básicos */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 4 }}>
                  <div>
                    <SecLabel>Título</SecLabel>
                    <input style={inpSt} value={editando.titulo}
                      onChange={e => setEditando(d => ({ ...d, titulo: e.target.value }))}
                      placeholder="Avaliação Jul/2026" />
                  </div>
                  <div>
                    <SecLabel>Data da avaliação</SecLabel>
                    <input type="date" style={inpSt} value={editando.data_avaliacao}
                      onChange={e => setEditando(d => ({ ...d, data_avaliacao: e.target.value }))} />
                  </div>
                  <div>
                    <SecLabel>Data da coleta</SecLabel>
                    <input type="date" style={inpSt} value={editando.data_coleta}
                      onChange={e => setEditando(d => ({ ...d, data_coleta: e.target.value }))} />
                  </div>
                </div>

                {/* Campos clínicos */}
                {[
                  { key: 'conquistas',           label: 'Conquistas (linguagem da paciente)' },
                  { key: 'impacto_nos_sintomas',  label: 'Impacto nos sintomas' },
                  { key: 'evolucao_resumida',     label: 'Evolução (comparativos numéricos)' },
                  { key: 'pontos_atencao',        label: 'Pontos de atenção' },
                  { key: 'proximos_passos',       label: 'Próximos passos' },
                  { key: 'avaliacao_funcional',   label: 'Análise completa (texto longo)' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <SecLabel>{label}</SecLabel>
                    <textarea
                      style={taSt}
                      value={editando[key]}
                      onChange={e => setEditando(d => ({ ...d, [key]: e.target.value }))}
                      placeholder={label}
                    />
                  </div>
                ))}

                <button className="btn" onClick={() => salvarCampos(av.id)} disabled={salvando}
                  style={{ marginTop: 10 }}>
                  {salvando ? 'Salvando…' : 'Salvar campos'}
                </button>

                {/* Arquivos existentes */}
                {arquivos.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <SecLabel>Arquivos</SecLabel>
                    {arquivos.map(arq => (
                      <div key={arq.id} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 10px', borderRadius: 8, marginBottom: 6,
                        background: 'var(--paper, var(--bg-soft))',
                        border: '0.5px solid var(--border, #e0dbd4)',
                        flexWrap: 'wrap',
                      }}>
                        <span style={{ fontSize: 16 }}>{catEmoji(arq.categoria)}</span>
                        <div style={{ flex: 1, minWidth: 120 }}>
                          <div style={{ fontSize: 12, fontWeight: 500 }}>
                            {arq.titulo || arq.nome_arquivo}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                            {arq.tipo} · {arq.categoria}
                            {arq.data_recebimento && ` · Recebido em ${dataBR(arq.data_recebimento)}`}
                          </div>
                        </div>
                        <select
                          style={{ ...inpSt, width: 'auto', fontSize: 11 }}
                          value={arq.status}
                          onChange={e => alterarStatus(arq, e.target.value, av.id)}>
                          {STATUS_OPTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                        <button
                          onClick={() => excluirArquivo(arq, av.id)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--red)', fontSize: 14, padding: 4,
                          }}>
                          <i className="ti ti-x" aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Formulário de upload */}
                <div style={{
                  marginTop: 16, padding: 12, borderRadius: 8,
                  border: '0.5px dashed var(--border, #e0dbd4)',
                  background: 'var(--paper, var(--bg-soft))',
                }}>
                  <SecLabel>Adicionar arquivo</SecLabel>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <select style={inpSt} value={novoArq.tipo}
                      onChange={e => setNovoArq(a => ({ ...a, tipo: e.target.value }))}>
                      <option value="pedido">Pedido</option>
                      <option value="resultado">Resultado</option>
                    </select>
                    <select style={inpSt} value={novoArq.categoria}
                      onChange={e => setNovoArq(a => ({ ...a, categoria: e.target.value }))}>
                      {CATEGORIAS.map(c => (
                        <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
                      ))}
                    </select>
                    <input style={inpSt} placeholder="Título (ex: Hemograma completo)"
                      value={novoArq.titulo}
                      onChange={e => setNovoArq(a => ({ ...a, titulo: e.target.value }))} />
                    <select style={inpSt} value={novoArq.status}
                      onChange={e => setNovoArq(a => ({ ...a, status: e.target.value }))}>
                      {STATUS_OPTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                    {(novoArq.tipo === 'resultado') && (
                      <input type="date" style={inpSt}
                        value={novoArq.data_recebimento}
                        onChange={e => setNovoArq(a => ({ ...a, data_recebimento: e.target.value }))}
                        placeholder="Data de recebimento" />
                    )}
                  </div>
                  <input key={fileKey} type="file" accept="application/pdf,.pdf"
                    style={{ fontSize: 12, marginBottom: 8, display: 'block' }}
                    onChange={e => setNovoArq(a => ({ ...a, file: e.target.files[0] ?? null }))} />
                  <button className="btn" onClick={() => adicionarArquivo(av.id)} disabled={uploadando}>
                    {uploadando ? 'Enviando…' : 'Enviar arquivo'}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
