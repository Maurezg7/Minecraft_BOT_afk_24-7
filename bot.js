const mineflayer = require('mineflayer');

const CONFIG = {
  host: process.env.MC_HOST || 'Oblivion-Q9T9.aternos.me',
  port: Number(process.env.MC_PORT) || 28648,
  username: process.env.MC_USER || 'BOT24_7',
  version: false,
};

const CHEST_NAMES = ['chest', 'trapped_chest', 'barrel'];
const ACTION_INTERVAL_MS = 45_000;
const BASE_RETRY_MS = 30_000;
const MAX_RETRY_MS = 5 * 60_000;

let retries = 0;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function createBot() {
  const bot = mineflayer.createBot(CONFIG);
  let routine = null;
  let busy = false;

  async function tick() {
    if (busy || !bot.entity) return;
    busy = true;
    try {
      const ids = CHEST_NAMES
        .map((n) => bot.registry.blocksByName[n]?.id)
        .filter((id) => id !== undefined);

      const block = bot.findBlock({ matching: ids, maxDistance: 5 });

      if (block) {
        const container = await bot.openContainer(block);
        await sleep(2000);
        container.close();
      }

      bot.setControlState('jump', true);
      await sleep(500);
      bot.setControlState('jump', false);
      console.log('[NPC] Ciclo anti-inactividad completado.');
    } catch (err) {
      console.log(`[NPC] Error en el ciclo: ${err.message}`);
    } finally {
      busy = false;
    }
  }

  bot.once('spawn', () => {
    retries = 0;
    console.log('[NPC] Bot en el mapa.');
    routine = setInterval(tick, ACTION_INTERVAL_MS);
  });

  bot.on('end', (reason) => {
    if (routine) clearInterval(routine);
    const delay = Math.min(BASE_RETRY_MS * 2 ** retries, MAX_RETRY_MS);
    retries++;
    console.log(`[NPC] Desconectado (${reason}). Reintentando en ${delay / 1000}s...`);
    setTimeout(createBot, delay);
  });

  bot.on('kicked', (reason) => console.log(`[NPC] Expulsado: ${reason}`));
  bot.on('error', (err) => console.log(`[NPC] Error de red: ${err.message}`));
}

createBot();
