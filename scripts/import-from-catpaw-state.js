const fs = require('fs');
const path = require('path');

function discoverInstallDir() {
  if (process.env.CATPAWAI_INSTALL_DIR) {
    return process.env.CATPAWAI_INSTALL_DIR;
  }
  if (process.env.CATPAWAI_CLI_PATH) {
    return path.dirname(path.dirname(process.env.CATPAWAI_CLI_PATH));
  }

  const commonPaths = [
    'D:/Computers/Ide/CatPawAI',
    'D:/Programs/CatPawAI',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'CatPawAI'),
    'C:/Programs/CatPawAI',
    'C:/Program Files/CatPawAI'
  ];
  for (const p of commonPaths) {
    if (fs.existsSync(path.join(p, 'resources/app/node_modules/@vscode/sqlite3'))) {
      return p;
    }
  }

  try {
    const { execSync } = require('child_process');
    const cmd = 'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall" /s /f "CatPawAI" /k';
    const output = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const match = output.match(/Uninstall\\([^\r\n]+)/);
    if (match) {
      const key = match[1];
      const detailCmd = `reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${key}" /v "InstallLocation"`;
      const detailOutput = execSync(detailCmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const locMatch = detailOutput.match(/InstallLocation\s+REG_SZ\s+([^\r\n]+)/);
      if (locMatch && locMatch[1]) {
        return locMatch[1].trim();
      }
    }
  } catch (e) {
    // ignore
  }

  return 'D:/Programs/CatPawAI';
}

const INSTALL_DIR = discoverInstallDir();
const SQLITE3_PATH = path.join(INSTALL_DIR, 'resources/app/node_modules/@vscode/sqlite3');
const STATE_DB_PATH = path.join(
  process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData/Roaming'),
  'CatPawAI',
  'User',
  'globalStorage',
  'state.vscdb'
);
const ENV_PATH = path.resolve(__dirname, '..', '.env');
const ENV_EXAMPLE_PATH = path.resolve(__dirname, '..', '.env.example');
const STORAGE_KEY = 'mt-idekit.mt-idekit-code';
const DEFAULT_EXTERNAL_TENANT = '5282fa6645';
const DEFAULT_INTERNAL_TENANT = '4391f0be98';
const DEFAULT_IDE_VERSION = '2026.2.3';
const DEFAULT_PLUGIN_VERSION = '2026.2.2';

function loadSqlite3() {
  try {
    return require(SQLITE3_PATH);
  } catch (error) {
    throw new Error(`Cannot load CatPawAI sqlite module from "${SQLITE3_PATH}": ${error.message}`);
  }
}

function readStorageValue(sqlite3) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(STATE_DB_PATH, sqlite3.OPEN_READONLY, (error) => {
      if (error) reject(error);
    });
    db.get('SELECT value FROM ItemTable WHERE key = ?', [STORAGE_KEY], (error, row) => {
      db.close();
      if (error) {
        reject(error);
        return;
      }
      if (!row) {
        reject(new Error(`Missing storage key: ${STORAGE_KEY}`));
        return;
      }
      const raw = Buffer.isBuffer(row.value) ? row.value.toString('utf8') : String(row.value);
      resolve(JSON.parse(raw));
    });
  });
}

function readEnvLines() {
  if (fs.existsSync(ENV_PATH)) return fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/);
  if (fs.existsSync(ENV_EXAMPLE_PATH)) return fs.readFileSync(ENV_EXAMPLE_PATH, 'utf8').split(/\r?\n/);
  return [];
}

function setEnvLine(lines, key, value) {
  const sanitized = String(value || '').replace(/\r|\n/g, '');
  let found = false;
  const next = lines.map((line) => {
    if (line.trimStart().startsWith(`${key}=`)) {
      found = true;
      return `${key}=${sanitized}`;
    }
    return line;
  });
  if (!found) next.push(`${key}=${sanitized}`);
  return next;
}

function pickModel(state) {
  const selected = state.mcopilot_agent_context_state__catpaw_selected_modelprod;
  if (selected && typeof selected === 'object' && selected.modelTypeName) return selected.modelTypeName;
  if (selected && typeof selected === 'object' && typeof selected.id === 'string') return selected.id;
  return 'deepseek-v3.2';
}

function pickTenant(state) {
  const config = state.catpaw_extension_app_global_configprod;
  const external = config?.feature?.externalTenant;
  if (external === true || external === 'true') return DEFAULT_EXTERNAL_TENANT;
  if (external === false || external === 'false') return DEFAULT_INTERNAL_TENANT;
  return process.env.CATPAWAI_TENANT || DEFAULT_EXTERNAL_TENANT;
}

function baseUrlForTenant(tenant) {
  if (tenant === DEFAULT_INTERNAL_TENANT) return 'https://catpaw.sankuai.com/api/gpt';
  return 'https://catpaw.meituan.com/api/gpt';
}

async function main() {
  if (!fs.existsSync(STATE_DB_PATH)) {
    throw new Error(`CatPawAI state database not found: ${STATE_DB_PATH}`);
  }
  const sqlite3 = loadSqlite3();
  const state = await readStorageValue(sqlite3);
  const token = state.accessTokenprod;
  const misId = state.userInfoprod?.misId;
  const model = pickModel(state);
  const tenant = pickTenant(state);

  if (!token) throw new Error('CatPawAI accessTokenprod was not found. Please log in to CatPawAI first.');
  if (!misId) throw new Error('CatPawAI userInfoprod.misId was not found. Please log in to CatPawAI first.');

  const newEnv = {
    HOST: '127.0.0.1',
    PORT: '13000',
    CATPAWAI_OPENAI_BASE_URL: baseUrlForTenant(tenant),
    CATPAWAI_AUTH_MODE: 'catpaw',
    CATPAWAI_ACCESS_TOKEN: token,
    CATPAWAI_MIS_ID: misId,
    CATPAWAI_TENANT: tenant,
    CATPAWAI_API_KEY: '',
    CATPAWAI_MODEL: model,
    CATPAWAI_IDE_VERSION: DEFAULT_IDE_VERSION,
    CATPAWAI_PLUGIN_VERSION: DEFAULT_PLUGIN_VERSION,
    CATPAWAI_CLI_PATH: path.join(INSTALL_DIR, 'bin', 'catpawai.cmd')
  };

  // Update process.env dynamically in-memory
  for (const [k, v] of Object.entries(newEnv)) {
    process.env[k] = String(v);
  }

  // Safe file write (avoid crashing if running inside packaged Electron ASAR)
  if (!__dirname.includes('app.asar')) {
    try {
      let lines = readEnvLines();
      for (const [k, v] of Object.entries(newEnv)) {
        lines = setEnvLine(lines, k, v);
      }
      fs.writeFileSync(ENV_PATH, lines.join('\n'), 'utf8');
    } catch (e) {
      console.warn('Could not write to .env file, continuing with in-memory state:', e.message);
    }
  } else {
    console.log('Running inside Electron ASAR. Skipping .env file write.');
  }

  console.log('.env updated from CatPawAI local state.');
  console.log(`Token configured. Length: ${String(token).length}`);
  console.log('mis-id configured.');
  console.log(`Tenant: ${tenant}`);
  console.log(`Model: ${model}`);
  console.log(`Base URL: ${baseUrlForTenant(tenant)}`);
}

module.exports = { importFromCatPawState: main };

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
