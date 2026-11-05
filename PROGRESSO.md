# Progresso — Leva 1 (campanhas)

Branch: `auditoria-reqs`. Escopo autorizado: variações até 10, lotes persistentes, pausa/retomada segura. Somente SQLite temporário e socket fictício em validações.

## Feito
- Mapeado o editor e a fila existentes. O servidor já congela o texto por tarefa no salvamento; manter compatibilidade com essas tarefas e campanhas antigas.
- Confirmadas alterações/artefatos preexistentes na árvore de trabalho: não tocar em evidências preexistentes nem nos arquivos protegidos.

## Em andamento
- Implementação das variações nomeadas, do snapshot fixo por lead/lote e da retomada sem repetir envio confirmado.

## Falta
- Persistir histórico e avanço dos lotes; controles para continuar/pausar/retomar; detectar desconexão e marcar envio ambíguo como `verificar`.
- Executar testes isolados cobrindo os 4 critérios de aceite; rodar typecheck/build; documentar limitações e resultado.
- Criar commits pequenos nesta branch; não iniciar a Leva 2.
