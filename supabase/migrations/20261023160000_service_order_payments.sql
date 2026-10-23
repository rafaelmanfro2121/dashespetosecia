-- Histórico de parcelas por pedido (permite pagamento misto: parte dinheiro/PIX, parte cartão).
-- Cada item: {"amount": 4000, "method": "dinheiro" | "cartao", "date": "2026-10-23T12:00:00Z"}
ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS payments jsonb NOT NULL DEFAULT '[]'::jsonb;
