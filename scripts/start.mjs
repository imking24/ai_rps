import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const marker = join(root, 'node_modules', '.rps-install.sha256');
const url = 'http://127.0.0.1:5173';
let server;

function findNpm() {
  // Prefer the CLI used to invoke us, then standard Node.js installations.
  const candidates = [
    process.env.npm_execpath,
    join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    join(dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    join(root, '.tools', 'package', 'bin', 'npm-cli.js'),
  ];
  if (process.platform === 'win32') {
    const locations = spawnSync('where.exe', ['npm.cmd'], { encoding: 'utf8', windowsHide: true });
    for (const location of (locations.stdout || '').trim().split(/\r?\n/).filter(Boolean)) {
      candidates.push(join(dirname(location), 'node_modules', 'npm', 'bin', 'npm-cli.js'));
    }
  }
  const cli = candidates.find(candidate => candidate && existsSync(candidate));
  if (cli) return [process.execPath, cli];
  if (process.platform !== 'win32') {
    const probe = spawnSync('npm', ['--version'], { stdio: 'ignore' });
    if (probe.status === 0) return ['npm'];
  }
  throw new Error('未找到 npm。请安装包含 npm 的 Node.js 24 LTS，再重新启动：https://nodejs.org/');
}

function hasDependencies(manifest, lock) {
  // Reuse an existing npm installation, including one made with ordinary npm ci.
  const declared = { ...manifest.dependencies, ...manifest.devDependencies };
  return Object.keys(declared).every(name => {
    try {
      const installed = JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8'));
      return installed.version === lock.packages[`node_modules/${name}`]?.version;
    } catch {
      return false;
    }
  }) && existsSync(join(root, 'node_modules', 'vite', 'dist', 'node', 'index.js'));
}

async function installDependencies() {
  const [command, ...args] = findNpm();
  console.log('正在安装锁定版本的依赖，首次运行可能需要几分钟，请保持网络连接。');
  await new Promise((resolveInstall, rejectInstall) => {
    const child = spawn(command, [...args, 'ci', '--include=dev', '--include=optional'], {
      cwd: root,
      stdio: 'inherit',
      windowsHide: true,
      // npm install scripts need the same Node.js even when it is not on PATH.
      env: { ...process.env, PATH: `${dirname(process.execPath)}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH || ''}` },
    });
    child.once('error', rejectInstall);
    child.once('exit', (code, signal) => {
      if (code === 0) resolveInstall();
      else rejectInstall(new Error(`依赖安装未完成（${signal || `退出码 ${code}`}）。请检查网络和 npm 输出后重试；也可在项目目录手动运行 npm ci。`));
    });
  });
}

async function shutdown() {
  if (server) await server.close();
  process.exit(0);
}

async function main() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 13)) {
    throw new Error(`当前 Node.js 为 ${process.versions.node}，需要 22.13 或更高版本，建议安装 Node.js 24 LTS。`);
  }
  const options = process.argv.slice(2);
  if (options.some(option => option !== '--no-open')) {
    throw new Error('不支持的参数。使用 node scripts/start.mjs，或添加 --no-open 仅启动服务。');
  }
  process.chdir(root);
  console.log('\nAI 猜拳挑战赛 · 一键启动\n');
  const manifestText = readFileSync(join(root, 'package.json'), 'utf8');
  const lockText = readFileSync(join(root, 'package-lock.json'), 'utf8');
  const fingerprint = createHash('sha256').update(manifestText).update(lockText).digest('hex');
  const previous = existsSync(marker) ? readFileSync(marker, 'utf8').trim() : null;
  const ready = hasDependencies(JSON.parse(manifestText), JSON.parse(lockText));
  if (!ready || (previous && previous !== fingerprint)) await installDependencies();
  else console.log('依赖已就绪，正在启动游戏……');
  writeFileSync(marker, `${fingerprint}\n`);

  const { createServer } = await import(pathToFileURL(join(root, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href);
  server = await createServer({
    root,
    server: { host: '127.0.0.1', port: 5173, strictPort: true, open: options.includes('--no-open') ? false : url },
  });
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  await server.listen();
  console.log(`\n游戏已启动：${url}`);
  console.log('如果浏览器没有自动打开，请手动访问上面的地址。');
  console.log('游戏运行时请保留此窗口；按 Ctrl+C 停止服务。\n');
}

main().catch(async error => {
  console.error(`\n启动失败：${error.message}`);
  if (error.code === 'EADDRINUSE' || /port .*in use/i.test(error.message)) {
    console.error('5173 端口已被占用。若游戏已启动，请直接访问上面的地址；否则请关闭占用该端口的程序后重试。');
    console.error(`游戏地址：${url}`);
  }
  if (error.code === 'ENOENT') console.error('项目文件可能不完整，请完整下载或克隆仓库后重试。');
  if (server) await server.close().catch(() => {});
  process.exitCode = 1;
});
