const puppeteer = require("puppeteer");

async function login(page, usuario, senha) {
  console.log("🌐 Abrindo página inicial...");

  await page.goto("https://servicos.viracopos.com", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  console.log("✅ Página inicial carregada:", page.url());

  // --- Clica em "SAML" ---
  try {
    await page.waitForSelector("a.sign-saml", { timeout: 60000 });
    await page.click("a.sign-saml");
    console.log("✅ Clicou em 'SAML'");
  } catch (err) {
    console.error("❌ Botão 'SAML' não encontrado. URL atual:", page.url());
    await page.screenshot({ path: "debug_saml.png" });
    return;
  }

  // --- Aguarda redirecionamento ---
  await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 60000 });
  console.log("➡️ Redirecionado para:", page.url());
  await page.screenshot({ path: "debug_after_saml.png" });

  // --- Caso 1: já autenticado e caiu no portal ESM ---
  if (page.url().includes("ESM.do")) {
    console.log("🔑 Fluxo: já autenticado / híbrido");
    await page.goto("https://servicos.viracopos.com/WOListView.do", {
      waitUntil: "networkidle0",
      timeout: 120000,
    });
  }

  // --- Caso 2: formulário de login visível ---
  else if (await page.$("#userName")) {
    console.log("🔑 Fluxo: login manual");
    try {
      await page.type("#userName", usuario);
      console.log("✅ Usuário digitado");

      await page.type("#password", senha);
      console.log("✅ Senha digitada");

      if (await page.$("button[type=submit]")) {
        await page.click("button[type=submit]");
        console.log("✅ Botão 'Entrar' clicado");
      }

      await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 120000 });
      console.log("✅ Login realizado, URL:", page.url());
      await page.screenshot({ path: "debug_after_login.png" });

      // Depois do login pode cair em ESM.do → forçamos ir para lista
      await page.goto("https://servicos.viracopos.com/WOListView.do", {
        waitUntil: "networkidle0",
        timeout: 120000,
      });
    } catch (err) {
      console.error("❌ Erro durante login:", err.message);
      await page.screenshot({ path: "debug_login_error.png" });
      return;
    }
  }

  console.log("✅ Lista de chamados carregada:", page.url());
  await page.screenshot({ path: "debug_chamados.png" });

  // --- Aguarda tabela de chamados ---
  try {
    await page.waitForSelector("#requests_list_body", { timeout: 60000 });
    console.log("✅ Tabela de chamados encontrada");
  } catch {
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
