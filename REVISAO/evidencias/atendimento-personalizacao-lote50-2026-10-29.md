# Atendimento e Personalização — diagnóstico de 50 IDs (29/10/2026)

Escopo: REQ-486–503, REQ-507–519 e REQ-199/200/201/202/203/204/206/208/209/214/215/216/217/218/219/220/221/222/223. Foram conferidos o livro, o inventário, o histórico e as ligações atuais. **Nenhuma suíte aprovada foi repetida.** `apps/server/test/attendance-layout.test.ts:5-28`, `dock-layout.test.ts:34-76`, `preferences-save.test.ts:5-43` e `access.test.ts:203-239` são prova histórica restrita às funções que exercitam; o último confirma isolamento genérico de preferências entre dois espaços, sem provar cada campo nem percurso visual. Sem acesso automatizado à página autenticada, não houve clique real, envio, cobrança, exclusão ou alteração de dados. “Parcial” significa ligação demonstrada, não homologação.

| ID | Prova já existente / conferência atual por arquivo, função e linha | Falta verificar / dependência | Resultado |
| --- | --- | --- | --- |
| REQ-486 | `ResourceWorkbench.tsx:260-270` filtra; `:400-485` oferece tipo, inclusive fluxo, busca e categoria. | Percurso visual, troca de filtros e recarga com dados da conta. | Parcial |
| REQ-487 | `AttendanceFunctions.tsx:5-33` monta funções; `HudEditor.tsx:311-326` escolhe posição dos atalhos e `:402-413` das funções. | Conferir barras superior/inferior em larguras reais. | Parcial |
| REQ-488 | `ChatPane.tsx:362-367` encaminha atalho; `App.tsx:138-154` abre destino; `ResourceWorkbench.tsx:142-161` escolhe seção/tipo. | Clique autenticado de cada atalho, sem disparar conteúdo. | Parcial |
| REQ-489 | Teste histórico `attendance-layout.test.ts:5-10` cobre `toolTarget`; `attendance.ts:42-44` separa lateral/janela; `App.tsx:138-154` usa essa escolha. | Observar um clique em cada rota na interface autenticada. | Parcial |
| REQ-490 | `HudEditor.tsx:228-264` reúne abas de painéis, botões, funções, atalhos e fixados. | Inventariar controles de barras ainda fora desse editor e conferir navegação. | Parcial |
| REQ-491 | `HudEditor.tsx:223-245` mostra explicação e abas; `attendance.css:636-689` define painel de controles. | Aceite de clareza/legibilidade na interface. | Parcial |
| REQ-492 | `AttendanceCustomization.tsx:148-165,191-223` filtra fixáveis por tipo/categoria; `PinnedShelf.tsx:44-55` filtra os já fixados. | Conferir categorias salvas, filtro e recarga autenticada. | Parcial |
| REQ-493 | `AttendanceCustomization.tsx:225-265` remove um ID sem excluir conteúdo; `PinnedShelf.tsx:47-49` lê seleção. | Remoção fictícia, persistência e isolamento entre usuários. | Parcial |
| REQ-494 | `AttendanceCustomization.tsx:166-171,247-307` edita nome, categoria e prévia por ID. | Salvar, recarregar e conferir que outro botão não muda. | Parcial |
| REQ-495 | `PreferencesContext.tsx:119-137` inicia atalhos ocultos e fixados vazios; `HudEditor.tsx:685-692` restaura vazio. | Primeira abertura de conta nova; preferência legada pode diferir. | Parcial |
| REQ-496 | `HudEditor.tsx:265-365` altera ordem/posição; `HudPlacement.tsx:10-31,44-69` move bloco e salva. | Arrastar, recarregar e verificar colisões. | Parcial |
| REQ-497 | `HudEditor.tsx:228-250` contém aba Atalhos; `AttendanceCustomization.tsx:17-45` organiza ordem. | Conferir abertura e uso visual. | Parcial |
| REQ-498 | `HudEditor.tsx:228-250` contém aba Teclas; `AttendanceCustomization.tsx:83-105` edita teclas. | Atalho configurado em conta fictícia, recarga e conflito. | Parcial |
| REQ-499 | `ReorderList.tsx:23-85` ordena por arraste/setas, sem campo numérico; `AttendanceCustomization.tsx:29-45` o usa. | Conferir interface e confirmar se a regra inclui remover teclas numéricas, como ressalva o livro. | Parcial |
| REQ-500 | `attendance.css:683-715` usa espaçamento compacto no editor; `layout.css:643-646` varia por densidade. | Comparação visual de altura, margens e cortes. | Parcial |
| REQ-501 | `PreferencesContext.tsx:235-237` aplica densidade global; `layout.css:643-646` ajusta componentes. | Varredura visual das demais telas em três densidades. | Parcial |
| REQ-502 | `PinnedShelf.tsx:103-124` renderiza um único botão Enviar por fixado. | Conferir estado vazio e fixados reais sem fazer envio. | Parcial |
| REQ-503 | `AttendanceCustomization.tsx:179-189,294-305` configura prévia geral/individual; `PinnedShelf.tsx:105-117` aplica. | Persistência e confirmação visual do comportamento; sem envio real. | Parcial |
| REQ-507 | `hud.ts:35-77` calcula proporções; `App.tsx:342-347,556-622` usa grid; `layout.css:25-32,648-659` adapta largura. | Capturas HD, Full HD e estreita, inclusive sem sobreposição. | Parcial |
| REQ-508 | `App.tsx:111-118,590-594,779-782` abre editor na conversa; `ResourceWorkbench.tsx:624-629` oferece acesso lateral. | Clique autenticado a partir da conversa. | Parcial |
| REQ-509 | `HudEditor.tsx:124-131,437-465` mantém rascunho e prévia; `:200-214` salva depois. | Ver prévia visual antes de confirmar. | Parcial |
| REQ-510 | `hud.ts:35-77` encaixa no grid; `HudPlacement.tsx:10-31,44-69` salva posição flutuante individual, sem detecção de colisão com outros blocos. | **Falha estática:** dois blocos flutuantes podem ocupar as mesmas coordenadas. Definir regra de encaixe para modo livre e reproduzir visualmente. | Defeito diagnosticado |
| REQ-511 | `HudEditor.tsx:124-131,200-214,675-715` mantém rascunho/Cancelar/Confirmar; `PreferencesContext.tsx:308-312` publica estado depois de persistir. | Cancelar/confirmar, recarregar e conferir permissões na conta. Layout encaixável tem fluxo separado (`AttendanceDock.tsx:294-317`). | Parcial |
| REQ-512 | Histórico das Partes 1/2 no livro e este lote; há requisitos específicos ainda parciais. | Escopo amplo: só fechar após os IDs filhos e aceite visual. | A verificar |
| REQ-513 | `attendance.css:636-656` amplia modal a 76rem e define colunas; `usability.css:3-7` limita ao viewport. | Legibilidade de cada aba em resoluções reais. | Parcial |
| REQ-514 | `HudEditor.tsx:228-264,437-465` mantém seção de prévia fora da troca condicional de abas. | Conferir prévia completa em todas as sete abas, desktop/celular. | Parcial |
| REQ-515 | `HudEditor.tsx:124-150,465-483` deriva prévia do rascunho; controles chamam `change` (`:275-304`). | Matriz de todas as opções; prévia pode não refletir todo efeito do encaixe real (`:271`). | Parcial |
| REQ-516 | `App.tsx:327-338,556-622` separa Atendimento da Biblioteca; `ResourceWorkbench.tsx:115,142-153` inicia lateral em Biblioteca. | Clique autenticado no menu com estado anterior de pop-up. | Parcial |
| REQ-517 | `attendance.ts:21-35,42-44`; `ChatPane.tsx:362-367`; `App.tsx:138-154`; `ResourceWorkbench.tsx:142-155,399-435` encaminham Textos/Áudios/Mídias à lateral filtrada. | Clique visual, dados salvos e recarga. | Parcial |
| REQ-518 | Teste histórico `attendance-layout.test.ts:5-10`; `ResourceWorkbench.tsx:142-155,643-653` seleciona Biblioteca, mantendo Fixados como aba da lateral; `PinnedShelf.tsx:125-133` mostra estado vazio. | Conferir que estado anterior não reabre pop-up vazio. | Parcial |
| REQ-519 | `HudEditor.tsx:128,437-444` tem Ampliar/Voltar; `attendance.css:652-656` dimensiona editor. | Ampliar e restaurar em viewport real sem cortar conteúdo. | Parcial |
| REQ-199 | Prova histórica parcial no livro; `styles.css:45-51` reseta elementos e pseudo-elementos. | Inspeção visual de componentes afetados. | Parcial |
| REQ-200 | Prova histórica parcial; `styles.css:52-67` fixa 16px, ajuste de texto, suavização e herança. | Zoom e legibilidade no navegador. | Parcial |
| REQ-201 | Prova histórica parcial; `layout.css:13-32` usa 100vw/100dvh, flex, grid e overflow. | Ver ausência de rolagem/corte por viewport. | Parcial |
| REQ-202 | `layout.css:352-432` e `styles.css:2078-2143` contêm media queries. | Não há capturas HD, Full HD e ultrawide válidas; exige navegador/viewport. | A verificar |
| REQ-203 | Prova histórica parcial; `layout.css:22-32` usa clamp/minmax; `attendance.css:637-654` limita modal. | Zoom 80/100/125/150% em viewport real. | Parcial |
| REQ-204 | CSS responsivo e fontes não demonstram compatibilidade. | Abrir Chrome, Edge, Firefox e Safari nas rotas principais; dependência de ambientes reais. | A verificar |
| REQ-206 | `WorkspaceSettings.tsx:255-325` edita nomes; `App.tsx:327-339` e `ResourceWorkbench.tsx:418-429` consomem. | Salvar, recarregar, ver todos os menus/pastas e permissão por usuário. | Parcial |
| REQ-208 | `OrderingSettings.tsx:145-153` edita cor visual; `CrmPage.tsx:328` consome. | Conferir cor no CRM após recarga e isolamento; não altera WhatsApp. | Parcial |
| REQ-209 | `OrderingSettings.tsx:145-153` edita ícone; `CrmPage.tsx:329` consome. | Conferir ícone no CRM após recarga e isolamento. | Parcial |
| REQ-214 | `WorkspaceSettings.tsx:184-229` recebe imagens; `PreferencesContext.tsx:238-245` aplica favicon; `App.tsx:363-379` mostra logo. | Upload fictício, persistência, tamanho e permissão; nenhum arquivo real foi enviado. | Parcial |
| REQ-215 | `HudEditor.tsx:272-281` escolhe densidade; `PreferencesContext.tsx:235-237` aplica; `layout.css:643-646` estiliza. | Conferir três densidades e recarga nas telas principais. | Parcial |
| REQ-216 | `HudEditor.tsx:299-365` escolhe distribuição/largura/posição; `hud.ts:35-77` calcula grid. | Mover painéis, recarregar e verificar viewport. | Parcial |
| REQ-217 | Prova histórica BUG-001: teste fictício de falha/retentativa e reload, `preferences-save.test.ts:5-43`; `PreferencesContext.tsx:194-215,262-312` salva por UID; servidor `operations.routes.ts:208-239` isola chave e permite preferência ao usuário. | Conta em dois navegadores/dispositivos reais simultâneos; histórico parcial preservado. | Parcial |
| REQ-218 | `layout.css:546,590-591` e `overlays.css:22-26` usam blur, camadas e sombra; `styles.css:43` define sombra. | Aceite visual de intensidade/consistência. | Parcial |
| REQ-219 | `layout.css:558` aplica gradiente a `.button.primary`. | Conferir contraste e consistência em páginas reais. | Parcial |
| REQ-220 | `styles.css:93-100,1997,2057` e `layout.css:551` têm transições/animações próximas de 200ms. | Troca de páginas e fechamento de pop-ups não estão demonstrados como ~200ms em todas as rotas. | Parcial |
| REQ-221 | `styles.css:82-100,196-205` dá foco/hover/active; `layout.css:551-556` amplia retorno. | Navegação por teclado, toque e estados em todos os controles. | Parcial |
| REQ-222 | `ApiContext.tsx:50` renderiza barra; `overlays.css:95-115` anima progresso; `styles.css:1997` anima entrada. | Ver duração, remoção e leitura em erro/sucesso sem efeito externo. | Parcial |
| REQ-223 | Há botões ligados nos componentes acima; nenhum inventário funcional de **todos** os botões do sistema. | Inventário por tela, teste de ação real, permissões e persistência conforme cada ação; depende dos módulos restantes. | A verificar |

## Decisões e próximos testes

- REQ-510: modo livre permite sobreposição. Corrigir exige definir se blocos devem encaixar automaticamente, rejeitar a posição ou migrar para abas. Não alterado antes dessa regra.
- REQ-499: retirar números de **ordenação** já está representado pelo `ReorderList`; a ressalva do livro sobre teclas numéricas continua.
- REQ-202/204/223/512: escopo de observação amplo; nenhum deles foi marcado concluído apenas pela presença de código.
- Próximo lote seguro: persistência e isolamento de preferências REQ-493/494/503/206/208/209/214/215/216, usando conta fictícia e sem envio. Antes, conferir se outro trabalho alterou o mesmo módulo.
