import { createConnection } from 'node:net';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const vaultPath = fileURLToPath(new URL('../.lab/Title Lab', import.meta.url));

export async function command(vault, ...args) {
  return new Promise((resolve, reject) => {
    const socket = createConnection(path.join(homedir(), '.obsidian-cli.sock'));
    let output = '';
    socket.setEncoding('utf8');
    socket.setTimeout(30000, () => socket.destroy(new Error('Obsidian CLI timeout')));
    socket.on('connect', () => socket.write(JSON.stringify({ argv: [`vault=${vault}`, ...args], tty: false, cwd: process.cwd() }) + '\n'));
    socket.on('data', chunk => output += chunk);
    socket.on('end', () => output.startsWith('Error:') ? reject(new Error(output.trim())) : resolve(output.trim()));
    socket.on('error', reject);
  });
}

export async function evaluate(code) {
  return command('Title Lab', 'eval', `code=if(app.vault.adapter.basePath!==${JSON.stringify(vaultPath)})throw Error('Expected this checkout’s Title Lab');${code}`);
}

export async function value(expression) {
  return JSON.parse((await evaluate(`JSON.stringify(${expression})`)).replace(/^=> /, ''));
}

export async function job(code, timeout = 25000) {
  await evaluate(`window.__titleLabJob={pending:true};Promise.resolve().then(async()=>{${code}}).then(value=>window.__titleLabJob={value},error=>window.__titleLabJob={error:String(error),stack:error.stack});'started'`);
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const state = await value('window.__titleLabJob');
    if (state.error) throw new Error(state.stack ?? state.error);
    if (!state.pending) return state.value;
    await new Promise(resolve => setTimeout(resolve, 80));
  }
  throw new Error('Lab operation timed out');
}
