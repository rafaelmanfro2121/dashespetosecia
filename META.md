# Integração Meta (Conversions API + públicos)

Página no sistema: **Meta Ads** (menu lateral).

## 1. Conversions API: envio automático de cada venda

**Como funciona**
- Quando uma venda sai de "pendente" (entrada paga ou pago total), um gatilho no banco marca
  `meta_capi_status = 'pendente'` e grava o momento do fechamento (`meta_capi_event_time`).
- O sistema pede o envio na hora, e também toda vez que alguém abre o sistema (reenvia o que ficou na fila).
- A Edge Function `meta-capi` envia um evento `Purchase` com `event_id` igual ao ID da venda, com telefone,
  e-mail, nome, CEP e país normalizados e com hash SHA-256. O valor é o total da venda, em BRL.
- Até 1000 eventos por requisição. Erro de rede ou 5xx: 3 tentativas com espera crescente, e a venda
  continua `pendente`. Erro 4xx: a venda fica `erro`, com a mensagem; não há repetição em loop.
- Vendas antigas não são enviadas. O histórico vai pelo CSV (parte 2).

**Instalação (uma vez)**
1. No SQL Editor do Supabase, rode `supabase/setup/4-meta-capi.sql`.
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
