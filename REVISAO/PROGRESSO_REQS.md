# PROGRESSO_REQS

## REQ-425 — Economia de IA — 31/10/2026

- Estado: `COMPLETO-LOCAL`; BUG-025 corrigido localmente. LEDGER regenerated; REQ-419–422 remain `DESCONECTADO` and REQ-430 remains `AUSENTE`.
- Implementado embedding semântico local no cache aprovado com `@huggingface/transformers` 3.8.1 e `Xenova/paraphrase-multilingual-MiniLM-L12-v2` pinned revision `2c4055b12046f11709e9df2c122e59ffbdc2f900`. Sem API; inferência bloqueia modelos remotos. Modelo fica em `.audit/models/` e é baixado pelo script com SHA-256 validado.
- Cache usa cosine threshold 0.84, resposta aprovada, janela de validade e proteção PII. Vetores ficam no banco como dados internos e não são expostos pela API. Falha do modelo não bloqueia resposta gerada; nesse caso, sugestão segue sem cache.
- Testes: foco REQ-424/425 1/1; typecheck server aprovado. Simulador de provedor e SQLite temporário. Captura/evidência JSON em `REVISAO/evidencias/REQ-425/server-test.json`.
- Falhas/harness corrigidos: primeiro comando colocou filtro após glob e iniciou suíte inteira; interrompido e refeito com chamada focal. Novo caso de não equivalência achou contador esperado desatualizado; ajustada somente a contagem de chamadas simuladas, reteste passou. Critérios não foram alterados.
- `npm install` informou 13 vulnerabilidades transitivas (11 moderadas, 2 altas). Sem `npm audit fix`; investigar em trabalho separado.
- Banco real `.audit/noctua-audit.db`: 2.039.808 bytes, timestamp preservado. API local respondeu HTTP 200. Nenhuma produção acessada.
- Próximo passo imediato: commit/push desta alteração em `auditoria-reqs`; em seguida escolher o próximo módulo não fechado no LEDGER. `scripts/iniciar-noctua-online.ps1` e `REVISAO/evidencias/REQ-686/process.json` são mudanças preexistentes e ficam fora do lote.
