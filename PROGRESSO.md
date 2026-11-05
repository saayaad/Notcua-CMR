# Progresso — Leva 1 (campanhas)

Branch: `auditoria-reqs`. Diretório oficial. Nenhuma chamada de envio real, produção, `.env.local` ou publicação foi usada. Os testes usaram SQLite temporário e socket/conector fictício.

## Concluído
- Variações: total de até 10 mensagens contando a principal, nomes editáveis, texto obrigatório, contador de caracteres, adicionar/duplicar/remover com confirmação e prévia selecionável. Distribuição aleatória equilibrada ou rodízio; cada tarefa guarda índice, texto congelado e versão.
- Personalização: `{{nome}}`, `{{saudacao}}` e `#nome`; contato sem nome usa “aí” como reserva.
- Lotes: sequência de destinatários congelada no salvamento e ordenada por horário/ordem estável; tamanho inicial padrão 50; pausa padrão após o lote; opção de continuar direto; resumo geral, métricas por variação e histórico de lote/leads/versão.
- Continuação: permite revisar textos, CTAs, follow-ups, intervalos, pausas longas, horários permitidos e tamanho antes de iniciar o próximo lote. Leads enviados nunca voltam para a fila quando filtros/etiquetas mudam.
- Segurança: fila permanece no servidor; desconexão pausa e pode retomar automaticamente; pausa/retomada gera histórico e aviso persistente. `RUNNING` após reinício e falha de confirmação viram `VERIFY`; o painel permite decidir entre tentar novamente ou marcar como enviado. O ID da solicitação permanece idempotente.
- Compatibilidade: mantém o congelamento da campanha existente. Nenhuma migração SQL foi necessária: os novos metadados ficam nos campos JSON existentes e o status da tarefa já é texto; campanhas antigas continuam legíveis.

## Testes e validações
- Aceite 1 — queda durante o lote, pausa, reconexão e envio do próximo lead sem repetição: **PASSOU**.
- Aceite 2 — reinício durante envio, status `VERIFY`, nenhum reenvio automático e resolução manual: **PASSOU**.
- Aceite 3 — lote de 50, edição da mensagem/CTA e próximo lote nos contatos 51–100, sem duplicatas: **PASSOU**.
- Aceite 4 — mudança de etiqueta entre lotes sem reintroduzir leads enviados nem alterar a lista congelada: **PASSOU**.
- Continuação direta e histórico de lotes: **PASSOU**.
- Regressões de campanha congelada, agendamento/cancelamento, saída de campanha, follow-up e fila no servidor: **6 testes passaram**.
- `npm run typecheck`: **PASSOU**. `npm run build`: **PASSOU**; Vite emitiu apenas o aviso já conhecido de um chunk acima de 500 kB.

## Commits
- `6d2258d` — inicia este registro de retomada.
- `80a19c7` — fila em lotes, pausa/retomada, rotas e testes do servidor.
- `bd8511d` — editor e monitor de campanha.
- `8a7b4a3` — resumo da implementação e das validações.

## Sincronização
- Não foi feito push. A diferença preexistente entre `auditoria-reqs` e `origin/auditoria-reqs` contém `REVISAO/evidencias/REQ-686/process.json` e `scripts/iniciar-noctua-online.ps1`, que são protegidos. Enviar a branch inteira incluiria esses arquivos; os commits anteriores não foram reescritos nem enviados.

## Retomada / pendências
- Leva 1 concluída localmente; Leva 2 não iniciada.
- Os arquivos protegidos e artefatos não rastreados preexistentes ficaram fora das alterações e do staging deste trabalho.
- Próximo passo: conferir a tela em `Operações > Campanhas`, criar campanha fictícia, conferir variações/preview e acompanhar o monitor; para verificar lote, use tamanho 50 e público de pelo menos 100 contatos de teste.
