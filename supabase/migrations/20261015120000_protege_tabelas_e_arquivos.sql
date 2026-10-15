-- Segurança: estoque e compras de material só para usuários logados.
-- As policies antigas não tinham "TO authenticated" e valiam também para visitantes sem login.
DROP POLICY IF EXISTS "Authenticated can read inventory" ON public.inventory;
DROP POLICY IF EXISTS "Authenticated can insert inventory" ON public.inventory;
DROP POLICY IF EXISTS "Authenticated can update inventory" ON public.inventory;
DROP POLICY IF EXISTS "Authenticated can delete inventory" ON public.inventory;
CREATE POLICY "Authenticated can read inventory" ON public.inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert inventory" ON public.inventory FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update inventory" ON public.inventory FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete inventory" ON public.inventory FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can read material_purchases" ON public.material_purchases;
DROP POLICY IF EXISTS "Authenticated can insert material_purchases" ON public.material_purchases;
DROP POLICY IF EXISTS "Authenticated can update material_purchases" ON public.material_purchases;
DROP POLICY IF EXISTS "Authenticated can delete material_purchases" ON public.material_purchases;
CREATE POLICY "Authenticated can read material_purchases" ON public.material_purchases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert material_purchases" ON public.material_purchases FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update material_purchases" ON public.material_purchases FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete material_purchases" ON public.material_purchases FOR DELETE TO authenticated USING (true);

-- Arquivos: visitantes sem login não podem mais LISTAR as notas fiscais nem as imagens de e-mail.
-- Os links já salvos continuam abrindo (os buckets seguem públicos para quem tem o link exato).
DROP POLICY IF EXISTS "Public can read invoices" ON storage.objects;
DROP POLICY IF EXISTS "Email assets are publicly accessible" ON storage.objects;
