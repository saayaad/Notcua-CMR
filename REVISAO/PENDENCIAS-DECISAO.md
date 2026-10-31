# Pendências e decisões aplicadas

Fonte: LEDGER.csv, decisões do usuário e execução local de 31/10/2026. Esta lista foi atualizada após retestes; resultados fechados estão no ledger e no ponto de retomada do PROTOCOLO.md.

## Decisões restantes ou dependentes de artefato — 5 requisitos

- REQ-523 — decisão anterior: não implementar hospedagem.
- REQ-527 — decisão anterior: não conectar contas externas nem tocar em produção.
- REQ-540 — decisão anterior: não tocar em Firebase/configuração de produção.
- REQ-567 — adiada; política de pausa e horários de envio não definidos.
- REQ-573 — Parte 8 não fornecida; depende do envio futuro do texto.

## Decisões registradas; execução/verificação pendente — 8 requisitos

- REQ-197 — DECISÃO pendente de escopo: a decisão A está registrada; prova parcial cobriu botões visíveis nas quatro telas REQ-194, mas não todas as 504 ações. Pergunta: aprovar homologação por módulo/amostragem segura ou fornecer inventário versionado com resultado esperado de ação/sucesso/erro para cada botão?
- REQ-223 — DECISÃO: inventário revalidado em 504 botões/70 arquivos, mas vínculo sintático não prova efeito. Pergunta: aprova homologação segura por módulo/amostragem ou fornecerá inventário versionado das 504 ações com resultado esperado de sucesso/erro e permissões?
- REQ-401 — A, escolha do usuário; execução/verificação pendente, sem ampliar o escopo nesta atualização.
- REQ-448 — A escolhida, mas a inspeção visual em 3 viewports não identifica quais botões ou qual mudança visual são o aceite. Pergunta: quais botões devem mudar e qual resultado visual define “melhorar”?
- REQ-461 — A VERIFICAR: depende de conector de teste com suporte a convite, vCard e lista interativa; não implementado.
- REQ-462 — A VERIFICAR: depende de conector de teste com suporte a convite, vCard e lista interativa; não implementado.
- REQ-465 — A VERIFICAR: depende de conector de teste com suporte a convite, vCard e lista interativa; não implementado.
- REQ-466 — A: somente etiqueta. Teste falhou pois o editor oferece ações de etapa; BUG-035 registrado. Pergunta: separar tags de etapas (hoje ambas usam `Label`) ou aceitar que etiqueta que representa coluna mova o cartão?

## Retirados do escopo — 2 requisitos

- REQ-408 — B: retirar do escopo; cancelado por decisão do usuário.
- REQ-409 — B: retirar do escopo; cancelado por decisão do usuário.

## Contagens atuais após atualização documental

- DECISÃO no LEDGER: 10 (inclui os 5 itens de infraestrutura/documentação acima).
- A VERIFICAR no LEDGER: 3 (REQ-461, REQ-462 e REQ-465).
- AUSENTE no LEDGER: 0.
- DESCONECTADO no LEDGER: 0.
- SUBSTITUÍDO OU CANCELADO: 2.

Fechados neste lote local: REQ-453, 455, 457, 463, 483 e 487. REQ-419–422 foram retestadas em 3 viewports com as capturas direcionadas a `.audit/req419-retest-evidence/`; as pastas fechadas em `REVISAO/evidencias/` não foram regravadas.

