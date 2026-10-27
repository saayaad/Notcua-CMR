# Registro de bugs — revisão

Atualização: 27/10/2026. Nenhum defeito funcional novo confirmado na Fase 1 e nenhuma correção de aplicativo realizada.

| ID | Onde | O que aconteceu | Causa | Correção | Reteste |
|---|---|---|---|---|---|
| AMB-001 | Build inicial no terminal restrito | Vite/esbuild não conseguiu ler diretórios/configuração | Permissão do ambiente, não causa de código comprovada | Nenhuma alteração de código; execução autorizada | npm.cmd run build passou, servidor e interface |
| OBS-001 | Build web | Aviso de pacote principal maior que 500 kB | Tamanho de código informado pelo compilador | Não alterado nesta fase | Compilação final passou em 27/10; avaliar impacto na Fase 2 |

## Relatos históricos a conferir

Os relatos do usuário estão individualizados em REQUISITOS.md (L-05, L-17, L-18, L-19, L-20, L-23 e L-24). Relatórios anteriores dizem que alguns foram corrigidos, mas não ganham status 🔧 nesta revisão sem reteste próprio.
IDs BUG-001 em diante serão atribuídos a defeitos concretos na Fase 2. Não converter observação ambiental em bug do produto.


## BUG-001 — Salvamento silencioso de preferências

Arquivo: apps/web/src/context/PreferencesContext.tsx:245. O PUT automático descarta a falha com catch vazio. Na cópia fictícia, nome de menu com 31.000 caracteres foi recusado pela API (413, Configuração muito grande); o banco manteve Campanhas QA e o recarregamento recuperou esse valor. A edição local não foi persistida. Não corrigido ainda: respeitar o plano da Fase 3. É necessário apresentar falha, preservar rascunho e limitar a entrada de maneira clara.

