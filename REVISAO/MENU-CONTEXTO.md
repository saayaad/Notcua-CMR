# Menu de botão direito — mapa e decisões

Atualização: 27/10/2026. **Preparação apenas. Não implementado e não aprovado ainda.**

## Limite desta fase

A Fase 1 registra o pedido; a Fase 3 trará o mapa concreto de áreas, handlers existentes e sugestões separadas. Nenhuma ação é considerada funcional somente porque aparece abaixo.

| Área candidata | Identificação a conferir | Ações existentes | Novas sugestões | Quem vê | Status |
|---|---|---|---|---|---|
| Mensagem | ChatPane / bolha individual | Levantar handlers sem mudar lógica | Reações, seleção ou outras apenas se aprovadas | Conforme papel/estado | ⬜ |
| Conversa na lista | ConversationList / card | Levantar abertura e ações existentes | Somente após decisão | Conforme papel/estado | ⬜ |
| Anexo/imagem | AssetPreview / player / download | Conferir prévia e download existentes | Não presumir copiar imagem | Conforme papel/estado | ⬜ |
| Recurso da Biblioteca | LibraryPage / ToolsPanel / card | Conferir editar, duplicar, excluir, prévia | Não duplicar serviço | Conforme papel/estado | ⬜ |
| Cliente/contato | ContactDetails / Contatos | Conferir copiar e abrir | Pedidos de produção dependem da decisão de escopo | Conforme papel/estado | ⬜ |
| Card Kanban | CrmPage / oportunidade | Conferir detalhes e movimentos | Não criar novas regras financeiras pelo menu | Conforme papel/estado | ⬜ |
| Campanha/agendamento | OperationsPages / linha/card | Conferir ações já disponíveis | Sem disparo real na revisão | Conforme papel/estado | ⬜ |
| Usuário/equipe | TeamManager | Conferir ações e bloqueio no servidor | Não inventar perfil de criador | Administrador quando aplicável | ⬜ |
| Fluxo/nó | FlowEditor / FlowInspector | Conferir ações disponíveis | Separar menu de canvas já fornecido pela biblioteca | Conforme papel/estado | ⬜ |
| Navegação/painel | App / AttendanceDock | Conferir caminhos de abrir e recolher | Não substituir gerenciador de painéis | Operador autorizado | ⬜ |
| Link/texto selecionado | Elemento link ou seleção | Usar ações aplicáveis de abrir/copiar | Evitar interceptar navegação nativa sem benefício | Operador | ⬜ |
| Campo editável | input, textarea, contenteditable | Manter copiar/colar/corretor nativos | Nenhum menu customizado | Todos | Regra definida |
| Área sem ação | Fundo ou região decorativa | Manter menu nativo | Nenhuma | Todos | Regra definida |

## Regras já registradas

Componente e registro únicos; reaproveitar handlers; menu dentro da tela; teclado/foco; toque e botão ⋯; caminhos alternativos; itens destrutivos e permissões preservados; nada de marca WhatsApp ou Meta AI. A referência a reações é condicional à existência real ou aprovação, não autorização para mudar o banco.

Busca inicial onContextMenu/contextmenu/ContextMenu em apps/web/src: sem ocorrências. Isso não prova que bibliotecas de terceiros não tenham seus próprios menus.

## Parte ausente do anexo

O documento termina na seção 6.1. A “matriz” mencionada nas fases e a seção 7 não foram recebidas. Confirmar se há continuação antes de fechar a especificação técnica do menu.

