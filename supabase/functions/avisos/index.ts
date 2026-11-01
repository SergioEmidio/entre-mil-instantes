// =====================================================================
// Nós, em Todos os Instantes · Edge Function "avisos"
// Manda as notificações para o celular dela (Web Push).
//
// Roda de hora em hora (agendada no banco com pg_cron) e decide:
//   · música nova na Rádio            → "Música nova na Rádio"
//   · carta nova                      → "Chegou uma carta nova"
//   · carta trancada: faltam 30, 20, 10, 9, 8 … 1 dias → contagem
//   · carta trancada que abriu hoje   → "A carta … foi liberada, vem ler!"
// Cada aviso sai uma vez só (fica registrado em avisos_enviados).
// Contagem e "liberada" saem a partir das 9h (horário de Brasília).
//
// Também atende o botão "Enviar aviso de teste" do painel (só admin).
//
// Segredos (Supabase → Edge Functions → Secrets):
//   VAPID_PUBLICA, VAPID_PRIVADA, AVISOS_SEGREDO, (opcional) AVISOS_CONTATO
// O Supabase já fornece SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
// Este arquivo NÃO tem segredo nenhum (pode ficar no GitHub).
// =====================================================================

const HORA_DOS_AVISOS = 9;            // contagem e "liberada": a partir das 9h
const DIAS_QUE_AVISAM = [30, 20, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
const MAXIMO_POR_RODADA = 4;          // se juntar muita coisa, resume
const FUSO_HORAS = -3;                // Brasília (sem horário de verão)

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------
const codificador = new TextEncoder();

export function paraBase64Url(bytes) {
  let bin = "";
  const b = new Uint8Array(bytes);
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function deBase64Url(texto) {
  const t = String(texto).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(t + "===".slice((t.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function juntar(...partes) {
  const total = partes.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let i = 0;
  for (const p of partes) {
    out.set(p, i);
    i += p.length;
  }
  return out;
}

async function hmac(chave, dados) {
  const k = await crypto.subtle.importKey("raw", chave, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, dados));
}

// HKDF (RFC 5869) com SHA-256, saída de até 32 bytes
async function hkdf(sal, ikm, info, tamanho) {
  const prk = await hmac(sal, ikm);
  const t = await hmac(prk, juntar(info, new Uint8Array([1])));
  return t.slice(0, tamanho);
}

// ---------------------------------------------------------------------
// VAPID (RFC 8292): um JWT ES256 assinado com a nossa chave privada
// ---------------------------------------------------------------------
async function chavePrivadaVapid(publicaB64, privadaB64) {
  const pub = deBase64Url(publicaB64);
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: paraBase64Url(pub.slice(1, 33)),
    y: paraBase64Url(pub.slice(33, 65)),
    d: privadaB64,
    ext: true,
  };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

export async function cabecalhoVapid(endpoint, vapid, agoraSeg = Math.floor(Date.now() / 1000)) {
  const aud = new URL(endpoint).origin;
  const cab = paraBase64Url(codificador.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const corpo = paraBase64Url(
    codificador.encode(JSON.stringify({ aud, exp: agoraSeg + 12 * 3600, sub: vapid.contato || "mailto:avisos@nossos-instantes.app" }))
  );
  const chave = await chavePrivadaVapid(vapid.publica, vapid.privada);
  const assinatura = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, chave, codificador.encode(`${cab}.${corpo}`))
  );
  return `vapid t=${cab}.${corpo}.${paraBase64Url(assinatura)}, k=${vapid.publica}`;
}

// ---------------------------------------------------------------------
// Criptografia da mensagem (RFC 8291, "aes128gcm")
// ---------------------------------------------------------------------
export async function cifrarMensagem(texto, p256dhB64, authB64, opcoes = {}) {
  const uaPublica = deBase64Url(p256dhB64);
  const segredoAuth = deBase64Url(authB64);
  const par =
    opcoes.par ||
    (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]));
  const asPublica = new Uint8Array(await crypto.subtle.exportKey("raw", par.publicKey));
  const uaChave = await crypto.subtle.importKey("raw", uaPublica, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaChave }, par.privateKey, 256));

  const infoChave = juntar(codificador.encode("WebPush: info\0"), uaPublica, asPublica);
  const ikm = await hkdf(segredoAuth, ecdh, infoChave, 32);
  const sal = opcoes.sal || crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(sal, ikm, codificador.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(sal, ikm, codificador.encode("Content-Encoding: nonce\0"), 12);

  const claro = juntar(codificador.encode(texto), new Uint8Array([2]));
  const chaveAes = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, chaveAes, claro));

  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  return juntar(sal, rs, new Uint8Array([asPublica.length]), asPublica, cifrado);
}

// Manda uma notificação para uma inscrição. Devolve o status HTTP.
export async function enviarPush(inscricao, mensagem, vapid, buscar = fetch) {
  const corpo = await cifrarMensagem(JSON.stringify(mensagem), inscricao.p256dh, inscricao.auth);
  const resposta = await buscar(inscricao.endpoint, {
    method: "POST",
    headers: {
      Authorization: await cabecalhoVapid(inscricao.endpoint, vapid),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "high",
    },
    body: corpo,
  });
  return resposta.status;
}

// ---------------------------------------------------------------------
// O que avisar (pura: recebe tudo e devolve a lista)
// ---------------------------------------------------------------------
function hojeEmBrasilia(agora) {
  const t = new Date(agora.getTime() + FUSO_HORAS * 3600 * 1000);
  return { data: t.toISOString().slice(0, 10), hora: t.getUTCHours() };
}

function diasEntre(deISO, ateISO) {
  return Math.round((Date.parse(`${ateISO}T00:00:00Z`) - Date.parse(`${deISO}T00:00:00Z`)) / 86400000);
}

const limpo = (v) => (typeof v === "string" ? v.trim() : "");
const dataCurta = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function cartasValidas(conteudo) {
  const lista = conteudo && Array.isArray(conteudo.cartas) ? conteudo.cartas : [];
  return lista.filter((c) => c && c.id && limpo(c.titulo) && (limpo(c.texto) || c.audio));
}

function faixasValidas(conteudo) {
  const r = conteudo && conteudo.radio;
  const lista = r && Array.isArray(r.faixas) ? r.faixas : [];
  return lista.filter((f) => f && f.id && f.audio && limpo(f.titulo));
}

// Chaves de "coisa nova" (música/carta que apareceu no conteúdo)
export function chavesDeNovidade(conteudo) {
  return [
    ...faixasValidas(conteudo).map((f) => `musica:${f.id}`),
    ...cartasValidas(conteudo).map((c) => `carta-nova:${c.id}`),
  ];
}

// semear = true: só registra o que já existe, sem avisar (primeira vez,
// ou enquanto ninguém tinha ativado os avisos).
export function decidirAvisos({ conteudo, jaEnviados, agora, semear }) {
  const enviados = new Set(jaEnviados);
  const { data: hoje, hora } = hojeEmBrasilia(agora);
  const novos = [];        // { chave, msg }
  const registrar = [];    // chaves para guardar sem avisar

  // 1. Novidades
  const musicas = faixasValidas(conteudo).filter((f) => !enviados.has(`musica:${f.id}`));
  const cartasNovas = cartasValidas(conteudo).filter((c) => !enviados.has(`carta-nova:${c.id}`));
  if (semear) {
    registrar.push(...musicas.map((f) => `musica:${f.id}`), ...cartasNovas.map((c) => `carta-nova:${c.id}`));
  } else {
    if (musicas.length === 1) {
      const f = musicas[0];
      novos.push({
        chave: `musica:${f.id}`,
        msg: { titulo: "Música nova na Rádio", corpo: `«${limpo(f.titulo)}»${limpo(f.artista) ? ` · ${limpo(f.artista)}` : ""}. Vem ouvir.`, url: "./?ir=radio", tag: `musica-${f.id}` },
      });
    } else if (musicas.length > 1) {
      novos.push({
        chave: musicas.map((f) => `musica:${f.id}`),
        msg: { titulo: `${musicas.length} músicas novas na Rádio`, corpo: musicas.map((f) => `«${limpo(f.titulo)}»`).join(", "), url: "./?ir=radio", tag: "musicas" },
      });
    }
    for (const c of cartasNovas) {
      const trancada = c.libera_em && diasEntre(hoje, c.libera_em) > 0;
      novos.push({
        chave: `carta-nova:${c.id}`,
        msg: trancada
          ? { titulo: "Chegou uma carta nova", corpo: `«Abre quando ${limpo(c.titulo)}» fica guardada até ${dataCurta(c.libera_em)}.`, url: "./?ir=cartas", tag: `carta-${c.id}` }
          : { titulo: "Chegou uma carta nova", corpo: `«Abre quando ${limpo(c.titulo)}». Vem ler.`, url: "./?ir=cartas", tag: `carta-${c.id}` },
      });
    }
  }

  // 2. Cartas com data: contagem e "liberada" (a partir das 9h)
  if (hora >= HORA_DOS_AVISOS) {
    for (const c of cartasValidas(conteudo)) {
      if (!c.libera_em) continue;
      const faltam = diasEntre(hoje, c.libera_em);
      const titulo = `«Abre quando ${limpo(c.titulo)}»`;
      if (DIAS_QUE_AVISAM.includes(faltam)) {
        const chave = `contagem:${c.id}:${c.libera_em}:${faltam}`;
        if (enviados.has(chave)) continue;
        if (semear) {
          registrar.push(chave);
          continue;
        }
        novos.push({
          chave,
          msg: {
            titulo: faltam === 1 ? "Amanhã abre uma carta" : `Faltam ${faltam} dias para uma carta`,
            corpo: faltam === 1 ? `${titulo} abre amanhã.` : `${titulo} abre em ${dataCurta(c.libera_em)}.`,
            url: "./?ir=cartas",
            tag: `carta-${c.id}`,
          },
        });
      } else if (faltam === 0 || faltam === -1) {
        // abriu hoje (ou ontem, se o aviso de hoje se perdeu)
        const chave = `liberada:${c.id}:${c.libera_em}`;
        if (enviados.has(chave)) continue;
        if (semear) {
          registrar.push(chave);
          continue;
        }
        novos.push({
          chave,
          msg: { titulo: "Uma carta foi liberada 💌", corpo: `A carta ${titulo} foi liberada. Vem ler!`, url: "./?ir=cartas", tag: `carta-${c.id}` },
        });
      }
    }
  }

  // 3. Muita coisa de uma vez: um aviso só, resumido
  if (novos.length > MAXIMO_POR_RODADA) {
    const chaves = novos.flatMap((n) => (Array.isArray(n.chave) ? n.chave : [n.chave]));
    return {
      enviar: [{ chave: chaves, msg: { titulo: "Tem novidades no nosso cantinho", corpo: `${novos.length} coisas novas te esperando. Vem ver.`, url: "./", tag: "novidades" } }],
      registrar,
    };
  }
  return { enviar: novos, registrar };
}

// ---------------------------------------------------------------------
// Banco (PostgREST com a chave de serviço)
// ---------------------------------------------------------------------
function cabecalhosServico(chave) {
  const h = { apikey: chave, "Content-Type": "application/json" };
  if (chave.startsWith("eyJ")) h.Authorization = `Bearer ${chave}`;
  return h;
}

function criarBanco(url, chave, buscar = fetch) {
  const base = `${url}/rest/v1`;
  const h = cabecalhosServico(chave);
  async function pedir(caminho, opcoes = {}) {
    const r = await buscar(`${base}${caminho}`, { ...opcoes, headers: { ...h, ...(opcoes.headers || {}) } });
    if (!r.ok) throw new Error(`banco ${r.status}: ${await r.text()}`);
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  }
  return {
    conteudo: async () => {
      const l = await pedir("/conteudo?id=eq.1&select=publicado,rascunho");
      const linha = (l && l[0]) || {};
      return linha.publicado && Object.keys(linha.publicado).length ? linha.publicado : linha.rascunho || {};
    },
    liberarEm: async () => {
      const l = await pedir("/configuracao?id=eq.1&select=liberar_em");
      return l && l[0] ? new Date(l[0].liberar_em) : null;
    },
    inscricoes: () => pedir("/avisos_inscricoes?select=id,endpoint,p256dh,auth"),
    enviados: async () => ((await pedir("/avisos_enviados?select=chave")) || []).map((r) => r.chave),
    guardarEnviados: (chaves) =>
      chaves.length
        ? pedir("/avisos_enviados", {
            method: "POST",
            headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
            body: JSON.stringify(chaves.map((chave) => ({ chave }))),
          })
        : null,
    estado: async () => {
      const l = await pedir("/avisos_estado?id=eq.1&select=tinha_inscricao");
      return l && l[0] ? l[0] : null;
    },
    guardarEstado: (tinha) =>
      pedir("/avisos_estado", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ id: 1, tinha_inscricao: tinha, rodou_em: new Date().toISOString() }),
      }),
    marcarOk: (ids) =>
      ids.length
        ? pedir(`/avisos_inscricoes?id=in.(${ids.join(",")})`, {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ ultimo_ok: new Date().toISOString() }),
          })
        : null,
    apagarInscricao: (id) => pedir(`/avisos_inscricoes?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }),
  };
}

// Manda uma mensagem para todos os celulares inscritos.
async function mandarParaTodos(banco, inscricoes, msg, vapid, buscar) {
  let ok = 0;
  const okIds = [];
  for (const insc of inscricoes) {
    try {
      const status = await enviarPush(insc, msg, vapid, buscar);
      if (status === 404 || status === 410) {
        await banco.apagarInscricao(insc.id); // celular desinstalou / desligou
      } else if (status >= 200 && status < 300) {
        ok += 1;
        okIds.push(insc.id);
      } else {
        console.error("push recusado", status);
      }
    } catch (e) {
      console.error("push falhou", e);
    }
  }
  try {
    await banco.marcarOk(okIds);
  } catch {
    /* só uma anotação: tudo bem */
  }
  return ok;
}

// Uma rodada (chamada de hora em hora)
export async function rodar({ banco, vapid, agora = new Date(), buscar = fetch }) {
  const liberarEm = await banco.liberarEm();
  const inscricoes = (await banco.inscricoes()) || [];
  const estado = await banco.estado();
  // Antes do site abrir, ou se na rodada anterior ninguém tinha ativado:
  // só registra o que já existe (para não chegar um monte de "novidade" velha).
  const semear = !inscricoes.length || !estado || !estado.tinha_inscricao || (liberarEm && agora < liberarEm);
  const [conteudo, enviados] = await Promise.all([banco.conteudo(), banco.enviados()]);
  const { enviar, registrar } = decidirAvisos({ conteudo, jaEnviados: enviados, agora, semear });

  let entregues = 0;
  for (const item of enviar) {
    entregues += await mandarParaTodos(banco, inscricoes, item.msg, vapid, buscar);
    await banco.guardarEnviados(Array.isArray(item.chave) ? item.chave : [item.chave]);
  }
  await banco.guardarEnviados(registrar);
  await banco.guardarEstado(inscricoes.length > 0);
  return { semear, avisos: enviar.length, entregues, registrados: registrar.length, inscricoes: inscricoes.length };
}

// ---------------------------------------------------------------------
// Servidor (Supabase Edge Function)
// ---------------------------------------------------------------------
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-avisos-segredo",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(dados, status = 200) {
  return new Response(JSON.stringify(dados), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function variaveis() {
  const env = (n) => (typeof Deno !== "undefined" ? Deno.env.get(n) : undefined) || "";
  return {
    url: env("SUPABASE_URL"),
    // CHAVE_SECRETA (sb_secret_…) é opcional: só se o Supabase tiver desligado as chaves antigas
    chaveServico: env("CHAVE_SECRETA") || env("SUPABASE_SERVICE_ROLE_KEY"),
    chavePublica: "sb_publishable_mkffxvirrDO6od33LGuAaQ_pOjVyDHx",
    segredo: env("AVISOS_SEGREDO"),
    vapid: { publica: env("VAPID_PUBLICA"), privada: env("VAPID_PRIVADA"), contato: env("AVISOS_CONTATO") },
  };
}

// O pedido de teste vem do painel: confere se quem pediu é o admin.
async function ehAdmin(v, autorizacao) {
  if (!autorizacao || !autorizacao.startsWith("Bearer ")) return false;
  const r = await fetch(`${v.url}/rest/v1/rpc/meu_papel`, {
    method: "POST",
    headers: { apikey: v.chavePublica, Authorization: autorizacao, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!r.ok) return false;
  return (await r.json()) === "admin";
}

export async function atender(req) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "use POST" }, 405);
  const v = variaveis();
  if (!v.url || !v.chaveServico || !v.vapid.publica || !v.vapid.privada) {
    return json({ erro: "faltam_segredos" }, 500);
  }
  const banco = criarBanco(v.url, v.chaveServico);
  let pedido = {};
  try {
    pedido = await req.json();
  } catch {
    pedido = {};
  }

  try {
    if (pedido.modo === "teste") {
      if (!(await ehAdmin(v, req.headers.get("Authorization")))) return json({ erro: "sem_acesso" }, 403);
      const inscricoes = (await banco.inscricoes()) || [];
      const entregues = await mandarParaTodos(
        banco,
        inscricoes,
        { titulo: "Teste dos avisos ✓", corpo: "Se isto apareceu e vibrou, os avisos estão funcionando.", url: "./", tag: "teste" },
        v.vapid,
        fetch
      );
      return json({ inscricoes: inscricoes.length, entregues });
    }

    // Rodada agendada: precisa do segredo
    if (!v.segredo || req.headers.get("x-avisos-segredo") !== v.segredo) return json({ erro: "sem_acesso" }, 403);
    return json(await rodar({ banco, vapid: v.vapid }));
  } catch (e) {
    console.error(e);
    return json({ erro: String((e && e.message) || e) }, 500);
  }
}

if (typeof Deno !== "undefined" && Deno.serve) Deno.serve(atender);
