const puppeteer = require("puppeteer");
const { login, obterChamadosPorUrl } = require("./login");
const { enviarMensagem } = require("./telegram");

function traduzirSLA(sla) {
  if (!sla) return "-";
  return sla
    .replace("Due in", "Vence em")
    .replace("On due", "No prazo")
    .replace("Overdue", "Vencido");
}

const URL_SLA = "https://servicos.viracopos.com/WOListView.do?viewID=60&globalViewName=All_Requests";

async function monitorarSLA() {
  console.log("🔎 Verificando SLAs próximos do vencimento...");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  try {
    await login(page, process.env.MS_USER, process.env.MS_PASS);

    const todosChamados = await obterChamadosPorUrl(page, URL_SLA);

    const criticos = todosChamados.filter((c) => {
      if (!c.sla) return false;

      const matchMin = c.sla.match(/(\d+)m/);
      const matchHora = c.sla.match(/(\d+)h/);

      let minutos = null;
      if (matchMin) minutos = parseInt(matchMin[1], 10);
      if (matchHora) minutos = (parseInt(matchHora[1], 10) * 60) + (minutos || 0);

      if (minutos === null) return false;
      return minutos >= 1 && minutos <= 30;
    });

    if (criticos.length > 0) {
      let texto = "*⚠️ Chamados com SLA próximo do vencimento:*\n\n";
      for (const c of criticos) {
        texto += `🆔 ID: ${c.id}\n📌 Assunto: ${c.assunto}\n⚠️ Estado: ${c.status}\n⏰ SLA: ${traduzirSLA(c.sla)}\n\n`;
      }
      await enviarMensagem(texto);
      console.log(`📢 ${criticos.length} chamados críticos enviados para Telegram!`);
    } else {
      console.log("✅ Nenhum SLA próximo do vencimento.");
    }
  } catch (err) {
    console.error("❌ Erro no monitor SLA:", err.message);
    await enviarMensagem(`❌ Erro no monitor SLA: ${err.message}`);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  monitorarSLA();
}

module.exports = { monitorarSLA };
