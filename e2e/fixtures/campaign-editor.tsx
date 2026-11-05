import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { BatchEditor } from '../../apps/web/src/pages/OperationsPages';
import { ApiProvider } from '../../apps/web/src/context/ApiContext';
import type { Library } from '../../apps/web/src/types';
import '../../apps/web/src/styles.css';
import '../../apps/web/src/layout.css';
import '../../apps/web/src/overlays.css';
import '../../apps/web/src/workbench.css';
const library: Library = {
  assets: [
    {
      id: 'test-image',
      name: 'Imagem fictícia',
      kind: 'MEDIA',
      text: null,
      caption: 'Legenda fictícia',
      fileId: 'file-image',
      isFavorite: false,
      isPtt: false,
      isPtv: false,
      asViewOnce: false,
      file: { id: 'file-image', mimeType: 'image/png', filename: 'ficticia.png', byteLength: 68 },
    },
  ],
  funnels: [],
  macros: [],
  pixKeys: [],
};
function Fixture() {
  const [saved, setSaved] = useState(false);
  return (
    <ApiProvider>
      <BatchEditor
        sessionId="phase3-session"
        library={library}
        schedule={false}
        onClose={() => undefined}
        onSaved={() => setSaved(true)}
      />
      {saved && <div role="status">Rascunho salvo na API fictícia</div>}
    </ApiProvider>
  );
}
createRoot(document.getElementById('root')!).render(<Fixture />);
