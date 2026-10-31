// =====================================================================
// Nós, em Todos os Instantes · sw.js
// O que faz o Android tratar o site como app.
//
// Sempre busca a versão mais nova na internet (assim cada "git push"
// chega sozinho no app dela). Só usa o que está guardado quando está
// sem internet: aí mostra a tela "sem internet" em vez de um erro feio.
// Não mexe em nada do Supabase (fotos, áudios, cartas): isso passa direto.
// =====================================================================

const VERSAO = "nossos-instantes-v3";
const ESSENCIAIS = [
  "./offline.html",
  "./css/base.css",
  "./icones/icone-192.png",
  "./icones/favicon-48.png",
  "./manifest.webmanifest",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(VERSAO).then((cache) => cache.addAll(ESSENCIAIS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  if (pedido.method !== "GET") return;
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return;   // Supabase, fontes etc.: direto

  // Abrir uma página: internet primeiro; sem internet, a tela "sem internet".
  if (pedido.mode === "navigate") {
    evento.respondWith(
      fetch(pedido.url, { cache: "no-cache", credentials: "same-origin" })
        // Endereço que redireciona (ex.: /painel → /painel/): o Chrome não
        // aceita a resposta redirecionada direto, então manda ir para o novo.
        .then((resposta) => (resposta.redirected ? Response.redirect(resposta.url, 302) : resposta))
        .catch(() =>
        caches.match("./offline.html").then((r) => r || new Response("Sem internet.", { status: 503 }))
      )
    );
    return;
  }

  // Arquivos do site: internet primeiro, sempre conferindo se mudou
  // (assim o app nunca fica com versão velha); sem internet, a cópia.
  evento.respondWith(
    fetch(pedido, { cache: "no-cache" })
      .then((resposta) => {
        if (resposta && resposta.ok && resposta.type === "basic") {
          const copia = resposta.clone();
          caches.open(VERSAO).then((cache) => cache.put(pedido, copia)).catch(() => {});
        }
        return resposta;
      })
      .catch(() => caches.match(pedido).then((r) => r || Response.error()))
  );
});
