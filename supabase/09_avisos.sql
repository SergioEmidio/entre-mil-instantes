-- =====================================================================
-- Nós, em Todos os Instantes · Avisos no celular (notificações)
-- Rodar UMA vez no Supabase: SQL Editor → New query → colar tudo → Run.
-- Pode rodar de novo sem quebrar nada.
--
-- Guarda os celulares que ativaram os avisos e o que já foi avisado.
-- Quem manda os avisos é a função "avisos" (Edge Function), de hora em
-- hora. O agendamento fica no arquivo de segredos (não vai pro GitHub).
-- =====================================================================

-- Celulares que ativaram os avisos
create table if not exists public.avisos_inscricoes (
  id         bigint generated always as identity primary key,
  endpoint   text not null unique check (char_length(endpoint) between 10 and 1000),
  p256dh     text not null check (char_length(p256dh) between 40 and 200),
  auth       text not null check (char_length(auth) between 10 and 100),
  papel      text,
  criado_em  timestamptz not null default now(),
  ultimo_ok  timestamptz
);

-- O que já foi avisado (cada aviso sai uma vez só)
create table if not exists public.avisos_enviados (
  chave      text primary key,
  enviado_em timestamptz not null default now()
);

-- Estado da última rodada
create table if not exists public.avisos_estado (
  id              int primary key default 1 check (id = 1),
  tinha_inscricao boolean not null default false,
  rodou_em        timestamptz
);

alter table public.avisos_inscricoes enable row level security;
alter table public.avisos_enviados   enable row level security;
alter table public.avisos_estado     enable row level security;

-- Ninguém mexe direto (só pelas funções abaixo e pela Edge Function).
revoke all on public.avisos_inscricoes from anon, authenticated;
revoke all on public.avisos_enviados   from anon, authenticated;
revoke all on public.avisos_estado     from anon, authenticated;
grant all on public.avisos_inscricoes to service_role;
grant all on public.avisos_enviados   to service_role;
grant all on public.avisos_estado     to service_role;


-- ---------------------------------------------------------------------
-- O site salva/remove a inscrição deste celular
-- ---------------------------------------------------------------------
create or replace function public.salvar_aviso(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.pode_ver() then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  if p_endpoint is null or p_endpoint !~ '^https://' then
    raise exception 'aviso_invalido' using errcode = '22023';
  end if;
  if (select count(*) from public.avisos_inscricoes) >= 20
     and not exists (select 1 from public.avisos_inscricoes where endpoint = p_endpoint) then
    raise exception 'muitos_avisos' using errcode = '22023';
  end if;
  insert into public.avisos_inscricoes (endpoint, p256dh, auth, papel)
  values (p_endpoint, p_p256dh, p_auth, public.meu_papel())
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth, papel = excluded.papel;
end;
$$;

create or replace function public.remover_aviso(p_endpoint text)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.pode_ver() then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  delete from public.avisos_inscricoes where endpoint = p_endpoint;
end;
$$;

revoke execute on function public.salvar_aviso(text, text, text) from public, anon;
revoke execute on function public.remover_aviso(text) from public, anon;
grant execute on function public.salvar_aviso(text, text, text) to authenticated;
grant execute on function public.remover_aviso(text) to authenticated;


-- ---------------------------------------------------------------------
-- Painel: quais celulares estão inscritos (e apagar um)
-- ---------------------------------------------------------------------
create or replace function public.avisos_painel()
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.eh_admin() then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'inscricoes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', id, 'papel', papel, 'criado_em', criado_em, 'ultimo_ok', ultimo_ok,
               'servico', split_part(split_part(endpoint, '://', 2), '/', 1))
             order by criado_em desc)
        from public.avisos_inscricoes), '[]'::jsonb),
    'enviados', (select count(*) from public.avisos_enviados),
    'rodou_em', (select rodou_em from public.avisos_estado where id = 1)
  );
end;
$$;

create or replace function public.apagar_aviso(p_id bigint)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.eh_admin() then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  delete from public.avisos_inscricoes where id = p_id;
end;
$$;

revoke execute on function public.avisos_painel() from public, anon;
revoke execute on function public.apagar_aviso(bigint) from public, anon;
grant execute on function public.avisos_painel() to authenticated;
grant execute on function public.apagar_aviso(bigint) to authenticated;
