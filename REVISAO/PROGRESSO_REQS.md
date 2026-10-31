
## Mensagens — lote REQ-236–268 — 30/10/2026

- Fechadas 29 REQs que estavam parciais: 19 `COMPLETO` e 10 `COMPLETO-LOCAL`; os itens já completos/cancelados foram preservados.
- Playwright em Chromium: 18 verificações de mensagens (3 viewports), 9 verificações de mídia (3 viewports) e 9 verificações de IA simulada (3 viewports) aprovadas. Os testes da IA interceptam somente endpoints locais; nenhuma chave/provedor real foi usada.
- Servidor: suíte `attendance.test.ts` + `whatsapp.test.ts` aprovou 40/40 no lote. REQ-263/264 verificaram sinais composing/recording com socket fictício; REQ-265 comparou duração curta/longa; REQ-267 confirmou cópia dos bytes antes do tombstone em SQLite temporário.
- Bugs corrigidos: BUG-017 (atalho flutuante animado), BUG-018 (resumo acessível no celular), BUG-019 (arquivamento da mídia ao receber exclusão). Correções anotadas em `REVISAO/BUGS.md`.
- Falhas e correções nesta sequência: (1) limite SLA incompatível com a fixture (ajustada fixture/limites e restaurada preferência); (2) seletor do HUD genérico (seletor passou a usar `title`); (3) ações de arquivo no mobile escondidas (teste abre menu de ações); (4) caixa de resumo genérica (seletor de textarea específico); (5) resumo indisponível no mobile (corrigido UI); (6) legenda acessível do HUD divergia entre `title` e `aria-label` sem prejuízo funcional (assertiva passou a exigir ambos presentes); (7) processos integrais concorrentes/sem saída retida atrasaram a captura dos resultados — um caso de transferências passou isolado 3/3 e a suíte integral foi iniciada novamente sequencialmente.
- Evidências de viewport em `REVISAO/evidencias/REQ-236/`–`REQ-268/`; testes em `e2e/messages.spec.ts`, `e2e/messages-ai.spec.ts`, `e2e/messages-media.spec.ts` e `apps/server/test/attendance.test.ts`, `whatsapp.test.ts`.
- Pendências externas em `CHECKLIST-MANUAL.md`: REQ-263/264/265 (indicação visual de presença num telefone fictício) e REQ-267 (integração real de recuperação de mídia). Não foi usado número de produção.
- Próximo módulo: Campanhas, REQ-269 em diante. Ambiente continua nos endpoints locais declarados pelo usuário; banco `.audit/noctua-audit.db` preservado.

- Fechamento da regressão após corrigir a fixture envelhecida: servidor 206/206 aprovados; Playwright 36/36 aprovados (12 testes lógicos × 3 viewports); build e typecheck aprovados. O primeiro Playwright pós-lote teve 33/36 por assumir 135 min fixos; corrigido usando relógio do Chromium para testar esperas de 2/10/20 min com limites padrão 5/15; reteste direcionado 3/3 e suíte visual completa 36/36.
- A primeira regressão visual após envelhecimento da fixture falhou em REQ-243/244/245 em 3 viewports: Ana apresentava 168–170 min, não os 135 min estáticos que o teste esperava (`wait-age urgent`). A causa era `lastMessageAt` persistente no `.audit`; o teste foi corrigido com relógio simulado Chromium e tempos 2/10/20 min mantendo preferências reais 5/15. Reteste direcionado 3/3 e suíte final completa 36/36.
- `npm run audit:ledger`: 145 REQs com teste vinculado / 558 sem. Corrigido `audit-ledger.mjs` para classificar B/C dos requisitos 236–268 sem transformar a observação genérica de “produção somente leitura” em dependência externa.
- Contagens globais no Livro de Requisitos atualizadas: 194 a verificar; 226 completo; 29 completo-local; 189 parcial; demais estados sem alteração.
## Campanhas e agenda — lote REQ-269–297 — 30/10/2026

- Fechadas 26 REQs anteriormente pendentes: 25 `COMPLETO` e 1 `COMPLETO-LOCAL` (REQ-279, IA apenas com provedor simulado). REQ-272–274 preservadas como já completas.
- Playwright: 18/18 casos finais aprovados em 3 viewports (1366×768, 1920×1080, 390×844). Evidências individuais em `REVISAO/evidencias/REQ-269/`…`REQ-297/`; os itens 272–274 não foram reexecutados.
- Persistência conferida após reload: rascunho com intervalo/variações, agenda de número fictício, atendente e alterações da Biblioteca. Rascunhos de campanha/agendamento criados pelos testes foram cancelados ao terminar; nenhum envio foi feito.
- BUG-020 corrigido em `CampaignMonitor.tsx`: a contagem prevista permanece visível quando a conexão está indisponível, junto do aviso de espera. Teste simulado também cobriu progresso, pausa, retomada e cancelamento.
- Falhas/correções: (1) teste mobile esperava `overflow-y:auto` no formulário quando o contêiner rolável é o layout — expectativa passou a selecionar o contêiner conforme viewport; (2) leitura de `Response.json()` após reload invalidava o corpo no Chromium — validação pós-reload passou a usar APIRequestContext e a tela; (3) headers iniciais de request eram incompletos — removida suposição não necessária de header e usada a sessão local de teste; (4) seletor `Mensagem` era ambíguo com o nome do diálogo — passou a usar textbox exato; (5) consulta com inatividade ≥1 dia retornou 0 no fixture — teste agora confirma 0 e, ao zerar, confirma os 2 esperados; (6) texto do contador inclui emoji, então busca exata foi trocada por correspondência parcial. Uma chamada `npm exec --project` e um filtro regex passado ao `.cmd` foram rejeitados pelo parser do Windows; os mesmos testes foram executados pelo binário local sem instalar pacotes.
- Verificações direcionadas finais: filtro/público 3/3, agenda/novo número 3/3, Biblioteca 3/3, equipe 3/3. Suíte final completa: 18/18.
- Correção do produto: BUG-020 descrito em `REVISAO/BUGS.md`. Sem outras falhas de produto confirmadas neste lote.
- Próximo lote por módulo: REQ-298–327, Exportação e operação. Continuar no servidor existente e banco `.audit`; IA simulada apenas.
- Fechamento do lote Campanhas: 15 itens saíram de A VERIFICAR e 11 de PARCIAL; 25 foram para COMPLETO e REQ-279 para COMPLETO-LOCAL. Contagens globais: 179 A VERIFICAR, 251 COMPLETO, 30 COMPLETO-LOCAL e 178 PARCIAL.
- Regressão final após correções do lote Campanhas: `npm test` aprovou 206/206; `npm run typecheck` aprovado; `npm run build` aprovado (aviso de bundle JS acima de 500 kB, sem falha). Playwright final 18/18 em três viewports.

## Exportação e operação — lote REQ-298–327 — 30/10/2026

- Regressão visual combinada passou: 48/48 (16 cenários em três viewports: 1366×768, 1920×1080 e 390×844). Suíte de operações do servidor: 51/51 já aprovada. `npm run audit:ledger`: 197 REQs com teste vinculado, 506 sem.
- Mudaram 25 REQs: 17 para `COMPLETO` e 8 para `COMPLETO-LOCAL` (REQ-300–306 e REQ-327). Totais após regenerar o ledger: 162 A VERIFICAR, 268 COMPLETO, 38 COMPLETO-LOCAL, 171 PARCIAL, 50 canceladas/substituídas, 9 decisões, 2 decisões confirmadas, 4 desconectadas e 1 ausente.
- Evidências finais em `REVISAO/evidencias/REQ-298/`–`REQ-327/`; dados fictícios exclusivamente em `.audit/noctua-audit.db`. Importações, lembretes e campanha não enviaram mensagens; tarefas de teste foram removidas/restauradas. IA e QR foram simulados localmente.
- Correções nos testes: seleção de mídia usa nome atual por ID estável; campanha valida snapshots de tarefas no endpoint correto; controle de IA intercepta endpoint local; upload verifica saída WebP; lembrete cancela sua tarefa ao finalizar. Retestes direcionados passaram e regressão completa 48/48.
- Sem defeito de produto confirmado neste lote. REQ-300–306 permanecem local por falta de provedor real, conforme decisão já registrada; REQ-327 exige leitura física de QR em aparelho.
- Script `scripts/iniciar-noctua-online.ps1` permanece alterado e fora do commit. Mudança seleciona a pasta de interface em `Documents\ChatGPT\Noctua` quando ela existe, senão usa o repositório; roda o CLI Vercel nessa pasta e lê os vínculos de projeto dali. Isso muda a origem potencial de uma publicação. Não publicar.
- Próximo módulo: Sandbox e suporte, REQ-328–356. REQ-357–359 já estão completas e serão preservadas.

## Sandbox e suporte — lote REQ-328–356 — 30/10/2026

- Playwright `e2e/sandbox-support.spec.ts`: 9/9 testes aprovados em três viewports (27 execuções). Cobre abertura do simulador por Autoatendimento e Configurações, texto/áudio com endpoints de IA interceptados, contexto, objeção, calibração, reset, campanha/segmentação, transferência, CRM/SLA, agenda, Biblioteca e quatro guias.
- Suíte de operações do servidor: 52/52 aprovados; novo teste REQ-335 valida persistência de calibração como `AI_KNOWLEDGE` e apaga o registro dentro do SQLite temporário. Nenhuma chave real usada.
- 21 REQs mudaram: 18 `COMPLETO`, 3 `COMPLETO-LOCAL` (REQ-330/331/334, recursos dependentes de provedor). Não solicitar chave de IA; isso está decidido no protocolo. Totais: 149 A VERIFICAR, 286 COMPLETO, 41 COMPLETO-LOCAL, 163 PARCIAL; demais estados mantidos.
- BUG-021 resolvido: WAV passou de sinais sem fala a voz sintética em português com transcrição correspondente. Nenhum recurso ou dependência instalado.
- Erros e correções: seletores de `<select>` tentaram operar combobox customizado; corrigidos para usar `role=option`. Nome `Fechar` encontrou botão do modal e notificação; seletor agora é `Fechar janela`. Formulário da campanha confundiu `Nome` com `Mensagem ({{nome}})`; busca exige nome exato. O quadro mobile escondia a lista; sequência seleciona e abre o painel de recursos. A espera de presença era não determinística; relógio do Chromium controla os sinais. Vite travou sem responder; reiniciado na mesma porta `5180` com `VITE_API_URL=http://127.0.0.1:3340`, sem novo servidor e sem reset do banco.
- Nenhum envio externo. A campanha simulada foi pausada antes do primeiro ciclo; calibração de UI foi interceptada e o teste de servidor limpou seu registro temporário. Banco `.audit/noctua-audit.db` não foi resetado.
- Próximo módulo: IA e mídia, iniciando REQ-360. IA real continua desligada e sem chave; testar apenas simulação local e registrar dependência de provedor como COMPLETO-LOCAL, conforme decisão existente.


## Atendimento — lote REQ-444–487 — 30/10/2026

- Regressão visual final do lote: 30/30 passaram (10 cenários × 3 viewports). Suíte integral do servidor: 219/219 passaram; `npm run typecheck` e `npm run build` aprovados. Capturas e JSON de console em `REVISAO/evidencias/REQ-444/`, `446/`, `447/`, `449/`, `450/`, `452/`, `454/`, `455/`, `457/`, `458/`, `460/`, `464/`, `467/`, `468/`, `469/`, `470/`, `471/`, `473/`, `474/`, `476/`, `477/`, `478/`, `479/`, `480/`, `481/`, `483/`, `484/`, `485/`, `486/` e `487/`.
- Ao encerrar, 25 REQs ficam `COMPLETO`, 14 `DECISÃO` e 1 `DEFEITO` (REQ-464/BUG-026); quatro completos preexistentes são preservados. BUG-027/028/029 corrigidos localmente.
- REQ-446: corrigido limite mínimo do grid HUD de 21 rem para 15 rem, alinhado ao controle visual e validado em desktop; no celular, gaveta mantém largura responsiva ao viewport. REQ-444: guard impede consultar `/automation/sessions//flows` sem conexão e remove 404 no console.
- REQ-450 comprovou criação, reordenação e reload no `.audit/noctua-audit.db`, restaurando a organização original em `finally`; REQ-454/460 comprovaram editor pelo painel e composição/salvamento interceptado, sem persistir macro no banco local. Macros executáveis foram verificadas em testes de servidor com SQLite temporário.
- BUG-026: ação “PIX ou figurinha” não oferece sticker no seletor nem dispatch dedicado. Ficou como defeito registrado; nenhum envio ocorreu.
- REQ-471/473 e 476–481: configurou em fixture as ações de macro, resposta padrão textual, áudio e imagem; recarregou e confirmou campos/recorrências com dois clientes. Nenhuma mensagem foi enviada.
- BUG-029: configuração de navegação lateral cobria as abas Biblioteca/Fixados; o layout foi corrigido. REQ-484–486 passou nos três viewports e alternou todos os filtros.
- REQs dependentes de decisão têm pergunta de uma linha na tabela `REVISAO/REQUISITOS.md`; não foram implementadas suposições de formato.
- Erros dos testes corrigidos: seletor de navegação duplicado; inputs ocultos dos comboboxes customizados; summary repetido por ação na macro; tipo e comando armazenados em campos separados; campo de mensagem requerido; menu categoria inspecionado via roles acessíveis; largura do painel interpretada como gaveta no mobile; chamada de fluxo com sessão vazia bloqueada.
- Próximo módulo pela ordem da lista: L-18, iniciando em REQ-488. Banco `.audit/noctua-audit.db` preservado; nenhuma produção acessada para escrita.

- Ledger regenerado após a suíte: 326 REQs com teste vinculado e 377 sem. `scripts/iniciar-noctua-online.ps1` segue fora do commit, conforme explicado ao usuário; o arquivo `npx` não existe na raiz.

## Atendimento e Personalização — lote REQ-488–503 — 30/10/2026

- Playwright `e2e/personalization-attendance.spec.ts`: 15/15 testes passaram em três viewports (45 execuções). Cobriu destino de atalhos, exclusão mútua entre lateral/janela, abas do editor, filtros por tipo/categoria, seleção/removal de fixados, configuração independente, seleção inicial vazia, posição livre após reload, teclas persistentes, densidade compacta e prévia antes de envio.
- 15 REQs foram para `COMPLETO`; REQ-499 permanece `DECISÃO`: confirmar se “remover opção de números para ordenar” abrange só numeração da lista ou também teclas numéricas configuráveis.
- Preferências foram interceptadas pelo Playwright em fixture e sobreviveram a reloads dentro do teste; nenhuma escrita no `.audit/noctua-audit.db`, envio de mensagem ou chamada de produção. Evidências individuais em `REVISAO/evidencias/REQ-488/`–`REQ-503/`.
- Falhas e correções: fixture inicial não informava `attendanceCustomizationVersion=3`, então normalização ocultava atalhos; adicionada versão e visibilidade explícitas. Nomes de abas e destino do atalho foram ajustados aos rótulos reais do DOM. Em mobile, lateral fechada após salvar é o comportamento responsivo; expectativa foi atualizada. Posição livre testada nos campos reais e após recarga.
- Ledger: 342 REQs com teste vinculado e 361 sem. Próximo módulo: L-19, REQ-507 em diante. O script `scripts/iniciar-noctua-online.ps1` segue fora do commit.

## Atendimento e Personalização — lote REQ-507–519 — 30/10/2026

- Playwright `e2e/personalization-attendance.spec.ts`: regressão final 36/36 aprovada em três viewports; `npm run typecheck` passou. Evidências em `REVISAO/evidencias/REQ-507/`–`REQ-519/`.
- 12 REQs ficaram `COMPLETO`; REQ-512 continua `PARCIAL` porque a revisão global das Partes 1/2 não substitui resolver os filhos ainda incompletos. Nenhum novo defeito de produto confirmado.
- REQ-510 arrastou o bloco de conversa para a área de ferramentas; o app o encaixou sem colisão e manteve a posição após reload em desktop. Mobile preserva layout encaixado. REQ-509/511 confirmou que Cancelar não grava e Confirmar grava uma vez. REQ-517 percorreu Textos, Áudios e Mídias na lateral.
- Falhas/correções de teste: medições mobile foram ajustadas porque a lista de conversas fica oculta enquanto a conversa está aberta; REQ-508 usa o botão direto no cabeçalho; `Personalizar` abre menu, não o editor. Para L-19, preferências e posições foram interceptadas no fixture. A gaveta mobile intercepta atalhos enquanto aberta; o teste fecha antes de escolher o próximo filtro.
- Nenhuma chamada de produção, mensagem ou gravação no `.audit/noctua-audit.db`. Ledger: 354 REQs com teste vinculado e 349 sem.
- Próximo módulo: L-20, REQ-520 em diante. `scripts/iniciar-noctua-online.ps1` segue fora do commit.

## Chaves e operações — L-27, REQ-695–697 — 30/10/2026

- Três REQs passaram de `PARCIAL` para `COMPLETO-LOCAL` com testes identificados por REQ em `apps/server/test/access.test.ts`.
- `access.test.ts`: 20/20; os três casos novos confirmam duas operações isoladas e recusa cruzada (403), ativação por chave com persistência em nova consulta e rejeição da reutilização, e acesso liberado sem registro de aprovação manual.
- Ledger regenerado: 429 REQs com teste vinculado e 274 sem; estados do inventário: 437 `COMPLETO`, 97 `COMPLETO-LOCAL`, 76 `PARCIAL` (demais estados preservados).
- Primeira execução abortou antes dos casos com `uv_os_get_passwd ... ENOMEM` no `tsx`; o preload CommonJS temporário indicado no histórico contornou o problema. Nenhuma dependência foi instalada nem resultado esperado foi alterado.
- API local respondeu 200 e `/api/public/runtime` reportou `authMode=local`. Os testes usam SQLite temporário em `%TEMP%`; banco `.audit/noctua-audit.db` preservado (2.039.808 bytes; `2026-10-30T18:07:20.5497691Z`). Nenhuma conta real, e-mail ou produção foi acessada.
- Evidências por REQ: `REVISAO/evidencias/REQ-695/`, `REQ-696/`, `REQ-697/`. Validação visual e e-mail confirmado requerem Firebase Auth Emulator, indisponível no ambiente atual; passo a passo está em `CHECKLIST-MANUAL.md`.

## Estrutura — L-01, REQ-001 e REQ-008 — 31/10/2026

- REQ-001 ficou `COMPLETO`: o teste identificado compilou `apps/server` e `apps/web` com `tsc --noEmit` e procurou marcadores explícitos de pendência em comentários do código-fonte. Os dois checks passaram.
- REQ-008 ficou `COMPLETO`: `apps/server/test/crm.test.ts` confirmou a etapa destino após nova leitura; `e2e/structure-audit.spec.ts` arrastou o cartão com a alça e conferiu ordem após reload em 1366×768, 1920×1080 e 390×844 (3/3).
- Correções de teste: o scan inicial marcou duas frases portuguesas com “todo” como `TODO`; regex passou a exigir marcador explícito em comentário. No E2E, a origem saía do viewport ao rolar para o destino; seletor por contato e rolagem automática estabilizaram o gesto. O teste agora trata POSTs de presença como chamadas esperadas interceptadas e ainda falha diante de qualquer outra mutação.
- As duas primeiras rodadas visuais deixaram JSON/PNG/trace de falha no diretório de evidências; a rodada final aprovada e a captura de desktop diagnóstico também foram preservadas. Nenhum BUG de produto confirmado.
- Servidores existentes mantidos; front/API HTTP 200. Escritas E2E interceptadas e CRM testado em SQLite temporário; `.audit/noctua-audit.db` preservado. Sem login, mensagens, conexão real ou produção.
## Mensagens — L-03, REQ-024–053 — 31/10/2026

- 25 estados atualizados: 14 COMPLETO, 10 COMPLETO-LOCAL e REQ-036 em DECISÃO. REQs sem lacuna não foram refeitas.
- Playwright e2e/messages-audit.spec.ts: 21/21 em 1366×768, 1920×1080 e 390×844. Servidor focado: 9/9 em SQLite temporário. Capturas e JSON individuais em REVISAO/evidencias/REQ-024/–REQ-053/ para os requisitos exercitados.
- API e front locais responderam HTTP 200. .audit/noctua-audit.db ficou em 2.039.808 bytes, LastWriteTimeUtc=2026-10-30 18:07:20; writes de API, preferências e envios da UI ficaram interceptados em memória. Os testes do servidor usaram SQLite temporário. Nenhuma produção ou WhatsApp real foi acessado.
- Correções do harness sem alterar critérios: chamadas de presença do Socket.IO deixaram de ser interceptadas pelo bloqueador geral; a asserção Pix passou a verificar amountInCents no payload (o valor não precisa aparecer no texto); seletores passaram a aceitar rótulos de ativos com extensão; cenários de macro/funil usaram o painel clássico para evitar sobreposição do dock; removida a expectativa incorreta de habilitar envio com texto vazio. Regressão final 21/21.
- REQ-036 continua em DECISÃO: o app cadastra chave aleatória já emitida e gera QR/Copia e Cola, mas não pode criar chave bancária. A pergunta de escopo está registrada em REQUISITOS.md; os itens externos estão no CHECKLIST-MANUAL.md.
- Contagens após o lote: 5 A VERIFICAR; 454 COMPLETO; 111 COMPLETO-LOCAL; 46 PARCIAL; 51 substituídos/cancelados; 26 decisões (2 confirmadas); 4 desconectados; 3 defeitos; 3 ausentes.
- Próximo módulo: Fluxos e CRM, REQ-054–075 (22 pendentes), conforme ordem da LEDGER. Sem reset, sem mudança no app e sem publicação.

## Fluxos e CRM — L-04, REQ-054–075 — 31/10/2026

- 22 REQs passaram de PARCIAL para COMPLETO-LOCAL. Já completas fora do lote foram preservadas. Totais: 454 COMPLETO, 133 COMPLETO-LOCAL, 24 PARCIAL; demais estados sem mudança.
- Playwright `e2e/flows-crm-audit.spec.ts`: 21/21 cenários aprovados, sete cenários em 1366×768, 1920×1080 e 390×844. 66 pares PNG/JSON por REQ e viewport em `REVISAO/evidencias/REQ-054/`–`REQ-075/`.
- Fluxos cobertos: arraste x/y com ajuste do quadro à tela, rascunho separado da versão publicada, ativação/pausa, gatilhos, dias/horários, contatos/grupos, recursos e atrasos, ligações, entradas, respostas, timeout e follow-up. CRM: colunas por etiqueta, arraste com mouse no desktop, mover pelo cartão no móvel, reload e métricas de atendimento/conversão.
- Os testes de servidor `flows.test.ts` 15/15 e `crm.test.ts` 8/8 em SQLite isolado já estavam aprovados antes deste lote. Gravações da UI ficaram interceptadas em memória; não houve envio. Front/API responderam HTTP 200; `.audit/noctua-audit.db` permaneceu em 2.039.808 bytes e `LastWriteTimeUtc=2026-10-30T18:07:20.5497691Z`. JSONs: zero pageErrors e zero writes não interceptados; desktop sem erros de console. No mobile, 1–2 erros de console por caso, exclusivamente ERR_BLOCKED_BY_CLIENT de https://apis.google.com/js/api.js, bloqueado pelo harness.
- Correções de harness sem alterar critérios: fechamento explícito do inspector antes de selecionar outro nó; ajuste “Fit View” e evento touch real no canvas móvel, pois o nó novo aparecia fora da área visível; textarea localizada dentro do rótulo acessível; dashboard localizado pelo rótulo exato; movimento CRM simulado por mouse com sensor real no desktop e caminho “Mover cartão” documentado pelo app no mobile. Nenhum defeito funcional do produto confirmado.
- Limites: REQ-064/065 continuam locais; recebimento em aparelho WhatsApp descartável está em `CHECKLIST-MANUAL.md`. Um teste teclado-only de CRM teve resultado inconsistente entre viewports; REQ-073 foi validada pelo gesto de mouse descrito no critério e o modo teclado ficou como conferência manual opcional.
- Nenhum arquivo funcional do app foi alterado. Próximo módulo por ordem do ledger: Backups, REQ-076–097. Sem reset, push, publicação ou escrita em produção. `scripts/iniciar-noctua-online.ps1` segue fora do commit.
- Ledger regenerado após L-04: 482 REQs com teste vinculado, 221 sem.

- Commit do lote L-04: `3ea699a`; ledger regenerado depois do commit.

## Backups — L-05, REQ-076–097 — 31/10/2026

- L-05 Backups REQ-076–097: 20 estados mudaram — 15 COMPLETO e 5 COMPLETO-LOCAL; REQ-091/092 permaneceram completos. Contagem atual no inventário: 469 ✅ COMPLETO; 138 ✅ COMPLETO-LOCAL; 4 ⚠️ DECISÃO; 51 🔁 SUBSTITUÍDO OU CANCELADO; 7 ⚠️ PRECISA DE DECISÃO; 2 ❌ DEFEITO; 3 ❌ AUSENTE; 4 🔌 DESCONECTADO; 15 🟣 DECISÃO; 1 🔴 DEFEITO; 6 🟡 PARCIAL; 3 ⬜ A VERIFICAR.
- Provas visuais Playwright: 49 aprovadas e 2 puladas de 51 execuções. O cenário de upload visual acima de 40 MiB rodou no Chromium desktop; os dois projetos restantes foram pulados para manter o consumo de memória controlado. Evidências individuais em REVISAO/evidencias/REQ-076/–REQ-088/ e REQ-094/–REQ-097/.
- Testes de servidor em SQLite temporário: backup.test.ts 16/16; authenticated-request.test.ts 5/5. Evidências de saída em REVISAO/evidencias/REQ-079/ e REQ-095/. O banco .audit/noctua-audit.db manteve 2.039.808 bytes e o mesmo LastWriteTimeUtc.
- REQ-089/090 ficaram COMPLETO-LOCAL com nove agendamentos/fluxos fictícios DRAFT/desativados e sem envio. REQ-093/094/095 também COMPLETO-LOCAL; as provas manuais externas estão agrupadas no CHECKLIST-MANUAL.md. REQ-096/097 concluídas. Nenhum defeito novo de produto; testes falhos iniciais e correções do harness constam em evidencias/lote-L05-backups-2026-10-31.md.
- Nenhum serviço extra, reset, chamada de produção, envio de mensagem ou acesso a conta real. scripts/iniciar-noctua-online.ps1 permanece fora do lote e do commit.
- Acesso e operação REQ-098–127 já está em estado final, exceto REQ-126 em DECISÃO, preservada sem repetição. Próximo item não final com falha reproduzida: REQ-381 (BUG-022, compressão de vídeo); prosseguir apenas se o defeito puder ser corrigido e validado no local.

## Correção de diagnóstico — REQ-381 / BUG-022 — 31/10/2026

- REQ-381 passou de DEFEITO para COMPLETO. O teste anterior media o arquivo na requisição interceptada, antes da transcodificação; o servidor já processava o mesmo endpoint usado pelo chat e pela Biblioteca.
- Prova real: `attendance.test.ts` enviou vídeo FFV1 pesado, recebeu e releu MP4/H.264 menor no SQLite temporário e decodificou o primeiro frame. Regressão do módulo: 25/25.
- Prova visual: chat e Biblioteca usaram `/api/attendance/files` com salvamento/envio interceptados. `e2e/ai-media.spec.ts`: 24/24 nas três viewports; `.audit/playwright-results/.last-run.json` registrou `passed`.
- O primeiro reteste tentou validar um frame bruto por pipe; no Windows, `spawnSync` reportou `EOF` mesmo com FFmpeg em código 0. A validação passou a ler o MP4 em arquivo temporário e passou sem mudar o critério.
- `.audit/noctua-audit.db` permaneceu com 2.039.808 bytes e `LastWriteTimeUtc=2026-10-30T18:07:20.5497691Z`. Nenhum envio, conta, provedor ou produção foi usado.

## Correção funcional — REQ-464 / BUG-026 — 31/10/2026

- REQ-464 passou de DEFEITO para COMPLETO. A macro agora oferece figurinha WebP, persiste `asSticker` e o servidor grava `send.kind=sticker`; arquivos não-WebP são rejeitados nesse modo.
- Teste de servidor executou a macro com SQLite e socket fictícios: bytes WebP chegaram no campo `sticker`, sem WhatsApp real. Regressão `operations.test.ts`: 62/62.
- Playwright selecionou o recurso WebP e salvou a ação nas três viewports, com POST interceptado e zero envio. Regressão `side-tools.spec.ts`: 30/30; zero erros de console.
- A regressão inicialmente falhou em REQ-402/403 porque o teste dependia do relógio real estar após 08h. `BusinessWorker` recebeu relógio opcional apenas para teste; o cenário passou com 08h fixas sem alterar o relógio padrão de produção.
- Front/API responderam HTTP 200; `.audit/noctua-audit.db` permaneceu em 2.039.808 bytes e `LastWriteTimeUtc=2026-10-30T18:07:20.5497691Z`. Sem produção, envio, reset ou nova dependência.

## Fechamento global — REQ-512 — 31/10/2026

- REQ-512 passou de `PARCIAL` para `COMPLETO`: os 24 filhos REQ-488–511 estão `COMPLETO`, `COMPLETO-LOCAL` ou com decisão registrada; REQ-499 é a única decisão desse intervalo.
- O teste lê `REVISAO/LEDGER.csv`, rejeita filho ausente ou ainda parcial e confirma as sete abas do editor. Playwright focado: 3/3 em 1366×768, 1920×1080 e 390×844; evidências renovadas em `REVISAO/evidencias/REQ-512/`.
- Front/API responderam HTTP 200. `.audit/noctua-audit.db` permaneceu com 2.039.808 bytes e `LastWriteTimeUtc=2026-10-30T18:07:20.5497691Z`; nenhuma preferência real, mensagem ou produção foi alterada.
- REQ-425/BUG-025 continua separada como pendência de IA: não existe modelo/embedding local instalado, e ampliar o dicionário de sinônimos não comprovaria equivalência semântica.

## Infraestrutura — fechamento dos estados não finais — 31/10/2026

- Oito REQs saíram de estados transitórios: REQ-534 `COMPLETO`; REQ-530/533/541/542 `COMPLETO-LOCAL`; REQ-523/527/540 `DECISÃO`. O módulo ficou sem `PARCIAL` e sem `A VERIFICAR`.
- Testes locais: `infrastructure-audit.test.ts` 4/4 e REQ-530 em `whatsapp.test.ts` 1/1. A primeira tentativa não iniciou porque `|` no filtro foi interpretado pelo wrapper `.cmd`; as duas suítes foram separadas e passaram sem mudar expectativas.
- REQ-533/534/541 foram verificadas sem executar o iniciador: caminhos relativos, BOM/UTF-8, mensagens acentuadas, URL exata e `Start-Process` foram afirmados. REQ-542 comprovou branch/remoto/build local, sem push.
- `.audit/noctua-audit.db` permaneceu em 2.039.808 bytes e `LastWriteTimeUtc=2026-10-30T18:07:20.5497691Z`. `scripts/iniciar-noctua-online.ps1` continuou fora do staging; nenhuma conta, Vercel, Firebase, túnel ou WhatsApp real foi alterado.

## Fechamento da regressão de Infraestrutura — 31/10/2026

- Confirmei que Sandbox e suporte REQ-328–356 já estavam finalizados no LEDGER, com 21 `COMPLETO` e 8 `COMPLETO-LOCAL`; as evidências existentes foram preservadas e os testes não foram repetidos.
- Regressão de infraestrutura passou: `infrastructure-audit.test.ts` 4/4; REQ-530 em `whatsapp.test.ts` 1/1. Falha inicial foi somente caminho relativo incorreto; nova execução ocorreu na pasta do servidor.
- `npm run audit:ledger`: 506 com teste vinculado, 197 sem; 473 `COMPLETO`, 142 `COMPLETO-LOCAL`, 3 `AUSENTE`, 1 `DEFEITO`, 4 `DESCONECTADO`, 29 decisões (7 + 7 + 15) e 51 substituídas/canceladas.
- API local HTTP 200; banco `.audit/noctua-audit.db` intacto (2.039.808 bytes; LastWriteTimeUtc 2026-10-30T18:07:20.5497691Z). REQ-530 usou SQLite temporário. Nenhuma produção acessada.
- Branch `auditoria-reqs`; `scripts/iniciar-noctua-online.ps1` permaneceu fora do staging e não foi executado.

## Automações — revalidação REQ-408/409 — 31/10/2026

- 3/3 Playwright em três viewports confirmou ausência de seletor para dividir fila entre conexões e de failover. Estados `AUSENTE` mantidos; nenhuma campanha criada ou salva.
- PNGs/JSON atualizados em `REVISAO/evidencias/REQ-408/` e `REQ-409/`; API/front HTTP 200; banco `.audit` inalterado.
- Nenhum bug de código novo confirmado. Próximo lote: Economia de IA, usando somente testes locais simulados, sem chave/serviço externo.

## Economia de IA — revalidação local — 31/10/2026

- Playwright 6/6 para REQ-419–422 e 430 nas três viewports; operações 1/1 para REQ-425 em SQLite temporário. Atualizadas capturas e recibos dos IDs exercitados, incluindo REQ-439/440 no caso compartilhado.
- REQ-419–422 permanecem `DESCONECTADO`; REQ-430 permanece `AUSENTE`; REQ-425 permanece `DEFEITO`/BUG-025. Testes passaram e confirmaram os limites; nenhum critério foi enfraquecido.
- Não usei chave/modelo externo. `.audit/noctua-audit.db` não foi utilizado pelos testes de servidor nem alterado pelos testes visuais.
- Único item restante com prova A/B fora de COMPLETO/COMPLETO-LOCAL é REQ-425; avanço exige decisão sobre tecnologia local de embeddings/modelo. Ver decisões e tarefas externas restantes no LEDGER e CHECKLIST-MANUAL.

## REQ-425 — Economia de IA — 31/10/2026

- Estado: `COMPLETO-LOCAL`; BUG-025 corrigido localmente. LEDGER atualizado; REQ-419–422 continuam `DESCONECTADO` e REQ-430 `AUSENTE`.
- Implementado embedding semântico local no cache aprovado com `@huggingface/transformers` 3.8.1 e `Xenova/paraphrase-multilingual-MiniLM-L12-v2` pinned revision `2c4055b12046f11709e9df2c122e59ffbdc2f900`. Sem API; inferência bloqueia modelos remotos. Modelo em `.audit/models/`, baixado pelo script com SHA-256 validado.
- Cache usa cosine threshold 0,84, resposta aprovada, janela de validade e proteção PII. Vetores ficam internos e não são expostos pela API. Falha do modelo não bloqueia sugestão; segue sem cache.
- Testes: foco REQ-424/425 1/1; typecheck server aprovado. SQLite temporário e provedor simulado. Evidência em `REVISAO/evidencias/REQ-425/server-test.json`.
- Falhas/harness: chamada inicial posicionou filtro após glob e iniciou suíte ampla; interrompida e refeita com comando focal. Caso negativo revelou contador esperado desatualizado; ajustada só a contagem das chamadas simuladas, reteste passou sem mudar o critério funcional.
- Instalação relatou 13 vulnerabilidades transitivas (11 moderadas, 2 altas). Sem `npm audit fix`; investigar separadamente.
- Banco `.audit/noctua-audit.db` preservado em 2.039.808 bytes e timestamp 2026-10-30; API local HTTP 200. Nenhuma produção acessada.
- Commit `b5cbd76` publicado em `auditoria-reqs`. Os arquivos preexistentes `scripts/iniciar-noctua-online.ps1` e `REVISAO/evidencias/REQ-686/process.json` ficaram fora do commit.
- Próximo trabalho: analisar o próximo módulo com estados não finais no LEDGER; primeiro pendente dentro de Economia de IA são REQ-419–422 (consumidores desconectados) e REQ-430 (interface ausente).

## Retomada — próximo módulo

- Próximo módulo aberto na ordem do ledger: Atendimento (REQ-448–499). Os 15 requisitos ainda não finais requerem decisões de escopo/comportamento já discriminadas em `REVISAO/LEDGER.csv`; não alterei essas funções sem critérios definidos.
- Commit da correção: `b5cbd76`; commit de preservação do histórico: `2d6fd67`; ambos publicados em `auditoria-reqs`.


## Atendimento — retomada 31/10/2026

- Confirmados recibos de REQ-455/457/458 como saídas dos testes E2E com fixture local. 455/457 seguem DECISÃO por perguntas de escopo; 458 aprovado. REQ-686/process.json não é prova de teste, ficou pendente e sem commit.
- Playwright focal: 21/21 aprovado nos três viewports após corrigir a invocação para `--config e2e/playwright.config.ts`. REQ-472: confirmação e POST local interceptado, sem bloqueio WhatsApp real; COMPLETO-LOCAL. REQ-475/482/499: atalho adicionável/persistente, reordenação prática persistente, sem campos numéricos de ordem; COMPLETO.
- Demais decisões do módulo mantidas com questões objetivas no LEDGER. Banco `.audit` preservado (2.039.808 bytes; timestamp original), API/front HTTP 200.


## Ponto de parada — 31/10/2026

- Commit do lote Atendimento: `8365815`, push confirmado em `origin/auditoria-reqs`. 21/21 testes E2E; 4 estados alterados; 11 decisões específicas permanecem no LEDGER.
- Próximo módulo: Infraestrutura (REQ-523/527/540), bloqueado por decisões de hospedagem, escopo de contas externas e credenciais/configuração Firebase local. A sequência também tem REQ-567 (horário/filas de sono), REQ-573 (aguarda Parte 8 já adiada) e REQ-680 (aprovação de reações).
- REQ-686/process.json não é comprovante de teste e continua fora do commit. O iniciador online não foi tocado nem staged. Banco local preservado.


## Decisões do usuário e próxima fila — 31/10/2026

- REQ-523, REQ-527 e REQ-540 registradas como DECISÃO conforme instrução; hospedagem, contas externas e Firebase não foram alterados.
- Revisão local do módulo Qualidade: não foi encontrada política global de horário de sono; regras de pausa existentes são por fluxo/campanha/sequência. REQ-567 segue à espera de horários, escopo de envios e retomada automática; REQ-573 aguarda a Parte 8 previamente adiada.
- REQ-680 continua aguardando aprovação. Nenhum teste com comportamento externo foi iniciado. Próximo avanço depende dessas escolhas/artefatos do usuário.


## Qualidade e documentação — decisões — 31/10/2026

- REQ-567: DECISÃO adiada; sem horários ou política de pausa.
- REQ-573: DECISÃO; texto da Parte 8 não fornecido, depende de envio futuro. Recibo criado em `REVISAO/evidencias/REQ-573/decisao-parte-8.json`.
- Próximo lote independente: REQ-680 em Revisão e menu contextual, sujeito à aprovação já indicada no protocolo.
