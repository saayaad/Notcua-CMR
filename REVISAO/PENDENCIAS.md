# Pendências — Noctua CRM

## Atendimento, lote REQ-466–485 — 29/10/2026

Vinte IDs foram diagnosticados sem repetir suítes antigas. REQ-470 recebeu o botão de desafixar na macro, já aceito pelo servidor. Teste novo isolado com banco descartável: 1/1 aprovado, persistência após reabrir SQLite, conversa vizinha preservada, zero envios; tipagem do servidor e da interface aprovada. Dezoito IDs passam de “a verificar” para “parcial” por prova específica de ligação; REQ-472 e REQ-482 continuam a verificar. REQ-472 pede decisão: bloquear no WhatsApp ou apenas opt-out local; não implementar antes dessa regra. A revisão de Mensagens concluídas segue somente leitura, conforme REQ-661. Nenhum contato real foi alterado. Ver `evidencias/acoes-rapidas-lote20-2026-10-29.md` por ID, arquivo/função/linha e limite. Livro: 114 completos, 539 pendentes ativos, 50 cancelados/substituídos; 277 a verificar e 253 parciais. Próximo lote: funções de personalização após REQ-485, respeitando os refinamentos do livro.

## Etiquetas e Atendimento, lote de vinte IDs — 29/10/2026

REQ-601/602 e REQ-444/446/447/448/449/450/452/453/454/455/457/458/460/461/462/463/464/465 foram diagnosticados por histórico e código, sem repetir testes. Nove IDs antes “a verificar” passam a parciais pela ligação específica registrada; nenhum vira completo. Cinco deste lote seguem a verificar: REQ-448 requer aceite visual; REQ-461/462/463/465 requerem definição de formato/capacidade e prova correspondente. REQ-455/457 expõem decisões de identidade do telefone e relação entre valor de perfil e valor financeiro do CRM; nenhuma alteração foi feita. REQ-464 tem prova de importação fictícia de figurinha, mas criação nova no editor não está coberta. Ver `evidencias/atendimento-lote20-2026-10-29.md` por ID, arquivo/função/linha, lacuna e dependência. Sem envio real ou teste de Mensagens já aprovadas (REQ-661). Estado do livro após o lote: 114 completos, 539 pendentes ativos, 50 substituídos/cancelados; dos pendentes, 295 a verificar e 235 parciais. Próximo lote: REQ-466–483, conferindo antes o histórico de ações rápidas.

## Conexões e Etiquetas e leads, lote de dez IDs — 29/10/2026

REQ-017/018/019/020/021 e REQ-596/597/598/599/600 foram diagnosticados por leitura das ligações e das provas anteriores. Todos permanecem parciais: os testes fictícios de contatos, etiquetas, venda, confirmação e ROI já existiam; faltam as verificações específicas de conexão real ou percurso visual com recarga. REQ-018 recebeu teste novo 1/1 para persistência de foto fictícia após reabrir SQLite; tipagem aprovada. Nenhum teste concluído foi repetido. O ID da etiqueta de REQ-021 é gerado pelo servidor; se o pedido exigir um identificador editável, a regra precisa de decisão antes de alteração. Ver `evidencias/conexoes-etiquetas-lote10-2026-10-29.md` para prova por arquivo/função/linha, limites e dependências. Contagem geral inalterada: 114 completos, 539 pendentes ativos, 50 substituídos/cancelados. Próximo lote sugerido: REQ-601/602 e oito IDs de Atendimento sem IA.

## Acesso e operação, lote REQ-109 — 29/10/2026

O usuário fechou a regra: continuar recebendo mensagens e manter funis, fluxos e agendamentos fora do horário; permitir texto de resposta automática, no máximo uma vez por lead por dia. A opção foi implementada desligada por padrão. Dois testes isolados passaram 1/1 cada: configuração, persistência, isolamento e permissões; resposta fictícia, reinício, limite diário e descarte de grupos, opt-out e evento atrasado. Tipagem servidor/web aprovada. Nenhum envio real, teste de Mensagens já aprovadas, migração de banco ou publicação. REQ-109 continua parcial até percurso visual após recarregar e entrega controlada autorizada. Prova e limites em `evidencias/resposta-fora-horario-2026-10-29.md`. Próximo lote independente: Chaves e operações, sem IA.

## Chaves e operações, diagnóstico REQ-695/696/697 — 29/10/2026

Os três IDs passam de “não testado” a “parcial”: o próprio histórico já comprovava ativação, reserva/uso único e isolamento com contas Firebase fictícias. A interface e a API estão ligadas por AuthGate, ActivationPanel, access.routes e AccessService. Falta o percurso externo de cadastro, verificação de e-mail, ativação e recarregamento com segunda conta real; nenhum teste foi repetido nem chave/conta real criada. Ver `evidencias/ativacao-conta-historico-2026-10-29.md`. Contagem consolidada: 304 a verificar, 114 completos, 226 parciais, 0 não testados; demais estados inalterados.

## Regra de horário comercial informada pelo usuário — 29/10/2026

Para REQ-109, o usuário esclareceu que mensagens recebidas devem continuar entrando e que funis, fluxos e agendamentos seguem normalmente fora do horário. Solicitou opção de resposta automática com texto configurável quando um lead escrever fora do horário. Depois definiu o limite de uma resposta por lead por dia. O diagnóstico e a implementação local estão registrados no lote acima.

## Acesso e operação, diagnóstico REQ-126 — 29/10/2026

REQ-126 continua “a verificar” após leitura documental: `docs/revisao-solicitada.md` resume módulos do site e adia a extensão, mas o `6.txt` original indicado no livro não está nesta cópia; não há lista fechada das funcionalidades/capturas abrangidas por este ID. Isso é lacuna de escopo e critério de aceite, não prova de que nunca foi testado. Ver `evidencias/escopo-referencias-req126-2026-10-29.md`. Depende da fonte original ou de critério aprovado antes de implementar algo novo. Próximo módulo P1: Chaves e operações.

## Acesso e operação, lote REQ-112/113 — 29/10/2026

REQ-112/113 continuam parciais: caminhos de recuperação e verificação no Firebase foram relidos, sem disparar e-mail. Para REQ-113, um teste novo e isolado passou 1/1: token fictício com e-mail não verificado foi recusado com HTTP 403 antes do acesso; tipagem aprovada. Isso não comprova entrega, clique no link nem retorno ao aplicativo. Prova por arquivo/função/linha em `evidencias/recuperacao-verificacao-email-2026-10-29.md`. REQ-112 depende de conta de teste e autorização para envio controlado; REQ-113 depende também de confirmação manual do link. Nenhum teste anterior foi repetido. Próximo lote independente: diagnosticar REQ-126 pela fonte original e, em seguida, passar às pendências P1 de Chaves e operações.

## Acesso e operação, lotes REQ-103/107/109 — 29/10/2026

Registro histórico anterior à decisão de REQ-109: REQ-103/107 seguem parciais após leitura das ligações de ordem/visibilidade e da prova anterior de preferências; falta o percurso visual e a conferência após recarregar. Nenhum teste antigo foi repetido. REQ-109 segue parcial: teste novo e isolado passou 1/1 para gravação/leitura, persistência em segunda conexão SQLite, isolamento entre espaços e 403 para atendente. A primeira tentativa isolada encontrou fixture sem atendente (402); após preparar o fixture, repetiu-se apenas esse teste novo. O encerramento automático já tinha prova e não foi testado de novo. O horário comercial era salvo, mas ainda não havia aplicação identificada no servidor; sua função exata dependia de decisão de regra de negócio. REQ-108 também segue parcial após leitura de código: assinatura é acrescentada ao enviar, mas o rascunho visível não mostra o texto final. Conforme REQ-661, nenhum teste funcional de Mensagens ou envio foi feito. Ver `evidencias/menu-negocio-2026-10-29.md`. A decisão e implementação posteriores constam no lote REQ-109 acima.

## Acesso e operação, lote REQ-105/106 — 29/10/2026

Diagnóstico por leitura de código e da prova de 28/10, sem repetir testes. REQ-105 continua parcial: as cinco opções aplicam classes de privacidade, mas o nome do contato também aparece em outras telas fora dos seletores CSS; falta definir a cobertura esperada e conferir visualmente cada painel após recarregar. REQ-106 continua parcial: a opção é persistida, porém o evento que aciona o aviso também ocorre após envios e atualizações de status; falta decidir quais eventos devem notificar e verificar permissão/entrega no navegador. Nenhuma notificação foi disparada e nenhuma mensagem foi testada. Evidência por arquivo/função/linha em `evidencias/privacidade-notificacoes-2026-10-29.md`. Próximo lote independente: REQ-103/107, ordem e visibilidade do menu, somente lacunas ainda sem prova.

## Acesso e operação, lote REQ-104 — 29/10/2026

Um teste novo e exclusivo de REQ-104 passou 1/1: perfil fictício gravado, lido após reabrir SQLite descartável e isolado de outro espaço. Tipagem aprovada. O requisito permanece parcial porque falta o percurso visual com recarregamento. Nenhuma suíte anterior, conta real ou banco de produção foi tocado. Prova por arquivo/função/linha em `evidencias/perfil-operador-2026-10-29.md`. Próximo lote P1: verificar as lacunas específicas de privacidade/notificações sem repetir os testes de preferências já aprovados; os efeitos do navegador aguardam acesso visual permitido.

## Acesso e operação, lote REQ-110/111 — 29/10/2026

Um teste novo e exclusivo de REQ-110/111 passou 1/1: setor e membro fictícios foram gravados, lidos em outra conexão SQLite, isolados de outro espaço e protegidos contra alteração por atendente (403). Tipagem do servidor aprovada. Nenhuma suíte antiga foi repetida, nenhum e-mail enviado. Ambos permanecem parciais: falta o percurso visual; REQ-111 também depende de decisão sobre o fluxo e o serviço de convite privado. Prova por arquivo/função/linha em `evidencias/acesso-setores-equipe-2026-10-29.md`. Próximo lote P1: demais configurações de acesso e suas permissões; manter REQ-098/099/540 pendentes até prova de login novo e configuração pública local.

## Backups, lote de diagnóstico — 29/10/2026

REQ-089/090 passam de “não testado” a “parcial” para refletir os testes anteriores em SQLite descartável e a leitura atual dos conversores. O arquivo histórico na conexão Teste, os nove agendamentos de Sutofly e o relatório de importação continuam sem prova operacional; nenhuma importação foi repetida. Metadados locais mostram cinco pares de backup do banco principal e três espaços com banco/chave, mas nenhum arquivo `.db` nos diretórios de backup desses espaços. O exportador JSON da Biblioteca não cobre o sistema inteiro. Ver `evidencias/cobertura-backups-2026-10-29.md` por arquivo, função, linha e limite.

Decisão necessária antes de qualquer correção de cobertura: destino privado fora deste PC, abrangência dos dados da plataforma e processo de restauração. Até essa decisão, não alterar bancos nem fazer cópia/exportação para serviço externo. Contagem consolidada: 304 a verificar, 114 completos, 223 parciais, 3 não testados; demais estados inalterados. Próximo lote independente, P1: Acesso e operação, começando por permissões e persistência com prova ainda incompleta. REQ-540 depende da recuperação da configuração pública correta.

## Retomada em 29/10/2026

Etapa Infraestrutura, lote 3: REQ-524 concluído pelo login real do proprietário já registrado, ligação AuthGate/Firebase Admin e prova isolada de tokens; REQ-525 concluído pela correspondência exata dos quatro nomes públicos entre .env.example, código e guia. REQ-540 parcial: a cópia local não contém apps/web/.env nem .env.local, então o Vite local não recebe os quatro identificadores públicos. A publicação Vercel pode continuar configurada, mas isso não preenche automaticamente o ambiente local. Não foi feito login novo nem copiada credencial administrativa. Próximo lote: diagnosticar como recuperar a configuração pública correta e validar o iniciador sem reiniciar a operação em uso. Contagem consolidada: 304 a verificar, 114 completos, 221 parciais; demais estados inalterados.

Etapa Infraestrutura, lote 2: REQ-528/529 concluídos após verificar que Firebase Admin é carregado só no servidor e que o arquivo privado configurado existe em .secrets, é ignorado e não é rastreado pelo Git. O conteúdo da credencial não foi aberto. REQ-530 passou a parcial: persistência e restauração constam no código e em teste fictício anterior, mas a sessão Teste não tem credencial salva e nenhuma sessão real foi reconectada. Próximo lote: REQ-524/525/540 (configuração Firebase) e REQ-533/541 (partida a partir de outra pasta e abertura do endereço), sem reiniciar o serviço em uso. Contagem consolidada: 307 a verificar, 112 completos, 220 parciais; demais estados inalterados.

Etapa Infraestrutura, lote 1: REQ-520/522/531/532/536/537 concluídos pela combinação de execução histórica documentada, configuração atual e orientação corrigida. REQ-523/533/541/543 passaram a parciais: a recuperação não dá disponibilidade com PC desligado, a partida em outro diretório/reinício e a abertura visual ainda não têm prova suficiente. O guia de abertura deixou de citar a pasta antiga; a orientação da Vercel agora explicita Vite e raiz do monorepo. Nenhum deploy, reinício, envio real ou reteste funcional foi feito. REQ-523/543 dependem de decisão sobre hospedar a API e os dados em servidor persistente; não migrar sem aprovação. Contagem consolidada: 310 a verificar, 110 completos, 219 parciais; demais estados inalterados. O inventário por ID está em INVENTARIO-PENDENTES.md.

REQ-199/200/201/203 passaram de “a verificar” a “parcial” após leitura do CSS e da importação em main.tsx. Reset, tipografia, shell e unidades flexíveis estão definidos; zoom, rolagem e proporções em navegadores reais seguem sem prova. Contagem consolidada: 320 a verificar, 104 completos, 215 parciais; demais estados inalterados. Nenhum teste já aprovado foi repetido nesta classificação.

REQ-045: novo teste isolado de macro com espera de 60 segundos e tempo de digitação de 120 ms passou 1/1. Nenhuma mensagem saiu antes do prazo; depois de tornar o agendamento vencido no banco descartável, o conector fictício recebeu o texto uma vez e a execução terminou. Falta conferir os controles e a presença na interface e no aparelho de teste.

REQ-064/065: novo caso isolado de atraso de 60 segundos para áudio e imagem passou 1/1. O conector fictício não enviou antes do prazo; após adiantar somente o relógio do agendamento no banco descartável, enviou cada mídia uma vez. Permanecem parciais até conferir o editor e o recebimento em aparelho real. Os casos de atraso zero aprovados anteriormente não foram repetidos.

Dois cenários novos sem IA passaram 2/2 em banco descartável e WhatsApp fictício: REQ-120, primeira entrada após saída anterior e bloqueio da segunda entrada; REQ-124, etiqueta permitida exigida e etiqueta excluída prioritária. Permanecem parciais por faltar configuração e observação na interface. A suíte completa existente não foi repetida; `.github/workflows/checks.yml` já executa tipagem, compilação e testes automaticamente em cada push ou pull request.

Continuação automática sem IA: REQ-121 ganhou caso isolado para a virada do dia em São Paulo. Uma mensagem às 23:59:59 do dia anterior não bloqueou o primeiro gatilho do dia atual; teste 1/1 aprovado em banco descartável e conector WhatsApp fictício. A configuração pela interface e a conexão real continuam pendentes. Os testes aprovados antes desta rodada não foram repetidos. A automação da conversa continuará pelas lacunas não IA sem usar dados de produção nem enviar mensagens.

O projeto principal foi recuperado em C:\Users\gusta\Documents\Notcua CMR\Notcua CMR, com banco, chaves e backups privados fora do Git. O site e a API voltaram a responder pela Vercel e pelo túnel temporário. Durante o diagnóstico, a conexão WhatsApp permanece desligada e nove entregas antigas têm execução adiada; o manifesto privado em .npm-cache/online-test-pause.json preserva os horários originais. Não reativar a fila sem revisar esses registros com o usuário.

REQ-138 e REQ-139 passaram a parciais após conferir métricas de fila/IA, estado das conexões e reconexão Socket.IO na interface, com caminhos de servidor e testes isolados correspondentes. Falta observar números, queda e retorno reais pela interface. Contagem atual: 324 a verificar, 104 completos, 211 parciais, nenhum defeito classificado e 1 ausente.

BUG-002 teve a reprodução corrigida e enviada ao GitHub no commit `b3e0409`: resumo avançou com 60, 90 e 160 mensagens e intervalo 100 em banco/provedor fictícios. Em nova rodada de 29/10, o registro ganhou cursor de data e ID; a inserção de mensagem histórica invalidou o resumo anterior e a reconstrução incluiu essa mensagem. Reabrir o cliente Prisma manteve o resumo sem duplicação; registros legados sem cursor são reconstruídos na próxima sugestão. A suíte local aprovou 186 testes e as duas aplicações compilaram. Faltam reinício completo do servidor, falha do provedor, alterações de mídia já resumida e percurso autenticado. REQ-433 segue parcial; evidência: evidencias/resumo-ia-2026-10-29.json.

Publicações autorizadas em 29/10/2026: commits `aa343a7`, `96171a0` e `b3e0409` no `main`, todos marcados como concluídos pela Vercel. As checagens completas do GitHub dos três passaram. A API continua executada neste computador por túnel temporário; a verificação pública de `/health` respondeu normalmente nesta retomada. Evidência: evidencias/publicacao-2026-10-29.json.

BUG-004 corrigido e enviado no commit `96171a0`: transcrição/descrição salva não chegava à sugestão de IA antes do primeiro resumo. Teste com áudio/vídeo e provedores fictícios confirmou a ligação após o ajuste; REQ-140 e REQ-141 passaram a parciais. Falta validar com mídia real e interface autenticada. Evidência: evidencias/media-contexto-2026-10-29.json.

BUG-003 corrigido e enviado no commit `aa343a7`: cache de IA só reutiliza resposta aprovada explicitamente; dados pessoais impedem a aprovação; entradas antigas sem origem verificável ficam inativas. Teste com três clientes fictícios, compilação de servidor/interface e suíte completa de 184 testes passaram. Falta verificar o percurso visual publicado. Evidência: evidencias/cache-ia-2026-10-29.json.

REQ-143 e REQ-144 passaram de “a verificar” para “parcial” após conferir os caminhos do código e os testes isolados de pausa por atendimento manual e pedido do cliente. A suíte de 184 testes aprovou ambos. Restam o percurso visual e a confirmação em conexão real; contagem consolidada no parágrafo acima.

REQ-132, REQ-134 e REQ-135 avançaram de “a verificar” para “parcial” por ligação de código e testes isolados aprovados. Falta o percurso visual autenticado; a aba publicada não autorizou observação pelo controle do navegador nesta rodada. Evidência: evidencias/retomada-operacoes-2026-10-29.json. REQ-148, REQ-149 e REQ-150 também avançaram a parciais por ligação de código e testes isolados de importação, filtros E/OU e sequência. A sequência com mídia real ainda não foi exercitada. REQ-142 e REQ-145 avançaram a parciais: fila automática funcionou sem requisição do painel, e sincronização fora de ordem preservou a data mais recente da conversa, ambos em banco temporário. Faltam a instalação publicada e a interface autenticada. Oito testes isolados distintos passaram nesta retomada. A contagem consolidada está no parágrafo acima e no livro de requisitos.

Busca global conferida pelo código em 28/10/2026: Ctrl+K, botão do cabeçalho, conversas, campanhas e Biblioteca têm caminhos ligados. Acrescentados atalhos para cinco seções da Personalização. REQ-224–229 classificados como parciais: a sessão local expirou e falta o percurso visual autenticado, inclusive conferir foco na seção escolhida. Build web aprovado, sem uso de IA ou envios. Evidência: `evidencias/busca-global-2026-10-28.json`.

Retomada após o desligamento do PC em 28/10/2026: iniciador corrigido para carregar e repetir a verificação de assinatura do conector Cloudflare. Servidor local, túnel HTTPS e Vercel recuperados; publicação `dpl_AikyJa3WDdZXDmxvtTQX3JoXzZyk` READY. Suíte 177/177 e build completo passaram antes do commit `d147e95`, presente em `revisao-completa` e `main`. A conexão WhatsApp “Teste” aparece desconectada após o reinício; não foi reconectada nesta auditoria para evitar disparos reais. Evidência: `evidencias/reinicio-2026-10-28.json`.

Menu de conversas: adicionado acesso ⋯ que abre o menu contextual existente por clique e Enter. Em viewport simulado 390x844 ele fica visível; em desktop aparece ao passar o mouse ou focar. REQ-675–676 classificados como parciais até inventário dos demais contextos e teste em aparelho real. Evidência: `evidencias/menu-conversas-2026-10-28.json`.

Publicação atualizada em 28/10/2026 por autorização anterior do usuário: https://notcua.vercel.app/atendimento, projeto noctua-crm, versão READY `dpl_quW1LBAWRzs8VcuaAJF7K4EUpiR8`. Página 200, servidor público 200, API protegida com 401 sem login e comunicação Vercel/API liberada no teste de origem. O pacote de fluxos publicado coincide com a compilação local testada. Servidor e túnel dependem deste PC. Isso atende ao acesso online, mas a auditoria funcional abaixo continua aberta.

Nova publicação em 28/10/2026: `dpl_9WMHsTNvBFpT9Z2ZibJscRjECETS` READY, alias https://notcua.vercel.app. Depois que o túnel anterior parou, o usuário aprovou especificamente reabri-lo para o CRM. A API voltou a responder por HTTPS; a interface publicada carregou 131 conversas da conexão Teste. A suíte completa passou 177/177. REQ-603–608 foram concluídos: filtros e ordem persistiram após recarregar; três páginas mantiveram a ordenação; o teste isolado validou filtro combinado, ordem e segunda página. O endereço da API continua temporário: se o processo ou PC parar, o site perde acesso aos dados até iniciar um novo túnel e atualizar a Vercel. Evidência: `evidencias/leads-e-publicacao-2026-10-28.json`.

Atendimento responsivo conferido em viewports simulados 390x844 e 768x1024: lista → conversa → voltar e gaveta da biblioteca funcionaram; REQ-234 concluído. REQ-198 permanece parcial por não haver teste em dispositivos físicos e porque o rodapé do chat fica apertado no tablet. Evidência: `evidencias/atendimento-responsivo-2026-10-28.json`.

Atualização: 27/10/2026. Fase 2 autorizada e em execução. O novo módulo de chaves foi aprovado separadamente durante a revisão. **Este ainda não é o relatório final da Fase 3.**

Prioridade seguinte autorizada pelo usuário: menu de botão direito global implementado localmente, com handlers existentes e edição de texto. Conferência e limites em [MENU-CONTEXTO.md](MENU-CONTEXTO.md) e [checklist do menu](MENU-CONTEXTO.md#testes-e-checklist). 60 testes selecionados passaram nesta rodada; a auditoria individual restante continua aberta. Essa autorização substitui a parada anterior somente para o menu, sem aprovar alterações indiscriminadas de outros módulos.

## Situação

O livro [REQUISITOS.md](REQUISITOS.md) contém 703 registros: 392 ⬜ A VERIFICAR; 98 ✅ COMPLETO; 147 🟡 PARCIAL; 5 ⛔ NÃO TESTADO; 50 🔁 SUBSTITUÍDO OU CANCELADO; 4 ⚠️ PRECISA DE DECISÃO; 4 🔌 DESCONECTADO; 2 🐞 COM DEFEITO; 1 ❌ AUSENTE. Repetições de pedidos não são funções distintas; ainda não há percentual de completude comprovado.
A verificação individual, prioridade, esforço e lotes serão preenchidos depois da aprovação do escopo, sem reutilizar “implementado” de um relatório antigo como prova.

| ID / conjunto | Status | O que decidir ou completar | Prioridade/esforço |
|---|---|---|---|
| REQ-001–REQ-687, exceto substituídos | ⬜ / ⚠️ | Conferir origem, critério, código, ligação e execução, respeitando exceção de Mensagens. | A estimar após Fase 2 |
| REQ-160, REQ-213 | 🔁 | Renomear o produto foi substituído por REQ-504, manter noctua fixo. | Sem implementação antiga |
| REQ-609–REQ-653 | 🔁 | Cancelados: pertencem ao Creatfy Studio, conforme correção expressa do usuário. Não implementar neste CRM. | Fora do escopo |
| L-12, item 3.b | ⚠️ | Definir inatividade como exatamente X dias ou pelo menos X dias. | Regra de negócio |
| L-15, item 7.c | ⚠️ | Reconciliar pedido de aquecimento artificial com exclusão registrada nos relatórios anteriores. Não apresentar como proteção garantida. | Escopo a decidir |
| L-20, item 7 | ⚠️ | Manter exigência sem cartão; geração Gemini depende de projeto com cota disponível. Não ativar cobrança. | Dependência externa |
| L-22, item 18 | ⚠️ | Receber Parte 8 antes de incluí-la como entrega. | Especificação ausente |

## Retomada

1. Ler REQUISITOS.md e a resposta do usuário à primeira parada.
2. Se o usuário confirmar o escopo, iniciar Fase 2, requisito por requisito, registrando arquivo, função/linha, caminho da interface, resultado e persistência.
3. Em Mensagens, somente leitura de código e ligações; nenhuma alteração da lógica ou envio real.
4. Após Fase 2, gerar este relatório completo com prioridade Alta/Média/Baixa, esforço P/M/G, dependências e ordem de lotes.
5. Parar novamente para aprovar implementação na Fase 3.

## Ainda não classificado como defeito do app

- Build inicial restrito falhou por permissão de leitura do ambiente; repetido com acesso autorizado, passou. Não atribuir isso ao código.
- Compilação informa pacote principal acima de 500 kB. Registrar para avaliar impacto; não executar redesign/otimização fora do plano.
- Console consultado na aba local sem erros/avisos capturados naquele momento. Isso não cobre todas as telas nem requisições históricas.


Decisão de escopo em 27/10/2026: produção de vídeos/Drive permanece no Creatfy Studio. REQ-609–REQ-653 cancelados neste CRM. Sincronização entre aplicativos é possibilidade futura, sem implementação aprovada. Links fornecidos pelo usuário: https://creatfy-studio.vercel.app e https://github.com/creatfystudio/creatfy-studio. A consulta web não conseguiu abrir os endereços; não houve avaliação do código remoto.

## Progresso da Fase 2 e nova prioridade

- 52 testes isolados aprovados nesta execução: 30 de backup/CRM/layout/prévia e 22 selecionados de operações, sem testes de envio de Mensagens.
- Cadastro inicial, paleta, tema e nomes de menu/pasta conferidos na cópia fictícia e após recarregar; os valores foram consultados também no servidor.
- BUG-001: falha de salvamento automático de preferências não é apresentada ao usuário. Entrada extensa foi recusada com 413; o valor anterior foi preservado e voltou ao recarregar. Correção aguardará o lote aprovado.
- REQ-688–REQ-699: módulo /chaves e operações independentes solicitado e aprovado em seguida; implementação priorizada. A avaliação do restante continua aberta, sem porcentagem geral de conclusão.
- O teste novo de chaves encontrou um arquivo local corrompido de engine.io-client. Restaurando a mesma versão oficial antes de repetir os testes; não é resultado funcional das chaves.

## Lote Chaves e operações — concluído no código e em testes isolados

- /chaves validado com o login real do proprietário. Nenhuma chave real gerada.
- Geração, reserva de e-mail, planos, uso único, renovação, revogação, expiração, separação dos bancos, arquivos, backups e eventos implementados.
- 12 testes novos + 57 regressões selecionadas aprovados; compilação aprovada.
- Cadastro/ativação com cliente Firebase real ainda não executados: REQ-695–REQ-697 têm passo manual no livro. Não confundir testes simulados com uma venda real homologada.
- A lógica original de Mensagens não foi alterada; há uma camada externa de autorização antes de transmitir.
- Creatfy continua fora do escopo ativo. Fase 2 geral continua; não atingimos a segunda parada de aprovação do plano de pendências/menu.

## Auditoria parcial seguinte — menu, backups, CRM e economia de IA

- 49 registros receberam classificação individual nesta rodada. Contagens atuais estão no início deste documento e no livro; os registros parciais descrevem exatamente o que falta executar pela interface.
- Menu contextual implementado por autorização posterior, compilado com ícones e conferido em fundo, Biblioteca e edição de texto. A revisão de cada módulo/dispositivo ainda está aberta; checklist dentro de MENU-CONTEXTO.md.
- BUG-002: resumo estacionava após atingir a janela de 60 mensagens. Reproduzido com 60 → 90 mensagens fictícias; a correção local e os limites restantes estão na atualização de 29/10/2026 acima.
- BUG-003: defeito reproduzido entre duas conversas fictícias nesta auditoria; correção local e novo teste constam na retomada de 29/10/2026 acima. Nenhum cache real foi apagado.
- INT-001: controles de economia de campanhas/treinamento/comprovantes/resumo diário são salvos sem consumidor localizado. Prioridade Alta, esforço G, ligar controles por técnica e por sistema e testar os quatro motores com provedor fictício.
- LAC-001: embeddings/índice vetorial ausentes e estimativa diária não exposta. Prioridade Média, esforço G para índice e M para métricas, sem contratação/ativação de cobrança.
- Backups e CRM têm testes de API/persistência aprovados, mas foram mantidos como parciais até completar a interface de cada cenário. Fixture de áudio ZV com bytes de texto não comprova reprodução; mídias vazias não comprovam importação de vídeo.
- A revisão automática bloqueou uma compilação por limite temporário de uso; após o horário informado, a nova aprovação funcionou e a compilação final passou. Não é defeito do aplicativo.

## Lote de verificação — fluxos, campanhas e agenda

- 39 requisitos classificados com rastreio de tela/handler e resultado dos testes. Não foram promovidos a completos sem percurso visual.
- Fluxos: 15/15 aprovados após corrigir somente a sincronização do teste TST-001. Rascunhos inválidos, horários, espera, expiração, pausa, retomada e não duplicação cobertos com socket fictício.
- Campanhas/agenda: 8/8 aprovados; salvar não envia, horário futuro impede antecipação, cancelamento bloqueia, lembrete fica interno e sequência preserva snapshot/pausa.
- LAC-002: etiqueta não aparece nas sugestões da agenda. Prioridade Média, esforço P, depende de renderizar os vínculos já fornecidos e testar cliente com etiquetas.
- Sem alteração de motor, Mensagens, banco de produção, chaves ou dados reais. Ainda falta revisão visual individual do canvas, monitor e formulário.
- Evidência consolidada: evidencias/fluxos-agenda-2026-10-27.json. Dois testes do menu passaram após corrigir a extensão do import em teste; tipagem completa de servidor e interface passou. Não foi necessária nova compilação de produção, pois somente testes e documentos mudaram.

## Lote autorizado — Habilitar I.A. (27/10/2026)

REQ-700–703 concluídos: opção administrativa por operação, desabilitada por padrão, ocultação das ferramentas e bloqueio de novas chamadas no servidor. Chaves/regras preservadas; reabilitar não ativa automaticamente o robô. Seis testes sem rede externa aprovados, build aprovado e UI fictícia conferida antes/depois/recarregada. Evidência: evidencias/ia-controle-2026-10-27.json e ia-desabilitada-2026-10-27.png.

Por pedido explícito do usuário, pular os testes funcionais de geração e demais módulos dependentes de API até existir chave disponível. Não apagar nem marcar como corrigidas BUG-002/003, INT-001 ou lacunas já registradas. Continuar a auditoria das funções manuais. Alterações locais; sem push/deploy neste lote.

## Auditoria manual seguinte — 27/10/2026

27 requisitos classificados; 17 testes selecionados aprovados sem IA/WhatsApp real. CSV conferido de ponta a ponta na cópia fictícia: dois válidos, duplicado e inválido separados, DDD revisável, etiquetas preservadas após reload e lista disponível para campanha. Perfil/localização/resumo persistiram ao reabrir. Evidências em evidencias/importacao-organizacao-2026-10-27.json e capturas relacionadas. Código de produção não mudou neste lote.

Continuar percursos visuais parciais: XLS/XLSX e mapeamento, transferências/aceite/recusa, rodízio e gesto de reordenação de etiquetas. Configuração de rodízio existe em Negócio, embora pedido original indique Equipe. A auditoria ainda não encerrou; manter IA adiada e não publicar sem solicitação.

## Continuação autônoma autorizada — 27/10/2026

O usuário pediu continuar sem paradas entre etapas até concluir o aplicativo. Isso autoriza correções reversíveis necessárias durante a revisão; IA funcional permanece adiada. Este lote corrigiu BUG-001, LAC-002 e contraste do Sandbox (BUG-004), acrescentou distribuição em Equipe e classificou 34 registros.

136 testes distintos aprovados nesta continuação: 80 da regressão selecionada, 32 de atendimento/conexão/microfone com sockets fictícios, 15 de operações sem IA, 2 novos de salvamento, 4 novos de Sandbox e 3 novos de transferência. Não somar repetições como novos testes. Tipagem e build aprovados. Nenhum envio real, conta ou dado de produção alterado; Mensagens permaneceu sem mudança de lógica.

A preparação inicial de transfers.test.ts falhou no schema engine sem RUST_LOG; alinhada à configuração info das demais suítes, os 3 testes passaram. A primeira execução restrita do novo teste de preferências também falhou no ambiente (uv_os_get_passwd/ENOMEM); execução autorizada passou. Essas falhas não foram classificadas como defeitos do produto.

Faltam percursos visuais parciais e classificação dos requisitos ainda a verificar; esta rodada não prova conclusão dos 703 registros. Ver evidencias/conclusao-parcial-sem-ia-2026-10-27.json.

Retomada: não parar por lote; continuar funções manuais. Geração real de IA, dispositivos/navegadores indisponíveis, ativação com cliente real e publicação continuam sem homologação nesta rodada. Não afirmar app totalmente finalizado.

## Biblioteca — continuação em 27/10/2026

CRUD de texto, favorito, duplicação, confirmação, exclusão somente da cópia, categoria e filtro conferidos na interface fictícia. Texto e favorito permaneceram após reload. Corrigida a prévia que mostrava marcadores de formatação literalmente (BUG-005); FormattedText confirmou negrito no DOM. Arquivos/mídias da Biblioteca ainda têm passos visuais pendentes. Evidência: evidencias/biblioteca-2026-10-27.json e biblioteca-categoria-2026-10-27.png.

## Reset seguro — continuação em 27/10/2026

BUG-006 corrigido: o reset limpava apenas chaves noctua: e deixava noctua-preferences:uid, permitindo que a personalização antiga voltasse após recarregar. A limpeza agora considera as chaves exatas da conta e seus rascunhos; outras contas e autenticação ficam preservadas. O servidor também passou a bloquear fluxos, macros e funis RUNNING, além dos trabalhos já protegidos.

Quatro testes de segurança e um de cache local aprovados; confirmação visual de duas etapas, texto incorreto bloqueado, EXCLUIR exato liberado e cancelamento sem exclusão. O JSON do backup foi reaberto como banco, conferindo contato, recurso, bytes de arquivo, preferência e exemplo local. Nenhum dado real foi apagado. A primeira fixture do teste precisava de id obrigatório no Asset; corrigida antes dos testes finais.

Acumulado desta continuação: 141 testes distintos aprovados (136 anteriores + 4 de segurança + 1 de limpeza local); sem novas gerações de IA. Build e tipagem aprovados. Evidências em evidencias/reset-seguro-2026-10-27.json. A auditoria geral ainda não concluiu os registros a verificar.

## Biblioteca, macros e funis — 28/10/2026

O ciclo de API para áudio, imagem, vídeo e documento foi conferido em banco temporário: upload, criação, edição, listagem, download com bytes e tipo corretos, exclusão e recusa de edição depois da exclusão. A macro de teste confirmou texto, espera, adicionar/remover etiquetas e transferência em ordem, sem envio real. Um funil foi criado e editado pela API; edição de ID inexistente agora retorna 404. BUG-007 corrigido. Os 17 testes de atendimento passaram e a tipagem das duas aplicações passou. A compilação do cliente exigiu acesso de leitura fora do ambiente restrito e então passou; o Vite ainda alerta sobre um chunk de 595,92 kB, sem impedir o build.

Doze requisitos de Biblioteca, macro e funil avançaram de “a verificar” para “parcial”. Dois requisitos de mídia em fluxos (REQ-064/065), que tinham prova antiga ainda não refletida no checklist, avançaram de “não testado” para “parcial”. Contagem: 437 a verificar, 85 completos, 114 parciais, 6 não testados; demais estados inalterados. Faltam os percursos visuais de mídia, a execução de funil multimídia e a conferência de duração não nula em macros. Nenhum envio ao WhatsApp real ou geração de IA nesta rodada. A regressão completa passou 172/172, sem falhas ou itens pulados. Evidência: `evidencias/biblioteca-funis-macros-2026-10-28.json`.

## Backup ZapVoice com imagem e vídeo — 28/10/2026

REQ-078 passou de “não testado” a “parcial”. Um backup fictício no formato ZV_backup importou PNG e MP4 válidos, preservou MIME e bytes no banco e no backup reexportado. A suíte inteira de backup passou 13/13 depois do acréscimo; o novo teste foi colocado após os cenários que dependem da contagem inicial da base compartilhada. Ainda faltam upload pela interface, prévia na Biblioteca e recarregamento. Contagem consolidada: 437 a verificar, 85 completos, 115 parciais, 5 não testados, 50 substituídos/cancelados, 4 decisões, 4 desconectados, 2 com defeito e 1 ausente. Evidência: `evidencias/zapvoice-midias-2026-10-28.json`.

## Funil multimídia e macro importada — 28/10/2026

REQ-046 avançou de “a verificar” para “parcial”; REQ-050/051/052 receberam prova mais específica. Texto, voz OGG/Opus e imagem foram executados em ordem no funil fictício, com atraso antes do áudio e presença de gravação. Uma macro importada com WAV Base64 resultou em mensagem de voz no conector fictício. Suítes de atendimento 18/18 e operações 45/45, tipagem aprovada. Não houve envio real. Persistem pendências de configuração e prévia visual, atraso medido em tempo real e confirmação em aparelho. Contagem atual: 436 a verificar, 85 completos, 116 parciais, 5 não testados; demais estados inalterados. Evidência: `evidencias/funil-macro-multimidia-2026-10-28.json`.

Publicação deste lote: `eef1d31` foi enviado a `revisao-completa` e `main`; o status Vercel do commit no GitHub informou `success` e “Deployment has completed”. O domínio respondeu HTTP 200 com o título Noctua · Atendimento; a saúde do túnel vigente respondeu 200. Isso verifica disponibilidade, não homologa as telas restantes. Evidência: `evidencias/publicacao-auditoria-2026-10-28.json`.

## PIX manual — 28/10/2026

REQ-035/036/037/038 passaram de “a verificar” a “parcial”. O teste em banco descartável cadastrou uma chave fictícia de formato aleatório, confirmou listagem, payload para R$ 150,00, CRC e QR PNG; chave ausente ou excluída foi recusada. `PixModal.tsx` liga envio rápido, Copia e Cola, pedido de comprovante e áudio opcional, mas estes controles ainda não foram percorridos visualmente. O teste não verifica existência bancária da chave nem faz pagamento. Suíte de atendimento 19/19 e tipagem aprovadas. Contagem: 432 a verificar, 85 completos, 120 parciais, 5 não testados; demais estados inalterados. Evidência: `evidencias/pix-api-2026-10-28.json`.

## Iniciador e orientações de abertura — 28/10/2026

REQ-091/092 completos quanto à orientação de pasta e terminal do VS Code. REQ-093 parcial: a documentação explica portas já ocupadas e o iniciador reutiliza o servidor na porta 3333, mas não gerencia a interface local em 5173. BUG-008 corrigido: detecção do vínculo Vercel passou de `.vercel/repo.json` para `.vercel/project.json`, conforme documentação oficial. README e guia de operação corrigidos para não afirmar que o botão inicia Vite local. Parser PowerShell aprovado; não executei o iniciador completo para preservar o túnel vigente. Contagem: 429 a verificar, 87 completos, 121 parciais, 5 não testados; demais estados inalterados. Evidência: `evidencias/iniciador-2026-10-28.json`.

## Conexão, acesso e hospedagem — 28/10/2026

REQ-094/095 e REQ-098/099 passaram de “a verificar” a “parcial”. A suíte de QR, conexão e requisições autenticadas passou 18/18 em banco temporário e socket fictício. O QR fictício apareceu como PNG, foi limpo depois da conexão e o estado de reconexão foi exercitado. A interface oferece login Google e por senha, mas um novo login por cada provedor ainda não foi feito nesta auditoria. A queda e a volta do túnel também não foram simuladas para preservar o atendimento em uso. REQ-100/101 completos: o site público respondeu HTTP 200 e o remoto GitHub apontava para o repositório informado pelo usuário, com `main` e `revisao-completa` alinhadas antes deste lote. Contagem: 423 a verificar, 89 completos, 125 parciais, 5 não testados; demais estados inalterados. Evidência: `evidencias/conexao-acesso-2026-10-28.json`.

O commit `99a0fb1` foi enviado às branches `revisao-completa` e `main`. O status público da Vercel mudou de `pending` para `success` (“Deployment has completed”) e `https://notcua.vercel.app/atendimento` respondeu HTTP 200 depois da publicação. Isso comprova a disponibilidade da interface deste lote, não os percursos autenticados pendentes.

## Configurações e conta — 28/10/2026

REQ-103 a REQ-113 avançaram de “a verificar” a “parcial” após inspeção do caminho de código. As telas oferecem ordenação e visibilidade do menu, perfil, privacidade, notificações, assinatura, empresa e horário, departamentos, equipe, recuperação de senha e verificação de e-mail. As suítes de acesso e preferências passaram 14/14 em bases descartáveis. BUG-009 corrigido: uma resposta atrasada da aba anterior não pode mais preencher a aba atual. A tipagem da interface passou. Faltam os percursos visuais, entrega dos e-mails de recuperação/verificação e a função de convite privado, que não foi identificada no cadastro de equipe. Contagem: 412 a verificar, 89 completos, 136 parciais, 5 não testados; demais estados inalterados. Evidência: `evidencias/configuracoes-2026-10-28.json`.

## Contatos e fluxos — 28/10/2026

REQ-114/115 e REQ-117 a REQ-125 passaram de “a verificar” a “parcial”. O teste de operações já havia preservado perfil e nota de um contato em banco temporário. A suíte de fluxos passou 16/16 nesta rodada, incluindo mensagem nova, início manual, etiqueta inicial, comparações de texto, espera e retomada após reinício. Acrescentei cenários específicos de documento e primeira mensagem do dia: o PDF fictício saiu com bytes, MIME e nome corretos; histórico antigo permitiu o gatilho diário e mensagem anterior do mesmo dia o impediu (1/1 aprovado em cada cenário). A virada próxima da meia-noite de São Paulo ainda precisa de caso próprio. O link Google Agenda prepara um evento; criá-lo exige confirmação na conta Google. Nenhuma mensagem real foi enviada. Contagem: 401 a verificar, 89 completos, 147 parciais, 5 não testados; demais estados inalterados. Evidência: `evidencias/contatos-fluxos-2026-10-28.json`.

## Filtro de recursos no funil — 28/10/2026

REQ-127 avançou de “a verificar” para “parcial”. O editor já restringia recursos pelo tipo do bloco; acrescentei o filtro pela categoria compartilhada da Biblioteca, com opções Todas e Sem categoria. Trocar o filtro não apaga a seleção atual. A tipagem e o build de produção passaram. Falta conferir visualmente a seleção, o salvamento e o recarregamento do fluxo. Contagem: 400 a verificar, 89 completos, 148 parciais, 5 não testados; demais estados inalterados. Evidência: `evidencias/filtro-funil-2026-10-28.json`.

## Busca e filtro do Atendimento — 28/10/2026

REQ-025/026 passaram de parciais a completos após teste na interface publicada com dados existentes, sem mensagens ou alterações de contato. Busca por nome e telefone retornou a mesma conversa; o filtro por etiqueta reduziu 16 conversas a uma e foi restaurado. Contagem: 400 a verificar, 91 completos, 146 parciais; demais estados inalterados. A aba aberta de uma versão anterior também revelou BUG-010: arquivo de painel indisponível após publicação mostrava a recuperação errada. Recarregar resolveu no navegador; o código agora diferencia essa falha de layout corrompido e tenta atualização automática limitada. O link direto `/atendimento` passou a abrir a tela correspondente. Evidência: `evidencias/atendimento-busca-2026-10-28.json`.

## Retomada após desligamento do PC — 28/10/2026

O site continuava acessível, mas o servidor e o túnel do PC estavam desligados. O iniciador restaurou ambos, atualizou a variável pública da API na Vercel e publicou `dpl_AikyJa3WDdZXDmxvtTQX3JoXzZyk` como READY. Saúde local, saúde pelo túnel e `/atendimento` responderam 200; a rota de arquivo sem autenticação respondeu 401. A primeira tentativa em janela oculta falhou porque o PowerShell não carregou o módulo de verificação de assinatura. O iniciador agora importa o módulo explicitamente com três tentativas; sintaxe e assinatura foram conferidas. Falta homologar esse retry em outro reinício real. Evidência: `evidencias/reinicio-2026-10-28.json`.

REQ-596 a REQ-602 passaram de “a verificar” para “parcial”: regras de etiqueta, confirmação de ações, registro de venda e ROI foram conferidos em 2 testes isolados com banco descartável e conector fictício. Falta o percurso visual completo e persistência após recarregar. Contagem: 385 a verificar, 98 completos, 154 parciais; demais estados inalterados. Evidência: `evidencias/acoes-etiquetas-2026-10-28.json`.
