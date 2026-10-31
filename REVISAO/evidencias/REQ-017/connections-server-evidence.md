# REQ-017 — prova local

Resultado: aprovado em 31/10/2026.

pps/server/test/whatsapp.test.ts conectou sessão fictícia, emitiu contacts.upsert, confirmou o aviso de sincronização e leu nome/JID/número por uma nova conexão SQLite. O banco foi criado em pasta temporária e removido no teardown. Agenda real e visual externo permanecem no checklist manual.
