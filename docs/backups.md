# Contrato de backups — v1

O importador reconhece o contrato Noctua/ZV e o formato Sutofly, validado com o backup real fornecido pelo proprietário (89.881.588 bytes). Campos não convertidos são preservados no JSON original. Tipos e referências inválidos interrompem a transação, sem gravação parcial.

## Formatos de entrada

1. Objeto ZV direto com qualquer coleção reconhecida: `messages`, `audios`, `medias`, `docs`, `funnels`, `flows`, `labels`, `objectsList`.
2. Envelope `{ "ZV_backup": { ...coleções } }`.
3. Objeto `{ "respostasRapidasAcao": [ ...macros ] }` ou lista de macros diretamente.
4. Macros podem coexistir com coleções ZV no mesmo objeto. O relatório identifica esse conjunto como `ZV_backup`.
5. Sutofly: `respostasRapidas` e demais seções cifradas são lidas com o formato de compatibilidade da extensão oficial. As ações em `propriedades` são normalizadas, incluindo texto, áudio, imagens, vídeos, figurinha, PIX e etiquetas. Identificadores repetidos de ações em macros diferentes são preservados com referências internas distintas. Nomes dos scripts vêm de `respostasRapidas`.

## Arquivos grandes e importação pelo painel

O painel envia o próprio arquivo para `POST /api/backups/upload`, sem ler e reconstruir todo o JSON no navegador. O servidor recebe em disco temporário, responde 202 e processa a importação em segundo plano. `GET /api/backups/jobs/:id` fornece o estado e o relatório. O ID do trabalho fica na sessão do navegador para continuar o acompanhamento ao voltar à aba. Somente administradores podem usar esses endpoints.

O limite de 40 MiB do corpo JSON comum não se aplica aos endpoints de backup. Também foi retirado o limite de 20 MiB por mídia durante a leitura do backup, inclusive pela linha de comando. Os outros formulários e envios de mídias continuam com seus próprios limites. Não existe teto de tamanho configurado para o backup; memória, espaço em disco e eventuais limites do provedor/proxy continuam sendo limites físicos de operação. O parser JSON do servidor precisa acomodar o conteúdo na memória.

Os arquivos temporários são removidos ao concluir ou falhar. Ao reiniciar o servidor durante um trabalho, o painel informa a interrupção; reenvie o mesmo arquivo para verificar/concluir sem duplicar recursos. O JSON original completo continua guardado no banco para auditoria. Configure armazenamento suficiente para a cópia original e os arquivos decodificados.

## Configurações do Sutofly

Contatos são recuperados, chaves PIX são preservadas para revisão e substituições de texto podem ser aplicadas às preferências do navegador. O horário do backup automático é restaurado; a ativação das cópias integrais do Noctua exige conferência. Integrações e credenciais externas do Sutofly não são ativadas automaticamente.

Agendamentos são recuperados como rascunhos na conexão selecionada, mantendo datas e dados originais. Datas antigas e recorrências precisam ser revistas antes de ativar. A importação não inicia envios nem ativa fluxos.

O fluxo do arquivo fornecido contém 13 blocos e nove referências a mídias ausentes: o arquivo não trouxe `fluxoFiles`. O importador preserva o desenho como rascunho, inclui blocos de espera por resposta e aponta as mídias faltantes. Esses arquivos precisam ser vinculados antes de publicar. As etiquetas referenciadas são associadas às etiquetas atuais da conexão pelo identificador WhatsApp; quando não encontradas, ficam com nomes de identificação para revisão.

Coleções omitidas não apagam dados existentes. Coleções devem ser arrays, exceto `objectsList`, que também aceita mapa indexado pelo ID. IDs aceitam string ou número e são normalizados para string; IDs de ativos são únicos entre todos os tipos de ativo. Nome aceita `name` e, nos ativos, também `title`. Campos booleanos exigem booleanos JSON.

## Arquivos e ativos

`objectsList` aceita `[{ id, base64, filename, mimeType }]`, `[{ id, data, filename, mimeType }]`, `{ "id": "BASE64" }` ou `{ "id": { base64, filename, mimeType } }`. `base64` e `data` podem conter Base64 puro ou Data URL como `data:image/png;base64,...`. O conteúdo é validado, decodificado e deduplicado por SHA-256. O nome do arquivo é higienizado; nenhum caminho enviado pelo backup é usado para gravar no disco. Os bytes ficam em `StoredFile.data` e podem ser baixados pela API com o mesmo controle de acesso dos backups.

Ativos possuem `id`, `name`/`title`, `isFavorite`, `caption`, `isPtt`, `isPtv`, `asViewOnce`. Mensagens exigem `text` ou `message`. Outros tipos exigem `base64` inline ou referência `objectId`/`fileId` em `objectsList`; também é aceito arquivo com ID igual ao ativo. Arquivos referenciados precisam constar no mesmo backup. Mídia externa não é baixada. O MIME do Data URL prevalece sobre o campo `mimeType`; sem ambos, usa `application/octet-stream`. A Etapa 1 armazena bytes e atributos; não converte codecs nem verifica se o conteúdo é um áudio/vídeo válido para WhatsApp.

## Etiquetas, contatos e macros

Etiquetas: `id`, `name`, `color` hexadecimal de seis dígitos, `description`, `createReason` e `phoneNumbers`. `createReason` é preservado quando enviado; o padrão de backup é `Importado de backup`. O motivo `Importado do whatsapp` será usado pela sincronização na Etapa 2. Telefones são normalizados para dígitos, entre 8 e 15 caracteres; informe código do país. O importador adiciona vínculos de etiqueta sem remover vínculos existentes.

Macros: `id`, `name`, `text` opcional, `isFavorite` e `acao` como lista ordenada. Tipos aceitos: `txt` (`text` ou `message`), `media`/`image`/`video` (`base64`) e `addLabel`/`removeLabel` (`labelID`). Etiquetas precisam existir no banco ou no mesmo backup. Uma macro sem ações pode representar apenas texto.

**Unidades:** `aguarde` e `composing` são interpretados em **segundos**, inclusive fracionários, e convertidos para milissegundos inteiros. Todos os atrasos de funis e fluxos já são **milissegundos**. Caso seu exportador use outra unidade para `aguarde`, adapte o backup ou o contrato explicitamente antes de importar.

## Funis e fluxos

Funis: `id`, `name`, `itemsSequence: [{ itemId, type, delayBeforeSend }]`. Tipos: `message`, `audio`, `media`, `doc`/`document`. O tipo deve corresponder ao ativo. A lista é persistida na ordem recebida.

Fluxos: `id`, `name`, `enabled`, `draft`, `published`. Cada versão é objeto `{ nodes, edges? }`; `nodes` diretamente no fluxo representa um rascunho. Um fluxo ativo exige versão publicada. Cada grafo deve ter exatamente um `start`, IDs de nós únicos e referências válidas. Nós: `id`, `type`, `position: { x, y }`; configurações aceitas no próprio nó ou em `data`, que prevalece. Tipos: `start`, `text`, `audio`, `media`, `delay`, `user-input`.

- `start`: `keywordRules: [{ rule: "equals" | "contains", keyword }]`, `isCaseSensitive`, `sendToContacts`, `sendToGroups`, `schedule: { days, minTime, maxTime }`. Dias: 0 domingo a 6 sábado; horário `HH:mm`. Fuso da sessão: `America/Sao_Paulo` por padrão.
- `text`/`audio`/`media`: `itemId`, `simulationDelay` e `nextNodeIds`. O tipo de ativo precisa corresponder ao tipo do nó.
- `delay`: `delayInMs`, `nextNodeIds`.
- `user-input`: `compareRule` obrigatório (`anything` ou `contains`), `expectedMessages` obrigatório para `contains`, `expirationTimeoutInMs`, `followUpData`, `nextNodeIdOnExpiration`, `nextNodeIdOnDifferentAnswer` e `nextNodeIds`.
- `edges`: referências `source` e `target`. Todas precisam apontar para nós da mesma versão. As configurações originais são preservadas no snapshot JSON e as propriedades principais também são armazenadas em colunas.

Cada importação alterada cria novas versões de fluxo, mantendo snapshots antigos para execuções futuras. O schema já suporta pausa, expiração, retomada e jobs persistentes; nenhum fluxo é executado na Etapa 1.

## Reimportação e exportação

O SHA-256 do JSON canônico reconhece o mesmo backup mesmo com mudanças de indentação ou ordem das chaves. A ordem dos arrays é significativa. Uma repetição retorna o relatório anterior com `duplicate: true` e não reaplica conteúdo. Isso significa que reimportar o mesmo backup não restaura alterações feitas depois da importação original.

Backups alterados atualizam entidades pelo ID. Não são excluídas entidades ausentes. Funis e macros recebidos têm sua lista ordenada substituída; os ativos e etiquetas referenciados são validados. Snapshots de fluxo são acrescentados. A transação de importação pode usar até 15 minutos; exceder esse prazo desfaz a transação. O hash é calculado incrementalmente para reduzir cópias grandes em memória e mantém a identidade dos backups anteriores.

`GET /api/backups/export` exporta a **biblioteca** no contrato descrito aqui, com mídias Base64. Não é um backup completo operacional: não inclui chats, histórico, negócios, chaves PIX, sessões, credenciais nem execuções. `GET /api/backups/imports/:id/original` recupera o JSON original semanticamente idêntico (espaçamento e ordem de propriedades podem variar). Isso permite recuperar campos não convertidos. Para cópia integral operacional, pare o servidor e copie o banco SQLite e a configuração privada.

Os exemplos em `examples/` e os testes de integração são a referência executável deste contrato. O arquivo de mídia de exemplo contém apenas o texto `Noctua`, sem áudio real.
