import fs from 'fs';
import { promisify } from 'util';
import fetch from 'node-fetch';
import { spawn } from 'child_process';
import { parse } from 'ts-command-line-args';
import { gitToJs } from 'git-parse';
import fastFolderSize from 'fast-folder-size';

const art = `
██████████████████▓▓▒▒░░░░░░░░░░
███████████████████████▓▒░░░░░░░
██████████████████████████▓░░░░░
████████████████████████████▒░░░
████████████▓▒▒▒▒▒▒▓█████████▓░░
██████████▒▒▒▒▒▒▒▓▓▓▒▒████████▒░
█████████░▒░░▒▓▓▓▓▓▓▓▓▒▓██████▓░
████████▒▓░░▓▓▓▓██▓▓▓▓▓░███████░
████████▒▓▒▓▓▓████▓▓▓▓▓░███████░
████████▓▒▓▓▓▓▓▓▓▓▓▓▓▓▒▓███████░
████████▓░░▓▓▓▓▓▓▓▓▓▓▒▓███████▓░
██████▒▒▓██▓▒▒▒▒▒▒▒▒▓█████████░░
███▓▒▒███████████████████████▒░░
▓▒▒▓████████████████████████▒░░░
▒█████████████████████████▒░░░░░
███████████████████████▓▒░░░░░░░
`;

interface Arguments {
  apiKey: string;
  buildPath: string;
  url?: string;
  help?: boolean;
}

const { apiKey, url, buildPath } = parse<Arguments>(
  {
    apiKey: { type: String },
    url: { type: String, optional: true, defaultValue: 'localhost' },
    buildPath: String,
    help: {
      type: Boolean,
      optional: true,
      alias: 'h',
      description: 'Prints this usage guide',
    },
  },
  {
    helpArg: 'help',
  }
);
function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

const sendData = async (buildTime: number) => {
  // getFolderSize(buildPath, (err, size) => console.log(size));
  await calculateBuildSize();

  async function calculateBuildSize() {
    const getFolderSize = promisify(fastFolderSize);
    try {
      const size = await getFolderSize(buildPath);
      console.log(formatBytes(size!));
    } catch (err) {
      console.error('Error reading build directory: ' + err);
    }
  }
};

const start = Date.now();
const buildProc = spawn('node', ['dist/dummy.js']);

buildProc.stdout.on('data', (data) => {
  console.log(data);
});

buildProc.stderr.on('data', (data) => {
  console.log({ data });
});

buildProc.on('close', (code) => {
  console.log(`build completed with code ${code}`);
  const buildTime = Date.now() - start;
  console.log(`Build time: ${buildTime}ms`);
  sendData(buildTime);
});
