const puppeteer = require("puppeteer");
const { login, extrairChamados } = require("./login");
const { enviarMensagem } = require("./telegram");

(async () => {
  console.log("🔎 Verificando chamados SLA (monitor-sla)...");

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  try {
    // 1. Login
    await login(page, process.env.MS_USER, process.env.MS_PASS);

    // 2. Abrir a URL fixa do filtro SLA
    const urlFiltro =
      "https://servicos.viracopos.com/WOListView.do?viewID=6901&globalViewName=All_Requests"; // <-- ajuste esse viewID para o filtro SLA
    await page.goto(urlFiltro, { waitUntil: "networkidle2", timeout: 120000 });
    console.log("✅ Lista de chamados carregada:", urlFiltro);

    // 3. Esperar a tabela e extrair chamados
    await page.waitForSelector("#requests_list_body", { timeout: 60000 });
    console.log("✅ Tabela de chamados encontrada");

    const chamados = await extrairChamados(page);
    console.log("✅ Chamados extraídos:", chamados.length);

    // 4. Validação SLA
    for (const chamado of chamados) {
      console.log(`🔎 Validando SLA do chamado ${chamado.id}...`);

      // Exemplo de regra: alerta se SLA estiver vazio ou vencido
      if (!chamado.sla || chamado.sla.includes("Vencido")) {
        const texto = `🚨 SLA crítico!\n🆔 ID: ${chamado.id}\n📌 Assunto: ${chamado.assunto}\n⚠️ Status: ${chamado.status}\n⏰ SLA: ${chamado.sla}`;
        await enviarMensagem(texto);
        console.log(`📢 Alerta enviado para Telegram: ${chamado.id}`);
      } else {
        console.log(`✅ Chamado ${chamado.id} dentro do SLA: ${chamado.sla}`);
      }
    }
  } catch (err) {
    console.error("❌ Erro no monitor-sla:", err.message);
    await enviarMensagem(`❌ Erro no monitor-sla: ${err.message}`);
  } finally {
    await browser.close();
  }
})();
