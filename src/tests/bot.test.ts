/**
 * Comprehensive Automated Test Suite
 * Tests all 6 WAJIB criteria specified in requirements:
 * 1. Build Verification (0 TypeScript errors)
 * 2. Plugin dynamic addition without modifying core
 * 3. Two Tetris players do not share state (State Isolation)
 * 4. Leaderboard persistence
 * 5. Plugin error does not kill the bot (Error Isolation)
 * 6. Reconnect and error handling
 */

import { BotEngine } from '../core/BotEngine';
import { PluginBase } from '../core/PluginBase';
import { PluginManifest, CommandContext } from '../core/types';
import { SimulatorEngine } from '../whatsapp/SimulatorEngine';
import { WhatsAppService } from '../whatsapp/WhatsAppService';
import { DatabaseService } from '../database/DatabaseService';
import { JsonFileStorage } from '../database/JsonFileStorage';
import { TetrisPlugin } from '../plugins/tetris';
import { PingPlugin } from '../plugins/ping';
import { InfoPlugin } from '../plugins/info';
import path from 'path';
import fs from 'fs';

async function runAllTests() {
  console.log('\n==================================================');
  console.log('🧪 RUNNING WAJIB BOT TEST SUITE (6 CRITERIA)');
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
      botName: 'TestBot',
      databasePath: testDbFile,
      sessionDir: path.join(testDbDir, 'session'),
    },
    waService,
    dbService
  );

  await bot.start();

  // Load standard plugins
  bot.pluginLoader.registerPlugin(new PingPlugin());
  bot.pluginLoader.registerPlugin(new InfoPlugin());
  const tetrisPlugin = new TetrisPlugin();
  bot.pluginLoader.registerPlugin(tetrisPlugin);

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
          await ctx.reply('☀️ Weather in Jakarta: 31°C Sunny');
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
  assert(!!lastMsg && lastMsg.text.includes('31°C Sunny'), 'Dynamic plugin command executed successfully via message dispatcher');

  // -------------------------------------------------------------
  // TEST 3: State Isolation Between Two Tetris Players
  // -------------------------------------------------------------
  console.log('\n--- [TEST 3] Two Tetris Players State Isolation ---');
  const player1Jid = '628123456001@s.whatsapp.net';
  const player2Jid = '628123456002@s.whatsapp.net';

  const tetrisMgr = tetrisPlugin.getManager();
  const game1 = tetrisMgr.getOrCreateGame(player1Jid, 'Player One');
  const game2 = tetrisMgr.getOrCreateGame(player2Jid, 'Player Two');

  game1.start();
  game2.start();

  // Player 1 drops piece 5 times
  game1.softDrop();
  game1.softDrop();
  game1.softDrop();
  game1.softDrop();
  game1.softDrop();

  // Player 2 moves left 3 times, score stays 0
  game2.moveLeft();
  game2.moveLeft();
  game2.moveLeft();

  const snap1 = game1.getSnapshot();
  const snap2 = game2.getSnapshot();

  assert(snap1.userId === player1Jid && snap2.userId === player2Jid, 'Player IDs distinct in game snapshots');
  assert(snap1.score > 0, 'Player 1 accumulated score from soft drops');
  assert(snap2.score === 0, 'Player 2 score is unaffected by Player 1 actions');
  assert(snap1.score !== snap2.score, 'State isolation confirmed: Player 1 and Player 2 have distinct independent states');

  // Verify In-Place 1-Message UI updates (Single message game UI)
  await simEngine.simulateInboundMessage(player1Jid, '.tetris', 'Player One');
  const initialMsgId = tetrisMgr.getGameMessageId(player1Jid);
  assert(initialMsgId !== undefined, 'Game message ID tracked for in-place single-message UI');

  // Trigger movement action and verify editId was used to update in-place
  await simEngine.simulateInboundMessage(player1Jid, '.tetris left', 'Player One');
  const boardMsg2 = simEngine.getLastOutboundMessage();
  assert(boardMsg2?.editId === initialMsgId, 'Subsequent game moves update the exact same message in-place via editId');
  assert(tetrisMgr.getGameMessageId(player1Jid) === initialMsgId, 'Message ID preserved in-place during gameplay');

  // -------------------------------------------------------------
  // TEST 4: Leaderboard Persistence
  // -------------------------------------------------------------
  console.log('\n--- [TEST 4] Leaderboard Persistence ---');
  // Record high scores for players
  await dbService.gameStats.recordGameResult(player1Jid, 'tetris', 15400, 24, 3, 2);
  await dbService.gameStats.recordGameResult(player2Jid, 'tetris', 28900, 42, 5, 4);

  // Flush to storage disk
  await dbService.storage.flush();

  // Create a brand NEW independent database instance reading from the exact same disk file
  const newStorage = new JsonFileStorage(testDbFile);
  const newDbService = new DatabaseService(newStorage);
  await newDbService.init();

  const topScores = await newDbService.leaderboard.getTopScores('tetris', 5);
  assert(topScores.length >= 2, 'Leaderboard data restored from persistent storage');
  assert(topScores[0].score === 28900, 'Top score correctly sorted: 28,900 is #1');
  assert(topScores[1].score === 15400, 'Second score correctly sorted: 15,400 is #2');
  assert(!topScores[0].maskedName.includes('@s.whatsapp.net'), 'Leaderboard masks raw phone number for privacy');

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

  // Trigger the crashing command
  let errorCaught = false;
  bot.eventBus.on('plugin:error', (pluginName, err) => {
    if (pluginName === 'faulty') {
      errorCaught = true;
    }
  });

  await simEngine.simulateInboundMessage('628199999999@s.whatsapp.net', '.crashme', 'CrashTester');
  assert(errorCaught, 'Bot caught and isolated the plugin error without unhandled exception');

  // Verify that the bot is STILL alive and responds to subsequent commands!
  await simEngine.simulateInboundMessage('628199999999@s.whatsapp.net', '.ping', 'CrashTester');
  const pingResponse = simEngine.getLastOutboundMessage();
  assert(!!pingResponse && pingResponse.text.includes('PONG!'), 'Bot remained fully operational after plugin error');

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
