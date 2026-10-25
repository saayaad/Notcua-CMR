import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Upload } from 'lucide-react';
import { useApi, errorMessage } from '../context/ApiContext';
export function AudioTestInput({onAudio}:{onAudio:(url:string)=>void}) {
  const {notify}=useApi();const [recording,setRecording]=useState(false);
  const recorder=useRef<MediaRecorder|null>(null);const stream=useRef<MediaStream|null>(null);
  const urls=useRef<string[]>([]); const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  useEffect(()=>()=>{if(recorder.current?.state==='recording')recorder.current.stop();stream.current?.getTracks().forEach(t=>t.stop());clearTimeout(timer.current);urls.current.forEach(URL.revokeObjectURL);},[]);
  const file=(blob:Blob)=>{if(blob.size>2*1024*1024){notify('Use um áudio de até 2 MiB.',true);return;}const url=URL.createObjectURL(blob);urls.current.push(url);onAudio(url);};
  return <div className="test-audio-controls"><button type="button" className="button small" onClick={()=>{
    if(recording){recorder.current?.stop();return;}
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){notify('Neste navegador, use Enviar áudio para escolher um arquivo.',true);return;}
    void navigator.mediaDevices.getUserMedia({audio:true}).then(value=>{stream.current=value;const media=new MediaRecorder(value);recorder.current=media;const chunks:Blob[]=[];media.ondataavailable=e=>chunks.push(e.data);media.onstop=()=>{file(new Blob(chunks,{type:media.mimeType}));value.getTracks().forEach(t=>t.stop());setRecording(false);clearTimeout(timer.current);};media.start();setRecording(true);timer.current=setTimeout(()=>media.stop(),60000);}).catch(e=>notify(errorMessage(e),true));
  }}>{recording?<Square size={14}/>:<Mic size={14}/>} {recording?'Parar gravação':'Gravar áudio'}</button><label className="button small"><Upload size={14}/>Enviar áudio<input type="file" accept="audio/*" hidden onChange={e=>{const picked=e.target.files?.[0];if(picked)file(picked);e.target.value='';}}/></label>{recording&&<small role="status">Gravando áudio… (máximo 1 minuto)</small>}</div>;
}
