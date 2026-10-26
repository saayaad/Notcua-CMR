# Verificação do Noctua — 25/10/2026

Conexão: **Teste**. Envios reais limitados ao contato autorizado com final **3554**. Os arquivos enviados são sintéticos e identificados como teste.

## Resultados confirmados

- [x] Texto com `#nome`: substituído por Nolan e lido no WhatsApp.
- [x] Anexo WAV: convertido para OGG/Opus, enviado com `isPtt=true` e lido.
- [x] Imagem com legenda: otimizada e lida.
- [x] Vídeo MP4 com legenda: enviado e lido.
- [x] Documento TXT: enviado e lido.
- [x] Nota interna: salva como registro privado, sem mensagem remota.
- [x] Biblioteca: criação e persistência de texto e voz exclusivos de teste.
- [x] Funil: texto e voz em duas etapas, execução COMPLETED, voz PTT lida.
- [x] Agenda: envio programado para 18h23, execução COMPLETED sem erro.
- [x] Excel com cabeçalho fora da primeira linha: reconheceu as colunas trocadas, manteve o telefone autorizado e descartou uma duplicata.
- [x] Importação: lista com um único contato e etiqueta de teste, sem disparo ao importar.
- [x] Etiqueta no cliente: aplicação de Importante sem remover os vínculos anteriores.
- [x] Recuperação após reinicialização: integridade SQLite `quick_check=ok`, dados preservados e WhatsApp reconectado sem novo QR Code.
- [x] Campanha individual: fila revisada com um único telefone, execução COMPLETED e mensagem lida.
- [x] Reteste da remoção independente de etiqueta: envio lido, Importante removida e demais vínculos preservados.
- [x] Lembrete interno: execução COMPLETED e aviso privado criado, sem mensagem ao WhatsApp.
- [x] Atualização da página preserva a conexão Teste selecionada.

## Em conferência

- [x] Follow-up: resposta real às 22h15min11s cancelou a tarefa prevista para 22h21min51s; nenhuma mensagem dessa tarefa foi enviada.
- [x] Resposta padrão: prévia personalizada e envio único confirmado como lido.
- [x] Macro: duas mensagens na ordem configurada, execução COMPLETED e ambas lidas.
- [ ] Transferência e encerramento no contato de teste.
- [ ] Copiloto, transcrição e simulador com o provedor de IA configurado.
- [ ] Personalização/HUD, busca global, CRM, Sandbox e Central de Ajuda pela interface.

## Correções encontradas durante os testes

- O comando de testes carregava a configuração Firebase do site. Agora a autenticação e o arquivo de ambiente dos testes são isolados; o servidor em uso mantém sua autenticação.
- Corrigida a expressão de escala do conversor de vídeo; o teste passou a usar um MP4 válido.
- O botão do modo privado identifica a ação como salvar nota interna.
- O controle de pular silêncios passa a iniciar o monitor também quando é ativado durante a reprodução.
- A escolha de uma planilha preserva o nome da lista que já foi digitado.
- A remoção automática de etiqueta agora pode ser usada sozinha e agenda sincronização com o WhatsApp quando a etiqueta possui vínculo remoto.
- “Ver envios” mostra nome e telefone de cada destinatário; a consulta preserva o isolamento por conexão.
- Requisições usam o token atual do Firebase e renovam uma vez em caso de rejeição 401. Falhas de rede/500 não repetem envios incertos.
- A renovação de token do mesmo usuário preserva o aplicativo montado; a validação inicial mostra “Verificando seu acesso”.
- A conexão selecionada é lembrada por usuário no navegador e validada contra as conexões disponíveis.
- A confirmação de lembrete informa que não envia mensagens ao WhatsApp.

- O SQLite agora utiliza WAL, conexão única e espera de até 30 segundos; gravações idempotentes de registros têm repetição limitada para falhas transitórias. Envios de mensagens não são repetidos por essa correção.

## Verificação automatizada

A execução completa mais recente concluiu **110 testes aprovados, sem falhas**, incluindo gerenciamento de chaves Gemini, renovação de autenticação, proteção contra repetição de envios e concorrência do SQLite. A configuração de banco utiliza WAL, uma conexão e espera limitada para reduzir conflitos entre sincronização e gravações. O teste de concorrência preservou as gravações simultâneas.

Teste automatizado não equivale a aprovação visual de todas as telas ou a validação de todos os serviços externos. Reset geral, exclusão de credenciais reais e envio a outros clientes não fazem parte dos testes na operação real.

Evidência de áudio: [captura do envio](audio-voice-test-2026-10-25.png).


Compilação final desta rodada: servidor e interface aprovados. O Vite apontou apenas aviso de pacote principal acima de 500 kB; isso permanece como oportunidade de otimização do carregamento. Esta rodada não publicou uma nova versão na Vercel.

Revisão seguinte: [26/10/2026 — correções e testes sem novos envios](relatorio-revisao-2026-10-26.md).
