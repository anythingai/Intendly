import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'client/SolverClient': 'src/client/SolverClient.ts',
    'strategies/index': 'src/strategies/AggressiveStrategy.ts',
    'quotes/sources/index': 'src/quotes/sources/OneInchSource.ts'
  },
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  minify: process.env.NODE_ENV === 'production',
  external: [
    'viem',
    'ws',
    'axios',
    'ethers',
    'eventemitter3',
    'abitype'
  ],
  target: 'node18',
  platform: 'node',
  esbuildOptions(options) {
    options.conditions = ['node'];
    options.mainFields = ['module', 'main'];
  },
  onSuccess: async () => {
    console.log('✅ Build completed successfully');
  },
});