// A simple logger utility

const LOG_LEVELS = {
  DEBUG: 0,
  LOG: 1,
  INFO: 1, // Alias for LOG
  WARN: 2,
  ERROR: 3,
  NONE: 4, // Disable all logs
};

// TODO: Make this configurable, perhaps through extension settings
let currentLogLevel = LOG_LEVELS.DEBUG;

function canLog(level) {
  return level >= currentLogLevel;
}

function formatMessage(level, ...args) {
  const timestamp = new Date().toISOString();
  const levelName = Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === level) || 'LOG';
  return [`[${timestamp}] [${levelName}]`, ...args];
}

const logger = {
  setLevel: (levelName) => {
    const newLevel = LOG_LEVELS[levelName.toUpperCase()];
    if (typeof newLevel === 'number') {
      currentLogLevel = newLevel;
      console.log(...formatMessage(LOG_LEVELS.LOG, `Log level set to ${levelName.toUpperCase()}`));
    } else {
      console.warn(...formatMessage(LOG_LEVELS.WARN, `Invalid log level: ${levelName}`));
    }
  },
  
  debug: (...args) => {
    if (canLog(LOG_LEVELS.DEBUG)) {
      console.debug(...formatMessage(LOG_LEVELS.DEBUG, ...args));
    }
  },
  
  log: (...args) => {
    if (canLog(LOG_LEVELS.LOG)) {
      console.log(...formatMessage(LOG_LEVELS.LOG, ...args));
    }
  },
  
  info: (...args) => {
    if (canLog(LOG_LEVELS.INFO)) {
      console.info(...formatMessage(LOG_LEVELS.INFO, ...args));
    }
  },
  
  warn: (...args) => {
    if (canLog(LOG_LEVELS.WARN)) {
      console.warn(...formatMessage(LOG_LEVELS.WARN, ...args));
    }
  },
  
  error: (...args) => {
    if (canLog(LOG_LEVELS.ERROR)) {
      console.error(...formatMessage(LOG_LEVELS.ERROR, ...args));
    }
  },
};

export { logger, LOG_LEVELS }; 