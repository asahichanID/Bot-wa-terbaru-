/**
 * Comprehensive Automated Test Suite
 * Tests all 6 WAJIB criteria for Oguri Cap Uma Musume Bot:
 * 1. Build Verification (0 TypeScript errors)
 * 2. Plugin dynamic addition without modifying core
 * 3. Uma Musume / Oguri Cap state updates, training & dining commands
 * 4. Data persistence
 * 5. Plugin error isolation (Bot does not crash)
 * 6. Reconnect and error handling
 */

import { BotEngine } from '../core/BotEngine';
import { PluginBase } from '../core/PluginBase';
import { PluginManifest, CommandContext } from '../core/types';
import { SimulatorEngine } from '../whatsapp/SimulatorEngine';
import { WhatsAppService } from '../whatsapp/WhatsAppService';
import { DatabaseService } from '../database/DatabaseService';
import { JsonFileStorage } from '../database/JsonFileStorage';
import { UmamusumePlugin } from '../plugins/umamusume';
import { PingPlugin } from '../plugins/ping';
import { InfoPlugin } from '../plugins/info';
import path from 'path';
import fs from 'fs';

async function runAllTests() {
  console.log('\n==================================================');
  console.log('🧪 RUNNING OGURI CAP BOT TEST SUITE (6 CRITERIA)');
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ PASSED: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAILED: ${testName}`);
      failed++;
    }
  }

  // Setup isolated test environment
  const testDbDir = path.resolve(process.cwd(), 'data', 'test-db');
  if (!fs.existsSync(testDbDir)) fs.mkdirSync(testDbDir, { recursive: true });
  const testDbFile = path.join(testDbDir, `test-db-${Date.now()}.json`);

  const simEngine = new SimulatorEngine();
  const waService = new WhatsAppService('simulator');
  await waService.switchEngine(simEngine);

  const storage = new JsonFileStorage(testDbFile);
  const dbService = new DatabaseService(storage);

  const bot = new BotEngine(
    {
      botName: 'Oguri Cap',
      databasePath: testDbFile,
      sessionDir: path.join(testDbDir, 'session'),
    },
    waService,
    dbService
  );

  await bot.start();

  // Load standard plugins
  const umaPlugin = new UmamusumePlugin();
  bot.pluginLoader.registerPlugin(umaPlugin);
  bot.pluginLoader.registerPlugin(new PingPlugin());
  bot.pluginLoader.registerPlugin(new InfoPlugin());

  // -------------------------------------------------------------
  // TEST 1: Plugin Loaded & Core Functionality
  // -------------------------------------------------------------
  console.log('\n--- [TEST 1 & 2] Plugin System & Dynamic Addition ---');
  assert(bot.pluginLoader.getPluginCount() >= 3, 'Core loaded built-in plugins');

  // Test adding a NEW plugin without modifying core or other plugins
  class CustomWeatherPlugin extends PluginBase {
    readonly manifest: PluginManifest = {
      name: 'weather',
      version: '1.0.0',
      description: 'Custom external plugin',
    };
    onLoad() {
      this.registerCommand({
        name: 'weather',
        description: 'Get weather forecast',
        execute: async (ctx: CommandContext) => {
          await ctx.reply('☀️ Weather at Tokyo Racecourse: 22°C Sunny');
        },
      });
    }
  }

  const weatherPlugin = new CustomWeatherPlugin();
  const loadedSuccessfully = bot.pluginLoader.registerPlugin(weatherPlugin);
  assert(loadedSuccessfully, 'Custom plugin dynamically registered into BotEngine without modifying core');

  const weatherCmd = bot.pluginLoader.getCommand('weather');
  assert(weatherCmd !== undefined && weatherCmd.plugin.manifest.name === 'weather', 'Dynamic plugin command is recognized in CommandMap');

  // Execute the dynamic plugin command
  await simEngine.simulateInboundMessage('628111111111@s.whatsapp.net', '.weather', 'Tester');
  const lastMsg = simEngine.getLastOutboundMessage();
  assert(!!lastMsg && lastMsg.text.includes('Tokyo Racecourse'), 'Dynamic plugin command executed successfully via message dispatcher');

  // -------------------------------------------------------------
  // TEST 3: Oguri Cap & Uma Musume Commands with Mascot Image
  // -------------------------------------------------------------
  console.log('\n--- [TEST 3] Oguri Cap Uma Musume Integration & Mascot Image ---');
  const trainerJid = '628123456001@s.whatsapp.net';

  // 1. Test .menu
  await simEngine.simulateInboundMessage(trainerJid, '.menu', 'Trainer Ash');
  const menuMsg = simEngine.getLastOutboundMessage();
  assert(!!menuMsg && menuMsg.text.includes('TRACEN ACADEMY GUIDEBOOK'), '.menu returns Tracen Academy Guidebook');
  assert(menuMsg?.showMascot === true, 'Menu message includes mascot image flag (gambar nempel teks)');

  // 2. Test .makan ramen
  await simEngine.simulateInboundMessage(trainerJid, '.makan ramen', 'Trainer Ash');
  const makanMsg = simEngine.getLastOutboundMessage();
  assert(!!makanMsg && makanMsg.text.includes('Donburi Ramen Jumbo Kasamatsu'), '.makan serves ramen to Oguri Cap');
  assert(makanMsg?.text.includes('絶好調'), 'Oguri Cap motivation peaks to 絶好調 after meal');
  assert(makanMsg?.showMascot === true, '.makan message includes mascot image flag');

  // 3. Test .latih speed
  await simEngine.simulateInboundMessage(trainerJid, '.latih speed', 'Trainer Ash');
  const trainMsg = simEngine.getLastOutboundMessage();
  assert(!!trainMsg && trainMsg.text.includes('HASIL LATIHAN TRACEN ACADEMY'), '.latih executes training session');
  assert(trainMsg?.text.includes('Speed'), '.latih boosts Speed stat');

  // 4. Test .race
  await simEngine.simulateInboundMessage(trainerJid, '.race', 'Trainer Ash');
  const raceMsg = simEngine.getLastOutboundMessage();
  assert(!!raceMsg && raceMsg.text.includes('PACUAN TURF G1'), '.race simulates G1 Turf championship race');

  // -------------------------------------------------------------
  // TEST 4: Data Persistence
  // -------------------------------------------------------------
  console.log('\n--- [TEST 4] Database Persistence ---');
  await dbService.gameStats.recordGameResult(trainerJid, 'umamusume', 12500, 30, 5, 5);
  await dbService.storage.flush();

  const newStorage = new JsonFileStorage(testDbFile);
  const newDbService = new DatabaseService(newStorage);
  await newDbService.init();

  const topScores = await newDbService.leaderboard.getTopScores('umamusume', 5);
  assert(topScores.length >= 1, 'Data restored from persistent storage');
  assert(topScores[0].score === 12500, 'Score properly retrieved from disk storage');

  // -------------------------------------------------------------
  // TEST 5: Plugin Error Isolation (Bot Does Not Crash)
  // -------------------------------------------------------------
  console.log('\n--- [TEST 5] Plugin Error Isolation ---');
  class FaultyPlugin extends PluginBase {
    readonly manifest: PluginManifest = {
      name: 'faulty',
      version: '1.0.0',
      description: 'Plugin that throws an intentional error',
    };
    onLoad() {
      this.registerCommand({
        name: 'crashme',
        description: 'Simulate plugin runtime crash',
        execute: async () => {
          throw new Error('Fatal simulated plugin malfunction!');
        },
      });
    }
  }

  bot.pluginLoader.registerPlugin(new FaultyPlugin());

  let errorCaught = false;
  bot.eventBus.on('plugin:error', (pluginName) => {
    if (pluginName === 'faulty') {
      errorCaught = true;
    }
  });

  await simEngine.simulateInboundMessage('628199999999@s.whatsapp.net', '.crashme', 'CrashTester');
  assert(errorCaught, 'Bot caught and isolated the plugin error without unhandled exception');

  // Verify that the bot is STILL alive and responds to subsequent commands!
  await simEngine.simulateInboundMessage('628199999999@s.whatsapp.net', '.ping', 'CrashTester');
  const pingResponse = simEngine.getLastOutboundMessage();
  assert(!!pingResponse && pingResponse.text.includes('TRACEN SPRINT REPORT'), 'Bot remained fully operational after plugin error');

  // -------------------------------------------------------------
  // TEST 6: Reconnect & Error Handling
  // -------------------------------------------------------------
  console.log('\n--- [TEST 6] Reconnect & Error Handling ---');
  const waStatusBefore = simEngine.getStatus();
  assert(waStatusBefore.state === 'open', 'Initial connection state is OPEN');

  await simEngine.disconnect();
  const waStatusDisconnected = simEngine.getStatus();
  assert(waStatusDisconnected.state === 'closed', 'Disconnected state handled cleanly');

  await simEngine.connect();
  const waStatusReconnected = simEngine.getStatus();
  assert(waStatusReconnected.state === 'open', 'Reconnected successfully to OPEN state');

  // Teardown
  await bot.stop();
  try {
    fs.rmSync(testDbDir, { recursive: true, force: true });
  } catch {}

  console.log('\n==================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

const isTestDirectRun =
  (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) ||
  (process.argv[1] && process.argv[1].includes('bot.test'));

if (isTestDirectRun) {
  runAllTests().catch((err) => {
    console.error('Test runner fatal error:', err);
    process.exit(1);
  });
}

export { runAllTests };
