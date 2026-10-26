# Noctua — meu checklist de revisão

Atualizado em 26/10/2026. Importe este Markdown no Notion para transformar os itens em caixas marcáveis. As caixas abaixo são para a SUA revisão; os testes já executados estão no relatório de verificação.

✅ Encontrado no código · 🟡 Parcial · ⬜ Não implementado · 🔌 Depende de serviço/configuração externa. Implementação não significa aprovação visual.

**Antes dos testes de IA:** o Google recusou a geração com HTTP 403: nível gratuito indisponível neste projeto. A chave consulta modelos, mas isso não comprova cota de geração. Nenhum faturamento foi ativado.
**Envios reais:** texto e áudio autorizados novamente somente para o contato de teste. Não envie para outros clientes durante a revisão.

## Parte 1 — Estrutura global, personalização e CRM

- [ ] 🟡 App shell usa `100vw`, `100dvh`, flex e colunas fluidas; ainda há larguras e espaçamentos fixos em alguns pontos.
- [ ] ✅ Reset explícito em styles.css: box-sizing/margens/padding, raiz de 16px, text-size-adjust e suavização de fonte. Compatibilidade visual ainda exige conferência nos navegadores.
- [ ] ✅ Personalização de tema, cores, densidade, dimensões/posição do HUD e opções do menu.
- [ ] ✅ Preferências visuais são salvas pelo servidor para a conta; confirme em outro navegador/dispositivo.
- [ ] ✅ Nome do produto permanece fixo como “noctua” na configuração atual.
- [ ] 🟡 Gestão/ordenação de etiquetas e renomeação de menus existe; confira cores/ícones e a ordem em filtros e Kanban.
- [ ] ✅ Command Palette com `Ctrl + K`, busca de conversas e campanhas e navegação para áreas do sistema.
- [ ] ✅ CRM com quadro/funil e valores de oportunidade em R$.
- [ ] 🟡 Campanhas usam receita manual ou vendas ganhas vinculadas no CRM, sem dupla atribuição, com recálculo e resumo na Visão Geral. Investimento é informado; não representa lucro líquido. Receita/ROI por etiqueta ainda é parcial.
- [ ] 🟡 Tema premium, animações, estados de hover e toasts existem em parte da interface; consistência visual ainda requer revisão tela a tela.
- [ ] 🟡 Há comportamento responsivo/mobile; validar navegação lista → conversa → ferramentas em celular e tablet.
## Parte 2 — Atendimento e HUD

- [ ] ✅ Painel de ferramentas do atendimento, preferências do HUD, ordem e visibilidade dos blocos.
- [ ] ✅ Personalizar Atendimento com prévia em todas as abas, botão Ampliar prévia, controles compactos e confirmação das alterações.
- [ ] ✅ Lista de conversas com abas/filtros, etiquetas e ordenação por SLA/urgência.
- [ ] ✅ Notas internas em modo privado.
- [ ] ✅ Resumo de conversa em três pontos.
- [ ] ✅ Copiloto para melhorar texto e apoiar objeções, sujeito às credenciais/configuração do provedor de IA.
- [ ] ✅ Atalho `/` para localizar recursos da biblioteca.
- [ ] ✅ Gravação de áudio no compositor, com indicador visual de gravação.
- [ ] ✅ Anexos de áudio, biblioteca e sequências são convertidos para OGG/Opus e enviados como nota de voz PTT; áudio musical deve ser enviado como documento.
- [ ] ✅ Anexo WAV enviado para o número de teste autorizado na conexão Teste: convertido para OGG/Opus, `isPtt=true`, sem erro e com confirmação `READ` do WhatsApp em 25/10/2026.
- [ ] 🔌 Conferir aparência do balão no dispositivo destinatário; gravação pelo microfone entregue como PTT em 26/10, biblioteca/funil já tiveram envio confirmado como lido.
- [ ] ✅ Ação de transcrever áudio recebida, com resultado exibido na conversa; depende do provedor/modelo configurado.
- [ ] ✅ Presença de “digitando/gravando” em envios diretos e sequências compatíveis.
- [ ] 🟡 Mensagens apagadas pelo cliente podem receber indicação, dependendo dos dados/eventos fornecidos pelo WhatsApp.
## Parte 3 — Exportação, Excel, campanhas, agenda, biblioteca e modais

- [ ] 🟡 Exportação de histórico em formatos estruturados e opção de incluir mídia; mídias antigas podem não estar mais disponíveis.
- [ ] 🟡 Pré-processamento antes de exportar percorre mídias com autorização explícita, progresso, cancelamento, cache e avisos. Interrompe em recusa do provedor. Validado com IA simulada; geração real depende de projeto disponível.
- [ ] 🟡 IA usa conhecimento aprovado e exemplos de conversas; isso é orientação por contexto, não treinamento/fine-tuning de modelo.
- [ ] 🟡 Importação CSV/XLSX com limpeza e prévia. Testados título antes do cabeçalho, colunas trocadas, duplicatas, CSV com ponto e vírgula e nome entre aspas. Linhas ignoradas mantêm o número original; planilha vazia tem erro claro. XLS binário legado validado, incluindo acentos, telefone numérico e linha original da duplicata.
- [ ] ✅ Campanhas com listas/etiquetas, inatividade, conteúdo, intervalos/pausas, prévia e monitoramento.
- [ ] 🟡 Intervalos variáveis ajudam a espaçar envios, mas não garantem prevenção de bloqueios.
- [ ] ✅ Agenda com busca/autocomplete de contato e criação de lembretes/envios agendados.
- [ ] ✅ Biblioteca com categorias e recursos de texto, áudio, mídia, documento, funil/fluxo e operações de gestão.
- [ ] ✅ Modais de transferência, mensagens fixadas e conexão de sessão/QR disponíveis no fluxo da aplicação.
- [ ] 🟡 Testar no WhatsApp de teste seleção do responsável, nota interna, categorias de fixados e ciclo conectar/desconectar QR.
## Parte 4 — Simulador, Sandbox, ajuda e reset seguro

- [ ] 🟡 Simulador de fluxo e conversa com IA; agora mostra quais fontes de contexto foram enviadas e permite salvar uma resposta corrigida como exemplo aprovado. Não mostra raciocínio interno do modelo.
- [ ] ✅ Espaço de Teste integrado ao menu, com dados fictícios locais, recursos, conversas, CRM de exemplo, agenda, campanhas simuladas, equipe e fluxo virtual.
- [ ] 🟡 O Sandbox tem conversas, cenários e controles fictícios; não valida automaticamente todas as funções reais do sistema.
- [ ] ✅ Central de Ajuda acessível pelo botão corrigido do menu e organizada em quatro guias: Conexões; Autoatendimento e IA; Campanhas/Excel; Atendimento/equipe/atalhos.
- [ ] ✅ Zona de segurança com backup JSON, confirmação em duas etapas e trava digitando `EXCLUIR`.
- [ ] ✅ Reset exige papel administrador e bloqueia quando há sessão conectada ou tarefa de envio ativa. **Não testar apagamento na instalação real.**
- [ ] 🟡 O backup inclui cópia do banco e chave de recuperação; guardar o JSON em local privado e validar restauração em cópia separada antes de confiar nele.
## Parte 5 — Gemini, criação visual, mídia e auditoria

- [ ] ✅ Gemini aceita modelos rápido e de raciocínio por tarefa; botão Consultar modelos disponíveis usa catálogo paginado da API e rejeita número de projeto como modelo. Geração real bloqueada por HTTP 403 no projeto atual.
- [ ] ✅ Gerenciador de chaves Gemini no menu de IA: a principal pode ser substituída/excluída; extras podem ser renomeadas, ter o segredo substituído, ativadas/desativadas, reordenadas e removidas. Segredos cifrados e nunca exibidos.
- [ ] ✅ A troca automática ocorre quando a API informa cota diária esgotada (`PerDay`); limite por minuto, chave inválida ou erro de modelo não fazem rotação.
- [ ] 🔌 Confirmar rotação com dois projetos Gemini distintos e verificar estado/última chave usada; não esgote deliberadamente uma chave de produção para testar.
- [ ] ✅ Histórico do estúdio de IA persistente e separado por conversa/cliente (`client_ai_thread`).
- [ ] ✅ Gerador no atendimento com três modelos de prompt, proporções 1:1/9:16 e referência por arquivo, colagem ou imagem da conversa; requer Gemini com geração de imagem habilitada.
- [ ] 🟡 Modelos de marca d’água com PNG/texto, tamanho, opacidade, posição/mosaico e prévia Canvas. Imagens e vídeos anexados recebem a marca; falha bloqueia o envio. Vídeo validado por pixels em teste isolado. Imagem do estúdio pode ser preparada como anexo com revisão, legenda e marca; validação com geração real ainda bloqueada pelo provedor.
- [ ] ✅ Upload de imagens e vídeos pela conversa e biblioteca passa pelo otimizador FFmpeg do servidor; imagens também são otimizadas no compositor. Se a otimização não reduzir o tamanho, o original é mantido.
- [ ] 🟡 Imagens/PDFs podem retornar candidato com valor/data/pagador. A confirmação exige ação humana, marca oportunidade como ganha e aplica etiqueta com “pago” no nome se existir. Exige provedor/modelo visual compatível.
- [ ] ✅ Player de áudio com 1x/1,5x/2x e opção de pular pausas longas, depende do suporte de áudio do navegador.
- [ ] ✅ Ao encerrar conversa, tenta salvar nota de 0–10 e feedback de IA; depende de IA ativa, credencial e conversa com histórico.
- [ ] 🟡 Análise/transcrição sob demanda e processamento automático de mídia pela IA ativa; PDFs são aceitos com Gemini. Confirmar tipos e disponibilidade de mídia na sessão real.
## Parte 6 — Follow-up, distribuição, anúncios e proteção de envios

- [ ] ✅ Follow-up individual de até 5 mensagens de texto, cancelado imediatamente ao receber resposta e novamente conferido antes do envio.
- [ ] ✅ Campanha/agendamento pode remover uma etiqueta e aplicar outra depois do envio final, com mensagens/mídias em sequência.
- [ ] 🟡 Captura de metadados CTWA/referral, cartão de origem na conversa e aplica etiqueta existente com “anúncio” no nome. Testar formatos reais de anúncio e miniatura não disponível em todas as versões Baileys.
- [ ] 🟡 Resumo prioritário heurístico às 08:00 com contatos noturnos aguardando retorno ou menções de intenção de compra; não usa IA e precisa validar fuso horário e qualidade dos sinais.
- [ ] ✅ Rodízio entre atendentes ativos e com presença online recente (até 90 segundos).
- [ ] ✅ Consulta sem envio disponível antes da importação/campanha: conta encontrada, não encontrada ou inconclusiva. Cache por conexão e remoção explícita da prévia; não comprova presença online ou consentimento.
- [ ] ⬜ Rotação de múltiplos chips e aquecimento em conversas artificiais não foram adicionados. Não automatizo conversas falsas nem mecanismos para contornar os controles antispam do WhatsApp.
- [ ] ✅ Regras configuráveis de opt-out; ao receber termo no começo da mensagem ou frase configurada, marca contato, aplica etiqueta compatível e cancela envios futuros.
## Parte 7 — Economia de IA e contexto

- [ ] 🟡 Aba “Economia de Tokens”, controles globais e por sistema, estimativa de tokens/chamadas poupados e estimativa de uso; validar quais módulos usam cada controle.
- [ ] 🟡 Cache local com similaridade lexical/sinônimos, validade configurável, edição e limpeza; limitado a respostas automáticas de texto sem valores/números. Não usa embeddings vetoriais.
- [ ] 🟡 Busca lexical recupera até três trechos curtos da base aprovada e três exemplos; não há indexador vetorial.
- [ ] ✅ Resumo periódico ajustável; ao responder, usa resumo salvo e últimas três mensagens. Se a síntese falha, recua para as dez mensagens recentes.
- [ ] ✅ Com IA e análise de mídia autorizadas, mensagens novas são transcritas/descritas e ficam salvas; PDFs via Gemini. Alguns formatos precisam ser validados na conexão real.
- [ ] ✅ Otimizador de regras com prévia e aplicação explícita, e seleção rápida/profunda por tarefa usando os modelos configurados. O provedor precisa suportar ambos os identificadores.
## Sistemas gerais presentes no site

- [ ] ✅ Acesso por conta e separação de sessão/workspace.
- [ ] ✅ Conexões WhatsApp e leitura de QR Code.
- [ ] ✅ Caixa de entrada: lista, pesquisa, filtros e seleção de conversa.
- [ ] ✅ Envio de texto/mídia, respostas padrão, biblioteca e notas internas.
- [ ] ✅ Contatos, etiquetas, campos de cliente e oportunidades/CRM.
- [ ] ✅ Campanhas, listas importadas, agendamentos e fluxos.
- [ ] ✅ Equipe, departamentos e transferência de atendimento.
- [ ] ✅ Personalização visual e de HUD.
- [ ] ✅ Backup operacional e configurações de acesso.
- [ ] 🟡 Notificações, integrações e dependências de serviços externos precisam de credenciais e validação na conta real.

## Aprovação final

- [ ] Conferi minhas preferências e o HUD no computador.
- [ ] Conferi no celular e em outro navegador.
- [ ] Resolvi a disponibilidade do projeto Gemini e testei o simulador.
- [ ] Revisei as limitações e pendências, sem considerar tudo pronto apenas por compilar.
- [ ] Confirmei backup e restauração em uma cópia descartável; não resetei a instalação real.
- [ ] Enviei a especificação da Parte 8, se ela ainda fizer parte do projeto.

Revisão de 26/10/2026: [relatório atualizado, resultados e bloqueios](verification/relatorio-revisao-2026-10-26.md). Suíte completa com 126 testes aprovados, nenhuma falha; etapa XLS e pré-processamento concluída no código e em testes isolados. Após nova autorização, texto e gravação pelo microfone entregues somente ao contato de teste; conferência visual do balão no telefone solicitada.
