# Novas ferramentas da operação

## Contatos, privacidade e equipe

O formulário inicial salva nome, empresa, segmento, equipe, objetivo e rede social. Configurações reúne perfil, tema, privacidade visual, atalhos, assinatura, substituições, avisos, negócio, departamentos, equipe e integração de IA. Preferências visuais ficam neste navegador; os dados da operação são persistidos no servidor.

Em Menu e atalhos, arraste as alças ou use Subir/Descer para ordenar os grupos, os botões dentro de cada grupo, as pastas/categorias da biblioteca e os recursos dentro de cada pasta. A ordem também aparece no painel de ferramentas e é salva neste navegador. Etiquetas têm ordem salva no servidor, compartilhada com as listas e colunas do CRM da conexão selecionada. Etiquetas novas continuam disponíveis ao final; reordenar não muda vínculos nem envia mensagens ao WhatsApp.

Se aparecer “Servidor desconectado” no site da Vercel, abra `Iniciar Noctua.cmd` na pasta do projeto e mantenha a janela aberta. O iniciador reutiliza ou inicia o servidor na porta 3333 e abre o túnel seguro; a interface local na porta 5173 é iniciada separadamente por `npm.cmd run dev`. O painel tenta reconectar automaticamente e atualiza os dados quando o servidor retorna. O status de WhatsApp só é apresentado como conectado enquanto existe comunicação com o servidor.

Clique no nome do cliente para abrir perfil, negócio, resumo e anotações com data. A atribuição identifica o responsável da equipe; não envia a conversa para um número externo. O atalho Google Agenda prepara um evento; você confirma a criação no Google. Nenhum token de calendário é armazenado.

## Planilhas

Importe `.xlsx` ou `.csv` (até 10 MiB, 5.000 linhas). A prévia procura o cabeçalho e sugere colunas, mas permite corrigir nome e telefone antes de importar. Extrai um telefone mesmo com texto ao redor; células ambíguas com vários números são rejeitadas. Telefones brasileiros de 10/11 dígitos recebem 55. Para números de 8/9 dígitos, informe o DDD padrão: o sistema não adivinha a região. Linhas inválidas/repetidas são relatadas. Colunas de tags aceitam separação por `|` ou `;`. Ao informar o nome do lote, a importação cria uma lista disponível nas campanhas. Também cria contatos/conversas/etiquetas locais e não envia mensagens. Campos `opt_in`/consentimento reconhecem sim/true/1/yes; a origem desses consentimentos deve ser conferida pelo operador.

## Campanhas, agenda e lembretes

Escolha uma lista importada ou toda a base, combine etiqueta e dias mínimos sem interação usando E/OU, confira o público e salve como rascunho. A lista é congelada ao salvar; contatos com saída de campanhas são excluídos também na hora de processar. Ative expressamente para iniciar os envios na data escolhida. Pausar/cancelar impede os próximos envios; um envio já em execução pode terminar. Intervalos são sorteados a cada envio e persistidos. A pausa longa acrescenta um intervalo a cada X mensagens daquela campanha. Eles não garantem evitar bloqueios.

O conteúdo pode ser uma sequência de até 30 textos e recursos, com espera por etapa. É possível anexar uma mídia ou gravar áudio, ouvir a prévia e incluí-lo na sequência. O recurso também fica na biblioteca. Textos e legendas aceitam `#nome`, `{{nome}}` e `{{saudacao}}`; a saudação usa o horário de São Paulo na hora do envio. Recursos são congelados no rascunho, preservando o conteúdo mesmo se a biblioteca for editada depois. O contador da campanha representa contatos concluídos; o contador interno de pausas considera cada mensagem da sequência.

A Agenda aceita mensagem, recurso, funil ou lembrete interno de uma conversa. Lembretes geram avisos no painel e não mensagens ao cliente. O servidor precisa estar ligado. Se ficar desligado, os itens vencidos são processados quando voltar, respeitando os intervalos. Um item interrompido durante o envio fica como falha e não é reenviado automaticamente; confira a conversa antes de criar outro.

“Encaminhado” significa enviado ao socket ou funil enfileirado; não significa leitura nem confirmação de pagamento. O histórico de mensagens continua mostrando os recibos recebidos do WhatsApp.

## Macros e funis

Macros podem ser criadas na Biblioteca ou no painel de ferramentas. Combine texto, recursos (incluindo áudio/documento), etiquetas, espera/presença, encerramento/reabertura, fixação, não lida, remoção de etiquetas e atribuição. Utilitários de organização são locais à operação. Os funis oferecem filtro de categoria, busca e descrição do recurso em cada etapa.

## Fluxos

O início permite palavra-chave, qualquer mensagem nova, primeira mensagem, primeira do dia (São Paulo) ou início manual. Há comparações igual/contém/começa/não contém, filtros por etiquetas e etiqueta inicial aplicada transacionalmente ao criar a execução. Documentos também podem ser usados. O início manual usa um fluxo publicado e ativo e pode ser cancelado no chat.

## IA e histórico

Configure OpenAI, Anthropic/Claude ou Google/Gemini, chave, modelo, regras, estilo e base em Integração de IA. Trocar o provedor exige uma nova chave. As sugestões exigem a autorização do atendente para enviar a base e as últimas mensagens ao provedor; elas não enviam mensagens ao cliente. O modo automático tem ativação separada, limite diário e usa apenas novas mensagens individuais sem fluxo/funil ativo. Ele não responde ao histórico. Se a conversa mudar durante a geração, a sugestão fica para revisão nos avisos.

O controle no chat permite assumir o atendimento ou retomar a IA para mensagens novas. Uma mensagem manual pelo painel, sequência manual ou mensagem nova enviada pelo celular pausa a IA. Pedidos reconhecidos por atendimento humano, inclusive em transcrições, também pausam. A verificação é repetida antes do envio. Um envio já entregue ao WhatsApp não pode ser desfeito. Em falha de geração ou limite, a resposta fixa de contingência configurada pode ser enviada uma vez; a IA é pausada e um aviso é criado. Envios de resultado incerto não recebem repetição automática.

Os limites de tokens contabilizam sugestões, respostas automáticas e análises de mídia. O painel registra consumo diário e estimativa mensal em dólares. Informe os preços por milhão de tokens; as reservas antes da chamada são conservadoras e chamadas sem confirmação mantêm a reserva. O custo é estimado, sobretudo em transcrição por duração e modelos de mídia com preços diferentes. Configure limites também no provedor. Reiniciar o servidor preserva o registro de consumo.

No assistente da conversa, escolha uma mídia e autorize a análise. Gemini aceita áudio, imagens e vídeo; OpenAI usa transcrição para áudio e visão para imagens; Claude usa imagens. O modelo escolhido precisa suportar o formato. O limite é 12 MiB por arquivo. Ativar análise automática permite enviar mídias novas ao provedor durante o atendimento da IA. As análises são salvas, reutilizadas e incluídas na exportação. Visualização única é excluída. Não são feitas chamadas externas sem chave/configuração.

Exporte uma conversa pelo histórico ou selecione até 100 em Contatos → Exportar históricos. O filtro de responsável usa a atribuição atual, não identifica o autor de cada mensagem antiga. O ZIP contém histórico JSON, diálogos cronológicos em JSONL/TXT/CSV, uma conversa por registro em `conversa.jsonl`, arquivos de mídia disponíveis e análises existentes. Papéis `user` e `assistant` distinguem cliente e atendente. Arquivos indisponíveis são indicados no manifesto.

A ação de aprovar respostas salva até 100 mensagens recentes como diálogos ordenados na base local, sem enviá-los ao provedor nesse momento. A geração consulta exemplos por relevância de palavras e inclui até oito diálogos, além das regras do administrador. Não há treinamento de pesos ou clonagem de voz; o estilo é orientado por regras e exemplos. A exportação fornece dados para conhecimento, não garante compatibilidade direta com qualquer serviço de fine-tuning.

Planos, indicações remuneradas, cobranças Meta, anúncios, extensão Chrome e templates oficialmente aprovados pertencem a serviços diferentes das capturas de referência. Os recursos desta biblioteca são locais e não são apresentados como aprovados pela Meta.

## Equipe, inatividade e cópias integrais

Conversas fixadas aparecem primeiro na lista. O filtro Minhas usa o responsável da conversa. O rodízio opcional distribui conversas sem responsável entre convites ativos, respeitando o departamento do contato quando preenchido. Ativo indica acesso habilitado, não presença online.

Em Autoatendimento → Por inatividade, cadastre uma regra pausada, escolha o fluxo/etiqueta e confirme a ativação. A verificação roda periodicamente com o servidor ligado. Um mesmo período de inatividade não inicia duas execuções; novas interações podem permitir outro disparo depois do prazo. Conversas sem histórico não entram. Fluxos também podem ser escolhidos em campanhas e na Agenda; usam a versão publicada e ativa ao iniciar.

Configurações → Backups e acesso permite criar e baixar uma cópia integral consistente do banco e da chave de sessão. O backup automático diário é opcional e usa o disco do servidor; não envia cópias para a Vercel ou Firebase. As cópias não são excluídas automaticamente. Em Docker, BACKUP_DIR aponta para o volume persistente.
