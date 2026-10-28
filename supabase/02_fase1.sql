-- =====================================================================
-- Entre Mil Instantes · Fase 1 · Relógio do servidor
-- Rodar no Supabase: SQL Editor → New query → colar tudo → Run.
--
-- Para que serve: se o celular dela estiver com a hora errada, a contagem
-- usa a hora do servidor e abre no momento certo do mesmo jeito.
-- =====================================================================

create or replace function public.situacao_publica()
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object('liberar_em', liberar_em, 'agora', now())
  from public.configuracao
  where id = 1;
$$;

revoke execute on function public.situacao_publica() from public;
grant execute on function public.situacao_publica() to anon, authenticated;

-- Fim. Se aparecer "Success. No rows returned", deu tudo certo.
