# Etiquetas, filtros e janelas

## Personalização e painéis

No Atendimento, **Personalizar** abre duas opções distintas:

- **Habilitar arraste e organizar painéis**: libera a movimentação e os controles de encaixe; confirme ou cancele ao terminar.
- **HUD, atalhos, botões e aparência**: abre o editor completo da conversa.

O menu aparece acima dos painéis. Recolha Conversas ou Biblioteca pelo botão **–** do grupo; reabra pela faixa de **Painéis recolhidos**. O botão da biblioteca no cabeçalho também permite alternar sua exibição.

As janelas possuem **– Minimizar janela**. O formulário permanece aberto e aparece um botão na parte inferior para restaurá-lo, sem passar pelas configurações. **X** continua fechando a janela.

As regras visuais do menu principal agora ficam restritas à navegação: não alteram as faixas de funções da conversa. Os botões do atendimento mantêm texto visível e altura compacta, inclusive no modo encaixável.

## Etiquetas com ações e receita

Acesse **Visão geral → Etiquetas, ações e receita → Configurar ações**, ou clique no nome do cliente e depois em **Etiquetas e ações**. O CRM também oferece esse acesso.

1. Escolha uma etiqueta, como Pago ou Pagamento concluído.
2. Use o modelo **Pagamento concluído** para ativar registro de venda e pergunta do valor.
3. Opcionalmente, configure valor fixo, nota interna ou fixação da conversa.
4. Informe o investimento atribuído à etiqueta, caso queira calcular retorno.
5. Salve a configuração. Nenhuma conversa antiga é alterada por salvar a regra.

Ao aplicar manualmente essa etiqueta no cliente ou mover um cartão para ela no Kanban, o sistema pede confirmação e o valor quando necessário. Cancelar mantém os dados anteriores. As ações são internas; não enviam mensagem ao cliente.

Cada conversa possui um negócio atual e uma única etiqueta de atribuição financeira. Reaplicar a mesma etiqueta não duplica a venda; atribuir outra etiqueta financeira reclassifica o negócio. Retirar a etiqueta não estorna a venda. Valor e estado podem ser corrigidos no CRM: negócios reabertos ou perdidos deixam de somar receita.

O indicador considera o histórico completo de vendas ganhas atribuídas. Sem investimento informado, mostra a receita e não calcula ROI. Com investimento, usa `(receita - investimento) / investimento × 100`. Não representa lucro líquido e não inclui automaticamente impostos, produção ou outras despesas.

Importações, sincronização do WhatsApp e automações em segundo plano não abrem perguntas nem presumem valores. Esta entrega integra as regras às aplicações manuais no cliente e no Kanban; não constitui um livro de pagamentos ou múltiplas transações por conversa.

## Filtrar e ordenar leads

Além de Ativas, Não lidas, Minhas, Arquivadas e etiqueta, a lista oferece:

- **Resposta:** todas as situações, aguardando nossa resposta, aguardando o cliente, ainda não respondidos.
- **Ordem:** prioridade de atendimento, mais recentes, mais antigos, maior tempo de espera.

“Ainda não respondidos” considera conversa cuja última mensagem é recebida e que não possui envio confirmado anteriormente. Envio pendente ou com falha não conta como resposta. Notas internas também não contam como resposta ao cliente.

A busca, os filtros, a contagem e a ordem são aplicados no servidor antes da paginação. As escolhas ficam nas preferências da conta.

## Google AI Pro e API

A assinatura Google AI Pro não transforma automaticamente sua chave em acesso pago de API para aplicações externas. Confira o projeto no [Google AI Studio](https://aistudio.google.com/projects). O Google mantém [benefícios da assinatura](https://ai.google.dev/gemini-api/docs/google-ai-plans) e [faturamento da API](https://ai.google.dev/gemini-api/docs/billing) separados. Ativar faturamento da API pode gerar cobranças adicionais; isso não foi feito nesta revisão.
