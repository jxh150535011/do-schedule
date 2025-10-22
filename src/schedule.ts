import { LURStore } from './lur';
import { Task } from './task';

export interface ScheduleOptionsType {
  /** Maximum instance control using simple LRU, defaults to caching 1 instance result */
  max?: number;
  /** 
   * Cache time for each task, defaults to 4000ms. Set to false for never expire (temporarily set to 1 day)
   * Can also customize the expiration time
   */
  expires?: number | false | ((expires?: number) => number);
}

export interface ScheduleTaskOptions {
  /** Arbitrary parameter object */
  params?: any;

  /** Custom timeout in milliseconds */
  expires?: number;

  /** Custom key, unique identifier for the task, cannot be empty */
  key: string;
}

export interface CreatesScheduleInvokeCallbackOptions<T> {
  /** Wait for the result of the previous task (not the previous request of repeated execution) */
  wait(): Promise<T | undefined>;
  /** Repeat execution of this task, and pass the result */
  repeat(result?: T): Promise<T | undefined>;
  /** Previous result of repeated execution task (parameter passed during repeat execution) */
  result?: T;
  /** Repeat count */
  repeatCount: number;

  /** Previous task object */
  prev?: Task<T>;
  /** Current task object */
  current: Task<T>;
}

export interface CreatesScheduleInvokeType<T = any> {
  (options?: CreatesScheduleInvokeCallbackOptions<T>): Promise<T | undefined>;
}

export interface CreatesScheduleInvokeTypeOptions<T = any> {

  /** 
   * If key is enabled, it will read the previous task cache based on the key
   * Can effectively control idempotency
   *  */
  key?: string;

  /** Whether to automatically terminate the previous request */
  abortable?: boolean;
  /** Whether to automatically destroy, usually used for single high-frequency requests (automatically destroyed after one request is successfully completed) */
  destoryable?: boolean;
  /** Custom expiration time setting */
  expires?: ((expires?: number) => number);
}

export type CreatesScheduleInvokeCallbackFn<T = any> = (options: CreatesScheduleInvokeCallbackOptions<T>) => Promise<T | undefined>;

const genExpires =  (expires: number | false | ((time?: number) => number)) => {
  if (expires === false) {
    return (time?: number) => {
      return Date.now() + 24 * 3600 * 1000;
    }
  }
  return typeof expires === 'function' ? expires : (time?: number) => {
    return Date.now() + expires;
  }
}

// const genCacheable = <T>(cacheable?: ((expires: number, preResult: T) => Promise<boolean>) | boolean) => {
//   if (typeof cacheable === 'function') {
//     return cacheable;
//   }
//   if (cacheable === true) {
//     /** 默认 按照 过期时间检查 */
//     return async (expiresTime: number, preResult: T) => {
//       // @ts-ignore
//       if (expiresTime > Date.now()) {
//         return true;
//       }
//       return false;
//     }
//   }
//   // 默认 不做过期校验，意味着所有数据 都未过期
//   return async (expiresTime: number, preResult: T) => true
// }

export class Schedule<T> {

  private store!: LURStore<Task<T>>;
  private defaultExpires!: (time?: number) => number;

  constructor(options?: ScheduleOptionsType) {
    const {
      max = 1,
      expires = 4000,
    } = options || {};
    this.defaultExpires = genExpires(expires);
    this.store = new LURStore<Task<T>>(max)
  }

  add(options: ScheduleTaskOptions) {
    const currentTask = this.store.get(options.key);
    const newTask = new Task<T>(options);
    // Subscription relationship, if newTask completes processing, it will pass the result to currentTask
    if (currentTask) {
      currentTask.observe(newTask);
    }
    if (options.key) {
      this.store.set(options.key, newTask);
    }
    return newTask;
  }
  getTask(key: string) {
    return this.store.get(key);
  }
  getTasks() {
    return this.store.getValues();
  }
  autoDestory(task: Task<T>) {
    // The last task, after completion, will be destroyed
    const destory = () => {
      const currentTask = this.store.get(task.key);
      // The last promise dependency is the main one
      if (currentTask === task) {
        this.store.delete(task.key);
      }
    }
    task.tryThen(destory, destory)
  }

  /** 触发执行一个任务，这个任务会根据 key 进行缓存， 并根据缓存策略 进行判断是否需要重新请求 */
  invoke(fn: CreatesScheduleInvokeCallbackFn<T>, options?: CreatesScheduleInvokeTypeOptions<T>) {
    const { abortable, destoryable, expires: getExpiresOptions, key } = options || {};
    const preTask = this.store.get(key);
    // Next task's expiration time
    const nextExpires = (getExpiresOptions || this.defaultExpires)(preTask?.expires);
    if (abortable) {
      // Terminate the previous task
      if (preTask) {
        preTask.abort();
      }
    }
    // Add a new task, after the current task completes, it will synchronously complete the previous task (if associated by key value)
    const nextTask = this.add({
      expires: nextExpires,
      key: key || '',
    });
    // Auto destroy
    if (destoryable) {
      this.autoDestory(nextTask);
    }
    // Setup initializes this task's dependencies
    const wait = async () => {
      return preTask?.tryThen();
    }
    const run = (result?: any, repeatCount: number = 0) => {
      const repeat = (preResult?: T) => {
        return run(preResult, repeatCount + 1) as Promise<T>
      }
      return fn({
        wait,
        repeat,
        result,
        prev: preTask,
        repeatCount,
        current: nextTask,
      })
    }
    return nextTask.resolve(run());
  }
}

const globalScheduleMap = new Map<string, Schedule<any>>();

export interface CreatesScheduleOptionsType extends ScheduleOptionsType {
  /** If key is set, it will be globally unique, otherwise returns a default schedule instance */
  key?: string;
}
/**
 * Create a task queue that can cache multiple different contents, used for idempotency control when the same key initiates synchronization
 * Each time it will only get the same cache as its own key and return the result to be updated this time
 *
 * const factory = createSchedule();
 * cosnt result = factory.invoke(key, (cache) => {
 *    return result;
 * })
 *
 * result.destroy(key?);
 */
export const createSchedule = <T>(
  createsScheduleOptions?: CreatesScheduleOptionsType,
) => {
  const {
    key: scheduleKey,
    max = 1,
    expires = 4000,
  } = createsScheduleOptions || {};

  let instance = scheduleKey ? globalScheduleMap.get(scheduleKey) : undefined;
  if (instance) return instance as Schedule<T>;

  instance = new Schedule<T>({
    max,
    expires,
  });

  if (scheduleKey) {
    globalScheduleMap.set(scheduleKey, instance);
  }

  return instance;

};