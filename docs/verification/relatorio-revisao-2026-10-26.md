# Revisão do Noctua — 26/10/2026

## Limites desta rodada

Nenhuma mensagem nova enviada pelo WhatsApp após o pedido de pausa dos envios. A fila do contato autorizado foi conferida e estava vazia. Nenhum faturamento foi ativado, nenhuma credencial foi substituída e nenhum reset foi executado na instalação real. As mudanças permanecem locais; não houve publicação na Vercel.

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

Última suíte completa: **121 testes aprovados, nenhuma falha**, incluindo marca em vídeo, falha segura de imagem, validação dos modelos, preparação de anexo do estúdio, XLS legado e pré-processamento de histórico. Verificação de tipos do servidor, interface e testes passou. Compilação final do servidor e da interface aprovada; permanece aviso de pacote principal acima de 500 kB como oportunidade de otimização do carregamento.

As mídias dos testes são sintéticas e os bancos usados pelos testes são descartáveis. Testes não executam cobranças nem enviam mensagens usando a conexão real.

## Bloqueio externo confirmado

A chave Gemini consultou o catálogo e retornou 46 modelos. O identificador numérico incorreto foi substituído por `gemini-flash-latest`, presente no catálogo. Respostas automáticas permaneceram desativadas.

A geração foi recusada pelo Google com **HTTP 403: nível gratuito da API indisponível para esse projeto**. Nenhum faturamento foi ativado e não houve tentativa de contornar a recusa. Copiloto, transcrição, auditoria e geração de imagem ainda precisam de validação com um projeto que permita geração. Catálogo acessível não comprova cota de geração.

## Pendências para conclusão total

- [ ] Gravação pelo microfone e conferência do balão no telefone destinatário, somente quando os testes de envio forem retomados.
- [ ] Geração real de texto/mídia com Gemini disponível e rotação de cotas entre projetos distintos.
- [x] Exportação com pré-processamento das mídias selecionadas: autorização explícita, progresso, cancelamento, cache e interrupção por recusa do provedor. Validada com provedor simulado; geração real continua dependente do Gemini.
- [x] Leitura de `.xls` binário legado, além de CSV e XLSX. Validada em teste automatizado e pela interface, sem confirmar a importação real.
- [ ] Validar a preparação de imagem recém-gerada pelo estúdio até a prévia do anexo, quando a geração Gemini estiver disponível. O código de integração já existe.
- [ ] Consulta de conta WhatsApp ativa antes da importação/disparo; normalização não comprova conta ativa.
- [ ] Atribuição completa de ROI por campanha; validar dados de conversão, não inferir lucro apenas pelo valor de um lead.
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
