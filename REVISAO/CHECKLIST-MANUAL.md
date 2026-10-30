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

## Navegadores e dispositivos físicos

### REQ-164 — preferências da conta em outro dispositivo

1. Em uma conta e operação descartáveis, alterar um nome, cor e preferência de layout no primeiro navegador físico.
2. Entrar com a mesma conta em um segundo navegador ou aparelho e confirmar os três valores sem copiá-los localmente.
3. Recarregar ambos, registrar as telas e restaurar as preferências de teste.

### REQ-198 — atendimento responsivo em aparelhos reais

1. Abrir o Atendimento em um telefone e um tablet físicos, sem alterar dados de produção.
2. Exercitar menu principal, lista, conversa, retorno à lista e abertura/fechamento da biblioteca, conferindo ausência de corte e rolagem horizontal.
3. Repetir em pelo menos dois motores de navegador disponíveis e registrar resolução, navegador e capturas.

## WhatsApp em aparelho de teste

### REQ-125 — documento enviado por fluxo

1. Em uma conexão e número descartáveis, publicar um fluxo de teste com um documento PDF fictício.
2. Acionar o fluxo e confirmar no aparelho que o arquivo abre, preserva nome e aparece como documento.
3. Registrar captura no remetente e no destinatário e depois remover o fluxo e o arquivo de teste.

### REQ-139 — reconexão real da sessão

1. Em uma conexão WhatsApp descartável, manter a tela de Conexões aberta e interromper temporariamente a rede do aparelho.
2. Restaurar a rede e confirmar que o estado retorna e novos eventos aparecem sem recriar a conexão.
3. Registrar o estado antes, durante e depois da reconexão e desvincular o aparelho de teste.

### REQ-150 — sequência multimídia em aparelho

1. Em uma conexão e número descartáveis, criar uma sequência com texto, áudio, imagem ou vídeo e as variáveis `{{nome}}` e `{{saudacao}}`.
2. Executar somente para o número de teste e confirmar ordem, conteúdo, substituições e abertura das mídias no aparelho.
3. Registrar as duas pontas e excluir campanha, arquivos e conexão de teste.

## IA real — adiada; não solicitar chave

Os requisitos abaixo estão aprovados com provedor simulado e em estado **COMPLETO-LOCAL**. Não há ação pendente agora e a auditoria não deve voltar a pedir chave. Executar esta seção somente se o usuário decidir futuramente contratar ou fornecer um provedor real.

### REQ-130 — chave real dos provedores

1. Em operação descartável, cadastrar uma chave real especificamente autorizada para OpenAI, Anthropic ou Gemini.
2. Confirmar modelo disponível, máscara da chave e ausência do valor em respostas e registros visíveis.
3. Excluir a chave ao final e registrar cadastro, uso e remoção sem copiar o segredo.

### REQ-140 — transcrição real de áudio

1. Com provedor real autorizado, enviar um áudio fictício sem dados pessoais para o ambiente de teste.
2. Confirmar transcrição, persistência e inclusão do texto no contexto da sugestão.
3. Registrar o resultado e apagar áudio, transcrição e chave de teste.

### REQ-141 — descrição real de imagem e vídeo

1. Com provedor real autorizado, enviar imagem e vídeo fictícios sem dados pessoais.
2. Confirmar descrição, persistência e inclusão do resultado no contexto da sugestão.
3. Registrar o resultado e apagar arquivos, descrições e chave de teste.

### REQ-152 — catálogo real de modelos

1. Com provedor real autorizado, consultar o catálogo e escolher um modelo compatível.
2. Salvar, recarregar e confirmar que o modelo permanece selecionado e responde a uma solicitação fictícia.
3. Registrar catálogo e persistência e excluir a chave real ao terminar.


## Personalização — provas externas pendentes (30/10/2026)

### Monitores físicos — REQ-202
1. Abrir Atendimento em monitor HD, Full HD e ultrawide.
2. Conferir cortes, sobreposição e rolagem; capturar cada resolução.
3. Registrar navegador, resolução e resultado por monitor.

### Zoom do navegador — REQ-203
1. Em desktop real, testar zoom em 80%, 100%, 125% e 150%.
2. Conferir navegação, modais e atendimento sem sobreposição.
3. Anexar capturas e anotar zoom/resolução.

### Navegadores — REQ-204
1. Abrir as rotas principais em Chrome, Edge, Firefox e Safari.
2. Conferir login, busca, atendimento e configurações.
3. Registrar versão, erros visuais e capturas; Safari requer Apple.

### Dois dispositivos — REQ-217
1. Entrar com a mesma conta de teste em dois dispositivos.
2. Mudar uma preferência no primeiro e aguardar sincronização no segundo.
3. Recarregar ambos e confirmar o valor persistido.
