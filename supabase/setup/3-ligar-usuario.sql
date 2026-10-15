-- Liga o seu login novo aos dados antigos e mantém você como administrador.
-- ANTES: crie o usuário em Authentication > Users > Add user > Create new user.
-- Troque SEU_EMAIL_AQUI abaixo pelo e-mail que você usou, e clique em Run.
DO $$
DECLARE
  email_novo text := 'SEU_EMAIL_AQUI';
  id_antigo uuid := 'fbd71453-c567-4444-8113-16b18790222a';
  id_novo uuid;
  r record;
BEGIN
  SELECT id INTO id_novo FROM auth.users WHERE lower(email) = lower(trim(email_novo));
  IF id_novo IS NULL THEN
    RAISE EXCEPTION 'Usuário % não encontrado. Crie primeiro em Authentication > Users.', email_novo;
  END IF;
  IF id_novo = id_antigo THEN
    RAISE NOTICE 'Já está ligado.';
    RETURN;
  END IF;

  -- Remove o perfil vazio criado automaticamente para o login novo (o antigo será reaproveitado).
  DELETE FROM public.profiles WHERE user_id = id_novo;
  DELETE FROM public.user_roles WHERE user_id = id_novo;

  -- Troca o dono de todos os registros: de id_antigo para id_novo.
  FOR r IN
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'user_id' AND data_type = 'uuid'
  LOOP
    EXECUTE format('UPDATE public.%I SET user_id = $1 WHERE user_id = $2', r.table_name)
      USING id_novo, id_antigo;
  END LOOP;

  -- Garante o acesso de administrador.
  UPDATE public.profiles SET role = 'admin' WHERE user_id = id_novo;
  INSERT INTO public.user_roles (user_id, role) VALUES (id_novo, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
END $$;

SELECT p.name, p.role, u.email,
  (SELECT count(*) FROM public.service_orders s WHERE s.user_id = p.user_id) AS pedidos
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id;
