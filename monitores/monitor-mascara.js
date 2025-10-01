const puppeteer = require("puppeteer");
const { login } = require("./login");
const { enviarMensagem } = require("./telegram");

async function monitorarMascaraIncidentes() {
  console.log("🔎 Verificando e-mails nos incidentes (monitor-mascara)...");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  try {
    // --- Login ---
    await login(page, process.env.MS_USER, process.env.MS_PASS);

    // --- Força a URL do filtro de incidentes ---
    await page.goto(
      "https://servicos.viracopos.com/WOListView.do?viewID=6902&globalViewName=All_Requests",
      { waitUntil: "networkidle2" }
    );

    // Confirma se o filtro está correto
    const filtroAtivo = await page.$eval("#filter_name", el => el.innerText.trim());
    if (filtroAtivo !== "Incidentes") {
      throw new Error("⚠️ Não foi possível ativar o filtro 'Incidentes'");
    }
    console.log("✅ Filtro 'Incidentes' aplicado!");

    // --- Extrai os chamados da tabela ---
    const todosChamados = await page.$$eval("table tbody tr", rows =>
      rows.map(r => ({
        id: r.querySelector("td:nth-child(1)")?.innerText.trim(),
        assunto: r.querySelector("td:nth-child(2)")?.innerText.trim(),
        status: r.querySelector("td:nth-child(3)")?.innerText.trim(),
      }))
    );

    console.log(`✅ Chamados extraídos: ${todosChamados.length}`);

    // --- Valida cada chamado ---
    for (const chamado of todosChamados) {
      if (!chamado.id) continue; // ignora linhas inválidas

      console.log(`🔎 Verificando chamado ${chamado.id}...`);

      await page.goto(
        `https://servicos.viracopos.com/WorkOrder.do?woMode=viewWO&woID=${chamado.id}`,
        { waitUntil: "networkidle2" }
      );

      const conteudoChamado = await page.evaluate(() => document.body.innerHTML);

      const contemFormulario = conteudoChamado.includes(
        "Para que possamos dar andamento na sua solicitação, por favor, nos responda com as seguintes informações:"
      );

      if (!contemFormulario) {
        const texto = `🚨 Incidente sem e-mail padrão!\n🆔 ID: ${chamado.id}\n📌 Assunto: ${chamado.assunto}\n⚠️ Estado: ${chamado.status}`;
        await enviarMensagem(texto);
        console.log(`📢 Alerta enviado para Telegram: ${chamado.id}`);
      } else {
        console.log(`✅ Chamado ${chamado.id} contém o e-mail padrão.`);
      }
    }
  } catch (err) {
    console.error("❌ Erro no monitor-mascara:", err.message);
    await enviarMensagem(`❌ Erro no monitor-mascara: ${err.message}`);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  monitorarMascaraIncidentes();
}

module.exports = { monitorarMascaraIncidentes };
