AUDITORIA DO NOCTUA — PROTOCOLO

(Salve este texto em REVISAO/PROTOCOLO.md e siga-o em todas as sessões.)

META

Levar as 296 REQs "Parcial" e as 234 "A verificar" de REVISAO/REQUISITOS.md a um ESTADO FINAL, cada uma com prova individual. "Parcial" e "A verificar" deixam de ser estados finais.

## 1) ONDE PODE E ONDE NÃO PODE MEXER

PRODUÇÃO (notcua.vercel.app, WhatsApp real, banco real, Vercel, Firebase, túnel): SOMENTE LEITURA. Não enviar mensagem, não subir nem excluir arquivo, não salvar preferência, não mexer em chave, não publicar, não dar push na main.

AMBIENTE DE TESTE LOCAL: você tem autorização TOTAL e permanente para criar, editar, salvar, recarregar, subir arquivos que você mesmo gerar, excluir, resetar, criar contas/papéis de teste e cadastrar chave FALSA. Não peça confirmação para nada disso. O ambiente usa:

- servidor local com SQLite temporário (nunca o banco real);
- WhatsApp FICTÍCIO (o conector dos testes / Espaço de Teste): nenhum envio real;
- IA com provedor SIMULADO: nenhuma chamada real;
- front local ligado ao servidor local, sem login real (use o modo sem Firebase se existir; senão o Firebase Auth Emulator). Qualquer atalho de login só pode existir fora do build de produção;
- Playwright próprio (headless), não o navegador do chat; viewports 1366x768, 1920x1080 e celular emulado 390x844.

Dados de teste sempre fictícios (e-mails @example.com, telefones inventados).

## 2) PREPARAÇÃO (uma vez, antes de testar qualquer REQ)

a) Crie a branch auditoria-reqs, faça commit de TODAS as alterações locais e dê push só dessa branch. Se o push pedir login, avise no fim desta etapa e continue.

b) Crie `npm run audit:dev` (sobe servidor + front locais com dados de exemplo: contatos, conversas, biblioteca, funis, etiquetas e 2 usuários com papéis diferentes) e `npm run audit:reset` (apaga e recria tudo).

c) Crie a pasta e2e/ com Playwright. Todo teste leva o ID da REQ no título, ex.: test('REQ-215 densidade Média persiste após recarregar'). Todo teste precisa afirmar o resultado esperado ("a tela abriu" não conta). Evidências em REVISAO/evidencias/REQ-xxx/.

d) Crie `npm run audit:ledger`: cruza REVISAO/REQUISITOS.md com os IDs encontrados nos testes e gera REVISAO/LEDGER.csv, 1 linha por REQ (id, módulo, tela, estado, tipo_de_prova, teste, evidência, resultado, bloqueio, data, commit). O LEDGER é a fonte única de status; não escreva novos relatórios narrativos.

e) Rode e me mostre SÓ as contagens: REQs com teste vinculado × sem teste.

## 3) CLASSIFICAR (sem testar ainda)

Para cada REQ pendente, escreva 1 frase com o critério de aceite verificável e o tipo de prova:

A = teste automatizado de regra (servidor/API)

B = teste no navegador, ambiente local (inclui "salvar, recarregar e continuar salvo")

C = exige algo externo: WhatsApp real, iPhone/Android físico, 2º monitor, janela externa real, e-mail real, chave real de IA

D = depende de decisão minha (inclui REQ vaga demais para virar critério: escreva a pergunta em 1 linha)

E = controle sem efeito ou função inexistente

REQs que descrevem a mesma função podem dividir um teste, mas cada uma precisa de pelo menos uma asserção própria com o seu ID. Agrupe por MÓDULO/TELA, não por número.

## 4) EXECUTAR EM LOTES (repita até acabar)

Lote = 1 módulo (20 a 50 REQs). Para cada REQ tipo A ou B:

1. escreva ou ajuste o teste e rode;
2. passou → COMPLETO, com evidência;
3. falhou → abra BUG-xxx em REVISAO/BUGS.md com passos para reproduzir; se a correção for pequena e segura, corrija, rode de novo e depois rode a suíte inteira; senão fica DEFEITO;
4. máximo de 2 tentativas por REQ. Travou? Registre o motivo e vá para a próxima; não investigue o navegador ou a ferramenta além disso.

Não enfraqueça teste nem mude regra de negócio só para passar. Não refaça REQs que já têm evidência.

Fim do lote: atualize LEDGER.csv e REQUISITOS.md, faça commit na branch e comece o próximo lote SEM esperar minha resposta.

## 5) ESTADOS FINAIS (toda REQ termina em um destes)

COMPLETO — critério escrito + teste passando + (se grava dado) persistência após recarregar + evidência + commit.

COMPLETO-LOCAL — provado no ambiente local; só falta a prova externa (tipo C), que vai para REVISAO/CHECKLIST-MANUAL.md.

DEFEITO — falhou; BUG aberto.

DECISÃO — depende de mim.

DESCONECTADA ou AUSENTE — propor ligar a função ou retirar o controle da tela.

É proibido marcar COMPLETO só porque o código existe, porque a suíte geral está verde ou porque a tela abriu.

## 6) DECISÕES JÁ TOMADAS (não pergunte de novo)

- IA: opcional e desligada por padrão; testar só com provedor simulado. O que exigir chave real vira COMPLETO-LOCAL (tipo C) e não conta como pendência.
- REQ-316: inatividade = pelo menos X dias.
- REQ-410: não implementar; marcar como cancelada.
- REQ-526: só serviços gratuitos; sem cota, a IA pausa e o resto do app segue normal.
- REQ-573: adiada até eu enviar a Parte 8; fora da contagem.

## 7) COMO ME REPORTAR

Durante os lotes: nada de narrativa.

Ao parar: tabela antes × depois por estado, IDs que mudaram, defeitos novos e UMA lista única do que só eu posso fazer (decisões + CHECKLIST-MANUAL.md, com passo a passo de 3 linhas por item, agrupado por aparelho/serviço).

Só pare quando a lista acabar ou quando precisar de algo que só eu posso fazer (junte tudo numa lista e pare).

Se a sessão cair e eu escrever "continue": releia REVISAO/PROTOCOLO.md e REVISAO/LEDGER.csv e processe o próximo lote.

## Ponto de retomada — 30/10/2026

- Lote Mensagens REQ-236–268 atualizado: 19 `COMPLETO`, 10 `COMPLETO-LOCAL`, itens anteriormente completos preservados; BUG-017/018/019 registrados em BUGS.md. Ledger regenerado após regressão: servidor 206/206; Playwright 36/36; build/typecheck aprovados.
- Evidências Playwright por requisito em `REVISAO/evidencias/REQ-236/` a `REQ-268/`; 18 casos de mensagens, 9 de mídia e 9 de IA simulada aprovados em três viewports. Servidor `attendance.test.ts` + `whatsapp.test.ts`: 40/40 aprovados com banco/socket fictícios.
- REQ-263/264/265 e 267 estão `COMPLETO-LOCAL`; checklist externo detalha a validação futura em aparelho/WhatsApp descartável. Nada foi enviado ao WhatsApp de produção.
- Os serviços locais do usuário continuam ativos em `127.0.0.1:5180` e `127.0.0.1:3340`; usar `AUDIT_USE_RUNNING_SERVER=1`. Banco confirmado `.audit/noctua-audit.db`; não resetar nem subir serviços adicionais.
- Próximo lote: módulo Campanhas e agenda, iniciando REQ-269. Não tocar em produção, Firebase, chaves reais, Vercel ou `.env.local`.
- Conforme instrução mais recente do usuário/AGENTS.md, após cada falha registrar mensagem completa, corrigir uma causa real e retestar; não repetir o mesmo teste sem alteração e não parar pelo limite de tentativas antigo.

## Ponto de retomada — 30/10/2026 — após Campanhas e agenda

- Lote REQ-269–297 fechado: 25 `COMPLETO`, REQ-279 `COMPLETO-LOCAL`; REQ-272–274 preservadas. BUG-020 corrigido e anotado. Evidências individuais em `REVISAO/evidencias/REQ-269/`–`REQ-297/` (sem reexecutar 272–274).
- Playwright final `e2e/campaigns.spec.ts`: 18/18 aprovados em 1366×768, 1920×1080 e 390×844; persistência pós-reload em rascunhos, contato/agendamento, equipe e Biblioteca. Dados exclusivamente fictícios no banco `.audit/noctua-audit.db`; rascunhos cancelados, nenhum envio.
- Contagens após o lote: 179 A VERIFICAR; 251 COMPLETO; 30 COMPLETO-LOCAL; 178 PARCIAL; 50 cancelados/substituídos; 10 decisão; 4 desconectados; 0 com defeito; 1 ausente.
- Próximo lote: REQ-298–327, módulo Exportação e operação. Retomar sem reiniciar os serviços locais; não resetar o banco.
- Regressão final pós-lote Campanhas: servidor 206/206, typecheck aprovado, build aprovado com aviso de bundle >500 kB, Playwright 18/18 em três viewports.

## Ponto de retomada — 30/10/2026 — após Exportação e operação

- Lote REQ-298–327 fechado; regressão Playwright 48/48 e operações de servidor 51/51. Ledger: 197 REQs com teste vinculado, 506 sem.
- Estado global: 162 A VERIFICAR; 268 COMPLETO; 38 COMPLETO-LOCAL; 171 PARCIAL; 50 canceladas/substituídas; 9 decisões pendentes; 2 decisões confirmadas; 4 desconectadas; 1 ausente.
- 25 REQs mudaram: 17 COMPLETO e 8 COMPLETO-LOCAL. Evidências em `REVISAO/evidencias/REQ-298/`–`REQ-327/`. `.audit/noctua-audit.db` preservado; servidor do usuário respondeu HTTP 200 em `127.0.0.1:3340/atendimento`.
- Próximo módulo: Sandbox e suporte, REQ-328–356. Preservar REQ-357–359 já completas. Siga usando os serviços existentes; não resetar banco nem tocar em produção.
- `scripts/iniciar-noctua-online.ps1` continua fora do commit: muda a raiz usada para CLI Vercel e arquivos de vínculo, portanto pode mudar a origem da publicação. Nenhuma publicação foi executada.

## Ponto de retomada — 30/10/2026 — após Sandbox e suporte

- REQ-328–356 avaliadas; 21 estados mudaram (18 COMPLETO, 3 COMPLETO-LOCAL). REQ-357–359 preservadas. Playwright: 9/9 casos (27 execuções em três viewports); operações: 52/52.
- BUG-021 fechado: fala pt-BR sintética no áudio de exemplo e transcrição coincidente. Evidências em `REVISAO/evidencias/REQ-328/`–`REQ-356/` para os itens testados.
- Contagem global: 149 A VERIFICAR; 286 COMPLETO; 41 COMPLETO-LOCAL; 163 PARCIAL; canceladas/substituídas e bloqueios mantidos.
- Front e API do usuário em `127.0.0.1:5180` / `127.0.0.1:3340`; Vite aponta ao endereço de API fornecido via `VITE_API_URL`. SQLite `.audit/noctua-audit.db` não foi resetado. Nenhuma produção tocada.
- Próximo módulo: IA e mídia, REQ-360. Não solicitar chave; IA real não está disponível. Prova permitida: provedores simulados locais; recursos que dependem de chave ficam COMPLETO-LOCAL.


## Ponto de retomada — 30/10/2026 — após IA e mídia

- REQ-360–391 fechadas: 15 `COMPLETO`, 16 `COMPLETO-LOCAL`, 1 `DEFEITO` (REQ-381). BUG-022 aberto para compressão de vídeo ausente; BUG-023 corrigido para atalho móvel do Estúdio de IA.
- `e2e/ai-media.spec.ts`: 24/24 aprovações Playwright em 1366×768, 1920×1080 e 390×844; rotas de upload, envio e provedor foram simuladas. Servidor: 208/208. Typecheck e build web passaram; build mantém aviso de bundle principal 597 kB.
- Teste registrou aviso React de `src` vazio. Recibo de leitura da conversa fictícia retornava HTTP 409 porque a conexão de WhatsApp está desconectada; fixture passou a interceptar essa rota. Nenhuma página sofreu erro e as provas foram repetidas.
- API e front existentes responderam HTTP 200 em `127.0.0.1:3340/atendimento` e `127.0.0.1:5180/`. Banco `.audit/noctua-audit.db` não foi resetado. Sem chave de IA real; nenhum serviço externo foi chamado.
- Próximo módulo: Automações, começando REQ-392. Continuar em local e fechar cada lote com ledger, evidências, commit e push em `auditoria-reqs`.
- `scripts/iniciar-noctua-online.ps1` permanece fora do commit; diff preexistente não foi alterado nesta auditoria. O arquivo `npx` não existe na raiz.

## Ponto de retomada — 30/10/2026 — após Automações

- REQ-392–413 avaliadas: 2 `COMPLETO` (402–403), 14 `COMPLETO-LOCAL`, 2 `AUSENTE` (408–409), 1 `DECISÃO` (401), 1 cancelada (410). REQ-404–405 permaneceram intactas.
- Playwright: 15/15 em 1366×768, 1920×1080 e 390×844; rechecagem dos marcadores AUSENTE: 3/3. Servidor integral: 213/213. Typecheck e build web passaram; bundle 597,29 kB gera aviso >500 kB.
- Correção BUG-024: textarea de opt-out não refletia termos assíncronos. `key` baseada nos dados carregados força aplicação de configuração persistida; teste visual salva e confirma após reload. Primeiro regressão apontou também asserção global frágil em REQ-131; teste agora compara o delta de envios do próprio caso e a regressão integral passou.
- BUG-022 segue aberto para compressão de vídeo; BUG-023 e BUG-024 corrigidos localmente. Referral, opt-out, envio e validação usaram somente eventos, provedores e conectores fictícios.
- REQ-401 aguarda definição de eventos, destino do webhook e métricas. REQ-408/409 não possuem seleção multiconexão ou failover. REQ-410 foi cancelada pela decisão explícita da seção 6.
- API/front existentes responderam HTTP 200. `.audit/noctua-audit.db` preservado; produção só leitura.
- Próximo módulo: Economia de IA, REQ-414. Provedor simulado; não solicitar chave real.
- `scripts/iniciar-noctua-online.ps1` continua fora do commit. O arquivo raiz `npx` não existe.

## Ponto de retomada — 30/10/2026 — após Economia de IA

- REQ-414–443 fechadas: 10 `COMPLETO`, 14 `COMPLETO-LOCAL`, 1 `DEFEITO` (REQ-425/BUG-025), 4 `DESCONECTADO` (419–422) e 1 `AUSENTE` (430). 25 estados mudaram.
- Playwright 9/9 em três viewports; servidor 218/218; typecheck e build passaram. Evidências individuais em `REVISAO/evidencias/REQ-414/`–`REQ-443/`.
- BUG de REQ-423 corrigido: métricas separadas por dia e mês. Bundle web 597,52 kB mantém aviso >500 kB.
- Falhas de fixture/expectativa corrigidas e regressão integral repetida. Banco do usuário `.audit/noctua-audit.db` preservado; nenhum provedor de IA ou dado de produção foi acessado.
- REQ-425 segue em defeito: cache não entende equivalência semântica geral. REQ-430 sem embeddings; REQ-419–422 mostram flags sem consumidores. Nenhuma chave real foi solicitada.
- Próximo módulo: Ferramentas laterais e respostas padrão, REQ-444–469. Avaliar critérios ambíguos por item e registrar decisões sem envio de WhatsApp.
- `scripts/iniciar-noctua-online.ps1` permanece modificado previamente e fora de qualquer commit.

## Ponto de retomada — 30/10/2026 — após Ferramentas laterais/Atendimento

- Lote REQ-444–487 fechado: 25 `COMPLETO`, 14 `DECISÃO` e 1 `DEFEITO` (REQ-464/BUG-026); quatro itens já completos foram preservados.
- Playwright `e2e/side-tools.spec.ts`: 30/30 em três viewports; suíte integral do servidor: 219/219; typecheck e build passaram. Ledger: 326 REQs com teste vinculado e 377 sem.
- BUG-027/028/029 corrigidos localmente. BUG-026 permanece aberto: ação de macro anuncia figurinha, mas seletor/dispatch não oferece suporte a sticker.
- Evidências visuais em `REVISAO/evidencias/REQ-444/` até `REQ-487/` para os itens exercitados. `.audit/noctua-audit.db` preservado, organização temporária restaurada e nenhuma mensagem enviada.
- Próximo lote pela lista: L-18, REQ-488 em diante. Continuar com o ambiente local existente, sem reset e sem acesso de escrita à produção.
- `scripts/iniciar-noctua-online.ps1` permanece fora do commit por alterar a raiz de execução dos comandos Vercel; mudança já explicada. O arquivo `npx` não está na raiz.

## Ponto de retomada — 30/10/2026 — após Atendimento e Personalização

- Lote REQ-488–503 avaliado: 15 `COMPLETO`; REQ-499 em `DECISÃO` quanto a remover também teclas numéricas configuráveis.
- Playwright `e2e/personalization-attendance.spec.ts`: 15/15 testes (45 execuções) nos três viewports; evidências em `REVISAO/evidencias/REQ-488/`–`REQ-503/`. Ledger: 342 com teste vinculado, 361 sem.
- As preferências visuais foram interceptadas no fixture de teste. Nenhum dado foi escrito no banco `.audit`, nenhuma mensagem foi enviada e nenhuma produção foi acessada.
- Correção no teste: informar a versão 3 de personalização para a normalização não ocultar todos os atalhos; seletores corrigidos para os nomes e destinos reais, com validação mobile responsiva.
- Próximo lote: L-19, iniciando REQ-507. Manter local, sem reset do banco; script Vercel permanece fora do commit.

## Ponto de retomada — 30/10/2026 — após revisão do HUD

- Lote REQ-507–519 avaliado: 12 `COMPLETO`; REQ-512 segue `PARCIAL` enquanto os filhos ativos das Partes 1/2 não estiverem concluídos ou decididos.
- Regressão visual final `e2e/personalization-attendance.spec.ts`: 36/36; typecheck passou. Ledger: 354 com teste vinculado, 349 sem. Evidências em `REVISAO/evidencias/REQ-507/`–`REQ-519/`.
- REQ-510 confirmou arraste para colisão, encaixe e persistência sem sobreposição no desktop; mobile manteve o layout responsivo encaixado. Todos os writes de preferência foram interceptados pelo fixture, `.audit/noctua-audit.db` preservado.
- Sem defeitos novos. Próximo módulo: L-20, começando REQ-520; inspeção de infra permanece read-only conforme protocolo. Script Vercel fora do commit.

## Ponto de retomada — 30/10/2026 — após L-20 Infraestrutura

- REQ-521/526 receberam prova local: corpo de backup >100 MiB importado pela API persistente em SQLite temporário; IA sem ativação não faz chamada externa nem reserva custo. Ambas `COMPLETO-LOCAL` conforme política de serviços gratuitos e IA opcional.
- REQ-535/538/539/543 foram fechadas com documentação operacional e/ou publicação histórica verificável. L-20 registrou 6 alterações de estado no total; a ledger conta 356 com teste vinculado e 347 sem.
- API local `127.0.0.1:3340/atendimento` respondeu 200; arquivo `npx` na raiz não existe. Não houve acesso ao `.audit/noctua-audit.db`, a valores de `.env`, Vercel, Firebase, túnel, WhatsApp real ou produção.
- `scripts/iniciar-noctua-online.ps1` continua modificado e fora de staging/commit; não executar nem publicar com ele.
- Bloqueios conhecidos reunidos para avaliação final: REQ-523 hospedagem persistente/API sem PC; REQ-527 escopo das contas conectadas; REQ-530 conexão WhatsApp real; REQ-533/541 partida controlada do iniciador, que publica; REQ-534 saída do console; REQ-540 identificadores públicos Firebase locais; REQ-542 publicação na branch de produção.
- Próximo lote: L-21, chaves de IA e geração, REQ-544 em diante. Usar somente provedor simulado; a decisão de não exigir chave real e pausar a IA sem cota permanece válida.

## Ponto de retomada — 30/10/2026 — após L-21 chaves de IA

- REQ-544–555 foram avaliadas: 10 `COMPLETO`, 2 `COMPLETO-LOCAL`; ledger: 368 com teste, 335 sem. Testes: servidor 2/2, Playwright 3/3 em três viewports, typecheck aprovado.
- Chaves/API e respostas de cota foram fictícias; integração de UI mockada. Nenhum segredo real, chamada externa ou faturamento. Não pedir novamente chave de IA: usar simulador e respeitar serviços gratuitos/IA opcional.
- Duas falhas iniciais de seletor e uma tentativa com caminho de teste errado foram corrigidas e repetidas com sucesso; progresso descreve causas. Nenhum BUG de produto surgiu.
- Próximo lote: L-22, REQ-556–573. REQ-573 já está adiada até o proprietário enviar a Parte 8 e deve ficar fora da contagem, conforme §6.
- `scripts/iniciar-noctua-online.ps1` permanece fora de staging e commit.

## Ponto de retomada — 30/10/2026 — após L-22 Qualidade e documentação

- REQ-556–572 fechadas ou classificadas; REQ-573 permanece adiada conforme §6. Totais após L-22: 393 COMPLETO, 91 COMPLETO-LOCAL, 93 PARCIAL, 41 A VERIFICAR, 51 substituídos/cancelados, 24 decisões (2 confirmadas), 4 desconectados, 3 defeitos, 3 ausentes; 370 com teste e 333 sem.
- REQ-567 precisa de definição do período de sono, classes de fila e regra de retomada. Nenhum controle de envio foi alterado.
- REQ-565 exige conferência física em dois monitores e está no CHECKLIST-MANUAL. REQ-566 foi retomada após reinício do PC, sem simular BSOD.
- Prova de reconexão WhatsApp foi feita apenas com QR fictício na interface; botão não acionado. PTT testado em WAV fictício/socket. Áudio de iPhone e resposta de follow-up são provas históricas do contato de teste, não autorização para novos envios.
- Próximo lote: L-23, painéis encaixáveis e recuperação de controles (REQ-574 em diante). Produção continua somente leitura.
- `scripts/iniciar-noctua-online.ps1` permanece fora de staging/commit.

## Auditoria Sandbox e suporte — complemento REQ-337/338/339/343/345/346/351/352 — 30/10/2026

- O módulo já tinha 21 REQs com prova. Foram fechadas as 8 lacunas sem teste vinculado, preservando os estados finais existentes.
- e2e/sandbox-support-gaps.spec.ts: 24/24 em 1366×768, 1920×1080 e 390×844; REQ-345 repetida 3/3 após correção. Capturas e JSON individuais em REVISAO/evidencias/REQ-337/, REQ-338/, REQ-339/, REQ-343/, REQ-345/, REQ-346/, REQ-351/ e REQ-352/.
- Suíte completa do servidor: 220/220. Banco .audit/noctua-audit.db preservado, sem reset; mutações de API e chamadas externas foram bloqueadas nos testes visuais.
- BUG-030 corrigido: Chromium do Playwright não decodificava o MP4 H.264/AAC; exemplo trocado por WebM VP8 local sem mudar o resultado esperado.
- API local 127.0.0.1:3340/atendimento respondeu HTTP 200. Console registrou somente falhas esperadas de https://apis.google.com, bloqueado pela isolação do teste; zero erros de página.
- scripts/iniciar-noctua-online.ps1 permanece fora de staging/commit. Nenhuma publicação foi executada.
- Próximo lote do protocolo: L-23, painéis encaixáveis e recuperação de controles, começando REQ-574.

- Typecheck geral do repositório passou; foram ajustados apenas os tipos do fixture em pps/server/test/ai-feature.test.ts, sem mudar asserções ou resultados esperados.

## Lote L-23 — Painéis encaixáveis e recuperação — 30/10/2026

- REQ-574–595 fechadas: 22 COMPLETO. Playwright 66/66; 66 JSON e 72 PNG em REVISAO/evidencias/REQ-574/–REQ-595/. Desktop 1366×768/1920×1080; mobile 390×844 confirmou fallback clássico.
- REQ-578 também comprovou persistência de dockingEnabled/dockingLayout ao reabrir SQLite temporário (teste de servidor 1/1). Preferências visuais E2E mockadas; .audit/noctua-audit.db preservado, sem reset.
- Zero erros de página. Vinte e dois erros de console foram chamadas de apis.google.com bloqueadas de propósito nos casos mobile. Nenhuma falha de produto confirmada; sem entrada nova em BUGS.md.
- tsx inicialmente não rodou por uv_os_get_passwd ... ENOMEM; preload CommonJS temporário e caminho NODE_OPTIONS com barras / resolveram. Resultado final 1/1; nenhuma dependência alterada.
- Próximo lote: L-24, Etiquetas e leads, REQ-596–602; preservar REQ-603–608 já completas.

## Lote L-24 — Etiquetas e leads — 30/10/2026

- REQ-596–602 fechadas: 7 COMPLETO; 603–608 preservadas. Playwright 21/21 em 1366×768, 1920×1080 e 390×844; 21 JSON e 21 PNG individuais.
- Servidor operations.test.ts passou 1/1 em SQLite temporário: regra lida após salvar; confirmação exigida; valor inválido bloqueado; uma venda atribuída; ROI 400%; nota interna e fixação; zero envios fictícios.
- Writes visuais interceptados; .audit/noctua-audit.db não mudou. Zero erros de página; nove logs de console apis.google.com bloqueados de propósito no mobile. Nenhum defeito novo.
- Próximo: Revisão e menu contextual, somente pendências REQ-660–668, 673, 675, 676, 678, 680, 682, 684–687.
## Ponto de retomada — 30/10/2026 — após L-25

- L-25 Revisão/menu contextual conferiu as REQs 660–668, 673, 675, 676, 678, 680, 682 e 684–687. Resultados e limites por ID estão no LEDGER; decisão REQ-680 aguarda aprovação para ações de reação reais.
- Playwright `e2e/context-menu-audit.spec.ts`: 18/18 nas três viewports após correção. Testes processuais 12/12; suíte completa do servidor 232/232; typecheck/build aprovados (aviso de chunk web >500 kB). Chromium local; escritas API/socket e chamadas externas interceptadas. Nenhum envio/exclusão/ação de menu executado; banco `.audit/noctua-audit.db` preservado.
- Evidências individuais em `REVISAO/evidencias/REQ-668/`, `REQ-673/`, `REQ-675/`, `REQ-676/`, `REQ-678/`, `REQ-682/`; a suíte de processo cobre REQ-660–667 e 684–687.
- Toque prolongado real, leitor de tela, janela destacada e compatibilidade de navegador permanecem em `CHECKLIST-MANUAL.md`; não contar como prova física.
- Regra de parada reaplicada no lote: suspender em regra de negócio, exclusão, banco, remoção, tecnologia grande, custo ou ambiguidade; registrar no protocolo e avançar os itens independentes. REQ-680 é o único bloqueio decisório deste módulo.
- Próximo lote segue o primeiro módulo pendente da LEDGER após REQ-687. `scripts/iniciar-noctua-online.ps1` continua intocado e fora do commit. Sem push/publicação.

## Ponto de retomada — 30/10/2026 — após L-27 Chaves e operações

- REQ-695–697 receberam prova API local por contas fictícias e estão `COMPLETO-LOCAL`: operações isoladas, ativação por chave, persistência na consulta seguinte, uso único e dispensa de aprovação manual passaram em `apps/server/test/access.test.ts` (20/20 na suíte).
- A primeira chamada `tsx` falhou antes dos testes com `uv_os_get_passwd ... ENOMEM`; preload CommonJS de processo com `NODE_OPTIONS` resolveu sem alterar dependências nem asserções. A suíte usou SQLite em `%TEMP%` e removeu o diretório ao terminar; `.audit/noctua-audit.db` permaneceu intacto.
- O front local reporta `authMode=local`; não há Firebase Auth Emulator configurado. Cadastro/verificação de e-mail e percurso visual de uma segunda conta permanecem no `CHECKLIST-MANUAL.md`; nenhum cadastro ou e-mail real foi feito.
- Próximo passo: primeiro módulo não finalizado pela ordem do `LEDGER.csv`; conferir status, log, API e metadados do banco antes de qualquer novo teste. `scripts/iniciar-noctua-online.ps1` permanece fora do lote. Sem push/publicação.

## Ponto de retomada — 31/10/2026 — após L-01 Estrutura

- REQ-001 e REQ-008 concluídas: `REQ-001` compilou os dois workspaces em modo estrito e não encontrou marcadores de implementação pendente em comentários; `REQ-008` moveu cartão com a alça do Kanban, persistiu a etapa em SQLite temporário e confirmou a ordem visual após recarregar.
- Testes finais: estrutura + CRM 9/9; Playwright REQ-008 3/3 (1366×768, 1920×1080, 390×844). Evidências sob `REVISAO/evidencias/REQ-001/` e `REQ-008/`.
- Falhas de teste corrigidas sem alterar critérios: o detector de pendências confundiu o português “todo” com `TODO`; agora exige marcador de comentário explícito. No Playwright, a rolagem da lista ocultava a origem e o índice do cartão mudava durante o arraste; destino passou a ser selecionado pelo contato e a rolagem automática foi exercitada. Dois POSTs de presença esperados foram isolados junto com o POST de movimento; todos foram interceptados.
- Nenhum defeito de produto confirmado e nenhum código funcional do app alterado. Front/API responderam 200; `.audit/noctua-audit.db` permaneceu em 2.039.808 bytes com `LastWriteTimeUtc=2026-10-30T18:07:20.5497691Z`.
- Próximo módulo pela ordem do ledger: Conexões, REQ-017–021. Reconfirmar `git status`, `git log`, serviços e banco antes dos testes. Sem reset, push ou produção.

## Ponto de retomada — 31/10/2026 — após Conexões

- REQ-017–020 ficaram `COMPLETO-LOCAL`; REQ-021 ficou `COMPLETO`. Provas individuais em `REVISAO/evidencias/REQ-017/`–`REQ-021/`; REQ-021 passou Playwright em três viewports.
- Servidor focado: 31/31; Playwright: 3/3. API/front existentes responderam HTTP 200. `.audit/noctua-audit.db` permaneceu inalterado: 2.039.808 bytes, `LastWriteTimeUtc=2026-10-30T18:07:20.5497691Z`.
- Não houve defeito funcional. Duas correções de fixture foram testadas novamente; details em `PROGRESSO_REQS.md`. Writes visuais foram interceptados, testes de servidor usaram SQLite temporário e produção não foi acessada.
- Pendência externa: validar agenda, fotos visíveis, histórico disponível e etiqueta importada em conta WhatsApp descartável; seguir `REVISAO/CHECKLIST-MANUAL.md`.
- Próximo lote: módulo Mensagens, primeira REQ pendente após REQ-021. Reconfirmar Git, API/front e metadados do banco antes de testar.
- `scripts/iniciar-noctua-online.ps1` permanece fora do lote e do commit.
## Ponto de retomada — 31/10/2026 — após Mensagens L-03

- REQ-024–053 avaliadas: 14 COMPLETO, 10 COMPLETO-LOCAL, REQ-036 DECISÃO; REQs já finais foram preservadas.
- Playwright: 21/21 em três viewports. Servidor focado: 9/9 em SQLite temporário. Front/API: HTTP 200. .audit/noctua-audit.db preservado (2.039.808 bytes; 2026-10-30 18:07:20 UTC). As mutações visuais e envios foram interceptados; nenhuma produção acessada.
- REQ-036 aguarda definição: Gerar PIX aleatório significa emitir uma nova chave bancária ou cadastrar uma chave já emitida e gerar QR/Copia e Cola? Não solicitar chave real nem fazer pagamento.
- Conferências externas pendentes estão agrupadas no REVISAO/CHECKLIST-MANUAL.md; nenhum envio real foi feito.
- Próximo lote por módulo: Fluxos e CRM, REQ-054–075 (22 pendentes). Não resetar o banco nem refazer itens já completos.
- scripts/iniciar-noctua-online.ps1 permanece modificado fora do lote e fora de staging; sem push ou publicação.
