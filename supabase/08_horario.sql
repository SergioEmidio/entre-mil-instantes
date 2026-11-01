-- =====================================================================
-- Nós, em Todos os Instantes · Hora de abrir: 03/11/2026 às 19:55
-- (a hora em que ela nasceu). Rodar no Supabase: SQL Editor → New
-- query → colar tudo → Run. Pode rodar de novo sem problema.
-- =====================================================================

update public.configuracao
   set liberar_em = '2026-11-03 19:55:00-03'
 where id = 1;

-- Confere: tem que aparecer 2026-11-03 22:55:00+00 (que é 19:55 em Brasília).
select liberar_em from public.configuracao where id = 1;
