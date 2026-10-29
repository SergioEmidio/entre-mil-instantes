-- =====================================================================
-- Entre Mil Instantes · Fase 0 · Estrutura do banco
-- Rodar UMA vez no Supabase: SQL Editor → New query → colar tudo → Run.
-- Pode rodar de novo sem quebrar nada (o script é idempotente).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Papéis: quem é admin (Sérgio) e quem é a convidada (ela)
-- ---------------------------------------------------------------------
create table if not exists public.papeis (
  user_id uuid primary key references auth.users (id) on delete cascade,
  papel   text not null check (papel in ('admin', 'convidada'))
);

alter table public.papeis enable row level security;
-- Sem políticas: ninguém lê esta tabela direto, só pelas funções abaixo.


-- ---------------------------------------------------------------------
-- 2. Configuração pública (a hora em que o site abre)
-- ---------------------------------------------------------------------
create table if not exists public.configuracao (
  id         int primary key default 1 check (id = 1),
  liberar_em timestamptz not null
);

insert into public.configuracao (id, liberar_em)
values (1, '2026-11-03 00:00:00-03')
on conflict (id) do nothing;

alter table public.configuracao enable row level security;


-- ---------------------------------------------------------------------
-- 3. Funções de permissão
-- ---------------------------------------------------------------------
create or replace function public.eh_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.papeis
    where user_id = auth.uid() and papel = 'admin'
  );
$$;

create or replace function public.eh_convidada()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.papeis
    where user_id = auth.uid() and papel = 'convidada'
  );
$$;

-- Admin vê sempre. A convidada só depois da hora de liberar.
create or replace function public.pode_ver()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.eh_admin()
      or (
        public.eh_convidada()
        and now() >= (select liberar_em from public.configuracao where id = 1)
      );
$$;

-- Diz para o site quem está logado (sem expor a tabela de papéis).
create or replace function public.meu_papel()
returns text
language sql stable security definer
set search_path = public
as $$
  select papel from public.papeis where user_id = auth.uid();
$$;


-- ---------------------------------------------------------------------
-- 4. Conteúdo do site (rascunho do painel + versão publicada)
-- ---------------------------------------------------------------------
create table if not exists public.conteudo (
  id            int primary key default 1 check (id = 1),
  rascunho      jsonb not null default '{}'::jsonb,
  publicado     jsonb not null default '{}'::jsonb,
  publicado_em  timestamptz,
  atualizado_em timestamptz not null default now()
);

insert into public.conteudo (id, rascunho, publicado)
values (
  1,
  $json$
  {
    "nome": "Mika",
    "autor": "Sérgio",
    "datas": {
      "conhecemos": "2025-05-19",
      "namoro": "2025-06-20",
      "aniversario": "2026-11-03"
    },
    "abertura": {
      "frase": "Preparei uma retrospectiva, alguns stories e uma rádio feita só pra ti.",
      "segredo": ""
    },
    "retrospectiva": {
      "musica": { "nome": "", "artista": "", "frase": "", "capa": null },
      "apelido": "",
      "lugar": "",
      "frase_dela": ""
    },
    "stories": [],
    "antes_agora": { "antes": null, "agora": null, "frase": "" },
    "radio": { "faixas": [] },
    "presente": { "frase_caixa": "Hoje eu não queria só te dizer. Queria te dar algo." },
    "vales": [],
    "cartas": []
  }
  $json$::jsonb,
  '{}'::jsonb
)
on conflict (id) do nothing;

alter table public.conteudo enable row level security;


-- ---------------------------------------------------------------------
-- 5. Presente (separado, para só chegar ao celular dela no fim)
-- ---------------------------------------------------------------------
create table if not exists public.presente (
  id        int primary key default 1 check (id = 1),
  rascunho  jsonb not null default '{"nome": "", "frase": "", "foto": null, "esconder_foto": false}'::jsonb,
  publicado jsonb not null default '{}'::jsonb,
  aberto_em timestamptz
);

insert into public.presente (id) values (1) on conflict (id) do nothing;

alter table public.presente enable row level security;


-- ---------------------------------------------------------------------
-- 6. Recados que ela manda (texto ou áudio)
-- ---------------------------------------------------------------------
create table if not exists public.recados (
  id         bigint generated always as identity primary key,
  tipo       text not null check (tipo in ('texto', 'audio')),
  texto      text check (texto is null or char_length(texto) <= 2000),
  audio_path text,
  lido       boolean not null default false,
  criado_em  timestamptz not null default now(),
  constraint recado_valido check (
    (tipo = 'texto' and texto is not null and char_length(trim(texto)) > 0)
    or (tipo = 'audio' and audio_path is not null)
  )
);

alter table public.recados enable row level security;


-- ---------------------------------------------------------------------
-- 7. Lista dos próximos 365 dias
-- ---------------------------------------------------------------------
create table if not exists public.lista_365 (
  id         bigint generated always as identity primary key,
  texto      text not null check (char_length(trim(texto)) between 1 and 120),
  feito      boolean not null default false,
  feito_em   timestamptz,
  criado_por uuid default auth.uid(),
  criado_em  timestamptz not null default now()
);

alter table public.lista_365 enable row level security;

-- Marca a data quando a caixinha é marcada (e limpa quando desmarca).
create or replace function public.lista_marcar_data()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.feito and (tg_op = 'INSERT' or not old.feito) then
    new.feito_em := now();
  elsif not new.feito then
    new.feito_em := null;
  end if;
  return new;
end;
$$;

drop trigger if exists lista_marcar_data on public.lista_365;
create trigger lista_marcar_data
before insert or update of feito on public.lista_365
for each row execute function public.lista_marcar_data();


-- ---------------------------------------------------------------------
-- 8. Funções que o site e o painel chamam
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

-- Painel: salva o rascunho (o site dela não muda).
create or replace function public.salvar_rascunho(dados jsonb, presente_dados jsonb default null)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.eh_admin() then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;

  update public.conteudo
     set rascunho = dados, atualizado_em = now()
   where id = 1;

  if presente_dados is not null then
    update public.presente set rascunho = presente_dados where id = 1;
  end if;
end;
$$;

-- Painel: publica o rascunho. Só funciona digitando AUTORIZO.
create or replace function public.publicar(confirmacao text)
returns timestamptz
language plpgsql security definer
set search_path = public
as $$
declare
  quando timestamptz := now();
begin
  if not public.eh_admin() then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  if upper(trim(coalesce(confirmacao, ''))) <> 'AUTORIZO' then
    raise exception 'confirmacao_invalida' using errcode = '22023';
  end if;

  update public.conteudo
     set publicado = rascunho, publicado_em = quando
   where id = 1;

  update public.presente
     set publicado = rascunho
   where id = 1;

  return quando;
end;
$$;

-- Site dela: abre a caixa. Só aqui o presente sai do banco.
create or replace function public.abrir_presente()
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  dados jsonb;
begin
  if not public.pode_ver() then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;

  if public.eh_convidada() then
    update public.presente
       set aberto_em = coalesce(aberto_em, now())
     where id = 1;
  end if;

  select publicado into dados from public.presente where id = 1;
  return coalesce(dados, '{}'::jsonb);
end;
$$;

-- Diz se a caixa já foi aberta (usada na regra da foto do presente).
create or replace function public.presente_foi_aberto()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.presente where id = 1 and aberto_em is not null);
$$;

-- Painel: volta o presente para "fechado" (útil para testar).
create or replace function public.fechar_presente()
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.eh_admin() then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  update public.presente set aberto_em = null where id = 1;
end;
$$;


-- ---------------------------------------------------------------------
-- 9. Regras de acesso (RLS) das tabelas
-- ---------------------------------------------------------------------

-- configuracao: todo mundo lê (é só a hora de abrir); só admin muda.
drop policy if exists "configuracao_ler"   on public.configuracao;
drop policy if exists "configuracao_mudar" on public.configuracao;
create policy "configuracao_ler" on public.configuracao
  for select to anon, authenticated using (true);
create policy "configuracao_mudar" on public.configuracao
  for update to authenticated using (public.eh_admin()) with check (public.eh_admin());

-- conteudo: só o admin lê direto (o rascunho). Ela usa obter_conteudo().
drop policy if exists "conteudo_admin_ler" on public.conteudo;
create policy "conteudo_admin_ler" on public.conteudo
  for select to authenticated using (public.eh_admin());

-- presente: só o admin lê direto. Ela usa abrir_presente().
drop policy if exists "presente_admin_ler" on public.presente;
create policy "presente_admin_ler" on public.presente
  for select to authenticated using (public.eh_admin());

-- recados: ela envia; só o admin lê, marca como lido e apaga.
drop policy if exists "recados_enviar"     on public.recados;
drop policy if exists "recados_admin_ler"  on public.recados;
drop policy if exists "recados_admin_lido" on public.recados;
drop policy if exists "recados_admin_apagar" on public.recados;
create policy "recados_enviar" on public.recados
  for insert to authenticated with check (public.pode_ver() and lido = false);
create policy "recados_admin_ler" on public.recados
  for select to authenticated using (public.eh_admin());
create policy "recados_admin_lido" on public.recados
  for update to authenticated using (public.eh_admin()) with check (public.eh_admin());
create policy "recados_admin_apagar" on public.recados
  for delete to authenticated using (public.eh_admin());

-- lista_365: os dois leem, adicionam, marcam e apagam.
drop policy if exists "lista_ler"     on public.lista_365;
drop policy if exists "lista_criar"   on public.lista_365;
drop policy if exists "lista_marcar"  on public.lista_365;
drop policy if exists "lista_apagar"  on public.lista_365;
create policy "lista_ler" on public.lista_365
  for select to authenticated using (public.pode_ver());
create policy "lista_criar" on public.lista_365
  for insert to authenticated with check (public.pode_ver());
create policy "lista_marcar" on public.lista_365
  for update to authenticated using (public.pode_ver()) with check (public.pode_ver());
create policy "lista_apagar" on public.lista_365
  for delete to authenticated using (public.pode_ver());


-- ---------------------------------------------------------------------
-- 10. Permissões (quem pode usar cada tabela e função)
-- ---------------------------------------------------------------------
revoke all on public.papeis, public.conteudo, public.presente,
              public.recados, public.lista_365, public.configuracao
  from anon, authenticated;

grant select         on public.configuracao to anon, authenticated;
grant update         on public.configuracao to authenticated;
grant select         on public.conteudo     to authenticated;
grant select         on public.presente     to authenticated;
grant select, insert, update, delete on public.recados   to authenticated;
grant select, insert, update, delete on public.lista_365 to authenticated;

revoke execute on function
  public.eh_admin(), public.eh_convidada(), public.pode_ver(), public.meu_papel(),
  public.obter_conteudo(), public.salvar_rascunho(jsonb, jsonb), public.publicar(text),
  public.abrir_presente(), public.fechar_presente(), public.presente_foi_aberto()
  from public, anon;

grant execute on function
  public.eh_admin(), public.eh_convidada(), public.pode_ver(), public.meu_papel(),
  public.obter_conteudo(), public.salvar_rascunho(jsonb, jsonb), public.publicar(text),
  public.abrir_presente(), public.fechar_presente(), public.presente_foi_aberto()
  to authenticated;


-- ---------------------------------------------------------------------
-- 11. Armazenamento de arquivos (todos PRIVADOS)
--   midia    → fotos e áudios do site (stories, rádio, antes e agora…)
--   presente → só a foto do presente
--   recados  → áudios que ela grava para ti
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('midia',    'midia',    false, 15728640),
  ('presente', 'presente', false, 15728640),
  ('recados',  'recados',  false, 15728640)
on conflict (id) do nothing;

drop policy if exists "eni_midia_ler"       on storage.objects;
drop policy if exists "eni_midia_enviar"    on storage.objects;
drop policy if exists "eni_midia_trocar"    on storage.objects;
drop policy if exists "eni_midia_apagar"    on storage.objects;
drop policy if exists "eni_presente_ler"    on storage.objects;
drop policy if exists "eni_presente_enviar" on storage.objects;
drop policy if exists "eni_presente_trocar" on storage.objects;
drop policy if exists "eni_presente_apagar" on storage.objects;
drop policy if exists "eni_recados_enviar"  on storage.objects;
drop policy if exists "eni_recados_ler"     on storage.objects;
drop policy if exists "eni_recados_apagar"  on storage.objects;

-- midia: os dois veem (ela só depois de liberar); só o admin envia/apaga.
create policy "eni_midia_ler" on storage.objects
  for select to authenticated
  using (bucket_id = 'midia' and public.pode_ver());
create policy "eni_midia_enviar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'midia' and public.eh_admin());
create policy "eni_midia_trocar" on storage.objects
  for update to authenticated
  using (bucket_id = 'midia' and public.eh_admin())
  with check (bucket_id = 'midia' and public.eh_admin());
create policy "eni_midia_apagar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'midia' and public.eh_admin());

-- presente: ela só consegue ver a foto DEPOIS de abrir a caixa.
create policy "eni_presente_ler" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'presente'
    and (
      public.eh_admin()
      or (
        public.pode_ver()
        and public.presente_foi_aberto()
      )
    )
  );
create policy "eni_presente_enviar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'presente' and public.eh_admin());
create policy "eni_presente_trocar" on storage.objects
  for update to authenticated
  using (bucket_id = 'presente' and public.eh_admin())
  with check (bucket_id = 'presente' and public.eh_admin());
create policy "eni_presente_apagar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'presente' and public.eh_admin());

-- recados: ela envia áudio; só o admin ouve e apaga.
create policy "eni_recados_enviar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'recados' and public.pode_ver());
create policy "eni_recados_ler" on storage.objects
  for select to authenticated
  using (bucket_id = 'recados' and public.eh_admin());
create policy "eni_recados_apagar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'recados' and public.eh_admin());

-- Fim. Se aparecer "Success. No rows returned", deu tudo certo.
