import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Plus, Save, Trash2 } from 'lucide-react';
import { useApi, errorMessage } from '../context/ApiContext';
import { Spinner } from './ui';
import { Select } from './Select';
import { drawWatermark, type Watermark } from '../image-processing';

type Mark = Watermark & { id: string; name: string };
type Settings = { enabledByDefault: boolean; activeId: string; marks: Mark[] };
const empty: Settings = { enabledByDefault: false, activeId: '', marks: [{ id: 'default', name: 'Amostra de aprovação', text: 'Amostra de Aprovação · Não copiar', opacity: 42, position: 'diagonal' }] };

export function WatermarkSettings() {
  const { request, notify } = useApi();
  const [settings, setSettings] = useState<Settings>(empty);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void request<Settings>('/operations/settings/watermarks').then((value) => setSettings({ ...empty, ...value, marks: value.marks?.length ? value.marks : empty.marks })).catch((error) => notify(errorMessage(error), true)).finally(() => setLoading(false));
  }, [request, notify]);
  const updateMark = (id: string, partial: Partial<Mark>) => setSettings((value) => ({ ...value, marks: value.marks.map((mark) => mark.id === id ? { ...mark, ...partial } : mark) }));
  const save = async () => {
    setBusy(true);
    try { await request('/operations/settings/watermarks', 'PUT', settings); notify('Marcas d’água salvas.'); }
    catch (error) { notify(errorMessage(error), true); }
    finally { setBusy(false); }
  };
  if (loading) return <Spinner/>;
  const active = settings.marks.find((mark) => mark.id === (settings.activeId || settings.marks[0]?.id));
  return <section className="surface watermark-settings">
    <h2>Marca d’água de aprovação</h2>
    <p>Configure modelos para aplicar ao anexar imagem ou vídeo. A prévia usa o mesmo desenho da marca aplicada ao arquivo. Se o processamento falhar, o envio é bloqueado.</p>
    <label className="checkbox"><input type="checkbox" checked={settings.enabledByDefault} onChange={(event) => setSettings((value) => ({ ...value, enabledByDefault: event.target.checked }))}/>Ativar por padrão ao anexar imagem ou vídeo</label>
    <label>Modelo usado ao anexar<Select value={settings.activeId || settings.marks[0]?.id || ''} onChange={(event) => setSettings((value) => ({ ...value, activeId: event.target.value }))}>{settings.marks.map((mark) => <option key={mark.id} value={mark.id}>{mark.name}</option>)}</Select></label>
    {settings.marks.map((mark) => <article className="watermark-editor" key={mark.id}>
      <div className="form-grid">
        <label>Nome do modelo<input maxLength={80} value={mark.name} onChange={(event) => updateMark(mark.id, { name: event.target.value })}/></label>
        <label>Posição / padrão<Select value={mark.position} onChange={(event) => updateMark(mark.id, { position: event.target.value as Mark['position'] })}><option value="bottom-right">Canto inferior direito</option><option value="center">Centro</option><option value="diagonal">Mosaico diagonal</option></Select></label>
      </div>
      <label>Texto da marca d’água<input maxLength={120} value={mark.text} onChange={(event) => updateMark(mark.id, { text: event.target.value })}/></label>
      <label>Opacidade · {mark.opacity}%<input type="range" min="10" max="90" value={mark.opacity} onChange={(event) => updateMark(mark.id, { opacity: Number(event.target.value) })}/></label>
      <label>Tamanho · {mark.size ?? 100}%<input type="range" min="50" max="200" value={mark.size ?? 100} onChange={(event) => updateMark(mark.id, { size: Number(event.target.value) })}/></label>
      <label className="button small watermark-file"><ImagePlus size={14}/>Adicionar selo PNG<input type="file" accept="image/png" hidden onChange={(event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (file.size > 1_000_000) { notify('Use um PNG de até 1 MiB.', true); return; }
        const reader = new FileReader();
        reader.onload = () => updateMark(mark.id, { imageData: String(reader.result) });
        reader.readAsDataURL(file);
        event.currentTarget.value = '';
      }}/></label>
      {mark.imageData && <div className="watermark-logo-row"><img src={mark.imageData} alt="Selo de marca d’água"/><button className="button small" onClick={() => updateMark(mark.id, { imageData: '' })}>Remover selo</button></div>}
      <WatermarkPreview mark={mark}/>
      <button className="button small danger" disabled={settings.marks.length < 2} onClick={() => setSettings((value) => ({ ...value, activeId: value.activeId === mark.id ? '' : value.activeId, marks: value.marks.filter((item) => item.id !== mark.id) }))}><Trash2 size={14}/>Remover modelo</button>
    </article>)}
    <div className="watermark-actions"><button className="button" onClick={() => {
      const mark = { ...empty.marks[0]!, id: crypto.randomUUID(), name: `Modelo ${settings.marks.length + 1}` };
      setSettings((value) => ({ ...value, activeId: mark.id, marks: [...value.marks, mark] }));
    }}><Plus size={14}/>Adicionar modelo</button><button className="button primary" disabled={busy} onClick={() => void save()}>{busy ? <Spinner/> : <Save size={15}/>}Salvar modelos</button></div>
    {active && <small>Modelo ativo: {active.name}</small>}
  </section>;
}

function WatermarkPreview({ mark }: { mark: Mark }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const preview = document.createElement('canvas');
    preview.width = 640; preview.height = 320;
    const context = preview.getContext('2d');
    if (!context) { setError('Prévia indisponível neste navegador.'); return; }
    const gradient = context.createLinearGradient(0, 0, 640, 320);
    gradient.addColorStop(0, '#7c35e9'); gradient.addColorStop(1, '#294b58');
    context.fillStyle = gradient; context.fillRect(0, 0, 640, 320);
    context.fillStyle = '#ffffff55'; context.font = '32px Arial'; context.textAlign = 'center';
    context.fillText('Sua amostra', 320, 160);
    setError('');
    void drawWatermark(context, 640, 320, mark).then(() => {
      if (active) canvas.current?.getContext('2d')?.drawImage(preview, 0, 0);
    }).catch(error => { if (active) setError(errorMessage(error)); });
    return () => { active = false; };
  }, [mark]);
  return <div><canvas ref={canvas} width={640} height={320} className="watermark-canvas" role="img" aria-label={`Prévia da marca d’água ${mark.name}`}/>{error && <p className="notice" role="alert">{error}</p>}</div>;
}
