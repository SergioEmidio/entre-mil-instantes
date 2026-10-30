# Entre Mil Instantes

Presente de aniversário digital, feito à mão.

- **Site:** HTML, CSS e JavaScript puro, publicado no GitHub Pages.
- **Dados, fotos e áudios:** Supabase (banco, login e armazenamento privados).

## Pastas

```
index.html            site dela
painel/index.html     painel do autor
css/base.css          cores, fontes e peças comuns
js/config.js          endereço do Supabase e chave publicável
js/supabase.js        conexão e funções de acesso
js/site/              telas do site
js/painel/            abas do painel
supabase/             scripts do banco
.github/workflows/    tarefa diária que mantém o Supabase ativo
```

## Banco (rodar no SQL Editor do Supabase, em ordem, uma vez cada)

1. `supabase/01_estrutura.sql`
2. `supabase/02_fase1.sql`
3. `supabase/03_fase1_conteudo.sql`
4. `supabase/04_fase2.sql`
5. `supabase/05_fase5.sql` (presente, cartas trancadas, lista dos 365 dias e recados)
6. `supabase/06_cartas.sql` (quando ela abre cada carta + voz nas cartas)

Todos podem rodar de novo sem quebrar nada.

## Rodar no computador

Abrir a pasta no VS Code e clicar em **Go Live** (extensão Live Server).

## Segurança

- A chave publicável fica no código de propósito: quem protege os dados são as regras do banco (RLS).
- Fotos, áudios, conteúdo e presente ficam privados no Supabase, não neste repositório.
- Nunca colocar a chave secreta, senhas ou fotos neste repositório.
