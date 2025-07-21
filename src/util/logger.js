// 简单的logger工具，统一日志输出
// 支持log/debug/warn/error，后续可扩展写入文件、远程等

const isDev = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development';

export const logger = {
  log: (...args) => {
    if (isDev) {
      console.log('[LOG]', ...args);
    } else {
      console.log(...args);
    }
  },
  debug: (...args) => {
    if (isDev) {
      console.debug('[DEBUG]', ...args);
    }
  },
  warn: (...args) => {
    console.warn('[WARN]', ...args);
  },
  error: (...args) => {
    console.error('[ERROR]', ...args);
  }
}; 