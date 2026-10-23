-- Cole no SQL Editor do Supabase e clique em Run (uma vez).
-- Meta CAPI: a venda também entra na fila quando recebe um pagamento e ainda nunca foi enviada
-- (ex.: entrada registrada antes da integração existir e restante pago agora).
-- Vendas antigas já quitadas não mudam e continuam fora. Venda já enviada não é reenviada.
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
     AND (
       TG_OP = 'INSERT'
       OR lower(coalesce(OLD.payment_status, 'pendente')) IS DISTINCT FROM lower(NEW.payment_status)
       OR coalesce(NEW.paid_amount, 0) > coalesce(OLD.paid_amount, 0)
     ) THEN
    NEW.meta_capi_status := 'pendente';
    NEW.meta_capi_event_time := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS meta_capi_enqueue ON public.service_orders;
CREATE TRIGGER meta_capi_enqueue
  BEFORE INSERT OR UPDATE OF payment_status, order_status, paid_amount ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION public.meta_capi_enqueue();
