# Checklist manual externo

## Firebase e e-mail

### REQ-098 — login com Google

1. Em uma janela anônima, abrir o Noctua publicado e escolher **Continuar com o Google** usando uma conta de teste autorizada.
2. Confirmar o consentimento do Google e verificar que a operação correta abre sem pedir senha do Noctua.
3. Sair, entrar novamente e registrar captura da conta e da operação carregada.

### REQ-099 — login com e-mail e senha

1. Criar ou usar uma conta Firebase de teste `@example.com` previamente autorizada para uma operação descartável.
2. Entrar com e-mail e senha e verificar que outra operação não fica acessível.
3. Sair, repetir o login e registrar captura da operação correta carregada.

### REQ-111 — convite privado da equipe

1. Em uma operação descartável, cadastrar na equipe o e-mail Firebase de teste que receberá acesso.
2. Entrar em outra janela com esse e-mail e confirmar função, setor e isolamento da operação.
3. Desativar o cadastro, repetir o acesso e registrar que a entrada foi recusada.

### REQ-112 — recuperação de senha

1. Na tela de entrada, informar uma conta Firebase de teste e escolher **Esqueci minha senha**.
2. Abrir o e-mail recebido, definir uma nova senha pelo link e voltar ao Noctua.
3. Entrar com a nova senha e registrar o recebimento, o link utilizado e o login concluído.

### REQ-113 — verificação de e-mail

1. Criar uma conta Firebase de teste e confirmar que o Noctua bloqueia o acesso antes da verificação.
2. Abrir o e-mail de verificação, usar o link e escolher **Já confirmei / verificar acesso**.
3. Confirmar que a sessão atualiza e registrar o bloqueio anterior e a liberação posterior.

## Google Agenda

### REQ-118 — criação do evento

1. Abrir um contato fictício, entrar em **Histórico** e escolher **Preparar evento no Google Agenda**.
2. Em uma conta Google de teste, confirmar nome do contato e descrição preenchidos no formulário do evento.
3. Salvar e excluir o evento de teste, registrando captura dos campos preenchidos.

## WhatsApp em aparelho de teste

### REQ-125 — documento enviado por fluxo

1. Em uma conexão e número descartáveis, publicar um fluxo de teste com um documento PDF fictício.
2. Acionar o fluxo e confirmar no aparelho que o arquivo abre, preserva nome e aparece como documento.
3. Registrar captura no remetente e no destinatário e depois remover o fluxo e o arquivo de teste.
