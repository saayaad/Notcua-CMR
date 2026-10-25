# Etapa 3 — Central de atendimento

## Abrir pelo VS Code

Abra a pasta **Noctua CRM - Atendimento** no VS Code. Abra **Terminal > Novo terminal**, escolha **Command Prompt** se o PowerShell apresentar erro e execute:

```powershell
npm.cmd run dev
```

Esse comando inicia o servidor e a interface juntos. Deixe o terminal aberto e acesse **http://127.0.0.1:5173/atendimento**. Para parar, clique no terminal e pressione **Ctrl+C**. Antes de iniciar novamente, pare a execução anterior para evitar porta ocupada.

As dependências e a migração desta etapa já foram instaladas nesta máquina. Ao instalar em outro computador, preserve o banco e a chave de sessão e siga o README. Para usar a versão compilada, execute `npm.cmd run build`, depois `npm.cmd start`, e abra **http://127.0.0.1:3333/atendimento**.

## Conversas

- Escolha sua conexão no topo. Em **Conexões**, você também pode conectar, pausar ou desvincular o WhatsApp. O QR aparece quando a conta precisa ser vinculada.
- Para ver dados do cliente, etiquetas e notas, clique no nome dele no cabeçalho da conversa. As informações ficam em uma janela separada das ferramentas.
- A coluna esquerda permite buscar nome/telefone, filtrar etiquetas, ver mensagens não lidas e atendimentos encerrados.
- Selecione uma conversa para ver o histórico. Enter envia; Shift+Enter insere uma linha. O envio exige WhatsApp conectado.
- O botão de arquivar encerra o atendimento no Noctua. Ele continua disponível na aba **Encerrados**, onde pode ser reaberto.
- **Nova conversa** cadastra um contato pelo telefone com DDI e DDD, somente números; cadastrar não envia mensagem.

## Biblioteca, áudio e anexos

Cadastre textos, áudios, imagens, vídeos e documentos na **Biblioteca**. Use `#nome` para substituir pelo nome do contato. Marque os favoritos para encontrá-los primeiro. No atendimento, clique em um atalho, confira a prévia e envie.

O microfone grava uma mensagem e mostra uma prévia antes do envio. O navegador pedirá acesso ao microfone. Você pode descartar a gravação; ela só é enviada quando confirmar. A gravação tem limite de cinco minutos. O servidor converte os áudios de voz para OGG/Opus usando o FFmpeg incluído na instalação. O upload aceita arquivos de até 20 MiB.

Anexos permitem legenda e, quando aplicável, visualização única, áudio de voz (PTT) ou vídeo circular (PTV). Vídeo circular exige arquivo MP4 compatível; a etapa não inclui editor ou recorte de vídeo. Mídias de visualização única recebidas devem ser abertas no WhatsApp. Outros arquivos são carregados quando você clicar; mídias antigas podem ter expirado no WhatsApp.

Macros importadas aparecem entre os atalhos e podem executar texto, mídia e alterações de etiquetas. Os cadastros de macros continuam sendo importados pelo formato já suportado.

## PIX

Cadastre uma chave que **já exista na sua conta bancária**, com o nome do recebedor e a cidade, em **Biblioteca > PIX**. Para chave aleatória, informe a chave criada pelo seu banco.

No atendimento, **Enviar PIX** permite escolher a chave, informar valor, conferir o QR/Copia e Cola, copiar ou enviar os dados e solicitar comprovante. Também é possível escolher um áudio da biblioteca para acompanhar a solicitação. A confirmação do pagamento é manual: o sistema não consulta seu banco nem aprova comprovantes.

O código usa o formato estático BR Code com CRC16 conforme o [Manual de Padrões para Iniciação do PIX do Banco Central](https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Regulamento_Pix/II_ManualdePadroesparaIniciacaodoPix.pdf).

## Funis

Em **Biblioteca > Funis**, escolha ativos, organize a ordem e defina o intervalo antes de cada envio, em segundos. No painel do contato, abra **Funis** e inicie a sequência desejada. A execução aparece no painel e pode ser cancelada.

Cada conversa executa uma sequência por vez. As etapas ficam salvas no banco; se o WhatsApp desconectar, os próximos envios aguardam reconexão. Alterar a biblioteca não altera uma sequência já iniciada. Cancelar interrompe as próximas etapas; uma mensagem que já começou a ser enviada pode chegar ao destinatário.

Se o processo parar durante um envio, a execução fica com falha para revisão, sem repetir automaticamente uma mensagem de resultado incerto. Confira o WhatsApp antes de iniciar outra sequência. Mantenha o computador e o servidor ligados para executar os intervalos.

## Validação desta entrega

Os testes usam bancos temporários e conexão simulada, sem enviar mensagens aos contatos reais. Eles cobrem envio e prevenção de duplicidade, conversão real de áudio, opções de mídia, PIX, intervalos/cancelamento de funis e rotas da central, além dos testes anteriores de importação e conexão. A entrega dos novos formatos em um aparelho real ainda deve ser conferida com um contato de teste escolhido por você.

A validação usa Zod 4.6.7, atualizado para corrigir o [alerta de consumo de memória GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). A auditoria da instalação não apresentou vulnerabilidades após a atualização.

Kanban e editor visual de fluxos continuam reservados para as etapas 4 e 5.

## Mensagens fixadas e personalização

- Toda a configuração fica em **Personalizar Atendimento**, nas subabas Painéis, Botões, Funções, Atalhos, Mensagens fixadas, Teclas de atalho e Posição livre. Confirme para salvar ou cancele para descartar.
- As barras e os fixados começam vazios. A atualização limpa somente os vínculos anteriores de botões; os conteúdos da Biblioteca permanecem disponíveis.
- Em Mensagens fixadas, filtre por tipo e categoria, escolha os conteúdos e configure separadamente o nome, a categoria e a prévia de cada botão. Remova um item ou todos os vínculos sem apagar os recursos.
- Cada item da lateral tem somente **Enviar**. Com **Mostrar prévia de mensagem nos atalhos** ativado, o clique abre a conferência; desativado, envia diretamente. A escolha individual do botão pode substituir a configuração geral.
- Atalhos de conteúdo abrem apenas a lateral já filtrada. Cliente, Notas, Respostas padrão e demais ferramentas abrem somente sua janela.
- As funções podem ficar em cima ou embaixo. Os atalhos podem ficar no topo, perto da mensagem ou nas laterais. Use as alças ou as setas para reordenar; não existem seletores numéricos.
- Em Posição livre, desencaixe lista, conversa, mensagens fixadas ou barras, ajuste posição e dimensões e confira a prévia. Depois de confirmar, a alça permite mover o bloco. No celular, os blocos voltam ao encaixe para manter o uso da conversa.
- As teclas são configuradas individualmente, com uma modificadora e uma letra, por exemplo Alt+M. Campos vazios desativam o atalho. Ctrl+K permanece reservado à busca global.
- A coruja recolhe ou expande o menu principal.

### Respostas padrão

Em Padrões, cadastre uma pergunta, variações e uma resposta com texto e/ou recursos da Biblioteca, na ordem desejada. O ícone de livro em uma mensagem recebida já preenche a pergunta no cadastro.

Perguntas repetidas procura semelhanças em até 3.000 mensagens de texto dos últimos 60 dias. Exige pelo menos dois clientes distintos, exclui grupos e apresenta respostas históricas somente como sugestão. Revise e cadastre antes de usar. Não depende de IA paga e não responde automaticamente ao cliente.

### Extras

Rascunhos ficam salvos neste navegador por conta, conexão e cliente. Podem ser preparados mesmo com o WhatsApp desconectado; o envio exige conexão. Próxima ação cria lembretes internos com o servidor ligado. Sequências podem ser pausadas, retomadas e canceladas; uma etapa já em envio precisa terminar antes da pausa.

## Revisão do atendimento e Parte 3

A prévia de **Personalizar Atendimento** permanece visível em todas as subabas. Os ajustes só entram em vigor em **Confirmar alterações**. Atalhos de Texto, Áudio, Mídia e Funil abrem a **Biblioteca de atendimento** encaixada na lateral, já filtrada. A aba **Fixados** é opcional; não é necessário fixar conteúdos para acessar a biblioteca. Abrir o Atendimento pelo menu principal fecha a janela transitória anterior.

### Equipe e transferências

Em **Configurações → Departamentos**, cadastre os setores. Em **Equipe**, cadastre o nome, e-mail de login, foto, setor e função de cada atendente; edite ou desative seu acesso quando necessário. O indicador online usa a presença recente no painel (até 90 segundos), e não o status do WhatsApp.

**Transferir atendimento** permite pesquisar um atendente ou escolher uma fila de setor, com observações. A atribuição muda quando um destinatário autorizado aceita. Uma transferência para setor pode ser aceita por um membro ativo desse setor ou pelo administrador.

### Campanhas

Escolha várias listas e etiquetas, combine com inatividade e confira o contador automático. Em **Ver/Selecionar leads manualmente**, marque os contatos que deverão receber. As etiquetas mantêm ordem e cores da personalização. Números inválidos e contatos com saída da comunicação são excluídos da seleção elegível.

A mensagem aceita `{{nome}}`, `{{saudacao}}` e alternativas como `{Olá|Oi}`. Adicione variações manualmente ou use **Gerar variações com IA** depois de configurar a integração de IA e seu limite de uso. Revise os textos: eles são salvos por destinatário ao criar o rascunho e não mudam em uma repetição da mesma tarefa. A prévia de telefone mostra texto e recursos escolhidos; não envia mensagens.

Defina intervalos mínimo/máximo e pausas por lote. Salvar cria um rascunho; a ativação continua sendo uma ação separada. O monitor acompanha campanhas ativas ou pausadas com progresso, contagem regressiva, pausa, retomada e cancelamento com confirmação. O indicador de ritmo usa intervalos/falhas e não mede a segurança da conta nem garante ausência de bloqueios. O computador, servidor e conexão do WhatsApp precisam permanecer disponíveis.

### Agenda e Biblioteca

Na Agenda, pesquise por nome sem acentos ou telefone com/sem DDI, espaços e pontuação. Registros inválidos e identificadores técnicos são filtrados. Um número novo válido pode ser cadastrado pelo próprio campo. O horário é o do navegador.

Na Biblioteca, abra o nome ou a prévia do recurso, ouça áudio no cartão, visualize mídia em uma janela ampliada e use **Editar** para alterar texto, legenda ou substituir o arquivo. Duplicação e exclusão pedem confirmação e mostram o resultado. A exclusão remove o recurso selecionado; confira antes de confirmar.

Todos os seletores das telas React e da conexão WhatsApp usam controles personalizados. Os modais têm rolagem interna e altura limitada à tela; no celular, a prévia de campanha fica após os campos, sem sobreposição.

A revisão visual desta etapa utiliza dados fictícios; nenhum disparo, transferência ou alteração nos contatos reais foi executado para validar as telas. O comportamento de rede/entrega no aparelho deve ser conferido com um contato de teste autorizado.
