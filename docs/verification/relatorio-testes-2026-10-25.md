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

## Em conferência

- [ ] Campanha individual: rascunho e fila revisados com um único telefone; ativação em verificação após a reinicialização.
- [ ] Reteste real da remoção de etiqueta após o envio, agora independente da adição de outra etiqueta.
- [ ] Follow-up e lembrete interno no contato de teste.
- [ ] Resposta padrão, macros, transferência e encerramento no contato de teste.
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

## Verificação automatizada

A execução completa anterior concluiu **103 testes aprovados, sem falhas**. O novo teste da remoção independente de etiqueta também passou isoladamente. A execução completa com esse novo caso foi interrompida pela queda do PC e está sendo repetida; seu resultado final será registrado aqui.

Teste automatizado não equivale a aprovação visual de todas as telas ou a validação de todos os serviços externos. Reset geral, exclusão de credenciais reais e envio a outros clientes não fazem parte dos testes na operação real.

Evidência de áudio: [captura do envio](audio-voice-test-2026-10-25.png).
