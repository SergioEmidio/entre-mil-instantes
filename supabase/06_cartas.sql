-- =====================================================================
-- Entre Mil Instantes · Cartas: saber quando ela abriu + voz nas cartas
-- Rodar UMA vez no Supabase: SQL Editor → New query → colar tudo → Run.
-- (Precisa do 05_fase5.sql rodado antes.) Pode rodar de novo sem quebrar.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Registro: cada vez que ela abre uma carta
-- ---------------------------------------------------------------------
create table if not exists public.cartas_abertas (
  id        bigint generated always as identity primary key,
  carta_id  text not null check (char_length(carta_id) between 1 and 80),
  titulo    text check (titulo is null or char_length(titulo) <= 80),
  aberta_em timestamptz not null default now()
);

alter table public.cartas_abertas enable row level security;

drop policy if exists "cartas_abertas_admin_ler"    on public.cartas_abertas;
drop policy if exists "cartas_abertas_admin_apagar" on public.cartas_abertas;
create policy "cartas_abertas_admin_ler" on public.cartas_abertas
  for select to authenticated using (public.eh_admin());
create policy "cartas_abertas_admin_apagar" on public.cartas_abertas
  for delete to authenticated using (public.eh_admin());

revoke all on public.cartas_abertas from anon, authenticated;
grant select, delete on public.cartas_abertas to authenticated;

-- Ela registra pela função. Só conta quando é ELA (tu testando não conta),
-- e a mesma carta aberta de novo em menos de 10 minutos não repete.
create or replace function public.registrar_carta(p_id text, p_titulo text default null)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.pode_ver() then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  if not public.eh_convidada() then
    return;
  end if;
  if p_id is null or char_length(p_id) = 0 or char_length(p_id) > 80 then
    return;
  end if;
  if exists (
    select 1 from public.cartas_abertas
     where carta_id = p_id and aberta_em > now() - interval '10 minutes'
  ) then
    return;
  end if;
  insert into public.cartas_abertas (carta_id, titulo)
  values (p_id, left(nullif(trim(coalesce(p_titulo, '')), ''), 80));
end;
$$;

revoke execute on function public.registrar_carta(text, text) from public, anon;
grant execute on function public.registrar_carta(text, text) to authenticated;


-- ---------------------------------------------------------------------
-- 2. Cartas trancadas também escondem a voz (não só o texto)
-- ---------------------------------------------------------------------
create or replace function public.cartas_para_o_site(cartas jsonb, mostrar_tudo boolean)
returns jsonb
language sql stable
as $$
  select coalesce(jsonb_agg(
           case
             when not mostrar_tudo
              and coalesce(nullif(c ->> 'libera_em', '')::date > (now() at time zone 'America/Sao_Paulo')::date, false)
             then (c - 'texto' - 'audio' - 'duracao') || jsonb_build_object(
                    'trancada', true,
                    'tem_texto', char_length(trim(coalesce(c ->> 'texto', ''))) > 0,
                    'tem_audio', coalesce(nullif(c ->> 'audio', ''), null) is not null)
             else c || jsonb_build_object(
                    'trancada', coalesce(nullif(c ->> 'libera_em', '')::date > (now() at time zone 'America/Sao_Paulo')::date, false),
                    'tem_texto', char_length(trim(coalesce(c ->> 'texto', ''))) > 0,
                    'tem_audio', coalesce(nullif(c ->> 'audio', ''), null) is not null)
           end
         ), '[]'::jsonb)
    from jsonb_array_elements(coalesce(cartas, '[]'::jsonb)) as c;
$$;

revoke execute on function public.cartas_para_o_site(jsonb, boolean) from public, anon;

-- Fim. Se aparecer "Success. No rows returned", deu tudo certo.
