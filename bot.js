const mineflayer = require('mineflayer');

const CONFIG = {
  host: process.env.MC_HOST || 'Oblivion-Q9T9.aternos.me',
  port: Number(process.env.MC_PORT) || 28648,
  username: process.env.MC_USER || 'BOT_24_7',
  version: false,
};

const BASE_RETRY_MS = 30_000;
const MAX_RETRY_MS = 5 * 60_000;
const CHEST_NAMES = ['chest', 'trapped_chest', 'barrel'];

let retries = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (min, max) => Math.random() * (max - min) + min;
const log = (msg) => console.log(`[NPC ${new Date().toISOString().slice(11, 19)}] ${msg}`);

function createBot() {
  const bot = mineflayer.createBot(CONFIG);
  let running = false;

  // --- Acciones anti-AFK ---------------------------------------------------
  const actions = {
    async look() {
      // Gira a un ángulo aleatorio, con pitch moderado
      await bot.look(rand(-Math.PI, Math.PI), rand(-0.6, 0.6), false);
    },
    async jump() {
      bot.setControlState('jump', true);
      await sleep(rand(200, 450));
      bot.setControlState('jump', false);
    },
    async walk() {
      // Camina un poco y vuelve; el desplazamiento neto es ~0
      const t = rand(400, 900);
      bot.setControlState('forward', true);
      await sleep(t);
      bot.setControlState('forward', false);
      await sleep(200);
      bot.setControlState('back', true);
      await sleep(t);
      bot.setControlState('back', false);
    },
    async sneak() {
      bot.setControlState('sneak', true);
      await sleep(rand(600, 1500));
      bot.setControlState('sneak', false);
    },
    async swing() {
      bot.swingArm('right');
      await sleep(150);
      bot.swingArm('left');
    },
    async chest() {
      const ids = CHEST_NAMES
        .map((n) => bot.registry.blocksByName[n]?.id)
        .filter((id) => id !== undefined);
      const block = bot.findBlock({ matching: ids, maxDistance: 5 });
      if (!block) return actions.swing();
      const container = await bot.openContainer(block);
      await sleep(rand(1000, 2500));
      container.close();
    },
  };

  const names = Object.keys(actions);

  async function loop() {
    running = true;
    while (running) {
      await sleep(rand(8_000, 20_000));
      if (!running || !bot.entity) continue;

      // Entre 1 y 3 acciones seguidas, para romper cualquier patrón
      const count = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count && running; i++) {
        const name = names[Math.floor(Math.random() * names.length)];
        try {
          await actions[name]();
          log(`Acción: ${name}`);
        } catch (err) {
          log(`Error en "${name}": ${err.message}`);
        }
        await sleep(rand(300, 1200));
      }
      bot.clearControlStates();
    }
  }

  // --- Ciclo de vida -------------------------------------------------------
  bot.once('spawn', () => {
    retries = 0;
    log('Bot en el mapa.');
    loop();
  });

  bot.on('kicked', (reason) => log(`Expulsado: ${JSON.stringify(reason)}`));
  bot.on('error', (err) => log(`Error de red: ${err.message}`));

  bot.on('end', (reason) => {
    running = false;
    const delay = Math.min(BASE_RETRY_MS * 2 ** retries, MAX_RETRY_MS);
    retries++;
    log(`Desconectado (${reason}). Reintentando en ${delay / 1000}s...`);
    setTimeout(createBot, delay);
  });
}

createBot();