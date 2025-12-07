import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: 'es6',
      dts: {
        distPath: './types'
      },
      bundle: false,
      output: {
        filename: {
          js: '[name].mjs'
        },
        distPath: {
          root: './esm'
        }
      }
    },
    {
      format: 'cjs',
      syntax: 'es5',
      bundle: false,
      output: {
        filename: {
          js: '[name].cjs'
        },
        distPath: {
          root: './cjs'
        }
      }
    },
  ]
});
