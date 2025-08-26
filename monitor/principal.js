const fs = require("fs");
const path = require("path");
const { obterChamados } = require("./login");
const { enviarMensagem } = require("./telegram");

const CAMINHO_JSON = path.join(__dirname, "..", "chamados.json");

async function monitorarChamados() {
  console.log("🔎 Verificando chamados...");

  // Obtém chamados do site
  const novosChamados = await obterChamados();

  // Lê chamados já registrados
  let chamadosAntigos = [];
  if (fs.existsSync(CAMINHO_JSON)) {
    chamadosAntigos = JSON.parse(fs.readFileSync(CAMINHO_JSON, "utf8"));
  }

  // Filtra chamados novos que ainda não foram vistos
  const chamadosNaoVistos = novosChamados.filter(
    novo => !chamadosAntigos.some(antigo => antigo.id === novo.id)
  );

  if (chamadosNaoVistos.length > 0) {
    console.log(`📢 ${chamadosNaoVistos.length} novos chamados encontrados!`);

    for (const chamado of chamadosNaoVistos) {
      const mensagem = `🆕 Novo chamado: <b>${chamado.id}</b>\n📌 ${chamado.titulo}`;
      await enviarMensagem(mensagem);
    }

    // Atualiza o JSON com todos os chamados
    fs.writeFileSync(CAMINHO_JSON, JSON.stringify(novosChamados, null, 2));
  } else {
    console.log("✅ Nenhum chamado novo.");
  }
}

// Para rodar isolado
if (require.main === module) {
  (async () => {
    try {
      await monitorarChamados();
    } catch (err) {
      console.error("❌ Erro no monitor:", err.message);
    }
  })();
}

module.exports = { monitorarChamados };
