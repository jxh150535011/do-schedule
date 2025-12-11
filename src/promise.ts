

// import AbortController from 'abort-controller';

const TASK_ERROR_CODE = {
  ABORT: 'ABORT',
}

const handleCatch = (e: any, reject: any) => {
  if (e.message === TASK_ERROR_CODE.ABORT) {
    return undefined;
  }
  if (reject) {
    return reject(e);
  }
  throw e;
}

export interface CreatePromiseOptions {
  controller?: AbortController;
}

export interface CreatePromiseResult {
  controller: AbortController;
  promise: Promise<any>;
  resolve: (value?: any) => Promise<any>;
  reject: (error?: any) => Promise<any>;
  tryThen: (success?: (value?: any) => void, error?: (error?: any) => void) => Promise<any>;
}

// @ts-ignore
const { AbortController, AbortSignal } = typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {};

/** Create a controllable promise (delayed wait) */
export const createPromise = <T>(options?: CreatePromiseOptions) => {
  const controller = options?.controller || new AbortController();

  const addAbortListener = (reject: any) => {
    // Add asynchronous termination method
    const abort = () => {
      return reject(new Error(TASK_ERROR_CODE.ABORT));
    }
    controller.signal.addEventListener('abort', abort);
    return () => {
      controller.signal.removeEventListener('abort', abort);
    };
  }

  let handleResolve = (result: any) => {};
  let handleReject = (error: any) => {};
  const promise = new Promise<T>((resolve, reject) => {
    const abortecancel = addAbortListener(reject);
    handleReject = (error: any) => {
      abortecancel();
      reject(error);
      return promise;
    }
    handleResolve = (result: any) => {
      if (result instanceof Promise) {
        return result.then(handleResolve).catch(handleReject);
      }
      abortecancel();
      resolve(result)
      return promise;
    }
  });

  const handleThen = (success?: (value?: any) => void, error?: (error?: any) => void) => {
    return promise.then(success).catch((e) => handleCatch(e, error));
  }


  return {
    controller,
    promise,
    resolve: handleResolve,
    reject: handleReject,
    tryThen: handleThen,
  } as CreatePromiseResult;
};