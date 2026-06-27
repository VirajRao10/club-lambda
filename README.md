# club Λ

`club Λ` is a fake online casino experience for fictional credits only. Lambda acts as the visible house manager, setting table conditions, narrating recent outcomes, and keeping the tone playful. Wallets, promos, account links, and the leaderboard are backed by Supabase through Cloudflare Worker endpoints.

## Local development

```sh
npm install
npm run dev
```

## Production routes

The Cloudflare Worker is scoped to:

- `https://virajrao.com/gamble`
- `https://virajrao.com/clublambda`

The root `virajrao.com` site is left alone.

## Supabase

The live project is `https://naxlamszrokhjgabqjcf.supabase.co`. The schema lives in `sql/migration.sql` and creates:

- `wallets`
- `promo_codes`
- `promo_redemptions`

The Worker reads `SUPABASE_URL` and `SUPABASE_KEY` secrets, with the current publishable project values as fallbacks for local development.
