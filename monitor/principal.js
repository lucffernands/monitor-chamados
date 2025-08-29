const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const { login, obterChamados } = require("./login");
const { enviarMensagem } = require("./telegram");

// Função para traduzir SLA
function traduzirSLA(sla) {
  if (!sla) return "-";
  return sla
    .replace("On due", "No prazo")
    .replace("Due in", "Vence em")
    .replace("Overdue", "Vencido");
}

const CAMINHO_JSON = path.join(__dirname, "..", "chamados.json");

async function monitorarChamados() {
  console.log("🔎 Verificando chamados...");

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
    console.log(`✅ Chamados extraídos: ${todosChamados.length}`);

    // --- Identifica a data de hoje ---
    const hoje = new Date().toISOString().slice(0, 10);

    // --- Lê ou cria o registro JSON ---
    let registro = {};
    if (fs.existsSync(CAMINHO_JSON)) {
      try {
        registro = JSON.parse(fs.readFileSync(CAMINHO_JSON, "utf8"));
      } catch {
        console.warn("⚠️ Erro lendo chamados.json, recriando...");
        registro = {};
      }
    }

    // --- 🔥 Limpeza automática: mantém só os últimos 3 meses ---
    const tresMesesAtras = new Date();
    tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3);

    for (const data in registro) {
      const dataObj = new Date(data);
      if (dataObj < tresMesesAtras) {
        delete registro[data];
      }
    }

    // --- Se não existir a chave de hoje, cria ---
    if (!registro[hoje]) registro[hoje] = [];

    // --- Filtra apenas os novos chamados do dia ---
    const novosChamados = todosChamados.filter((c) => {
      const idNormalizado = c.id.trim();
      return !registro[hoje].includes(idNormalizado);
    });

    if (novosChamados.length > 0) {
      const mensagem =
        registro[hoje].length === 0
          ? "🌐 Chamados existentes hoje:\n\n"
          : "🔴 Novos chamados:\n\n";

      let texto = mensagem;

      // Adiciona ao texto e registra ID para não repetir
      novosChamados.forEach((c) => {
        const idNormalizado = c.id.trim();
        texto += `🆔 ID: ${idNormalizado}\n📌 Assunto: ${c.assunto}\n⚠️ Estado: ${c.status}\n⏰ SLA: ${traduzirSLA(c.sla)}\n----------\n`;
        registro[hoje].push(idNormalizado);
      });

      // Salva atualização no JSON
      fs.writeFileSync(CAMINHO_JSON, JSON.stringify(registro, null, 2));

      await enviarMensagem(texto);
      console.log(`📢 ${novosChamados.length} chamados enviados para Telegram!`);
    } else {
      console.log("✅ Nenhum chamado novo hoje.");
    }

  } catch (err) {
    console.error("❌ Erro no monitor:", err.message);
    await enviarMensagem(`❌ Erro no monitor: ${err.message}`);
  } finally {
    await browser.close();
  }
}

// Para rodar isolado
if (require.main === module) {
  monitorarChamados();
}

module.exports = { monitorarChamados };
