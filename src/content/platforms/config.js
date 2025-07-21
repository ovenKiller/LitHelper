/**
 * 平台配置管理
 */

import { PLATFORM_KEYS, PLATFORM_TYPES } from '../../constants';

export const PLATFORM_CONFIG = {
  // 搜索平台配置
  [PLATFORM_TYPES.SEARCH]: {
    [PLATFORM_KEYS.GOOGLE_SCHOLAR]: {
      patterns: ['scholar.google.com'],
      extractors: ['searchResults', 'citations', 'versions']
    },
    [PLATFORM_KEYS.SEMANTIC_SCHOLAR]: {
      patterns: ['semanticscholar.org'],
      extractors: ['searchResults', 'citations', 'references']
    }
  },
  
  // 论文库配置
  [PLATFORM_TYPES.REPOSITORY]: {
    [PLATFORM_KEYS.ARXIV]: {
      patterns: ['arxiv.org'],
      extractors: ['metadata', 'pdf', 'citations', 'versions']
    },
    [PLATFORM_KEYS.IEEE]: {
      patterns: ['ieeexplore.ieee.org'],
      extractors: ['metadata', 'pdf', 'citations', 'references']
    },
    [PLATFORM_KEYS.SCIENCE_DIRECT]: {
      patterns: ['sciencedirect.com'],
      extractors: ['metadata', 'pdf', 'citations', 'references']
    },
    [PLATFORM_KEYS.SPRINGER]: {
      patterns: ['link.springer.com'],
      extractors: ['metadata', 'pdf', 'citations', 'references']
    },
    [PLATFORM_KEYS.ACM]: {
      patterns: ['dl.acm.org'],
      extractors: ['metadata', 'pdf', 'citations', 'references']
    }
  }
};

/**
 * 获取平台类型（搜索平台或论文库）
 * @param {string} url - 要检查的URL
 * @returns {string|null} 'search' 或 'repository' 或 null
 */
export function getPlatformType(url) {
  for (const [type, platforms] of Object.entries(PLATFORM_CONFIG)) {
    for (const [platform, config] of Object.entries(platforms)) {
      if (config.patterns.some(pattern => url.includes(pattern))) {
        return type;
      }
    }
  }
  return null;
}

/**
 * 获取平台名称
 * @param {string} url - 要检查的URL
 * @returns {string|null} 平台名称或null
 */
export function getPlatformName(url) {
  for (const platforms of Object.values(PLATFORM_CONFIG)) {
    for (const [platform, config] of Object.entries(platforms)) {
      if (config.patterns.some(pattern => url.includes(pattern))) {
        return platform;
      }
    }
  }
  return null;
}

/**
 * 获取平台配置
 * @param {string} url - 要检查的URL
 * @returns {Object|null} 平台配置或null
 */
export function getPlatformConfig(url) {
  const type = getPlatformType(url);
  if (!type) return null;
  
  const platform = getPlatformName(url);
  if (!platform) return null;
  
  return PLATFORM_CONFIG[type][platform];
} 