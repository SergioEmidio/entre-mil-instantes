-- =====================================================================
-- Nós, em Todos os Instantes · Limpar os testes antes de entregar
-- Rodar UMA vez no Supabase: SQL Editor → New query → colar tudo → Run.
-- (Precisa do 05_fase5.sql e do 06_cartas.sql rodados antes.)
-- Pode rodar de novo sem quebrar nada.
--
-- Só apaga o que foi CRIADO TESTANDO o site: recados, itens da lista,
-- "cartas que ela abriu" e a caixa do presente aberta.
-- NÃO mexe no conteúdo (stories, cartas, vales, rádio, presente, datas).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Quanto tem de cada coisa (para o painel mostrar antes de limpar)
-- ---------------------------------------------------------------------
create or replace function public.resumo_testes()
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.eh_admin() then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'recados',       (select count(*) from public.recados),
    'recados_audio', (select count(*) from public.recados where audio_path is not null),
    'lista_dela',    (select count(*) from public.lista_365 where coalesce(autor, 'convidada') <> 'admin'),
    'lista_tua',     (select count(*) from public.lista_365 where autor = 'admin'),
    'cartas',        (select count(*) from public.cartas_abertas),
    'presente_aberto_em', (select aberto_em from public.presente where id = 1)
  );
end;
$$;

revoke execute on function public.resumo_testes() from public, anon;
grant execute on function public.resumo_testes() to authenticated;


-- ---------------------------------------------------------------------
-- 2. Limpar (só o admin, e só com a palavra AUTORIZO)
--    p_lista: 'nada' | 'dela' (só os itens escritos no login dela) | 'tudo'
--    Devolve quanto apagou e os áudios dos recados (o painel apaga os
--    arquivos do armazenamento logo em seguida).
-- ---------------------------------------------------------------------
create or replace function public.limpar_testes(
  confirmacao text,
  p_recados  boolean default true,
  p_lista    text    default 'dela',
  p_cartas   boolean default true,
  p_presente boolean default true
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  audios      jsonb := '[]'::jsonb;
  n_recados   int := 0;
  n_lista     int := 0;
  n_cartas    int := 0;
  fechou      boolean := false;
begin
  if not public.eh_admin() then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  if upper(trim(coalesce(confirmacao, ''))) <> 'AUTORIZO' then
    raise exception 'falta_autorizo' using errcode = '22023';
  end if;
  if coalesce(p_lista, 'nada') not in ('nada', 'dela', 'tudo') then
    raise exception 'opcao_invalida' using errcode = '22023';
  end if;

  if coalesce(p_recados, false) then
    select coalesce(jsonb_agg(audio_path), '[]'::jsonb) into audios
      from public.recados where audio_path is not null;
    delete from public.recados;
    get diagnostics n_recados = row_count;
  end if;

  if p_lista = 'tudo' then
    delete from public.lista_365;
    get diagnostics n_lista = row_count;
  elsif p_lista = 'dela' then
    delete from public.lista_365 where coalesce(autor, 'convidada') <> 'admin';
    get diagnostics n_lista = row_count;
  end if;

  if coalesce(p_cartas, false) then
    delete from public.cartas_abertas;
    get diagnostics n_cartas = row_count;
  end if;

  if coalesce(p_presente, false) then
    update public.presente set aberto_em = null where id = 1 and aberto_em is not null;
    fechou := found;
  end if;

  return jsonb_build_object(
    'recados', n_recados,
    'lista',   n_lista,
    'cartas',  n_cartas,
    'presente_fechado', fechou,
    'audios',  audios
  );
end;
$$;

revoke execute on function public.limpar_testes(text, boolean, text, boolean, boolean) from public, anon;
grant execute on function public.limpar_testes(text, boolean, text, boolean, boolean) to authenticated;
