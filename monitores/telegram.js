const axios = require('axios');

// Envia uma mensagem para o Telegram
async function enviarMensagem(texto) {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    throw new Error("⚠️ Configure TELEGRAM_TOKEN e TELEGRAM_CHAT_ID nos Secrets do GitHub");
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    await axios.post(url, {
      chat_id: chatId,
      text: texto,
      parse_mode: "HTML"
    });
    console.log("📩 Mensagem enviada:");
  } catch (err) {
    console.error("❌ Erro ao enviar mensagem para o Telegram:", err.message);
  }
}

module.exports = { enviarMensagem };

// Teste rápido se rodar isolado
if (require.main === module) {
  (async () => {
    await enviarMensagem("🚀 Teste de mensagem do monitor de chamados!");
  })();
}
