// =====================================================================
// Entre Mil Instantes · config.js
// Os dados de conexão com o Supabase.
//
// Pode ficar no GitHub sem problema: a chave publicável (sb_publishable_…)
// é feita para ficar no site. Quem protege os dados são as regras do banco.
//
// NUNCA coloque aqui a chave secreta (sb_secret_…) nem senhas.
// =====================================================================

export const CONFIG = {
    // Supabase → Project Settings → Data API → Project URL
    SUPABASE_URL: "https://mhkrmxdlledtmfyoxkpt.supabase.co",

    // Supabase → Project Settings → API Keys → Publishable key (começa com sb_publishable_)
    SUPABASE_CHAVE_PUBLICA: "sb_publishable_mkffxvirrDO6od33LGuAaQ_pOjVyDHx",

    // E-mail da conta dela, criada por ti no Supabase (ela nunca vê isso).
    EMAIL_CONVIDADA: "amor@teamo.com",

    // Fuso usado para datas e para a contagem.
    FUSO: "America/Sao_Paulo",
};

// Diz se o config.js já foi preenchido.
export function configPreenchido() {
    return (
        CONFIG.SUPABASE_URL.startsWith("https://") &&
        CONFIG.SUPABASE_CHAVE_PUBLICA.length > 20 &&
        !CONFIG.SUPABASE_CHAVE_PUBLICA.startsWith("COLE_AQUI")
    );
}