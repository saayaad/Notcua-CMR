# Pendências — Noctua CRM

Atualização: 27/10/2026. Fase 1 encerrada para conferência do usuário. **Este ainda não é o relatório funcional da Fase 3.**

## Situação

O livro [REQUISITOS.md](REQUISITOS.md) contém 687 registros: 636 a verificar, 49 decisões e 2 substituídos. Todos os itens não finais permanecem abertos no livro; não há percentual de completude comprovado nesta revisão.
A verificação individual, prioridade, esforço e lotes serão preenchidos depois da aprovação do escopo, sem reutilizar “implementado” de um relatório antigo como prova.

| ID / conjunto | Status | O que decidir ou completar | Prioridade/esforço |
|---|---|---|---|
| REQ-001–REQ-687, exceto substituídos | ⬜ / ⚠️ | Conferir origem, critério, código, ligação e execução, respeitando exceção de Mensagens. | A estimar após Fase 2 |
| REQ-160, REQ-213 | 🔁 | Renomear o produto foi substituído por REQ-504, manter noctua fixo. | Sem implementação antiga |
| REQ-609–REQ-653 | ⚠️ | Confirmar se produção de vídeos, perfis de criador e pastas do Drive pertencem a este CRM ou a outro app. Origem: lembrança do usuário. | Decisão de escopo |
| L-12, item 3.b | ⚠️ | Definir inatividade como exatamente X dias ou pelo menos X dias. | Regra de negócio |
| L-15, item 7.c | ⚠️ | Reconciliar pedido de aquecimento artificial com exclusão registrada nos relatórios anteriores. Não apresentar como proteção garantida. | Escopo a decidir |
| L-20, item 7 | ⚠️ | Manter exigência sem cartão; geração Gemini depende de projeto com cota disponível. Não ativar cobrança. | Dependência externa |
| L-22, item 18 | ⚠️ | Receber Parte 8 antes de incluí-la como entrega. | Especificação ausente |

## Retomada

1. Ler REQUISITOS.md e a resposta do usuário à primeira parada.
2. Se o usuário confirmar o escopo, iniciar Fase 2, requisito por requisito, registrando arquivo, função/linha, caminho da interface, resultado e persistência.
3. Em Mensagens, somente leitura de código e ligações; nenhuma alteração da lógica ou envio real.
4. Após Fase 2, gerar este relatório completo com prioridade Alta/Média/Baixa, esforço P/M/G, dependências e ordem de lotes.
5. Parar novamente para aprovar implementação na Fase 3.

## Ainda não classificado como defeito do app

- Build inicial restrito falhou por permissão de leitura do ambiente; repetido com acesso autorizado, passou. Não atribuir isso ao código.
- Compilação informa pacote principal acima de 500 kB. Registrar para avaliar impacto; não executar redesign/otimização fora do plano.
- Console consultado na aba local sem erros/avisos capturados naquele momento. Isso não cobre todas as telas nem requisições históricas.

