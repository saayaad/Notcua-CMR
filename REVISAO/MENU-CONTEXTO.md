# Menu de botão direito — mapa e decisões

Atualização: 27/10/2026. **Implementação autorizada expressamente pelo usuário nesta etapa e disponível na cópia local.**

## Implementação atual

- POP-201: componente único `apps/web/src/context/ContextMenu.tsx`, montado acima de AuthGate. Abrange acesso, /chaves, páginas da operação e conteúdo de portais React.
- FUNC-201: botão direito no fundo e regiões sem ações oferece voltar (quando há histórico), atualizar e copiar endereço. Não há tentativa de alterar o menu nativo do navegador.
- FUNC-202: mensagens oferecem copiar texto e cadastrar resposta padrão; análise/transcrição usa o handler existente quando aplicável. Não há alteração no motor de envio, reações fictícias ou acesso a mídia de visualização única.
- FUNC-203: conversas oferecem abrir e copiar telefone. Recursos da Biblioteca oferecem visualizar, editar, favorito, duplicar e excluir; as duas últimas mantêm a confirmação já existente.
- FUNC-204: cards de outras telas reaproveitam os botões existentes e seu estado desabilitado. Alças de arrastar não são convertidas em ações de clique. Não são criados endpoints, privilégios ou novas regras por essa descoberta.
- FUNC-205: links HTTP/HTTPS/blob podem ser abertos/copied; imagens carregadas oferecem abrir/copiar endereço e download somente para origem local/blob. Links executáveis são recusados.
- FUNC-206: campos de texto comuns oferecem desfazer, refazer, copiar, recortar, colar e selecionar tudo. A edição usa comandos nativos, preservando eventos do formulário. Colar conteúdo vazio não apaga a seleção. Senhas e controles especiais mantêm o menu nativo. Falhas de permissão apresentam orientação para usar os atalhos.
- ELEM-201: tema claro/escuro e cor de destaque do aplicativo; dimensões limitadas ao viewport; rolagem para menus altos; camada acima dos diálogos; Escape, Tab, setas, Home/End, busca pela inicial e Shift+F10. Shift + botão direito conserva acesso ao menu nativo.

Evidências: [biblioteca](evidencias/menu-contextual-biblioteca.png) e [roteiro de testes](#testes-e-checklist). 60 testes selecionados aprovados nesta rodada; não equivalem à auditoria completa de 699 requisitos. Não publicado na Vercel nesta etapa.

Limites da verificação: Chrome/Edge/Firefox/Safari reais, toque prolongado e cada ação de cada módulo ainda precisam de revisão individual. Abertura global e handlers específicos implementados não são prova de que todos os botões existentes no aplicativo estejam corretos.

## Mapa anterior — histórico substituído pela autorização atual

### Limite planejado anteriormente

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


## Testes e checklist


27/10/2026. Ambiente fictício em 5187, SQLite temporário, sem trabalhadores ou conexão real ao WhatsApp. A operação do proprietário não foi alterada. Os estados abaixo distinguem código implementado, execução observada e testes ainda pendentes.

### Conferido nesta rodada

- [x] Menu geral aparece sobre o fundo da página.
- [x] Menu específico da Biblioteca contém visualizar, editar, favorito, duplicar e excluir.
- [x] Lista de conversas: Abrir conversa pelo menu levou ao cliente fictício selecionado.
- [x] Mensagem recebida fictícia: menu mostrou Copiar mensagem e Cadastrar resposta padrão; cadastro abriu com a pergunta preenchida. Cancelado sem gravar ou enviar. Evidências em evidencias/menu-contextual-mensagem.png e menu-contextual-pergunta-ficticia.png.
- [x] Abrir o menu não abre a prévia nem executa a ação de exclusão.
- [x] Editar abre o editor existente.
- [x] Excluir abre a confirmação existente; Cancelar preserva o recurso. Nenhuma exclusão confirmada.
- [x] Menu de texto aparece sobre o diálogo, sem ficar atrás do fundo escurecido.
- [x] Copiar apresenta retorno; recortar atualiza o campo. Colar texto fictício conhecido atualiza o formulário. Não foi salvo o rascunho de teste.
- [x] Shift+F10 abre o menu; seta para baixo e Enter executam Editar.
- [x] Escape fecha o menu.
- [x] Aparência conferida nos temas claro e escuro.
- [x] Menu aberto na borda inferior direita permaneceu dentro do viewport: tela 989×580; limites x=757–981, y=391,30–571,98, margem mínima de 8 px.
- [x] Testes automatizados de posicionamento (inclusive tela de 320×480) e rejeição de URLs executáveis.
- [x] Compilação e tipagem da aplicação.

### Minha conferência manual no sistema

Copie este trecho para o Notion; cada caixa pode ser marcada independentemente.

- [ ] Fundo: abrir menu, copiar endereço e verificar o endereço colado.
- [ ] Navegação: botão direito sobre uma aba; escolher a ação abre a mesma tela que o clique normal.
- [ ] Conversa: abrir e copiar telefone pelo botão direito.
- [ ] Mensagem: copiar texto e cadastrar resposta padrão, sem abrir os dois destinos ao mesmo tempo.
- [ ] Áudio: transcrever pelo menu; conferir processamento e aviso de erro se a API estiver indisponível.
- [ ] Mídia já carregada: abrir imagem, copiar seu endereço e baixar arquivo local.
- [ ] Biblioteca: visualizar, editar e favoritar; recarregar e conferir persistência.
- [ ] Biblioteca: duplicar por confirmação; conferir cópia e relações.
- [ ] Biblioteca: excluir somente recurso descartável; confirmar e conferir remoção.
- [ ] CRM: abrir edição/atendimento pelo card; arrastar continua separado do clique.
- [ ] Campanhas/Agenda: abrir financeiro e envios; só executar ativação com público de teste revisado.
- [ ] Equipe: ações respeitam o papel e o estado do usuário; não ativar/desativar conta real apenas para testar.
- [ ] Campo de texto: selecionar, copiar, recortar, colar, desfazer/refazer e selecionar tudo.
- [ ] Campo somente leitura: recortar e colar ficam indisponíveis.
- [ ] Senha/controle especial: recursos nativos continuam acessíveis.
- [ ] Shift + botão direito: abrir menu do navegador e seu corretor.
- [ ] Link: abrir em outra aba e copiar endereço.
- [ ] Abrir no canto da tela e em janela estreita: nenhum item fica inacessível.
- [ ] Janela destacada: menu aparece no documento certo e fecha sem perder o painel.
- [ ] Teclado: Shift+F10, setas, Home, End, Enter, Escape e retorno de foco.
- [ ] Conferir os mesmos passos em Chrome, Edge, Firefox e Safari reais.

### Regressão geral executada

60 testes aprovados: 49 em acesso, autenticação, backups, CRM, encaixe de painéis, mídia, normalização de contatos e variações; 11 em respostas padrão, HUD, rascunhos, microfone e recuperação de transações. Os testes de rede usam provedores simulados. Não houve chamada Gemini real, cadastro externo, emissão de licença real, cobrança ou envio WhatsApp.

Essa execução não encerra a auditoria geral: o livro de requisitos ainda tem itens a verificar; BUG-001 (erro silencioso de preferências), contas cliente reais, integrações com cota disponível e cobertura entre navegadores permanecem pendentes.

Rodada seguinte: compilação final com ícones aprovada; adicionada fumaça da lista e bolha do ChatPane usando apenas uma identidade/mensagem fictícia no banco temporário. Nenhuma mudança no serviço original de Mensagens. BUG-002 e BUG-003 de economia de IA reproduzidos com provedor falso e documentados em BUGS.md. Contagens individuais atualizadas no livro, sem promover todos os módulos a completos.
