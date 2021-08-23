import { defineConfig } from 'rollup';
import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import scss from 'rollup-plugin-scss';
import { terser } from 'rollup-plugin-terser';

const isProd = process.env.BUILD === 'production';
const plugins = [typescript(), nodeResolve({ browser: true }), commonjs(), scss({ output: 'styles.css' })];

if (isProd) {
  plugins.push(terser());
}

export default defineConfig({
  input: 'main.ts',
  output: {
    dir: '.',
    sourcemap: isProd ? false : 'inline',
    format: 'cjs',
    exports: 'default'
  },
  external: ['obsidian'],
  plugins
});
