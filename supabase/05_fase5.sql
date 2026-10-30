-- =====================================================================
-- Entre Mil Instantes · Fase 5 · Presente, cartas, lista, recados
-- Rodar UMA vez no Supabase: SQL Editor → New query → colar tudo → Run.
-- Pode rodar de novo sem quebrar nada.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Lista dos 365 dias: guarda quem escreveu cada item
-- ---------------------------------------------------------------------
alter table public.lista_365 add column if not exists autor text;

create or replace function public.lista_marcar_autor()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  new.autor := coalesce(public.meu_papel(), 'convidada');
  new.texto := trim(new.texto);
  return new;
end;
$$;

drop trigger if exists lista_marcar_autor on public.lista_365;
create trigger lista_marcar_autor
before insert on public.lista_365
for each row execute function public.lista_marcar_autor();

-- Ninguém muda o autor nem a data de criação depois.
revoke update on public.lista_365 from authenticated;
grant update (texto, feito) on public.lista_365 to authenticated;


-- ---------------------------------------------------------------------
-- 2. Recados: duração do áudio + envio por uma função (com limites)
-- ---------------------------------------------------------------------
alter table public.recados add column if not exists duracao int;

create or replace function public.enviar_recado(
  p_tipo text,
  p_texto text default null,
  p_audio text default null,
  p_duracao int default null
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  hoje int;
begin
  if not public.pode_ver() then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;

  -- Limite simples para não encher o banco por engano.
  select count(*) into hoje
    from public.recados
   where criado_em > now() - interval '1 day';
  if hoje >= 60 then
    raise exception 'muitos_recados' using errcode = '22023';
  end if;

  if p_tipo = 'texto' then
    if p_texto is null or char_length(trim(p_texto)) = 0 or char_length(p_texto) > 2000 then
      raise exception 'recado_invalido' using errcode = '22023';
    end if;
    insert into public.recados (tipo, texto) values ('texto', trim(p_texto));

  elsif p_tipo = 'audio' then
    if p_audio is null or p_audio !~ '^recado/[A-Za-z0-9-]+\.(wav|mp3|m4a|aac|webm|ogg)$' then
      raise exception 'recado_invalido' using errcode = '22023';
    end if;
    insert into public.recados (tipo, audio_path, duracao)
    values ('audio', p_audio, greatest(0, least(coalesce(p_duracao, 0), 3600)));

  else
    raise exception 'recado_invalido' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.enviar_recado(text, text, text, int) from public, anon;
grant execute on function public.enviar_recado(text, text, text, int) to authenticated;

-- Agora ela só envia pela função (não insere direto na tabela).
drop policy if exists "recados_enviar" on public.recados;
revoke insert on public.recados from authenticated;


-- ---------------------------------------------------------------------
-- 3. O que o site precisa saber sobre o presente (sem revelar nada)
-- ---------------------------------------------------------------------
create or replace function public.presente_resumo(dados jsonb)
returns boolean
language sql immutable
as $$
  select coalesce(nullif(trim(dados ->> 'nome'), ''), nullif(trim(dados ->> 'frase'), ''), nullif(dados ->> 'foto', '')) is not null;
$$;

-- Cartas: marca se estão trancadas e se têm texto (sem mandar o texto das trancadas).
create or replace function public.cartas_para_o_site(cartas jsonb, mostrar_tudo boolean)
returns jsonb
language sql stable
as $$
  select coalesce(jsonb_agg(
           case
             when not mostrar_tudo
              and coalesce(nullif(c ->> 'libera_em', '')::date > (now() at time zone 'America/Sao_Paulo')::date, false)
             then (c - 'texto') || jsonb_build_object(
                    'trancada', true,
                    'tem_texto', char_length(trim(coalesce(c ->> 'texto', ''))) > 0)
             else c || jsonb_build_object(
                    'trancada', coalesce(nullif(c ->> 'libera_em', '')::date > (now() at time zone 'America/Sao_Paulo')::date, false),
                    'tem_texto', char_length(trim(coalesce(c ->> 'texto', ''))) > 0)
           end
         ), '[]'::jsonb)
    from jsonb_array_elements(coalesce(cartas, '[]'::jsonb)) as c;
$$;


-- ---------------------------------------------------------------------
-- 4. Site dela: conteúdo publicado (agora com o resumo do presente)
-- ---------------------------------------------------------------------
create or replace function public.obter_conteudo()
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  dados    jsonb;
  presente jsonb;
  aberto   boolean;
begin
  if not public.pode_ver() then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;

  -- Enquanto nada foi publicado ainda, usa o rascunho (evita site vazio).
  select case when publicado is null or publicado = '{}'::jsonb then rascunho else publicado end
    into dados
    from public.conteudo where id = 1;

  select case when publicado is null or publicado = '{}'::jsonb then rascunho else publicado end,
         aberto_em is not null
    into presente, aberto
    from public.presente where id = 1;

  return coalesce(dados, '{}'::jsonb) || jsonb_build_object(
    'cartas', public.cartas_para_o_site(dados -> 'cartas', false),
    'presente_tem', public.presente_resumo(presente),
    'presente_aberto', coalesce(aberto, false)
  );
end;
$$;

revoke execute on function public.obter_conteudo() from public, anon;
grant execute on function public.obter_conteudo() to authenticated;


-- ---------------------------------------------------------------------
-- 5. Pré-visualização (só admin): rascunho completo
-- ---------------------------------------------------------------------
create or replace function public.obter_previa()
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  dados    jsonb;
  presente jsonb;
begin
  if not public.eh_admin() then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;

  select rascunho into dados from public.conteudo where id = 1;
  select rascunho into presente from public.presente where id = 1;

  -- Na prévia as cartas aparecem todas (com a marcação de trancada).
  return coalesce(dados, '{}'::jsonb) || jsonb_build_object(
    'cartas', public.cartas_para_o_site(dados -> 'cartas', true),
    'presente_tem', public.presente_resumo(presente),
    'presente_aberto', false
  );
end;
$$;

-- Prévia: o presente do RASCUNHO (não marca como aberto).
create or replace function public.previa_presente()
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
  select rascunho into dados from public.presente where id = 1;
  return coalesce(dados, '{}'::jsonb);
end;
$$;

-- Site dela: abre a caixa. Antes de publicar, usa o rascunho (igual ao conteúdo).
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

  select case when publicado is null or publicado = '{}'::jsonb then rascunho else publicado end
    into dados
    from public.presente where id = 1;
  return coalesce(dados, '{}'::jsonb);
end;
$$;

revoke execute on function
  public.obter_previa(), public.previa_presente(), public.abrir_presente(),
  public.presente_resumo(jsonb), public.cartas_para_o_site(jsonb, boolean),
  public.lista_marcar_autor()
  from public, anon;

grant execute on function
  public.obter_previa(), public.previa_presente(), public.abrir_presente()
  to authenticated;

-- Fim. Se aparecer "Success. No rows returned", deu tudo certo.
