// =====================================================================
// Entre Mil Instantes · aba Retrospectiva
// Nomes, datas, abertura, nossa música, detalhes e antes e agora.
// =====================================================================

import { h, campo, bloco } from "../ui.js";
import { campoFoto } from "../campo-foto.js";
import { campoAudio } from "../campo-audio.js";
import { rascunho, alterar } from "../estado.js";

export function desenharRetrospectiva(area) {
  const r = rascunho();

  area.append(
    h("div", { class: "area-titulo" }, h("h2", null, "Retrospectiva")),
    h("p", { class: "area-intro" }, "Tudo aqui salva sozinho no rascunho. Ela só vê depois que tu publicares."),

    bloco(
      "Nomes",
      null,
      h(
        "div",
        { class: "campo-grupo--linha" },
        campo({ rotulo: "Nome dela", valor: r.nome, max: 30, aoMudar: (v) => alterar((d) => { d.nome = v; }) }),
        campo({ rotulo: "Teu nome", valor: r.autor, max: 30, aoMudar: (v) => alterar((d) => { d.autor = v; }) })
      )
    ),

    bloco(
      "Datas",
      "Os dias juntos e os meses de namoro são calculados sozinhos. A senha dela não muda por aqui: continua sendo a data em que vocês se conheceram.",
      h(
        "div",
        { class: "campo-grupo--linha" },
        campo({
          rotulo: "A gente se conheceu",
          tipo: "date",
          valor: r.datas.conhecemos,
          aoMudar: (v) => alterar((d) => { d.datas.conhecemos = v; }),
        }),
        campo({
          rotulo: "Começo do namoro",
          tipo: "date",
          valor: r.datas.namoro,
          aoMudar: (v) => alterar((d) => { d.datas.namoro = v; }),
        })
      )
    ),

    bloco(
      "Abertura",
      "Aparece embaixo do nome dela, logo depois do carregamento.",
      campo({
        rotulo: "Frase da abertura",
        valor: r.abertura.frase,
        multilinha: true,
        linhas: 2,
        max: 120,
        aoMudar: (v) => alterar((d) => { d.abertura.frase = v; }),
      })
    ),

    bloco(
      "Nossa música",
      "A música que mais tocou na história de vocês.",
      campoFoto({
        rotulo: "Capa (foto ou capa do álbum)",
        caminho: r.retrospectiva.musica.capa,
        pasta: "retrospectiva",
        aoMudar: (c) => alterar((d) => { d.retrospectiva.musica.capa = c; }),
      }),
      h(
        "div",
        { class: "campo-grupo--linha" },
        campo({
          rotulo: "Nome da música",
          valor: r.retrospectiva.musica.nome,
          max: 60,
          aoMudar: (v) => alterar((d) => { d.retrospectiva.musica.nome = v; }),
        }),
        campo({
          rotulo: "Artista",
          valor: r.retrospectiva.musica.artista,
          max: 60,
          aoMudar: (v) => alterar((d) => { d.retrospectiva.musica.artista = v; }),
        })
      ),
      campo({
        rotulo: "Por que ela é nossa",
        valor: r.retrospectiva.musica.frase,
        multilinha: true,
        linhas: 2,
        max: 140,
        aoMudar: (v) => alterar((d) => { d.retrospectiva.musica.frase = v; }),
      }),
      campoAudio({
        rotulo: "A música (toca no story)",
        dica: "Pode enviar a música inteira (MP3, M4A ou MP4). No story toca um trecho de até 30 segundos, a partir do segundo que escolheres abaixo.",
        caminho: r.retrospectiva.musica.audio,
        duracao: r.retrospectiva.musica.duracao,
        pasta: "musica",
        gravar: false,
        aoMudar: (c, d) =>
          alterar((x) => {
            x.retrospectiva.musica.audio = c;
            x.retrospectiva.musica.duracao = d;
          }),
      }),
      campo({
        rotulo: "Começar a música no segundo",
        tipo: "number",
        inputmode: "numeric",
        valor: String(r.retrospectiva.musica.inicio || 0),
        dica: "Ex.: 45 = começa em 0:45 (o refrão). Deixa 0 para começar do início.",
        aoMudar: (v) =>
          alterar((d) => {
            const n = Math.max(0, Math.floor(Number(v) || 0));
            d.retrospectiva.musica.inicio = n;
          }),
      })
    ),

    bloco(
      "Nossos detalhes",
      "As coisas que são só de vocês. Cada uma vira um story.",
      campo({
        rotulo: "Os apelidos que eu mais te chamo",
        valor: r.retrospectiva.apelido,
        max: 160,
        dica: "Separa com ponto e vírgula (;). Cada um vira uma etiqueta. Ex.: Meu neném; Minha carente",
        aoMudar: (v) => alterar((d) => { d.retrospectiva.apelido = v; }),
      }),
      campo({
        rotulo: "Nosso lugar favorito",
        valor: r.retrospectiva.lugar,
        max: 80,
        dica: "O que vier depois da vírgula vira o subtítulo. Ex.: Marco Zero, onde tudo começou",
        aoMudar: (v) => alterar((d) => { d.retrospectiva.lugar = v; }),
      }),
      campo({
        rotulo: "As frases que tu mais falas",
        valor: r.retrospectiva.frase_dela,
        max: 240,
        multilinha: true,
        linhas: 3,
        dica: "Separa com ponto e vírgula (;). Cada uma vira um balão de conversa. Ex.: PARA; Tu é MUITO CHATO",
        aoMudar: (v) => alterar((d) => { d.retrospectiva.frase_dela = v; }),
      })
    ),

    bloco(
      "Antes e agora",
      "Duas fotos que ela compara arrastando uma barrinha.",
      campoFoto({
        rotulo: "Foto do começo (2025)",
        caminho: r.antes_agora.antes,
        pasta: "antes-agora",
        alta: true,
        aoMudar: (c) => alterar((d) => { d.antes_agora.antes = c; }),
      }),
      campoFoto({
        rotulo: "Foto de agora",
        caminho: r.antes_agora.agora,
        pasta: "antes-agora",
        alta: true,
        aoMudar: (c) => alterar((d) => { d.antes_agora.agora = c; }),
      }),
      campo({
        rotulo: "Frase embaixo das fotos",
        valor: r.antes_agora.frase,
        multilinha: true,
        linhas: 2,
        max: 120,
        aoMudar: (v) => alterar((d) => { d.antes_agora.frase = v; }),
      })
    )
  );
}
