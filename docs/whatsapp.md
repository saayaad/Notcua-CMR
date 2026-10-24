# Etapa 2 — Conexão WhatsApp

Esta etapa adiciona conexão Baileys, QR Code via Socket.io, persistência cifrada de autenticação, reconexão, sincronização de contatos/conversas/mensagens/fotos/etiquetas e a regra de etiqueta na primeira mensagem. O painel em `/whatsapp` serve para conectar e verificar a integração; a central de atendimento React continua reservada à Etapa 3.

## Para começar no VS Code

1. Abra a pasta `Noctua CRM - Atendimento` no VS Code.
2. Abra **Terminal → New Terminal**. Se o PowerShell não abrir, selecione **Command Prompt** como perfil do terminal.
3. Se houver um servidor em execução, pare com **Ctrl + C**. Use apenas uma execução deste projeto por banco de dados.
4. Na primeira atualização para a Etapa 2, execute os comandos abaixo, um de cada vez:

```powershell
npm.cmd install
npm.cmd run db:deploy
npm.cmd run db:generate
npm.cmd run dev
```

Na máquina em que esta entrega foi desenvolvida, dependências e migração já foram aplicadas. Para uso normal, basta `npm.cmd run dev`. O terminal deve estar na pasta do projeto. Se necessário, entre nela antes:

```powershell
cd "C:\Users\masco\OneDrive\Documentos\Noctua CRM - Atendimento"
```

Abra [http://127.0.0.1:3333/whatsapp](http://127.0.0.1:3333/whatsapp).

1. Em **Nome da nova conexão**, digite `Atendimento principal` e clique em **Criar conexão**.
2. Clique em **Conectar** e aguarde o QR Code. Se já houver uma conexão, selecione-a em **Conexões existentes**.
3. No celular, abra WhatsApp → **Aparelhos conectados → Conectar um aparelho**. No iPhone, esse menu fica em Configurações; no Android, normalmente fica no menu de três pontos.
4. Escaneie o código do monitor com o WhatsApp. O estado deve mudar para **Conectado**.
5. Mantenha o servidor aberto. Os contadores aumentam conforme o histórico é recebido.

O QR Code é renovado automaticamente. Quando expira, a imagem antiga é removida. **Pausar conexão** fecha a conexão local e conserva as credenciais para conectar depois. **Desvincular WhatsApp** solicita a saída ao WhatsApp e apaga as credenciais locais após confirmação. Para desvincular uma sessão pausada, conecte antes ou remova o aparelho diretamente no celular.

## Etiqueta na primeira mensagem

No painel, escolha uma etiqueta importada do WhatsApp ou crie uma etiqueta local do CRM. Ative a opção e clique em **Salvar regra**. A regra vale para as próximas primeiras mensagens de conversas individuais novas no banco da sessão. Ela não é retroativa.

- Mensagens históricas não disparam a regra.
- Conversas conhecidas pelo histórico não são consideradas novos leads.
- Grupos, status, canais, eventos técnicos e mensagens enviadas pelo próprio usuário não disparam a regra.
- Repetições da mesma mensagem não criam novas mensagens, novas contagens nem novas aplicações de etiqueta.
- Uma etiqueta local fica no CRM. Uma etiqueta importada da mesma sessão também é aplicada no WhatsApp, com fila persistida e até cinco tentativas em caso de erro.
- Se as cinco tentativas falharem, o painel informa a pendência. O vínculo local é preservado. A fila pode ser inspecionada em `ScheduledJob` pelo Prisma Studio; o reenvio manual de jobs não faz parte deste painel.

Etiquetas importadas têm `createReason: "Importado do whatsapp"`. O ID original, o índice da cor e a sessão são preservados; a interface recebe uma aproximação hexadecimal da paleta. A sincronização importa associações de etiquetas a conversas, sem confundir etiquetas de mensagens individuais com etapas do contato. Exclusões de etiqueta no WhatsApp removem vínculos locais e desativam regras que dependiam dela, preservando o registro para referências anteriores.

## Persistência e cuidados com os arquivos

As credenciais e todas as categorias de chaves Signal do Baileys 7 são persistidas em `WhatsappAuthEntry` com AES-256-GCM. A chave é criada automaticamente em `apps/server/.secrets/whatsapp.key`. O diretório é ignorado pelo Git, assim como o banco e `.env`.

**Guarde a chave junto com a cópia privada do banco.** Sem ela, uma sessão persistida não pode ser recuperada. O servidor não substitui uma chave existente inválida. No Windows, o acesso ao arquivo também depende das permissões da sua conta e da pasta. A cifragem protege os registros de autenticação no banco; ela não cifra todo o SQLite nem o histórico de conversas.

QR Codes ficam apenas em memória e são enviados a clientes autorizados. Nenhuma rota exporta credenciais. O painel usa o mesmo `API_TOKEN` opcional das rotas e do Socket.io. Se configurado, abra **Acesso com token** e informe-o. O token da página não é salvo no armazenamento do navegador. A página pública contém somente a interface; dados e QR Code dependem das chamadas autenticadas.

Ao fechar normalmente o servidor, as sessões que estavam conectadas podem ser restauradas na próxima inicialização. Sessões pausadas manualmente ficam pausadas. Uma saída feita pelo celular desativa a reconexão e limpa as credenciais daquela sessão. Falhas transitórias tentam reconectar com intervalo crescente; a configuração padrão permite cinco tentativas consecutivas. Na falta de conexão, a sincronização e a entrega de etiquetas ficam suspensas.

Use **uma instância do servidor por banco**: abrir o mesmo banco em duas execuções com portas diferentes pode disputar o estado de autenticação. Não edite credenciais pelo Prisma Studio.

## O que é sincronizado

- Contatos e nomes conhecidos; nomes salvos têm preferência sobre nomes de apresentação em mensagens.
- Identificadores de telefone e LID. Um LID não é tratado como telefone. Quando o WhatsApp informa o par LID/telefone, os contatos são unidos preservando mensagens e etiquetas.
- Conversas, mensagens e estados de entrega recebidos pelos eventos do Baileys. Os dados são mesclados por ID; o histórico recebido não apaga conversas anteriores.
- Fotos de perfil por consultas graduais em segundo plano, respeitando indisponibilidade e privacidade. São guardadas as URLs retornadas pelo WhatsApp; essas URLs podem expirar e ser atualizadas na próxima sincronização.
- Etiquetas do WhatsApp Business quando disponibilizadas para o aparelho vinculado. Uma conta pessoal pode não enviar etiquetas.

O servidor solicita histórico completo com `syncFullHistory`, mas **o volume efetivamente recebido depende do WhatsApp**. Não há garantia de importar todo o histórico do celular. O recebimento pode ocorrer em vários lotes. O perfil de conexão é Chrome; o perfil Desktop foi evitado devido à [incompatibilidade relatada no projeto Baileys](https://github.com/WhiskeySockets/Baileys/issues/2671). A Etapa 2 guarda texto, metadados e referência original de mídia; baixar e enviar os arquivos das conversas integra a Etapa 3. Ela não envia mensagens automáticas ao conectar.

## Rotas

Todas as rotas abaixo usam o prefixo `/api/whatsapp` e o mesmo controle de acesso da API de backups.

| Método     | Rota                                                                      | Função                                            |
| ---------- | ------------------------------------------------------------------------- | ------------------------------------------------- |
| GET / POST | `/sessions`                                                               | Listar / criar conexão                            |
| GET        | `/sessions/:id`                                                           | Estado atual, QR e expiração                      |
| POST       | `/sessions/:id/connect`                                                   | Iniciar conexão ou reutilizar a ativa             |
| POST       | `/sessions/:id/disconnect`                                                | Pausar e conservar credenciais                    |
| POST       | `/sessions/:id/logout`                                                    | Desvincular uma sessão conectada                  |
| POST       | `/sessions/:id/resync-labels`                                             | Solicitar ressincronização do estado de etiquetas |
| GET / PUT  | `/sessions/:id/settings`                                                  | Consultar / salvar regra de primeira mensagem     |
| GET / POST | `/sessions/:id/labels`                                                    | Listar etiquetas / criar etiqueta local           |
| GET        | `/sessions/:id/summary`                                                   | Contadores de sincronização e fila de etiquetas   |
| GET        | `/sessions/:id/conversations?page=1&pageSize=30`                          | Conversas paginadas                               |
| GET        | `/sessions/:id/conversations/:conversationId/messages?page=1&pageSize=30` | Mensagens paginadas, recentes primeiro            |

`POST /sessions` recebe `{ "name": "Atendimento principal" }`.

`PUT /sessions/:id/settings` recebe `{ "autoLabelFirstMessage": true, "firstMessageLabelId": "ID_DA_ETIQUETA" }`. Apenas etiquetas locais/globais ou importadas da própria sessão podem ser usadas. O fuso aceito nesta etapa é `America/Sao_Paulo`.

Eventos Socket.io: `server:ready`, `whatsapp:state`, `whatsapp:sync`, `whatsapp:error`. O estado inclui `qrDataUrl` e `qrExpiresAt`; ele é reenviado quando o navegador reconecta. Eventos de sincronização invalidam os dados consultados pela API, sem transmitir o conteúdo de cada mensagem indiscriminadamente.

## Problemas comuns

**`EADDRINUSE` / porta 3333 em uso:** o servidor já está aberto em outro terminal. Pare a execução anterior com Ctrl + C e execute o comando em apenas um terminal. Teste o endereço `/health` para verificar o servidor.

**`EPERM` ao gerar Prisma no Windows:** pare o servidor antes de executar `db:generate`, pois o Windows pode manter a biblioteca do banco bloqueada enquanto o servidor está aberto.

**O QR não aparece:** confira a conexão com a internet, clique em Pausar e depois Conectar, ou aguarde a tentativa automática. Em redes com proxy/firewall, o processo Node precisa conseguir acessar os serviços do WhatsApp por HTTPS e WebSocket. As mensagens detalhadas da biblioteca ficam desativadas por padrão para não registrar informações sensíveis.

**O estado está Conectado e não há QR:** isso é esperado. A conta já está vinculada e não precisa de outra leitura. O QR é removido assim que a conexão abre. Use o endereço da sua instalação, normalmente `http://127.0.0.1:3333/whatsapp`; endereços em portas temporárias dos testes não são sua instalação.

**Falha de sincronização com a conta ainda conectada:** o vínculo e a importação de dados são estados diferentes. O servidor faz até três tentativas para erros transitórios conhecidos do Prisma durante os eventos de dados. Se a operação continuar falhando, o terminal registra o código e o nome do evento, sem conteúdo de mensagens. O campo `lastError` da rota de estado também disponibiliza esse diagnóstico. Um próximo processamento bem-sucedido do mesmo evento limpa o aviso. Na verificação após o relato de falha inicial, a sessão restaurou a conexão e continuou importando conversas e etiquetas; o código exato do erro anterior não havia sido registrado pela versão antiga.

**O celular conecta, mas o histórico chega aos poucos:** isso é esperado. Aguarde a sincronização e mantenha o aparelho com acesso à internet.

**A etiqueta do celular não aparece:** use WhatsApp Business, aguarde a sincronização e tente **Sincronizar etiquetas novamente**. A disponibilidade depende do estado enviado pelo WhatsApp.

## Verificação

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

Os testes automatizados usam bancos SQLite temporários e um socket WhatsApp simulado. Validam cifragem, restauração de chaves, QR em memória, reconexão, pausa, logout, deduplicação, identidades LID/telefone, etiquetas, regra de primeira mensagem, fila de tentativas, rotas e autenticação Socket.io. O pareamento real exige que você escaneie o QR no celular.

A geração de um QR real também foi verificada por um teste de rede isolado, sem vincular conta nem enviar mensagens. O painel foi aberto em navegador para conferir o QR, criar uma etiqueta local, salvar a regra e pausar a sessão. Para repetir somente o teste de geração real, após compilar: `node apps/server/scripts/smoke-whatsapp.mjs` a partir da raiz. Esse comando exige internet, cria banco e chave temporários e os remove ao terminar. O recebimento de dados de uma conta real só pode ser confirmado depois do pareamento pelo celular.

Referências técnicas usadas: [QR Code](https://baileys.wiki/authentication/qr-code), [persistência de sessão](https://baileys.wiki/authentication/session-management), [histórico](https://baileys.wiki/advanced/history-sync) e [identidades no Baileys 7](https://baileys.wiki/migration/v7). Baileys é uma biblioteca independente de WhatsApp; a versão utilizada está fixada em `7.0.0-rc14`.
