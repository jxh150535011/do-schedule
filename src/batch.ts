export interface TaskBatcherOptions<T> {
  /** 默认1 */
  batchSize?: number,

  /** 毫秒数， 默认不做等待 */
  maxWait?: number,

  /** 最大内存控制，默认无限大 */
  maxBufferSize?: number,

  /** 默认 不做限制， 如果设置1，意味着flush 操作 被阻塞， 必须等待完成后 才能操作下一次flush */
  maxBatchProcessSize?: number,

  process: (buffer: T[]) => Promise<void|any>
}
/* 
 * 批处理任务
 */
export class TaskBatcher<T> {
    /** 消息缓存队列 */
    private buffer: T[] = [];
    /** 定时器句柄，用于兜底时间触发 */
    private timer: any = null;

    private maxBufferSize: number = Infinity;

    private batchSize: number = 1;

    private maxWait: number = 0;
    
    /** 当前批次开始时间（用于计算超时） */
    private firstItemTimestamp: number = 0;

    /** 最大同时处理等待队列数, 默认不做限制 */
    private maxBatchProcessSize: number = Infinity;

    private batchProcessTaskSize: number = 0;

    private batchProcessCallback!: Function;

    constructor(options: TaskBatcherOptions<T>) {
      if (options.batchSize) {
        this.batchSize = options.batchSize;
      }
      if (options.maxBufferSize) {
        this.maxBufferSize = options.maxBufferSize;
      }
      if (options.maxBatchProcessSize) {
        this.maxBatchProcessSize = options.maxBatchProcessSize;
      }
      if (options.maxWait) {
        this.maxWait = options.maxWait;
      }
      this.batchProcessCallback = options.process;
    }

    /**
     * 添加一条消息到缓存
     * @param item 消息对象
     * @returns 是否成功加入缓存（false 表示缓存已满，消息被丢弃）
     */
    push(item: T): boolean {
      // ========== 背压保护 ==========
      // 如果缓存超过最大容量，丢弃消息（可根据业务需求调整策略）
      if (this.buffer.length >= this.maxBufferSize) {
        // @ts-ignore
        console.warn(`⚠️ [TaskBatcher] 缓存已满 (${this.buffer.length}/${this.maxBufferSize})，消息被丢弃`);
        return false;
      }
      // 如果没有缓存数据， 意味着是新的一个周期开始
      if (!this.buffer.length) {
        this.firstItemTimestamp = Date.now();
      }
      // 加入缓存
      this.buffer.push(item);
      this.checkFlush();
      return true;
    }

    clearTimer() {
      if (this.timer) {
        // @ts-ignore
        clearTimeout(this.timer)
      }
      this.timer = null;
    }

    checkFlush() {
      
      // ========== 数量触发检查 ==========
      if (this.buffer.length >= this.batchSize) {
        // 达到批量阈值，立即处理（会清除定时器）
        this.flush();
        return;
      }
      // 存在定时器 就不需要再次计算了
      if (this.timer) {
        return;
      }
      
      // 计算剩余等待时间：从第一条消息进入开始计时
      const elapsed = Date.now() - this.firstItemTimestamp!;
      const remaining = Math.max(0, this.maxWait - elapsed);
      // 时间结束 立即调用
      if (remaining < 1) {
        this.flush();
        return;
      }
      // @ts-ignore
      this.timer = setTimeout(() => {
        this.flush();
      }, remaining);
    }
    
    async run(buffer: T[]) {
      try {
        await this.batchProcessCallback(buffer);
      } catch(e) {

      } finally {

      }
    }

    /**
     * 进入flush 执行，一定是有buffer 数据
     */
    async flush(): Promise<any> {
      this.clearTimer();
      
      // 某次任务结束后，再次返回检查的时候， 刚好没有数据，那就不用执行任何逻辑
      if(!this.buffer.length) {
        return;
      }
      if (this.batchProcessTaskSize >= this.maxBatchProcessSize) {
        // 返回false ，暂时不进行 创建promise 等待
        // 意味着超过最大队列的情况下 就不会等待了
        return false;
      }
      // @ts-ignore;
      const buffer = [].concat(this.buffer);
      // 直接清空队列
      this.buffer = [];
      const promise = this.run(buffer);
      this.batchProcessTaskSize++;
      promise.then(() => {
        this.batchProcessTaskSize--;
        this.checkFlush();
      })
      return promise;
    }

    /** 当前正在处理中的批处理任务数量 */
    getbatchProcessTaskSize() {
      return this.batchProcessTaskSize;
    }

    getBufferTaskSize() {
      return this.buffer.length
    }
  }