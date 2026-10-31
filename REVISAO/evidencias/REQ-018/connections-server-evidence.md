# REQ-018 — prova local

Resultado: aprovado em 31/10/2026.

pps/server/test/whatsapp.test.ts emitiu contato pelo FakeSocket, retornou URL xample.invalid para foto e confirmou persistência após reabrir SQLite. pps/server/test/photo-sync.test.ts também confirmou foto privada sem interromper a fila. Não houve acesso a URL externa nem foto real; ver checklist manual.
