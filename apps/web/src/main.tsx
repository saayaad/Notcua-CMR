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
import './access-keys.css';

createRoot(document.getElementById('root')!).render(
  <ApiProvider>
    <AuthGate>
      {window.location.pathname.replace(/\/+$/, '') === '/chaves' ? (
        <AccessKeysPage />
      ) : (
        <PreferencesProvider>
          <App />
        </PreferencesProvider>
      )}
    </AuthGate>
  </ApiProvider>,
);
