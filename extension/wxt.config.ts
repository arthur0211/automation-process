import { defineConfig } from 'wxt';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  srcDir: '.',
  outDir: '.output',

  vite: () => ({
    plugins: [preact(), tailwindcss()],
  }),

  manifest: {
    name: 'Agentic Automation Recorder',
    description: 'Record and document web processes for humans and LLMs',
    version: '1.0.0',
    permissions: [
      'activeTab',
      'tabs',
      'scripting',
      'tabCapture',
      'offscreen',
      'storage',
      'unlimitedStorage',
      'sidePanel',
    ],
    host_permissions: ['https://generativelanguage.googleapis.com/*'],
    commands: {
      'start-recording': {
        suggested_key: { default: 'Ctrl+Shift+R' },
        description: 'Start recording',
      },
      'pause-recording': {
        suggested_key: { default: 'Ctrl+Shift+P' },
        description: 'Pause/Resume recording',
      },
      'stop-recording': {
        suggested_key: { default: 'Ctrl+Shift+S' },
        description: 'Stop recording',
      },
    },
  },
});
