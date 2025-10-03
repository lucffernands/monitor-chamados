// === Verificação do formulário de máscara ===

// frase normalizada que procuramos (sem acentos, minúscula)
const targetNormalized = "nos responda com as seguintes informacoes";

// espera extra para o conteúdo carregar
await page.waitForTimeout(1000);

// varre todos os frames da página
const frames = page.frames();
let contemMascara = false;
const framesChecked = []; // debug em caso de falso positivo

for (const frame of frames) {
  // tenta esperar por seletor relevante dentro do frame
  try {
    await frame.waitForSelector(
      'z-cpcontent, .zcollapsiblepanel__content, .req-des, .panel-body, span.size',
      { timeout: 1200 }
    );
  } catch (e) {
    // não achou nada a tempo, segue para tentar capturar texto assim mesmo
  }

  try {
    const text = await frame.evaluate(() => {
      const sel = Array.from(document.querySelectorAll(
        'z-cpcontent, .zcollapsiblepanel__content, .req-des, .panel-body, span.size'
      ));
      const raw = sel.map(el => (el.innerText || el.textContent || '')).join(' ');
      return raw
        .replace(/\s+/g, ' ')                   // normaliza espaços
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
        .toLowerCase();
    });

    framesChecked.push({ url: frame.url(), snippet: text.slice(0, 200) });

    if (text.includes(targetNormalized)) {
      contemMascara = true;
      break;
    }
  } catch (e) {
    framesChecked.push({ url: frame.url(), error: e.message });
    continue;
  }
}

// se não encontrou, loga detalhes para debug
if (!contemMascara) {
  console.log(`⚠️ Chamado ${chamado.id} sem formulário de máscara — frames verificados:`);
  framesChecked.forEach((f, i) => {
    if (f.error) {
      console.log(`  [${i}] ${f.url} (error: ${f.error})`);
    } else {
      console.log(`  [${i}] ${f.url} (snippet: ${f.snippet.replace(/\n/g,' ')})`);
    }
  });
}
