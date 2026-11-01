import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createUserConfigTemplate,
  redactConfigSecrets,
} from '../../shared/config-contract.mjs';

const { electronMock, fsMock, loggerMock } = vi.hoisted(() => ({
  electronMock: {
    app: {
      getPath: vi.fn((key) => {
        if (key === 'userData') return 'C:\\test-user-data';
        if (key === 'documents') return 'C:\\test-documents';
        return `C:\\test-${key}`;
      }),
      emit: vi.fn(),
    },
    ipcMain: {
      handle: vi.fn(),
      removeHandler: vi.fn(),
    },
  },
  fsMock: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  },
  loggerMock: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('electron', () => electronMock);
vi.mock('fs', () => ({ default: fsMock }));
vi.mock('../utils/logger', () => ({ createLogSender: () => loggerMock }));

describe('config module', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('logs blank dataDir fallback only once', async () => {
    const defaultConfigPath = path.join('C:\\test-user-data', 'config.json');
    const defaultDataDir = path.join('C:\\test-user-data', 'data');

    fsMock.existsSync.mockImplementation((filePath) => filePath === defaultConfigPath);
    fsMock.readFileSync.mockImplementation((filePath) => {
      if (filePath === defaultConfigPath) {
        return JSON.stringify({ paths: { dataDir: '   ' } });
      }
      throw new Error(`Unexpected read: ${filePath}`);
    });

    const { getDataDir } = await import('./config');
    expect(getDataDir()).toBe(defaultDataDir);
    expect(getDataDir()).toBe(defaultDataDir);
    expect(getDataDir()).toBe(defaultDataDir);
    expect(loggerMock.debug).toHaveBeenCalledTimes(1);
    expect(loggerMock.debug).toHaveBeenCalledWith(
      `[getDataDir] config.paths.dataDir is empty, using default: ${defaultDataDir}`,
    );
  });

  it('preserves optional config sections and adds defaults for old config files', async () => {
    const defaultConfigPath = path.join('C:\\test-user-data', 'config.json');
    fsMock.existsSync.mockImplementation((filePath) => filePath === defaultConfigPath);
    fsMock.readFileSync.mockImplementation((filePath) => {
      if (filePath === defaultConfigPath) {
        return JSON.stringify({
          tg: { apiId: '123' },
          experimentalFeature: { enabled: true },
        });
      }
      throw new Error(`Unexpected read: ${filePath}`);
    });

    const { getConfig } = await import('./config');
    const config = getConfig();

    expect(config.tg.apiId).toBe('123');
    expect(config.tg.apiHash).toBe('');
    expect(config.translationAutomation.enabled).toBe(false);
    expect(config.experimentalFeature.enabled).toBe(true);
  });

  it('returns a fresh default configuration object for each call', async () => {
    fsMock.existsSync.mockReturnValue(false);
    const { getDefaultConfig } = await import('./config');
    const first = getDefaultConfig();
    first.tg.apiId = 'mutated';

    expect(getDefaultConfig().tg.apiId).toBe('');
  });

  it('loads a template-shaped config without losing schema-only fields', async () => {
    const defaultConfigPath = path.join('C:\\test-user-data', 'config.json');
    const template = createUserConfigTemplate();
    fsMock.existsSync.mockImplementation((filePath) => filePath === defaultConfigPath);
    fsMock.readFileSync.mockImplementation((filePath) => {
      if (filePath === defaultConfigPath) return JSON.stringify(template);
      throw new Error(`Unexpected read: ${filePath}`);
    });

    const { getConfig } = await import('./config');
    const config = getConfig();

    expect(config.translationAutomation.maxWorksPerCycle).toBe(3);
    expect(config.paths.uploadHistoryDir).toBe(path.join('C:\\test-user-data', 'data', 'upload_history'));
  });

  it('redacts secret fields for diagnostics without mutating config', () => {
    const config = { tg: { apiHash: 'hash', botToken: 'token' }, asmr: { username: 'u' } };
    const safe = redactConfigSecrets(config);

    expect(safe.tg.apiHash).toBe('[REDACTED]');
    expect(safe.tg.botToken).toBe('[REDACTED]');
    expect(config.tg.apiHash).toBe('hash');
  });
});
