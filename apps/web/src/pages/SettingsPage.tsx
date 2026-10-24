import { useEffect, useState } from 'react';
import { API_BASE } from '../config';
import { usePreferences } from '../context/PreferencesContext';
import { KeyRound, Upload, Download, ShieldCheck } from 'lucide-react';
import { useApi, errorMessage } from '../context/ApiContext';
import { Spinner } from '../components/ui';

interface BackupReport {
  duplicate: boolean;
  format: string;
  counts: Record<string, number>;
  warnings: string[];
  configurations?: { schedules: number; contacts: number; pixKeys: number; fields: string[] };
  preferences?: { replacements?: string };
}
export function SettingsPage({
  onImported,
  sessionId,
}: {
  onImported: () => Promise<void>;
  sessionId?: string;
}) {
  const { token, setToken, request, blob, notify } = useApi();
  const [draftToken, setDraftToken] = useState(token);
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState(() => sessionStorage.getItem('noctua-backup-job') ?? '');
  const [phase, setPhase] = useState('');
  const [progress, setProgress] = useState(0);
  const [report, setReport] = useState<BackupReport | null>(null);
  const { updatePreferences } = usePreferences();
  useEffect(() => {
    if (jobId) return;
    const controller = new AbortController();
    void request<{ items: { report: BackupReport }[] }>(
      '/backups/imports',
      'GET',
      undefined,
      controller.signal,
    )
      .then((result) => {
        if (result.items[0]?.report) setReport(result.items[0].report);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [jobId, request]);
  useEffect(() => {
    if (!jobId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    setBusy(true);
    const poll = async () => {
      try {
        const job = await request<{ status: string; phase?: string; error?: string; report?: BackupReport }>(
          `/backups/jobs/${encodeURIComponent(jobId)}`,
          'GET',
          undefined,
          controller.signal,
        );
        if (!active) return;
        if (job.status === 'COMPLETED' || job.status === 'FAILED') {
          sessionStorage.removeItem('noctua-backup-job');
          setJobId('');
          setBusy(false);
          setPhase('');
          if (job.report) {
            setReport(job.report);
            if (job.report.preferences) updatePreferences(job.report.preferences);
            window.dispatchEvent(new Event('noctua:backup-imported'));
            void onImported().catch((error) => notify(errorMessage(error), true));
            notify(
              job.report.duplicate
                ? 'Este backup já está importado.'
                : 'Backup importado. Confira o relatório abaixo.',
            );
          } else notify(job.error || 'A importação não foi concluída.', true);
          return;
        }
        setPhase(job.phase || 'Importando o backup no servidor…');
      } catch (error) {
        if (!active) return;
        setPhase('Aguardando o servidor para consultar a importação. O processo continua no servidor.');
      }
      if (active) timer = setTimeout(() => void poll(), 1500);
    };
    void poll();
    return () => {
      active = false;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [jobId, request, notify, onImported, updatePreferences]);
  const upload = async (file: File) => {
    setBusy(true);
    setReport(null);
    setProgress(0);
    setPhase('Enviando o arquivo…');
    try {
      const result = await new Promise<{ id: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(
          'POST',
          `${API_BASE}/api/backups/upload${sessionId ? '?sessionId=' + encodeURIComponent(sessionId) : ''}`,
        );
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('X-Backup-Name', encodeURIComponent(file.name));
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
        };
        xhr.onerror = () =>
          reject(new Error('Não foi possível enviar o arquivo. Confira se o servidor está ligado.'));
        xhr.onabort = () => reject(new Error('Envio interrompido.'));
        xhr.onload = () => {
          let result;
          try {
            result = JSON.parse(xhr.responseText);
          } catch {
            reject(new Error('O servidor não concluiu o recebimento do arquivo.'));
            return;
          }
          if (xhr.status >= 200 && xhr.status < 300) resolve(result);
          else reject(new Error(result.error?.message || 'Não foi possível receber o backup.'));
        };
        xhr.send(file);
      });
      sessionStorage.setItem('noctua-backup-job', result.id);
      setJobId(result.id);
    } catch (error) {
      setBusy(false);
      setPhase('');
      notify(errorMessage(error), true);
    }
  };
  const download = async () => {
    setBusy(true);
    try {
      const data = await blob('/backups/export');
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `noctua-biblioteca-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">DO SEU JEITO</p>
          <h1>Configurações</h1>
          <p>Acesso local e portabilidade da sua biblioteca.</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="surface">
          <span className="asset-icon">
            <KeyRound size={22} />
          </span>
          <h2>Token de acesso</h2>
          <p className="muted">
            Preencha se você configurou API_TOKEN no servidor. O token fica apenas na memória desta aba.
          </p>
          <label>
            Token
            <input
              type="password"
              autoComplete="off"
              value={draftToken}
              onChange={(e) => setDraftToken(e.target.value)}
              placeholder="Opcional no acesso local"
            />
          </label>
          <button
            className="button primary"
            onClick={() => {
              setToken(draftToken.trim());
              notify('Acesso atualizado.');
            }}
          >
            Aplicar acesso
          </button>
        </section>
        <section className="surface">
          <span className="asset-icon">
            <Upload size={22} />
          </span>
          <h2>Importar backup</h2>
          <p className="muted">
            Importe bibliotecas e configurações do Sutofly, ZV_backup e respostasRapidasAcao. Sem limite de 40
            MB para backups: arquivos e mídias grandes são processados no servidor.
          </p>
          <label className="file-upload">
            <Upload size={23} />
            <span>{busy ? 'Processando…' : 'Escolher arquivo JSON'}</span>
            <input
              type="file"
              accept=".json,application/json"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
                e.target.value = '';
              }}
            />
          </label>
          {busy && (
            <div role="status">
              <progress max={100} value={progress} style={{ width: '100%' }} />
              <p>
                {phase}
                {progress < 100 ? ` (${progress}%)` : ''}
              </p>
              <small>
                Mantenha o servidor ligado. Depois de recebido, o arquivo continua sendo processado mesmo se
                você mudar de aba.
              </small>
            </div>
          )}
          {report && (
            <section aria-label="Relatório da importação">
              <h3>
                {report.duplicate ? 'Backup já importado' : 'Importação concluída'} · {report.format}
              </h3>
              <p>
                {report.counts.assets} recursos · {report.counts.files} arquivos · {report.counts.macros}{' '}
                macros · {report.counts.flows} fluxos
              </p>
              {report.configurations && (
                <p>
                  {report.configurations.schedules} agendamentos em rascunho ·{' '}
                  {report.configurations.contacts} contatos · {report.configurations.pixKeys} chaves PIX
                </p>
              )}
              {report.preferences && (
                <button
                  type="button"
                  className="button small"
                  onClick={() => {
                    updatePreferences(report.preferences!);
                    notify('Preferências do backup aplicadas neste navegador.');
                  }}
                >
                  Aplicar substituições deste backup
                </button>
              )}
              {report.warnings.length > 0 && (
                <details open>
                  <summary>Conferir observações da conversão</summary>
                  <ul>
                    {report.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </details>
              )}
            </section>
          )}
        </section>
        <section className="surface">
          <span className="asset-icon">
            <Download size={22} />
          </span>
          <h2>Exportar biblioteca</h2>
          <p className="muted">
            Salve seus recursos em JSON, incluindo mídias. A exportação não contém conversas nem credenciais
            do WhatsApp.
          </p>
          <button className="button" disabled={busy} onClick={() => void download()}>
            {busy ? <Spinner /> : <Download size={16} />}Exportar JSON
          </button>
        </section>
        <section className="surface">
          <span className="asset-icon">
            <ShieldCheck size={22} />
          </span>
          <h2>Seus dados, no seu computador</h2>
          <p className="muted">
            O Noctua usa seu banco local. Crie uma cópia integral na seção acima ou guarde o banco junto com a
            chave privada da sessão, conforme o guia do projeto.
          </p>
          <p className="muted">Para conectar ou pausar sua conta, abra Conexões no menu lateral.</p>
        </section>
      </div>
    </main>
  );
}
