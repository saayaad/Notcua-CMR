# Noctua CRM — revisão e checklist de testes

**Escopo desta revisão:** comparação estática do código atual com as solicitações das Partes 1 a 7 e com os módulos principais já presentes no site. A Parte 8 ainda não foi enviada.

## Como ler

- **Implementado:** encontrei a função no código. Isso não significa que foi testada em uma sessão real.
- **Parcial:** há uma parte funcional, mas falta requisito, integração ou cobertura.
- **Pendente:** não encontrei implementação correspondente.
- Marque **Teste feito** somente depois de conferir no site. Os quadrinhos começam vazios de propósito.
- Funções que enviam mensagens ou apagam dados devem ser testadas somente em sessão de teste e com dados fictícios.

> **Atualização de 26/10/2026:** nenhum novo envio real enquanto o usuário descansa. Catálogo Gemini consultado com sucesso, mas geração recusada com HTTP 403: nível gratuito indisponível para o projeto. Nenhum faturamento foi ativado. As caixas de teste pessoal continuam separadas do relatório de verificações executadas.

## Resumo da revisão

- Parte 1: base visual, reset explícito, personalização, command palette, CRM/Kanban e responsividade existem; atribuição automática de ROI e validação entre navegadores seguem parciais.
- Parte 2: HUD, ferramentas, respostas, notas internas, Copiloto, gravação, transcrição e alertas de conversa existem em boa parte. Alguns comportamentos precisam de validação real.
- Parte 3: biblioteca, exportação, campanhas, agenda e modais principais existem; exportação multimídia e alguns formatos/automatizações são parciais.
- Parte 4: simulador, Sandbox integrado ao menu, quatro guias da Central de Ajuda e zona de segurança estão no código; calibração e isolamento ainda precisam de teste manual.
- Parte 5: estúdio de IA por cliente, geração de imagem, player turbo, marcas d’água para imagens, compressão no upload, análise de comprovantes e auditoria ao encerrar estão implementados em parte; dependem de modelos/credenciais e testes reais. Gemini tem seleção separada de modelo rápido, raciocínio e imagem.
- Parte 6: follow-up, troca de etiquetas, captura de origem de anúncios, resumo de turno, round-robin e opt-out estão implementados; faltam validações de formatos reais e alguns recursos não foram incluídos.
- Parte 7: painel de economia, cache lexical restrito, RAG lexical, resumo de contexto, otimização de prompt, roteamento simples/profundo e rotação de chaves Gemini estão no código; faltam cobertura vetorial e validação de consumo/quotas em provedores reais.
- **Parte 8:** especificação não recebida.

---

## Parte 1 — Estrutura global, personalização e CRM

| Estado no código | Recurso | Teste feito |
|---|---|---|
| Parcial | App shell usa `100vw`, `100dvh`, flex e colunas fluidas; ainda há larguras e espaçamentos fixos em alguns pontos. | [ ] |
| Implementado | Reset explícito em styles.css: box-sizing/margens/padding, raiz de 16px, text-size-adjust e suavização de fonte. Compatibilidade visual ainda exige conferência nos navegadores. | [ ] |
| Implementado | Personalização de tema, cores, densidade, dimensões/posição do HUD e opções do menu. | [ ] |
| Implementado | Preferências visuais são salvas pelo servidor para a conta; confirme em outro navegador/dispositivo. | [ ] |
| Implementado | Nome do produto permanece fixo como “noctua” na configuração atual. | [ ] |
| Parcial | Gestão/ordenação de etiquetas e renomeação de menus existe; confira cores/ícones e a ordem em filtros e Kanban. | [ ] |
| Implementado | Command Palette com `Ctrl + K`, busca de conversas e campanhas e navegação para áreas do sistema. | [ ] |
| Implementado | CRM com quadro/funil e valores de oportunidade em R$. | [ ] |
| Parcial | Campanhas usam receita manual ou vendas ganhas vinculadas no CRM, sem dupla atribuição, com recálculo e resumo na Visão Geral. Investimento é informado; não representa lucro líquido. Receita/ROI por etiqueta ainda é parcial. | [ ] |
| Parcial | Tema premium, animações, estados de hover e toasts existem em parte da interface; consistência visual ainda requer revisão tela a tela. | [ ] |
| Parcial | Há comportamento responsivo/mobile; validar navegação lista → conversa → ferramentas em celular e tablet. | [ ] |

## Parte 2 — Atendimento e HUD

| Estado no código | Recurso | Teste feito |
|---|---|---|
| Implementado | Painel de ferramentas do atendimento, preferências do HUD, ordem e visibilidade dos blocos. | [ ] |
| Implementado | Personalizar Atendimento com prévia em todas as abas, botão Ampliar prévia, controles compactos e confirmação das alterações. | [ ] |
| Implementado | Lista de conversas com abas/filtros, etiquetas e ordenação por SLA/urgência. | [ ] |
| Implementado | Notas internas em modo privado. | [ ] |
| Implementado | Resumo de conversa em três pontos. | [ ] |
| Implementado | Copiloto para melhorar texto e apoiar objeções, sujeito às credenciais/configuração do provedor de IA. | [ ] |
| Implementado | Atalho `/` para localizar recursos da biblioteca. | [ ] |
| Implementado | Gravação de áudio no compositor, com indicador visual de gravação. | [ ] |
| Implementado | Anexos de áudio, biblioteca e sequências são convertidos para OGG/Opus e enviados como nota de voz PTT; áudio musical deve ser enviado como documento. | [ ] |
| Validado no teste real | Anexo WAV enviado para o número de teste autorizado na conexão Teste: convertido para OGG/Opus, `isPtt=true`, sem erro e com confirmação `READ` do WhatsApp em 25/10/2026. | [x] |
| Pendente de teste real | Conferir aparência do balão no dispositivo destinatário; gravação pelo microfone entregue como PTT em 26/10, biblioteca/funil já tiveram envio confirmado como lido. | [ ] |
| Implementado | Ação de transcrever áudio recebida, com resultado exibido na conversa; depende do provedor/modelo configurado. | [ ] |
| Implementado | Presença de “digitando/gravando” em envios diretos e sequências compatíveis. | [ ] |
| Parcial | Mensagens apagadas pelo cliente podem receber indicação, dependendo dos dados/eventos fornecidos pelo WhatsApp. | [ ] |

## Parte 3 — Exportação, Excel, campanhas, agenda, biblioteca e modais

| Estado no código | Recurso | Teste feito |
|---|---|---|
| Parcial | Exportação de histórico em formatos estruturados e opção de incluir mídia; mídias antigas podem não estar mais disponíveis. | [ ] |
| Parcial | Pré-processamento antes de exportar percorre mídias com autorização explícita, progresso, cancelamento, cache e avisos. Interrompe em recusa do provedor. Validado com IA simulada; geração real depende de projeto disponível. | [ ] |
| Parcial | IA usa conhecimento aprovado e exemplos de conversas; isso é orientação por contexto, não treinamento/fine-tuning de modelo. | [ ] |
| Parcial | Importação CSV/XLSX com limpeza e prévia. Testados título antes do cabeçalho, colunas trocadas, duplicatas, CSV com ponto e vírgula e nome entre aspas. Linhas ignoradas mantêm o número original; planilha vazia tem erro claro. XLS binário legado validado, incluindo acentos, telefone numérico e linha original da duplicata. | [ ] |
| Implementado | Campanhas com listas/etiquetas, inatividade, conteúdo, intervalos/pausas, prévia e monitoramento. | [ ] |
| Parcial | Intervalos variáveis ajudam a espaçar envios, mas não garantem prevenção de bloqueios. | [ ] |
| Implementado | Agenda com busca/autocomplete de contato e criação de lembretes/envios agendados. | [ ] |
| Implementado | Biblioteca com categorias e recursos de texto, áudio, mídia, documento, funil/fluxo e operações de gestão. | [ ] |
| Implementado | Modais de transferência, mensagens fixadas e conexão de sessão/QR disponíveis no fluxo da aplicação. | [ ] |
| Parcial | Testar no WhatsApp de teste seleção do responsável, nota interna, categorias de fixados e ciclo conectar/desconectar QR. | [ ] |

## Parte 4 — Simulador, Sandbox, ajuda e reset seguro

| Estado no código | Recurso | Teste feito |
|---|---|---|
| Parcial | Simulador de fluxo e conversa com IA; agora mostra quais fontes de contexto foram enviadas e permite salvar uma resposta corrigida como exemplo aprovado. Não mostra raciocínio interno do modelo. | [ ] |
| Implementado | Espaço de Teste integrado ao menu, com dados fictícios locais, recursos, conversas, CRM de exemplo, agenda, campanhas simuladas, equipe e fluxo virtual. | [ ] |
| Parcial | O Sandbox tem conversas, cenários e controles fictícios; não valida automaticamente todas as funções reais do sistema. | [ ] |
| Implementado | Central de Ajuda acessível pelo botão corrigido do menu e organizada em quatro guias: Conexões; Autoatendimento e IA; Campanhas/Excel; Atendimento/equipe/atalhos. | [ ] |
| Implementado | Zona de segurança com backup JSON, confirmação em duas etapas e trava digitando `EXCLUIR`. | [ ] |
| Implementado | Reset exige papel administrador e bloqueia quando há sessão conectada ou tarefa de envio ativa. **Não testar apagamento na instalação real.** | [ ] |
| Parcial | O backup inclui cópia do banco e chave de recuperação; guardar o JSON em local privado e validar restauração em cópia separada antes de confiar nele. | [ ] |

## Parte 5 — Gemini, criação visual, mídia e auditoria

| Estado no código | Recurso | Teste feito |
|---|---|---|
| Implementado | Gemini aceita modelos rápido e de raciocínio por tarefa; botão Consultar modelos disponíveis usa catálogo paginado da API e rejeita número de projeto como modelo. Geração real bloqueada por HTTP 403 no projeto atual. | [ ] |
| Implementado | Gerenciador de chaves Gemini no menu de IA: a principal pode ser substituída/excluída; extras podem ser renomeadas, ter o segredo substituído, ativadas/desativadas, reordenadas e removidas. Segredos cifrados e nunca exibidos. | [ ] |
| Implementado | A troca automática ocorre quando a API informa cota diária esgotada (`PerDay`); limite por minuto, chave inválida ou erro de modelo não fazem rotação. | [ ] |
| Pendente de teste real | Confirmar rotação com dois projetos Gemini distintos e verificar estado/última chave usada; não esgote deliberadamente uma chave de produção para testar. | [ ] |
| Implementado | Histórico do estúdio de IA persistente e separado por conversa/cliente (`client_ai_thread`). | [ ] |
| Implementado | Gerador no atendimento com três modelos de prompt, proporções 1:1/9:16 e referência por arquivo, colagem ou imagem da conversa; requer Gemini com geração de imagem habilitada. | [ ] |
| Parcial | Modelos de marca d’água com PNG/texto, tamanho, opacidade, posição/mosaico e prévia Canvas. Imagens e vídeos anexados recebem a marca; falha bloqueia o envio. Vídeo validado por pixels em teste isolado. Imagem do estúdio pode ser preparada como anexo com revisão, legenda e marca; validação com geração real ainda bloqueada pelo provedor. | [ ] |
| Implementado | Upload de imagens e vídeos pela conversa e biblioteca passa pelo otimizador FFmpeg do servidor; imagens também são otimizadas no compositor. Se a otimização não reduzir o tamanho, o original é mantido. | [ ] |
| Parcial | Imagens/PDFs podem retornar candidato com valor/data/pagador. A confirmação exige ação humana, marca oportunidade como ganha e aplica etiqueta com “pago” no nome se existir. Exige provedor/modelo visual compatível. | [ ] |
| Implementado | Player de áudio com 1x/1,5x/2x e opção de pular pausas longas, depende do suporte de áudio do navegador. | [ ] |
| Implementado | Ao encerrar conversa, tenta salvar nota de 0–10 e feedback de IA; depende de IA ativa, credencial e conversa com histórico. | [ ] |
| Parcial | Análise/transcrição sob demanda e processamento automático de mídia pela IA ativa; PDFs são aceitos com Gemini. Confirmar tipos e disponibilidade de mídia na sessão real. | [ ] |

## Parte 6 — Follow-up, distribuição, anúncios e proteção de envios

| Estado no código | Recurso | Teste feito |
|---|---|---|
| Implementado | Follow-up individual de até 5 mensagens de texto, cancelado imediatamente ao receber resposta e novamente conferido antes do envio. | [ ] |
| Implementado | Campanha/agendamento pode remover uma etiqueta e aplicar outra depois do envio final, com mensagens/mídias em sequência. | [ ] |
| Parcial | Captura de metadados CTWA/referral, cartão de origem na conversa e aplica etiqueta existente com “anúncio” no nome. Testar formatos reais de anúncio e miniatura não disponível em todas as versões Baileys. | [ ] |
| Parcial | Resumo prioritário heurístico às 08:00 com contatos noturnos aguardando retorno ou menções de intenção de compra; não usa IA e precisa validar fuso horário e qualidade dos sinais. | [ ] |
| Implementado | Rodízio entre atendentes ativos e com presença online recente (até 90 segundos). | [ ] |
| Implementado | Consulta sem envio disponível antes da importação/campanha: conta encontrada, não encontrada ou inconclusiva. Cache por conexão e remoção explícita da prévia; não comprova presença online ou consentimento. | [ ] |
| Pendente | Rotação de múltiplos chips e aquecimento em conversas artificiais não foram adicionados. Não automatizo conversas falsas nem mecanismos para contornar os controles antispam do WhatsApp. | [ ] |
| Implementado | Regras configuráveis de opt-out; ao receber termo no começo da mensagem ou frase configurada, marca contato, aplica etiqueta compatível e cancela envios futuros. | [ ] |

## Parte 7 — Economia de IA e contexto

| Estado no código | Recurso | Teste feito |
|---|---|---|
| Parcial | Aba “Economia de Tokens”, controles globais e por sistema, estimativa de tokens/chamadas poupados e estimativa de uso; validar quais módulos usam cada controle. | [ ] |
| Parcial | Cache local com similaridade lexical/sinônimos, validade configurável, edição e limpeza; limitado a respostas automáticas de texto sem valores/números. Não usa embeddings vetoriais. | [ ] |
| Parcial | Busca lexical recupera até três trechos curtos da base aprovada e três exemplos; não há indexador vetorial. | [ ] |
| Implementado | Resumo periódico ajustável; ao responder, usa resumo salvo e últimas três mensagens. Se a síntese falha, recua para as dez mensagens recentes. | [ ] |
| Implementado | Com IA e análise de mídia autorizadas, mensagens novas são transcritas/descritas e ficam salvas; PDFs via Gemini. Alguns formatos precisam ser validados na conexão real. | [ ] |
| Implementado | Otimizador de regras com prévia e aplicação explícita, e seleção rápida/profunda por tarefa usando os modelos configurados. O provedor precisa suportar ambos os identificadores. | [ ] |

## Sistemas gerais presentes no site

| Estado no código | Sistema | Teste feito |
|---|---|---|
| Implementado | Acesso por conta e separação de sessão/workspace. | [ ] |
| Implementado | Conexões WhatsApp e leitura de QR Code. | [ ] |
| Implementado | Caixa de entrada: lista, pesquisa, filtros e seleção de conversa. | [ ] |
| Implementado | Envio de texto/mídia, respostas padrão, biblioteca e notas internas. | [ ] |
| Implementado | Contatos, etiquetas, campos de cliente e oportunidades/CRM. | [ ] |
| Implementado | Campanhas, listas importadas, agendamentos e fluxos. | [ ] |
| Implementado | Equipe, departamentos e transferência de atendimento. | [ ] |
| Implementado | Personalização visual e de HUD. | [ ] |
| Implementado | Backup operacional e configurações de acesso. | [ ] |
| Parcial | Notificações, integrações e dependências de serviços externos precisam de credenciais e validação na conta real. | [ ] |

## Roteiro de teste sugerido

1. **Aparência:** testar computador e celular, zoom do navegador, tema claro/escuro e salvar preferências.
2. **Atendimento:** selecionar conversa fictícia, pesquisar, usar etiqueta, nota privada, resumo, Copiloto, `/`, gravação e transcrição.
3. **Biblioteca:** criar texto e mídia de teste, atribuir categoria, favoritar, localizar pelo atalho e abrir prévia.
4. **CRM e agenda:** importar uma planilha pequena, revisar contatos, atribuir etiqueta/valor, criar lembrete e conferir autocomplete.
5. **Campanha:** usar lista de teste, conferir público e conteúdo, salvar rascunho e verificar monitor. Não disparar para clientes sem autorização e revisão.
6. **Fluxos e IA:** simular fluxo, testar respostas com dados fictícios e validar transbordo humano antes de habilitar no atendimento real.
7. **Sandbox:** abrir a página já integrada ao menu e confirmar que os dados fictícios permanecem separados dos dados reais.
8. **Backup:** gerar JSON e verificar download; testar recuperação apenas numa cópia separada. Nunca clicar em reset no ambiente com dados que deseja manter.
9. **Serviços externos:** validar Firebase, provedor de IA, Vercel e WhatsApp em suas contas, pois o código não substitui configuração nem credenciais válidas.

## Pendências que precisam de prioridade antes de chamar de pronto

1. Complementar os envios de voz anexada e de biblioteca/funil já lidos com gravação pelo microfone e conferência visual no dispositivo destinatário.
2. Validar a troca de chave Gemini com dois projetos distintos sem consumir de propósito toda a cota de produção.
3. Fechar as lacunas da Parte 3: geração real das análises de mídia do exportador, após disponibilizar o projeto Gemini. XLS legado e preparação sequencial já foram implementados e testados.
4. Validar a Parte 5 com credenciais/modelos reais; vídeo com marca d’água e envio direto da imagem gerada permanecem parciais.
5. Testar CTWA/referral, virada de turno e opt-out com eventos reais de teste; consulta silenciosa de números e aquecimento/rotação de chips não foram implementados.
6. Conferir a cobertura por módulo da Economia de Tokens; o RAG atual é lexical, não um índice vetorial/embeddings.
7. Revisar escala, mobile e acabamento visual manualmente nos navegadores e dispositivos usados.
8. Receber a especificação da Parte 8 para incluí-la nesta auditoria.

**Nota sobre validação (25/10/2026):** as verificações de tipos do servidor e da interface e suas compilações passaram na revisão anterior. Após restabelecer o controle da aba autenticada, a conexão Teste foi confirmada como conectada. Um áudio sintético de 2 segundos foi anexado pelo atendimento e enviado ao número autorizado: o banco registrou OGG/Opus, `isPtt=true`, nenhum erro e estado `READ` retornado pelo WhatsApp. A evidência visual está em `verification/audio-voice-test-2026-10-25.png`. Os dois testes automatizados específicos de áudio passaram. A suíte anterior carregava a configuração Firebase do site, causando falhas 401; o comando de testes agora usa configuração isolada, sem alterar a autenticação do servidor em uso. Também foi corrigida a expressão de escala do conversor de vídeo; seu teste com clipe MP4 válido passou. A execução completa mais recente passou com 110 testes e nenhuma falha. Também foram confirmados envios reais de texto, imagem, vídeo, documento, voz por biblioteca/funil, macro, resposta padrão, campanha, agenda, lembrete privado e cancelamento automático de follow-up: a resposta recebida às 22h15min11s cancelou o retorno das 22h21min51s antes de qualquer envio. Consulte o relatório em verification/relatorio-testes-2026-10-25.md para distinguir as confirmações das pendências.

Revisão de 26/10/2026: [relatório atualizado, resultados e bloqueios](verification/relatorio-revisao-2026-10-26.md). Suíte completa com 126 testes aprovados, nenhuma falha; etapa XLS e pré-processamento concluída no código e em testes isolados. Após nova autorização, texto e gravação pelo microfone entregues somente ao contato de teste; conferência visual do balão no telefone solicitada.
