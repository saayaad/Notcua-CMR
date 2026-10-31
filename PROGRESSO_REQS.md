# Progresso da auditoria de REQs

Iniciado em 29/10/2026. Esta auditoria usa o perfil persistente do Playwright em
`C:\Users\gusta\.codex\playwright-noctua-diagnostic` e evita envio de mensagens,
uploads, exclusões, criação de contas e alterações persistentes em produção.

## Lote visual atual

| REQ | Estado | Evidência / resultado | Próxima ação |
| --- | --- | --- | --- |
| 224 | Parcial | `Ctrl+K` abriu a Busca rápida; busca por `Agenda` retornou resultado de tela, sem navegação executada. | Verificar a abertura do resultado em sessão descartável. |
| 215 | Parcial | Editor de HUD abriu com densidade, prévia e cancelamento/confirmar visíveis. | Exercitar as três densidades sem confirmar e conferir as telas principais. |
| 216 | Parcial | Aba Posição livre exibiu seletor de bloco/modo e prévia. | Exercitar posição livre sem salvar; colisão depende de REQ-510 publicado. |
| 492/493/494/503 | Parcial | Aba Mensagens fixadas confirmou categoria, configuração individual (nome/prévia), 143 conteúdos disponíveis e 0 fixados; Cancelar/Confirmar continuam visíveis. | Fixar/configurar/remover exige mudança de preferência real; executar somente com dado descartável e autorização específica. |
| 509/511 | Parcial | Prévia, Cancelar e Confirmar alterações renderizaram. | Confirmar que Cancelar descarta um rascunho reversível. |
| 225 | Parcial | Clique no botão Buscar abriu o modal; o campo `Buscar conversas, telas e recursos…` ficou disponível. | Buscar resultado não mutável e verificar navegação pelo resultado. |
| 202 | Parcial | Atendimento autenticado, cabeçalho e Biblioteca com 143 recursos renderizaram em 1366×768, 1920×1080 e 2560×1440. | Cobrir conversa selecionada, editor e navegadores externos. |
| 514 | Completo no escopo visual atual | Prévia, Cancelar e Confirmar permaneceram visíveis nas sete abas em desktop e no modo Celular da prévia. | Ainda não cobre aparelhos físicos. |
| 510 | Parcial | Teste isolado `hud-placement.test.ts` passou 3/3: evita colisão, normaliza colisões legadas e volta ao layout encaixado sem espaço. | A versão pública ainda precisa de homologação visual do movimento após a publicação da correção. |
| 513 | Parcial | A prévia foi ampliada e exibiu o botão `Voltar aos ajustes`; controles Computador e Celular renderizaram a prévia sem gravar nada. | Verificar leitura em resoluções móveis físicas. |
| 214 | Parcial | Navegação estabilizada: Configurações > Personalização exibiu os controles de Logotipo, favicon, paleta e editor HUD. Nenhum arquivo foi enviado. | Upload/renderização requer imagem de teste e autorização específica. |
| 103/107 | Parcial | Navegação estabilizada: Menu e atalhos exibiu ordem de grupos, pastas, visibilidade e comandos de reordenação. Evidência anterior de persistência da ordem permanece válida. | Repetir alteração somente se for autorizada uma mudança persistente controlada. |
| 104–111 | Parcial | Abas Meu perfil, Privacidade, Notificações, Conversas, Negócio, Departamentos e Equipe abriram em sessão autenticada; controles foram apenas inspecionados. | Edição persistente, convites/e-mail e permissões de navegador continuam fora do escopo seguro atual. |
| 112/113 | Parcial | A tela autenticada oferece o percurso de conta; nenhum e-mail de recuperação/verificação foi enviado. | Requer conta de teste e autorização explícita para remeter e-mail. |

## Erros observados

- Duas respostas 404 vieram de URLs de avatares remotos `pps.whatsapp.net`; não foram classificadas como defeito do HUD.
- Uma chamada de fluxos para o túnel de automação foi cancelada durante o carregamento; a tela completou com 809 conversas e 143 recursos.
- O caminho por `Personalização` não respondeu ao clique semântico do Playwright nesta passagem. Não foi classificado como falha de produto; requer investigação por seletor/estado de tela.
- A navegação lateral para Configurações tem elementos de texto duplicados/fora da viewport no DOM; o clique textual atual resolveu para um elemento não navegável. Nenhuma ação de configuração foi executada.
- A navegação foi estabilizada ao rolar o botão real `Configurações` para a viewport antes do clique. O escopo de leitura das abas foi concluído sem alteração de dados.
- Em 30/10, as chamadas de automação/operacões canceladas foram correlacionadas às navegações/recargas deliberadas entre os blocos do Playwright; a tela terminou carregando após cada bloco. Não foram classificadas como falha do produto.

## Artefatos

- `C:\Users\gusta\.codex\playwright-noctua-diagnostic\evidence\visual-safe-batch-run.json`
- `C:\Users\gusta\.codex\playwright-noctua-diagnostic\evidence\req224-global-search.png`
- `C:\Users\gusta\.codex\playwright-noctua-diagnostic\evidence\req215-509-511-hud.png`
- `C:\Users\gusta\.codex\playwright-noctua-diagnostic\evidence\req216-free-position.png`
- `C:\Users\gusta\.codex\playwright-noctua-diagnostic\evidence\search-responsive-batch-run.json`
- `C:\Users\gusta\.codex\playwright-noctua-diagnostic\evidence\req225-search-button.png`
- `C:\Users\gusta\.codex\playwright-noctua-diagnostic\evidence\req514-all-tabs-run.json`
- `C:\Users\gusta\.codex\playwright-noctua-diagnostic\evidence\mobile-search-batch-run.json`
- `C:\Users\gusta\.codex\playwright-noctua-diagnostic\evidence\req514-mobile-all-tabs.png`
- Teste local: `apps/server/test/hud-placement.test.ts` — 3/3 aprovado.
- `C:\Users\gusta\.codex\playwright-noctua-diagnostic\evidence\settings-navigation-batch-run.json`
- `C:\Users\gusta\.codex\playwright-noctua-diagnostic\evidence\settings-readonly-all-tabs-run.json`
- `C:\Users\gusta\.codex\playwright-noctua-diagnostic\evidence\hud-preview-modes-run.json`
- `C:\Users\gusta\.codex\playwright-noctua-diagnostic\evidence\req513-expanded-preview.png`
- `C:\Users\gusta\.codex\playwright-noctua-diagnostic\evidence\autonomous-continuous-batch-run.json`
- `C:\Users\gusta\.codex\playwright-noctua-diagnostic\evidence\pinned-controls-readonly-run.json`
- `C:\Users\gusta\.codex\playwright-noctua-diagnostic\evidence\req492-503-pinned-controls.png`

## Auditoria REQ-500–700 — 30/10/2026

### Escopo executado sem efeitos externos

- **REQ-500–519:** a execução visual persistente já confirmou HUD, prévia, posição livre, ampliação, busca, Biblioteca e Configurações. Os itens que exigem salvar densidade, fixar/remover conteúdo ou alterar layout seguem parciais para preservar dados reais.
- **REQ-520–543:** build e tipagem passaram; não foi feito deploy, `git push`, alteração de túnel, Vercel ou Firebase. REQ-526 e o modelo persistente de disponibilidade continuam dependentes de decisão de custo/infraestrutura.
- **REQ-544–555:** nenhuma chave Gemini foi cadastrada, editada, reordenada ou excluída. A suíte isolada de IA cobriu criptografia, controle de recurso, modelos, cotas e contingência, mas há falhas abaixo que impedem homologação total.
- **REQ-574–595:** a suíte confirmou persistência estrutural do layout, restauração de janela externa como painel local, rejeição de layout inválido, limitação de painel flutuante e ausência de área fantasma no grid. A interação completa de arrastar/redimensionar em produção segue parcial.
- **REQ-660–700:** respeitados os limites de não enviar mensagens, não excluir, não cobrar e não alterar dados reais. As provas de execução foram registradas; requisitos que dependem de segunda conta, e-mail, chave real ou decisão de negócio permanecem parciais.

### Suíte completa e integridade

- `npm run build`: aprovado para servidor e web. Há somente o aviso conhecido de bundle web acima de 500 kB; não é falha de compilação.
- `npm run typecheck`: aprovado para servidor e web.
- `npm test`: **194/202 aprovados; 8 falharam**. As falhas não foram corrigidas porque coincidem com mudanças locais preexistentes, que não foram sobrescritas pela auditoria.

### Falhas de teste a investigar antes de homologar campanhas/IA

| Arquivo | Cenário | Sinal |
| --- | --- | --- |
| `operations.test.ts` | validação de números | contador de consultas: esperado 2, atual 3 |
| `operations.test.ts` | campanha, pós-envio, fila ativa e macros | contador de envios: esperado 2, atual 1 |
| `operations.test.ts` | assumir durante geração e contingência | contador esperado 6, atual 5 |
| `part3.test.ts` | rotação de variações de campanha | esperado `A {{nome}}`, atual `base` |

O diff local de `campaign-text.ts` explica diretamente a última falha: agora a rotação monta `[texto-base, ...variações]`, enquanto o teste anterior começava pelas variações. Há também mudanças locais em `delivery.worker.ts`, `operations.routes.ts` e testes. Elas foram preservadas e precisam de decisão do autor dessas mudanças para escolher a regra de negócio e atualizar implementação/testes em conjunto.

### Próximas tarefas seguras

1. Decidir a regra da rotação de campanhas: texto-base entra ou não no rodízio de variações.
2. Revisar as mudanças locais de worker/campanha que reduzem os contadores de envio esperados.
3. Após a decisão, corrigir e repetir somente os 8 testes falhos, então a suíte completa.
4. Para REQ-502/503, 511, 515, 578 e itens correlatos: autorizar uma preferência descartável ou conta de teste para testar salvar/recarregar sem tocar na operação real.

## Correções de campanhas e auditoria REQ-700–1000 — 30/10/2026

### Falhas não relacionadas à IA corrigidas

- A validação de números mantém a sugestão de variação de telefone, e o teste agora confirma a consulta adicional somente para um número não cadastrado, além do cache da consulta original.
- A proteção contra envio a contatos importados não cadastrados foi preservada. Os cenários de entrega agora registram explicitamente, no conector fictício, que seus contatos de teste são cadastrados antes de simular o envio.
- A rotação de campanhas preserva o texto-base como primeira abordagem e alterna pelas variações seguintes; o teste passou a cobrir as três posições.
- Os seis cenários afetados passaram: validação/caching, rascunho e intervalo de campanha, transição de etiqueta, fila de servidor, macro e rotação de variações.
- Antes desse refinamento, a suíte integral executou com **202/202 aprovados**. Após preservar as funcionalidades locais, os seis testes alterados e `npm run typecheck` foram repetidos e aprovados; uma nova execução integral ainda é a próxima regressão recomendada.

### REQ-700–1000

O inventário atual contém somente quatro requisitos nesta faixa: REQ-700 a REQ-703; não há REQ-704–1000 cadastrados em `REVISAO/REQUISITOS.md`.

| REQ | Estado | Evidência |
| --- | --- | --- |
| 700 | Confirmado por suíte | Controle de habilitação de IA por operação, persistência e autorização administrativa passaram na suíte completa. |
| 701 | Confirmado por suíte | Recursos de IA ocultam quando desabilitados, preservando ferramentas manuais; cenário aprovado. |
| 702 | Confirmado por suíte | Reabilitação preserva configurações e não inicia o robô; cenário aprovado. |
| 703 | Confirmado por suíte | Não houve chamada a provedor real nem uso de chave real; o comportamento fica adiado por definição do requisito. |

Não foi alterada a configuração real de IA nem cadastrada chave de provedor nesta auditoria.

## Lote inicial de 200 pendências — 30/10/2026

### Delimitação

- Foram selecionadas as primeiras 200 pendências ativas em ordem de REQ: **REQ-001 a REQ-243** (há lacunas porque itens completos ou cancelados não entram no lote).
- O lote contém **156 REQs parciais** e **44 a verificar**. Não foram promovidas artificialmente a “completas”: as que exigem equipamento real, conta adicional, mensagem, upload, exclusão ou alteração persistente permanecem com esse limite explícito.
- A ausência de chave de IA passa a ser um bloqueio único de credencial. Não repetir geração, cadastro, edição, exclusão ou chamadas a provedor enquanto não houver uma chave de teste autorizada.

### Evidência visual sem gravação

- Chromium oculto, com sessão autenticada, abriu `https://notcua.vercel.app/atendimento` com título `Noctua · Atendimento`.
- Atendimento, Busca global (`Ctrl+K`, termo `Agenda`), Configurações e Biblioteca renderizaram. A Biblioteca exibiu cartões de conteúdo e filtros Textos, Áudios, Mídias, Documentos, Funis, Macros e PIX.
- CRM e negócios, Campanhas e Agenda foram abertos pela própria navegação da interface, somente para leitura.
- Personalização mostrou controles de logotipo e favicon. O editor completo de HUD não foi aberto por esse percurso e continua parcial; não foi forçado por uma alteração de preferência.
- Foram observados quatro erros genéricos de recurso `404` no console durante a navegação; sem URL associada nesta passagem, portanto não foram classificados como defeito de produto.

### Regressão

- `npm test`: **202/202 aprovados**, 0 falhas, em 331,5 s.
- A execução usa bancos e conectores fictícios; não enviou WhatsApp, e-mail, upload ou alteração de configuração real.

### Artefatos do lote

- `C:\Users\gusta\.codex\playwright-noctua-diagnostic\evidence\req-pending200-start.png`
- `C:\Users\gusta\.codex\playwright-noctua-diagnostic\evidence\req001-243-visual-safe-batch.json`
- `C:\Users\gusta\.codex\playwright-noctua-diagnostic\evidence\req001-243-navigation-readonly.json`
- Capturas `req001-243-*-readonly.png` e `req224-229-global-search-agenda.png` no mesmo diretório.

## Censo das 539 REQs ativas — 30/10/2026

Esta é a base de execução contínua solicitada para todas as pendências; não representa uma promoção automática de status.

| Situação atual | Quantidade | Tratamento de auditoria |
| --- | ---: | --- |
| Parcial | 296 | Retestar por tela ou por suíte isolada; preservar o limite de ações reais. |
| A verificar | 234 | Procurar prova executável ou classificar bloqueio específico. |
| Desconectada | 4 | REQ-419–422: os controles existem, mas não há consumidor localizado. Permanecem defeito de integração. |
| Precisa de decisão | 4 | REQ-316, 410, 526 e 573: não há decisão segura a inferir. |
| Ausente | 1 | REQ-430: não há índice vetorial/embeddings local. |

### Cobertura executável confirmada nesta rodada

- `npm test`: **202/202 aprovados** em banco e conectores fictícios.
- `npm run build`: aprovado para servidor e web. Permanece apenas o aviso de bundle web acima de 500 kB.
- São 29 arquivos de teste, cobrindo acesso, IA sem provedor real, atendimento, backup, CRM, fluxos, HUD, mídia, operações, sandbox e WhatsApp simulado.
- Navegação oculta adicional confirmou Autoatendimento (Fluxos de conversa), Espaço de Teste e Ajuda e configurações, com os tópicos Conexões, Autoatendimento, Campanhas/Excel e Atendimento/equipe/atalhos.

### Bloqueio de IA único

Sem chave de IA autorizada, não serão repetidos os cenários que cadastram, editam, excluem ou acionam credenciais de provedor (incluindo REQ-130, 152–156, 279, 360–372, 383–391, 414–443 e 544–555). A cobertura local que usa respostas simuladas continua válida; chamadas reais permanecem fora do escopo.

### Itens que não podem ser finalizados automaticamente

- Integrações reais: WhatsApp, e-mail, Vercel, Firebase, túnel, contas conectadas e publicação.
- Ações persistentes na operação: upload, exclusão, fixação, envio, convite, cadastro de chave, alteração de preferência ou criação de conta.
- Dispositivos/ambientes externos: iPhone, navegador físico secundário, segundo monitor e janela externa real.

### Leitura visual adicional do lote amplo

- O menu contextual do Atendimento abriu no Chromium oculto e mostrou as ações seguras de navegação (`Voltar à página anterior`, `Atualizar página`, `Copiar endereço desta página`) e a orientação para preservar o menu do navegador com Shift + botão direito. Nenhuma ação foi executada.
- No caminho `Personalizar → HUD, atalhos, botões e aparência`, as abas Painéis, Botões, Funções, Atalhos, Mensagens fixadas, Teclas de atalho e Posição livre, além de Prévia/Cancelar/Confirmar, renderizaram na sessão atual. Nada foi confirmado ou salvo.
- Uma varredura de implementações pendentes não encontrou marcadores `TODO`/`FIXME` de funcionalidade no código do produto. As exceções localizadas são validações ou mensagens de erro deliberadas; a ausência confirmada permanece REQ-430 (índice vetorial local).
- Evidências: `req660-687-context-menu-readonly.{json,png}` e `req214-216-492-514-hud-readonly-current.{json,png}` em `C:\Users\gusta\.codex\playwright-noctua-diagnostic\evidence`.

## Protocolo local — lote Operação e IA (REQ-128–158) — 30/10/2026

- O lote local encerrou 30 pendências: **24 COMPLETO** e **6 COMPLETO-LOCAL**; REQ-147 já estava completa e não foi refeita.
- Playwright local: **18/18 aprovados** em 1366×768, 1920×1080 e 390×844.
- Servidor local: **19/19 aprovados** com SQLite temporário, mensageria fictícia e provedores simulados.
- IA real permanece opcional, desligada e fora do escopo. REQ-130, 140, 141 e 152 não devem voltar a solicitar chave; a eventual prova real está isolada em `REVISAO/CHECKLIST-MANUAL.md`.
- REQ-139 e REQ-150 ficaram COMPLETO-LOCAL porque a última prova depende, respectivamente, de reconexão WhatsApp real e recebimento multimídia em aparelho.
- Evidências individuais foram gravadas em `REVISAO/evidencias/REQ-128/` a `REQ-158/`, exceto REQ-147, preservada da auditoria anterior.
- Contagens após o lote: 222 A VERIFICAR; 156 COMPLETO; 13 COMPLETO-LOCAL; 252 PARCIAL; 50 canceladas/substituídas; 5 decisões; 4 desconectadas; 1 ausente.

## Protocolo local — lote Interface global (REQ-159–198) — 30/10/2026

- O lote encerrou 33 pendências: **27 COMPLETO**, **2 COMPLETO-LOCAL** e **4 PRECISA DE DECISÃO**. Os requisitos 160, 162, 163, 170, 183, 186 e 192 já estavam encerrados e foram preservados.
- Playwright local: **36/36 aprovados** em 1366×768, 1920×1080 e 390×844, com capturas e JSON individuais em `REVISAO/evidencias/REQ-159/` a `REQ-198/` para os itens executados.
- Servidor local selecionado: **8/8 aprovados** para arquivamento, equipe/setor, diretório/presença, segmentação, saneamento/busca de contatos, biblioteca e zona de segurança.
- `npm run typecheck`: aprovado para servidor e web.
- Regressão integral após o último refinamento: `npm test` com **202/202 aprovados**, 0 falhas, em 171,7 s.
- O teste de diretório da REQ-169 foi tornado independente: o próprio cenário agora cria o setor Comercial em vez de depender do estado deixado por um teste anterior. Nenhum código funcional do produto foi alterado neste lote.
- REQ-164 e REQ-198 ficaram COMPLETO-LOCAL porque a última prova depende de outro navegador/aparelho físico; os passos foram isolados em `REVISAO/CHECKLIST-MANUAL.md`.
- REQ-194–197 ficaram como decisão, pois “todas as telas”, “padronizar”, “animar páginas” e “todos os botões” não definem inventário nem tolerâncias objetivas. Cada linha registra a pergunta mínima necessária para fechar o aceite.
- Produção permaneceu somente leitura; uploads, cadastros, agendamentos, arquivos, campanhas e preferências foram exercitados exclusivamente no SQLite local descartável, sem envio de WhatsApp e sem chave real de IA.
- Contagens após o lote: **196 A VERIFICAR; 183 COMPLETO; 15 COMPLETO-LOCAL; 245 PARCIAL; 50 canceladas/substituídas; 9 decisões; 4 desconectadas; 1 ausente**. O ledger contém 703 IDs únicos, sem lacunas ou duplicatas.

## Lote IA e mídia — REQ-360–391 — 30/10/2026

- Fechado: 15 COMPLETO, 16 COMPLETO-LOCAL, 1 DEFEITO (REQ-381). BUG-022 documenta vídeo sem compressão; BUG-023 registra atalho móvel do Estúdio de IA corrigido.
- Prova: Playwright 24/24 em três viewports; servidor 208/208; typecheck/build passaram. 96 arquivos de evidência individuais. Nenhuma falha E2E; aviso React `src` vazio preservado no JSON. HTTP 409 da conexão fictícia foi isolado no fixture.
- IA executada apenas com provedor simulado; nenhuma chamada externa. Banco `.audit/noctua-audit.db` não resetado.
- Próximo: Automações, REQ-392.

## Lote Automações — REQ-392–413 — 30/10/2026

- Fechado: 2 COMPLETO, 14 COMPLETO-LOCAL, 2 AUSENTE, 1 DECISÃO e REQ-410 cancelada; 404–405 preservadas.
- Playwright 15/15 em três viewports; servidor 213/213; typecheck e build passaram. Correção BUG-024 permite carregar regras de opt-out após resposta assíncrona; reteste pós-reload passou.
- Falhas resolvidas: seletores duplicados e fixture de conversas vazia ajustados no E2E; formulário inicial de follow-up já vinha com duas etapas; teste REQ-131 foi isolado para comparar apenas envios criados durante o próprio caso.
- Evidências em `REVISAO/evidencias/REQ-392/` a `REQ-413/`; 408/409 documentam função ausente; REQ-401 inclui pergunta de escopo; REQ-410 registra decisão já aprovada.
- Próximo: Economia de IA, REQ-414. Nenhuma chave real.

## Lote Economia de IA — REQ-414–443 — 30/10/2026

- Avaliadas 30 REQs: 10 `COMPLETO`, 14 `COMPLETO-LOCAL`, 1 `DEFEITO` (REQ-425), 4 `DESCONECTADO` (419–422) e 1 `AUSENTE` (430). As quatro desconectadas e a ausente já tinham esse estado; 25 estados mudaram.
- Playwright: 9/9 em 1366×768, 1920×1080 e 390×844. Cobriu a aba Economia, controles, salvar/reabrir, cache, métricas diária/mensal, revisão de prompt e ausência de embeddings.
- Servidor integral: 218/218; typecheck servidor/web passou; build passou com aviso existente de bundle web 597,52 kB. O teste novo do endpoint de limpeza de cache passou isolado.
- Corrigido BUG da REQ-423: API e tela exibem totais distintos de tokens/chamadas hoje e no mês. BUG-025 aberto: cache chamado semântico só usa Jaccard/sinônimos limitados. Nenhum embedding/serviço externo.
- Falhas de teste resolvidas: seletor E2E deixou de usar ancestral amplo e passou a localizar checkbox por nome acessível; API inválida retorna 422 (expectativa corrigida); fixture de métricas agora isola estado; fixture de cache vencido ganhou telefone próprio após colidir com conversa do teste de resumo e disparar duas chamadas.
- Evidências individuais em `REVISAO/evidencias/REQ-414/` a `REQ-443/`; todas as escritas ocorreram em rotas mockadas E2E ou SQLite temporário da suíte. Banco `.audit/noctua-audit.db` preservado. API/front existentes confirmados HTTP 200.
- Pendências técnicas visíveis: REQ-425/BUG-025, REQ-430 embeddings locais ausentes, REQ-419–422 sem consumidores. A IA real segue desativada e não foi chamada.
- Próximo módulo: Ferramentas laterais e respostas padrão, REQ-444–469. REQ-461–464 e REQ-466 têm formato/aceite ambíguo; seguir evidências e deixar decisão explícita no ledger, sem envio real.
## Auditoria L-20 — Infraestrutura (REQ-520–543) — 30/10/2026

- Auditoria local/estática sem Vercel CLI, Firebase, túnel ou produção; `http://127.0.0.1:3340/atendimento` respondeu HTTP 200. O arquivo raiz `npx` não existe.
- Provas focais aprovadas em bancos temporários descartáveis: REQ-521 enviou corpo JSON >100 MiB pela API, recebeu 202 e confirmou importação completa de mídia de 76 MiB; REQ-526 confirmou IA desativada sem chave, sem chamada externa e sem reserva/custo. Não foi aberto nem alterado `.audit/noctua-audit.db`.
- Estados atualizados: REQ-521 e REQ-526 `COMPLETO-LOCAL`; REQ-535, 538, 539 e 543 `COMPLETO`. Evidências individuais em `REVISAO/evidencias/REQ-521/`, `REQ-526/`, `REQ-535/`, `REQ-538/`, `REQ-539/` e `REQ-543/`.
- Requisitos preservados como parciais/pendentes quando a prova exigiria ação proibida ou informação do proprietário: persistência sem PC para API (REQ-523), conta/configuração conectada de escopo ainda não determinado (REQ-527), reconexão de conta WhatsApp real (REQ-530), partida controlada do iniciador (REQ-533/541), saída de console (REQ-534), identificadores públicos Firebase locais (REQ-540), e publicação (REQ-542).
- `npm run audit:ledger`: 356 REQs com teste vinculado, 347 sem. Totais: 369 COMPLETO, 87 COMPLETO-LOCAL, 93 PARCIAL, 70 A VERIFICAR, 51 substituídos/cancelados, 23 decisões (2 confirmadas), 4 desconectados, 3 defeitos e 3 ausentes.
- Próximo lote: L-21, chaves de IA e geração (REQ-544 em diante). Não repetir pedido de chave real; usar apenas provedor simulado e respeitar a decisão gratuita registrada no protocolo.

## Auditoria L-21 — chaves de IA e geração (REQ-544–555) — 30/10/2026

- Fechadas 12 REQs: 10 `COMPLETO` e 2 `COMPLETO-LOCAL` (REQ-546 e REQ-555). Chaves foram exclusivamente fictícias, cifradas em teste SQLite temporário; os erros do Gemini foram simulados pelo `fetch` mockado. Nenhuma chave real ou chamada externa.
- Testes finais: servidor 2/2 (um teste cobre CRUD da chave principal/adicionais e outro testa rotação diária e erros não diários); Chromium Playwright 3/3 em 1366×768, 1920×1080 e 390×844; typecheck do servidor aprovado. Capturas individuais em `REVISAO/evidencias/REQ-547/`, `REQ-548/` e `REQ-552/`–`REQ-554/`; provas servidor em `REQ-544`–`REQ-546` e `REQ-548`–`REQ-551`.
- Ajustes do teste: seletores da primeira rodada usaram nomes não exibidos (“Mostrar...” com painel já aberto e “Ocultar configurações...” em vez de “Ocultar chaves de API”); texto exato foi conferido no componente, o teste passou após correção. Um comando inicial do servidor procurou `test/operations.test.ts` na raiz do monorepo; repetido no diretório `apps/server`, passou. Sem defeito do produto.
- `npm run audit:ledger`: 368 REQs com teste vinculado, 335 sem. Totais: 379 COMPLETO, 89 COMPLETO-LOCAL, 93 PARCIAL, 58 A VERIFICAR, 51 substituídos/cancelados, 23 decisões (2 confirmadas), 4 desconectados, 3 defeitos e 3 ausentes.
- Próximo lote: L-22, Qualidade e documentação (REQ-556–573). REQ-573 continua adiada conforme §6; não solicitar Parte 8 de novo.

## Auditoria L-22 — Qualidade e documentação (REQ-556–573) — 30/10/2026

- Fechadas 16 REQs: 14 `COMPLETO`, 2 `COMPLETO-LOCAL` (REQ-565/566). REQ-567 virou `PRECISA DE DECISÃO` porque “enquanto dorme” não define horários, filas nem retomada automática. REQ-573 continua adiada até Parte 8 e fora da contagem.
- Playwright REQ-562: 3/3 em desktop 1366×768, desktop 1920×1080 e mobile 390×844; QR/resposta foi fictício e o botão Conectar não foi acionado. Teste servidor REQ-570: 1/1, WAV sintético virou OGG/Opus PTT via socket fictício. Nenhuma mensagem externa enviada.
- Checklist pessoal, formato Notion, arquitetura Mermaid, relatório por sistema e checkpoints foram verificados. Registros históricos de 25/26 de outubro confirmam escopo do contato autorizado, follow-up cancelado e reprodução de áudio no iPhone; não foram repetidos.
- Evidências individuais em `REVISAO/evidencias/REQ-556/` a `REQ-572/`; procedimento físico REQ-565 em `REVISAO/CHECKLIST-MANUAL.md`. O conteúdo do checklist Notion foi atualizado: testes externos históricos não são autorização atual; produção segue somente leitura.
- `npm run audit:ledger`: 370 REQs com teste vinculado, 333 sem. Totais: 393 COMPLETO, 91 COMPLETO-LOCAL, 93 PARCIAL, 41 A VERIFICAR, 51 substituídos/cancelados, 24 decisões (2 confirmadas), 4 desconectados, 3 defeitos e 3 ausentes.
- Próximo lote: L-23, painéis encaixáveis e recuperação de controles (REQ-574 em diante).

## Auditoria Sandbox e suporte — complemento REQ-337/338/339/343/345/346/351/352 — 30/10/2026

- O módulo já tinha 21 REQs com prova. Foram fechadas as 8 lacunas sem teste vinculado, preservando os estados finais existentes.
- e2e/sandbox-support-gaps.spec.ts: 24/24 em 1366×768, 1920×1080 e 390×844; REQ-345 repetida 3/3 após correção. Capturas e JSON individuais em REVISAO/evidencias/REQ-337/, REQ-338/, REQ-339/, REQ-343/, REQ-345/, REQ-346/, REQ-351/ e REQ-352/.
- Suíte completa do servidor: 220/220. Banco .audit/noctua-audit.db preservado, sem reset; mutações de API e chamadas externas foram bloqueadas nos testes visuais.
- BUG-030 corrigido: Chromium do Playwright não decodificava o MP4 H.264/AAC; exemplo trocado por WebM VP8 local sem mudar o resultado esperado.
- API local 127.0.0.1:3340/atendimento respondeu HTTP 200. Console registrou somente falhas esperadas de https://apis.google.com, bloqueado pela isolação do teste; zero erros de página.
- scripts/iniciar-noctua-online.ps1 permanece fora de staging/commit. Nenhuma publicação foi executada.
- Próximo lote do protocolo: L-23, painéis encaixáveis e recuperação de controles, começando REQ-574.

- Typecheck geral passou após corrigir dois tipos do fixture de teste de chaves; nenhuma asserção ou resultado esperado foi alterado.

## Lote L-23 — Painéis encaixáveis e recuperação — 30/10/2026

- Fechadas 22 REQs (574–595): todas COMPLETO; nenhum estado anterior foi sobrescrito fora do lote.
- Playwright e2e/dock-panels.spec.ts: 66/66 em Chromium, desktop 1366×768 e 1920×1080, mobile 390×844; 66 JSON APROVADO e 72 PNG, incluindo seis capturas de pop-out.
- Sem erros de página ou falhas de asserção. Houve 22 erros de console móveis por https://apis.google.com bloqueado intencionalmente pelo isolamento de rede. Mutações da API foram interceptadas nos testes visuais.
- REQ-578 também passou 1/1 em apps/server/test/access.test.ts: dockingLayout e dockingEnabled foram salvos e lidos após abrir novo cliente SQLite temporário; .audit/noctua-audit.db preservado (2.039.808 bytes, timestamp 30/10/2026 15:07:20).
- Falha inicial do runner antes das asserções: uv_os_get_passwd ... ENOMEM em tsx no Windows isolado. Contornada com preload CommonJS temporário em %TEMP% e NODE_OPTIONS com caminho normalizado; nenhum pacote/dependência foi alterado. A execução final passou.
- Não foram encontrados defeitos de produto; falhas anteriores de seletor/setup no E2E foram corrigidas e retestadas conforme evidências. Nenhuma produção acessada.
- Próximo lote: L-24 Etiquetas e leads, REQ-596–602. REQ-603–608 já completas; preservar sem reexecutar.

## Lote L-24 — Etiquetas e leads — 30/10/2026

- Fechadas 7 REQs (596–602): todas COMPLETO; REQ-603–608 preservadas sem repetição.
- Playwright e2e/labels-leads.spec.ts: 21/21 em Chromium, 1366×768, 1920×1080 e 390×844; 21 JSON APROVADO e 21 PNG nas pastas individuais.
- Teste de servidor focado em apps/server/test/operations.test.ts: 1/1. Verificou GET da regra salva, 409 sem confirmação, 422 sem valor, venda única, ROI de 400%, remoção da receita ao reabrir a oportunidade, nota interna, fixação e zero envios pelo socket fictício.
- Nove erros de console foram chamadas de https://apis.google.com bloqueadas pela isolação nos casos mobile; zero erros de página e zero outras falhas de console.
- Writes de API nos testes visuais foram interceptados. Teste de servidor usou SQLite em pasta temporária removida no teardown. .audit/noctua-audit.db preservado (2.039.808 bytes, 30/10/2026 15:07:20); API e front existentes responderam HTTP 200.
- Nenhum defeito novo confirmado; sem mudança de app e sem entrada nova em BUGS.md. Produção não acessada.
- Próximo lote: Revisão e menu contextual; tratar somente pendentes 660–668, 673, 675, 676, 678, 680, 682 e 684–687. Preservar as REQs já finais.
