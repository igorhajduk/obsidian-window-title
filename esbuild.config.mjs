import { build, context } from 'esbuild';
import { mkdir, copyFile, readFile } from 'node:fs/promises';

const options = {
  entryPoints: ['src/main.ts'], bundle: true, format: 'cjs', target: 'es2022',
  external: ['obsidian'], outfile: 'main.js', sourcemap: false,
  banner: { js: '/*!\n' + (await readFile('LICENSE', 'utf8')).trim() + '\n*/' },
};
if (process.argv.includes('--watch')) {
  const ctx = await context(options);
  await ctx.watch();
} else {
  await build(options);
  await mkdir('dist', { recursive: true });
  for (const name of ['main.js', 'manifest.json', 'styles.css']) await copyFile(name, `dist/${name}`);
}
