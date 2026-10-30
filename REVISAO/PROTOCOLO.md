AUDITORIA DO NOCTUA — PROTOCOLO

(Salve este texto em REVISAO/PROTOCOLO.md e siga-o em todas as sessões.)

META

Levar as 296 REQs "Parcial" e as 234 "A verificar" de REVISAO/REQUISITOS.md a um ESTADO FINAL, cada uma com prova individual. "Parcial" e "A verificar" deixam de ser estados finais.

## 1) ONDE PODE E ONDE NÃO PODE MEXER

PRODUÇÃO (notcua.vercel.app, WhatsApp real, banco real, Vercel, Firebase, túnel): SOMENTE LEITURA. Não enviar mensagem, não subir nem excluir arquivo, não salvar preferência, não mexer em chave, não publicar, não dar push na main.

AMBIENTE DE TESTE LOCAL: você tem autorização TOTAL e permanente para criar, editar, salvar, recarregar, subir arquivos que você mesmo gerar, excluir, resetar, criar contas/papéis de teste e cadastrar chave FALSA. Não peça confirmação para nada disso. O ambiente usa:

- servidor local com SQLite temporário (nunca o banco real);
- WhatsApp FICTÍCIO (o conector dos testes / Espaço de Teste): nenhum envio real;
- IA com provedor SIMULADO: nenhuma chamada real;
- front local ligado ao servidor local, sem login real (use o modo sem Firebase se existir; senão o Firebase Auth Emulator). Qualquer atalho de login só pode existir fora do build de produção;
- Playwright próprio (headless), não o navegador do chat; viewports 1366x768, 1920x1080 e celular emulado 390x844.

Dados de teste sempre fictícios (e-mails @example.com, telefones inventados).

## 2) PREPARAÇÃO (uma vez, antes de testar qualquer REQ)

a) Crie a branch auditoria-reqs, faça commit de TODAS as alterações locais e dê push só dessa branch. Se o push pedir login, avise no fim desta etapa e continue.

b) Crie `npm run audit:dev` (sobe servidor + front locais com dados de exemplo: contatos, conversas, biblioteca, funis, etiquetas e 2 usuários com papéis diferentes) e `npm run audit:reset` (apaga e recria tudo).

c) Crie a pasta e2e/ com Playwright. Todo teste leva o ID da REQ no título, ex.: test('REQ-215 densidade Média persiste após recarregar'). Todo teste precisa afirmar o resultado esperado ("a tela abriu" não conta). Evidências em REVISAO/evidencias/REQ-xxx/.

d) Crie `npm run audit:ledger`: cruza REVISAO/REQUISITOS.md com os IDs encontrados nos testes e gera REVISAO/LEDGER.csv, 1 linha por REQ (id, módulo, tela, estado, tipo_de_prova, teste, evidência, resultado, bloqueio, data, commit). O LEDGER é a fonte única de status; não escreva novos relatórios narrativos.

e) Rode e me mostre SÓ as contagens: REQs com teste vinculado × sem teste.

## 3) CLASSIFICAR (sem testar ainda)

Para cada REQ pendente, escreva 1 frase com o critério de aceite verificável e o tipo de prova:

A = teste automatizado de regra (servidor/API)

B = teste no navegador, ambiente local (inclui "salvar, recarregar e continuar salvo")

C = exige algo externo: WhatsApp real, iPhone/Android físico, 2º monitor, janela externa real, e-mail real, chave real de IA

D = depende de decisão minha (inclui REQ vaga demais para virar critério: escreva a pergunta em 1 linha)

E = controle sem efeito ou função inexistente

REQs que descrevem a mesma função podem dividir um teste, mas cada uma precisa de pelo menos uma asserção própria com o seu ID. Agrupe por MÓDULO/TELA, não por número.

## 4) EXECUTAR EM LOTES (repita até acabar)

Lote = 1 módulo (20 a 50 REQs). Para cada REQ tipo A ou B:

1. escreva ou ajuste o teste e rode;
2. passou → COMPLETO, com evidência;
3. falhou → abra BUG-xxx em REVISAO/BUGS.md com passos para reproduzir; se a correção for pequena e segura, corrija, rode de novo e depois rode a suíte inteira; senão fica DEFEITO;
4. máximo de 2 tentativas por REQ. Travou? Registre o motivo e vá para a próxima; não investigue o navegador ou a ferramenta além disso.

Não enfraqueça teste nem mude regra de negócio só para passar. Não refaça REQs que já têm evidência.

Fim do lote: atualize LEDGER.csv e REQUISITOS.md, faça commit na branch e comece o próximo lote SEM esperar minha resposta.

## 5) ESTADOS FINAIS (toda REQ termina em um destes)

COMPLETO — critério escrito + teste passando + (se grava dado) persistência após recarregar + evidência + commit.

COMPLETO-LOCAL — provado no ambiente local; só falta a prova externa (tipo C), que vai para REVISAO/CHECKLIST-MANUAL.md.

DEFEITO — falhou; BUG aberto.

DECISÃO — depende de mim.

DESCONECTADA ou AUSENTE — propor ligar a função ou retirar o controle da tela.

É proibido marcar COMPLETO só porque o código existe, porque a suíte geral está verde ou porque a tela abriu.

## 6) DECISÕES JÁ TOMADAS (não pergunte de novo)

- IA: opcional e desligada por padrão; testar só com provedor simulado. O que exigir chave real vira COMPLETO-LOCAL (tipo C) e não conta como pendência.
- REQ-316: inatividade = pelo menos X dias.
- REQ-410: não implementar; marcar como cancelada.
- REQ-526: só serviços gratuitos; sem cota, a IA pausa e o resto do app segue normal.
- REQ-573: adiada até eu enviar a Parte 8; fora da contagem.

## 7) COMO ME REPORTAR

Durante os lotes: nada de narrativa.

Ao parar: tabela antes × depois por estado, IDs que mudaram, defeitos novos e UMA lista única do que só eu posso fazer (decisões + CHECKLIST-MANUAL.md, com passo a passo de 3 linhas por item, agrupado por aparelho/serviço).

Só pare quando a lista acabar ou quando precisar de algo que só eu posso fazer (junte tudo numa lista e pare).

Se a sessão cair e eu escrever "continue": releia REVISAO/PROTOCOLO.md e REVISAO/LEDGER.csv e processe o próximo lote.

## Ponto de retomada — 30/10/2026

- Lote Mensagens REQ-236–268 atualizado: 19 `COMPLETO`, 10 `COMPLETO-LOCAL`, itens anteriormente completos preservados; BUG-017/018/019 registrados em BUGS.md. Ledger regenerado após regressão: servidor 206/206; Playwright 36/36; build/typecheck aprovados.
- Evidências Playwright por requisito em `REVISAO/evidencias/REQ-236/` a `REQ-268/`; 18 casos de mensagens, 9 de mídia e 9 de IA simulada aprovados em três viewports. Servidor `attendance.test.ts` + `whatsapp.test.ts`: 40/40 aprovados com banco/socket fictícios.
- REQ-263/264/265 e 267 estão `COMPLETO-LOCAL`; checklist externo detalha a validação futura em aparelho/WhatsApp descartável. Nada foi enviado ao WhatsApp de produção.
- Os serviços locais do usuário continuam ativos em `127.0.0.1:5180` e `127.0.0.1:3340`; usar `AUDIT_USE_RUNNING_SERVER=1`. Banco confirmado `.audit/noctua-audit.db`; não resetar nem subir serviços adicionais.
- Próximo lote: módulo Campanhas e agenda, iniciando REQ-269. Não tocar em produção, Firebase, chaves reais, Vercel ou `.env.local`.
- Conforme instrução mais recente do usuário/AGENTS.md, após cada falha registrar mensagem completa, corrigir uma causa real e retestar; não repetir o mesmo teste sem alteração e não parar pelo limite de tentativas antigo.
