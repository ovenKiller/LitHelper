/**
 * paperMetadataService.example.js
 * 
 * PaperMetadataService 使用示例
 * 展示如何正确使用 paperMetadataService 和 Paper 对象
 */

import { paperMetadataService } from './paperMetadataService.js';
import { Paper } from '../../model/Paper.js';
import { PLATFORM_KEYS } from '../../constants.js';

/**
 * 示例1: 创建标准的Paper对象
 */
function createPaperExample() {
  // 方式1: 使用Paper类构造函数
  const paper1 = new Paper({
    id: 'example-paper-1',
    title: 'Deep Learning for Natural Language Processing',
    authors: 'John Doe, Jane Smith',
    abstract: 'This paper presents a comprehensive study of deep learning techniques...',
    urls: ['https://example.com/paper1'],
    pdfUrl: 'https://example.com/paper1.pdf',
    platform: PLATFORM_KEYS.GOOGLE_SCHOLAR,
    sourceUrl: 'https://scholar.google.com/search?q=deep+learning',
    processing: false
  });

  // 方式2: 使用 paperMetadataService 创建标准Paper对象
  const paper2 = paperMetadataService.createStandardPaper({
    id: 'example-paper-2',
    title: 'Machine Learning Applications in Healthcare',
    authors: 'Alice Johnson, Bob Wilson',
    platform: PLATFORM_KEYS.IEEE
  });

  console.log('创建的Paper对象:', paper1, paper2);
  return [paper1, paper2];
}

/**
 * 示例2: 验证Paper对象
 */
function validatePaperExample() {
  const validPaper = {
    id: 'valid-paper',
    title: 'A Valid Research Paper',
    authors: 'Research Author',
    platform: PLATFORM_KEYS.ARXIV
  };

  const invalidPaper = {
    // 缺少必需的id字段
    title: 'Invalid Paper',
    authors: 123, // 错误的类型，应该是字符串
    citationCount: 'not-a-number' // 错误的类型，应该是数字
  };

  console.log('验证有效论文:', paperMetadataService.validatePaper(validPaper));
  console.log('验证无效论文:', paperMetadataService.validatePaper(invalidPaper));
}

/**
 * 示例3: 检查Paper对象完整性
 */
function checkCompletenessExample() {
  const incompletePaper = {
    id: 'incomplete-paper',
    title: 'Incomplete Paper',
    // 缺少很多字段
  };

  const completePaper = {
    id: 'complete-paper',
    title: 'Complete Research Paper',
    authors: 'Complete Author',
    abstract: 'This is a complete abstract...',
    urls: ['https://example.com/complete'],
    pdfUrl: 'https://example.com/complete.pdf',
    publicationDate: '2024-01-01',
    venue: 'Top Conference',
    keywords: ['machine learning', 'AI'],
    citationCount: 42,
    platform: PLATFORM_KEYS.GOOGLE_SCHOLAR,
    sourceUrl: 'https://scholar.google.com',
    updateTime: new Date().toISOString(),
    processing: false,
    html: '<div>Paper HTML content</div>',
    metadata: { additionalInfo: 'some metadata' }
  };

  const incompleteReport = paperMetadataService.checkPaperCompleteness(incompletePaper);
  const completeReport = paperMetadataService.checkPaperCompleteness(completePaper);

  console.log('不完整论文检查报告:', incompleteReport);
  console.log('完整论文检查报告:', completeReport);
}

/**
 * 示例4: 获取Paper属性架构
 */
function getSchemaExample() {
  const schema = paperMetadataService.getPaperAttributeSchema();
  console.log('Paper对象属性架构:');
  schema.forEach(attr => {
    const required = attr.required ? '(必需)' : '(可选)';
    console.log(`- ${attr.name}: ${attr.type} ${required} - ${attr.description}`);
  });
}

/**
 * 示例5: 获取支持的平台
 */
function getSupportedPlatformsExample() {
  const platforms = paperMetadataService.getSupportedPlatforms();
  console.log('支持的平台:');
  platforms.forEach(platform => {
    console.log(`- ${platform.key}: ${platform.name}`);
  });
}

/**
 * 示例6: 缓存和获取Paper对象
 */
function cacheExample() {
  const paper = new Paper({
    id: 'cache-example',
    title: 'Cached Paper Example',
    authors: 'Cache Author',
    platform: PLATFORM_KEYS.SEMANTIC_SCHOLAR
  });

  // 缓存论文
  const cacheSuccess = paperMetadataService.cachePaper(paper);
  console.log('缓存成功:', cacheSuccess);

  // 获取缓存的论文
  const cachedPaper = paperMetadataService.getCachedPaper('cache-example');
  console.log('获取缓存的论文:', cachedPaper);

  // 获取所有缓存的论文
  const allCachedPapers = paperMetadataService.getAllCachedPapers();
  console.log('所有缓存的论文数量:', allCachedPapers.size);
}

/**
 * 运行所有示例
 */
function runAllExamples() {
  console.log('=== PaperMetadataService 使用示例 ===\n');

  console.log('1. 创建Paper对象示例:');
  createPaperExample();
  console.log('\n');

  console.log('2. 验证Paper对象示例:');
  validatePaperExample();
  console.log('\n');

  console.log('3. 检查Paper完整性示例:');
  checkCompletenessExample();
  console.log('\n');

  console.log('4. 获取Paper属性架构示例:');
  getSchemaExample();
  console.log('\n');

  console.log('5. 获取支持平台示例:');
  getSupportedPlatformsExample();
  console.log('\n');

  console.log('6. 缓存操作示例:');
  cacheExample();
  console.log('\n');
}

// 导出示例函数供其他模块使用
export {
  createPaperExample,
  validatePaperExample,
  checkCompletenessExample,
  getSchemaExample,
  getSupportedPlatformsExample,
  cacheExample,
  runAllExamples
};

// 如果直接运行此文件，执行所有示例
if (typeof window !== 'undefined' && window.location) {
  // 在浏览器环境中，可以通过控制台调用 runAllExamples()
  window.paperMetadataServiceExamples = {
    runAllExamples,
    createPaperExample,
    validatePaperExample,
    checkCompletenessExample,
    getSchemaExample,
    getSupportedPlatformsExample,
    cacheExample
  };
}
