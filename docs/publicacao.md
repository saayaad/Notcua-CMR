# Vercel, Firebase e servidor WhatsApp

O painel React pode ser publicado na Vercel com o arquivo `vercel.json`. O processo Baileys, as filas, o banco SQLite e a chave da sessão precisam permanecer em um servidor com disco persistente e uma única instância do worker. As funções temporárias da hospedagem do painel não substituem esse processo contínuo.

## Firebase Authentication

1. Crie/sele­cione o projeto Firebase e registre um aplicativo Web.
2. Em Authentication, habilite Google e E-mail/Senha. Autorize o domínio final da Vercel (ou domínio próprio).
3. Copie os quatro campos públicos para as variáveis `VITE_FIREBASE_*` descritas em `apps/web/.env.example`. Essas informações identificam o aplicativo; não são uma conta administrativa.
4. No servidor persistente, configure `AUTH_MODE=firebase`, `FIREBASE_PROJECT_ID` e `OWNER_EMAIL` com o e-mail do administrador principal.
5. Forneça as credenciais administrativas por identidade do serviço ou arquivo montado fora do repositório, apontado por `GOOGLE_APPLICATION_CREDENTIALS`.
6. Confirme o e-mail do administrador. Entre no painel e convide outros operadores em Configurações → Equipe. Criar uma conta Firebase, sozinho, não dá acesso aos dados desta operação.

Esta instalação corresponde a uma operação compartilhada e privada. Não é um SaaS de empresas independentes com separação por organização. Administradores gerenciam credenciais, convites, campanhas, backups e automações; membros compartilham os atendimentos.

## Servidor persistente

O `Dockerfile` inclui a aplicação e as migrações. Configure HTTPS no provedor, monte um volume em `/data`, configure as variáveis acima e `CLIENT_ORIGIN=https://seu-painel.vercel.app`. Não use várias réplicas com este banco/worker. O volume guarda `noctua.db` e `whatsapp.key`; faça backup consistente com o processo parado. O arquivo da chave deve acompanhar o banco em uma restauração.

`HOST=0.0.0.0` exige Firebase configurado ou um `API_TOKEN` de pelo menos 32 caracteres. Para a publicação com usuários, use Firebase. O token estático é reservado ao modo local/integracões existentes e não substitui o login Firebase nesse modo.

## Painel Vercel

Importe o repositório pela raiz. O arquivo `vercel.json` define instalação, compilação e pasta de saída. Configure:

- `VITE_API_URL=https://seu-servidor-persistente` (sem `/api` ao final).
- Os quatro campos públicos `VITE_FIREBASE_*`.

Publique novamente após alterar variáveis `VITE_*`, porque elas são incorporadas na compilação. No servidor, permita a origem exata do painel em `CLIENT_ORIGIN`. O navegador conecta diretamente à API e ao Socket.io desse servidor por HTTPS.

O upload de backups grandes também vai diretamente para esse servidor, conforme `VITE_API_URL`. Se houver um proxy reverso na frente dele, configure o limite e os prazos de upload do proxy para os tamanhos esperados. O limite de 40 MiB dos formulários comuns não se aplica à rota de backups do Noctua. Reserve espaço para o arquivo temporário, o JSON original preservado e as mídias decodificadas.

## IA

Cadastre a chave do provedor em Configurações → Integração de IA. Ela é cifrada no servidor e nunca é devolvida pela API. Não use prefixo `VITE_` para segredos. Escolha um modelo disponível em sua conta, informe regras/base de conhecimento e teste sugestões antes de habilitar respostas automáticas. O limite diário conta solicitações automáticas, não valores em reais; cobrança e limites financeiros são controlados no provedor.

Não envie chaves privadas pelo chat ou pelo Git. Configure-as diretamente nos campos apropriados da hospedagem e do painel.

Referências oficiais: [Firebase Google](https://firebase.google.com/docs/auth/web/google-signin), [validação de tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [limites de execução Vercel](https://vercel.com/docs/functions/limitations).
