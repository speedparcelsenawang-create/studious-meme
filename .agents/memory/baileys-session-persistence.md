---
name: Baileys WhatsApp session persistence
description: Local .baileys_auth session directory used by WhatsApp bots may not survive Replit Autoscale deploys/restarts.
---

WhatsApp bots built on Baileys (or whatsapp-web.js) typically persist their login session as files on local disk (e.g. a `.baileys_auth` folder). On Replit:

- Autoscale deployments do not guarantee a persistent filesystem across restarts/redeploys — a session stored only on local disk can be lost, forcing the user to re-scan the WhatsApp QR/pairing code.
- Reserved VM deployments keep a persistent disk, so local session storage survives there.

**Why:** Discovered while setting up a WhatsApp scheduling bot (ScheduleBot) that stored its Baileys session in `.baileys_auth`. The project also had a Postgres database available, which is a natural place to move the session if persistence across Autoscale restarts matters.

**How to apply:** When setting up or reviewing a WhatsApp-bot-on-Replit project, check where the auth session is stored. If it's local-disk-only, flag the Autoscale-vs-Reserved-VM tradeoff to the user, or propose moving the session store into a database.
