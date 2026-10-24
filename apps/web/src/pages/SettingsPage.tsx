import { useState } from 'react';
import { KeyRound, Upload, Download, ShieldCheck } from 'lucide-react';
import { useApi, errorMessage } from '../context/ApiContext';
import { Spinner } from '../components/ui';

export function SettingsPage({ onImported }: { onImported: () => Promise<void> }) {
  const { token, setToken, request, blob, notify } = useApi();
  const [draftToken, setDraftToken] = useState(token);
  const [busy, setBusy] = useState(false);
  const upload = async (file: File) => {
    setBusy(true);
    try {
      if (file.size > 40 * 1024 * 1024) throw new Error('O backup deve ter até 40 MiB.');
      const input: unknown = JSON.parse((await file.text()).replace(/^\uFEFF/, ''));
      const report = await request<{ duplicate: boolean; counts: Record<string, number> }>(
        '/backups/import',
        'POST',
        input,
      );
      await onImported();
      notify(
        report.duplicate
          ? 'Este backup já havia sido importado.'
          : `Backup importado. ${report.counts.assets ?? 0} ativos disponíveis.`,
      );
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
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
            Importe textos, áudios, mídias, documentos, funis e macros nos formatos ZV_backup e
            respostasRapidasAcao.
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
