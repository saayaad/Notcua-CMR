# Contrato de backups — v1

O pedido descreve nomes de campos, mas não inclui arquivos reais dos sistemas de origem. O importador implementa os contratos abaixo; a compatibilidade com variantes não documentadas deve ser verificada com um backup real. Campos desconhecidos são preservados no JSON original. Campos desconhecidos no topo geram avisos. Tipos e referências inválidos interrompem toda a importação, sem gravação parcial.

## Formatos de entrada

1. Objeto ZV direto com qualquer coleção reconhecida: `messages`, `audios`, `medias`, `docs`, `funnels`, `flows`, `labels`, `objectsList`.
2. Envelope `{ "ZV_backup": { ...coleções } }`.
3. Objeto `{ "respostasRapidasAcao": [ ...macros ] }` ou lista de macros diretamente.
4. Macros podem coexistir com coleções ZV no mesmo objeto. O relatório identifica esse conjunto como `ZV_backup`.

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

Backups alterados atualizam entidades pelo ID. Não são excluídas entidades ausentes. Funis e macros recebidos têm sua lista ordenada substituída; os ativos e etiquetas referenciados são validados. Snapshots de fluxo são acrescentados. A importação tem tempo máximo de transação de 60 segundos; exceder o limite desfaz a transação.

`GET /api/backups/export` exporta a **biblioteca** no contrato descrito aqui, com mídias Base64. Não é um backup completo operacional: não inclui chats, histórico, negócios, chaves PIX, sessões, credenciais nem execuções. `GET /api/backups/imports/:id/original` recupera o JSON original semanticamente idêntico (espaçamento e ordem de propriedades podem variar). Isso permite recuperar campos não convertidos. Para cópia integral operacional, pare o servidor e copie o banco SQLite e a configuração privada.

Os exemplos em `examples/` e os testes de integração são a referência executável deste contrato. O arquivo de mídia de exemplo contém apenas o texto `Noctua`, sem áudio real.
