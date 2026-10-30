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
