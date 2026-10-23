# Integração Meta (Conversions API + públicos)

Página no sistema: **Meta Ads** (menu lateral).

## 1. Conversions API: envio automático de cada venda

**Como funciona**
- Quando um pagamento é registrado (entrada ou total) numa venda que ainda não foi enviada, um gatilho
  no banco marca `meta_capi_status = 'pendente'` e grava o momento (`meta_capi_event_time`). Cada venda
  gera um único Purchase; pagamentos seguintes da mesma venda não reenviam.
- O sistema pede o envio na hora, e também toda vez que alguém abre o sistema (reenvia o que ficou na fila).
- A Edge Function `meta-capi` envia um evento `Purchase` com `event_id` igual ao ID da venda, com telefone,
  e-mail, nome, CEP e país normalizados e com hash SHA-256. O valor é o total da venda, em BRL.
- Até 1000 eventos por requisição. Erro de rede ou 5xx: 3 tentativas com espera crescente, e a venda
  continua `pendente`. Erro 4xx: a venda fica `erro`, com a mensagem; não há repetição em loop.
- Vendas antigas não são enviadas. O histórico vai pelo CSV (parte 2).

**Instalação (uma vez)**
1. No SQL Editor do Supabase, rode `supabase/setup/4-meta-capi.sql` e depois `supabase/setup/6-meta-capi-ajuste.sql`.
2. No Supabase, em *Edge Functions → Secrets*, crie:

   | Secret | Obrigatório | Valor |
   |---|---|---|
   | `META_CAPI_TOKEN` | sim | token do dataset (Events Manager → Pixel Espetos e Cia 2026 → Configurações → Conversions API → Gerar token) |
   | `META_TEST_EVENT_CODE` | não | código do *Test Events*. Enquanto existir, os eventos vão só para o teste. Apague para ir para produção. |
   | `META_ACTION_SOURCE` | não | padrão `chat`. Veja a observação abaixo. |
   | `CRON_SECRET` | não | só se quiser chamar a função por um agendamento (cabeçalho `x-cron-secret`). |

3. Publique a função. O jeito automático: crie um *Access Token* em supabase.com → Account → Access Tokens e
   salve como secret `SUPABASE_ACCESS_TOKEN` no GitHub (*Settings → Secrets and variables → Actions*).
   O workflow "Publicar funções no Supabase" publica a cada mudança e pode ser rodado à mão em *Actions*.
   Pelo terminal: `npx supabase functions deploy meta-capi --project-ref jizaqogargmjpjbjyvwm`.

**Reprocessar**
- Na página Meta Ads: **Enviar fila agora** (pendentes) ou **Reenviar também as com erro**.
- Pela rota: `POST https://jizaqogargmjpjbjyvwm.supabase.co/functions/v1/meta-capi` com corpo
  `{"action":"process"}` ou `{"action":"reprocess"}`, usando o token de um usuário logado ou o cabeçalho `x-cron-secret`.

**`action_source`**: o padrão é `chat` (venda fechada em conversa). O valor `business_messaging` exige
dados que o sistema não guarda (o `ctwa_clid` do anúncio de clique para WhatsApp e o vínculo da conta do WhatsApp
com o dataset). Valide no *Test Events* antes de tirar o `META_TEST_EVENT_CODE`.

## 2. Exportação CSV de clientes (públicos)

Na página Meta Ads: escolha o período (ou deixe vazio para todo o histórico) e clique em **Exportar CSV**.
- O arquivo tem uma linha por cliente (chave: telefone normalizado), com `value` igual à soma das compras (LTV).
- Colunas: `phone,email,fn,ln,ct,st,zip,country,value`, em texto claro, sem hash. A Meta faz o hash no upload.
- Entram só vendas fechadas (`parcial`/`pago`) e não canceladas. Telefones com menos de 12 dígitos são descartados.
- `ct` e `st` saem vazios porque o sistema guarda o endereço em texto livre. O `zip` vem do CEP do endereço.
- A tela mostra só números agregados (clientes, faturamento, e-mails, descartes, ticket médio, por ano).
- Nada é enviado para a Meta: o arquivo é baixado no computador.

## Testes

`npm test` cobre normalização de telefone e e-mail, hash, agrupamento por cliente com LTV e filtro de cancelada
(`src/test/meta.test.ts`).

## 3. Clientes antigos a partir das notas fiscais (DANFE em PDF)

Na página Meta Ads, em **Importar clientes antigos**:
1. Rode uma vez no SQL Editor `supabase/setup/7-vendas-historicas.sql`.
2. Clique em **Escolher arquivo** e envie o `.rar`, `.zip` ou `.7z` com os PDFs (pode ter subpastas), ou os PDFs soltos.
3. O navegador abre o arquivo e lê cada nota (pdf.js + libarchive em WebAssembly). Os PDFs não são enviados para lugar nenhum.
4. Confira o resumo e a prévia, e clique em **Importar**.

- Do bloco do destinatário saem nome, CPF/CNPJ, endereço, bairro, CEP, município, UF e telefone. Também são lidos a data de emissão, a natureza da operação e o valor total da nota.
- A mesma nota não entra duas vezes: a chave de acesso é única.
- Devolução, remessa, retorno, bonificação e transferência ficam de fora.
- Notas a partir da data do primeiro pedido do sistema ficam de fora, porque essas vendas já estão nos pedidos. A data pode ser mudada.
- As vendas ficam na tabela `historical_sales` e entram só no CSV de públicos, que agora tem `ct` e `st` preenchidos para elas. Não aparecem no Dashboard nem no Financeiro.
- Arquivos muito grandes (centenas de MB) usam bastante memória do navegador. Se travar, divida em partes menores.
