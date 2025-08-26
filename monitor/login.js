const puppeteer = require("puppeteer");

async function login(page, usuario, senha) {
  console.log("🌐 Acessando página de login...");

  await page.goto("https://servicos.viracopos.com", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  // --- Preenche usuário ---
  await page.waitForSelector("#userName");
  await page.type("#userName", usuario);
  console.log("✅ Usuário digitado");

  // --- Preenche senha ---
  await page.waitForSelector("#password");
  await page.type("#password", senha);
  console.log("✅ Senha digitada");

  // --- Clica no botão Entrar ---
  await page.click("button[type=submit]");
  console.log("✅ Botão 'Entrar' clicado");

  // --- Aguarda redirecionar ---
  await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 60000 });
  console.log("✅ Login realizado, URL:", page.url());

  // --- Clica em Central de Serviços ---
  await page.waitForSelector("a[title='Central de Serviços de TI']", { timeout: 60000 });
  await page.click("a[title='Central de Serviços de TI']");
  console.log("✅ Central de Serviços clicada:", page.url());

  // --- Força ir direto para a lista de chamados ---
  await page.goto("https://servicos.viracopos.com/WOListView.do", {
    waitUntil: "networkidle0",
    timeout: 60000,
  });
  console.log("✅ Lista de chamados carregada:", page.url());

  // --- Aguarda tabela de chamados ---
  await page.waitForSelector("#requests_list_body", { timeout: 60000 });
  console.log("✅ Tabela de chamados encontrada");
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

module.exports = {
  login,
  extrairChamados,
};
