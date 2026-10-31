# Pendências que exigem decisão ou definição

Fonte: `REVISAO/LEDGER.csv`, consultado em 31/10/2026. Esta lista reflete os estados registrados no ledger; não foram executados testes nem alterado código.

## DECISÃO — 24 requisitos

Decida os critérios/escopos abaixo para que os itens possam ser especificados e verificados. REQ-523, REQ-527, REQ-540, REQ-567 e REQ-573 já têm decisão registrada; seguem listados como DECISÃO porque dependem de decisão futura ou do artefato indicado.

- REQ-036 — PIX aleatório significa emitir uma nova chave válida no banco ou cadastrar uma chave aleatória já emitida e gerar QR/Copia e Cola?
- REQ-126 — Quais funções ou capturas da fonte 6.txt ainda devem ser aceitas por este ID sem duplicar as outras REQs?
- REQ-194 — Quais rotas, resoluções e tolerância em pixels formam o aceite fechado?
- REQ-195 — Qual padrão visual é normativo e quais componentes/telas entram na homologação?
- REQ-196 — Quais elementos animar e quais duração, easing e regra `prefers-reduced-motion` aplicar?
- REQ-197 — Aprovar um inventário versionado de controles e matriz ação/sucesso/erro?
- REQ-223 — Confirmar um inventário por módulo com critérios próprios antes de homologar globalmente “todos os botões”?
- REQ-401 — Especificar eventos de origem, endpoint/destinatário e métricas esperadas?
- REQ-448 — Quais botões devem mudar de aparência/rótulo e qual resultado visual espera?
- REQ-453 — Quais mudanças de layout quer e quais funções devem permanecer visíveis?
- REQ-455 — Telefone deve ser editável na ficha apesar de ser a identidade do conector?
- REQ-457 — Valor da ficha sincroniza com a oportunidade no CRM ou é campo independente?
- REQ-461 — Link de convite em texto ou convite nativo para grupo?
- REQ-462 — Compartilhar contato como vCard ou como texto com dados?
- REQ-463 — Imagem/legenda com URL atende ou precisa banner clicável específico?
- REQ-465 — Lista interativa nativa ou lista textual formatada?
- REQ-466 — Limpar etiqueta, etapa do funil ou negócio associado?
- REQ-483 — Quer duas barras ao mesmo tempo ou apenas escolher uma posição?
- REQ-487 — Quer duas barras ao mesmo tempo ou apenas escolher uma posição?
- REQ-523 — Decisão já registrada: não implementar hospedagem; nenhuma publicação ou mudança de infraestrutura.
- REQ-527 — Decisão já registrada: não conectar contas externas; integrações e produção permanecem intocadas.
- REQ-540 — Decisão já registrada: não tocar em Firebase/configuração de produção; `authMode` local permanece.
- REQ-567 — Adiado por decisão do usuário; se retomado, definir política de pausa, horários, filas e comportamento de retomada.
- REQ-573 — A Parte 8 não foi fornecida; enviar o texto para especificar e testar o item.

## AUSENTE — 3 requisitos

Decida se deseja implementar a função ausente em ambiente local ou manter a ausência e retirar/substituir o requisito; não foi feita alteração.

- REQ-408 — Distribuição multiconexão e failover configurável para campanhas não existem.
- REQ-409 — Distribuição multiconexão e failover configurável para campanhas não existem.
- REQ-430 — O ledger registra embeddings locais ausentes e proíbe chamar serviço externo.

## DESCONECTADO — 4 requisitos

Decida, para cada controle sem efeito, se deve ser conectado ao consumidor correspondente ou removido da interface.

- REQ-419 — Flag `campaigns/A-B` salva, mas não altera o sistema consumidor.
- REQ-420 — Flag `training` salva, mas não altera o sistema consumidor.
- REQ-421 — Flag `receipts` salva, mas não altera o sistema consumidor.
- REQ-422 — Flag `dailyDigest` salva, mas não altera o sistema consumidor.

## A VERIFICAR — 0 requisitos

Nenhum requisito está com esse estado no LEDGER.csv; nenhuma decisão do usuário é necessária neste grupo.
