const puppeteer = require('puppeteer');

async function obterChamados() {
  const browser = await puppeteer.launch({
  headless: "new", // antigo era true
  args: ['--no-sandbox'],
  timeout: 0 // desativa timeout global
});
  const page = await browser.newPage();

  // Vai para a página inicial
  await page.goto('https://servicos.viracopos.com');

  // Expande painel (se necessário)
  await page.waitForSelector('.zcollapsiblepanel__togglebutton');
  await page.click('.zcollapsiblepanel__togglebutton');

  // --- Login via SAML ---
  await page.waitForSelector('a.sign-saml');
  await page.click('a.sign-saml');

  // --- Tela Microsoft: E-mail ---
  await page.waitForSelector('input#i0116', { visible: true });
  await page.type('input#i0116', process.env.MS_USER, { delay: 50 });
  await page.click('input#idSIButton9'); // Avançar

  // --- Tela Microsoft: Senha ---
  await page.waitForSelector('input#i0118', { visible: true });
  await page.type('input#i0118', process.env.MS_PASS, { delay: 50 });
  await page.click('input#idSIButton9'); // Entrar

  // --- Tela "Manter-se conectado?" (opcional) ---
  try {
    await page.waitForSelector('#idSIButton9', { timeout: 5000 });
    await page.click('#idSIButton9'); // Sim ou Não
  } catch (e) {
    console.log("Não apareceu a tela 'Manter-se conectado'.");
  }

  // --- Página Home ---
  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 120000 }); // 2min
  console.log("Home carregada:", page.url());

  // --- Clicar na "Central de Serviços de TI" ---
  await page.waitForSelector('span[title="Central de Serviços de TI"]', { visible: true, timeout: 120000 });
  await page.click('span[title="Central de Serviços de TI"]');

  // --- Clicar nos 3 pontinhos "Mais" ---
  await page.waitForSelector('#header-more-items1', { visible: true });
  await page.click('#header-more-items1');
obrigada
  // --- Clicar na aba "Solicitações" ---
  await page.waitForSelector('span[title="Solicitações"]', { visible: true, timeout: 120000 });
  await page.click('span[title="Solicitações"]');

  // --- Espera a tabela carregar ---
  await page.waitForSelector('table', { visible: true, timeout: 120000 });

  // --- Extrai ID, Assunto e Vencimento (SLA) ---
  const chamados = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('table tr'))
      .map(row => {
        const cols = row.querySelectorAll('td');
        if (cols.length) {
          return {
            id: cols[0].innerText.trim(),
            assunto: cols[1].innerText.trim(),
            vencimento: cols[2].innerText.trim() // SLA/Vencimento
          };
        }
      })
      .filter(Boolean);
  });

  await browser.close();
  return chamados;
}

// Exporta função
module.exports = { obterChamados };

// Para testar sozinho
if (require.main === module) {
  (async () => {
    const dados = await obterChamados();
    console.log(dados);
  })();
      }
