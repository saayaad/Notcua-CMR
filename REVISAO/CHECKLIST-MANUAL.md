# Checklist manual externo

## REQ-695–697 — Firebase Auth Emulator e ativação de conta

1. Em ambiente local de teste isolado com Firebase Auth Emulator, crie duas contas fictícias `@example.com` e confirme o e-mail pela caixa de entrada do próprio emulador.
2. Ative uma chave fictícia na interface local, recarregue e confira acesso persistente; entre com a segunda conta e confirme que ela não vê a operação da primeira.
3. Confirme que a ativação válida libera o acesso sem aprovação da equipe e que a mesma chave não pode ser usada novamente; guarde capturas por REQ. Não use Firebase, e-mail, conta ou chave de produção.

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

## Mensagens — validações externas opcionais (somente aparelho/conexão descartável)

### REQ-263 — presença “digitando” antes de texto

1. Usar uma conexão WhatsApp de teste e um telefone destinatário descartável; acionar uma resposta textual curta pelo caminho de teste.
2. Confirmar no aparelho destinatário que aparece “digitando” antes do texto e registrar captura/vídeo com horário.
3. Repetir com texto longo e apagar a conversa de teste dos dois aparelhos ao final.

### REQ-264 — presença “gravando áudio” antes de áudio

1. Na mesma conexão descartável, iniciar uma resposta de áudio do fluxo de teste com conector de envio autorizado.
2. Confirmar “gravando áudio” no destinatário antes de receber o arquivo, sem usar o número de produção.
3. Registrar captura/vídeo e remover os dados de teste.

### REQ-265 — duração proporcional da presença

1. Executar uma resposta curta e outra longa no mesmo telefone de teste, em sequência separada.
2. Medir “digitando” em ambas; confirmar que a longa dura mais e comparar aproximadamente com a regra local validada em teste.
3. Registrar as durações e excluir a conversa de teste.

### REQ-267 — recuperação de mídia apagada

1. Em conexão descartável, receber uma imagem e um áudio comuns (não de visualização única) e confirmar a entrega ao Noctua.
2. Apagar cada mídia no cliente remetente e verificar que o Noctua conserva a cópia legível após o evento de exclusão.
3. Registrar capturas e remover os arquivos/conversa de teste. A cópia local já foi provada com downloader fictício; esta etapa só valida a integração WhatsApp.
## REQ-279 — gerador de variações com provedor real (opcional)

O comportamento foi aprovado localmente com provedor simulado e está marcado `COMPLETO-LOCAL`. Não solicitar chave ou contratação. Se o usuário decidir habilitar IA real no futuro:
1. Configurar apenas uma chave descartável autorizada e validar máscara/modelo.
2. Gerar quatro variações sem enviar a campanha e conferir conteúdo e logs.
3. Remover a chave e registrar a prova sem expor o segredo.

## REQ-565 — conferência física do segundo monitor

1. Em uma sessão local com dados de teste, abra o atendimento no primeiro monitor e registre a resolução/estado que deve permanecer intacto.
2. Abra ou mova a janela de teste para o segundo monitor; use navegação e um painel/popout sem reposicionar nem ocultar a janela do primeiro monitor.
3. Confira ambos os monitores, registre captura/foco/resoluções e feche a janela de teste. Não faça login real nem altere dados de produção.
## REQ-668/676/678/682 — revisão contextual manual

1. Em Android/iOS real, faça toque prolongado em uma conversa e numa mensagem fictícia; confirme abertura do menu sem selecionar texto inesperadamente. Use ⋯ na conversa e confira foco/contraste.
2. Em janela destacada real, abra e feche o menu em Biblioteca e Mensagem; confirme que permanece no painel/documento correto.
3. Com leitor de tela e teclado, percorra os itens por seta, Home/End, escolha sem executar exclusão/envio e confirme retorno do foco. Registre navegador/dispositivo e captura.

## REQ-017–020 — conexão WhatsApp de teste descartável

### REQ-017 — agenda de contatos
1. Conecte uma sessão de teste a um telefone/conta descartável; não use produção nem envie mensagem.
2. Aguarde a sincronização e compare nomes e números disponíveis com a agenda dessa conta.
3. Recarregue o app e confirme os contatos sincronizados; anote contatos ausentes ou duplicados.

### REQ-018 — fotos de perfil
1. Na mesma sessão descartável, escolha contato cuja foto esteja visível para a conta.
2. Aguarde a sincronização automática da foto e confira a imagem no contato.
3. Recarregue o app; se a privacidade ocultar a foto, registre o limite sem forçar acesso.

### REQ-019 — histórico disponível
1. Use uma sessão descartável que já tenha conversas e histórico acessível; não envie conteúdo novo.
2. Aguarde o evento de sincronização e compare conversas, mensagens e mídias que o WhatsApp disponibilizar.
3. Recarregue o app e registre diferenças de volume; conteúdo indisponível pelo WhatsApp não conta como falha local.

### REQ-020 — etiquetas importadas
1. Na conta descartável, crie uma etiqueta e associe-a a um contato fictício já existente.
2. Aguarde a sincronização e confira nome, cor e vínculo no app local.
3. Recarregue e confirme persistência e origem “Importado do whatsapp”; não altere uma conta real.
## Mensagens — REQ-030–035, 037–038 — conta e aparelho descartáveis

1. Em uma conta WhatsApp de teste, use destinatário fictício e chave Pix de ambiente de teste; confira áudio PTT, imagem/vídeo com legenda, visualização única e vídeo circular onde o cliente suportar.
2. Confira o recebimento da chave, do QR/Copia e Cola e do pedido de comprovante com texto/áudio. Não use conta, contato ou chave de produção e não faça pagamento.
3. Registre aparelho, versão do cliente e limitações de suporte; não transforme uma opção não suportada pelo cliente em defeito do app.

## Mensagens — REQ-045 e REQ-052 — presença durante macros/funis

1. Em uma sessão descartável, configure espera e tempo de digitação em uma macro e presença de gravação durante uma etapa do funil.
2. Execute somente para o destinatário de teste e observe no aparelho a ordem, o atraso e o sinal de digitando/gravação.
3. Registre duração e resultado; não use contatos reais nem campanha ativa.
