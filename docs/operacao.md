# Novas ferramentas da operação

## Contatos, privacidade e equipe

O formulário inicial salva nome, empresa, segmento, equipe, objetivo e rede social. Configurações reúne perfil, tema, privacidade visual, atalhos, assinatura, substituições, avisos, negócio, departamentos, equipe e integração de IA. Preferências visuais ficam neste navegador; os dados da operação são persistidos no servidor.

Clique no nome do cliente para abrir perfil, negócio, resumo e anotações com data. A atribuição identifica o responsável da equipe; não envia a conversa para um número externo. O atalho Google Agenda prepara um evento; você confirma a criação no Google. Nenhum token de calendário é armazenado.

## Planilhas

Importe `.xlsx` ou `.csv` (até 10 MiB, 5.000 linhas). A prévia procura o cabeçalho e sugere colunas, mas permite corrigir nome e telefone antes de importar. Telefones brasileiros de 10/11 dígitos recebem 55. Linhas inválidas/repetidas são relatadas. Colunas de tags aceitam separação por `|` ou `;`. A importação cria contatos/conversas/etiquetas locais e não envia mensagens. Campos `opt_in`/consentimento reconhecem sim/true/1/yes; a origem desses consentimentos deve ser conferida pelo operador.

## Campanhas, agenda e lembretes

Escolha etiquetas e dias mínimos sem interação, confira o público e salve o conteúdo como rascunho. A lista é congelada ao salvar; contatos com saída de campanhas são excluídos também na hora de processar. Ative expressamente para iniciar os envios na data escolhida. Pausar/cancelar impede os próximos envios; um envio já em execução pode terminar. Intervalos são sorteados a cada envio e persistidos. Eles não garantem evitar bloqueios.

A Agenda aceita mensagem, recurso, funil ou lembrete interno de uma conversa. Lembretes geram avisos no painel e não mensagens ao cliente. O servidor precisa estar ligado. Se ficar desligado, os itens vencidos são processados quando voltar, respeitando os intervalos. Um item interrompido durante o envio fica como falha e não é reenviado automaticamente; confira a conversa antes de criar outro.

“Encaminhado” significa enviado ao socket ou funil enfileirado; não significa leitura nem confirmação de pagamento. O histórico de mensagens continua mostrando os recibos recebidos do WhatsApp.

## Macros e funis

Macros podem ser criadas na Biblioteca ou no painel de ferramentas. Combine texto, recursos (incluindo áudio/documento), etiquetas, espera/presença, encerramento/reabertura, fixação, não lida, remoção de etiquetas e atribuição. Utilitários de organização são locais à operação. Os funis oferecem filtro de categoria, busca e descrição do recurso em cada etapa.

## Fluxos

O início permite palavra-chave, qualquer mensagem nova, primeira mensagem, primeira do dia (São Paulo) ou início manual. Há comparações igual/contém/começa/não contém, filtros por etiquetas e etiqueta inicial aplicada transacionalmente ao criar a execução. Documentos também podem ser usados. O início manual usa um fluxo publicado e ativo e pode ser cancelado no chat.

## IA e histórico

Configure chave, modelo, regras, estilo e base em Integração de IA. As sugestões exigem a autorização do atendente para enviar a base e as últimas mensagens ao provedor; elas não enviam mensagens ao cliente. O modo automático tem ativação separada, limite diário e usa apenas novas mensagens individuais sem fluxo/funil ativo. Ele não responde ao histórico. Se a conversa mudar durante a geração, a sugestão fica para revisão nos avisos.

Exporte o histórico em ZIP, com textos e mídias disponíveis. Mídias de visualização única não são exportadas; arquivos indisponíveis são indicados no manifesto. A ação de aprovar respostas adiciona exemplos à base local da IA, sem enviá-los ao provedor nesse momento. Não há treinamento de pesos ou clonagem de voz; o estilo é orientado por regras e exemplos. Áudios/vídeos não são transcritos automaticamente.

Planos, indicações remuneradas, cobranças Meta, anúncios, extensão Chrome e templates oficialmente aprovados pertencem a serviços diferentes das capturas de referência. Os recursos desta biblioteca são locais e não são apresentados como aprovados pela Meta.

## Equipe, inatividade e cópias integrais

Conversas fixadas aparecem primeiro na lista. O filtro Minhas usa o responsável da conversa. O rodízio opcional distribui conversas sem responsável entre convites ativos, respeitando o departamento do contato quando preenchido. Ativo indica acesso habilitado, não presença online.

Em Autoatendimento → Por inatividade, cadastre uma regra pausada, escolha o fluxo/etiqueta e confirme a ativação. A verificação roda periodicamente com o servidor ligado. Um mesmo período de inatividade não inicia duas execuções; novas interações podem permitir outro disparo depois do prazo. Conversas sem histórico não entram. Fluxos também podem ser escolhidos em campanhas e na Agenda; usam a versão publicada e ativa ao iniciar.

Configurações → Backups e acesso permite criar e baixar uma cópia integral consistente do banco e da chave de sessão. O backup automático diário é opcional e usa o disco do servidor; não envia cópias para a Vercel ou Firebase. As cópias não são excluídas automaticamente. Em Docker, BACKUP_DIR aponta para o volume persistente.
