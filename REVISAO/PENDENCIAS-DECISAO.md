# Pendências e decisões aplicadas

Fonte: LEDGER.csv e decisões do usuário registradas em 31/10/2026. Nesta atualização não rodei testes nem alterei código. Os estados abaixo distinguem decisão registrada de execução/verificação ainda pendente.

## Decisões restantes ou dependentes de artefato — 5 requisitos

- REQ-523 — decisão anterior: não implementar hospedagem.
- REQ-527 — decisão anterior: não conectar contas externas nem tocar em produção.
- REQ-540 — decisão anterior: não tocar em Firebase/configuração de produção.
- REQ-567 — adiada; política de pausa e horários de envio não definidos.
- REQ-573 — Parte 8 não fornecida; depende do envio futuro do texto.

## Decisões registradas; execução/verificação pendente — 23 requisitos

- REQ-126 — Tipo B. Bloqueada: a fonte `6.txt` não existe nesta cópia; falta o artefato para identificar e testar as funções previstas. Evidência de bloqueio em `REVISAO/evidencias/REQ-126/blocked-missing-source.json`. Ação do usuário: enviar/anexar a fonte.
- REQ-194 — Telas Atendimento, CRM, Campanhas e Configurações; viewports 1366×768, 1920×1080 e 390×844; tolerância de 2 px.
- REQ-195 — A: usar o visual atual do app como referência.
- REQ-196 — A, escolha do usuário; execução/verificação pendente, sem acrescentar parâmetros que não constam nesta decisão.
- REQ-197 — A, escolha do usuário; execução/verificação pendente, sem ampliar o escopo nesta atualização.
- REQ-223 — A, escolha do usuário; execução/verificação pendente, sem ampliar o escopo nesta atualização.
- REQ-401 — A, escolha do usuário; execução/verificação pendente, sem ampliar o escopo nesta atualização.
- REQ-448 — A, escolha do usuário; execução/verificação pendente, sem ampliar o escopo nesta atualização.
- REQ-453 — A: manter busca, enviar e anexar visíveis.
- REQ-455 — B: telefone editável na ficha; escolha do usuário com risco registrado. Execução pendente.
- REQ-457 — A: valor único para ficha/oportunidade. Execução pendente.
- REQ-461 — B: convite nativo para grupo; escolha do usuário com ressalva de suporte do conector. Execução pendente.
- REQ-462 — B: vCard; escolha do usuário com ressalva de suporte do conector. Execução pendente.
- REQ-463 — A: link na legenda. Execução pendente.
- REQ-465 — B: lista interativa; escolha do usuário com ressalva de suporte do conector. Execução pendente.
- REQ-466 — A: ação rápida atua somente sobre etiqueta. Execução pendente.
- REQ-483 — A: uma posição por vez. Execução/verificação pendente.
- REQ-487 — A: uma posição por vez. Execução/verificação pendente.
- REQ-419 — B: remover o controle de economia de campaigns/A-B. Controle ainda não removido.
- REQ-420 — B: remover o controle de training. Controle ainda não removido.
- REQ-421 — B: remover o controle de receipts. Controle ainda não removido.
- REQ-422 — B: remover o controle de dailyDigest. Controle ainda não removido.
- REQ-430 — A: manter busca por palavras; sem adicionar índice vetorial. Verificação do código: REQ-425 não atende por si só à REQ-430. REQ-425 consulta cache semântico de respostas aprovadas por embeddings locais; `ai.service.ts` também ranqueia `AI_KNOWLEDGE` e trechos de `settings.knowledge` por palavras. O histórico é limitado às mensagens recentes/resumo, sem índice vetorial de histórico. O resultado fica pendente de validação específica da busca lexical; nenhuma função foi implementada nesta atualização.

## Retirados do escopo — 2 requisitos

- REQ-408 — B: retirar do escopo; cancelado por decisão do usuário.
- REQ-409 — B: retirar do escopo; cancelado por decisão do usuário.

## Contagens atuais após atualização documental

- DECISÃO/artefato pendente: 5.
- A VERIFICAR: 23.
- AUSENTE: 0 (REQ-430 reclassificada para verificação da busca por palavras; REQ-408/409 canceladas).
- DESCONECTADO: 0 (REQ-419–422 têm decisão de remoção, ainda não executada).
- SUBSTITUÍDO OU CANCELADO: 2.

Nenhuma função nova foi implementada, nenhum teste foi executado e nenhuma evidência de REQ fechada foi alterada.
