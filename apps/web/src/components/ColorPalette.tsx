import {Select} from './Select';
import { useEffect, useState, type CSSProperties } from 'react';
import { Check, ChevronDown, Paintbrush } from 'lucide-react';
import { usePreferences } from '../context/PreferencesContext';
import { useApi, errorMessage } from '../context/ApiContext';
import { Spinner } from './ui';

const palettes = [
  { name: 'Lavanda', primary: '#a68bfa', secondary: '#59418f' },
  { name: 'Roxo profundo', primary: '#7c35e9', secondary: '#530f7e' },
  { name: 'Azul oceano', primary: '#488af0', secondary: '#1e438a' },
  { name: 'Esmeralda', primary: '#28aa91', secondary: '#12624f' },
  { name: 'Turquesa', primary: '#21abb8', secondary: '#15566b' },
  { name: 'Rosa', primary: '#dc74b6', secondary: '#853064' },
  { name: 'Âmbar', primary: '#d99c32', secondary: '#805414' },
  { name: 'Ardósia', primary: '#8e9ebd', secondary: '#44506d' },
];
const validHex = (value: string) => /^#[\da-f]{6}$/i.test(value);
const channels = (hex: string) =>
  validHex(hex) ? [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)) : [0, 0, 0];
export function ColorPalette() {
  const { preferences, savePreferences } = usePreferences();
  const { notify } = useApi();
  const [primary, setPrimary] = useState(preferences.accentColor);
  const [secondary, setSecondary] = useState(preferences.secondaryColor);
  const [advanced, setAdvanced] = useState(false);
  const [format, setFormat] = useState('hex');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setPrimary(preferences.accentColor);
    setSecondary(preferences.secondaryColor);
  }, [preferences.accentColor, preferences.secondaryColor]);
  const valid = validHex(primary) && validHex(secondary);
  const selected = palettes.find(
    (palette) =>
      palette.primary.toLowerCase() === primary.toLowerCase() &&
      palette.secondary.toLowerCase() === secondary.toLowerCase(),
  );
  const apply = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      await savePreferences({ accentColor: primary, secondaryColor: secondary });
      notify('Paleta de cores aplicada.');
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="color-palette" aria-label="Escolha de cores">
      <div className="palette-intro">
        <h3>Escolha uma paleta</h3>
        <p>Clique nas cores para visualizar. Confirme quando encontrar a sua preferida.</p>
      </div>
      <div className="palette-grid">
        {palettes.map((palette) => (
          <button
            key={palette.name}
            className="palette-choice"
            aria-pressed={selected?.name === palette.name}
            onClick={() => {
              setPrimary(palette.primary);
              setSecondary(palette.secondary);
            }}
          >
            <span className="palette-choice-colors">
              <i style={{ background: palette.primary }} />
              <i style={{ background: palette.secondary }} />
            </span>
            <span>{palette.name}</span>
            {selected?.name === palette.name && <Check size={15} />}
          </button>
        ))}
      </div>
      <div
        className="palette-live-preview"
        style={
          {
            '--palette-primary': validHex(primary) ? primary : preferences.accentColor,
            '--palette-secondary': validHex(secondary) ? secondary : preferences.secondaryColor,
          } as CSSProperties
        }
      >
        <span className="palette-preview-label">Prévia</span>
        <span className="palette-preview-tab">Atendimento</span>
        <span className="palette-preview-chip">Cliente novo</span>
        <span className="palette-preview-button">Enviar mensagem</span>
      </div>
      <button
        className="palette-custom-toggle"
        aria-expanded={advanced}
        onClick={() => setAdvanced((value) => !value)}
      >
        <Paintbrush size={15} />
        Cor personalizada (HEX ou RGB)
        <ChevronDown size={15} />
      </button>
      {advanced && (
        <div className="palette-custom-editor">
          <label>
            Formato
            <Select value={format} onChange={(event) => setFormat(event.target.value)}>
              <option value="hex">HEX</option>
              <option value="rgb">RGB</option>
            </Select>
          </label>
          {(
            [
              ['Primária', primary, setPrimary],
              ['Secundária', secondary, setSecondary],
            ] as const
          ).map(([name, value, change]) => (
            <div className="palette-custom-color" key={name}>
              <strong>{name}</strong>
              <input
                type="color"
                aria-label={`Escolher cor ${name.toLowerCase()}`}
                value={validHex(value) ? value : '#000000'}
                onChange={(event) => change(event.target.value)}
              />
              {format === 'hex' ? (
                <input
                  aria-label={`HEX ${name}`}
                  value={value}
                  maxLength={7}
                  onChange={(event) => change(event.target.value)}
                  placeholder="#7c35e9"
                />
              ) : (
                <div className="palette-rgb">
                  {channels(value).map((channel, index) => (
                    <label key={index}>
                      {['R', 'G', 'B'][index]}
                      <input
                        aria-label={`${name} ${['R', 'G', 'B'][index]}`}
                        type="number"
                        min="0"
                        max="255"
                        value={channel}
                        onChange={(event) => {
                          const rgb = channels(value);
                          rgb[index] = Math.min(255, Math.max(0, Number(event.target.value)));
                          change('#' + rgb.map((part) => part.toString(16).padStart(2, '0')).join(''));
                        }}
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {!valid && <p role="alert">Informe uma cor HEX válida com seis dígitos, por exemplo #7c35e9.</p>}
      <div className="palette-confirm">
        <span>{selected?.name ?? 'Paleta personalizada'}</span>
        <button className="button primary" disabled={!valid || busy} onClick={() => void apply()}>
          {busy ? <Spinner /> : <Check size={15} />}Aplicar paleta
        </button>
      </div>
    </section>
  );
}
