const puppeteer = require("puppeteer");

async function login(page, usuario, senha) {
  console.log("🌐 Abrindo página inicial...");
  await page.goto("https://servicos.viracopos.com/", {
    waitUntil: "networkidle2",
    timeout: 120000,
  });

  // botão SAML
  await page.waitForSelector("#saml_login", { timeout: 60000 });
  await page.click("#saml_login");
  console.log("✅ Botão SAML clicado");

  // login MS
  await page.waitForSelector("input[type='email']", { timeout: 60000 });
  console.log("🌐 Página de login Microsoft detectada");

  await page.type("input[type='email']", usuario);
  console.log("✅ Usuário digitado");
  await page.keyboard.press("Enter");

  await page.waitForSelector("input[type='password']", { timeout: 60000 });
  await page.type("input[type='password']", senha);
  console.log("✅ Senha digitada");
  await page.keyboard.press("Enter");

  // aguarda redirecionar
  await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 120000 });
  console.log("✅ Login Microsoft enviado");

  await page.waitForSelector("#tabHome", { timeout: 60000 });
  console.log("✅ Redirecionado após login Microsoft: " + page.url());
}

// função para extrair a tabela de chamados
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

module.exports = { login, extrairChamados };0
