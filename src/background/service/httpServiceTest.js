/**
 * httpServiceTest.js
 * 
 * 简单的 HttpService 测试
 */

import { httpService } from './httpService.js';
import { logger } from '../../util/logger.js';

/**
 * 测试 HttpService 的 offscreen API 功能
 */
export async function testHttpService() {
  logger.log('[HttpServiceTest] 开始测试 HttpService');
  
  const testUrls = [
    'https://scholar.google.com/scholar?q=machine+learning',
    'https://research.rug.nl/en/publications/the-role-of-attention',
    'https://arxiv.org/abs/2301.00001'
  ];

  for (const url of testUrls) {
    try {
      logger.log(`[HttpServiceTest] 测试 URL: ${url}`);
      const startTime = Date.now();
      
      const html = await httpService.getHtml(url);
      
      const endTime = Date.now();
      const time = endTime - startTime;
      
      logger.log(`[HttpServiceTest] ✅ 成功获取: ${url}`);
      logger.log(`[HttpServiceTest] 耗时: ${time}ms, 长度: ${html.length}`);
      
      // 检查是否包含基本的HTML结构
      const hasTitle = html.includes('<title>');
      const hasBody = html.includes('<body>');
      logger.log(`[HttpServiceTest] 内容检查: title=${hasTitle}, body=${hasBody}`);
      
    } catch (error) {
      logger.error(`[HttpServiceTest] ❌ 获取失败: ${url}`, error);
    }
    
    // 添加延迟避免被限制
    await httpService.delay(2000);
  }
  
  logger.log('[HttpServiceTest] 测试完成');
}

// 在 background script 中可以调用：
// import { testHttpService } from './httpServiceTest.js';
// testHttpService();
