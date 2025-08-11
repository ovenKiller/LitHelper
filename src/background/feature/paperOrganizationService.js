/**
 * paperOrganizationService.js
 *
 * 整理（组织）论文服务（复杂版）
 * - 管理一个“整理论文批次任务”列表（每个批次包含多篇论文）
 * - 维护每个批次与每篇论文的进度
 * - 每篇论文两阶段：等待元数据预处理完成（paperMetadataService 缓存 processing=false）→ 提交 OrganizeTaskHandler 正式整理任务
 * - 预留“任务完成通知”感知接口，后续由 OrganizeTaskHandler/MessageService 联动
 */

import { logger } from '../../util/logger.js';
import { ORGANIZE_SUPPORTED_TASK_TYPES } from '../../constants.js';
import { Task } from '../../model/task.js';
import { paperMetadataService } from './paperMetadataService.js';

const BATCH_STATUS = {
  PENDING: 'pending',      // 创建完成，等待调度
  RUNNING: 'running',      // 正在执行（有论文处于等待/组织中）
  COMPLETED: 'completed',  // 全部论文完成
  FAILED: 'failed'         // 存在失败（且无进行中）
};

const PAPER_STATUS = {
  WAITING_METADATA: 'waiting_metadata', // 等待metadata预处理完成
  METADATA_READY: 'metadata_ready',     // metadata就绪
  ORGANIZING: 'organizing',             // 正在整理论文（已提交到OrganizeTaskHandler）
  COMPLETED: 'completed',               // 整理论文完成
  FAILED: 'failed'                      // 整理论文失败/超时
};

class PaperOrganizationService {
  constructor() {
    // 任务服务实例（通过依赖注入设置）
    this.taskService = null;

    // 管理批次任务：Map<batchId, Batch>
    this.batches = new Map();

    // 反向索引：taskKey → { batchId, paperId }
    this.taskIndex = new Map();

    // 元数据等待轮询参数
    this.metadataWaitIntervalMs = 1500;
    this.metadataWaitTimeoutMs = 5 * 60 * 1000; // 5分钟
  }

  /**
   * 设置任务服务（依赖注入）
   * @param {import('../service/taskService.js').TaskService} taskService
   */
  setTaskService(taskService) {
    this.taskService = taskService;
  }

  /**
   * 创建并启动一个整理论文批次任务
   * @param {Array<Object>} papers - 待整理论文列表
   * @param {Object} options - 整理选项
   * @returns {Promise<boolean>} 是否成功受理（批次会在后台异步推进）
   */
  async organizePapers(papers, options = {}) {
    try {
      logger.log('[PaperOrganizationService] 开始处理整理论文请求');

      if (!this.validateInput(papers, options)) {
        return false;
      }

      // 创建批次
      const batchId = this._createBatch(papers, options);
      logger.log('[PaperOrganizationService] 已创建整理论文批次', { batchId, count: papers.length });

      // 异步启动该批次
      this._startBatchProcessing(batchId).catch(err => {
        logger.error(`[PaperOrganizationService] 批次 ${batchId} 处理异常:`, err);
        const batch = this.batches.get(batchId);
        if (batch) {
          batch.status = BATCH_STATUS.FAILED;
          batch.error = err?.message || '批次处理异常';
          this._recomputeBatchProgress(batch);
        }
      });

      return true;
    } catch (error) {
      logger.error('[PaperOrganizationService] 处理整理论文请求异常:', error);
      return false;
    }
  }

  /**
   * 批次处理主流程：逐篇论文等待metadata就绪后提交整理任务
   * @param {string} batchId
   */
  async _startBatchProcessing(batchId) {
    const batch = this.batches.get(batchId);
    if (!batch) return;
    batch.status = BATCH_STATUS.RUNNING;
    this._recomputeBatchProgress(batch);

    // 顺序/并行都可以，这里采用并行等待 + 就绪即提交
    await Promise.all(
      batch.papers.map(async (pItem) => {
        try {
          // 阶段1：等待元数据预处理完成
          await this._waitForMetadataReady(pItem.paper.id);
          pItem.status = PAPER_STATUS.METADATA_READY;
          this._recomputeBatchProgress(batch);

          // 阶段2：提交到 OrganizeTaskHandler（每篇论文一个任务）
          const taskKey = await this._submitOrganizeTask(batch, pItem.paper, batch.options);
          pItem.status = PAPER_STATUS.ORGANIZING;
          pItem.organizeTaskKey = taskKey;
          this.taskIndex.set(taskKey, { batchId: batch.id, paperId: pItem.paper.id });
          this._recomputeBatchProgress(batch);

          logger.log(`[PaperOrganizationService] 已提交 Organize 任务: ${taskKey} (${pItem.paper.title})`);
          // 结果感知：当前还没有来自 Handler 的完成事件，留待后续接入。
          // 这里不主动标记完成，等待外部通知（notifyOrganizeTaskCompleted）。
        } catch (err) {
          pItem.status = PAPER_STATUS.FAILED;
          pItem.error = err?.message || '元数据等待/任务提交失败';
          this._recomputeBatchProgress(batch);
        }
      })
    );

    // 并行提交完成后，若没有进行中的任务且无失败，则置为完成
    this._finalizeBatchIfPossible(batch);
  }

  /**
   * 等待某篇论文的metadata预处理完成（通过 paperMetadataService 缓存判断）
   * @param {string} paperId
   */
  async _waitForMetadataReady(paperId) {
    const start = Date.now();
    while (true) {
      const cached = paperMetadataService.getCachedPaper(paperId);
      // 判定：缓存存在 且 未处于 processing=true 即视为就绪
      if (cached && cached.processing !== true) {
        return true;
      }
      if (Date.now() - start > this.metadataWaitTimeoutMs) {
        throw new Error('等待元数据超时');
      }
      await new Promise(r => setTimeout(r, this.metadataWaitIntervalMs));
    }
  }

  /**
   * 提交单篇论文的 Organize 任务
   * @param {Batch} batch
   * @param {Object} paper
   * @param {Object} options
   * @returns {Promise<string>} organize 任务的 taskKey
   */
  async _submitOrganizeTask(batch, paper, options) {
    if (!this.taskService) {
      throw new Error('TaskService not initialized. Please call setTaskService() first.');
    }
    const taskKey = `${ORGANIZE_SUPPORTED_TASK_TYPES.ORGANIZE_PAPER}_${paper.id}_${Date.now()}`;
    const params = { options, papers: [paper] };
    const task = new Task(taskKey, ORGANIZE_SUPPORTED_TASK_TYPES.ORGANIZE_PAPER, params);
    await this.taskService.addTask(task);
    logger.log(`[PaperOrganizationService] 已提交 Organize 任务: ${taskKey} (${paper.title})`);
    return taskKey;
  }

  /**
   * 由外部（如 MessageService/OrganizeTaskHandler）回调：某个 Organize 任务已完成
   * @param {string} taskKey
   * @param {{success:boolean, error?:string}} result
   * @returns {boolean}
   */
  notifyOrganizeTaskCompleted(taskKey, result) {
    try {
      const idx = this.taskIndex.get(taskKey);
      if (!idx) {
        logger.warn('[PaperOrganizationService] 未找到任务索引:', taskKey);
        return false;
      }
      const { batchId, paperId } = idx;
      const batch = this.batches.get(batchId);
      if (!batch) return false;
      const item = batch.papers.find(x => x.paper.id === paperId);
      if (!item) return false;

      if (result?.success) {
        item.status = PAPER_STATUS.COMPLETED;
        item.error = undefined;
      } else {
        item.status = PAPER_STATUS.FAILED;
        item.error = result?.error || 'Organize 执行失败';
      }
      this._recomputeBatchProgress(batch);
      this._finalizeBatchIfPossible(batch);
      return true;
    } catch (e) {
      logger.error('[PaperOrganizationService] 处理任务完成通知异常:', e);
      return false;
    }
  }

  /** 获取所有批次的浅信息 */
  getAllBatches() {
    return Array.from(this.batches.values()).map(b => this._projectBatch(b));
  }

  /** 获取某个批次详情 */
  getBatchById(batchId) {
    const b = this.batches.get(batchId);
    return b ? this._projectBatch(b, true) : null;
  }

  /**
   * 入参校验
   */
  validateInput(papers, options) {
    if (!Array.isArray(papers) || papers.length === 0) {
      logger.error('[PaperOrganizationService] papers 必须为非空数组');
      return false;
    }
    for (let i = 0; i < papers.length; i++) {
      const p = papers[i];
      if (!p || typeof p !== 'object') {
        logger.error(`[PaperOrganizationService] 第 ${i} 个元素不是有效对象`);
        return false;
      }
      if (!p.id) {
        logger.error(`[PaperOrganizationService] 第 ${i} 个论文缺少 id 字段`);
        return false;
      }
      if (!p.title) {
        logger.error(`[PaperOrganizationService] 第 ${i} 个论文缺少 title 字段`);
        return false;
      }
    }
    if (options && typeof options !== 'object') {
      logger.error('[PaperOrganizationService] options 必须为对象');
      return false;
    }
    return true;
  }

  // ---------- 内部：批次与进度管理 ----------

  _createBatch(papers, options) {
    const batchId = `orgBatch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const batch = {
      id: batchId,
      createdAt: Date.now(),
      status: BATCH_STATUS.PENDING,
      options: { ...options },
      papers: papers.map(p => ({ paper: p, status: PAPER_STATUS.WAITING_METADATA })),
      progress: { total: papers.length, waiting: papers.length, ready: 0, organizing: 0, done: 0, failed: 0 },
      summary: { total: papers.length, success: 0 }
    };
    this.batches.set(batchId, batch);
    return batchId;
  }

  _recomputeBatchProgress(batch) {
    const counts = { total: batch.papers.length, waiting: 0, ready: 0, organizing: 0, done: 0, failed: 0 };
    for (const it of batch.papers) {
      switch (it.status) {
        case PAPER_STATUS.WAITING_METADATA: counts.waiting++; break;
        case PAPER_STATUS.METADATA_READY: counts.ready++; break;
        case PAPER_STATUS.ORGANIZING: counts.organizing++; break;
        case PAPER_STATUS.COMPLETED: counts.done++; break;
        case PAPER_STATUS.FAILED: counts.failed++; break;
      }
    }
    batch.progress = counts;
    // 同步简要统计（满足“总数/成功数”的需求）
    batch.summary = { total: counts.total, success: counts.done };
    if (counts.done === counts.total) {
      batch.status = BATCH_STATUS.COMPLETED;
    } else if ((counts.failed > 0) && (counts.organizing === 0) && (counts.ready === 0) && (counts.waiting === 0)) {
      batch.status = BATCH_STATUS.FAILED;
    } else if (counts.organizing > 0 || counts.ready > 0 || counts.waiting > 0) {
      batch.status = BATCH_STATUS.RUNNING;
    }
  }

  _finalizeBatchIfPossible(batch) {
    this._recomputeBatchProgress(batch);
  }

  _projectBatch(batch, withItems = false) {
    const base = {
      id: batch.id,
      status: batch.status,
      createdAt: batch.createdAt,
      options: batch.options,
      progress: batch.progress,
      totalPapers: (batch.summary?.total ?? batch.progress?.total ?? (batch.papers?.length || 0)),
      successCount: (batch.summary?.success ?? batch.progress?.done ?? 0)
    };
    if (withItems) {
      return {
        ...base,
        papers: batch.papers.map(it => ({ id: it.paper.id, title: it.paper.title, status: it.status, taskKey: it.organizeTaskKey, error: it.error }))
      };
    }
    return base;
  }
}

// 单例导出
export const paperOrganizationService = new PaperOrganizationService();
export default paperOrganizationService;

