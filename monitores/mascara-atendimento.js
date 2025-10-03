const fs = require("fs");
const axios = require("axios");
const puppeteer = require("puppeteer-core");

// === CONFIGURAÇÕES ===
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const USERNAME = process.env.PORTAL_USER;
const PASSWORD = process.env.PORTAL_PASS;

const COOKIES_FILE = "cookies.json";
const CHAMADOS_FILE = "chamados.json";
const URL_BASE = "https://servicos.viracopos.com/";

(async () => {
  console.log("🔎 Verificando e-mails nos incidentes (monitor-mascara)...");

  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
    headless: true,
  });

  const page = await browser.newPage();

  // ===== LOGIN =====
  console.log("🌐 Abrindo página inicial...");
  await page.goto(URL_BASE, { waitUntil: "networkidle2" });

  // botão SAML
  await page.click("#ssoBtn");
  console.log("✅ Botão SAML clicado");

  // login microsoft
  await page.waitForSelector("input[type='email']");
  console.log("🌐 Página de login Microsoft detectada");

  await page.type("input[type='email']", USERNAME);
  await page.click("input[type='submit']");
  await page.waitForTimeout(1500);

  await page.type("input[type='password']", PASSWORD);
  await page.click("input[type='submit']");
  console.log("✅ Usuário e senha enviados");

  // espera redirecionamento
  await page.waitForNavigation({ waitUntil: "networkidle2" });
  console.log(`✅ Redirecionado após login Microsoft: ${page.url()}`);

  // ===== LISTA DE CHAMADOS =====
  const urlChamados =
    "https://servicos.viracopos.com/WOListView.do?viewID=6902&globalViewName=All_Requests";
  await page.goto(urlChamados, { waitUntil: "networkidle2" });
  console.log(`✅ Lista de chamados carregada: ${urlChamados}`);

  await page.waitForSelector("table");
  console.log("✅ Tabela de chamados encontrada");

  const chamados = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("table tbody tr"));
    return rows
      .map((row) => {
        const cols = row.querySelectorAll("td");
        if (cols.length > 0) {
          return {
            id: cols[0].innerText.trim(),
            titulo: cols[1].innerText.trim(),
            link: cols[1].querySelector("a")?.href,
          };
        }
        return null;
      })
      .filter(Boolean);
  });

  console.log(`✅ Chamados extraídos: ${chamados.length}`);

  // ===== CARREGAR CHAMADOS EXISTENTES =====
  let chamadosExistentes = [];
  if (fs.existsSync(CHAMADOS_FILE)) {
    chamadosExistentes = JSON.parse(fs.readFileSync(CHAMADOS_FILE, "utf-8"));
  }

  const novosChamados = [];

  for (const chamado of chamados) {
    const jaExiste = chamadosExistentes.some((c) => c.id === chamado.id);
    if (jaExiste) continue;

    // acessa detalhe do chamado
    await page.goto(chamado.link, { waitUntil: "networkidle2" });

    // expande todas as conversas
    try {
      const headers = await page.$$(".zcollapsiblepanel__header");
      for (const header of headers) {
        const isExpanded = await header.evaluate(
          (el) => el.getAttribute("aria-expanded") === "true"
        );
        if (!isExpanded) {
          await header.click();
          await page.waitForTimeout(500);
        }
      }
      console.log(`📝 Todas as conversas expandidas no chamado ${chamado.id}`);
    } catch {
      console.log(
        `ℹ️ Não foi possível expandir todas as conversas no chamado ${chamado.id}`
      );
    }

    // === VERIFICAÇÃO DO FORMULÁRIO DE MÁSCARA (AJUSTADA) ===
    const targetNormalized = "nos responda com as seguintes informacoes";
    await page.waitForTimeout(1000);

    const frames = page.frames();
    let contemMascara = false;
    const framesChecked = [];

    for (const frame of frames) {
      try {
        await frame.waitForSelector(
          "z-cpcontent, .zcollapsiblepanel__content, .req-des, .panel-body, span.size",
          { timeout: 1200 }
        );
      } catch (e) {
        // não achou seletor a tempo
      }

      try {
        const text = await frame.evaluate(() => {
          const sel = Array.from(
            document.querySelectorAll(
              "z-cpcontent, .zcollapsiblepanel__content, .req-des, .panel-body, span.size"
            )
          );
          const raw = sel
            .map((el) => el.innerText || el.textContent || "")
            .join(" ");
          return raw
            .replace(/\s+/g, " ")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
        });

        framesChecked.push({ url: frame.url(), snippet: text.slice(0, 200) });

        if (text.includes(targetNormalized)) {
          contemMascara = true;
          break;
        }
      } catch (e) {
        framesChecked.push({ url: frame.url(), error: e.message });
        continue;
      }
    }

    if (!contemMascara) {
      console.log(
        `⚠️ Chamado ${chamado.id} sem formulário de máscara — frames verificados:`
      );
      framesChecked.forEach((f, i) => {
        if (f.error) {
          console.log(`  [${i}] ${f.url} (error: ${f.error})`);
        } else {
          console.log(
            `  [${i}] ${f.url} (snippet: ${f.snippet.replace(/\n/g, " ")})`
          );
        }
      });

      // envia alerta telegram
      await axios.post(
        `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
        {
          chat_id: TELEGRAM_CHAT_ID,
          text: `⚠️ Chamado *${chamado.id}* sem formulário de máscara\n\n*${chamado.titulo}*`,
          parse_mode: "Markdown",
        }
      );
    }

    novosChamados.push(chamado);
  }

  // salva chamados atualizados
  fs.writeFileSync(
    CHAMADOS_FILE,
    JSON.stringify([...chamadosExistentes, ...novosChamados], null, 2)
  );

  await browser.close();
})();
