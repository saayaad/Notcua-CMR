# REQ-093 — avaliação segura de portas — 31/10/2026

- Front informado pelo usuário: http://127.0.0.1:5180/ — HTTP 200.
- API informada pelo usuário: http://127.0.0.1:3340/atendimento — HTTP 200.
- README.md e docs/atendimento.md orientam parar a execução anterior antes de iniciar novamente; docs/operacao.md separa o iniciador do servidor 3333 e a interface Vite 5173.
- scripts/iniciar-noctua-online.ps1 verifica a saúde de 3333 e reutiliza o servidor existente. Não inicia a interface 5173.
- O iniciador não foi executado: além de preparar o servidor/túnel, grava VITE_API_URL no ambiente de produção da Vercel e executa vercel --prod.
- Nenhum serviço foi iniciado, reiniciado ou encerrado durante esta auditoria. O PC e os serviços ativos foram preservados.
- Classificação: COMPLETO-LOCAL pela orientação de não iniciar cópia concorrente e pela reutilização da API saudável documentada; a repetição manual após reinício ficou em CHECKLIST-MANUAL.md. A verificação não prova uma colisão reproduzida nas portas 3333/5173.