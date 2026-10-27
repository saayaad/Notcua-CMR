# Handoff para o Prompt 2 — provisório

27/10/2026. **Fase 2 em andamento. O usuário autorizou posteriormente a implementação do menu contextual; ela está disponível localmente. Redesign e correções gerais ainda dependem do plano de auditoria.**

Atualização mais recente: ContextMenuProvider global, ações de mensagens/lista/biblioteca, descoberta de botões nos demais cards, edição nativa de texto e navegação geral. Ver MENU-CONTEXTO.md e MENU-CONTEXTO.md (seção Testes e checklist). 60 testes selecionados aprovados, sem envios reais. Checkpoint anterior 15d2559. Não declarar os 699 requisitos aprovados com base nessa regressão. As referências ao menu como pendente abaixo representam o estado anterior à autorização atual.

Após esse lote: 49 registros receberam classificação individual. BUG-002 (resumo estagnado em conversa longa) e BUG-003 (cache sem aprovação reutilizando saudação personalizada) foram reproduzidos por generateSuggestion com provedor/repositório fictícios. INT-001: quatro toggles de economia salvos sem consumidor. LAC-001: índice vetorial ausente, métrica somente mensal. Nenhum desses quatro achados foi corrigido ainda; detalhes e prioridade em BUGS.md/PENDENCIAS.md. Fumaça de menu executada na lista, na mensagem recebida e no cadastro de pergunta com cancelamento, sem envios ou cadastro real.

- Branch revisao-completa; checkpoint inicial 8039a09 e livro inicial 24d997f. O escopo foi aprovado para verificação.
- 703 registros em 28 blocos: 481 ⬜ A VERIFICAR; 71 ✅ COMPLETO; 82 🟡 PARCIAL; 8 ⛔ NÃO TESTADO; 50 🔁 SUBSTITUÍDO OU CANCELADO; 4 ⚠️ PRECISA DE DECISÃO; 4 🔌 DESCONECTADO; 2 🐞 COM DEFEITO; 1 ❌ AUSENTE. Contagens atuais; não significam homologação integral.
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
