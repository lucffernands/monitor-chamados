const puppeteer = require('puppeteer');

async function obterChamados() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  // Vai para a página de login
  await page.goto('https://servicos.viracopos.com');

  // Expande o formulário de login
  await page.waitForSelector('.zcollapsiblepanel__togglebutton');
  await page.click('.zcollapsiblepanel__togglebutton');

  // Preenche usuário e senha
  await page.waitForSelector('#username');
  await page.type('#username', process.env.SITE_USER, { delay: 50 });

  await page.waitForSelector('#password');
  await page.type('#password', process.env.SITE_PASS, { delay: 50 });

  // Seleciona domínio (exemplo: digite o nome do domínio desejado)
  await page.click('#select2-chosen-2'); // abre o dropdown
  await page.keyboard.type(process.env.SITE_DOMINIO || 'SEU_DOMINIO');
  await page.keyboard.press('Enter');

  // Clica no botão Entrar
  await page.click('#loginSDPage');

  // Espera página de chamados carregar (ajuste o seletor da tabela)
  await page.waitForNavigation();
  await page.waitForSelector('table'); // Seletor da tabela de chamados

  // Coleta dados da tabela
  const chamados = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('table tr'))
      .map(row => {
        const cols = row.querySelectorAll('td');
        if (cols.length) {
          return {
            id: cols[0].innerText.trim(),
            titulo: cols[1].innerText.trim(),
          };
        }
      })
      .filter(Boolean);
  });

  await browser.close();
  return chamados;
}

// Exporta a função para uso em outros scripts
module.exports = { obterChamados };

// Para testar sozinho
if (require.main === module) {
  (async () => {
    const dados = await obterChamados();
    console.log(dados);
  })();
      }
