# Revisão do Noctua — 26/10/2026

## Limites desta rodada

A pausa foi respeitada até a nova autorização. Após a retomada, um texto e um áudio capturado pelo microfone foram entregues exclusivamente ao número de teste. A fila do contato autorizado foi conferida e estava vazia. Nenhum faturamento foi ativado, nenhuma credencial foi substituída e nenhum reset foi executado na instalação real. A etapa anterior foi publicada no commit 5377f3c. As alterações de números, receita e microfone estão em preparação para a próxima publicação.

## Etapas concluídas

- [x] **Personalização:** prévia permanece nas abas; botão Ampliar prévia e retorno aos ajustes funcionando. Rodapé e controles compactados, área vazia eliminada e altura corrigida em tela pequena. Cancelar descarta o rascunho.
- [x] **Navegação:** Ajuda e configurações abre a Central de Ajuda, em vez de redirecionar às configurações gerais. Os quatro guias e seus links foram conferidos e as instruções antigas foram atualizadas.
- [x] **Atalhos:** Textos e Áudios abrem a biblioteca lateral filtrada, com zero modais simultâneos. Busca global encontrou os recursos de texto, voz, funil, macro e campanha de teste; a abertura de texto apresentou o recurso correto.
- [x] **Importação:** CSV com título anterior ao cabeçalho e separador ponto e vírgula é lido; vírgula em nome entre aspas não é confundida com separador. Duplicatas apontam a linha original. Planilha vazia gera mensagem clara.
- [x] **Modelos Gemini:** catálogo paginado consulta os modelos com a chave salva, sem expor o segredo ao navegador. Identificadores com prefixo `models/` são normalizados; número de projeto não é aceito como modelo.
- [x] **Simulador:** erro fica visível, mensagem é preservada para nova tentativa e tentativa malsucedida não é acrescentada como conversa respondida.
- [x] **Consumo de IA:** recusa explícita anterior à geração libera a reserva de tokens/custo. Timeout e falha incerta conservam a estimativa até confirmação; testes verificam os dois casos.
- [x] **Marca d’água em imagem:** desenho e prévia compartilham a mesma rotina Canvas, com texto/PNG, tamanho, opacidade e posição/mosaico. Falha de aplicação bloqueia o envio em vez de usar silenciosamente o original.
- [x] **Marca d’água em vídeo anexado:** camada PNG é composta pelo FFmpeg e mantida mesmo que o resultado seja maior que o original. Teste decodifica um quadro e verifica os pixels da camada. Não foi enviado vídeo real nesta rodada.
- [x] **Mídias animadas:** GIFs e WebP identificados como animados são preservados no otimizador. GIF com marca solicitada não é convertido silenciosamente em foto estática.
- [x] **Configuração de marcas:** servidor valida tamanho, opacidade, conteúdo, selo PNG local, identificadores distintos e existência do modelo ativo.
- [x] **Imagem do estúdio no atendimento:** botão Preparar envio ao cliente abre o anexo na conversa correta para legenda, marca d’água e confirmação. Não envia automaticamente e não substitui outro anexo aberto. Contrato de entrega do rascunho testado sem rede; falta validação real com imagem recém-gerada pelo provedor.
- [x] **Transferência:** conversa de teste encaminhada internamente ao próprio administrador, com observação, e aceita. Sem envio ao WhatsApp ou notificação a outro atendente.
- [x] **Ambiente fictício:** carregamento de seis clientes, mensagem virtual, edição de valor no Kanban, campanha de seis destinatários com conclusão e transferência com aceitação verificados pela interface. Não alteram o histórico real.

## Verificação automatizada

Última suíte completa: **132 testes aprovados, nenhuma falha**, incluindo marca em vídeo, falha segura de imagem, validação dos modelos, preparação de anexo do estúdio, XLS legado e pré-processamento de histórico. Verificação de tipos do servidor, interface e testes passou. Compilação final do servidor e da interface aprovada; permanece aviso de pacote principal acima de 500 kB como oportunidade de otimização do carregamento.

As mídias dos testes são sintéticas e os bancos usados pelos testes são descartáveis. Testes não executam cobranças nem enviam mensagens usando a conexão real.

## Bloqueio externo confirmado

A chave Gemini consultou o catálogo e retornou 46 modelos. O identificador numérico incorreto foi substituído por `gemini-flash-latest`, presente no catálogo. Respostas automáticas permaneceram desativadas.

A geração foi recusada pelo Google com **HTTP 403: nível gratuito da API indisponível para esse projeto**. Nenhum faturamento foi ativado e não houve tentativa de contornar a recusa. Copiloto, transcrição, auditoria e geração de imagem ainda precisam de validação com um projeto que permita geração. Catálogo acessível não comprova cota de geração.

## Pendências para conclusão total

- [ ] Conferência do balão no telefone destinatário. Captura pelo microfone, conversão OGG/Opus, PTT e entrega confirmados em 26/10.
- [ ] Geração real de texto/mídia com Gemini disponível e rotação de cotas entre projetos distintos.
- [x] Exportação com pré-processamento das mídias selecionadas: autorização explícita, progresso, cancelamento, cache e interrupção por recusa do provedor. Validada com provedor simulado; geração real continua dependente do Gemini.
- [x] Leitura de `.xls` binário legado, além de CSV e XLSX. Validada em teste automatizado e pela interface, sem confirmar a importação real.
- [ ] Validar a preparação de imagem recém-gerada pelo estúdio até a prévia do anexo, quando a geração Gemini estiver disponível. O código de integração já existe.
- [x] Consulta de existência de conta antes da importação e na prévia da campanha. Teste real confirmou uma conta sem enviar mensagem; falhas ficam inconclusivas. A consulta não comprova presença online nem consentimento.
- [x] Receita da campanha vinculada explicitamente a vendas ganhas no CRM, com recálculo por valor/estado, bloqueio de dupla atribuição e investimento separado. Resumo na Visão Geral; retorno estimado não é lucro líquido.
- [ ] Revisão de eventos reais de anúncios, turno noturno e opt-out. Rodízio entre chips não implementado; aquecimento por conversas artificiais não integra esta entrega.
- [ ] Índice vetorial/embeddings; recuperação atual usa similaridade lexical.
- [ ] Revisão visual em Chrome, Edge, Firefox, Safari e dispositivos reais, além da prévia responsiva.
- [ ] Especificação da Parte 8, que ainda não foi recebida.

## Evidências visuais

- [Prévia ampliada do HUD](hud-previa-ampliada-2026-10-25.png)
- [Prévia Canvas da marca d’água](marca-dagua-previa-2026-10-26.png)

Checklist pessoal para importar no Notion: [checklist-notion-noctua.md](../checklist-notion-noctua.md). O checklist diferencia implementação, limitações e a aprovação que o usuário ainda fará.

## Etapa seguinte — importação e exportação

Suíte completa atualizada: **121 testes aprovados, nenhuma falha**. Compilação e verificação de tipos aprovadas. Nenhuma análise de histórico real, importação efetiva ou envio WhatsApp foi executado nesta etapa.

O leitor XLS usa a versão 0.20.3 distribuída pela [fonte oficial do SheetJS](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/), com versão e integridade registradas no lockfile. O teste utiliza BIFF8 binário, nomes acentuados, telefone numérico, linha vazia e duplicata; a prévia identifica um contato e informa a linha original descartada.

Em Contatos → Exportar históricos e em Cliente → Histórico, **Analisar mídias antes de exportar** percorre os arquivos automaticamente após a autorização. O processamento é sequencial, reutiliza o cache e preserva os resultados concluídos ao cancelar. Visualização única é excluída; mídia expirada/incompatível recebe aviso. Uma recusa de configuração/cota interrompe a tarefa. O download do ZIP continua independente do uso de IA e inclui o estado da análise no manifesto.

Antes de analisar, aguarde a sincronização da conexão terminar. Mensagens posteriores à data de início não entram no percurso; uma nova execução pode aproveitar o cache e preparar mídias adicionadas ao histórico depois. Cancelar impede o próximo arquivo; uma requisição já enviada ao provedor pode terminar e ficar salva.

Evidências: prévia XLS conferida localmente (captura com contato de teste mantida fora do repositório) e [autorização de pré-processamento](exportacao-preprocessamento-2026-10-26.png).

## Etapa — números e atribuição financeira

- Consulta autenticada em lotes de até 20 números, sequencial, com cache por conexão: até 24 horas para conta encontrada e uma hora para ausência. Resultado inconclusivo não é salvo como ausência e interrompe a fila. A remoção depende do botão do usuário e afeta somente a prévia/seleção.
- Consulta real feita exclusivamente sobre a lista de um contato de teste: uma conta encontrada, nenhuma mensagem enviada e nenhum rascunho salvo.
- Campanhas permitem escolher receita manual ou vendas ganhas vinculadas. Uma negociação só pode ser vinculada a uma campanha; remover o vínculo anterior é necessário para reatribuir. Valor alterado atualiza o total; venda reaberta/perdida deixa de contar. Custos e origem da receita ficam separados do registro de execução, para um envio não sobrescrever o financeiro.
- A Visão Geral resume campanhas que usam receita do CRM, em todo o histórico. Investimento é declarado pelo usuário; produção, impostos e outras despesas não entram no cálculo, que não representa lucro líquido. Receita/ROI por etiqueta permanece pendente de definição e integração de custos.
- Nenhuma venda, valor ou vínculo financeiro real foi alterado durante a revisão da interface. A validação dos cálculos e mudanças de estado usou banco descartável.
- A tentativa fictícia no simulador Gemini continua retornando HTTP 403 por indisponibilidade do nível gratuito. Não houve ativação de faturamento. O usuário autorizou novamente texto e áudio exclusivamente para o contato de teste. A sessão foi restabelecida e os testes de texto e microfone foram retomados com entrega confirmada.

Validação: suíte completa com **123 testes aprovados e nenhuma falha**, seguida de reteste aprovado dos números e do resumo financeiro após o ajuste da Visão Geral. Compilação e verificação de tipos aprovadas.

Evidências: [consulta sem envio](validacao-whatsapp-sem-envio-2026-10-26.png) e [interface de vínculos CRM](receita-crm-interface-2026-10-26.png).


## Etapa — gravação pelo microfone

Corrigida a espera indefinida no medidor de áudio: a retomada do AudioContext não bloqueia mais o MediaRecorder. O atendimento e o simulador mostram permissão pendente, encerram a espera após 20 segundos e liberam capturas autorizadas depois de sair da tela. Três testes cobrem permissão negada, autorização tardia e tela encerrada. A gravação real foi retomada após liberar a permissão do navegador. Um erro de Data URL com parâmetro codecs foi identificado e corrigido; texto e áudio foram entregues ao contato autorizado. A conferência visual do balão pelo destinatário continua pendente.

Suíte completa: **126 testes aprovados, nenhuma falha**. Verificação de tipos aprovada. O projeto Gemini recusa geração com HTTP 403; assinatura Google AI Pro não equivale à cota de API de um projeto externo. Nenhum faturamento foi habilitado.

### Resultado real da gravação

Em 26/10 às 16:22 (Brasília), o servidor confirmou entrega do áudio capturado pelo microfone: tipo audio, isPtt=true, MIME audio/ogg; codecs=opus e 36.267 bytes. Não foi enviado como documento. A mensagem de texto anterior também foi entregue. A prévia está em [microfone-previa-2026-10-26.png](microfone-previa-2026-10-26.png). O usuário foi consultado sobre a aparência no telefone; não presumimos essa confirmação.

O decodificador agora aceita o parâmetro codecs emitido pelo MediaRecorder, preserva a validação estrita do conteúdo Base64 e rejeita parâmetros inesperados. Erros de anexo permanecem visíveis na própria prévia. Teste de regressão adicionado. A etapa anterior b18200a teve publicação Vercel concluída; esta correção final de áudio segue na próxima atualização.
Reteste final isolado: 16 testes de backup, captura e codec aprovados, nenhuma falha. Compilação de produção aprovada. A primeira execução isolada não carregou setup-env.mjs e recebeu recusas de autenticação; repetida com a configuração oficial de testes, passou integralmente.

## Reteste — reprodução no iPhone

O usuário confirmou o balão de voz, mas relatou falha ao baixar somente áudios do Noctua no iPhone. A aprovação de reprodução permanece aberta. O arquivo de 16h22 foi baixado diretamente do servidor WhatsApp com a própria chave da mensagem: 36.267 bytes, conteúdo e SHA-256 iguais ao arquivo local. FFmpeg decodificou os 9,97 segundos sem erros, Opus 48 kHz mono. Nenhum endereço privado ou chave de mídia foi incluído no relatório.

Foi acrescentada uma normalização de compatibilidade: primeira faixa de áudio, remoção de metadados e capítulos, aplicação Opus voip, quadros de 20 ms e normalização de timestamps. É hipótese de compatibilidade, não causa confirmada: o arquivo anterior não apresentava capítulos. Um novo áudio de microfone foi entregue às 16h36 em 26/10, exclusivamente ao contato autorizado. A confirmação de reprodução desse novo áudio foi solicitada.

Validação: 17 testes de atendimento e Data URL aprovados, incluindo geração real de Opus e descarte de tags de capítulos/título. Compilação de produção aprovada. O status de entrega não é usado como prova de download ou reprodução no dispositivo.


### Confirmação do destinatário

O usuário confirmou: o novo áudio enviado às 16h36 baixa e reproduz normalmente no iPhone. O teste completo de gravação, envio PTT, download e reprodução está aprovado para esta amostra e dispositivo. Isso valida o resultado da normalização; não isola qual parâmetro causava a incompatibilidade anterior e não representa teste de todos os modelos de telefone.


## Etapa — abas e painéis encaixáveis

Integrado Dockview React 8.6.1, gratuito sob licença MIT, para divisão e redimensionamento, grupos de abas, painéis flutuantes e janelas externas. Modo opcional no cabeçalho e em Personalizar Atendimento. As posições livres do HUD clássico ficam desativadas dentro do gerenciador para não disputar o mesmo painel.

A disposição é guardada nas preferências da conta mediante Salvar layout; Cancelar recupera o estado salvo. A recuperação valida os componentes permitidos, remove parâmetros de conteúdo e transforma janelas externas em painéis flutuantes locais, sem abertura automática de URLs. Tema, densidade e classes de privacidade acompanham janelas externas. Carregamento de código/CSS acontece sob demanda; a página popout.html foi excluída da reescrita SPA da Vercel.

Interface conferida: abertura da biblioteca, agrupamento por botão, painel flutuante, redimensionamento por arraste da divisória, maximização, restauração, salvamento e recuperação ao reativar o modo clássico/encaixável. O usuário confirmou que a janela externa apareceu com conteúdo correto. Um rascunho temporário permaneceu intacto ao flutuar e reencaixar, com um único compositor, e foi limpo sem envio.

A tentativa automatizada de arrastar uma aba não mudou a disposição. O recurso está implementado pela biblioteca, mas sua conferência manual entre navegadores continua na checklist. Nenhuma mensagem foi enviada nesta etapa. A captura visual ficou somente na pasta temporária local, sem publicação de conteúdo da conta no GitHub.

Validação: suíte completa com **132 testes aprovados, nenhuma falha**, seguida de **5 testes aprovados** de layout/rota após acrescentar a regressão da Vercel. Guia e checklist: [paineis-atendimento.md](../paineis-atendimento.md).


### Confirmação manual do arraste de abas

Em 26/10/2026, o usuário confirmou que consegue arrastar a aba Biblioteca e fixados e encaixá-la em outro painel. O gesto está aprovado no navegador em uso. A cobertura específica de Chrome, Edge, Firefox e Safari permanece separada na revisão entre navegadores.
