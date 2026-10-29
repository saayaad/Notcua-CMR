# Cobertura de backup e importações pendentes — 29/10/2026

## Escopo e método

Inspeção somente de código, testes anteriores e metadados de arquivos locais. Nenhum banco ou backup foi aberto, importado, restaurado ou alterado. Nenhum envio foi feito. Não houve repetição dos testes anteriores.

## Prova preservada

- REQ-089: `apps/server/test/backup.test.ts:191–242` importou um Sutofly fictício em SQLite descartável, confirmou fluxo `enabled=false`, versão `DRAFT`, agendamento `DRAFT` e backup automático desativado. `apps/server/src/modules/backups/sutofly.ts:268` também força fluxo desativado. Isso prova a regra do conversor nesse fixture, não a importação do arquivo real na conexão Teste nem os nove agendamentos do arquivo histórico.
- REQ-090: `apps/server/src/modules/backups/zapvoice.ts:34` força fluxos importados desativados; `apps/server/test/backup.test.ts:339–375` comprovou importação de imagem e vídeo fictícios com bytes e MIME preservados. A suíte antiga documentada no livro confirmou o formato ZV em banco descartável. Falta prova do arquivo real e da conexão Teste.
- Backups de sistema por espaço de trabalho: `apps/server/src/modules/operations/system-backups.ts:18–29` copia somente o banco SQLite e sua chave para o diretório de backup do espaço ativo. `apps/server/src/modules/access/workspaces.ts:136–156` cria banco/chave/diretório de backup separados para cada espaço. `apps/server/src/modules/operations/operations.routes.ts:129–185` limita listagem, criação e download ao administrador do espaço e entrega ZIP com `noctua.db` e `whatsapp.key`. O teste anterior `apps/server/test/safety.test.ts:129–164` verificou restauração do banco e chave fictícios antes de reset.
- O exportador JSON de `docs/backups.md:66` é apenas da Biblioteca; a própria documentação exclui chats, histórico, sessões e credenciais da exportação. Não o confundir com cópia integral do sistema.

## Lacuna observada nos metadados

No diretório principal `apps/server/backups/system`, há cinco pares `.db`/`.key`, sem par incompleto; o mais recente tem modificação em 29/10/2026 às 16:11 no horário local. Existem três diretórios de espaço de trabalho em `apps/server/.secrets/workspaces`, cada um com banco e chave, mas nenhum contém arquivo `.db` em `backups`. Os diretórios e backups observados ficam no mesmo computador. Esta contagem não prova se já existe uma cópia fora dele, nem qual dos três espaços corresponde à conexão Teste.

## Pendências e decisão

- REQ-089/090 continuam parciais: conferir relatório e cópia integral preexistentes da conexão Teste, identificar o arquivo correspondente e planejar teste em cópia descartável. A importação real não será repetida sem essa prova e autorização específica.
- Risco transversal de recuperação: os três espaços não têm backup local próprio no diretório previsto. A estratégia de cópia fora deste computador, seu destino privado, abrangência do registro da plataforma e restauração exigem decisão do proprietário antes de implementação ou alteração dos dados. Não incluir credenciais privadas no Git/Vercel público.
