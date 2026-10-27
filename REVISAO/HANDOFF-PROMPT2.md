# Handoff para o Prompt 2 — provisório

27/10/2026. **Fase 2 em andamento. O usuário autorizou posteriormente a implementação do menu contextual; ela está disponível localmente. Redesign e correções gerais ainda dependem do plano de auditoria.**

Atualização mais recente: ContextMenuProvider global, ações de mensagens/lista/biblioteca, descoberta de botões nos demais cards, edição nativa de texto e navegação geral. Ver MENU-CONTEXTO.md e MENU-CONTEXTO.md (seção Testes e checklist). 60 testes selecionados aprovados, sem envios reais. Checkpoint anterior 15d2559. Não declarar os 699 requisitos aprovados com base nessa regressão. As referências ao menu como pendente abaixo representam o estado anterior à autorização atual.

Após esse lote: 49 registros receberam classificação individual. BUG-002 (resumo estagnado em conversa longa) e BUG-003 (cache sem aprovação reutilizando saudação personalizada) foram reproduzidos por generateSuggestion com provedor/repositório fictícios. INT-001: quatro toggles de economia salvos sem consumidor. LAC-001: índice vetorial ausente, métrica somente mensal. Nenhum desses quatro achados foi corrigido ainda; detalhes e prioridade em BUGS.md/PENDENCIAS.md. Fumaça de menu executada na lista, na mensagem recebida e no cadastro de pergunta com cancelamento, sem envios ou cadastro real.

- Branch revisao-completa; checkpoint inicial 8039a09 e livro inicial 24d997f. O escopo foi aprovado para verificação.
- 699 registros em 27 blocos: 568 ⬜ A VERIFICAR; 40 ✅ COMPLETO; 24 🟡 PARCIAL; 6 ⛔ NÃO TESTADO; 50 🔁 SUBSTITUÍDO OU CANCELADO; 4 ⚠️ PRECISA DE DECISÃO; 4 🔌 DESCONECTADO; 2 🐞 COM DEFEITO; 1 ❌ AUSENTE. Contagens atualizadas após a auditoria parcial; não significam homologação integral.
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
