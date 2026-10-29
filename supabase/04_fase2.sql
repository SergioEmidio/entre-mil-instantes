-- =====================================================================
-- Entre Mil Instantes · Fase 2 · Painel
-- Rodar no Supabase: SQL Editor → New query → colar tudo → Run.
-- =====================================================================

-- Pré-visualização: só tu (admin) consegues ver o RASCUNHO no site,
-- antes de publicar. Ela continua vendo só o que foi publicado.
create or replace function public.obter_previa()
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  dados jsonb;
begin
  if not public.eh_admin() then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;

  select rascunho into dados from public.conteudo where id = 1;

  -- Na prévia as cartas aparecem todas, com a marcação de trancada.
  return coalesce(dados, '{}'::jsonb) || jsonb_build_object(
    'cartas',
    coalesce((
      select jsonb_agg(
        c || jsonb_build_object(
          'trancada',
          coalesce(nullif(c ->> 'libera_em', '')::date > (now() at time zone 'America/Sao_Paulo')::date, false)
        )
      )
      from jsonb_array_elements(coalesce(dados -> 'cartas', '[]'::jsonb)) as c
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.obter_previa() from public, anon;
grant execute on function public.obter_previa() to authenticated;

-- ---------------------------------------------------------------------
-- Atualização: conteúdo do site dela (cartas com data vazia ficam livres)
-- ---------------------------------------------------------------------
-- Site dela: devolve o conteúdo publicado.
-- Cartas com data futura chegam SEM o texto (trancadas de verdade).
create or replace function public.obter_conteudo()
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  dados  jsonb;
  hoje   date := (now() at time zone 'America/Sao_Paulo')::date;
  cartas jsonb;
begin
  if not public.pode_ver() then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;

  -- Enquanto nada foi publicado ainda, usa o rascunho (evita site vazio).
  select case when publicado is null or publicado = '{}'::jsonb then rascunho else publicado end
    into dados
    from public.conteudo where id = 1;

  select coalesce(jsonb_agg(
           case
             when coalesce(nullif(c ->> 'libera_em', '')::date > hoje, false)
             then (c - 'texto') || jsonb_build_object('trancada', true)
             else c || jsonb_build_object('trancada', false)
           end
         ), '[]'::jsonb)
    into cartas
    from jsonb_array_elements(coalesce(dados -> 'cartas', '[]'::jsonb)) as c;

  return coalesce(dados, '{}'::jsonb) || jsonb_build_object('cartas', cartas);
end;
$$;

revoke execute on function public.obter_conteudo() from public, anon;
grant execute on function public.obter_conteudo() to authenticated;

-- Fim. Se aparecer "Success. No rows returned", deu tudo certo.
