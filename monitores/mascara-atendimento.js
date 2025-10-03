const puppeteer = require("puppeteer");
const { login, obterChamados } = require("./login");
const { enviarMensagem } = require("./telegram");

(async () => {
  console.log("🔎 Verificando e-mails nos incidentes (monitor-mascara)...");

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  try {
    await login(page, process.env.MS_USER, process.env.MS_PASS);

    const urlFiltro =
      "https://servicos.viracopos.com/WOListView.do?viewID=6902&globalViewName=All_Requests";
    await page.goto(urlFiltro, { waitUntil: "networkidle2", timeout: 120000 });
    console.log("✅ Lista de chamados carregada:", urlFiltro);

    await page.waitForSelector("#requests_list_body", { timeout: 60000 });
    console.log("✅ Tabela de chamados encontrada");

    const chamados = await obterChamados(page);

    if (chamados.length === 0) {
      console.log("ℹ️ Nenhum chamado encontrado no filtro. Encerrando monitor...");
      return;
    }

    console.log("✅ Chamados extraídos:", chamados.length);

    let chamadosSemMascara = [];

    // trecho do formulário
    const regexFormulario = /nos responda com as seguintes informaç(ões|oes)/i;

    for (const chamado of chamados) {
      const urlChamado = `https://servicos.viracopos.com/WorkOrder.do?woMode=viewWO&woID=${chamado.id}&PORTALID=1`;
      await page.goto(urlChamado, { waitUntil: "networkidle2", timeout: 120000 });

      try {
        await page.waitForSelector(".zcollapsiblepanel__header", { timeout: 5000 });
        await page.click(".zcollapsiblepanel__header");
        console.log(`📝 Conversas expandidas no chamado ${chamado.id}`);
        await page.waitForTimeout(1000);
      } catch (e) {
        console.log(`ℹ️ Não foi necessário expandir conversas no chamado ${chamado.id}`);
      }

      // 🔍 Log do texto capturado no body
      const dumpText = await page.evaluate(() => {
        return (document.body.innerText || "").replace(/\s+/g, " ").trim();
      });
      console.log(`🔍 Texto capturado no chamado ${chamado.id}:`);
      console.log(dumpText.slice(0, 500)); // só primeiros 500 chars para não poluir

      // 🔍 Log de iframes
      const frames = page.frames().map(f => f.url());
      console.log("🖼️ Iframes encontrados:", frames);

      // 🔎 Verificação no body principal (por enquanto)
      const contemMascara = await page.evaluate((regexSource) => {
        const texto = (document.body.innerText || "")
          .replace(/\s+/g, " ")
          .toLowerCase();
        const regex = new RegExp(regexSource, "i");
        return regex.test(texto);
      }, regexFormulario.source);

      if (!contemMascara) {
        console.log(`⚠️ Chamado ${chamado.id} sem formulário de máscara`);
        chamadosSemMascara.push(chamado.id);
      } else {
        console.log(`✅ Chamado ${chamado.id} contém formulário de máscara`);
      }
    }

    if (chamadosSemMascara.length > 0) {
      const lista = chamadosSemMascara.join(", ");
      const msg = `🚨 Chamados encontrados sem formulário de máscara: ${lista}`;
      console.log(msg);
      await enviarMensagem(msg);
    } else {
      console.log("✅ Todos os chamados possuem formulário de máscara!");
    }
  } catch (err) {
    console.error("❌ Erro no monitor-mascara:", err);
  } finally {
    await browser.close();
  }
})();
