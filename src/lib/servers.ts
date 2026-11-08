import fs from "fs";
import path from "path";
import {
  DEFAULT_SERVERS,
  SERVER_REGIONS,
  SERVER_STATUS_META,
  ServerStatus,
  TestingServer,
} from "../config/servers";

/**
 * The verified testing server registry.
 *
 * Seeded from config/servers.ts but written to its own file, so a live edit made
 * through `/servers` is never silently reverted by a redeploy. The seed only
 * applies when the file does not exist yet.
 */
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), "data");
const SERVERS_FILE = path.join(DATA_DIR, "servers.json");

let cache: TestingServer[] | null = null;

function readServers(): TestingServer[] {
  if (cache) return cache;
  try {
    if (fs.existsSync(SERVERS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SERVERS_FILE, "utf8"));
      if (Array.isArray(parsed) && parsed.length) {
        cache = parsed;
        return cache;
      }
    }
  } catch (err) {
    console.error("[servers] could not read servers.json, falling back to the seed:", err);
  }
  cache = [...DEFAULT_SERVERS];
  return cache;
}

function writeServers(servers: TestingServer[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${SERVERS_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(servers, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, SERVERS_FILE);
  cache = servers;
}

export function listServers(region?: string): TestingServer[] {
  const all = readServers();
  return region ? all.filter((s) => s.region === region) : all;
}

/** Case-insensitive lookup, so `AS.MCPVP.CLUB` finds `as.mcpvp.club`. */
export function findServer(host: string): TestingServer | undefined {
  const q = host.trim().toLowerCase();
  return readServers().find(
    (s) => s.host.toLowerCase() === q || s.alias?.toLowerCase() === q
  );
}

export function addServer(server: TestingServer): TestingServer {
  const servers = [...readServers()];
  if (findServer(server.host)) throw new Error(`**${server.host}** is already on the list.`);
  servers.push(server);
  writeServers(servers);
  return server;
}

export function removeServer(host: string): TestingServer {
  const servers = [...readServers()];
  const existing = findServer(host);
  if (!existing) throw new Error(`**${host}** is not on the list.`);
  writeServers(servers.filter((s) => s.host !== existing.host));
  return existing;
}

/** Moves a host up or down the force priority list within its region. */
export function moveServer(host: string, direction: "up" | "down"): TestingServer {
  const servers = [...readServers()];
  const existing = findServer(host);
  if (!existing) throw new Error(`**${host}** is not on the list.`);
  const index = servers.findIndex((s) => s.host === existing.host);
  const swap = direction === "up" ? index - 1 : index + 1;
  if (swap < 0 || swap >= servers.length) return existing;
  [servers[index], servers[swap]] = [servers[swap], servers[index]];
  writeServers(servers);
  return existing;
}

/** Renders the region block used by `/servers list`. */
export function renderRegion(region: string): string {
  const entries = readServers()
    .filter((s) => s.region === region)
    .sort((a, b) => a.host.localeCompare(b.host));

  if (!entries.length) return "_No servers published for this region yet._";

  return entries
    .map((s) => {
      const meta = SERVER_STATUS_META[s.status];
      const alias = s.alias ? ` / ${s.alias}` : "";
      const note = s.note ? ` _(${s.note})_` : "";
      return `${meta.dot} \`${s.host}${alias}\`${note}`;
    })
    .join("\n");
}

export { SERVER_REGIONS, SERVER_STATUS_META };
export type { ServerStatus, TestingServer };
