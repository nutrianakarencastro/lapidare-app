import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { iniciais } from '../../lib/utils.js';

const inpSt = {
  width: '100%', boxSizing: 'border-box', padding: '7px 10px',
  borderRadius: 6, border: '0.5px solid var(--border, #e0dbd4)',
  fontSize: 13, fontFamily: 'var(--font-sans)',
  background: 'var(--white)', color: 'var(--dark)',
};
const taSt = { ...inpSt, resize: 'vertical', minHeight: 64 };

const STATUS_PILL = {
  nao_visualizada: { label: 'Não visualizada', bg: '#f3f4f6', color: '#6b7280' },
  visualizada:     { label: 'Visualizada',     bg: '#dbeafe', color: '#1d4ed8' },
  concluida:       { label: 'Concluída',        bg: '#dcfce7', color: '#166534' },
};

function formVazio() {
  return { titulo: '', descricao: '', categoria: '', subcategoria: '', tags: '', favorita: false, video_url: '', objetivos_relacionados: '', sintomas_relacionados: '' };
}
function populateForm(o) {
  return {
    titulo: o.titulo || '', descricao: o.descricao || '',
    categoria: o.categoria || '', subcategoria: o.subcategoria || '',
    tags: (o.tags || []).join(', '), favorita: o.favorita || false,
    video_url: o.video_url || '',
    objetivos_relacionados: (o.objetivos_relacionados || []).join('\n'),
    sintomas_relacionados: (o.sintomas_relacionados || []).join('\n'),
  };
}
function formToPayload(form) {
  return {
    titulo: form.titulo.trim(),
    descricao: form.descricao.trim() || null,
    categoria: form.categoria.trim() || null,
    subcategoria: form.subcategoria.trim() || null,
    tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
    favorita: form.favorita,
    video_url: form.video_url.trim() || null,
    objetivos_relacionados: form.objetivos_relacionados.split('\n').map(t => t.trim()).filter(Boolean),
    sintomas_relacionados: form.sintomas_relacionados.split('\n').map(t => t.trim()).filter(Boolean),
  };
}

function ModalShell({ title, subtitle, onClose, children, width = 600 }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--white)', borderRadius: 12, maxWidth: width, width: '100%', maxHeight: '92vh', overflow: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text3)', padding: 4 }}>
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SecLabel({ children, mt = 12 }) {
  return <div style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text3)', fontWeight: 500, marginBottom: 6, marginTop: mt }}>{children}</div>;
}

function FormOrientacao({ nutriId, editando, onSalvo, onCancelar }) {
  const [form, setForm] = useState(editando ? populateForm(editando) : formVazio());
  const [pdfFile, setPdfFile] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [thumbFile, setThumbFile] = useState(null);
  const [removendoPdf, setRemovendoPdf] = useState(false);
  const [removendoAudio, setRemovendoAudio] = useState(false);
  const [removendoThumb, setRemovendoThumb] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [fileKeys, setFileKeys] = useState({ pdf: 0, audio: 0, thumb: 0 });

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const setCheck = k => e => setForm(f => ({ ...f, [k]: e.target.checked }));
  const resetKey = k => setFileKeys(fk => ({ ...fk, [k]: fk[k] + 1 }));

  function validarMedia() {
    if (pdfFile) return true;
    if (form.video_url.trim()) return true;
    if (audioFile) return true;
    if (editando) {
      if (editando.pdf_path && !removendoPdf) return true;
      if (editando.audio_path && !removendoAudio) return true;
    }
    return false;
  }

  async function uploadArquivo(file, path) {
    const { error } = await supabase.storage.from('orientacoes').upload(path, file, { upsert: true });
    return error ? null : path;
  }

  async function salvar() {
    setFeedback(null);
    const payload = formToPayload(form);
    if (!payload.titulo) { setFeedback({ tipo: 'erro', msg: 'Título obrigatório.' }); return; }
    if (!validarMedia()) { setFeedback({ tipo: 'erro', msg: 'Adicione ao menos um conteúdo: PDF, Vídeo ou Podcast.' }); return; }
    setSalvando(true);

    let targetId = editando?.id;

    if (!editando) {
      const { data: novo, error } = await supabase.from('orientacoes')
        .insert({ ...payload, nutri_id: nutriId }).select('id').single();
      if (error) { setSalvando(false); setFeedback({ tipo: 'erro', msg: error.message }); return; }
      targetId = novo.id;
    }

    const updates = editando ? { ...payload } : {};

    if (thumbFile) {
      if (editando?.thumbnail_path && !removendoThumb)
        await supabase.storage.from('orientacoes').remove([editando.thumbnail_path]);
      const ext = thumbFile.name.split('.').pop().toLowerCase() || 'jpg';
      const p = await uploadArquivo(thumbFile, `${nutriId}/${targetId}/thumb.${ext}`);
      if (p) { updates.thumbnail_path = p; updates.thumbnail_nome = thumbFile.name; }
    } else if (removendoThumb && editando?.thumbnail_path) {
      await supabase.storage.from('orientacoes').remove([editando.thumbnail_path]);
      updates.thumbnail_path = null; updates.thumbnail_nome = null;
    }

    if (pdfFile) {
      if (editando?.pdf_path) await supabase.storage.from('orientacoes').remove([editando.pdf_path]);
      const p = await uploadArquivo(pdfFile, `${nutriId}/${targetId}/pdf.pdf`);
      if (p) { updates.pdf_path = p; updates.pdf_nome = pdfFile.name; }
    } else if (removendoPdf && editando?.pdf_path) {
      await supabase.storage.from('orientacoes').remove([editando.pdf_path]);
      updates.pdf_path = null; updates.pdf_nome = null;
    }

    if (audioFile) {
      if (editando?.audio_path) await supabase.storage.from('orientacoes').remove([editando.audio_path]);
      const ext = audioFile.name.split('.').pop().toLowerCase() || 'mp3';
      const p = await uploadArquivo(audioFile, `${nutriId}/${targetId}/audio.${ext}`);
      if (p) { updates.audio_path = p; updates.audio_nome = audioFile.name; }
    } else if (removendoAudio && editando?.audio_path) {
      await supabase.storage.from('orientacoes').remove([editando.audio_path]);
      updates.audio_path = null; updates.audio_nome = null;
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from('orientacoes').update(updates).eq('id', targetId);
      if (error) { setSalvando(false); setFeedback({ tipo: 'erro', msg: error.message }); return; }
    }

    setSalvando(false);
    onSalvo();
  }

  const existePdf   = editando?.pdf_path   && !removendoPdf;
  const existeAudio = editando?.audio_path && !removendoAudio;
  const existeThumb = editando?.thumbnail_path && !removendoThumb;

  return (
    <>
      {feedback && (
        <div style={{ padding: '8px 12px', borderRadius: 8, fontSize: 12, marginBottom: 12,
          background: feedback.tipo === 'ok' ? '#f0fdf4' : '#fff0f0',
          color: feedback.tipo === 'ok' ? '#166534' : '#c0392b',
          border: `0.5px solid ${feedback.tipo === 'ok' ? '#bbf7d0' : '#f5c0c0'}`,
        }}>{feedback.msg}</div>
      )}

      <SecLabel mt={0}>Título *</SecLabel>
      <input style={inpSt} value={form.titulo} onChange={set('titulo')} placeholder="Ex: Estratégias para sono reparador" />

      <SecLabel>Descrição</SecLabel>
      <textarea style={taSt} value={form.descricao} onChange={set('descricao')} placeholder="Resumo do conteúdo..." />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <SecLabel>Categoria</SecLabel>
          <input style={inpSt} value={form.categoria} onChange={set('categoria')} placeholder="Ex: Menopausa" />
        </div>
        <div>
          <SecLabel>Subcategoria</SecLabel>
          <input style={inpSt} value={form.subcategoria} onChange={set('subcategoria')} placeholder="Ex: Sono" />
        </div>
      </div>

      <SecLabel>Tags (separadas por vírgula)</SecLabel>
      <input style={inpSt} value={form.tags} onChange={set('tags')} placeholder="Ex: jejum, proteína, anti-inflamatório" />

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer', fontSize: 13 }}>
        <input type="checkbox" checked={form.favorita} onChange={setCheck('favorita')} style={{ margin: 0 }} />
        ⭐ Marcar como favorita
      </label>

      <div style={{ margin: '16px 0 6px', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text3)', fontWeight: 600 }}>
        CONTEÚDO — ao menos um obrigatório
      </div>
      <div style={{ padding: 12, borderRadius: 8, background: 'var(--bg2, var(--bg-soft))', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* PDF */}
        <div>
          <SecLabel mt={0}>📄 PDF</SecLabel>
          {existePdf ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <i className="ti ti-file-type-pdf" style={{ color: '#e05252' }} aria-hidden="true" />
              <span style={{ flex: 1 }}>{editando.pdf_nome}</span>
              <button onClick={() => { setRemovendoPdf(true); setPdfFile(null); resetKey('pdf'); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 13 }}>
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <input key={fileKeys.pdf} type="file" accept="application/pdf,.pdf"
              style={{ fontSize: 12 }}
              onChange={e => { setPdfFile(e.target.files[0] ?? null); setRemovendoPdf(false); }} />
          )}
        </div>

        {/* Vídeo */}
        <div>
          <SecLabel mt={0}>🎥 Vídeo (URL externa)</SecLabel>
          <input style={inpSt} value={form.video_url} onChange={set('video_url')} placeholder="https://youtube.com/..." />
        </div>

        {/* Áudio/Podcast */}
        <div>
          <SecLabel mt={0}>🎙️ Podcast / Áudio</SecLabel>
          {existeAudio ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <i className="ti ti-microphone" style={{ color: 'var(--dark)' }} aria-hidden="true" />
              <span style={{ flex: 1 }}>{editando.audio_nome}</span>
              <button onClick={() => { setRemovendoAudio(true); setAudioFile(null); resetKey('audio'); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 13 }}>
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <input key={fileKeys.audio} type="file" accept="audio/*"
              style={{ fontSize: 12 }}
              onChange={e => { setAudioFile(e.target.files[0] ?? null); setRemovendoAudio(false); }} />
          )}
        </div>
      </div>

      {/* Thumbnail */}
      <SecLabel>Thumbnail / Capa (imagem)</SecLabel>
      {existeThumb ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <i className="ti ti-photo" style={{ color: 'var(--dark)' }} aria-hidden="true" />
          <span style={{ flex: 1 }}>{editando.thumbnail_nome}</span>
          <button onClick={() => { setRemovendoThumb(true); setThumbFile(null); resetKey('thumb'); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 13 }}>
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <input key={fileKeys.thumb} type="file" accept="image/jpeg,image/png,image/webp"
          style={{ fontSize: 12 }}
          onChange={e => { setThumbFile(e.target.files[0] ?? null); setRemovendoThumb(false); }} />
      )}

      {/* Campos futuros IA */}
      <SecLabel>Objetivos relacionados (um por linha)</SecLabel>
      <textarea style={{ ...taSt, minHeight: 52 }} value={form.objetivos_relacionados}
        onChange={set('objetivos_relacionados')} placeholder="Ex: reduzir inflamação" />

      <SecLabel>Sintomas relacionados (um por linha)</SecLabel>
      <textarea style={{ ...taSt, minHeight: 52 }} value={form.sintomas_relacionados}
        onChange={set('sintomas_relacionados')} placeholder="Ex: fadiga, insônia" />

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button className="btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={onCancelar}>Cancelar</button>
        <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={salvar} disabled={salvando}>
          <i className="ti ti-check" aria-hidden="true" />
          {salvando ? 'Salvando…' : (editando ? 'Salvar alterações' : 'Criar orientação')}
        </button>
      </div>
    </>
  );
}

function ModalAtribuir({ orientacao, pacientes, atribuidos, onClose, onSaved, nutriId }) {
  const [selecionadas, setSelecionadas] = useState(new Set(atribuidos));
  const [busca, setBusca] = useState('');
  const [busy, setBusy] = useState(false);

  function toggle(id) {
    setSelecionadas(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  async function salvar() {
    setBusy(true);
    const atual = new Set(atribuidos);
    const add = [...selecionadas].filter(id => !atual.has(id));
    const rem = [...atual].filter(id => !selecionadas.has(id));
    if (add.length > 0)
      await supabase.from('orientacoes_pacientes').insert(
        add.map(paciente_id => ({ orientacao_id: orientacao.id, paciente_id, nutri_id: nutriId }))
      );
    if (rem.length > 0)
      await supabase.from('orientacoes_pacientes').delete()
        .eq('orientacao_id', orientacao.id).in('paciente_id', rem);
    setBusy(false);
    onSaved();
  }

  const filtradas = pacientes.filter(p => {
    if (!busca.trim()) return true;
    const q = busca.trim().toLowerCase();
    return (p.nome ?? '').toLowerCase().includes(q) || (p.email ?? '').toLowerCase().includes(q);
  });

  return (
    <ModalShell title="Atribuir pacientes" subtitle={`"${orientacao.titulo}"`} onClose={onClose} width={500}>
      <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar paciente..." style={{ marginBottom: 10, ...inpSt }} />
      <div style={{ maxHeight: 360, overflow: 'auto', border: '0.5px solid var(--border)', borderRadius: 8 }}>
        {filtradas.map(p => {
          const checked = selecionadas.has(p.id);
          return (
            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer', borderBottom: '0.5px solid var(--border)', background: checked ? 'var(--amber-bg, var(--bg2))' : 'transparent' }}>
              <input type="checkbox" checked={checked} onChange={() => toggle(p.id)} style={{ margin: 0 }} />
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: 'var(--dark)' }}>{iniciais(p.nome)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{p.nome}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.email}</div>
              </div>
            </label>
          );
        })}
        {filtradas.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Nenhuma paciente.</div>}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>{selecionadas.size} selecionada{selecionadas.size === 1 ? '' : 's'}</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button className="btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cancelar</button>
        <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={salvar} disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar atribuições'}
        </button>
      </div>
    </ModalShell>
  );
}

export default function BibliotecaOrientacoes({ nutriId }) {
  const [orientacoes, setOrientacoes] = useState(null);
  const [pacientes, setPacientes]     = useState([]);
  const [atribuicoes, setAtribuicoes] = useState({});
  const [thumbUrls, setThumbUrls]     = useState({});
  const [busca, setBusca]             = useState('');
  const [filtroFavorita, setFiltroFavorita] = useState(false);
  const [filtroArquivadas, setFiltroArquivadas] = useState(false);
  const [criando, setCriando]         = useState(false);
  const [editandoId, setEditandoId]   = useState(null);
  const [atribuirId, setAtribuirId]   = useState(null);
  const [feedback, setFeedback]       = useState(null);

  async function carregar() {
    const [oRes, pacRes, atRes] = await Promise.all([
      supabase.from('orientacoes').select('*').eq('nutri_id', nutriId).order('created_at', { ascending: false }),
      supabase.from('pacientes').select('id, nome, email').eq('nutri_id', nutriId).order('nome'),
      supabase.from('orientacoes_pacientes').select('orientacao_id, paciente_id').eq('nutri_id', nutriId),
    ]);
    const lista = oRes.data ?? [];
    setOrientacoes(lista);
    setPacientes(pacRes.data ?? []);

    const mapa = {};
    for (const a of atRes.data ?? []) {
      if (!mapa[a.orientacao_id]) mapa[a.orientacao_id] = [];
      mapa[a.orientacao_id].push(a.paciente_id);
    }
    setAtribuicoes(mapa);

    // Batch signed URLs para thumbnails
    const paths = lista.filter(o => o.thumbnail_path).map(o => o.thumbnail_path);
    if (paths.length > 0) {
      const { data: signed } = await supabase.storage.from('orientacoes').createSignedUrls(paths, 300);
      const map = {};
      for (const s of signed ?? []) {
        const o = lista.find(x => x.thumbnail_path === s.path);
        if (o && s.signedUrl) map[o.id] = s.signedUrl;
      }
      setThumbUrls(map);
    }
  }
  useEffect(() => { carregar(); }, [nutriId]);

  async function duplicar(o) {
    const { error } = await supabase.from('orientacoes').insert({
      nutri_id: nutriId,
      titulo: `Cópia de ${o.titulo}`,
      descricao: o.descricao, categoria: o.categoria, subcategoria: o.subcategoria,
      tags: o.tags, favorita: false, video_url: o.video_url,
      objetivos_relacionados: o.objetivos_relacionados,
      sintomas_relacionados: o.sintomas_relacionados,
    });
    if (error) { setFeedback({ tipo: 'erro', msg: error.message }); return; }
    setFeedback({ tipo: 'ok', msg: 'Duplicada. Abra-a para adicionar os arquivos de mídia.' });
    setTimeout(() => setFeedback(null), 4000);
    carregar();
  }

  async function toggleFavorita(o) {
    await supabase.from('orientacoes').update({ favorita: !o.favorita }).eq('id', o.id);
    setOrientacoes(prev => prev.map(x => x.id === o.id ? { ...x, favorita: !o.favorita } : x));
  }

  async function arquivar(o) {
    if (!window.confirm(`Arquivar "${o.titulo}"?\nO conteúdo e as atribuições existentes serão preservados.`)) return;
    await supabase.from('orientacoes').update({ ativo: false, arquivado_em: new Date().toISOString() }).eq('id', o.id);
    carregar();
  }

  async function reativar(o) {
    await supabase.from('orientacoes').update({ ativo: true, arquivado_em: null }).eq('id', o.id);
    carregar();
  }

  const filtradas = useMemo(() => {
    if (!orientacoes) return [];
    const q = busca.trim().toLowerCase();
    return orientacoes.filter(o => {
      if (o.ativo === filtroArquivadas) return false;  // show ativas OR arquivadas based on toggle
      if (filtroFavorita && !o.favorita) return false;
      if (!q) return true;
      return (o.titulo ?? '').toLowerCase().includes(q)
        || (o.categoria ?? '').toLowerCase().includes(q)
        || (o.subcategoria ?? '').toLowerCase().includes(q)
        || (o.tags ?? []).some(t => t.toLowerCase().includes(q));
    });
  }, [orientacoes, busca, filtroFavorita, filtroArquivadas]);

  const editando = editandoId ? (orientacoes ?? []).find(o => o.id === editandoId) : null;
  const atribuindo = atribuirId ? (orientacoes ?? []).find(o => o.id === atribuirId) : null;

  return (
    <>
      {feedback && (
        <div style={{ padding: '8px 12px', borderRadius: 8, fontSize: 12, marginBottom: 14,
          background: feedback.tipo === 'ok' ? '#f0fdf4' : '#fff0f0',
          color: feedback.tipo === 'ok' ? '#166534' : '#c0392b',
          border: `0.5px solid ${feedback.tipo === 'ok' ? '#bbf7d0' : '#f5c0c0'}`,
        }}>{feedback.msg}</div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input style={{ ...inpSt, width: 220 }} placeholder="Buscar orientação..."
          value={busca} onChange={e => setBusca(e.target.value)} />
        <button
          onClick={() => setFiltroFavorita(v => !v)}
          style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)', border: '0.5px solid var(--border)', background: filtroFavorita ? 'var(--dark)' : 'var(--white)', color: filtroFavorita ? 'var(--dark-text, #fff)' : 'var(--dark)' }}>
          ⭐ Favoritas
        </button>
        <button
          onClick={() => setFiltroArquivadas(v => !v)}
          style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)', border: '0.5px solid var(--border)', background: filtroArquivadas ? 'var(--dark)' : 'var(--white)', color: filtroArquivadas ? 'var(--dark-text, #fff)' : 'var(--dark)' }}>
          {filtroArquivadas ? 'Ver ativas' : '📦 Arquivadas'}
        </button>
        <button className="btn" style={{ marginLeft: 'auto' }}
          onClick={() => { setCriando(true); setEditandoId(null); }}>
          <i className="ti ti-plus" aria-hidden="true" /> Nova orientação
        </button>
      </div>

      {/* Form criação */}
      {criando && (
        <div style={{ border: '0.5px solid var(--dark)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Nova orientação</div>
          <FormOrientacao nutriId={nutriId}
            editando={null}
            onSalvo={() => { setCriando(false); carregar(); setFeedback({ tipo: 'ok', msg: 'Orientação criada.' }); setTimeout(() => setFeedback(null), 3000); }}
            onCancelar={() => setCriando(false)} />
        </div>
      )}

      {/* Lista */}
      {orientacoes === null ? (
        <div className="card empty-card"><div className="empty-sub">Carregando…</div></div>
      ) : filtradas.length === 0 ? (
        <div className="card empty-card">
          <i className="ti ti-notebook empty-icon" aria-hidden="true" />
          <div className="empty-title">
            {filtroArquivadas ? 'Nenhuma orientação arquivada' : 'Nenhuma orientação encontrada'}
          </div>
          {!filtroArquivadas && !busca && !filtroFavorita && (
            <div className="empty-sub">Crie orientações uma única vez e atribua a quantas pacientes precisar.</div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtradas.map(o => {
            const nPac = atribuicoes[o.id]?.length ?? 0;
            const isEditOpen = editandoId === o.id;
            return (
              <div key={o.id} style={{
                border: `0.5px solid ${isEditOpen ? 'var(--dark)' : 'var(--border)'}`,
                borderRadius: 10, overflow: 'hidden',
                opacity: o.ativo ? 1 : 0.65,
              }}>
                {/* Card header */}
                <div style={{ display: 'flex', gap: 12, padding: '12px 14px', background: isEditOpen ? 'var(--dark)' : 'var(--white)', alignItems: 'flex-start' }}>
                  {/* Thumbnail */}
                  <div style={{ width: 52, height: 52, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {thumbUrls[o.id]
                      ? <img src={thumbUrls[o.id]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <i className="ti ti-notebook" style={{ fontSize: 22, color: 'var(--text3)' }} aria-hidden="true" />
                    }
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 500, fontSize: 14, color: isEditOpen ? 'var(--dark-text, #faf8f5)' : 'var(--dark)' }}>{o.titulo}</span>
                      {o.favorita && <span title="Favorita">⭐</span>}
                      {!o.ativo && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 99, background: '#f3f4f6', color: '#6b7280' }}>Arquivada</span>}
                    </div>

                    {(o.categoria || o.subcategoria) && (
                      <div style={{ fontSize: 11, color: isEditOpen ? 'rgba(255,255,255,.6)' : 'var(--text3)', marginTop: 2 }}>
                        {[o.categoria, o.subcategoria].filter(Boolean).join(' › ')}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                      {o.pdf_path   && <span style={{ fontSize: 10, color: isEditOpen ? 'rgba(255,255,255,.7)' : '#e05252' }}>📄 PDF</span>}
                      {o.video_url  && <span style={{ fontSize: 10, color: isEditOpen ? 'rgba(255,255,255,.7)' : 'var(--text3)' }}>🎥 Vídeo</span>}
                      {o.audio_path && <span style={{ fontSize: 10, color: isEditOpen ? 'rgba(255,255,255,.7)' : 'var(--text3)' }}>🎙️ Podcast</span>}
                      <span style={{ fontSize: 10, color: isEditOpen ? 'rgba(255,255,255,.5)' : 'var(--text3)', marginLeft: 4 }}>
                        <i className="ti ti-users" aria-hidden="true" /> {nPac}
                      </span>
                    </div>
                  </div>

                  {/* Ações */}
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                    <button title={o.favorita ? 'Desfavoritar' : 'Favoritar'}
                      onClick={() => toggleFavorita(o)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 4, opacity: o.favorita ? 1 : 0.4 }}>⭐</button>
                    <button className="btn-outline" style={{ fontSize: 11, padding: '3px 8px' }}
                      onClick={() => duplicar(o)}>Duplicar</button>
                    <button className="btn-outline" style={{ fontSize: 11, padding: '3px 8px' }}
                      onClick={() => setAtribuirId(o.id)}>Atribuir</button>
                    <button className="btn-outline" style={{ fontSize: 11, padding: '3px 8px' }}
                      onClick={() => { setEditandoId(isEditOpen ? null : o.id); setCriando(false); }}>
                      {isEditOpen ? 'Fechar' : 'Editar'}
                    </button>
                    {o.ativo
                      ? <button onClick={() => arquivar(o)} title="Arquivar"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4, fontSize: 14 }}>
                          <i className="ti ti-archive" aria-hidden="true" />
                        </button>
                      : <button onClick={() => reativar(o)} title="Reativar"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green)', padding: 4, fontSize: 12, fontFamily: 'var(--font-sans)' }}>
                          Reativar
                        </button>
                    }
                  </div>
                </div>

                {/* Painel de edição */}
                {isEditOpen && (
                  <div style={{ padding: 16, background: 'var(--white)' }}>
                    <FormOrientacao nutriId={nutriId} editando={o}
                      onSalvo={() => { setEditandoId(null); carregar(); setFeedback({ tipo: 'ok', msg: 'Orientação salva.' }); setTimeout(() => setFeedback(null), 3000); }}
                      onCancelar={() => setEditandoId(null)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de atribuição */}
      {atribuindo && (
        <ModalAtribuir orientacao={atribuindo} pacientes={pacientes} nutriId={nutriId}
          atribuidos={atribuicoes[atribuindo.id] ?? []}
          onClose={() => setAtribuirId(null)}
          onSaved={() => { setAtribuirId(null); carregar(); }} />
      )}
    </>
  );
}
