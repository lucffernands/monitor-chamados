const puppeteer = require("puppeteer");
const { login, obterChamados } = require("./login");
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

    // --- Forçar a URL do filtro de incidentes ---
    await page.goto(
      "https://servicos.viracopos.com/WOListView.do?viewID=6902&globalViewName=All_Requests",
      { waitUntil: "networkidle2", timeout: 120000 }
    );

    // --- Extrair chamados ---
    const chamados = await obterChamados(page);
    console.log(`✅ Chamados extraídos: ${chamados.length}`);

    for (const chamado of chamados) {
      console.log(`🔎 Verificando chamado ${chamado.id}...`);

      // --- Abre o chamado no detalhe ---
      await page.goto(
        `https://servicos.viracopos.com/WorkOrder.do?woMode=viewWO&woID=${chamado.id}&PORTALID=1`,
        { waitUntil: "networkidle2", timeout: 120000 }
      );

      const conteudoChamado = await page.evaluate(() => document.body.innerText);

      // --- Verifica se contém o formulário esperado ---
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
