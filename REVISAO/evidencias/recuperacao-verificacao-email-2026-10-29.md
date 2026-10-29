# REQ-112/113 — recuperação e verificação de e-mail, 29/10/2026

## Histórico preservado

`REVISAO/evidencias/configuracoes-2026-10-28.json` documenta leitura das telas e dos caminhos de código. Não havia prova de entrega ou uso dos links de e-mail em conta de teste. Nenhum envio real foi feito nesta etapa.

## REQ-112

`apps/web/src/auth/AuthGate.tsx:275–290` habilita “Esqueci minha senha” após informar um endereço, chama `sendPasswordResetEmail` do Firebase e mostra orientação de retorno. `AuthGate.tsx:112–122` trata erro e estado de espera; `AuthGate.tsx:229–274` mantém o formulário de login. A ligação está presente, mas não comprova entrega, abertura do link, definição de nova senha nem retorno ao aplicativo. O requisito continua **parcial**.

## REQ-113

`apps/web/src/auth/AuthGate.tsx:229–239` chama `sendEmailVerification` após cadastro; `:193–205` permite reenvio; `:180–191` recarrega usuário/token para conferir o estado. `:63–101` só consulta `/api/access/me` quando `emailVerified` é verdadeiro. O servidor exige `email_verified` em `apps/server/src/http/auth.ts:23–39` antes de autorizar conta e licença.

Teste **novo e isolado**, `apps/server/test/access.test.ts:148–154`: um token fictício com `email_verified=false` recebeu rejeição direta e resposta HTTP 403 em `/api/access/me`. Comando: `tsx --import ./test/setup-env.mjs --test --test-name-pattern 'REQ-113' ./test/access.test.ts` → **1 aprovado, 0 falhas, 0 pulados**. `tsc --noEmit -p apps/server/tsconfig.json` passou. O teste usa mock do Firebase, sem conta, e-mail ou banco real; nenhuma suíte anterior foi repetida.

REQ-113 continua **parcial**: entrega do e-mail, abertura do link, atualização da sessão e percurso visual não foram comprovados. A verificação funcional externa depende de conta de teste, destino controlado e autorização para enviar e-mail.
