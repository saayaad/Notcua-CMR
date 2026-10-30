# Auditoria E2E

Os testes deste diretório usam somente `.audit/noctua-audit.db`, dados fictícios, modo local sem Firebase e o servidor em `127.0.0.1:3340`. Cada teste deve citar pelo menos uma `REQ-xxx` no título e gravar evidências em `REVISAO/evidencias/REQ-xxx/` quando a prova exigir artefato visual.

Comandos:

- `npm run audit:reset`: recria o banco descartável e os dados de exemplo.
- `npm run audit:dev`: inicia API e interface locais.
- `npm run audit:test`: executa Playwright em 1366×768, 1920×1080 e 390×844.
- `npm run audit:ledger`: atualiza `REVISAO/LEDGER.csv` e imprime somente as contagens de vínculo.
