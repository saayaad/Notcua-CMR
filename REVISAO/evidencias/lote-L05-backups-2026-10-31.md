# Evidência consolidada — lote L-05 Backups — 31/10/2026

## Ambiente e integridade

- Front http://127.0.0.1:5180/ e API http://127.0.0.1:3340/atendimento: HTTP 200.
- Banco .audit/noctua-audit.db: 2.039.808 bytes; LastWriteTimeUtc 2026-10-30T18:07:20.5497691Z, igual antes e depois.
- Nenhum servidor foi iniciado ou reiniciado. Testes E2E interceptaram uploads, preferências, criação de backup e demais mutações; testes de servidor usaram SQLite temporário descartável.
- Nenhum dado de produção, WhatsApp real, Vercel, Firebase ou túnel foi alterado.

## Resultados

- apps/server/test/backup.test.ts: 16/16 aprovados, 0 falhas. Cobriu importação/persistência de módulos, documentos Base64, mídias PNG/MP4, Sutofly com nove agendamentos DRAFT sem envio, ZapVoice com fluxos desativados e upload API acima de 100 MiB. Saída completa em evidencias/REQ-079/backup.test-output.txt.
- apps/server/test/authenticated-request.test.ts: 5/5 aprovados, incluindo falha Failed to fetch sem repetir POST. Saída em evidencias/REQ-095/authenticated-request.test-output.txt.
- e2e/backups-recovery-audit.spec.ts: rodada final anterior 49 aprovados, 2 pulados de 51 execuções (17 cenários nos três projetos). Capturas e JSONs por requisito em evidencias/REQ-076/–REQ-097/. REQ-086, cenário de 40 MiB + 1 byte, rodou no desktop 1366; dois projetos pesados foram pulados para reduzir uso de memória.
- REQ-096 confirmou modal centrado com tolerância de 1 px; REQ-097 confirmou colunas sem sobreposição/corte em desktop e mobile.

## Erros encontrados e ajustes de teste

- A rota de espera do upload inicialmente não reconhecia a query sessionId; foi trocada por comparação do pathname.
- A fixture do app não incluía sessão, conversa, lotes, fluxos e ações; esses endpoints fictícios foram incluídos, removendo 404 do harness.
- O modo offline gerava ERR_INTERNET_DISCONNECTED esperado; o teste agora aceita esse erro apenas no cenário offline de REQ-095.
- REQ-096 media o modal antes de terminar a animação; passou a aguardar o centro estável.
- REQ-097 não localizava a coluna lazy-loaded do Dockview dentro do shadow DOM; a busca agora percorre shadow roots abertos e espera a coluna.
- O runner tsx emitiu uv_os_get_passwd ... ENOMEM antes de iniciar. Preload CommonJS temporário para os.userInfo resolveu; caminho do --require usa barras normais. Nenhuma dependência/asserção foi alterada por esse ajuste.
- Nenhum defeito novo de produto confirmado. BUGS.md não recebeu ocorrência nova.

## Limites manuais

- REQ-089/090: faltam o backup histórico integral e o relatório da conexão Teste; somente fixtures fictícios foram importados.
- REQ-093: não iniciar outro serviço nem executar scripts/iniciar-noctua-online.ps1, que grava configuração Vercel e chama vercel --prod. A checagem de reinício seguro fica para a próxima inicialização local de rotina.
- REQ-094: leitura física do QR depende de conta e aparelho descartáveis.
- REQ-095: validada a recuperação local; não foi interrompido túnel real, pois túnel/produção seguem somente leitura.
