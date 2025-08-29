# 📡 Monitor de Chamados

Este repositório contém um bot que **verifica chamados automaticamente** no sistema e envia **alertas para o Telegram**, incluindo avisos de **novos chamados** e de **SLAs próximos do vencimento**.

---

## ⚙️ Como funciona
- O **GitHub Actions** executa os workflows de forma agendada.
- O script `monitor/principal.js` verifica **novos chamados** e salva o histórico em `chamados.json`.
- O script `monitor/monitor-sla.js` verifica chamados com **SLA abaixo de 30 minutos** e envia alertas.
- As mensagens são enviadas para o **Telegram**.

---

## 🚀 Configuração

1. Crie um bot no [BotFather](https://t.me/botfather) e obtenha o **TOKEN**.
2. Descubra seu **chat_id** (use o bot [@userinfobot](https://t.me/userinfobot)).
3. No repositório do GitHub, vá em **Settings > Secrets and variables > Actions** e adicione:
   - `MS_USER` → Usuário do sistema de chamados
   - `MS_PASS` → Senha do sistema de chamados
   - `TELEGRAM_TOKEN` → Token do bot do Telegram
   - `TELEGRAM_CHAT_ID` → ID do chat/grupo do Telegram
4. O bot já está pronto 🎉

---

## 📅 Agendamento
Atualmente configurado para rodar **todos os dias, de 14h até 23h (horário de Brasília)**, a cada 5 minutos.  

Você pode alterar o agendamento no arquivo  
`.github/workflows/monitor.yml` modificando as linhas:

```yaml
on:
  schedule:
    - cron: "*/5 17-23 * * *"  # 14h–20h BRT
    - cron: "*/5 0-2 * * *"    # 21h–23h BRT
```
---

Telegram

🔴 Novos chamados

🆔 ID: 12345
📌 Assunto: Erro no sistema de login
⚠️ Estado: Aberto
⏰ SLA: Vence em 2h 15m
----------
🆔 ID: 12346
📌 Assunto: Falha na integração com API
⚠️ Estado: Em andamento
⏰ SLA: Vence em 5h 40m
