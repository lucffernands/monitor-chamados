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

    const regexFormulario = /nos responda com as seguintes informações/i;
    let chamadosSemMascara = [];

    for (const chamado of chamados) {
      const urlChamado = `https://servicos.viracopos.com/WorkOrder.do?woMode=viewWO&woID=${chamado.id}&PORTALID=1`;
      await page.goto(urlChamado, { waitUntil: "networkidle2", timeout: 120000 });

      // 🔽 Expande todas as abas de conversas
      try {
        const headers = await page.$$(".zcollapsiblepanel__header");
        for (const header of headers) {
          const isExpanded = await header.evaluate(el => el.getAttribute("aria-expanded") === "true");
          if (!isExpanded) {
            await header.click();
            await page.waitForTimeout(500); // aguarda renderizar conteúdo
          }
        }
        console.log(`📝 Todas as conversas expandidas no chamado ${chamado.id}`);
      } catch {
        console.log(`ℹ️ Não foi possível expandir todas as conversas no chamado ${chamado.id}`);
      }

      // 🔽 Varre todos os iframes para encontrar o formulário
      const frames = page.frames();
      let contemMascara = false;

      for (const frame of frames) {
        try {
          contemMascara = await frame.evaluate((regexSource) => {
            const contents = Array.from(document.querySelectorAll("z-cpcontent.zcollapsiblepanel__content"));
            let textoTotal = contents.map(c => c.innerText || "").join(" ").replace(/\s+/g, " ");
            return new RegExp(regexSource, "i").test(textoTotal);
          }, regexFormulario.source);

          if (contemMascara) break; // se encontrou, não precisa verificar mais frames
        } catch {
          // ignora frames inacessíveis
        }
      }

      if (!contemMascara) {
        console.log(`⚠️ Chamado ${chamado.id} sem formulário de máscara`);
        chamadosSemMascara.push(chamado.id);
      } else {
        console.log(`✅ Chamado ${chamado.id} contém formulário de máscara`);
      }
    }

    // 🚨 Envia alerta consolidado para Telegram
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
