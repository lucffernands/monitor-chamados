const puppeteer = require("puppeteer");
const { login, obterChamados } = require("./login");
const { enviarMensagem } = require("./telegram");

(async () => {
  console.log("🔎 Verificando e-mails nos incidentes (monitor-mascara)...");

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  try {
    await login(page, process.env.MS_USER, process.env.MS_PASS);

    const urlFiltro =
      "https://servicos.viracopos.com/WOListView.do?viewID=6902&globalViewName=All_Requests";
    await page.goto(urlFiltro, { waitUntil: "networkidle2", timeout: 120000 });
    console.log("✅ Lista de chamados carregada:", urlFiltro);

    await page.waitForSelector("#requests_list_body", { timeout: 60000 });
    console.log("✅ Tabela de chamados encontrada");

    const chamados = await obterChamados(page);

    if (chamados.length === 0) {
      console.log("ℹ️ Nenhum chamado encontrado no filtro. Encerrando monitor...");
      return;
    }

    console.log("✅ Chamados extraídos:", chamados.length);

    let chamadosSemMascara = [];

    const fraseFormulario = "para que possamos dar andamento na sua solicitação, por favor, nos responda com as seguintes informações:";

    for (const chamado of chamados) {
      const urlChamado = `https://servicos.viracopos.com/WorkOrder.do?woMode=viewWO&woID=${chamado.id}&PORTALID=1`;
      await page.goto(urlChamado, { waitUntil: "networkidle2", timeout: 120000 });

      // --- 1) Tenta expandir os painéis de conversa colapsados (executado no contexto da página)
      try {
        await page.waitForSelector("#conversation-holder", { timeout: 5000 });
        await page.evaluate(() => {
          // para cada painel, se o conteúdo estiver escondido, clicar no header para expandir
          const panels = Array.from(document.querySelectorAll("z-collapsiblepanel, .zcollapsiblepanel"));
          panels.forEach(p => {
            const header = p.querySelector(".zcollapsiblepanel__header");
            const content = p.querySelector(".zcollapsiblepanel__content, z-cpcontent");
            try {
              const computed = content ? window.getComputedStyle(content).display : null;
              if (header && content && (content.style.display === "none" || computed === "none")) {
                // click via JS (mesmo que haja handlers customizados)
                header.click();
              }
            } catch (e) {
              // ignore
            }
          });
        });
        // deixa um curto tempo para render do painel expandido
        await page.waitForTimeout(600);
      } catch (e) {
        console.log(`ℹ️ conversation-holder não disponível/expansão ignorada no chamado ${chamado.id}`);
      }

      // --- 2) Função robusta de detecção (tentativa com waitForFunction)
      const checkFraseFn = (frase) => {
        const normalize = s => (s || "")
          .replace(/\u00A0/g, " ")        // NBSP -> space
          .replace(/\u200B/g, "")         // zero-width
          .replace(/&nbsp;/gi, " ")
          .replace(/<br\s*\/?>/gi, " ")
          .replace(/<\/?[^>]+>/g, " ")    // remove tags se estiver usando innerHTML
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();

        const target = normalize(frase);

        // 1) checa blocos de conversa (#conversation-holder .req-des)
        const convEls = Array.from(document.querySelectorAll("#conversation-holder .req-des"));
        for (const el of convEls) {
          const txt = normalize(el.innerText || el.textContent || el.innerHTML || "");
          if (txt.includes(target)) return true;
        }

        // 2) checa todos os z-cpcontent (conteúdos de painel), por via das dúvidas
        const cpEls = Array.from(document.querySelectorAll("z-cpcontent, .zcollapsiblepanel__content"));
        for (const el of cpEls) {
          const txt = normalize(el.innerText || el.textContent || el.innerHTML || "");
          if (txt.includes(target)) return true;
        }

        // 3) fallback para body
        const bodyTxt = normalize(document.body && (document.body.innerText || document.body.textContent || document.body.innerHTML || ""));
        if (bodyTxt.includes(target)) return true;

        // 4) checa iframes same-origin
        const iframes = Array.from(document.querySelectorAll("iframe"));
        for (const iframe of iframes) {
          try {
            const doc = iframe.contentDocument;
            if (doc && doc.body) {
              const ftxt = normalize(doc.body.innerText || doc.body.textContent || doc.body.innerHTML || "");
              if (ftxt.includes(target)) return true;
            }
          } catch (e) {
            // cross-origin -> ignorar
          }
        }

        return false;
      };

      // tenta com waitForFunction (rápido)
      let contemMascara = false;
      try {
        await page.waitForFunction(checkFraseFn, { timeout: 3000 }, fraseFormulario);
        contemMascara = true;
      } catch (err) {
        // não encontrou na primeira tentativa -> tenta forçar display:block em z-cpcontent e re-tentar
        try {
          await page.evaluate(() => {
            document.querySelectorAll('z-cpcontent, .zcollapsiblepanel__content').forEach(el => {
              try { el.style.display = 'block'; } catch (e) {}
            });
          });
          // curto tempo para render
          await page.waitForTimeout(400);
          try {
            await page.waitForFunction(checkFraseFn, { timeout: 2000 }, fraseFormulario);
            contemMascara = true;
          } catch (err2) {
            contemMascara = false;
          }
        } catch (e) {
          contemMascara = false;
        }
      }

      // --- 3) se ainda não encontrou, coleto debug curto (3 blocos) e screenshot para investigação
      if (!contemMascara) {
        try {
          const sample = await page.$$eval("#conversation-holder .req-des", els =>
            els.slice(0, 3).map(e => ({
              innerText: (e.innerText || "").slice(0, 800),
              innerHTML: (e.innerHTML || "").slice(0, 800)
            }))
          );
          console.log(`DEBUG: amostra de conversas (chamado ${chamado.id}):`, sample);
          // screenshot (arquivo único por chamado)
          await page.screenshot({ path: `debug_chamado_${chamado.id}.png`, fullPage: true });
        } catch (dbgErr) {
          console.log(`ℹ️ Falha ao gerar debug do chamado ${chamado.id}: ${dbgErr.message}`);
        }
      }

      if (!contemMascara) {
        console.log(`⚠️ Chamado ${chamado.id} sem formulário de máscara`);
        chamadosSemMascara.push(chamado.id);
      } else {
        console.log(`✅ Chamado ${chamado.id} contém formulário de máscara`);
      }
    }

    if (chamadosSemMascara.length > 0) {
      const lista = chamadosSemMascara.join(", ");
      const msg = `🚨 Chamados encontrados sem formulário de máscara: ${lista}`;
      console.log(msg);
      await enviarMensagem(msg);
    } else {
      console.log("✅ Todos os chamados possuem formulário de máscara!");
    }
  } catch (err) {
    console.error("❌ Erro no monitor-mascara:", err);
  } finally {
    await browser.close();
  }
})();
