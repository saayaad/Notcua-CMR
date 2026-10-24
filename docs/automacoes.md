# Etapa 5 — Fluxos visuais e follow-up

Abra a central em `http://127.0.0.1:5173/atendimento` e escolha **Automações**. Selecione a conexão desejada no topo.

1. Clique em **Novo fluxo** e dê um nome.
2. Clique no bloco **Início** para definir as palavras-chave, a comparação, os contatos/grupos permitidos, o intervalo para repetir e o horário de São Paulo, se necessário.
3. Adicione blocos de mensagem, áudio, mídia, espera ou resposta. Os recursos de envio são criados antes na **Biblioteca**.
4. Conecte os pontos entre os blocos ou use o campo **Próximo bloco** na configuração. Em **Aguardar resposta**, configure também os caminhos de resposta diferente e de prazo esgotado. O follow-up é opcional e precisa de um prazo maior que zero.
5. **Salvar** cria um rascunho. **Simular** percorre o fluxo com um contato fictício: não envia nada ao WhatsApp e não cria uma execução real.
6. **Publicar** valida os caminhos e congela os recursos usados nesta versão. Depois, volte à lista e clique no botão de ativação. Publicar um fluxo novo não o ativa automaticamente.

As alterações em rascunho não modificam a versão publicada. Publicar uma atualização de um fluxo ativo altera as próximas execuções; as que já começaram continuam usando sua versão original. Se quiser interromper tudo antes de editar, pause o fluxo na lista.

## Execuções

Em **Execuções recentes**, consulte as últimas 50 execuções da conexão e cancele uma execução em andamento. Pausar ou arquivar um fluxo cancela as execuções ativas dele. Uma etapa de envio que já começou pode terminar; o cancelamento impede as próximas etapas. Restaurar um fluxo arquivado o mantém pausado.

Cada conversa executa apenas um fluxo ou funil manual por vez. Se vários fluxos corresponderem à mesma mensagem, o fluxo criado primeiro tem prioridade. O intervalo de repetição é aplicado por fluxo e conversa.

Histórico importado, mensagens antigas, mensagens enviadas por você e eventos repetidos não iniciam novos fluxos. Mensagens recebidas enquanto um fluxo aguarda resposta são consumidas por essa espera; elas não disparam outro fluxo. “Qualquer mensagem” aceita também uma resposta sem texto; a comparação por conteúdo usa o texto da mensagem.

As esperas e os prazos ficam no banco e são retomados quando o servidor volta. Se uma etapa estava executando durante uma interrupção, ela fica como falha para evitar repetir um envio cuja confirmação se perdeu. Confira a conversa antes de iniciar novamente. Quando o WhatsApp está desconectado, os envios aguardam a conexão.

## Importação e limites desta etapa

Fluxos importados precisam ser revisados, publicados neste editor e ativados expressamente. A exportação JSON preserva as definições; não é uma cópia das execuções em andamento. Preserve também o banco e a chave das sessões para uma cópia completa do ambiente.

Os caminhos publicados não podem formar ciclos nem deixar blocos soltos. Use o prazo e o follow-up do bloco de resposta para retomadas. Não há disparo em massa ou gatilho por agenda independente de uma mensagem recebida nesta etapa. O ambiente continua local e de um único operador.
