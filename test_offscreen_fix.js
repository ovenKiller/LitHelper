/**
 * 测试 offscreen 文档管理修复
 */

import { httpService } from './src/background/service/httpService.js';
import { htmlParserService } from './src/background/service/htmlParserService.js';
import { offscreenManager } from './src/background/service/offscreenManager.js';
import { logger } from './src/util/logger.js';

async function testOffscreenFix() {
  logger.log('[Test] 开始测试 offscreen 文档管理修复');
  
  try {
    // 测试 1: 检查初始状态
    logger.log('[Test] 1. 检查初始状态...');
    let status = await offscreenManager.getStatus();
    logger.log('[Test] 初始状态:', status);
    
    // 测试 2: 通过 HttpService 创建 offscreen 文档
    logger.log('[Test] 2. 通过 HttpService 测试...');
    const testUrl = 'https://httpbin.org/html';
    
    try {
      const html = await httpService.getHtml(testUrl);
      logger.log(`[Test] ✅ HttpService 测试成功，HTML 长度: ${html.length}`);
    } catch (error) {
      logger.error('[Test] ❌ HttpService 测试失败:', error);
    }
    
    // 测试 3: 检查 offscreen 文档状态
    logger.log('[Test] 3. 检查 offscreen 文档状态...');
    status = await offscreenManager.getStatus();
    logger.log('[Test] HttpService 后状态:', status);
    
    // 测试 4: 通过 HtmlParserService 使用同一个 offscreen 文档
    logger.log('[Test] 4. 通过 HtmlParserService 测试...');
    
    try {
      const testHtml = '<div class="test">Hello World</div><p class="test">Test paragraph</p>';
      const elements = await htmlParserService.extractTextContent(testHtml, '.test');
      logger.log(`[Test] ✅ HtmlParserService 测试成功，提取到 ${elements.length} 个元素:`, elements);
    } catch (error) {
      logger.error('[Test] ❌ HtmlParserService 测试失败:', error);
    }
    
    // 测试 5: 最终状态检查
    logger.log('[Test] 5. 最终状态检查...');
    status = await offscreenManager.getStatus();
    logger.log('[Test] 最终状态:', status);
    
    // 测试 6: 并发测试
    logger.log('[Test] 6. 并发测试...');
    
    const promises = [
      httpService.getHtml('https://httpbin.org/json'),
      htmlParserService.extractTextContent('<span>Test 1</span>', 'span'),
      htmlParserService.extractTextContent('<div>Test 2</div>', 'div')
    ];
    
    try {
      const results = await Promise.all(promises);
      logger.log('[Test] ✅ 并发测试成功，所有操作完成');
      logger.log('[Test] 结果数量:', results.map(r => Array.isArray(r) ? r.length : (typeof r === 'string' ? r.length : 'unknown')));
    } catch (error) {
      logger.error('[Test] ❌ 并发测试失败:', error);
    }
    
    // 最终状态
    status = await offscreenManager.getStatus();
    logger.log('[Test] 并发测试后状态:', status);
    
    logger.log('[Test] ✅ offscreen 文档管理修复测试完成');
    
  } catch (error) {
    logger.error('[Test] ❌ 测试过程中发生错误:', error);
  }
}

// 如果在浏览器环境中运行
if (typeof window !== 'undefined') {
  window.testOffscreenFix = testOffscreenFix;
}

export { testOffscreenFix };
