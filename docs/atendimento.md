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
- A coluna direita é exclusiva das ferramentas: textos, áudios, mídias, documentos, funis, macros e PIX. Crie e edite respostas por ali, sem sair da conversa. Use o botão **Ferramentas** no topo para ocultar ou mostrar a lateral. O painel começa compacto; o botão de ampliar no cabeçalho alterna entre 260 e 320 pixels. A preferência fica salva neste navegador. Em telas menores, você também pode abrir por **Respostas rápidas**. Na lateral, escolha a categoria e use **Usar** para preparar envios ou **Gerenciar** para criar e editar recursos.
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
