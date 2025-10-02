// monitores/login.js
const puppeteer = require("puppeteer");

async function login(page, usuario, senha) {
  console.log("🌐 Abrindo página inicial...");

  await page.goto("https://servicos.viracopos.com", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  console.log("✅ Página inicial carregada:", page.url());

  try {
    await page.waitForSelector("a.sign-saml", { timeout: 60000 });
    await page.click("a.sign-saml");
    console.log("✅ Botão SAML clicado");
  } catch (err) {
    console.warn("⚠️ Botão SAML não encontrado, continuando...");
  }

  await page.waitForTimeout(2000);

  const urlAtual = page.url();
  if (urlAtual.includes("login.microsoftonline.com")) {
    console.log("🌐 Página de login Microsoft detectada");

    try {
      await page.waitForSelector("input[name='loginfmt']", { timeout: 60000 });
      await page.type("input[name='loginfmt']", usuario);
      console.log("✅ Usuário digitado");

      await page.click("input[type='submit']");
      await page.waitForTimeout(2000);

      await page.waitForSelector("input[name='passwd']", { timeout: 60000 });
      await page.type("input[name='passwd']", senha);
      console.log("✅ Senha digitada");

      await page.click("input[type='submit']");
      console.log("✅ Login Microsoft enviado");

      await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 120000 });
      console.log("✅ Redirecionado após login Microsoft:", page.url());
    } catch (err) {
      console.error("❌ Erro no login Microsoft:", err.message);
      await page.screenshot({ path: "debug_ms_login.png" });
    }
  } else {
    console.log("🌐 Sessão ativa ou portal direto:", urlAtual);
  }

  console.log("✅ Login concluído - pronto para navegar para a view desejada.");
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
            sla: cols[6]?.innerText.trim() || "",
            status: cols[12]?.innerText.trim() || "",
            assunto: cols[8]?.innerText.trim() || "",
          };
        }
      })
      .filter(Boolean);
  });
}

module.exports = { login, extrairChamados };
