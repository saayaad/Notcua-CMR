import type { Asset } from '../types';
import { AssetPreview } from './AssetPreview';
export function CampaignPhonePreview({
  text,
  assets = [],
  name = 'Ana',
  title = 'Prévia da mensagem',
}: {
  text: string;
  assets?: Asset[];
  name?: string;
  title?: string;
}) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const personalized = text
    .replace(/\{\{\s*nome\s*\}\}|#nome/g, name)
    .replace(/\{\{\s*saudacao\s*\}\}/g, greeting)
    .replace(/\{([^{}]*\|[^{}]*)\}/g, (_match, choices: string) => choices.split('|')[0] ?? '');
  return (
    <aside className="campaign-phone-panel">
      <strong>{title}</strong>
      <div className="campaign-phone">
        <header>
          <span className="phone-avatar">{name.slice(0, 1)}</span>
          <div>
            <b>{name}</b>
            <small>Prévia · nenhum envio realizado</small>
          </div>
        </header>
        <div className="campaign-phone-chat">
          <span className="phone-date">Hoje</span>
          {personalized && (
            <div className="phone-message">
              {personalized}
              <small>Agora ✓✓</small>
            </div>
          )}
          {assets.map((asset) => (
            <div className="phone-message" key={asset.id}>
              <AssetPreview asset={asset} compact />
              <small>Agora ✓✓</small>
            </div>
          ))}
          {!personalized && !assets.length && (
            <p>Escreva uma mensagem ou escolha um recurso para visualizar.</p>
          )}
        </div>
        <footer>Mensagem</footer>
      </div>
    </aside>
  );
}
