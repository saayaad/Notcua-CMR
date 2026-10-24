# Etapa 4 — CRM Kanban e indicadores

Com o sistema aberto, selecione **CRM e negócios** no menu lateral. Em janelas estreitas, procure o ícone de quadro na segunda posição. O CRM usa a conexão escolhida no topo e mostra conversas individuais; grupos não entram no quadro nem nos indicadores.

## Quadro

Cada etiqueta é uma coluna. **Sem etiqueta** reúne os contatos que ainda não possuem uma etiqueta ativa nesta conexão. As etiquetas existentes no WhatsApp aparecem automaticamente, com indicação de sincronização.

- Arraste um cartão pela alça de pontinhos para outra coluna ou para outra posição na mesma coluna.
- Você também pode clicar no cartão, escolher a etapa no campo **Mover para** e clicar em **Mover cartão**. Essa alternativa é útil no celular ou quando a coluna desejada está fora da tela.
- Para reordenar pelo teclado, foque a alça, pressione espaço, use as setas e pressione espaço novamente; Escape cancela o arraste.
- O botão de conversa abre o atendimento daquele contato.
- Pesquise por nome/telefone ou filtre negociações em aberto, ganhas e perdidas.

Mover de uma coluna para outra remove **somente a etiqueta da origem** e adiciona a etiqueta de destino. Outras etiquetas são preservadas. Um contato com várias etiquetas pode aparecer em várias colunas; o valor da negociação é compartilhado entre esses cartões. Mover para uma etiqueta já vinculada reúne os cartões sem duplicá-los. Para mover a **Sem etiqueta**, o contato não pode manter outras etiquetas; se necessário, remova-as no painel do atendimento.

A ordem dos cartões fica salva no banco. Por padrão, até 500 contatos são carregados por busca; use **Carregar mais** para ampliar até 5.000, ou refine a pesquisa. Os totais das colunas se referem aos cartões carregados no filtro. Os indicadores do topo consultam a conexão inteira.

## Valores, ganhos e perdas

Abra o cartão para registrar o título, o valor em reais e o resultado: **Em negociação**, **Ganho** ou **Perdido**. Clique em **Salvar negociação**. Esses campos pertencem ao CRM; não enviam mensagem ao cliente nem confirmam um pagamento bancário.

Marcar como ganho ou perdido registra a data do resultado. Editar o valor mantendo o mesmo resultado preserva essa data. Reabrir uma negociação remove o resultado anterior dos indicadores atuais; uma nova conclusão recebe uma nova data. Os indicadores mostram o estado atual dos registros, sem histórico contábil imutável.

## Indicadores

Escolha **7, 30 ou 90 dias** no topo e abra a aba **Indicadores** para ver o detalhamento.

| Indicador              | Como é calculado                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| Contatos               | Conversas individuais da conexão, contadas uma vez por contato                             |
| Em atendimento         | Conversas individuais com atendimento aberto no Noctua                                     |
| Mensagens não lidas    | Quantidade de contatos com mensagens não lidas, não quantidade de mensagens                |
| Negócios ganhos        | Soma dos valores das negociações atualmente ganhas cuja data de ganho está no período      |
| Conversão              | Ganhos divididos por ganhos + perdidos no período; sem conclusões, mostra 0%               |
| Contatos com atividade | Contatos cuja última mensagem está no período                                              |
| Mensagens enviadas     | Mensagens confirmadas como enviadas, entregues ou lidas; falhas e pendências são excluídas |
| Valor em negociação    | Soma atual das negociações em aberto com valor cadastrado                                  |

O gráfico mostra sempre os **últimos 7 dias**, com recebidas e enviadas. Contatos e atendimentos são contagens atuais, independentemente do período escolhido. Grupos são excluídos. A mesma negociação é contada uma vez nos indicadores mesmo quando aparece em várias colunas.

## Etapas e sincronização

Em **Nova etapa**, crie uma etiqueta local com nome, cor e descrição. Em **Etapas**, edite ou exclua etiquetas locais. A exclusão é bloqueada enquanto houver vínculos com contatos, macros ou negócios. A regra de primeira mensagem é desativada se sua etiqueta local for excluída.

Etapas locais pertencem ao Noctua e não criam novas etiquetas no WhatsApp. Para criar, renomear, trocar a cor ou excluir uma etiqueta do WhatsApp, faça isso no aplicativo e use **Conexões > Sincronizar etiquetas novamente**. Os vínculos de contatos com essas etiquetas são sincronizados nos dois sentidos.

Ao mover cartões ou mudar etiquetas no atendimento/macros, as alterações locais ficam em uma fila persistente. Com o WhatsApp conectado, o servidor tenta aplicar as mudanças. Se estiver desconectado, elas aguardam reconexão. O quadro mostra **Sincronizando** enquanto aguarda confirmação e permite **Tentar novamente** após falhas. Uma alteração posterior substitui uma intenção antiga ainda pendente para o mesmo contato/etiqueta.

Deixe o computador e o servidor ligados para a sincronização continuar. Movimentar cartões não dispara mensagens ou funis automaticamente. Mudanças recebidas do WhatsApp atualizam o quadro por eventos em tempo real. Os cartões possuem controle de versão; uma edição desatualizada é recusada para evitar sobrescrever uma alteração recente.

## Instalação e validação

As dependências e a migração desta etapa já foram aplicadas nesta máquina, preservando o banco e salvando uma cópia anterior na pasta ignorada `backups`.

Os valores, resultados e posições do CRM ficam no SQLite. A exportação JSON da biblioteca mantém seu contrato anterior e não substitui uma cópia completa desse banco para preservar o CRM.

Para abrir:

```powershell
Set-Location 'C:\Users\masco\OneDrive\Documentos\Noctua CRM - Atendimento'
npm.cmd run dev
```

Acesse **http://127.0.0.1:5173/atendimento** e clique em **CRM e negócios**. Se já houver uma execução no terminal, não inicie outra; atualize a página com **Ctrl+Shift+R**.

Em outra instalação existente, com o servidor parado: `npm.cmd install`, `npm.cmd run db:deploy` e `npm.cmd run db:generate`. Preserve o banco e a chave de sessão. Nunca use reset do banco para atualizar.

Os testes desta etapa usam bancos temporários e socket WhatsApp simulado: verificam escopo da conexão, múltiplas etiquetas, ordenação, conflitos de versão, ganhos/perdas, fila offline, falhas, repetição e substituição de alterações pendentes. A verificação no navegador também usa dados fictícios; nenhuma negociação real foi movimentada para testar.

O editor visual e o motor de fluxos continuam reservados para a etapa 5.
