-- Cole no SQL Editor do Supabase e clique em Run (uma vez).
-- Integração Meta (Conversions API): controle de envio por venda.
ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS meta_capi_status text
    CHECK (meta_capi_status IN ('pendente', 'enviado', 'erro')),
  ADD COLUMN IF NOT EXISTS meta_capi_event_time timestamptz,
  ADD COLUMN IF NOT EXISTS meta_capi_error text,
  ADD COLUMN IF NOT EXISTS meta_capi_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS meta_capi_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS service_orders_meta_capi_status_idx
  ON public.service_orders (meta_capi_status)
  WHERE meta_capi_status IS NOT NULL;

-- Quando a venda fecha (sai de "pendente" para "parcial"/"pago"), entra na fila de envio.
-- O momento do fechamento vira o event_time. Vendas antigas não entram: o histórico vai pelo CSV.
CREATE OR REPLACE FUNCTION public.meta_capi_enqueue()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF lower(coalesce(NEW.payment_status, '')) IN ('cancelado', 'cancelada', 'estornado', 'estornada')
     OR lower(coalesce(NEW.order_status, '')) IN ('cancelado', 'cancelada', 'estornado', 'estornada') THEN
    IF NEW.meta_capi_status = 'pendente' THEN
      NEW.meta_capi_status := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.meta_capi_status IS NULL
     AND lower(coalesce(NEW.payment_status, '')) IN ('pago', 'parcial')
     AND (TG_OP = 'INSERT' OR lower(coalesce(OLD.payment_status, 'pendente')) NOT IN ('pago', 'parcial')) THEN
    NEW.meta_capi_status := 'pendente';
    NEW.meta_capi_event_time := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS meta_capi_enqueue ON public.service_orders;
CREATE TRIGGER meta_capi_enqueue
  BEFORE INSERT OR UPDATE OF payment_status, order_status ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION public.meta_capi_enqueue();
