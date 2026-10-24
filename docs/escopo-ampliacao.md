# Ampliação do atendimento e revisão de conexão

Solicitações do texto consolidado enviado em 24/10/2026 e das capturas de conexão/menu.

| Área | Entrega |
| --- | --- |
| Contatos | CSV/XLSX com identificação de cabeçalho/colunas, telefone misturado com texto, DDI e DDD padrão explícitos, prévia, duplicados, etiquetas e listas importadas selecionáveis nas campanhas. |
| Campanhas e agenda | Filtros E/OU por etiqueta/inatividade, lista importada, público congelado, sequência de até 30 textos e recursos, gravação de áudio com prévia, variáveis de nome/saudação, intervalos aleatórios e pausa longa por lote. |
| Fila | Persistência no servidor, funcionamento com painel fechado, horários, pausas/cancelamento, continuação de sequência e proteção contra repetição de envio incerto. |
| IA | OpenAI, Claude e Gemini; chave cifrada, modelo configurável, regras absolutas, estilo, conhecimento aprovado e recuperação local de diálogos por relevância. |
| Controle humano | Pausa por conversa, envio manual no painel/celular e pedidos reconhecidos por humano; verificação antes de enviar, retomada explícita para mensagens novas e contingência configurável. |
| Consumo | Registro persistente de chamadas/tokens, reserva antes da chamada, limite diário de tokens e orçamento mensal estimado com tarifas informadas pelo administrador. |
| Multimídia | Análise explícita e automática opcional; Gemini para áudio/imagem/vídeo, OpenAI para áudio/imagem, Claude para imagem; cache de análises, até 12 MiB por arquivo. |
| Histórico | ZIP de uma ou até 100 conversas selecionadas, filtro por responsável atual, cronologia e papéis preservados em JSONL/TXT/CSV, manifesto e mídias disponíveis. |
| Ordenação | Grupos/botões do menu, pastas/categorias e recursos com alças e setas, persistidos no navegador; etiquetas com persistência no servidor e reflexo nas colunas do CRM. |
| Conexão | Status de servidor separado do WhatsApp, reconexão automática, mensagens de erro compreensíveis e iniciador Windows sem duplicar serviços já ligados. |

## Limites que devem permanecer claros

- Intervalos e pausas não garantem evitar bloqueios do WhatsApp.
- Estilo usa regras e exemplos; não há clonagem de voz nem treinamento de pesos. A recuperação atual usa relevância de palavras, sem um banco vetorial externo.
- Modelos precisam suportar o formato escolhido. O vídeo completo usa Gemini; mídias expiradas e de visualização única não são recuperadas artificialmente.
- A estimativa de custo depende das tarifas informadas e pode divergir de cobranças por duração, modalidade ou cache. O limite oficial do provedor deve ser configurado também.
- O filtro de vendedor usa o responsável atual da conversa; não reconstrói a identidade de quem enviou cada mensagem histórica.
- Menus/pastas são preferências deste navegador. Etiquetas são compartilhadas pela operação no servidor.
- Firebase, provedores reais de IA e publicação externa dependem das credenciais e da configuração posterior do proprietário.

## Validação

A execução completa anterior passou em 79 testes. Após acrescentar ordenação e recuperação de conexão, os 27 testes de operações passaram, incluindo o novo caso de ordenação/isolamento de etiquetas. Tipagem e compilação concluídas. No navegador, foram conferidas a persistência das ordens após recarregar, sua aplicação à biblioteca, o salvamento da sequência como rascunho, a identificação da queda e a reconexão automática após reiniciar o servidor fictício. Nenhuma campanha de teste foi ativada na base real.

Contratos dos provedores: [OpenAI Audio](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create), [Claude Messages](https://platform.claude.com/docs/en/api/messages/create), [Gemini Generate Content](https://ai.google.dev/api/generate-content).
