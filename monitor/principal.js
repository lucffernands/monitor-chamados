const fs = require("fs");
const path = require("path");
const { obterChamados } = require("./login");
const { enviarMensagem } = require("./telegram");

const CAMINHO_JSON = path.join(__dirname, "..", "chamados.json");

async function monitorarChamados() {
  console.log("🔎 Verificando chamados...");

  // Obtém chamados do site
  const todosChamados = await obterChamados();

  // Identifica a data de hoje
  const hoje = new Date().toISOString().slice(0, 10);

  // Lê o arquivo de chamados, ou cria estrutura nova
  let registro = {};
  if (fs.existsSync(CAMINHO_JSON)) {
    registro = JSON.parse(fs.readFileSync(CAMINHO_JSON, "utf8"));
  }

  if (!registro[hoje]) registro[hoje] = [];

  // Filtra somente os novos chamados do dia
  const novosChamados = todosChamados.filter(
    c => !registro[hoje].includes(c.id)
  );

  if (novosChamados.length > 0) {
    // Se primeira vez do dia, envia todos existentes
    const mensagem = registro[hoje].length === 0
      ? "*Chamados existentes hoje:*\n\n"
      : "*Novos chamados:*\n\n";

    let texto = mensagem;
    novosChamados.forEach(c => {
      texto += `🆔 ID: ${c.id}\n📌 Assunto: ${c.assunto}\n⏰ Vencimento: ${c.vencimento}\n\n`;
      registro[hoje].push(c.id); // adiciona ao registro
    });

    await enviarMensagem(texto);
    console.log(`📢 ${novosChamados.length} chamados enviados para Telegram!`);

    // Atualiza o arquivo JSON
    fs.writeFileSync(CAMINHO_JSON, JSON.stringify(registro, null, 2));
  } else {
    console.log("✅ Nenhum chamado novo hoje.");
  }
}

// Para rodar isolado
if (require.main === module) {
  (async () => {
    try {
      await monitorarChamados();
    } catch (err) {
      console.error("❌ Erro no monitor:", err.message);
      await enviarMensagem(`❌ Erro no monitor: ${err.message}`);
    }
  })();
}

module.exports = { monitorarChamados };
