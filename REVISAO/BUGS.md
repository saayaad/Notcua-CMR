# Registro de bugs — revisão

Atualização: 27/10/2026. Nenhum defeito funcional novo confirmado na Fase 1 e nenhuma correção de aplicativo realizada.

| ID | Onde | O que aconteceu | Causa | Correção | Reteste |
|---|---|---|---|---|---|
| AMB-001 | Build inicial no terminal restrito | Vite/esbuild não conseguiu ler diretórios/configuração | Permissão do ambiente, não causa de código comprovada | Nenhuma alteração de código; execução autorizada | npm.cmd run build passou, servidor e interface |
| OBS-001 | Build web | Aviso de pacote principal maior que 500 kB | Tamanho de código informado pelo compilador | Não alterado nesta fase | Compilação final passou em 27/10; avaliar impacto na Fase 2 |

## Relatos históricos a conferir

Os relatos do usuário estão individualizados em REQUISITOS.md (L-05, L-17, L-18, L-19, L-20, L-23 e L-24). Relatórios anteriores dizem que alguns foram corrigidos, mas não ganham status 🔧 nesta revisão sem reteste próprio.
IDs BUG-001 em diante serão atribuídos a defeitos concretos na Fase 2. Não converter observação ambiental em bug do produto.

## BUG-002 — Resumo para de acompanhar conversas longas

Prioridade alta; esforço estimado M. `apps/server/src/modules/operations/ai.service.ts:27–31, 62–70`: a consulta carrega no máximo 60 mensagens, mas a atualização compara o tamanho dessa janela com `covered`. Depois de criar um resumo com `covered=57`, novas mensagens não fazem `60 - 57` atingir o intervalo de 10. Configurar intervalo acima de 60 também impede o primeiro resumo.

Reprodução em 27/10/2026: execução real de `generateSuggestion` com repositório em memória e provedor inteiramente fictício, primeiro com 60 e depois com 90 mensagens. Houve 1 resumo antes e 1 depois, `covered=57`, demonstrando que o resumo ficou parado. Zero chamadas externas; nenhuma leitura de conversa real. Script de diagnóstico ignorado pelo Git: `.npm-cache/audit-ai-economy.mts`.

Correção planejada: avançar por identificador/horário estável das mensagens cobertas, incluindo o resumo anterior e somente o trecho novo; distinguir total da conversa de tamanho da janela. Retestar mais de 100 mensagens, intervalo 100, retomada depois de reiniciar e falha do provedor. Ainda não corrigido nesta fase de auditoria. REQ-433/434.

## BUG-003 — Cache não exige aprovação e pode reutilizar saudação personalizada

Prioridade alta; esforço M. `apps/server/src/modules/operations/ai.service.ts:39–50,109–110`: respostas produzidas pelo modelo são incluídas diretamente em `AI_SEMANTIC_CACHE`, sem aprovação, e a busca não exige estado aprovado ou resposta genérica. O filtro exclui alguns números/valores, mas não nomes. A interface anuncia respostas “aprovadas”.

Reprodução isolada: dois clientes fictícios fizeram a mesma pergunta. A primeira resposta simulada foi “Oi, Joana! Podemos conversar sobre o mascote.”; na segunda conversa o método retornou exatamente essa resposta com `cached=true`, sem chamada ao provedor e sem qualquer etapa de aprovação. Isso demonstra o defeito com dados fictícios; não afirma vazamento ocorrido na operação real.

Correção planejada: separar sugestão e publicação no cache, exigir aprovação explícita, impedir reutilização de dados personalizados e invalidar entradas antigas sem aprovação. Incluir teste de isolamento entre operações e dois clientes com perguntas iguais. A mudança nas regras de publicação/limpeza de entradas antigas será apresentada no lote de correções; nenhum cache real foi alterado. REQ-424/425/442.

## INT-001 — Opções da economia sem integração completa

Prioridade alta; esforço G. Verificação estática: `EconomySettings.tsx:9,60–70` exibe sete sistemas e `operations.routes.ts:956–963` salva todos. No servidor, somente `ai.service.ts` consulta `settings:ai-economy`; seu classificador reconhece `autoReply`, `summaries` e `copilot`. Não há consumidor encontrado para `systems.campaigns`, `training`, `receipts` ou `dailyDigest`. Esses quatro controles não comprovaram o efeito prometido. Não é evidência de que as funções de campanha/treinamento em si não existam. REQ-419–422.

## LAC-001 — Busca vetorial e métricas diárias ainda não entregues como solicitadas

`ai.service.ts:8–17,79–92` usa tokens de palavras, sinônimos e interseção lexical; não foi localizado código de embeddings/índice vetorial em `apps/server/src` ou `apps/web/src`. REQ-430 ausente; REQ-425 parcial. `operations.routes.ts:949–954` calcula acumulado do mês, e `EconomySettings.tsx:55–58` mostra somente esse acumulado, sem visão diária; REQ-423 parcial. Não ativar serviço pago para preencher a lacuna sem autorização.


## BUG-001 — Salvamento silencioso de preferências

Arquivo: apps/web/src/context/PreferencesContext.tsx:245. O PUT automático descarta a falha com catch vazio. Na cópia fictícia, nome de menu com 31.000 caracteres foi recusado pela API (413, Configuração muito grande); o banco manteve Campanhas QA e o recarregamento recuperou esse valor. A edição local não foi persistida. Não corrigido ainda: respeitar o plano da Fase 3. É necessário apresentar falha, preservar rascunho e limitar a entrada de maneira clara.

