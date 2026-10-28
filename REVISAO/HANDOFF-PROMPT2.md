# Handoff para o Prompt 2 — provisório

Publicação solicitada e concluída em 27/10/2026: projeto Vercel `noctua-crm`, domínio https://notcua.vercel.app/atendimento, deploy `dpl_9ZQXmBsz8AwGtaBYd1veR3Ajcimo` READY a partir de `cd79405`. Servidor real iniciado em 3333 com Firebase; túnel Cloudflare autorizado explicitamente pelo usuário após revisão automática. Saúde pública OK, endpoint protegido sem token retornou 401 e origem principal validada. Aba de produção carregou operação autenticada; IA confirmada desabilitada. Configurações privadas e backups excluídos do pacote. Backend/túnel dependem de PC ligado e internet. Branch revisao-completa sincronizada no GitHub; publicação não significa conclusão dos requisitos restantes. Registro local de processos em `.npm-cache/online-runtime.json`, sem segredos. O teste fictício em 5187 deve ser encerrado ao concluir a publicação.

27/10/2026. **Fase 2 em andamento. O usuário autorizou posteriormente a implementação do menu contextual; ela está disponível localmente. Redesign e correções gerais ainda dependem do plano de auditoria.**

Atualização mais recente: ContextMenuProvider global, ações de mensagens/lista/biblioteca, descoberta de botões nos demais cards, edição nativa de texto e navegação geral. Ver MENU-CONTEXTO.md e MENU-CONTEXTO.md (seção Testes e checklist). 60 testes selecionados aprovados, sem envios reais. Checkpoint anterior 15d2559. Não declarar os 699 requisitos aprovados com base nessa regressão. As referências ao menu como pendente abaixo representam o estado anterior à autorização atual.

Após esse lote: 49 registros receberam classificação individual. BUG-002 (resumo estagnado em conversa longa) e BUG-003 (cache sem aprovação reutilizando saudação personalizada) foram reproduzidos por generateSuggestion com provedor/repositório fictícios. INT-001: quatro toggles de economia salvos sem consumidor. LAC-001: índice vetorial ausente, métrica somente mensal. Nenhum desses quatro achados foi corrigido ainda; detalhes e prioridade em BUGS.md/PENDENCIAS.md. Fumaça de menu executada na lista, na mensagem recebida e no cadastro de pergunta com cancelamento, sem envios ou cadastro real.

- Branch revisao-completa; checkpoint inicial 8039a09 e livro inicial 24d997f. O escopo foi aprovado para verificação.
- 703 registros em 28 blocos: 471 ⬜ A VERIFICAR; 78 ✅ COMPLETO; 85 🟡 PARCIAL; 8 ⛔ NÃO TESTADO; 50 🔁 SUBSTITUÍDO OU CANCELADO; 4 ⚠️ PRECISA DE DECISÃO; 4 🔌 DESCONECTADO; 2 🐞 COM DEFEITO; 1 ❌ AUSENTE. Contagens atuais; não significam homologação integral.
- Produção de vídeos e Drive pertencem ao Creatfy Studio. REQ-609–REQ-653 cancelados; sincronização futura adiada.
- Nova solicitação aprovada: /chaves, exclusivo de gustavohenriquee011@gmail.com; teste por dias e planos 1/3/6/12 meses; operação própria por cliente. Implementação isolada em modules/access, database/paths, auth, gateway/realtime e AccessKeysPage/ActivationPanel. Mensagens permanece intacto; verificação de validade é uma camada externa.
- Registro central em PLATFORM_DATA_DIR/platform/access.db; bancos/chaves/backups de empresas em PLATFORM_DATA_DIR/workspaces. Padrão .secrets; Docker /data. Operação original preservada. Backup de uma empresa não inclui a plataforma ou outras empresas; a pasta privada da plataforma precisa de cópia própria.
- 12 testes novos + 57 regressões selecionadas aprovados, build e tipagem aprovados. Login real do proprietário conferido em /chaves, zero licenças reais emitidas. Cliente real ainda precisa cadastrar, confirmar e-mail e ativar uma chave de teste; instruções em docs/chaves-de-acesso.md. Sem envio WhatsApp ou cobrança.
- BUG-001: auto-salvamento de preferências descarta falha; entrada extensa voltou ao valor anterior após recarregar. Registrado, ainda sem correção, aguardando o lote aprovado.
- Arquivo local de engine.io-client estava ilegível; restaurada exatamente a versão 6.6.7 oficial com integridade igual à do lockfile. Não houve mudança de dependência ou versão.
- Cópia fictícia usada em 5187, banco temporário e sem conexões externas. Evidências desta fase em REVISAO/evidencias, apenas dados fictícios ou tela real do proprietário vazia.
- IDs reservados: TELA-101, FORM-101/102, POP-101/102, FUNC-101–104, API-101–103. Detalhes no guia de chaves.
- Retomar REQUISITOS.md do primeiro item a verificar. Ainda faltam a classificação individual dos módulos restantes, relatório/plano da Fase 3, aprovação e menu de botão direito.
- Parte 8 e eventual continuação do anexo além de 6.1 não recebidas. Não foram criados os documentos reservados ao Prompt 2.

Atualização do lote seguinte: 39 requisitos de fluxos/agenda/campanhas classificados. Testes finais: 15/15 fluxos + 8/8 operações selecionadas. Apenas flows.test.ts mudou: espera por estado persistido com prazo máximo, preservando as asserções; o motor não mudou. LAC-002 de etiqueta ausente no autocomplete documentada. UI não executada neste lote; manter parciais. Continuar requisitos ainda não verificados; BUG-001/002/003 e INT-001 permanecem sem correção de produção.

Complemento do mesmo lote: corrigido também o import de context-menu.test.ts para extensão .js exigida por NodeNext (TST-002); 2/2 casos do menu e a tipagem completa passaram. Código de produção permaneceu intacto. Resultado consolidado em evidencias/fluxos-agenda-2026-10-27.json. Não encerrar a Fase 2: 529 registros ainda a verificar.

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

## Fluxos e prévia de simulação — continuação em 27/10/2026

Percurso visual em operação isolada: rascunho criado, gatilho por igualdade ligado a um texto da Biblioteca, simulação aprovada e recusada, publicação criada sem ativação automática. Corrigida a duplicação do texto original sob a resposta personalizada no simulador. A suíte `flows.test.ts` passou 16/16, incluindo novos cenários de áudio de voz OGG/Opus e imagem PNG preparados pelo conector fictício. Não houve envio WhatsApp ou chamada de IA. Evidência: `evidencias/fluxos-interface-midias-2026-10-27.json`.

## Diagnóstico geral seguinte — 27/10/2026

`npm.cmd test` executou toda a suíte do servidor em bancos descartáveis: 171 aprovados, zero falhas, zero pulados. É uma regressão integral da suíte existente, não uma prova de todos os 703 requisitos. REQ-008 foi classificado parcial (biblioteca de arrastar ligada ao Kanban, sem gesto e persistência homologados neste lote); REQ-009 e REQ-012 completos quanto às tecnologias pedidas. Contagem atual: 468 a verificar, 80 completos, 86 parciais; outros estados inalterados.

Disponibilidade lida sem sessão de usuário: domínio Vercel 200, saúde do túnel vigente 200, rota protegida sem login 401. O registro `.npm-cache/online-runtime.json` apontava para um túnel anterior encerrado; foi atualizado com a instância ativa. O pacote público aponta para o endereço novo. A correção mais recente da prévia de fluxo ainda está apenas no commit local `cbca663` e não foi publicada. O serviço público depende de PC e túnel ativos. Nenhum envio real ou chamada Gemini. Evidência: `evidencias/suite-completa-publicacao-2026-10-27.json`.

Mais nove requisitos de Conexões foram classificados pelo código, teste com conector fictício e telas: REQ-015/016/022/023 completos quanto ao critério específico; REQ-017–021 parciais até comparação com conta real e percurso visual. Contagem após esse bloco: 459 a verificar, 84 completos, 91 parciais, demais estados inalterados. Não houve alteração da conexão real.

Em 28/10/2026, a versão testada foi publicada diretamente na Vercel como `dpl_quW1LBAWRzs8VcuaAJF7K4EUpiR8` READY e associada a https://notcua.vercel.app. A branch `revisao-completa` foi enviada ao GitHub em `46cbb2e` sem alterar `main`. O pacote publicado do editor de fluxos coincide com o build local após normalizar somente a referência ao chunk principal, confirmando a correção de prévia no ar. Saúde pública 200, autenticação exigida 401 e preflight 204 com origem correta. Evidência: `evidencias/publicacao-2026-10-28.json`. A nota anterior de que a prévia estava apenas local era verdadeira antes desta publicação e foi superada.
