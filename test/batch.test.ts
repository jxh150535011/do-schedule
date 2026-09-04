// test/task-batcher.test.ts
import { expect, test, describe, mock, spyOn } from 'bun:test';
import { TaskBatcher } from '../src/index';

// ============ 辅助工具 ============
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


// ============ 测试套件 ============

describe('TaskBatcher', () => {
  
  // ===== 测试1：按数量触发 =====
  test('达到 batchSize 时自动触发处理', async () => {
    const batcher = new TaskBatcher<number>({
      batchSize: 3,
      maxWait: 1000,
      process() {
        return sleep(0);
      }
    });
    batcher.push(1);
    batcher.push(2);
    expect(batcher.getbatchProcessTaskSize()).toBe(0);
    batcher.push(3);
    expect(batcher.getbatchProcessTaskSize()).toBe(1);
    expect(batcher.getBufferTaskSize()).toBe(0);
  });

  // ===== 测试2：按时间触发 =====
  test('超过 maxWait 时自动触发处理', async () => {
    const batcher = new TaskBatcher<number>({
      batchSize: 10,
      maxWait: 100,
      process() {
        return sleep(100);
      }
    });

    const startTime = Date.now();
    batcher.push(1);
    batcher.push(2);
    expect(batcher.getbatchProcessTaskSize()).toBe(0);
    await sleep(150);
    expect(batcher.getbatchProcessTaskSize()).toBe(1);
    expect(Date.now() - startTime).toBeGreaterThanOrEqual(90);
  });

  // ===== 测试3：maxWait=0 时立即触发 =====
  test('maxWait=0 时每条消息立即触发', async () => {
    const batcher = new TaskBatcher<number>({
      batchSize: 10,
      maxWait: 0,
      process() {
        return sleep(1000);
      }
    });

    // 假设每个 batcher 任务都需要处理一段时间，所以连续push 会立即增加任务数量
    batcher.push(1);
    expect(batcher.getbatchProcessTaskSize()).toBe(1);
    batcher.push(2);
    expect(batcher.getbatchProcessTaskSize()).toBe(2);

    batcher.push(3);
    expect(batcher.getbatchProcessTaskSize()).toBe(3);
  });

  // ===== 测试4：限流保护 =====
  test('maxBatchProcessSize 限流时数据排队等待', async () => {
    const batcher = new TaskBatcher<number>({
      batchSize: 2,
      maxWait: 100,
      process() {
        return sleep(200);
      },
      maxBatchProcessSize: 1,
    });

    // 触发第一批
    batcher.push(1);
    batcher.push(2);

    // 立即推送第二批
    batcher.push(3);
    batcher.push(4);

    // 第一批正在处理中，第二批应被缓存
    expect(batcher.getbatchProcessTaskSize()).toBe(1);

    await sleep(210);

    expect(batcher.getbatchProcessTaskSize()).toBe(1);

    await sleep(410);

    expect(batcher.getbatchProcessTaskSize()).toBe(0);
  });

  // ===== 测试5：限流期间数据不丢失 =====
  test('限流时数据保留在 buffer 中不丢失', async () => {
    const batcher = new TaskBatcher<number>({
      batchSize: 2,
      maxWait: 100,
      maxBatchProcessSize: 1,
      process() {
        return sleep(200);
      },
    });

    // 触发第一批
    batcher.push(1);
    batcher.push(2);

    // 推送第二批，被限流
    batcher.push(3);
    batcher.push(4);

    // 数据还在 buffer 中
    expect(batcher.getBufferTaskSize()).toBe(2);

    await sleep(210);

    expect(batcher.getbatchProcessTaskSize()).toBe(1);
    expect(batcher.getBufferTaskSize()).toBe(0);
  });

  // ===== 测试6：缓存满时丢弃消息 =====
  test('缓存满时丢弃新消息', async () => {
    const batcher = new TaskBatcher<number>({
      batchSize: 5,
      maxWait: 10000,
      maxBufferSize: 3,
      process() {
        return sleep(200);
      },
    });

    expect(batcher.push(1)).toBe(true);
    expect(batcher.push(2)).toBe(true);
    expect(batcher.push(3)).toBe(true);
    expect(batcher.push(4)).toBe(false);

    expect(batcher.getBufferTaskSize()).toBe(3);
  });

  // ===== 测试7：flush 后定时器正确清理 =====
  test('flush 后定时器被正确清理', async () => {
    const batcher = new TaskBatcher<number>({
      batchSize: 10,
      maxWait: 100,
      process() {
        return sleep(200);
      },
    });

    batcher.push(1);
    batcher.push(2);

    // 获取定时器句柄
    const timerBefore = batcher['timer'];
    expect(timerBefore).not.toBeNull();

    await batcher.flush();

    const timerAfter = batcher['timer'];
    expect(timerAfter).toBeNull();

    // 等待超过 maxWait，不应有额外触发, 前面手动强制 batcher.flush() 了
    await sleep(150);
    expect(batcher.getbatchProcessTaskSize()).toBe(0);

    expect(batcher.getBufferTaskSize()).toEqual(0);
  });

  // ===== 测试8：已有定时器时不重复创建 =====
  test('已有定时器时不会重复创建', async () => {
    const batcher = new TaskBatcher<number>({
      batchSize: 10,
      maxWait: 1,
      process() {
        return sleep(200);
      },
    });

    batcher.push(1);
    const timer1 = batcher['timer'];

    batcher.push(2);
    const timer2 = batcher['timer'];

    expect(timer1).toBe(timer2);
  });

  // ===== 测试9：run 完成后自动检查新数据 =====
  test('run 完成后自动检查是否有新数据', async () => {
    const batcher = new TaskBatcher<number>({
      batchSize: 2,
      maxWait: 100,
      maxBatchProcessSize: 1,
      process() {
        return sleep(200);
      },
    });

    // 触发第一批
    batcher.push(1);
    batcher.push(2);

    // 在第一批处理期间，新数据进来, 但是会被刮起不做处理
    await sleep(10);
    batcher.push(3);
    batcher.push(4);

    expect(batcher.getbatchProcessTaskSize()).toBe(1);
    expect(batcher.getBufferTaskSize()).toBe(2);

    // 上一个任务执行完毕后
    await sleep(200);

    expect(batcher.getbatchProcessTaskSize()).toBe(1);
    expect(batcher.getBufferTaskSize()).toBe(0);
  });

  // ===== 测试10：firstItemTimestamp 重置语义 =====
  test('缓存清空后新周期计时从第一条新消息开始', async () => {
    const batcher = new TaskBatcher<number>({
      batchSize: 5,
      maxWait: 100,
      process() {
        return sleep(200);
      },
    });

    // 第一批：3条，不触发
    batcher.push(1);
    batcher.push(2);
    batcher.push(3);
    const firstTimestamp = batcher['firstItemTimestamp'];

    // 手动 flush，清空缓存
    await batcher.flush();
    expect(batcher.getBufferTaskSize()).toBe(0);

    // 新批次开始
    const beforePush = Date.now();
    batcher.push(4);
    batcher.push(5);
    batcher.push(6);

    // 新时间戳应晚于旧时间戳
    expect(batcher['firstItemTimestamp']).toBeGreaterThan(firstTimestamp);
    expect(batcher['firstItemTimestamp']).toBeGreaterThanOrEqual(beforePush);
  });

  // ===== 测试11：多次 push 触发数量条件 =====
  test('多次 push 累积到 batchSize 时触发一次', async () => {
    const batcher = new TaskBatcher<number>({
      batchSize: 3,
      maxWait: 10000,
      process() {
        return sleep(200);
      },
    });

    batcher.push(1);
    batcher.push(2);
    // 还没触发
    expect(batcher.getbatchProcessTaskSize()).toBe(0);

    batcher.push(3);
    await sleep(10);

    // 触发了一次
    expect(batcher.getbatchProcessTaskSize()).toBe(1);

    // 继续累积
    batcher.push(4);
    batcher.push(5);
    batcher.push(6);
    await sleep(10);

    expect(batcher.getbatchProcessTaskSize()).toBe(2);
  });

  // ===== 测试12：时间触发不会过早触发 =====
  test('时间触发不会在 maxWait 之前触发', async () => {
    const batcher = new TaskBatcher<number>({
      batchSize: 10,
      maxWait: 100,
      process() {
        return sleep(200);
      },
    });

    batcher.push(1);
    batcher.push(2);
    // 应该还没触发
    await sleep(90);
    expect(batcher.getbatchProcessTaskSize()).toBe(0);

    // 再等 20ms 合计 110ms > 100ms ，应该触发了
    await sleep(150);
    expect(batcher.getbatchProcessTaskSize()).toBe(1);
  });


  // ===== 测试13：flush 清理所有数据 =====
  test('flush 强制处理所有剩余数据', async () => {
    const batcher = new TaskBatcher<number>({
      batchSize: 10,
      maxWait: 10000,
      process() {
        return sleep(200);
      },
    });

    batcher.push(1);
    batcher.push(2);
    batcher.push(3);
    expect(batcher.getbatchProcessTaskSize()).toBe(0);
    batcher.flush();

    expect(batcher.getbatchProcessTaskSize()).toBe(1);
    expect(batcher.getBufferTaskSize()).toBe(0);
  });

  // ===== 测试14：批量触发时多个条件同时满足 =====
  test('数量和时间的双触发条件同时满足时只处理一次', async () => {
    const batcher = new TaskBatcher<number>({
      batchSize: 5,
      maxWait: 100,
      process() {
        return sleep(200);
      },
    });

    // 快速推入 5 条，触发数量条件
    batcher.push(1);
    batcher.push(2);
    batcher.push(3);
    batcher.push(4);
    batcher.push(5);

    await sleep(10);

    // 数量触发，处理了一次
    expect(batcher.getbatchProcessTaskSize()).toBe(1);

    // 等待 200ms，不应该有第二次触发
    await sleep(200);
    expect(batcher.getbatchProcessTaskSize()).toBe(0);
  });

  // ===== 测试15：处理期间的新消息不受定时器影响 =====
  test('处理期间的新消息会启动新定时器', async () => {
    const batcher = new TaskBatcher<number>({
      batchSize: 2,
      maxWait: 100,
      process() {
        return sleep(200);
      },
    });

    // 触发第一批（处理耗时 100ms）
    batcher.push(1);
    batcher.push(2);

    // 处理期间新消息进来
    await sleep(30);
    batcher.push(3);

    // 此时第一批还在处理中，定时器已被清除
    // 但 push(3) 时 buffer 为空，会启动新定时器
    const timerAfter = batcher['timer'];
    expect(timerAfter).not.toBeNull();

    await sleep(150);

    // 第二批应该被处理
    expect(batcher.getbatchProcessTaskSize()).toBe(2);
  });
});