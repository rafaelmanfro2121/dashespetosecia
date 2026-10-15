# Sair do Lovable: hospedagem própria (grátis)

O sistema tem duas partes, e cada uma vai para um lugar:

| Parte | Hoje | Depois |
|---|---|---|
| **Site** (telas, botões, gráficos) | Lovable | **GitHub Pages** (grátis) |
| **Dados + login** (usuários, lançamentos, clientes, arquivos) | Lovable Cloud (Supabase gerenciado pelo Lovable) | **Supabase na sua própria conta** (plano grátis) |

O GitHub só hospeda arquivos estáticos. Ele não guarda logins nem dados digitados no sistema. Por isso o banco precisa ir para um Supabase em seu nome. O jogo de matemática era diferente: ele não tinha login nem banco de dados.

---

## Passo 1: publicar o site no GitHub Pages

O arquivo `.github/workflows/deploy.yml` já publica o site sozinho a cada alteração na branch `main`.

1. **O repositório é privado.** No plano grátis do GitHub, o Pages só funciona em repositório **público**. Você tem 3 opções:
   - Deixar o repositório público: *Settings → General → Danger Zone → Change visibility*. O código fica visível para qualquer pessoa, mas os dados continuam protegidos pelo login.
   - Assinar o GitHub Pro (cerca de US$ 4/mês) e manter o repositório privado.
   - Manter privado e usar **Netlify**, **Vercel** ou **Cloudflare Pages**, que são grátis e aceitam repositório privado. Basta conectar o repositório, usar o comando de build `npm run build` e a pasta `dist`.
2. Em *Settings → Pages → Build and deployment → Source*, escolha **GitHub Actions**.
3. Faça o merge deste PR. Em poucos minutos o site estará em
   `https://rafaelmanfro2121.github.io/dashespetosecia/`

Até você concluir o passo 2, o site continua usando o banco atual do Lovable, então tudo funciona igual.

---

## Passo 2: levar o banco de dados para a sua conta Supabase

> Faça isto **antes** de cancelar o Lovable. Se o plano for cancelado, o banco do Lovable Cloud pode ser desligado e os dados perdidos.

1. **Crie a conta e o projeto** em <https://supabase.com> (plano Free) e escolha a região *South America (São Paulo)*.
2. **Crie as tabelas.** No Supabase, abra *SQL Editor* e rode, **em ordem**, cada arquivo da pasta `supabase/migrations/`.
   Outra opção é usar o terminal: `npx supabase link --project-ref SEU_ID && npx supabase db push`.
3. **Copie os dados.** No Lovable, em *Cloud → Database*, exporte cada tabela em CSV. No Supabase, em *Table Editor → Import data from CSV*, importe cada uma.
4. **Copie os arquivos.** Recrie os buckets `invoices`, `contracts` e `email-assets` em *Storage* e envie de novo os arquivos baixados do Lovable.
5. **Usuários e login.** As senhas não podem ser exportadas. Cada pessoa cria a conta de novo na tela de login ou usa "esqueci a senha". Como são poucos usuários, isso costuma ser rápido.
6. **Configure o login.** Em *Authentication → URL Configuration*, coloque o endereço do site em **Site URL** e em **Redirect URLs**, por exemplo `https://rafaelmanfro2121.github.io/dashespetosecia/`.
7. **Ligue o site ao novo banco.** No GitHub, abra *Settings → Secrets and variables → Actions → New repository secret* e crie os 3 secrets abaixo. Os valores estão no Supabase, em *Project Settings → API*.
   - `VITE_SUPABASE_URL`: a Project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: a chave `anon` / `publishable`
   - `VITE_SUPABASE_PROJECT_ID`: o ID do projeto

   Depois disso, rode o workflow de novo: *Actions → Publicar no GitHub Pages → Run workflow*.

### Funções automáticas (e-mail e WhatsApp)

Ficam em `supabase/functions/`. Para publicá-las no seu Supabase:

```sh
npx supabase functions deploy --project-ref SEU_ID
npx supabase secrets set RESEND_API_KEY=... EVOLUTION_API_URL=... EVOLUTION_API_KEY=... --project-ref SEU_ID
```

- **E-mail marketing** (Resend) e **WhatsApp** (Evolution API) continuam funcionando com as suas chaves.

### Limites do plano grátis do Supabase

- 500 MB de banco e 1 GB de arquivos, mais do que suficiente para este sistema.
- Se o projeto ficar **7 dias sem nenhum acesso**, ele é pausado. Para reativar, basta clicar em "Restore" no painel. Com uso diário isso não acontece.
