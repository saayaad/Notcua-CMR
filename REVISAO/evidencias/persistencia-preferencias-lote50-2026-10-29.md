# Persistência das preferências da rodada de 50 IDs — 29/10/2026

IDs: REQ-493, 494, 503, 206, 208, 209, 214, 215 e 216. Esta é continuação da **mesma rodada**, sem iniciar novos requisitos. A prova histórica `apps/server/test/access.test.ts:204-247` já cobria isolamento genérico entre espaços; não foi repetida. O teste novo `access.test.ts:249-313` cobre campos que não tinham prova individual.

Comando inicial: `.\node_modules\.bin\tsx.cmd --import ./apps/server/test/setup-env.mjs --test --test-name-pattern "REQ-493/494/503" apps/server/test/access.test.ts`. Resultado: **1/1 passou**. Foi identificada uma possível interferência de ordem: o teste novo criava a conta `staff`, que o teste adjacente também cria. A identidade foi trocada por `preferenceMember` (`access.test.ts:46,290-306`). Repetiu-se **somente** o teste adjacente porque essa alteração podia invalidá-lo: `--test-name-pattern "REQ-493/494/503|atendente não recebe"`, **2/2 passaram**. `tsc --noEmit -p apps/server/tsconfig.json`: aprovado. Banco SQLite temporário, identidades Firebase fictícias, sem WhatsApp externo, envio, exclusão de conteúdo, cobrança ou alteração em produção.

| IDs | Prova nova | Limite que permanece |
| --- | --- | --- |
| REQ-493 | `access.test.ts:251-289`: salva dois IDs, retira um, lê após PUT e confirma `asset.count() === 1`; a remoção do botão não apagou o conteúdo. | Clique no editor, recarga visual e estado após nova sessão. |
| REQ-494 | `access.test.ts:251-275`: duas configurações distintas de botão são recuperadas sem mistura; `AttendanceCustomization.tsx:166-171` altera o mapa por ID. | Editar um botão na interface, recarregar e conferir o outro. |
| REQ-503 | `access.test.ts:254-275`: `showPinnedPreview: false` e overrides `never`/`always` persistem. | Abrir a prévia visual; não executar envio real. |
| REQ-206 | `access.test.ts:259-275`: `menuLabels` e `folderLabels` persistem. | Ver rótulos aplicados em todos os menus/pastas após recarga. |
| REQ-208/209 | `access.test.ts:261-275`: cor e ícone de uma etiqueta fictícia persistem juntos. | Ver exibição no CRM após recarga; nenhuma mudança foi feita no WhatsApp. |
| REQ-214 | `access.test.ts:251,262-275`: campos de logo e favicon com data URL fictícia persistem. | Upload e renderização de arquivos PNG/JPEG/WebP reais pela interface; teste não valida decodificação da imagem. |
| REQ-215/216 | `access.test.ts:264-275`: densidade e posição persistem. | Conferir as três densidades e a posição efetiva dos painéis em viewport real. |

`access.test.ts:270-278` reabre o banco da conta alpha e confirma o registro completo. `:279-312` confirma que beta não vê a configuração, o membro `preferenceMember` grava apenas sua preferência, alpha permanece inalterado e acesso sem token recebe 401. O servidor permite editar **preferências próprias** a usuário autenticado de papel MEMBER (`operations.routes.ts:217-243`); outras configurações exigem administrador em `:219`. A configuração visual local é gravada após confirmação em `PreferencesContext.tsx:308-312`; a persistência HTTP usa a chave `preferences:<uid>` em `operations.routes.ts:207-243`.

**Conclusão desta subetapa:** persistência dos campos, reabertura do banco e permissões do servidor têm prova. Os nove IDs permanecem parciais porque o caminho visual, a recarga da tela e o arquivo de imagem real não foram observados. Não repetir o teste genérico já aprovado. Os quatro IDs ainda “a verificar” nesta rodada (REQ-202/204/512/223) dependem da matriz de diagnóstico da mesma rodada, não de um novo lote.
