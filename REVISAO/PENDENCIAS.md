# Pendências — Noctua CRM

Publicação atualizada em 28/10/2026 por autorização anterior do usuário: https://notcua.vercel.app/atendimento, projeto noctua-crm, versão READY `dpl_quW1LBAWRzs8VcuaAJF7K4EUpiR8`. Página 200, servidor público 200, API protegida com 401 sem login e comunicação Vercel/API liberada no teste de origem. O pacote de fluxos publicado coincide com a compilação local testada. Servidor e túnel dependem deste PC. Isso atende ao acesso online, mas a auditoria funcional abaixo continua aberta.

Atualização: 27/10/2026. Fase 2 autorizada e em execução. O novo módulo de chaves foi aprovado separadamente durante a revisão. **Este ainda não é o relatório final da Fase 3.**

Prioridade seguinte autorizada pelo usuário: menu de botão direito global implementado localmente, com handlers existentes e edição de texto. Conferência e limites em [MENU-CONTEXTO.md](MENU-CONTEXTO.md) e [checklist do menu](MENU-CONTEXTO.md#testes-e-checklist). 60 testes selecionados passaram nesta rodada; a auditoria individual restante continua aberta. Essa autorização substitui a parada anterior somente para o menu, sem aprovar alterações indiscriminadas de outros módulos.

## Situação

O livro [REQUISITOS.md](REQUISITOS.md) contém 703 registros: 449 ⬜ A VERIFICAR; 85 ✅ COMPLETO; 100 🟡 PARCIAL; 8 ⛔ NÃO TESTADO; 50 🔁 SUBSTITUÍDO OU CANCELADO; 4 ⚠️ PRECISA DE DECISÃO; 4 🔌 DESCONECTADO; 2 🐞 COM DEFEITO; 1 ❌ AUSENTE. Repetições de pedidos não são funções distintas; ainda não há percentual de completude comprovado.
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

## Auditoria parcial seguinte — menu, backups, CRM e economia de IA

- 49 registros receberam classificação individual nesta rodada. Contagens atuais estão no início deste documento e no livro; os registros parciais descrevem exatamente o que falta executar pela interface.
- Menu contextual implementado por autorização posterior, compilado com ícones e conferido em fundo, Biblioteca e edição de texto. A revisão de cada módulo/dispositivo ainda está aberta; checklist dentro de MENU-CONTEXTO.md.
- BUG-002: resumo estaciona após atingir a janela de 60 mensagens. Reproduzido com 60 → 90 mensagens fictícias. Prioridade Alta, esforço M, depende de teste de cursor/continuidade e reinício.
- BUG-003: cache aceita resposta sem revisão e pode repetir nome entre clientes. Reproduzido entre duas conversas fictícias. Prioridade Alta, esforço M; exige definir publicação/invalidar entradas antigas no lote de correção, sem apagar cache real nesta auditoria.
- INT-001: controles de economia de campanhas/treinamento/comprovantes/resumo diário são salvos sem consumidor localizado. Prioridade Alta, esforço G, ligar controles por técnica e por sistema e testar os quatro motores com provedor fictício.
- LAC-001: embeddings/índice vetorial ausentes e estimativa diária não exposta. Prioridade Média, esforço G para índice e M para métricas, sem contratação/ativação de cobrança.
- Backups e CRM têm testes de API/persistência aprovados, mas foram mantidos como parciais até completar a interface de cada cenário. Fixture de áudio ZV com bytes de texto não comprova reprodução; mídias vazias não comprovam importação de vídeo.
- A revisão automática bloqueou uma compilação por limite temporário de uso; após o horário informado, a nova aprovação funcionou e a compilação final passou. Não é defeito do aplicativo.

## Lote de verificação — fluxos, campanhas e agenda

- 39 requisitos classificados com rastreio de tela/handler e resultado dos testes. Não foram promovidos a completos sem percurso visual.
- Fluxos: 15/15 aprovados após corrigir somente a sincronização do teste TST-001. Rascunhos inválidos, horários, espera, expiração, pausa, retomada e não duplicação cobertos com socket fictício.
- Campanhas/agenda: 8/8 aprovados; salvar não envia, horário futuro impede antecipação, cancelamento bloqueia, lembrete fica interno e sequência preserva snapshot/pausa.
- LAC-002: etiqueta não aparece nas sugestões da agenda. Prioridade Média, esforço P, depende de renderizar os vínculos já fornecidos e testar cliente com etiquetas.
- Sem alteração de motor, Mensagens, banco de produção, chaves ou dados reais. Ainda falta revisão visual individual do canvas, monitor e formulário.
- Evidência consolidada: evidencias/fluxos-agenda-2026-10-27.json. Dois testes do menu passaram após corrigir a extensão do import em teste; tipagem completa de servidor e interface passou. Não foi necessária nova compilação de produção, pois somente testes e documentos mudaram.

## Lote autorizado — Habilitar I.A. (27/10/2026)

REQ-700–703 concluídos: opção administrativa por operação, desabilitada por padrão, ocultação das ferramentas e bloqueio de novas chamadas no servidor. Chaves/regras preservadas; reabilitar não ativa automaticamente o robô. Seis testes sem rede externa aprovados, build aprovado e UI fictícia conferida antes/depois/recarregada. Evidência: evidencias/ia-controle-2026-10-27.json e ia-desabilitada-2026-10-27.png.

Por pedido explícito do usuário, pular os testes funcionais de geração e demais módulos dependentes de API até existir chave disponível. Não apagar nem marcar como corrigidas BUG-002/003, INT-001 ou lacunas já registradas. Continuar a auditoria das funções manuais. Alterações locais; sem push/deploy neste lote.

## Auditoria manual seguinte — 27/10/2026

27 requisitos classificados; 17 testes selecionados aprovados sem IA/WhatsApp real. CSV conferido de ponta a ponta na cópia fictícia: dois válidos, duplicado e inválido separados, DDD revisável, etiquetas preservadas após reload e lista disponível para campanha. Perfil/localização/resumo persistiram ao reabrir. Evidências em evidencias/importacao-organizacao-2026-10-27.json e capturas relacionadas. Código de produção não mudou neste lote.

Continuar percursos visuais parciais: XLS/XLSX e mapeamento, transferências/aceite/recusa, rodízio e gesto de reordenação de etiquetas. Configuração de rodízio existe em Negócio, embora pedido original indique Equipe. A auditoria ainda não encerrou; manter IA adiada e não publicar sem solicitação.

## Continuação autônoma autorizada — 27/10/2026

O usuário pediu continuar sem paradas entre etapas até concluir o aplicativo. Isso autoriza correções reversíveis necessárias durante a revisão; IA funcional permanece adiada. Este lote corrigiu BUG-001, LAC-002 e contraste do Sandbox (BUG-004), acrescentou distribuição em Equipe e classificou 34 registros.

136 testes distintos aprovados nesta continuação: 80 da regressão selecionada, 32 de atendimento/conexão/microfone com sockets fictícios, 15 de operações sem IA, 2 novos de salvamento, 4 novos de Sandbox e 3 novos de transferência. Não somar repetições como novos testes. Tipagem e build aprovados. Nenhum envio real, conta ou dado de produção alterado; Mensagens permaneceu sem mudança de lógica.

A preparação inicial de transfers.test.ts falhou no schema engine sem RUST_LOG; alinhada à configuração info das demais suítes, os 3 testes passaram. A primeira execução restrita do novo teste de preferências também falhou no ambiente (uv_os_get_passwd/ENOMEM); execução autorizada passou. Essas falhas não foram classificadas como defeitos do produto.

Faltam percursos visuais parciais e classificação dos requisitos ainda a verificar; esta rodada não prova conclusão dos 703 registros. Ver evidencias/conclusao-parcial-sem-ia-2026-10-27.json.

Retomada: não parar por lote; continuar funções manuais. Geração real de IA, dispositivos/navegadores indisponíveis, ativação com cliente real e publicação continuam sem homologação nesta rodada. Não afirmar app totalmente finalizado.

## Biblioteca — continuação em 27/10/2026

CRUD de texto, favorito, duplicação, confirmação, exclusão somente da cópia, categoria e filtro conferidos na interface fictícia. Texto e favorito permaneceram após reload. Corrigida a prévia que mostrava marcadores de formatação literalmente (BUG-005); FormattedText confirmou negrito no DOM. Arquivos/mídias da Biblioteca ainda têm passos visuais pendentes. Evidência: evidencias/biblioteca-2026-10-27.json e biblioteca-categoria-2026-10-27.png.

## Reset seguro — continuação em 27/10/2026

BUG-006 corrigido: o reset limpava apenas chaves noctua: e deixava noctua-preferences:uid, permitindo que a personalização antiga voltasse após recarregar. A limpeza agora considera as chaves exatas da conta e seus rascunhos; outras contas e autenticação ficam preservadas. O servidor também passou a bloquear fluxos, macros e funis RUNNING, além dos trabalhos já protegidos.

Quatro testes de segurança e um de cache local aprovados; confirmação visual de duas etapas, texto incorreto bloqueado, EXCLUIR exato liberado e cancelamento sem exclusão. O JSON do backup foi reaberto como banco, conferindo contato, recurso, bytes de arquivo, preferência e exemplo local. Nenhum dado real foi apagado. A primeira fixture do teste precisava de id obrigatório no Asset; corrigida antes dos testes finais.

Acumulado desta continuação: 141 testes distintos aprovados (136 anteriores + 4 de segurança + 1 de limpeza local); sem novas gerações de IA. Build e tipagem aprovados. Evidências em evidencias/reset-seguro-2026-10-27.json. A auditoria geral ainda não concluiu os registros a verificar.
