const puppeteer = require('puppeteer');

async function obterChamados() {
  const browser = await puppeteer.launch({
    headless: "new", // modo headless moderno
    args: ['--no-sandbox'],
    timeout: 0
  });

  const page = await browser.newPage();

  try {
    // Página inicial
    await page.goto('https://servicos.viracopos.com', { waitUntil: 'networkidle2', timeout: 60000 });
    console.log("✅ Página inicial carregada:", page.url());

    // Expande painel se houver
    await page.waitForSelector('.zcollapsiblepanel__togglebutton', { timeout: 60000 });
    await page.click('.zcollapsiblepanel__togglebutton');
    console.log("✅ Painel expandido");

    // --- Login via SAML ---
    await page.waitForSelector('a.sign-saml', { visible: true, timeout: 60000 });
    await page.click('a.sign-saml');
    console.log("✅ Clique SAML feito");

    // --- Tela Microsoft: E-mail ---
    await page.waitForSelector('input#i0116', { visible: true, timeout: 60000 });
    await page.type('input#i0116', process.env.MS_USER, { delay: 50 });
    await page.click('input#idSIButton9'); // Avançar
    console.log("✅ Email enviado, avançar clicado");
    await page.waitForTimeout(2000);
    console.log("URL atual:", page.url());

    // --- Tela Microsoft: Senha ---
    await page.waitForSelector('input#i0118', { visible: true, timeout: 60000 });
    await page.type('input#i0118', process.env.MS_PASS, { delay: 50 });
    await page.click('input#idSIButton9'); // Entrar
    console.log("✅ Senha enviada, entrar clicado");
    await page.waitForTimeout(5000);
    console.log("URL atual após login:", page.url());

    // --- Tela "Manter-se conectado?" ---
    try {
      await page.waitForSelector('#idSIButton9', { timeout: 5000 });
      await page.click('#idSIButton9'); // Sim ou Não
      console.log("✅ Manter-se conectado clicado");
    } catch (e) {
      console.log("Não apareceu a tela 'Manter-se conectado'.");
    }

    // --- Home ---
    await page.waitForSelector('span[title="Central de Serviços de TI"]', { visible: true, timeout: 120000 });
    console.log("✅ Home carregada:", page.url());

    // Após clicar na Central de Serviços de TI
    await page.click('span[title="Central de Serviços de TI"]');
    console.log("✅ Central de Serviços clicada:", page.url());

    // Espera a URL /WOListView.do carregar
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 120000 });
    console.log("✅ Lista de chamados carregada:", page.url());

    // Espera a tabela carregar
    await page.waitForSelector('#requests_list_body', { timeout: 120000 });

    const chamados = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#requests_list_body tr'));
      return rows.map(row => {
        const cols = row.querySelectorAll('td');

        return {
          id: cols[4]?.querySelector('div[rel="uitooltip-track-table"]')?.innerText.trim() || null,
          assunto: cols[7]?.querySelector('span.truncate-wrapper a')?.innerText.trim() || null,
          vencimento: cols[15]?.querySelector('span[rel="uitooltip-track-table"]')?.innerText.trim() || null,
        };
      });
    });

    console.log(chamados);

    // --- Extrai ID, Assunto e Vencimento ---
    const chamados = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('table tr'))
        .map(row => {
          const cols = row.querySelectorAll('td');
          if (cols.length) {
            return {
              id: cols[0].innerText.trim(),
              assunto: cols[1].innerText.trim(),
              vencimento: cols[2].innerText.trim()
            };
          }
        })
        .filter(Boolean);
    });

    console.log("✅ Chamados extraídos:", chamados.length);

    await browser.close();
    return chamados;

  } catch (err) {
    await browser.close();
    throw err;
  }
}

// Exporta função
module.exports = { obterChamados };

// Para teste isolado
if (require.main === module) {
  (async () => {
    try {
      const dados = await obterChamados();
      console.log(dados);
    } catch (err) {
      console.error("❌ Erro no login:", err);
    }
  })();
}
