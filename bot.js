const mineflayer = require('mineflayer');

const CONFIG = {
  host: process.env.MC_HOST || 'Oblivion-Q9T9.aternos.me', // <--- REEMPLAZA ESTO POR LA IP DE TU SERVER
  port: Number(process.env.MC_PORT) || 28648,              // Puerto del servidor de Minecraft
  username: process.env.MC_USER || 'BOT_24_7',             // Autorizado: solo letras, números y "_"
  version: false,                                          // Autodetecta la versión del servidor (1.8 a 1.21+)
};

// Contenedores útiles para simular actividad (cofre normal, cofre con trampa y barril)
const CONTAINER_NAMES = ['chest', 'trapped_chest', 'barrel'];
const ACTION_INTERVAL_MS = 45_000;   // Cada cuánto se ejecuta la rutina anti-inactividad
const BASE_RETRY_MS = 30_000;        // Primer reintento tras una desconexión
const MAX_RETRY_MS = 10 * 60_000;    // Tope del backoff exponencial (10 minutos)

let retries = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function reasonText(reason) {
  return typeof reason === 'string' ? reason : JSON.stringify(reason);
}

function createBot() {
  const bot = mineflayer.createBot(CONFIG);
  let routine = null;
  let busy = false;
  let alive = false;
  let jumpTimer = null;

  if (!/^[A-Za-z0-9_]{1,16}$/.test(bot.username)) {
    console.log(`[NPC] Advertencia: el nick "${bot.username}" no es válido para Minecraft (solo letras, números y "_", máx. 16). Puede provocar expulsiones.`);
  }

  bot.on('login', () => {
    console.log(`[NPC] Conexión establecida con el servidor de Minecraft.`);
  });

  bot.once('spawn', () => {
    retries = 0; // La conexión fue exitosa: se reinicia el contador del backoff
    alive = true;
    console.log(`[NPC] El bot ha aparecido correctamente en el mapa.`);
    // Si tu servidor No-Premium requiere contraseña, descomenta la línea de abajo:
    // setTimeout(() => bot.chat('/login erickJKN'), 4000);
  });

  // Rutina automatizada del NPC: girar la cámara, abrir contenedor cercano, cerrar y saltar
  async function tick() {
    if (busy || !alive || !bot.entity) return;
    busy = true;
    try {
      // 1. Girar la cámara hacia una dirección aleatoria (los plugins anti-AFK detectan camara estática)
      await bot.look(Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.3, true);
      bot.swingArm(); // Sacudir el brazo cuenta como actividad física

      // 2. Localizar un contenedor en un radio de 5 bloques
      const ids = CONTAINER_NAMES
        .map((name) => bot.registry.blocksByName[name]?.id)
        .filter((id) => id !== undefined);
      const chestBlock = bot.findBlock({ matching: ids, maxDistance: 5 });

      if (chestBlock) {
        console.log('[NPC] Interactuando con el contenedor cercano...');
        const chest = await bot.openChest(chestBlock);
        console.log('[NPC] Contenedor abierto.');

        // Mantener la interfaz abierta 2 segundos simulando actividad de inventario
        await sleep(2000);
        chest.close();
        console.log('[NPC] Contenedor cerrado.');
      } else {
        console.log('[NPC] Aviso: No se detectó ningún contenedor válido cerca.');
      }

      // 3. Salto físico para evitar la inactividad (Anti-AFK)
      await sleep(1000);
      bot.setControlState('jump', true);
      jumpTimer = setTimeout(() => bot.setControlState('jump', false), 500);
      console.log('[NPC] Acción anti-inactividad completada con éxito.');
    } catch (err) {
      console.log(`[NPC] Error en el ciclo de ejecución: ${err.message}`);
    } finally {
      busy = false;
    }
  }

  // Si muere, respawnea en vez de quedarse tirado hasta ser desconectado
  bot.on('death', () => {
    console.log('[NPC] El bot ha muerto. Respawneando...');
    setTimeout(() => {
      if (alive && typeof bot.respawn === 'function') bot.respawn();
    }, 1000);
  });

  // Registrar SIEMPRE la razón de la expulsión (clave para diagnosticar por qué se desconecta)
  bot.on('kicked', (reason) => {
    console.log(`[NPC] Expulsado por el servidor: ${reasonText(reason)}`);
  });

  bot.on('error', (err) => console.log(`[NPC] Error crítico de red detectado: ${err.message}`));

  // Desconexión: limpiar recursos y reintentar con backoff exponencial (30s, 1m, 2m, 4m... hasta 10m)
  bot.on('end', (reason) => {
    alive = false;
    if (routine) clearInterval(routine);
    if (jumpTimer) clearTimeout(jumpTimer);

    const delay = Math.min(BASE_RETRY_MS * 2 ** retries, MAX_RETRY_MS);
    retries++;
    console.log(`[NPC] Conexión finalizada por: ${reasonText(reason)}. Reintentando en ${Math.round(delay / 1000)}s...`);
    setTimeout(createBot, delay);
  });

  routine = setInterval(tick, ACTION_INTERVAL_MS);
}

createBot();

// Evita que un error no manejado mate el proceso entero y deje al bot sin reconexión
process.on('uncaughtException', (err) => console.log(`[NPC] Excepción no capturada: ${err.message}`));
process.on('unhandledRejection', (err) => console.log(`[NPC] Promesa rechazada no capturada: ${err}`));
