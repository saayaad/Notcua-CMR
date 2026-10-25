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

createRoot(document.getElementById('root')!).render(
  <ApiProvider>
    <PreferencesProvider>
      <AuthGate>
        <App />
      </AuthGate>
    </PreferencesProvider>
  </ApiProvider>,
);
