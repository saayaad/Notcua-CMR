# Regras do projeto

- Ao trabalhar em auditoria de REQs, leia REVISAO/PROTOCOLO.md e REVISAO/LEDGER.csv antes de qualquer ação.
- Siga o protocolo: produção só leitura; testes apenas no ambiente local.
- Ao terminar cada lote, faça commit, atualize o LEDGER.csv e comece o próximo lote imediatamente, sem esperar resposta.
- Só pare se precisar de algo que só o usuário pode fazer, se a cota do plano acabar ou se for tocar em produção. Nesses casos, grave o estado em REVISAO/PROTOCOLO.md antes de parar.
Resolver o obstáculo faz parte do trabalho. Quando um teste falhar:
- Leia a mensagem de erro completa e encontre a causa (código, dados de teste, seletor, tempo de espera, serviço fora do ar).
- Corrija a causa e rode de novo. Pode mexer no código de teste e, se a falha for um bug real do app, na correção do app, desde que fique registrada no commit e no BUGS.md.
- Se ainda falhar depois de corrigir a causa, registre o motivo e siga para a próxima REQ.
- Não considere o limite de 2 tentativas como fim do trabalho: ele serve para não repetir o mesmo teste sem mudança. Cada nova tentativa precisa ter uma correção diferente. Não pare antes de tentar pelo menos uma correção real em cada falha.
- Não pare para pedir permissão. Sua única parada permitida é o que está no protocolo: algo que só eu posso fazer, cota acabando ou produção.