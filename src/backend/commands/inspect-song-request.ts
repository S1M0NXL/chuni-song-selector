import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { loadAppConfig } from "../config/app-config.js";
import { SongDatabase } from "../songs/song-database.js";
import { loadSongs } from "../songs/song-loader.js";
import { inspectSongRequest } from "./song-request-inspector.js";

const config = loadAppConfig();
const database = new SongDatabase(loadSongs(config.songDataPath));
const args = process.argv.slice(2);

if (args.length > 0) {
  printInspectResult(args.join(" "));
} else if (input.isTTY) {
  await runInteractiveMode();
} else {
  await runStdinMode();
}

function printInspectResult(rawInput: string): void {
  console.log(JSON.stringify(inspectSongRequest(rawInput, database, config), null, 2));
}

async function runInteractiveMode(): Promise<void> {
  const rl = createInterface({ input, output });

  console.error("输入点歌弹幕进行解析；输入 exit 或 quit 结束。");
  try {
    while (true) {
      const line = await rl.question("> ");
      const rawInput = line.trim();

      if (rawInput === "exit" || rawInput === "quit") {
        break;
      }

      if (rawInput.length === 0) {
        continue;
      }

      printInspectResult(rawInput);
    }
  } finally {
    rl.close();
  }
}

async function runStdinMode(): Promise<void> {
  const raw = await readAllStdin();
  for (const line of raw.split(/\r?\n/u)) {
    const rawInput = line.trim();
    if (rawInput.length > 0) {
      printInspectResult(rawInput);
    }
  }
}

async function readAllStdin(): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of input) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}
