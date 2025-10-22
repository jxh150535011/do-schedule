import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: ['node 18'],
      dts: {
        distPath: './types'
      },
      bundle: false,
      output: {
        distPath: {
          root: './esm'
        }
      }
    },
    {
      format: 'cjs',
      syntax: ['node 18'],
      bundle: false,
      output: {
        distPath: {
          root: './dist'
        }
      }
    },
  ],
  output: {
    
  },
});
