# Pendências e decisões aplicadas

Fonte: LEDGER.csv, decisões do usuário e auditoria local atualizada em 03/11/2026. Esta lista reflete o estado final; resultados e limites de verificação estão descritos no ledger e no ponto de retomada do PROTOCOLO.md.

## Restrições ou adiamentos mantidos — 4 requisitos

- REQ-523 — decisão anterior: não implementar hospedagem.
- REQ-527 — decisão anterior: não conectar contas externas nem tocar em produção.
- REQ-540 — decisão anterior: não tocar em Firebase/configuração de produção.
- REQ-567 — adiada; política de pausa e horários de envio não definidos.
- REQ-573 — CANCELADO: usuário confirmou que não existe Parte 8; não aguardar nem solicitar.

## Resultados das decisões aprovadas — 5 requisitos

- REQ-197 — COMPLETO-LOCAL: CRM salva etapa; campanhas atualizam e filtram; macro mostra carregamento/erro/sucesso e preserva rascunho. Aceite representativo aprovado. Teste individual vinculado, 3/3 viewports; não certifica todas as ações.
- REQ-223 — COMPLETO-LOCAL: Personalização altera prévia, confirma densidade, informa sucesso e mantém após reload. Aceite representativo aprovado. Teste individual vinculado, 3/3 viewports; não certifica todas as ações.
- REQ-401 — CANCELADO: usuário não precisa de webhook; nenhuma especificação externa a solicitar. Telemetria local preservada, desligada por padrão.
- REQ-448 — COMPLETO-LOCAL: Salvar macro mostra carregamento e impede novo clique; erro preserva rascunho; retry salva conteúdo e informa sucesso. Rótulos claros de etiquetas. Teste individual vinculado, 3/3 viewports; não certifica todas as ações.
- REQ-466 — COMPLETO-LOCAL: separação de etiquetas/etapas aprovada e BUG-035 corrigido; CRM/operações 75/75, UI 3/3.

## Não verificáveis neste ambiente — 3 requisitos

- REQ-461 — NÃO VERIFICÁVEL NESTE AMBIENTE.
- REQ-462 — NÃO VERIFICÁVEL NESTE AMBIENTE.
- REQ-465 — NÃO VERIFICÁVEL NESTE AMBIENTE.
- Observação comum: depende de conector de teste com convite, vCard e lista interativa; conector não criado. O simulador local existente cobre apenas formatos e persistência fictícios e não substitui esse conector.

## Retirados do escopo — 2 requisitos

- REQ-408 — B: retirar do escopo; cancelado por decisão do usuário.
- REQ-409 — B: retirar do escopo; cancelado por decisão do usuário.

## Contagens atuais após atualização documental

- DECISÃO no LEDGER: 4 (REQ-523/527/540/567: restrições ou adiamentos já definidos).
- A VERIFICAR no LEDGER: 0.
- NÃO VERIFICÁVEIS NESTE AMBIENTE: 3 (REQ-461/462/465).
- AUSENTE no LEDGER: 0.
- DESCONECTADO no LEDGER: 0.
- SUBSTITUÍDO OU CANCELADO: 55 no ledger (REQ-408/409 são as duas decisões destacadas acima).
- Total: 703 requisitos; 478 COMPLETO, 163 COMPLETO-LOCAL, 55 SUBSTITUÍDO OU CANCELADO, 4 DECISÃO e 3 NÃO VERIFICÁVEIS NESTE AMBIENTE.

Fechados neste lote local: REQ-453, 455, 457, 463, 483 e 487. REQ-419–422 foram retestadas em 3 viewports com as capturas direcionadas a `.audit/req419-retest-evidence/`; as pastas fechadas em `REVISAO/evidencias/` não foram regravadas.

