import { storage } from '../../utils/storage';
import { logger } from '../utils/logger.js';
import { notificationService } from '../services/notificationService.js';

// 初始化默认配置
let currentConfig = {
  llm: {
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    apiKey: ''
  },
  summarization: {
    categories: [
      { id: 'methodology', name: 'Methodology', enabled: true },
      { id: 'findings', name: 'Key Findings', enabled: true },
      { id: 'limitations', name: 'Limitations', enabled: true },
      { id: 'futureWork', name: 'Future Work', enabled: true }
    ]
  },
  platforms: {
    googleScholar: { enabled: true },
    ieee: { enabled: true },
    acm: { enabled: true },
    arxiv: { enabled: true }
  }
};

async function loadInitialConfig() {
  try {
    logger.log('[ConfigManager] Attempting to load configuration...');
    const savedConfig = await storage.get('config');
    logger.debug('[ConfigManager] storage.get("config") raw result:', savedConfig);
    
    if (savedConfig && typeof savedConfig === 'object') {
      // 合并加载的配置和默认配置，以确保所有键都存在
      // 并且新添加的默认配置项能够生效
      currentConfig = deepMerge(currentConfig, savedConfig);
      logger.log('[ConfigManager] Configuration loaded successfully.', currentConfig);
    } else {
      logger.log('[ConfigManager] No saved configuration found, using default configuration and saving it.');
      // 如果没有已保存的配置，则保存当前默认配置
      await storage.set('config', currentConfig);
    }
  } catch (error) {
    logger.error('[ConfigManager] Failed to load configuration:', error);
    // 即使加载失败，也保持默认配置
  }
  return currentConfig; // 返回加载或默认的配置
}

function getConfig() {
  logger.debug('[ConfigManager] getConfig called, returning current config:', currentConfig);
  return { ...currentConfig }; // 返回副本以防外部修改
}

async function updateConfig(newPartialConfig) {
  try {
    logger.log('[ConfigManager] Attempting to update configuration with:', newPartialConfig);
    const oldConfigSnapshot = JSON.stringify(currentConfig);
    
    currentConfig = deepMerge(currentConfig, newPartialConfig);
    
    await storage.set('config', currentConfig);
    logger.log('[ConfigManager] Configuration updated and saved.', currentConfig);

    // 检查配置是否实际更改，避免不必要的通知
    if (JSON.stringify(currentConfig) !== oldConfigSnapshot) {
      // 此处传递 newPartialConfig 符合之前 background.js 的行为，
      // 即通知时只发送变更的部分。如果需要发送完整配置，应传递 currentConfig。
      await notificationService.notifyAllTabs('updateConfig', newPartialConfig, 'ConfigManager');
      logger.log('[ConfigManager] Configuration change notification sent with partial update.');
    } else {
      logger.log('[ConfigManager] Configuration did not change, no notification sent.');
    }
    return { success: true, config: { ...currentConfig } };
  } catch (error) {
    logger.error('[ConfigManager] Failed to update configuration:', error);
    return { success: false, error: error.message || 'Failed to update configuration' };
  }
}

// 简单的深合并函数，用于合并配置对象
// 注意: 这个简单的实现不能处理所有边缘情况 (例如 Date, RegExp, Arrays of objects merging)
// 对于更复杂的场景，可能需要一个更健壮的库
function deepMerge(target, source) {
  const output = { ...target };
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}

function isObject(item) {
  return (item && typeof item === 'object' && !Array.isArray(item));
}


export const configManager = {
  loadInitialConfig,
  getConfig,
  updateConfig
}; 