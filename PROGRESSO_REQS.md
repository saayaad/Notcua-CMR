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
