const puppeteer = require("puppeteer");
const { login, obterChamados } = require("./login");
const { enviarMensagem } = require("./telegram");

// mesma tradução usada no principal.js
function traduzirSLA(texto) {
  if (!texto) return "-";
  return texto
    .replace("Due in", "Vence em")
    .replace("On due", "No prazo")
    .replace("Overdue", "Vencido");
}

async function monitorarSLA() {
  console.log("🔎 Verificando SLAs próximos do vencimento...");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  try {
    // --- Login ---
    await login(page, process.env.MS_USER, process.env.MS_PASS);

    // --- Extrair chamados ---
    const todosChamados = await obterChamados(page);

    // --- Filtra os que têm SLA "Vence em Xm" ---
    const criticos = todosChamados.filter((c) => {
      if (!c.sla) return false;
      
      const match = c.sla.match(/(\d+)m/); // pega minutos
      if (!match) return false;
      
      const minutos = parseInt(match[1], 10);
      return minutos >= 1 && minutos <= 10;
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
