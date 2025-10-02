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

    // 🔎 Extração já deve filtrar solicitantes que não começam com "LD"
    const chamados = await obterChamados(page);

    if (chamados.length === 0) {
      console.log("ℹ️ Nenhum chamado encontrado no filtro. Encerrando monitor...");
      return; // finaliza sem erro
    }

    console.log("✅ Chamados extraídos:", chamados.length);

    // Lista para armazenar os que estão sem formulário
    let chamadosSemMascara = [];

    // frase exata (em minúsculas para comparação)
    const fraseFormulario = "para que possamos dar andamento na sua solicitação, por favor, nos responda com as seguintes informações:";

    for (const chamado of chamados) {
      const urlChamado = `https://servicos.viracopos.com/WorkOrder.do?woMode=viewWO&woID=${chamado.id}&PORTALID=1`;
      await page.goto(urlChamado, { waitUntil: "networkidle2", timeout: 120000 });

      // 🔽 Expande a aba de conversas, se existir
      try {
        await page.waitForSelector(".zcollapsiblepanel__header", { timeout: 5000 });
        await page.click(".zcollapsiblepanel__header");
        console.log(`📝 Conversas expandidas no chamado ${chamado.id}`);
        await page.waitForTimeout(800); // aguarda render
      } catch (e) {
        console.log(`ℹ️ Não foi necessário expandir conversas no chamado ${chamado.id}`);
      }

      // Validação robusta: procura dentro dos blocos de conversa, faz fallback para body e iframes same-origin
      const contemMascara = await page.evaluate((frase) => {
        const normalize = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
        const target = normalize(frase);

        // 1) verifica blocos de conversa específicos
        const convEls = Array.from(document.querySelectorAll("#conversation-holder .req-des"));
        if (convEls.length > 0) {
          for (const el of convEls) {
            const txt = normalize(el.innerText);
            if (txt.includes(target)) return true;
          }
        }

        // 2) fallback para todo o body
        const bodyTxt = normalize(document.body && document.body.innerText);
        if (bodyTxt && bodyTxt.includes(target)) return true;

        // 3) checa iframes same-origin (ignora cross-origin)
        const iframes = Array.from(document.querySelectorAll("iframe"));
        for (const iframe of iframes) {
          try {
            const doc = iframe.contentDocument;
            if (doc && doc.body) {
              const ftxt = normalize(doc.body.innerText);
              if (ftxt.includes(target)) return true;
            }
          } catch (e) {
            // iframe cross-origin -> não acessível, ignora
          }
        }

        return false;
      }, fraseFormulario);

      if (!contemMascara) {
        console.log(`⚠️ Chamado ${chamado.id} sem formulário de máscara`);
        chamadosSemMascara.push(chamado.id);
      } else {
        console.log(`✅ Chamado ${chamado.id} contém formulário de máscara`);
      }
    }

    // 🚨 Envia alerta consolidado (um único por workflow)
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
