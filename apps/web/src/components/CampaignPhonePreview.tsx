import type { Asset } from '../types';
import { AssetPreview } from './AssetPreview';
import { Fragment, type ReactNode } from 'react';
export function CampaignPhonePreview({
  text,
  assets = [],
  name = 'Ana',
  title = 'Prévia da mensagem',
  steps,
  controls,
}: {
  text: string;
  assets?: Asset[];
  name?: string;
  title?: string;
  controls?: ReactNode;
  steps?: { id: string; text?: string; asset?: Asset; waitSeconds: number }[];
}) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const personalize = (text: string) =>
    text
      .replace(/\{\{\s*nome\s*\}\}|#nome/g, name)
      .replace(/\{\{\s*saudacao\s*\}\}/g, greeting)
      .replace(/\{([^{}]*\|[^{}]*)\}/g, (_match, choices: string) => choices.split('|')[0] ?? '');
  const personalized = personalize(text);
  return (
    <aside className="campaign-phone-panel">
      <strong>{title}</strong>
      {controls}
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
          {steps?.map((step) => (
            <Fragment key={step.id}>
              {step.waitSeconds > 0 && <span className="phone-date">Espera de {step.waitSeconds} s</span>}
              <div className="phone-message">
                {step.asset ? (
                  <AssetPreview asset={step.asset} name={name} compact />
                ) : (
                  personalize(step.text || 'Preencha esta etapa para visualizar.')
                )}
                <small>Etapa {steps.indexOf(step) + 1} · prévia</small>
              </div>
            </Fragment>
          ))}
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
          {!steps?.length && !personalized && !assets.length && (
            <p>Escreva uma mensagem ou escolha um recurso para visualizar.</p>
          )}
        </div>
        <footer>Mensagem</footer>
      </div>
    </aside>
  );
}
