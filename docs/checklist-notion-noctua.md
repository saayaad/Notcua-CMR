# Noctua CRM — checklist de testes

> **Como usar no Notion:** importe este arquivo Markdown. Cada item `- [ ]` deve aparecer como uma caixa de tarefa marcável. Marque somente depois de testar no site.
>
> **Estados do código:** ✅ implementado; 🟡 parcial; ⬜ pendente. “Implementado” quer dizer que encontrei código para a função, não que ela já foi validada no seu computador.

## Parte 1 — Estrutura, personalização e CRM

- [ ] 🟡 Testar o layout em diferentes tamanhos de tela, zoom do navegador e resoluções. **Código:** app shell fluido existe; ainda há alguns tamanhos fixos.
- [ ] 🟡 Conferir alinhamento e tipografia entre navegadores. **Código:** reset global está parcialmente coberto pelo Tailwind; falta o reset explícito solicitado.
- [ ] ✅ Alterar tema, cor e densidade; salvar, atualizar a página e conferir se permanece.
- [ ] ✅ Confirmar que as preferências visuais são salvas na conta e aparecem em outro navegador/dispositivo.
- [ ] ✅ Confirmar que o nome do sistema permanece “noctua”.
- [ ] 🟡 Reordenar etiquetas e conferir a ordem nos filtros e no Kanban.
- [ ] ✅ Abrir a busca global com `Ctrl + K`, pesquisar conversa/campanha e navegar para o resultado.
- [ ] ✅ Criar/editar oportunidade no CRM e preencher valor em R$.
- [ ] 🟡 Conferir os indicadores de receita/ROI por etiqueta e campanha. **Limite:** atribuição automática ainda é parcial.
- [ ] 🟡 Testar tema claro/escuro, animações, notificações e aparência das telas principais.
- [ ] 🟡 Testar no celular: lista de conversas → conversa em tela cheia → ferramentas/drawer.

## Parte 2 — Atendimento e HUD

- [ ] ✅ Abrir Personalizar Atendimento, mudar ordem/visibilidade do HUD e confirmar as alterações.
- [ ] ✅ Reabrir a tela e conferir se a personalização foi mantida.
- [ ] ✅ Pesquisar conversas, alternar filtros e selecionar etiquetas.
- [ ] ✅ Conferir a prioridade visual/SLA das conversas.
- [ ] ✅ Criar uma nota interna e confirmar que ela não aparece como mensagem enviada ao cliente.
- [ ] ✅ Gerar o resumo da conversa e conferir se apresenta três pontos.
- [ ] ✅ Usar o Copiloto para melhorar um texto e sugerir resposta a uma objeção. **Requer:** provedor de IA configurado.
- [ ] ✅ Digitar `/` no compositor e localizar um recurso da biblioteca.
- [ ] ✅ Gravar áudio, ouvir/revisar e enviar em conversa de teste.
- [ ] ✅ Solicitar transcrição de áudio recebido. **Requer:** provedor/modelo configurado.
- [ ] ✅ Conferir presença “digitando/gravando” em envio ou fluxo compatível.
- [ ] 🟡 Conferir indicação de mensagem apagada pelo cliente. **Depende:** evento disponível pela conexão WhatsApp.

## Parte 3 — Exportação, contatos, campanhas e biblioteca

- [ ] 🟡 Exportar histórico de uma conversa e abrir o arquivo resultante.
- [ ] 🟡 Exportar incluindo mídias e conferir arquivos disponíveis. **Limite:** mídia antiga pode não estar mais no WhatsApp; transcrição/descrição não é gerada automaticamente para todo o histórico.
- [ ] 🟡 Conferir exemplos de conversa aprovados usados pela IA. **Limite:** isso orienta a resposta; não treina nem altera o modelo base.
- [ ] 🟡 Importar um CSV/XLSX pequeno, conferir a prévia, nomes e telefones limpos.
- [ ] 🟡 Importar planilha com colunas fora de ordem e dados misturados; revisar o resultado antes de salvar.
- [ ] 🟡 Conferir importação de arquivo `.xls` antigo.
- [ ] ✅ Criar campanha de teste com lista/etiqueta e filtro de inatividade; revisar o público antes de salvar.
- [ ] ✅ Conferir mídia, intervalos, pausas e painel de monitoramento da campanha.
- [ ] 🟡 Salvar campanha como rascunho e validar os intervalos. **Limite:** intervalos não garantem que o WhatsApp nunca bloqueará um número.
- [ ] ✅ Criar lembrete e mensagem agendada; testar a busca/autocomplete de contato.
- [ ] ✅ Na Biblioteca, criar um texto, áudio ou mídia, atribuir categoria e abrir a prévia.
- [ ] ✅ Usar favorito, busca, edição, duplicação e exclusão em um recurso de teste.
- [ ] ✅ Testar transferência de conversa com responsável e nota interna.
- [ ] ✅ Testar mensagens fixadas por categoria.
- [ ] ✅ Conectar/desconectar uma sessão de teste pelo QR Code.

## Parte 4 — Simulador, Sandbox, ajuda e backup

- [ ] 🟡 Simular um fluxo e reiniciar a conversa simulada. **Limite:** identificação da regra/memória usada e calibração inline estão incompletas.
- [ ] ⬜ Abrir o Espaço de Teste pelo menu e carregar dados fictícios. **Código:** a página existe, mas ainda não está ligada ao menu.
- [ ] 🟡 No Sandbox, testar mensagens, etiquetas, transferências e dados de exemplo sem alterar conversas reais.
- [ ] 🟡 Abrir a Central de Ajuda e conferir os guias. **Limite:** faltam as pastas e tutoriais detalhados pedidos.
- [ ] ✅ Gerar um backup JSON e confirmar que o arquivo foi baixado.
- [ ] 🟡 Validar restauração do backup somente em uma cópia separada da instalação.
- [ ] ⬜ **Não testar em dados reais:** reset geral apaga informações. Só testar em ambiente descartável, com backup confirmado.

## Parte 5 — Gemini, mídia e auditoria

- [ ] 🟡 Configurar Gemini como provedor e validar uma tarefa simples. **Limite:** os motores Flash/Pro/Imagem ainda não estão separados por função.
- [ ] ⬜ Conferir histórico persistente de criação de IA separado para cada cliente.
- [ ] ⬜ Conferir geração de imagem pelo atendimento, com referência e proporções.
- [ ] ⬜ Conferir marca d’água configurável e sua prévia.
- [ ] ⬜ Conferir compressão automática de imagem e vídeo no envio e na biblioteca.
- [ ] ⬜ Conferir identificação de comprovante e ação de mover para “Pago”.
- [ ] ⬜ Conferir velocidades 1x/1,5x/2x e pulo de silêncio no player.
- [ ] ⬜ Encerrar conversa de teste e conferir nota/feedback de auditoria da IA.
- [ ] 🟡 Fazer análise/transcrição de mídia manual e conferir o resultado. **Requer:** chave/modelo configurado.

## Parte 6 — Follow-up, distribuição e opt-out

- [ ] ⬜ Configurar sequência de follow-up individual e confirmar que uma resposta do cliente cancela os próximos envios.
- [ ] ⬜ Conferir troca automática de etiqueta após campanha, remarketing ou agendamento.
- [ ] ⬜ Conferir identificação de anúncio CTWA/referral e etiqueta automática.
- [ ] ⬜ Conferir resumo prioritário dos contatos atendidos durante a noite às 08:00.
- [ ] 🟡 Ativar round-robin e conferir distribuição. **Limite:** validar se considera somente atendentes online.
- [ ] ⬜ Conferir validação de conta WhatsApp real dos números importados. **A limpeza de formato não comprova que o número tem WhatsApp.**
- [ ] ⬜ Conferir rotação entre chips, failover e aquecimento.
- [ ] 🟡 Marcar contato manualmente como opt-out e confirmar exclusão de campanhas futuras.
- [ ] ⬜ Enviar uma resposta de teste como “Parar” e conferir aplicação automática da blacklist/etiqueta opt-out.

## Parte 7 — Economia de IA e contexto

- [ ] 🟡 Conferir registro de uso de IA. **Limite:** ainda não há painel completo de economia com chaves individuais.
- [ ] ⬜ Configurar e testar cache semântico; editar/remover uma resposta guardada.
- [ ] 🟡 Fazer uma pergunta que exista no conhecimento aprovado e conferir o contexto recuperado. **Limite:** busca atual é simples, sem índice vetorial e sem garantia dos 2–3 trechos.
- [ ] ⬜ Deixar conversa longa e conferir resumo automático configurável + últimas mensagens.
- [ ] 🟡 Solicitar análise de áudio/imagem e repetir para conferir reutilização de resultado armazenado.
- [ ] ⬜ Usar botão para otimizar regras/prompts e conferir antes/depois.
- [ ] ⬜ Testar roteamento automático entre modelo econômico e modelo de raciocínio.

## Sistemas principais do site

- [ ] ✅ Entrar na conta e conferir o workspace/sessão selecionados.
- [ ] ✅ Conectar WhatsApp e confirmar sincronização de conversas.
- [ ] ✅ Pesquisar, filtrar e abrir conversas na caixa de entrada.
- [ ] ✅ Enviar texto e mídia em conversa de teste.
- [ ] ✅ Usar respostas padrão e confirmar envio pelo fluxo esperado.
- [ ] ✅ Criar/editar contato, etiqueta e dados do cliente.
- [ ] ✅ Criar oportunidade de CRM e conferir etapa/valor.
- [ ] ✅ Criar e simular fluxo sem enviar mensagens reais.
- [ ] ✅ Criar lembrete e conferir a Agenda.
- [ ] ✅ Cadastrar atendente/departamento e testar transferência em conversa de teste.
- [ ] ✅ Alterar a personalização do HUD e conferir no Atendimento.
- [ ] 🟡 Conferir notificações e integrações. **Requer:** serviços e credenciais da conta configurados.
- [ ] 🟡 Conferir site publicado na Vercel e rotas internas após atualizar/recarregar a página.

## Registro do teste

- Data: ____________________
- Navegador/dispositivo: ____________________
- Conversa/sessão de teste usada: ____________________
- Problemas encontrados: ____________________
- Próximo item para testar: ____________________

## Pendências de desenvolvimento identificadas

- [ ] Integrar o Sandbox ao menu e completar a calibração do simulador.
- [ ] Completar os recursos avançados de mídia/auditoria da Parte 5.
- [ ] Implementar follow-up, origem de anúncios, validador, rotação e opt-out automático da Parte 6.
- [ ] Implementar painel de Economia de Tokens e otimizações da Parte 7.
- [ ] Fechar lacunas de exportação multimídia e importação `.xls` da Parte 3.
- [ ] Revisar visual e responsividade manualmente nos dispositivos usados.
- [ ] Enviar a especificação da Parte 8 para incluí-la nesta lista.

> **Segurança:** não use campanhas para clientes reais durante os testes; não execute o reset geral na instalação com dados que deseja manter; guarde backups e chaves em local privado.
