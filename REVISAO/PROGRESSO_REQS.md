
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
