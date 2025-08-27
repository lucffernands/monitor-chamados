const puppeteer = require("puppeteer");

async function login(page, usuario, senha) {
  console.log("🌐 Abrindo página inicial...");

  // Abre a página inicial
  await page.goto("https://servicos.viracopos.com", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  console.log("✅ Página inicial carregada:", page.url());

  // --- Clica no SAML (sempre presente) ---
  try {
    await page.waitForSelector("a.sign-saml", { timeout: 60000 });
    await page.click("a.sign-saml");
    console.log("✅ Botão SAML clicado");
  } catch (err) {
    console.warn("⚠️ Botão SAML não encontrado, continuando...");
  }

  // --- Espera redirecionar para Microsoft Login ou portal ESM ---
  await page.waitForTimeout(2000); // pequeno delay para carregar

  const urlAtual = page.url();

  // --- Caso apareça login Microsoft ---
  if (urlAtual.includes("login.microsoftonline.com")) {
    console.log("🌐 Página de login Microsoft detectada");

    try {
      await page.waitForSelector("input[name='loginfmt']", { timeout: 60000 });
      await page.type("input[name='loginfmt']", usuario);
      console.log("✅ Usuário digitado");

      await page.click("input[type='submit']");
      await page.waitForTimeout(2000); // aguarda avançar

      await page.waitForSelector("input[name='passwd']", { timeout: 60000 });
      await page.type("input[name='passwd']", senha);
      console.log("✅ Senha digitada");

      await page.click("input[type='submit']");
      console.log("✅ Login Microsoft enviado");

      // Aguarda redirecionar
      await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 120000 });
      console.log("✅ Redirecionado após login Microsoft:", page.url());
    } catch (err) {
      console.error("❌ Erro no login Microsoft:", err.message);
      await page.screenshot({ path: "debug_ms_login.png" });
    }
  } else {
    console.log("🌐 Sessão ativa ou portal direto:", urlAtual);
  }

  // --- Força ir para lista de chamados ---
  await page.goto("https://servicos.viracopos.com/WOListView.do", {
    waitUntil: "networkidle0",
    timeout: 120000,
  });
  console.log("✅ Lista de chamados carregada:", page.url());

  // --- Aguarda tabela de chamados ---
  try {
    await page.waitForSelector("#requests_list_body", { timeout: 60000 });
    console.log("✅ Tabela de chamados encontrada");
  } catch (err) {
    console.warn("⚠️ Tabela de chamados não encontrada, veja browser aberto.");
    await page.screenshot({ path: "debug_table.png" });
  }
}

/**
 * Extrai ID, Assunto e Vencimento da lista de chamados
 */
async function extrairChamados(page) {
  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll("#requests_list_body tr"))
      .map((row) => {
        const cols = row.querySelectorAll("td");
        if (cols.length) {
          return {
            id: cols[4]?.innerText.trim() || "",
            assunto: cols[8]?.innerText.trim() || "",
            vencimento: cols[cols.length - 3]?.innerText.trim() || "",
          };
        }
      })
      .filter(Boolean);
  });
}

module.exports = { login, obterChamados: extrairChamados };
