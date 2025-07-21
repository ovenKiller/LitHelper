import { logger } from '../../util/logger.js';

const CONTEXT_MENU_ITEMS = [
  {
    id: 'open-settings',
    title: '打开设置页面',
    contexts: ['action']
  }
  // 你可以在这里添加更多的菜单项配置
];

function createAllContextMenus() {
  // 先移除所有已存在的菜单项，以避免重复创建，特别是在SW重启时
  chrome.contextMenus.removeAll(() => {
    if (chrome.runtime.lastError) {
      // 在某些情况下（例如，没有先前菜单时），removeAll可能会设置lastError，但这通常不是问题
      // logger.debug('[ContextMenuService] Error during removeAll (often ignorable):', chrome.runtime.lastError.message);
    }
    for (const item of CONTEXT_MENU_ITEMS) {
      chrome.contextMenus.create({
        id: item.id,
        title: item.title,
        contexts: item.contexts
      });
    }
    logger.log('[ContextMenuService] Context menus created/recreated.');
  });
}

function handleMenuClick(info, tab) {
  logger.log('[ContextMenuService] Menu item clicked:', info.menuItemId, 'Tab:', tab);
  if (info.menuItemId === 'open-settings') {
    // 考虑是否需要一个 chromeUtils.js 来封装这个API调用
    chrome.runtime.openOptionsPage();
  }
  // 在这里处理其他菜单项的点击事件
}

function initializeContextMenus() {
  createAllContextMenus();
  // 确保只添加一次监听器，或者在 service worker 重启时能正确处理
  // chrome.contextMenus.onClicked.removeListener(handleMenuClick); // 如果需要确保只有一个监听器
  chrome.contextMenus.onClicked.addListener(handleMenuClick);
  logger.log('[ContextMenuService] Context menu click listener initialized.');
}

export const contextMenuService = {
  initializeContextMenus,
  // 如果需要动态添加或移除菜单项，可以暴露更多方法
  // createAllContextMenus // 也可以选择性暴露
}; 