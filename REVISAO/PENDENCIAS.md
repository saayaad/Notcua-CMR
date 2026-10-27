# Pendências — Noctua CRM

Atualização: 27/10/2026. Fase 2 autorizada e em execução. O novo módulo de chaves foi aprovado separadamente durante a revisão. **Este ainda não é o relatório final da Fase 3.**

## Situação

O livro [REQUISITOS.md](REQUISITOS.md) contém 699 registros: 617 a verificar, 28 completos, 3 não testados em conta cliente real, 4 decisões, 2 substituídos e 45 cancelados. Todos os itens não finais permanecem abertos no livro; não há percentual de completude comprovado nesta revisão.
A verificação individual, prioridade, esforço e lotes serão preenchidos depois da aprovação do escopo, sem reutilizar “implementado” de um relatório antigo como prova.

| ID / conjunto | Status | O que decidir ou completar | Prioridade/esforço |
|---|---|---|---|
| REQ-001–REQ-687, exceto substituídos | ⬜ / ⚠️ | Conferir origem, critério, código, ligação e execução, respeitando exceção de Mensagens. | A estimar após Fase 2 |
| REQ-160, REQ-213 | 🔁 | Renomear o produto foi substituído por REQ-504, manter noctua fixo. | Sem implementação antiga |
| REQ-609–REQ-653 | 🔁 | Cancelados: pertencem ao Creatfy Studio, conforme correção expressa do usuário. Não implementar neste CRM. | Fora do escopo |
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


Decisão de escopo em 27/10/2026: produção de vídeos/Drive permanece no Creatfy Studio. REQ-609–REQ-653 cancelados neste CRM. Sincronização entre aplicativos é possibilidade futura, sem implementação aprovada. Links fornecidos pelo usuário: https://creatfy-studio.vercel.app e https://github.com/creatfystudio/creatfy-studio. A consulta web não conseguiu abrir os endereços; não houve avaliação do código remoto.

## Progresso da Fase 2 e nova prioridade

- 52 testes isolados aprovados nesta execução: 30 de backup/CRM/layout/prévia e 22 selecionados de operações, sem testes de envio de Mensagens.
- Cadastro inicial, paleta, tema e nomes de menu/pasta conferidos na cópia fictícia e após recarregar; os valores foram consultados também no servidor.
- BUG-001: falha de salvamento automático de preferências não é apresentada ao usuário. Entrada extensa foi recusada com 413; o valor anterior foi preservado e voltou ao recarregar. Correção aguardará o lote aprovado.
- REQ-688–REQ-699: módulo /chaves e operações independentes solicitado e aprovado em seguida; implementação priorizada. A avaliação do restante continua aberta, sem porcentagem geral de conclusão.
- O teste novo de chaves encontrou um arquivo local corrompido de engine.io-client. Restaurando a mesma versão oficial antes de repetir os testes; não é resultado funcional das chaves.

## Lote Chaves e operações — concluído no código e em testes isolados

- /chaves validado com o login real do proprietário. Nenhuma chave real gerada.
- Geração, reserva de e-mail, planos, uso único, renovação, revogação, expiração, separação dos bancos, arquivos, backups e eventos implementados.
- 12 testes novos + 57 regressões selecionadas aprovados; compilação aprovada.
- Cadastro/ativação com cliente Firebase real ainda não executados: REQ-695–REQ-697 têm passo manual no livro. Não confundir testes simulados com uma venda real homologada.
- A lógica original de Mensagens não foi alterada; há uma camada externa de autorização antes de transmitir.
- Creatfy continua fora do escopo ativo. Fase 2 geral continua; não atingimos a segunda parada de aprovação do plano de pendências/menu.
