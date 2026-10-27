# Chaves de acesso e operações independentes

Implementação de 27/10/2026. A página **/chaves** é separada do Atendimento. Somente o e-mail verificado **gustavohenriquee011@gmail.com** pode listar, gerar ou revogar chaves; a validação ocorre no servidor. Um administrador de uma empresa cliente não recebe essa permissão.

## Uso pelo proprietário

1. Entre no Noctua com a conta proprietária e abra `/chaves`. Também há um link em Configurações → Geral para esse e-mail.
2. Informe uma identificação, escolha teste por 1–30 dias ou plano de 1, 3, 6 ou 12 meses. O teste começa com 7 dias, editável antes de gerar.
3. Opcionalmente reserve a chave para um e-mail. Sem reserva, a primeira conta que ativá-la fica vinculada a ela.
4. Gere e copie o código exibido. O código completo aparece apenas nessa ocasião; o servidor guarda seu hash, não a chave em texto aberto. Se perder, revogue e gere outra.
5. Entregue o código ao cliente pelo canal escolhido por você. O Noctua não envia e-mail ou mensagem automaticamente.

## Uso pelo cliente

1. O cliente abre `/atendimento`, cria sua conta por Google ou e-mail/senha e confirma o e-mail quando o Firebase solicitar.
2. A tela pede a chave. Não há aprovação manual do Gmail nem necessidade de adicionar esse cliente à sua equipe.
3. A validade começa na ativação, não na geração. Meses seguem o calendário; o último dia é ajustado em meses mais curtos.
4. A operação criada começa vazia. O cliente conecta seu próprio WhatsApp e configura seus recursos e integrações.
5. Uma nova chave na mesma conta renova a mesma operação. Se ainda estiver válida, soma o prazo ao vencimento; se vencida/suspensa, conta a partir da nova ativação. Os dados permanecem.

Cada chave pode ser ativada uma vez. Contas de atendentes convidados não devem ser reutilizadas para abrir outra empresa; use uma conta própria. A área de equipe continua servindo para convidar atendentes da mesma operação.

## Revogação e vencimento

Revogar impede nova utilização do código. Se o código for a licença atual de uma operação, suspende seu acesso. Revogar uma chave antiga já substituída por uma renovação não cancela a licença nova. Vencimento e suspensão não apagam contatos, arquivos ou histórico.

As requisições verificam a licença no servidor. Envios automáticos têm verificação adicional imediatamente antes de transmitir, por uma camada externa ao serviço de Mensagens. A IA verifica acesso antes de iniciar seu trabalho. O gerenciador encerra operações vencidas e suas conexões em revisão periódica, até 15 segundos; a autenticação do socket também é revalidada. Isso não desfaz uma requisição externa já iniciada quando o acesso ainda era válido.

## Separação dos dados

- A operação original usa o banco e as credenciais existentes, sem transferência para os clientes.
- O registro central de chaves fica em `PLATFORM_DATA_DIR/platform/access.db`, fora dos bancos operacionais.
- Cada cliente recebe uma base SQLite própria, credencial de cifra própria e pasta de backups em `PLATFORM_DATA_DIR/workspaces/<id-interno>/`.
- O identificador da operação é derivado da conta autenticada no servidor, não aceito do navegador como autorização.
- Eventos Socket.IO são enviados somente à sala da operação autenticada.
- Preferências locais usam o identificador da conta; o navegador de um cliente não herda o cache de outra conta.
- O backup de uma operação contém sua própria base/chave de recuperação, sem o registro central ou dados de outras empresas.

O padrão de `PLATFORM_DATA_DIR` é `.secrets`, relativo ao servidor. No Docker fornecido, é `/data`, para persistir junto ao volume. **Guarde também uma cópia privada dessa pasta da plataforma**: um backup operacional isolado não recupera a lista central de licenças nem as bases das outras empresas. Não publique `.secrets`, credenciais ou bancos no Git.

## Limites desta entrega

Não há cobrança automática, checkout ou integração com plataforma de pagamentos. A chave representa o período que o proprietário decidiu liberar; o pagamento é controlado fora deste módulo. Vercel continua hospedando a interface; o servidor persistente e seus arquivos precisam estar disponíveis. O licenciamento não substitui essa hospedagem.

O isolamento foi testado com contas Firebase simuladas e bases temporárias. O proprietário fez login real e a página abriu com zero chaves reais. Cadastro e ativação por um cliente real ainda devem ser conferidos em teste controlado antes da comercialização. Não houve envio ao WhatsApp nem geração de licença real nesta validação.

## Verificação técnica

`apps/server/test/access.test.ts`: 12 testes aprovados, incluindo permissão exclusiva, ausência do código completo na listagem/banco, uso único, concorrência, e-mail reservado, calendário, renovação, revogação, expiração, isolamento HTTP/arquivos/eventos/backups, bloqueio da IA e criação de uma base vazia.

Mais 57 testes selecionados de regressão passaram: 35 de backup/CRM/interface/autenticação e 22 de operações. Compilação aprovada. A suíte inteira de Mensagens não foi reexecutada, respeitando a restrição desta revisão.

IDs para o inventário posterior: TELA-101 (Chaves), FORM-101 (geração), FORM-102 (ativação), POP-101 (código recém-gerado), POP-102 (revogação), FUNC-101 (gerar), FUNC-102 (ativar/renovar), FUNC-103 (revogar), FUNC-104 (separar operação), API-101 (`/api/access/keys`), API-102 (`/api/access/activate`), API-103 (`/api/access/me`). São IDs reservados para este lote; o menu contextual ainda não foi implementado.
