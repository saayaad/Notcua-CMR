# Noctua CRM — Atendimento e operação

Servidor local de atendimento, CRM e automação WhatsApp. Contém a arquitetura, o schema completo, a API base com Socket.io, a importação/exportação JSON e a conexão WhatsApp por QR Code. Inclui a central React, biblioteca de respostas, gravação de voz, PIX e execução de funis. Inclui também o dashboard e o CRM Kanban sincronizado com etiquetas. Inclui o editor visual de fluxos, simulação, versões publicadas e follow-up persistente.

**Para abrir a central:** execute `npm.cmd run dev` e acesse [http://127.0.0.1:5173/atendimento](http://127.0.0.1:5173/atendimento). Veja o [guia da Etapa 3](docs/atendimento.md) e o [guia do CRM da Etapa 4](docs/crm.md).

No Windows, você também pode abrir `Iniciar Noctua.cmd` na pasta do projeto. Ele reconhece os serviços já ligados e inicia os que faltarem. Mantenha a janela aberta durante o uso. A ordenação do menu, das pastas e das etiquetas fica em Configurações → Menu e atalhos. Veja as novas funções no [guia da operação](docs/operacao.md) e o [escopo consolidado](docs/escopo-ampliacao.md).

**Para conectar seu WhatsApp:** abra [http://127.0.0.1:3333/whatsapp](http://127.0.0.1:3333/whatsapp) com o servidor aberto e siga o [passo a passo da Etapa 2](docs/whatsapp.md). Na atualização, pare o servidor, execute `npm.cmd install`, `npm.cmd run db:deploy` e `npm.cmd run db:generate`; depois inicie com `npm.cmd run dev`.

## Iniciar no Windows (PowerShell)

Requer Node.js 22.12+ (validado com Node 24) e npm. Execute na pasta do projeto:

```powershell
Set-Location 'C:\Users\masco\OneDrive\Documentos\Noctua CRM - Atendimento'
npm.cmd install
Copy-Item -LiteralPath '.\apps\server\.env.example' -Destination '.\apps\server\.env'
npm.cmd run db:generate
npm.cmd run db:deploy
npm.cmd run dev
```

Copie `.env.example` somente na primeira configuração; preserve seu `.env` em instalações existentes. A API fica em `http://127.0.0.1:3333`. O SQLite fica em `apps/server/prisma/noctua.db`; o caminho `file:./noctua.db` é relativo ao schema, inclusive no servidor compilado. Dados reais, mídias e credenciais ficam fora do Git. A primeira instalação exige acesso à internet para baixar pacotes e os binários do Prisma.

Verificar a API em outro terminal:

```powershell
Invoke-RestMethod 'http://127.0.0.1:3333/health'
```

Compilar, testar e executar a versão compilada:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd start
```

Para visualizar o banco: `npm.cmd run db:studio`. Depois de alterar o schema, crie uma migração com `npm.cmd run db:migrate -- --name nome_da_alteracao` diretamente no workspace, ou `npm.cmd exec -w @noctua/server -- prisma migrate dev --name nome_da_alteracao`. Em instalações que apenas recebem mudanças, use `npm.cmd run db:deploy`.

## Organização

```text
apps/server/
  prisma/
    schema.prisma              Modelos de todos os módulos
    migrations/                Histórico SQL versionado
  src/
    config/env.ts              Configuração validada
    database/client.ts         Prisma Client
    http/                      Autenticação e tratamento de erros
    modules/backups/           Importação e exportação de backups
    modules/whatsapp/          Conexão, autenticação cifrada e sincronização
    realtime/socket.ts         Servidor Socket.io autenticável
    cli/                       Importação e exportação por terminal
    shared/                    Erros de domínio
    app.ts                     Aplicação HTTP testável
    server.ts                  Inicialização e encerramento
  public/                      Painel de conexão da Etapa 2
  test/                        Testes de backups e WhatsApp em bancos temporários
examples/                      Contratos de exemplo sem dados reais
docs/backups.md                Formatos, limites e comportamento
```

O front-end React/Vite fica em `apps/web`, com TypeScript, Tailwind e lucide-react. O atendimento e os funis ficam em `apps/server/src/modules/attendance`. O módulo WhatsApp está implementado; O CRM e os indicadores ficam em `apps/server/src/modules/crm`; o editor e o motor de fluxos ficam em `apps/server/src/modules/flows`. As tabelas guardam sessões, credenciais cifradas, identidades WhatsApp, contatos, chats, mensagens, arquivos, ativos, macros, etiquetas, negócios, configurações de primeira mensagem, PIX, funis, versões de fluxos, execuções, jobs e auditoria de importação. A chave das sessões é criada em `apps/server/.secrets/whatsapp.key`, ignorada pelo Git. Preserve essa chave ao copiar o banco.

Prisma 6.19.3 está fixado em ambos os pacotes Prisma. Essa versão suporta JSON e enums com SQLite, sem adaptador nativo adicional. Express 5 encaminha falhas de rotas assíncronas ao middleware de erros. Referências: [SQLite no Prisma 6](https://www.prisma.io/docs/orm/v6/overview/databases/sqlite), [erros no Express 5](https://expressjs.com/en/5x/guide/error-handling/).

Os padrões de objetos JSON usam `dbgenerated("'{}'")` para que a migração SQLite contenha literais SQL válidos. O exemplo de ambiente inclui `RUST_LOG=info`, necessário na validação desta instalação Windows para que o mecanismo Prisma inicialize um banco ainda inexistente corretamente. A dependência transitiva `deepmerge-ts` está fixada em 8.0.2 por `overrides` para corrigir o [aviso GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx), mantendo a mesma versão principal do Prisma.

## Importar e exportar

Os caminhos de arquivo dos comandos CLI devem ser **absolutos**, pois o npm executa os comandos dentro de `apps/server`.

```powershell
npm.cmd run backup:import -- 'C:\Users\masco\OneDrive\Documentos\Noctua CRM - Atendimento\examples\ZV_backup.json'
npm.cmd run backup:import -- 'C:\Users\masco\OneDrive\Documentos\Noctua CRM - Atendimento\examples\respostasRapidasAcao.json'
npm.cmd run backup:export -- 'C:\Users\masco\OneDrive\Documentos\Noctua CRM - Atendimento\backup-exportado.json'
```

A exportação CLI recusa sobrescrever um arquivo existente. Os exemplos usam mídia sintética para testar bytes; `fixture.txt` não é áudio reproduzível nem deve ser enviado como PTT. Os testes criam bancos isolados e não alteram o banco local.

Importação HTTP (corpo JSON, sem multipart):

```powershell
$backupPath = 'C:\Users\masco\OneDrive\Documentos\Noctua CRM - Atendimento\examples\ZV_backup.json'
$body = Get-Content -LiteralPath $backupPath -Raw -Encoding utf8
$headers = @{ 'X-Backup-Name' = 'ZV_backup.json' }
Invoke-RestMethod -Uri 'http://127.0.0.1:3333/api/backups/import' -Method Post -ContentType 'application/json; charset=utf-8' -Headers $headers -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
Invoke-WebRequest -Uri 'http://127.0.0.1:3333/api/backups/export' -OutFile '.\exportacao.json'
```

| Método | Rota                                | Resultado                                  |
| ------ | ----------------------------------- | ------------------------------------------ |
| GET    | `/health`                           | Saúde do servidor e acesso ao banco        |
| POST   | `/api/backups/import`               | Importa JSON; 201 novo, 200 repetido       |
| GET    | `/api/backups/export`               | Biblioteca exportada no contrato ZV_backup |
| GET    | `/api/backups/imports`              | Últimas 100 importações e relatórios       |
| GET    | `/api/backups/imports/:id/original` | JSON original preservado                   |
| GET    | `/api/files/:id`                    | Download privado do arquivo decodificado   |

Erros: 400 JSON malformado, 401 token inválido, 404 recurso ausente, 409 ID com tipo incompatível, 413 limite excedido e 422 conteúdo/referências inválidos. Um relatório inclui `batchId`, `format`, `duplicate`, `counts` e `warnings`.

## Acesso local e segurança

O servidor escuta apenas no próprio computador por padrão. Para exigir token também localmente, defina `API_TOKEN` no `.env`. Para mudar `HOST` e aceitar rede, a configuração exige token com pelo menos 32 caracteres. Envie `Authorization: Bearer SEU_TOKEN` em todas as rotas `/api`; o health permanece público. Socket.io recebe o mesmo token em `auth.token` e transmite estados/QR da conexão e avisos de sincronização. A origem do front-end é configurada por `CLIENT_ORIGIN`; o painel local também é aceito.

O modo Firebase oferece login e acesso por convite para uma operação privada, conforme o guia de publicação. O limite de corpo padrão é 40 MiB e cada mídia pode ter até 20 MiB. O arquivo original também é guardado no banco para auditoria, portanto mídias Base64 e bytes decodificados consomem espaço adicional. Backups/exportações contêm dados pessoais; guarde-os em local privado. Não coloque dumps reais no Git. Para banco em uso intenso, prefira uma pasta local sem sincronização de arquivos e use o backup consistente disponível nas configurações.

Para iniciar versionamento, caso esta pasta ainda não seja um repositório:

```powershell
git init
git add .
git commit -m 'feat: base do servidor e importacao de backups'
```

A Etapa 4 está implementada. Veja o [guia do CRM](docs/crm.md) para o Kanban, as métricas e a sincronização. A Etapa 5 também está implementada. Veja o [guia de automações](docs/automacoes.md) para montar, simular, publicar e ativar fluxos.

## Ampliação da operação

Login Firebase, boas-vindas, preferências de privacidade, contatos/planilhas, campanhas, agenda, macros e IA estão documentados no [guia da operação](docs/operacao.md). A preparação para Vercel e servidor persistente está no [guia de publicação](docs/publicacao.md). Configure os serviços externos antes de usar login e IA em produção.
