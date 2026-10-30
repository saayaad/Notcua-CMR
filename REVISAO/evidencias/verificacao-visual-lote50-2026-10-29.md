# Verificação visual da mesma rodada de 50 IDs — 29/10/2026

Sessão autenticada em `https://notcua.vercel.app/`, conexão “Teste”. Acesso ao navegador do agente confirmado. Não houve envio de mensagem, exclusão de conteúdo nem início de outro lote.

| IDs | Observação na interface | Decisão nesta passagem |
| --- | --- | --- |
| REQ-206 | O campo “Menu · Visão geral” foi alterado temporariamente para “Visão geral · teste”. O menu refletiu o valor, que permaneceu após recarga. O nome original foi restaurado e confirmado após nova recarga. | Prova visual de edição e persistência de **um** rótulo. Ainda falta percorrer as pastas e os demais menus. Parcial. |
| REQ-493/494/503 | O editor aberto por **Personalização** mostrou “Nenhum conteúdo neste filtro”, enquanto a Biblioteca tinha 143 recursos. Pelo menu **Atendimento > Personalizar > HUD**, a lista apareceu. Fixei “TESTE NOCTUA 25-10 · Texto”, defini nome individual e “Mostrar prévia antes de enviar”, salvei e recarreguei. Seleção, nome e prévia permaneceram. Depois removi o fixado, limpei o nome e restaurei “Usar configuração geral”. Nenhuma mensagem foi enviada. | A causa do caminho vazio foi encontrada: `WorkspaceSettings.tsx` chamava `HudEditor` sem `library` e `sessionId`, acionando os valores vazios padrão. Corrigido localmente ao passar as duas props; tipagem web aprovada. A versão pública ainda não contém a correção. REQ-493/494/503 têm prova visual e persistência de um botão, mas seguem parciais até verificar a publicação e o efeito real da prévia sem envio. |
| REQ-208/209 | Na etiqueta “TESTE NOCTUA 25-10”, alterei temporariamente a cor de `#a68bfa` para `#00aabb` e o ícone vazio para `★`. O CRM exibiu a estrela na etapa. Após recarga, ambos os valores continuaram na Personalização. Restaurei cor e ícone originais; nova recarga confirmou a restauração. | Gravação, recarga e efeito do ícone no CRM comprovados. A cor foi confirmada no campo após recarga, mas seu efeito visual na coluna do CRM não foi isolado por captura. Permanecem parciais até essa verificação. |
| REQ-214 | Controles de logotipo e favicon visíveis. | Upload e renderização não testados nesta passagem. Parcial. |
| REQ-215/216 | Editor abre com densidade compacta e oferece as opções Médio/Expandido; a opção Médio mudou no rascunho e foi descartada. Campos de distribuição, posição e largura visíveis; prévia desktop renderizada. | Controles e prévia observados. Falta salvar/recarregar e conferir efeito nas telas principais. Parcial. |
| REQ-202 | Atendimento (lista e área da conversa vazia) e editor de Personalização inspecionados em viewports 1366×768, 1920×1080 e 2560×1440 no navegador interno. Não houve corte evidente dos controles principais nessas vistas; o editor manteve rolagem interna. O viewport temporário foi restaurado. | Prova restrita a essas vistas, sem conversa selecionada, outras abas, zoom ou navegador externo. Parcial. |
| REQ-204 | Apenas o navegador interno desta sessão foi exercitado. | Chrome, Edge, Firefox e Safari continuam sem matriz comprovada. A verificar. |
| REQ-510 | O código local no commit `694ebb3` contém o encaixe automático e sua evidência em `encaixe-blocos-req510-2026-10-29.md`. A versão pública aberta não contém a correção, conforme a evidência desse commit. | Teste visual da correção depende de publicar essa versão ou rodá-la localmente em ambiente de teste. Parcial, sem homologação visual. |
| REQ-223/512 | O acesso autenticado permite testar telas, mas estes IDs agregam centenas de ações e os requisitos das Partes 1/2. | Continuam parciais conforme `limites-visuais-lote50-2026-10-29.md`; nenhum foi aprovado por esta amostra. |

Durante a inspeção ultrawide o site mostrou brevemente “Servidor desconectado”; consultas a `/health` local e pelo túnel responderam 200 logo depois. A oscilação deve ser observada ao repetir o seletor vazio. A sessão foi deixada sem alterações de rascunho.

Continuação: o seletor vazio foi reproduzido após reconexão e comparado com o caminho funcional do Atendimento. O aviso momentâneo de servidor não explica o defeito; a ausência das duas props explica o contraste entre os caminhos. Após salvar a restauração e recarregar, o recurso de teste voltou a **não fixado**, o nome individual ficou vazio e a prévia voltou a “Usar configuração geral”.

## Continuação com acesso direto à aba — 29/10/2026

Sessão autenticada em `https://notcua.vercel.app/atendimento`, conexão “Teste”. Não houve envio de mensagem, exclusão ou upload de arquivos.

- **REQ-215:** alterei `Tamanho dos controles` de **Expandido** para **Médio**, confirmei, recarreguei a página e o editor reabriu em **Médio**. Em seguida, restaurei **Expandido** e confirmei. Persistência visual comprovada; a preferência original foi preservada.
- **REQ-493/494/503:** o defeito do editor público continua reproduzível: a Biblioteca lateral do Atendimento exibe **143 recurso(s)**, mas em `Personalização > Personalizar Atendimento com prévia` a prateleira mostra **“0 conteúdos disponíveis · 0 fixados”**. Logo, ainda não é possível homologar fixar, nomear e testar a prévia pelo caminho de Personalização. A correção existente no commit local `694ebb3` ainda não está na versão pública.
- **REQ-216/510:** o editor público permite abrir `Posição livre`, escolher blocos e expõe coordenadas/largura/altura. O rascunho foi cancelado, sem gravar alterações. A homologação de colisão permanece bloqueada: a versão pública não contém o encaixe automático de `694ebb3`; não há prova visual da correção publicada.
- **REQ-214:** controles de Logotipo e favicon continuam presentes; upload não foi executado, pois ainda requer uma imagem de teste e confirmação específica para enviá-la ao site.

Conclusão desta continuação: REQ-215 ganhou prova de salvar + recarregar e permanece parcial apenas pela ausência das três densidades em todas as telas. REQ-493/494/503, 214, 216 e 510 não foram concluídos por evidência insuficiente; nenhum requisito foi aprovado por suposição.
