const puppeteer = require("puppeteer");

async function login(page, usuario, senha) {
  console.log("🌐 Abrindo página inicial...");

  // Abre a página inicial
  await page.goto("https://servicos.viracopos.com", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  console.log("✅ Página inicial carregada:", page.url());

  // Debug: esperar manualmente caso o seletor não apareça
  try {
    await page.waitForSelector("#userName", { timeout: 60000 });
  } catch (err) {
    console.error("❌ Campo #userName não encontrado. URL atual:", page.url());
    console.log("💡 Você pode verificar manualmente no browser aberto.");
    await page.screenshot({ path: "debug_login.png" });
    await page.pause(); // pausa para você interagir manualmente
  }

  // --- Preenche usuário e senha ---
  if (await page.$("#userName")) {
    await page.type("#userName", usuario);
    console.log("✅ Usuário digitado");
  }

  if (await page.$("#password")) {
    await page.type("#password", senha);
    console.log("✅ Senha digitada");
  }

  // --- Clica no botão Entrar ---
  if (await page.$("button[type=submit]")) {
    await page.click("button[type=submit]");
    console.log("✅ Botão 'Entrar' clicado");
  }

  // --- Aguarda redirecionar ---
  try {
    await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 120000 });
    console.log("✅ Login realizado, URL:", page.url());
  } catch {
    console.warn("⚠️ Login pode não ter sido concluído, verifique manualmente.");
  }

  // --- Ir direto para lista de chamados ---
  await page.goto("https://servicos.viracopos.com/WOListView.do", {
    waitUntil: "networkidle0",
    timeout: 120000,
  });
  console.log("✅ Lista de chamados carregada:", page.url());

  // --- Aguarda tabela de chamados ---
  try {
    await page.waitForSelector("#requests_list_body", { timeout: 60000 });
    console.log("✅ Tabela de chamados encontrada");
  } catch {
    console.warn("⚠️ Tabela de chamados não encontrada, veja browser aberto.");
    await page.screenshot({ path: "debug_table.png" });
    await page.pause();
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
