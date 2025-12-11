import { createPromise, CreatePromiseResult } from './promise';

export const timeout = (number?: number) => {
  return new Promise((resolve) => {
    return setTimeout(resolve, number || 0);
  })
}

export interface CreateTaskOptions<T> {
  /** 任意的参数对象 */
  params?: any;

  expires?: number;

  key?: string;
}




export class Task<T> {
  public expires: number = 0;
  public params?: any;
  public key?: string;
  private proxy!: CreatePromiseResult;
  constructor(options?: CreateTaskOptions<T>) {
    // @ts-ignore
    this.proxy = createPromise();
    this.params = options?.params;
    this.expires = options?.expires || 0;
    this.key = options?.key;
  }
  resolve(value?: any) {
    return this.proxy.resolve(value);
  }
  reject(error?: any) {
    return this.proxy.reject(error);
  }
  abort() {
    if (this.proxy.controller) {
      this.proxy.controller.abort();
    } else {
      console.warn('unsupport AbortController')
    }
  }
  tryThen(success?: (value?: any) => void, error?: (error?: any) => void) {
    return this.proxy.tryThen(success, error)
  }
  /** 关联 两个 Task  */
  observe(nextTask: Task<T>) {
    return nextTask.tryThen((value) => {
      this.resolve(value);
    }, (error) => {
      this.reject(error);
    });
  }
}