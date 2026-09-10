# Roadmap de correções — WACRM

Data: 10/09/2026  
Projeto revisado: `/home/nader/wacrm-local`  
Status: planejado; nenhuma correção implementada por este documento.

## Objetivo e evidências iniciais

Corrigir autorização de envio, falhas em campanhas, conflito de migrações e concorrência no contador de mensagens não lidas. Regularizar o lint e estabelecer verificações que impeçam regressões.

Baseline do review: 75 arquivos de teste e 679 testes passaram; TypeScript passou; ESLint reportou 31 erros e 54 avisos. Os achados foram identificados por inspeção de código. Não houve validação contra banco real, aplicação de migrações ou envio ao WhatsApp.

## Ordem de execução

| Etapa | Prioridade | Entrega | Dependência |
| --- | --- | --- | --- |
| 0 | P1 | Confirmar cenários e histórico do banco | Nenhuma |
| 1 | P1 | Bloquear envios de usuários somente leitura | Etapa 0 |
| 2 | P1 | Resolver a versão duplicada de migração | Histórico obtido na etapa 0 |
| 3 | P1 | Corrigir lotes e tratamento de limite nas campanhas | Etapa 1 |
| 4 | P2 | Atualizar contador de não lidas atomicamente | Etapa 2 |
| 5 | P2 | Regularizar lint e consolidar CI | Etapas 1–4 |
| 6 | P1 | Validar integração e preparar publicação | Etapas 1–5 |

## Etapa 0 — Preparar reprodução e inventário

- [ ] Registrar commit de referência e estado do checkout, preservando alterações existentes.
- [ ] Criar testes que reproduzam os achados antes das correções.
- [ ] Conferir em ambiente de teste o schema efetivo e o histórico `supabase_migrations.schema_migrations`, especialmente a versão `034`.
- [ ] Identificar o procedimento atual de deploy e migração e se há mais de uma instância da aplicação.
- [ ] Preparar usuários de teste com papéis `viewer`, `agent`, `admin` e `owner`, além de uma segunda conta para validar isolamento.

**Aceite:** cenários reproduzíveis documentados e histórico conhecido antes de escolher como reconciliar as migrações. Usar mocks da Meta nos testes automatizados.

## Etapa 1 — Impedir envio por viewer

Arquivos principais: `src/app/api/whatsapp/broadcast/route.ts`, `src/app/api/whatsapp/send/route.ts` e `src/lib/auth/roles.ts`.

- [ ] Resolver o papel da conta no servidor e exigir `canSendMessages` antes de descriptografar credenciais ou chamar a Meta.
- [ ] Aplicar a verificação à rota de broadcast e conferir a mesma proteção no envio individual e nas demais rotas de envio autenticadas por sessão.
- [ ] Preservar as regras de escopo das rotas autenticadas por API key; não substituir esse modelo por papéis de sessão.
- [ ] Testar usuário não autenticado, viewer, papéis autorizados e recurso pertencente a outra conta.

**Aceite:** viewer recebe `403` e não provoca chamada externa nem escrita operacional; não autenticado recebe `401`; agent/admin/owner continuam enviando dentro da própria conta. A proteção funciona com requisição direta, independentemente da interface.

## Etapa 2 — Reconciliar migrações duplicadas

Arquivos envolvidos: `supabase/migrations/034_ai_google_provider.sql` e `supabase/migrations/034_fix_profiles_update_rls.sql`.

- [ ] Escolher uma versão ainda não utilizada para eliminar a duplicidade.
- [ ] Definir a atualização de bancos existentes conforme o histórico observado. Não renomear ou reparar o histórico de uma migração aplicada sem conferir os efeitos presentes no schema.
- [ ] Preparar, se necessário, uma migração complementar idempotente que garanta tanto o suporte a Google quanto a proteção das colunas de privilégio.
- [ ] Adicionar verificação de versões duplicadas no CI.
- [ ] Aplicar a sequência completa em banco descartável e testar atualização de uma cópia de ambiente existente.

**Aceite:** instalação limpa e atualização terminam sem conflito de versão; provider `google` é aceito; viewer não altera diretamente `account_role` ou `account_id`; edição de perfil e RPCs legítimas de membros continuam funcionando.

## Etapa 3 — Tornar campanhas compatíveis com o limite da API

Arquivos principais: `src/hooks/use-broadcast-sending.ts`, `src/app/api/whatsapp/broadcast/route.ts` e `src/lib/rate-limit.ts`.

- [ ] Documentar que cada requisição atual representa um lote de até 10 destinatários, e não uma campanha inteira.
- [ ] Preservar a proteção da API e tratar `429` como espera: respeitar `Retry-After`, limitar tentativas e informar o estado na interface.
- [ ] Não marcar destinatários como falha definitiva enquanto o lote aguarda liberação do limite.
- [ ] Validar tamanho e formato dos lotes no servidor, evitando que chamadas diretas contornem o limite por meio de listas ilimitadas.
- [ ] Distinguir `429` devolvido antes do envio de timeout/erro ambíguo após possível envio. Não repetir cegamente esses últimos; uma retentativa segura exige deduplicação ou reconciliação.
- [ ] Testar 60 e 100 destinatários, limite já parcialmente consumido, falha parcial e esgotamento das tentativas, usando relógio controlado e Meta simulada.

**Aceite:** o sexto lote aguarda quando necessário, sem perder destinatários; o fluxo retomado não duplica envios; progresso e estado final refletem os resultados reais.

**Evolução separada:** fila persistente no servidor para continuar campanhas após fechamento da aba e retomar execuções interrompidas. A correção do limite, sozinha, não resolve essa dependência do navegador.

## Etapa 4 — Corrigir concorrência nas mensagens não lidas

Arquivo principal: `src/app/api/whatsapp/webhook/route.ts`, acompanhado de nova migração com versão exclusiva.

- [ ] Substituir a soma feita em JavaScript por incremento atômico no banco, preferencialmente associado à inserção efetiva da mensagem recebida.
- [ ] Definir um único responsável pelo incremento; remover a atualização concorrente antiga para evitar contagem dupla.
- [ ] Garantir que repetição do mesmo evento não incremente novamente.
- [ ] Conferir o comportamento ao marcar a conversa como lida enquanto novas mensagens chegam.
- [ ] Testar em PostgreSQL/Supabase duas inserções concorrentes, replay de evento, rollback de inserção e marcação de leitura.

**Aceite:** partindo de 5 não lidas, duas mensagens novas confirmadas produzem 7; replay não altera a contagem; inserção que falha não incrementa; leitura concorrente segue uma regra documentada.

## Etapa 5 — Regularizar lint e verificações contínuas

- [ ] Corrigir os 31 erros reportados, priorizando tipos explícitos e uso correto de hooks, sem desabilitar regras globalmente.
- [ ] Triar os 54 avisos: corrigir dependências de hooks com impacto funcional, remover código sem uso e registrar justificativas para exceções pontuais.
- [ ] Configurar CI para executar testes, TypeScript sem emissão, ESLint, build e verificação de versões de migração.
- [ ] Incluir os novos testes de autorização, rate limit e integração do banco.

**Aceite:** lint sem erros, testes e TypeScript aprovados, build concluído em ambiente com configuração apropriada; cada aviso remanescente tem justificativa registrada.

## Etapa 6 — Validar e preparar publicação

- [ ] Executar a suíte consolidada sobre a revisão final, registrando resultados e commit.
- [ ] Validar em homologação os quatro cenários corrigidos e os fluxos legítimos de envio, recebimento e gestão de membros.
- [ ] Registrar ordem de aplicação de migrações e aplicação, backup e procedimento de recuperação compatível com o novo schema.
- [ ] Planejar rollback que preserve a proteção de privilégios e não reintroduza a contagem dupla de mensagens.
- [ ] Preparar notas de versão e evidências para revisão antes da publicação.

**Aceite:** todos os itens P1 resolvidos e verificados, atualização de banco ensaiada, verificações automatizadas aprovadas e limitações restantes documentadas.

## Organização sugerida das mudanças

1. PR de autorização de envio e testes de papéis.
2. PR de migrações e verificação de versões duplicadas.
3. PR de campanhas e tratamento de `429`.
4. PR de contagem atômica e testes de concorrência.
5. PR de lint e consolidação de CI.

As estimativas devem ser definidas após a etapa 0: o histórico real do banco e a infraestrutura de deploy podem alterar o esforço de migração e validação.
