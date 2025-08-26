const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const { login, obterChamados } = require("./login");
const { enviarMensagem } = require("./telegram");

const CAMINHO_JSON = path.join(__dirname, "..", "chamados.json");

async function monitorarChamados() {
  console.log("🔎 Verificando chamados...");

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // --- Login ---
    await login(page, process.env.USUARIO, process.env.SENHA);

    // --- Extrair chamados ---
    const todosChamados = await obterChamados(page);
    console.log("✅ Chamados extraídos:", todosChamados.length);

    // --- Data de hoje ---
    const hoje = new Date().toISOString().slice(0, 10);

    // --- Registro salvo ---
    let registro = {};
    if (fs.existsSync(CAMINHO_JSON)) {
      registro = JSON.parse(fs.readFileSync(CAMINHO_JSON, "utf8"));
    }
    if (!registro[hoje]) registro[hoje] = [];

    // --- Novos chamados ---
    const novosChamados = todosChamados.filter(
      (c) => !registro[hoje].includes(c.id)
    );

    if (novosChamados.length > 0) {
      const mensagem =
        registro[hoje].length === 0
          ? "*Chamados existentes hoje:*\n\n"
          : "*Novos chamados:*\n\n";

      let texto = mensagem;
      novosChamados.forEach((c) => {
        texto += `🆔 ID: ${c.id}\n📌 Assunto: ${c.assunto}\n⏰ Vencimento: ${c.vencimento}\n\n`;
        registro[hoje].push(c.id);
      });

      await enviarMensagem(texto);
      console.log(`📢 ${novosChamados.length} chamados enviados para Telegram!`);

      fs.writeFileSync(CAMINHO_JSON, JSON.stringify(registro, null, 2));
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
