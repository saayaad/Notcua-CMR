# Painéis do Atendimento

Ative **Painéis encaixáveis** no cabeçalho do Atendimento. A mesma opção está em **Personalizar → Painéis → Usar abas e painéis encaixáveis**, com confirmação antes de aplicar.

O recurso usa Dockview gratuito, com licença MIT. Dockview, FlexLayout e Golden Layout são alternativas para o mesmo trabalho; foi integrada uma única biblioteca para evitar dois gerenciadores disputando os painéis.

## Organizar o espaço

1. Arraste o título de uma aba para a borda de outro painel para dividir a área, ou para sua faixa de abas para agrupá-los.
2. Arraste as divisórias para alterar a largura e a altura.
3. Se preferir botões, selecione um painel e use **Esquerda**, **Direita**, **Em cima**, **Embaixo** ou **Juntar em abas**.
4. No cabeçalho de cada grupo, use **Painel flutuante**, **Abrir em outra janela** ou **Maximizar**. **Restaurar tamanho** desfaz a maximização.
5. Clique em **Salvar layout** para guardar a disposição na sua conta. **Cancelar** recupera a última disposição salva. O botão de seta circular recupera a disposição padrão; salve para mantê-la.

Fechar uma aba oculta o painel, sem apagar a conversa ou a biblioteca. Reabra-o pelos botões **Conversas**, **Conversa** e **Biblioteca e fixados** da barra superior.

## Janelas e tamanhos de tela

- A janela externa mantém os recursos do mesmo Atendimento e acompanha tema, densidade e preferências de privacidade. A janela principal precisa continuar aberta.
- Ao restaurar um layout salvo, janelas externas voltam como painéis flutuantes dentro do Atendimento. Outra janela só abre depois de um clique; isso evita pop-ups inesperados ao entrar.
- O navegador pode bloquear novas janelas; nesse caso o sistema informa o bloqueio.
- Telas estreitas começam com abas agrupadas. Em áreas médias, biblioteca e lista compartilham um grupo para preservar a conversa. Abaixo de 481 pixels, permanece a navegação clássica de celular.
- **Layout clássico** retorna à organização anterior. As configurações anteriores de HUD e atalhos continuam disponíveis.

## Validação desta entrega

- [x] Ativação e retorno ao modo clássico.
- [x] Agrupamento, encaixe por botão e painel flutuante pela interface.
- [x] Redimensionamento por arraste da divisória.
- [x] Maximização e restauração.
- [x] Janela externa com conteúdo correto, confirmada pelo usuário.
- [x] Retorno da janela externa para o Atendimento.
- [x] Salvamento e recuperação da disposição ao reativar o modo.
- [x] Rascunho de teste preservado ao flutuar e reencaixar; um único compositor; nenhum envio realizado.
- [x] Testes isolados de recuperação, limites de monitor, rejeição de componentes desconhecidos e descarte de dados de conversa do layout.
- [x] Arraste e encaixe de abas confirmados manualmente pelo usuário no navegador em uso em 26/10/2026. A automação confirmou o arraste de divisórias.
- [ ] Conferência específica em outros navegadores: Chrome, Edge, Firefox e Safari.
