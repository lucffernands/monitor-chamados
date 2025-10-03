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

    // URL fixa do filtro incidentes
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

    // frase exata do formulário (copiada do HTML)
    const fraseFormulario =
      "Para que possamos dar andamento na sua solicitação, por favor, nos responda com as seguintes informações:";

    for (const chamado of chamados) {
      const urlChamado = `https://servicos.viracopos.com/WorkOrder.do?woMode=viewWO&woID=${chamado.id}&PORTALID=1`;
      await page.goto(urlChamado, {
        waitUntil: "networkidle2",
        timeout: 120000,
      });

      // 🔽 Expande a aba de conversas, se existir
      try {
        await page.waitForSelector(".zcollapsiblepanel__header", {
          timeout: 5000,
        });
        await page.click(".zcollapsiblepanel__header");
        console.log(`📝 Conversas expandidas no chamado ${chamado.id}`);
        await page.waitForTimeout(1000);
      } catch (e) {
        console.log(
          `ℹ️ Não foi necessário expandir conversas no chamado ${chamado.id}`
        );
      }

      // ✅ Busca e loga todo o conteúdo dos spans.size
      const { contemMascara, spansLidos } = await page.evaluate((frase) => {
        const spans = Array.from(document.querySelectorAll("span.size"));
        const textos = spans.map((el) =>
          (el.innerText || "").replace(/\s+/g, " ").trim()
        );

        const achou = textos.some((txt) => txt.includes(frase));

        return { contemMascara: achou, spansLidos: textos };
      }, fraseFormulario);

      // log detalhado para debug
      console.log(`📄 Conteúdo encontrado nos spans do chamado ${chamado.id}:`);
      console.log(spansLidos);

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
