const puppeteer = require("puppeteer");
const { login } = require("./login");
const { enviarMensagem } = require("./telegram");
const { obterChamadosPorUrl } = require("./obterChamados");

const URL_INCIDENTES = "https://servicos.viracopos.com/WOListView.do?viewID=6902&globalViewName=All_Requests";

async function monitorarMascaraIncidentes() {
  console.log("😷 Verificando incidentes de máscara...");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  try {
    await login(page, process.env.MS_USER, process.env.MS_PASS);

    const todosChamados = await obterChamadosPorUrl(page, URL_INCIDENTES);
    console.log(`✅ Chamados extraídos (máscara): ${todosChamados.length}`);

    for (const chamado of todosChamados) {
      console.log(`🔎 Verificando chamado ${chamado.id}...`);

      await page.goto(
        `https://servicos.viracopos.com/WorkOrder.do?woMode=viewWO&woID=${chamado.id}`,
        { waitUntil: "networkidle2" }
      );

      const conteudoChamado = await page.evaluate(() => document.body.innerText);

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
