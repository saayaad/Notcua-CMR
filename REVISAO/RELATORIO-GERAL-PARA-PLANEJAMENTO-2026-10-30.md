# Noctua — relatório geral para planejar a próxima etapa

Data: 30/10/2026. Revisão de leitura do repositório, do inventário de requisitos, dos registros de bugs e do progresso de testes. Não houve alteração de produto, dados reais, credenciais, publicação ou envio externo nesta revisão.

## 1. Conclusão executiva

O Noctua é um CRM/atendimento WhatsApp com interface React, API Express, SQLite/Prisma, conector Baileys e rotinas persistentes. Há implementação substancial de atendimento, contatos, biblioteca, CRM, campanhas, agenda, fluxos, acesso, backup, personalização e IA opcional. O código compila e a última regressão integral registrada aprovou 202 de 202 testes. Isso demonstra cobertura local relevante, não homologação integral dos 703 pedidos em produção.

O livro `REVISAO/REQUISITOS.md` é a fonte atual dos estados: 114 completos, 296 parciais, 234 a verificar, 50 substituídos/cancelados, 4 dependentes de decisão, 4 desconectados e 1 ausente. Assim, 539 registros ativos continuam sem conclusão formal. Muitos descrevem aspectos repetidos da mesma função e não equivalem a 539 implementações novas. Os documentos `PENDENCIAS.md` e `BUGS.md` conservam trechos históricos com contagens e estados superados; é preciso ler a seção mais recente e o registro da REQ antes de alterar status.

O próximo trabalho deve transformar a cobertura genérica em prova individual. Critério sugerido: código ligado à interface/API, teste de regra, confirmação visual e persistência após recarga quando cabível. Marcar separadamente o que depende de WhatsApp real, conta adicional, dispositivo físico, serviço externo ou mudança nos dados da operação.

## 2. O que existe no programa

| Área | Implementação observada | Evidência e limite atual |
| --- | --- | --- |
| Base e interface | Monorepo TypeScript com `apps/web` React 19/Vite e `apps/server` Express 5; estilos, navegação, tema, busca global, menu contextual, responsividade e configurações. | Build e tipagem aprovados; percurso visual por Chromium cobriu telas principais, mas não todos os controles, papéis e dispositivos. |
| Acesso | Login Firebase opcional, autorização no servidor, papéis, operações privadas, chaves/licenças e separação de dados por espaço. | Testes fictícios aprovam isolamento e ativação; cadastro e ativação de segunda conta real pendentes (REQ-695–697). |
| WhatsApp | Baileys, QR, sessões, credenciais cifradas, reconexão, sincronização de contatos, histórico, fotos e etiquetas; eventos por Socket.IO. | Testes de conector fictício; completude de sincronização, reconexão e entrega no aparelho exigem prova real controlada. |
| Atendimento | Caixa de entrada, conversas, notas internas, pesquisa/filtros, presença, composição, mídia, áudio como voz, PIX, respostas padrão, fixados, SLA e ações de equipe. | Vários testes de serviço e algumas telas observadas; envio/recebimento real, mídia no iPhone e combinações de interface seguem parciais. |
| Biblioteca | Recursos de texto, áudio, imagem/vídeo, documento, funil, macro, PIX e fluxos; categorias, busca, prévia e atalhos. | API de criação/edição/exclusão testada em banco descartável; interface pública exibiu recursos e filtros. Falta homologar toda edição e persistência na operação controlada. |
| CRM e contatos | Importação CSV/XLS/XLSX, listas, etiquetas, Kanban, oportunidades, receita, filtros, ordem e sincronização de etiquetas. | Testes de regras e navegação de CRM; arraste, valores, etiquetas e indicadores ainda têm requisitos visuais parciais. |
| Campanhas e agenda | Público segmentado, rascunhos, variações, intervalos, janela de envio, fila, sequência, follow-up, CTA, lembretes e transição de etiqueta. | Worker e rotas testados com WhatsApp fictício; não houve disparo real nesta auditoria. Mudanças locais recentes ainda estão sem commit. |
| Fluxos | Editor em canvas, versões, publicação, simulação, gatilhos, nós, esperas, caminhos, retomada e cancelamento. | Testes de motor numerosos; as 22 REQs de Fluxos e CRM continuam parciais pela prova de editor visual e execução externa. |
| Personalização/painéis | Densidade/HUD, sete abas, prévia desktop/celular, posição livre, Dockview, janelas e layout persistente. | Prévia observada; algoritmos de encaixe testados. As 22 REQs de Painéis ainda estão a verificar no inventário; arraste, redimensionamento e restauração pela interface precisam de casos próprios. |
| Backup e segurança | Importação/exportação JSON, Sutofly, ZapVoice, backup integral, chave de recuperação, reset protegido e confirmação. | Testes em SQLite temporário; cobertura, destino privado e restauração da instalação real não homologados. Não executar reset na operação. |
| IA e economia | Recurso habilitável, chaves cifradas, provedores, sugestões, resumos, cache com aprovação, análise de mídia, limites e simulação. | Provedores fictícios nos testes. Não há chave real autorizada; geração real e custos ficam fora da auditoria até uma decisão. Quatro controles de economia estão desconectados. |
| Infraestrutura | Vercel para interface; API e WhatsApp rodam no PC com túnel temporário; Dockerfile e guia para servidor persistente. | Publicação e retorno após reinício constam em evidências históricas. Disponibilidade contínua não existe enquanto o PC/túnel forem a API. |
| Documentação e CI | Guias por módulo, diagramas, checklists e GitHub Actions (`npm ci`, geração Prisma, tipagem, build e testes). | Documentos acumulam trechos antigos; o livro de REQs e este relatório devem orientar a próxima consolidação. |

## 3. Inventário por área

Legenda: completo / parcial / a verificar / substituído ou cancelado / decisão, desconectado ou ausente.

| Área | Total | Completo | Parcial | A verificar | Fora | Especial |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Estrutura | 14 | 12 | 1 | 1 | 0 | 0 |
| Conexões | 9 | 4 | 5 | 0 | 0 | 0 |
| Mensagens | 63 | 10 | 52 | 1 | 0 | 0 |
| Fluxos e CRM | 22 | 0 | 22 | 0 | 0 | 0 |
| Backups | 22 | 2 | 18 | 2 | 0 | 0 |
| Acesso e operação | 30 | 4 | 25 | 1 | 0 | 0 |
| Operação e IA | 35 | 5 | 19 | 11 | 0 | 0 |
| Interface global | 40 | 6 | 7 | 26 | 1 | 0 |
| Personalização | 37 | 7 | 27 | 2 | 1 | 0 |
| Atendimento | 60 | 4 | 49 | 7 | 0 | 0 |
| Atendimento e personalização | 16 | 3 | 13 | 0 | 0 | 0 |
| Campanhas e agenda | 29 | 3 | 12 | 14 | 0 | 0 |
| Exportação e operação | 30 | 4 | 7 | 18 | 0 | 1 |
| Sandbox e suporte | 32 | 11 | 8 | 13 | 0 | 0 |
| IA e mídia | 32 | 0 | 0 | 32 | 0 | 0 |
| Automações | 22 | 2 | 3 | 16 | 0 | 1 |
| Economia de IA | 30 | 0 | 5 | 20 | 0 | 5 |
| Infraestrutura | 24 | 10 | 6 | 7 | 0 | 1 |
| IA | 12 | 0 | 0 | 12 | 0 | 0 |
| Qualidade e documentação | 18 | 0 | 0 | 17 | 0 | 1 |
| Painéis | 22 | 0 | 0 | 22 | 0 | 0 |
| Etiquetas e leads | 13 | 6 | 7 | 0 | 0 | 0 |
| Revisão e menu contextual | 34 | 12 | 7 | 12 | 3 | 0 |
| Chaves e operações | 12 | 9 | 3 | 0 | 0 | 0 |
| Produção de vídeos | 45 | 0 | 0 | 0 | 45 | 0 |

Os 45 pedidos de produção de vídeo pertencem ao Creatfy Studio e foram cancelados neste CRM. Há mais cinco itens substituídos/cancelados em outras áreas.

## 4. Pendências concretas e riscos

### 4.1 Produto e integração

1. **REQ-419–422 / INT-001:** as opções de economia para campanhas, treinamento, comprovantes e resumo diário são salvas e exibidas, mas a busca no servidor localiza consumo efetivo somente para autoatendimento, copiloto e resumos em `ai.service.ts`. A UI pode prometer um efeito que não ocorre. Decidir se essas quatro funções serão implementadas e então ligar os controles, ou retirar/identificar como indisponíveis.
2. **REQ-423:** há estimativa mensal de tokens/chamadas poupadas; falta visão diária e cobertura de todas as economias prometidas.
3. **REQ-430:** índice vetorial/embeddings local ausente; o contexto atual usa palavras, sinônimos e interseção. Decidir se a busca lexical é suficiente no produto sem chave de IA ou especificar uma alternativa local. Não contratar serviço externo por inferência.
4. **REQ-540:** esta cópia não tem a configuração pública `VITE_FIREBASE_*` do front-end local, segundo a auditoria de infraestrutura. O exemplo contém nomes, não valores; a hospedagem pode estar configurada independentemente. Validar apenas com identificadores da aplicação correta.
5. **REQ-523/543:** a API, SQLite, worker e sessão WhatsApp dependem do PC/túnel temporário. Reinício ou desligamento causa indisponibilidade até restaurar túnel e apontamento. Hospedagem persistente implica migração, disco, backup e possível custo.
6. **Backups:** o registro histórico identifica bancos/chaves locais e lacunas de cópia desses espaços. Antes de qualquer migração ou limpeza, definir quais dados e segredos entram no backup, destino privado, frequência e procedimento de restauração testável.
7. **BUG-011:** correção do iniciador foi validada por parser e execução interativa, mas ainda não por novo desligamento real. Tratar como risco de recuperação operacional, não como falha funcional reproduzida no momento.
8. **Pacote web:** build aprova, porém o bundle principal de cerca de 596,5 kB gera aviso do Vite. Medir tempo de carregamento antes de priorizar divisão de código.

### 4.2 Prova funcional ainda incompleta

- Mensagens e Atendimento: entregas reais de texto, voz, imagem, vídeo, PIX, resposta padrão e ações em conversa controlada; verificar idempotência e não duplicação na conta autorizada.
- Conexões: sincronização integral de contatos/histórico/fotos/etiquetas, QR e reconexão após queda, sem reativar filas antigas por acidente.
- Fluxos: caminho visual do editor, publicar versão, simular e acompanhar uma execução com contato de teste; confirmar esperas, resposta e cancelamento.
- Campanhas: escolher público, prévia, rascunho, variações, janela horária e fila com destinatários fictícios; execução externa só com autorização e contato delimitado.
- HUD/painéis: salvar/cancelar e recarregar com preferência descartável; testar abas, arraste, colisão, minimização, janela externa, desktop e celular real.
- Biblioteca: prévia/edição/fixação por categoria e persistência; upload e exclusão só em dados de teste claramente delimitados.
- Acesso: segunda conta de teste verificada para REQ-695–697, permissões por papel, e-mail de convite/recuperação e isolamento visual.
- Dispositivos: iPhone para áudio, navegador físico adicional, segundo monitor, janelas externas e leitor de tela. Viewport simulado não substitui aparelho.

### 4.3 Decisões que o código não pode resolver sozinho

| REQ | Decisão necessária |
| --- | --- |
| 316 | Inatividade significa exatamente X dias ou pelo menos X dias? |
| 410 | Conversas artificiais para “aquecer chips” fazem parte do produto? Relatórios anteriores as excluíram; não presumir redução de bloqueio. |
| 526 | Manter somente serviços sem cartão/cobrança mesmo quando a API Gemini não oferecer cota suficiente? |
| 573 | Parte 8 ainda não foi fornecida. Seu conteúdo precisa ser recebido antes de especificar. |

### 4.4 IA sem chave

O pedido atual do usuário é retirar a dependência de uma chave de IA que não possui. Nenhuma chave real foi cadastrada ou removida nesta revisão. A decisão de produto ainda deve distinguir: ocultar/desabilitar IA para a operação atual, eliminar IA do produto, ou mantê-la opcional para uso futuro. Até essa escolha, não repetir testes de geração real nem solicitar chave. Testes locais com provedor simulado demonstram regras e proteção, mas não quota, qualidade, preço ou funcionamento real do modelo.

## 5. Estado do código e da evidência

- Branch atual: `main`; HEAD local observado: `694ebb3` (29/10/2026). Há alterações locais não commitadas em atendimento, campanhas, contatos, WhatsApp, testes e configurações, além de arquivos novos de campanha/janela de envio. Preservar esse trabalho e revisar o diff antes de merge/publicação.
- Último ciclo registrado: `npm test` 202/202; `npm run build` servidor e web aprovados; tipagem aprovada. O CI repete geração Prisma, tipagem, build e testes a cada push/PR. Não foi feita nova execução integral especificamente para este relatório de leitura.
- Navegação anterior por Chromium autenticado confirmou as telas principais, busca, Biblioteca, Configurações, CRM, Campanhas, Agenda, Autoatendimento, Espaço de Teste, Ajuda, menu contextual e abertura das sete abas do HUD. Houve respostas 404 de avatares remotos; sem evidência de falha central associada. Isso é amostra visual, não prova individual dos 539 registros.
- `PROGRESSO_REQS.md` registra etapas recentes, mas mantém blocos históricos de 194/202 antes das correções; a seção posterior com 202/202 prevalece. `PENDENCIAS.md` também contém contagens antigas. Uma futura fonte única deve vincular cada REQ à evidência atual, data, ambiente e limite, evitando concluir por contagem agregada.
- `REVISAO/BUGS.md` registra BUG-001–010 como corrigidos em etapas históricas; BUG-011 parcial. INT-001, REQ-423 e REQ-430 são as lacunas de produto mais concretas. Não reabrir bugs corrigidos somente porque o documento contém uma descrição antiga de reprodução.

## 6. Ordem recomendada para prosseguir

1. **Consolidar escopo:** decidir o destino da IA sem chave e as quatro decisões da seção 4.3. Definir um contato/conta de teste e quais mutações descartáveis estão liberadas. Isso transforma os testes externos em casos executáveis.
2. **Estabilizar a base:** revisar o diff não commitado, validar as regras de campanha recentes (texto-base, variações, número alternativo, proteção de contato importado, janela e follow-up), manter a suíte verde e definir versão candidata. Evitar publicar uma mistura não revisada.
3. **Resolver defeitos/lacunas específicos sem credencial:** INT-001 (ou retirar os controles sem consumidor), métricas diárias, cobertura de backup e recuperação do iniciador. Cada correção precisa de aceite observável.
4. **Homologar jornadas por módulo:** acesso, conexões, atendimento, biblioteca, CRM, campanhas/agenda, fluxos, personalização/painéis, backup. Fazer provas em conta/dados descartáveis e atualizar os IDs correspondentes, não promover uma faixa inteira de uma vez.
5. **Validar ambiente externo:** janela, monitor, iPhone, e-mail e WhatsApp real apenas quando existirem recursos de teste delimitados. Confirmar restauração de backup antes de qualquer migração ou limpeza.
6. **Planejar hospedagem:** comparar manter PC/túnel com servidor persistente, custos e manutenção. A escolha de tecnologia e migração é uma decisão separada da auditoria de interface.

## 7. Contrato sugerido para o próximo prompt

Pedir ao executor que use `REVISAO/REQUISITOS.md` como lista mestra, este relatório como mapa, `PROGRESSO_REQS.md` como histórico e `REVISAO/BUGS.md` como registro de defeitos. Para cada REQ trabalhada, exigir: ID, critério de aceite, caminho de UI/API, evidência de código, teste executado, persistência, ambiente, resultado, limite e próxima ação. Priorizar os defeitos comprovados e jornadas completas por dependência; não inferir “completo” da existência de componente ou do sucesso geral da suíte. Proibir alteração de dados reais, envio externo, publicação, exclusão e cadastro de credenciais sem delimitação específica. Manter IA real fora do plano enquanto não houver decisão/chave. Preservar alterações locais preexistentes e apresentar diff e testes antes de qualquer publicação.

## Fontes principais

- `REVISAO/REQUISITOS.md` — 703 registros e estados por ID.
- `REVISAO/BUGS.md`, `REVISAO/PENDENCIAS.md`, `REVISAO/INVENTARIO-PENDENTES.md` — diagnósticos e histórico.
- `PROGRESSO_REQS.md` — execução recente, testes e capturas.
- `README.md`, `docs/arquitetura-completa.md`, `docs/publicacao.md` e guias por módulo.
- `apps/server/src`, `apps/server/prisma/schema.prisma`, `apps/web/src`, `apps/server/test`, `.github/workflows/checks.yml`.
