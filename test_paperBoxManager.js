/**
 * 简单测试脚本，验证 paperBoxManager 更新后的功能
 */

import { paperBoxManager } from './src/background/feature/paperBoxManager.js';
import { runTimeDataService } from './src/service/runTimeDataService.js';
import { messageService } from './src/background/service/messageService.js';

// 模拟论文数据
const testPaper = {
  id: 'test-paper-001',
  title: 'Test Paper Title',
  authors: ['Author 1', 'Author 2'],
  abstract: 'This is a test paper abstract.',
  pdfUrl: 'https://example.com/test-paper.pdf',
  timestamp: Date.now()
};

async function testPaperBoxManager() {
  console.log('开始测试 paperBoxManager...');
  
  try {
    // 测试 1: 加载初始数据
    console.log('\n=== 测试 1: 加载初始数据 ===');
    const initialData = await paperBoxManager.loadInitialPaperBoxData();
    console.log('初始数据:', initialData);
    
    // 测试 2: 添加论文
    console.log('\n=== 测试 2: 添加论文 ===');
    const addResult = await paperBoxManager.addPaper(testPaper);
    console.log('添加结果:', addResult);
    
    // 测试 3: 获取论文盒子数据
    console.log('\n=== 测试 3: 获取论文盒子数据 ===');
    const paperBoxData = paperBoxManager.getPaperBox();
    console.log('论文盒子数据:', paperBoxData);
    
    // 测试 4: 移除论文
    console.log('\n=== 测试 4: 移除论文 ===');
    const removeResult = await paperBoxManager.removePaper(testPaper.id);
    console.log('移除结果:', removeResult);
    
    // 测试 5: 清空论文盒子
    console.log('\n=== 测试 5: 清空论文盒子 ===');
    const clearResult = await paperBoxManager.clearAllPapers();
    console.log('清空结果:', clearResult);
    
    console.log('\n✅ 所有测试完成');
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 如果直接运行此文件，执行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  testPaperBoxManager();
}

export { testPaperBoxManager };
