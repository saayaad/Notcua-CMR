import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Send, FlaskConical } from 'lucide-react';
import { useApi, errorMessage } from '../context/ApiContext';
import { Modal, Spinner } from './ui';
import { Select } from './Select';
import { AudioTestInput } from './AudioTestInput';
import { AssetPreview } from './AssetPreview';
import type { Asset, Library } from '../types';
import type { FlowGraph } from '../pages/flows/flow.types';
type Entry={role:'user'|'assistant'|'event';text:string;audio?:string;assetId?:string};
type Trace={nodeId:string;title:string;action:string;text?:string};
export function ConversationSimulator({base,graph,onClose,aiOnly=false}:{base?:string;graph?:FlowGraph;onClose:()=>void;aiOnly?:boolean}){
  const {request,notify}=useApi();const [mode,setMode]=useState(aiOnly?'ai':'flow');const [entries,setEntries]=useState<Entry[]>([]);
  const [text,setText]=useState('');const [audio,setAudio]=useState('');const [busy,setBusy]=useState(false);const [presence,setPresence]=useState('');
  const [assets,setAssets]=useState<Asset[]>([]);
  useEffect(()=>{if(base)void request<Library>('/attendance/library').then(data=>setAssets(data.assets)).catch(e=>notify(errorMessage(e),true));},[base,request,notify]);
  const generation=useRef(0);const controller=useRef<AbortController|null>(null);const seen=useRef(0);const replies=useRef<string[]>([]);const log=useRef<HTMLDivElement>(null);
  useEffect(()=>()=>{generation.current++;controller.current?.abort();},[]);
  useEffect(()=>{log.current?.scrollTo({top:log.current.scrollHeight,behavior:'smooth'});},[entries,presence]);
  const reset=()=>{generation.current++;controller.current?.abort();setEntries([]);setAudio('');setText('');setPresence('');setBusy(false);seen.current=0;replies.current=[];};
  const send=async()=>{
    if(!text.trim()||busy)return;const input=text.trim();const token=generation.current;const next=[...entries,{role:'user' as const,text:input,audio:audio||undefined}];setEntries(next);setText('');setAudio('');setBusy(true);setPresence('A escrever…');controller.current=new AbortController();
    try{
      if(mode==='ai'){
        const data=await request<{text:string}>('/operations/simulator/reply','POST',{history:next.filter(e=>e.role!=='event').slice(-30).map(e=>({role:e.role,text:e.text}))},controller.current.signal);
        if(token===generation.current)setEntries([...next,{role:'assistant',text:data.text}]);
      }else if(base&&graph){
        replies.current.push(input);
        const data=await request<{matches:boolean;trace:Trace[]}>(`${base}/simulate`,'POST',{graph,text:replies.current[0],replies:replies.current.slice(1)},controller.current.signal);
        const trace=data.trace.filter(item=>!item.action.includes('Aguardaria uma nova resposta'));
        for(const item of trace.slice(seen.current)){
          if(token!==generation.current)break;
          const node=graph.nodes.find(node=>node.id===item.nodeId);
          setPresence(node?.type==='audio'?'A gravar áudio…':'A escrever…');
          await new Promise(resolve=>setTimeout(resolve,350));
          if(token!==generation.current)break;
          const isSend=item.action.startsWith('Enviaria');
          setEntries(current=>[...current,{role:isSend?'assistant':'event',text:isSend?(item.text||item.title):`${item.title}: ${item.action}`,assetId:isSend?node?.data.itemId:undefined}]);
        }
        seen.current=trace.length;
      }
    }catch(e){if(token===generation.current)notify(errorMessage(e),true);}finally{if(token===generation.current){setBusy(false);setPresence('');}}
  };
  return <Modal title="Testar fluxo / Simular atendimento" onClose={onClose} wide className="simulator-modal"><div className="simulator-toolbar"><span><FlaskConical size={15}/>Contato fictício · sem envio ao WhatsApp</span><button className="button small" onClick={reset}><RotateCcw size={14}/>Limpar / Reiniciar teste</button></div>
    {!aiOnly&&<label>Modo de teste<Select value={mode} onChange={e=>{reset();setMode(e.target.value);}}><option value="flow">Fluxo atual · sem custo de IA</option><option value="ai">IA configurada · usa tokens do provedor</option></Select></label>}
    <p className="muted">{mode==='ai'?'O teste envia apenas o histórico fictício ao provedor escolhido e usa as regras e o estilo salvos. Pode consumir seu limite de IA.':'O percurso usa os gatilhos e caminhos do rascunho atual. As esperas são aceleradas para revisão; os tempos originais aparecem no histórico.'}</p>
    <div className="test-chat-log" ref={log} role="log" aria-label="Histórico da simulação">{!entries.length&&<p className="empty-text">Envie uma mensagem como cliente para começar.</p>}{entries.map((entry,index)=><div className={`test-bubble ${entry.role}`} key={index}>{entry.audio&&<audio controls src={entry.audio}/>}<p>{entry.text}</p>{entry.assetId&&<>{assets.filter(asset=>asset.id===entry.assetId).map(asset=><AssetPreview key={asset.id} asset={asset} compact/>)}</>}</div>)}{presence&&<small role="status">{presence}</small>}</div>
    {audio&&<div className="test-audio-preview"><audio controls src={audio}/><button className="button small" onClick={()=>setAudio('')}>Descartar áudio</button><button className="button small" disabled={busy} onClick={()=>{setBusy(true);void fetch(audio).then(r=>r.blob()).then(async blob=>{const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob);});return request<{text:string}>('/operations/simulator/transcribe','POST',{data,mime:blob.type.split(';')[0]});}).then(result=>setText(result.text)).catch(e=>notify(errorMessage(e),true)).finally(()=>setBusy(false));}}>Transcrever com IA</button><small>Escreva a transcrição abaixo ou use IA. O áudio só sai deste navegador ao escolher Transcrever.</small></div>}
    <AudioTestInput onAudio={setAudio}/><form className="test-composer" onSubmit={e=>{e.preventDefault();void send();}}><textarea aria-label="Mensagem do cliente fictício" value={text} onChange={e=>setText(e.target.value)} maxLength={1000} placeholder={audio?'Transcrição do áudio para testar o gatilho…':'Mensagem do cliente…'} rows={2}/><button className="button primary" disabled={busy||!text.trim()}>{busy?<Spinner/>:<Send size={16}/>}Enviar teste</button></form>
  </Modal>;
}
