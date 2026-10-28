-- =====================================================================
-- Entre Mil Instantes · Fase 1 · Conteúdo inicial
-- Rodar no Supabase: SQL Editor → New query → colar tudo → Run.
--
-- Para que serve: enquanto tu ainda não publicaste nada pelo painel,
-- o site dela usa o rascunho (com o nome e as datas). Assim a data e o
-- contador de dias aparecem no carregamento desde já.
-- =====================================================================

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
             when nullif(c ->> 'libera_em', '') is not null
                  and (c ->> 'libera_em')::date > hoje
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

-- Confere: tem que mostrar Mika e as duas datas.
select rascunho->>'nome' as nome, rascunho->'datas' as datas from public.conteudo where id = 1;
