# Noctua CRM — revisão e checklist de testes

**Escopo desta revisão:** comparação estática do código atual com as solicitações das Partes 1 a 7 e com os módulos principais já presentes no site. A Parte 8 ainda não foi enviada.

## Como ler

- **Implementado:** encontrei a função no código. Isso não significa que foi testada em uma sessão real.
- **Parcial:** há uma parte funcional, mas falta requisito, integração ou cobertura.
- **Pendente:** não encontrei implementação correspondente.
- Marque **Teste feito** somente depois de conferir no site. Os quadrinhos começam vazios de propósito.
- Funções que enviam mensagens ou apagam dados devem ser testadas somente em sessão de teste e com dados fictícios.

## Resumo da revisão

- Parte 1: base visual, personalização, command palette, CRM/Kanban e responsividade existem; há diferenças em relação ao reset CSS e à atribuição automática de ROI.
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
| Parcial | CSS global/Tailwind já normaliza parte dos estilos, mas não encontrei o reset explícito completo nem a raiz tipográfica exatamente como especificados. | [ ] |
| Implementado | Personalização de tema, cores, densidade, dimensões/posição do HUD e opções do menu. | [ ] |
| Implementado | Preferências visuais são salvas pelo servidor para a conta; confirme em outro navegador/dispositivo. | [ ] |
| Implementado | Nome do produto permanece fixo como “noctua” na configuração atual. | [ ] |
| Parcial | Gestão/ordenação de etiquetas e renomeação de menus existe; confira cores/ícones e a ordem em filtros e Kanban. | [ ] |
| Implementado | Command Palette com `Ctrl + K`, busca de conversas e campanhas e navegação para áreas do sistema. | [ ] |
| Implementado | CRM com quadro/funil e valores de oportunidade em R$. | [ ] |
| Parcial | Indicadores financeiros existem, mas o retorno por campanha/etiqueta não está totalmente atribuído automaticamente. | [ ] |
| Parcial | Tema premium, animações, estados de hover e toasts existem em parte da interface; consistência visual ainda requer revisão tela a tela. | [ ] |
| Parcial | Há comportamento responsivo/mobile; validar navegação lista → conversa → ferramentas em celular e tablet. | [ ] |

## Parte 2 — Atendimento e HUD

| Estado no código | Recurso | Teste feito |
|---|---|---|
| Implementado | Painel de ferramentas do atendimento, preferências do HUD, ordem e visibilidade dos blocos. | [ ] |
| Implementado | Personalizar Atendimento com prévia e confirmação das alterações. | [ ] |
| Implementado | Lista de conversas com abas/filtros, etiquetas e ordenação por SLA/urgência. | [ ] |
| Implementado | Notas internas em modo privado. | [ ] |
| Implementado | Resumo de conversa em três pontos. | [ ] |
| Implementado | Copiloto para melhorar texto e apoiar objeções, sujeito às credenciais/configuração do provedor de IA. | [ ] |
| Implementado | Atalho `/` para localizar recursos da biblioteca. | [ ] |
| Implementado | Gravação de áudio no compositor, com indicador visual de gravação. | [ ] |
| Implementado | Anexos de áudio, biblioteca e sequências são convertidos para OGG/Opus e enviados como nota de voz PTT; áudio musical deve ser enviado como documento. | [ ] |
| Validado no teste real | Anexo WAV enviado para o número de teste autorizado na conexão Teste: convertido para OGG/Opus, `isPtt=true`, sem erro e com confirmação `READ` do WhatsApp em 25/10/2026. | [x] |
| Pendente de teste real | Conferir também uma gravação feita pelo microfone e os áudios de biblioteca/sequências no dispositivo destinatário. | [ ] |
| Implementado | Ação de transcrever áudio recebida, com resultado exibido na conversa; depende do provedor/modelo configurado. | [ ] |
| Implementado | Presença de “digitando/gravando” em envios diretos e sequências compatíveis. | [ ] |
| Parcial | Mensagens apagadas pelo cliente podem receber indicação, dependendo dos dados/eventos fornecidos pelo WhatsApp. | [ ] |

## Parte 3 — Exportação, Excel, campanhas, agenda, biblioteca e modais

| Estado no código | Recurso | Teste feito |
|---|---|---|
| Parcial | Exportação de histórico em formatos estruturados e opção de incluir mídia; mídias antigas podem não estar mais disponíveis. | [ ] |
| Parcial | Transcrição/descrição de mídia é usada quando já foi gerada e salva; não encontrei pré-processamento automático de todo o histórico antes da exportação. | [ ] |
| Parcial | IA usa conhecimento aprovado e exemplos de conversas; isso é orientação por contexto, não treinamento/fine-tuning de modelo. | [ ] |
| Parcial | Importação de contatos de CSV/Excel com limpeza e prévia; validar cabeçalhos embaralhados, números misturados e comportamento com `.xls` legado. | [ ] |
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
| Implementado | Central de Ajuda reorganizada em quatro guias: Conexões; Autoatendimento e IA; Campanhas/Excel; Atendimento/equipe/atalhos. | [ ] |
| Implementado | Zona de segurança com backup JSON, confirmação em duas etapas e trava digitando `EXCLUIR`. | [ ] |
| Implementado | Reset exige papel administrador e bloqueia quando há sessão conectada ou tarefa de envio ativa. **Não testar apagamento na instalação real.** | [ ] |
| Parcial | O backup inclui cópia do banco e chave de recuperação; guardar o JSON em local privado e validar restauração em cópia separada antes de confiar nele. | [ ] |

## Parte 5 — Gemini, criação visual, mídia e auditoria

| Estado no código | Recurso | Teste feito |
|---|---|---|
| Implementado | Gemini aceita modelo rápido e de raciocínio configuráveis por tarefa; confirme que ambos estão disponíveis na conta. | [ ] |
| Implementado | Gerenciador de chaves Gemini no menu de IA: a principal pode ser substituída/excluída; extras podem ser renomeadas, ter o segredo substituído, ativadas/desativadas, reordenadas e removidas. Segredos cifrados e nunca exibidos. | [ ] |
| Implementado | A troca automática ocorre quando a API informa cota diária esgotada (`PerDay`); limite por minuto, chave inválida ou erro de modelo não fazem rotação. | [ ] |
| Pendente de teste real | Confirmar rotação com dois projetos Gemini distintos e verificar estado/última chave usada; não esgote deliberadamente uma chave de produção para testar. | [ ] |
| Implementado | Histórico do estúdio de IA persistente e separado por conversa/cliente (`client_ai_thread`). | [ ] |
| Implementado | Gerador no atendimento com três modelos de prompt, proporções 1:1/9:16 e referência por arquivo, colagem ou imagem da conversa; requer Gemini com geração de imagem habilitada. | [ ] |
| Parcial | Modelos de marca d’água, PNG, opacidade, posição/mosaico e prévia; envio de imagem aplica a marca. Vídeos e envio direto da imagem gerada ainda não passam pelo mesmo processamento. | [ ] |
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
| Pendente | Consulta silenciosa para provar se números têm WhatsApp ativo. O pré-processamento atual pode normalizar números, mas não confirma conta ativa. | [ ] |
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

1. Complementar o teste de áudio anexado já aprovado com gravação pelo microfone e envios de biblioteca/sequências no dispositivo destinatário.
2. Validar a troca de chave Gemini com dois projetos distintos sem consumir de propósito toda a cota de produção.
3. Fechar as lacunas da Parte 3: planilhas legadas/despadronizadas e exportação multimídia com processamento prévio quando a mídia ainda estiver acessível.
4. Validar a Parte 5 com credenciais/modelos reais; vídeo com marca d’água e envio direto da imagem gerada permanecem parciais.
5. Testar CTWA/referral, virada de turno e opt-out com eventos reais de teste; consulta silenciosa de números e aquecimento/rotação de chips não foram implementados.
6. Conferir a cobertura por módulo da Economia de Tokens; o RAG atual é lexical, não um índice vetorial/embeddings.
7. Revisar escala, mobile e acabamento visual manualmente nos navegadores e dispositivos usados.
8. Receber a especificação da Parte 8 para incluí-la nesta auditoria.

**Nota sobre validação (25/10/2026):** as verificações de tipos do servidor e da interface e suas compilações passaram na revisão anterior. Após restabelecer o controle da aba autenticada, a conexão Teste foi confirmada como conectada. Um áudio sintético de 2 segundos foi anexado pelo atendimento e enviado ao número autorizado: o banco registrou OGG/Opus, `isPtt=true`, nenhum erro e estado `READ` retornado pelo WhatsApp. A evidência visual está em `verification/audio-voice-test-2026-10-25.png`. Os dois testes automatizados específicos de áudio passaram. A suíte anterior carregava a configuração Firebase do site, causando falhas 401; o comando de testes agora usa configuração isolada, sem alterar a autenticação do servidor em uso. Também foi corrigida a expressão de escala do conversor de vídeo; seu teste com clipe MP4 válido passou. A nova execução completa será registrada ao terminar.
