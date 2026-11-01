import { callBridge } from './bridge';

export const scanLocalArchives = (dir) =>
  callBridge({
    namespace: 'local',
    method: 'scanLocalArchives',
    args: [dir],
  });

export const readFile = (filePath) =>
  callBridge({ namespace: 'local', method: 'readFile', args: [filePath] });

export const writeFile = (payload) =>
  callBridge({
    namespace: 'local',
    method: 'writeFile',
    args: [payload],
  });
