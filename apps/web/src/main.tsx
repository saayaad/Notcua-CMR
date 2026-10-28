import { createRoot } from 'react-dom/client';
import { ApiProvider } from './context/ApiContext';
import App from './App';
import { AuthGate } from './auth/AuthGate';
import { PreferencesProvider } from './context/PreferencesContext';
import './styles.css';
import './layout.css';
import './components/tools.css';
import './components/tools-compact.css';
import './overlays.css';
import './components/toolbox.css';
import './attendance.css';
import './workbench.css';
import './sandbox.css';
import './client-ai.css';
import './watermark.css';
import './usability.css';
import { AccessKeysPage } from './pages/AccessKeysPage';
import { ContextMenuProvider } from './context/ContextMenu';
import { AiFeaturesProvider } from './context/AiFeatures';
import './access-keys.css';

window.addEventListener('vite:preloadError', (event) => {
  const key = 'noctua:preload-reload';
  const now = Date.now();
  try {
    const lastAttempt = Number(window.sessionStorage.getItem(key) || 0);
    if (now - lastAttempt < 60_000) return;
    window.sessionStorage.setItem(key, String(now));
  } catch {
    return;
  }
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <ApiProvider>
    <ContextMenuProvider>
      <AuthGate>
        {window.location.pathname.replace(/\/+$/, '') === '/chaves' ? (
          <AccessKeysPage />
        ) : (
          <PreferencesProvider>
              <AiFeaturesProvider><App /></AiFeaturesProvider>
          </PreferencesProvider>
        )}
      </AuthGate>
    </ContextMenuProvider>
  </ApiProvider>,
);
