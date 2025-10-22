import { expect, test } from 'bun:test';
import { createSchedule, timeout, CreatesScheduleInvokeCallbackOptions } from '../src/index';

// @ts-ignore
test('createSchedule 1', async () => {

  const schedule = createSchedule<number>({
    key: 'test1',
    max: 2
  });

  const fn = async (options: CreatesScheduleInvokeCallbackOptions<number>) => {
    const { wait, repeat, repeatCount, prev, current } = options;
    const prevResult = await wait();
    if (prevResult) {
      return prevResult + 1;
    }
    return 1;
  }
  const task1 = schedule.invoke(fn, {
    key: 'key1',
  });
  const task2 = schedule.invoke(fn, {
    key: 'key2',
  });
  await timeout(4);
  const task3 = schedule.invoke(fn, {
    key: 'key1',
  });
  const task4 = schedule.invoke(fn, {
    key: 'key3',
  });

  const [ value1, value2, value3, value4 ] = await Promise.all([task1, task2, task3, task4]);

  // @ts-ignore
  expect(value1).toEqual(1);
  // @ts-ignore
  expect(value2).toEqual(1);
  // @ts-ignore
  expect(value3).toEqual(2);
  // @ts-ignore
  expect(!!schedule.getTask('key2')).toEqual(false);
  // @ts-ignore
  expect(!!schedule.getTask('key1')).toEqual(true);
});

// @ts-ignore
test('createSchedule 2', async () => {

  const schedule = createSchedule<number[]>({
    key: 'test2',
    max: 1000
  })

  const fn = async (options: CreatesScheduleInvokeCallbackOptions<number[]>) => {
    const { wait, repeat, repeatCount, prev, current } = options;
    const prevResult = await wait();
    if (prevResult) {
      return [prevResult[0] + 1, prevResult[1]];
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
    return [1, Date.now()];
  }

  const task1 = schedule.invoke(fn, {
    key: 'key1',
  })

  const task2 = schedule.invoke(fn, {
    key: 'key2',
  })

  const task3 = schedule.invoke(fn, {
    key: 'key1',
  });

  const [ value1, value2, value3 ] = await Promise.all([task1, task2, task3]);

  // @ts-ignore
  expect(value1[0]).toEqual(1);
  // @ts-ignore
  expect(value2[0]).toEqual(1);
  // @ts-ignore
  expect(value3[0]).toEqual(2);
  // @ts-ignore
  expect(value3[1]).toEqual(value1[1]);
});


// @ts-ignore
test('createSchedule 3', async () => {

  const schedule = createSchedule<any[]>({
    key: 'test3',
    max: 1000
  })

  const fn = async (options: CreatesScheduleInvokeCallbackOptions<any[]>) => {
    const { wait, repeat, repeatCount, prev, current } = options;
    const prevResult = await wait();
    if (prevResult) {
      return [prevResult[0] + 1, prevResult[1]];
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
    return [1, Date.now()];
  }

  const task1 = schedule.invoke(fn, {
    key: 'key1',
    abortable: true,
  }).catch((error) => {
    return [0, Date.now()];
  });

  const task2 = schedule.invoke(fn, {
    key: 'key2',
    abortable: true,
  });

  // Add a little delay to ensure there's a time gap when task1 is cancelled
  await timeout(4);

  const task3 = schedule.invoke(fn, {
    key: 'key1',
    abortable: true,
  });

  const task4 = schedule.invoke(fn, {
    key: 'key1',
  });

  const [ value1, value2, value3, value4 ] = await Promise.all([task1, task2, task3, task4]);

  // @ts-ignore
  expect(value1[0]).toEqual(0);
  // @ts-ignore
  expect(value2[0]).toEqual(1);
  // @ts-ignore
  expect(value3[0]).toEqual(1);
  // @ts-ignore
  expect(value4[0]).toEqual(2);
  // @ts-ignore
  expect(value3[1] > value1[1]).toEqual(true);
});

// @ts-ignore
test('createSchedule 4', async () => {
  const schedule = createSchedule<any[]>({
    key: 'test4',
    max: 1000
  })
  const fn = async (options: CreatesScheduleInvokeCallbackOptions<any[]>) => {
    const { wait, repeat, repeatCount, prev, current } = options;
    const prevResult = await wait();
    if (prevResult) {
      return [prevResult[0] + 1, prevResult[1]];
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
    return [1, Date.now()];
  }
  
  const task1 = schedule.invoke(fn, {
    key: 'key1',
    abortable: true,
    destoryable: true,
  }).catch((error) => {
    return [0, Date.now()];
  });
  
  const task2 = schedule.invoke(fn, {
    key: 'key2',
    abortable: true,
    destoryable: true,
  });

  const task3 = schedule.invoke(fn, {
    key: 'key1',
    abortable: true,
    destoryable: true,
  });

  await task1;
  // @ts-ignore
  expect(!!schedule.getTask('key1')).toEqual(true);
  const [ value1, value2, value3 ] = await Promise.all([task1, task2, task3]);

  // @ts-ignore
  expect(value3[0]).toEqual(1);
  // @ts-ignore
  expect(!!schedule.getTask('key1')).toEqual(false);
  // @ts-ignore
  expect(!!schedule.getTask('key2')).toEqual(false);

  // @ts-ignore
  expect(schedule.getTasks().length).toEqual(0);
});


// @ts-ignore
test('createSchedule 5', async () => {
  const schedule = createSchedule<number>({
    key: 'test5',
    max: 1000
  });

  const fn = async (options: CreatesScheduleInvokeCallbackOptions<number>) => {
    const { wait, repeat, repeatCount, prev, current } = options;
    const prevResult = await wait();
    if (prevResult) {
      return prevResult + 1;
    }
    await timeout(200);
    return 1;
  }
  const task1 = schedule.invoke(fn, {
    key: 'key1',
    abortable: true,
    destoryable: true,
  }).catch(e => undefined);
  const task2 = schedule.invoke(fn, {
    key: 'key1',
    abortable: true,
    destoryable: true,
  }).catch(e => undefined);
  const task3 = schedule.invoke(fn, {
    key: 'key1',
    abortable: true,
    destoryable: true,
  }).catch(e => undefined);
  const task4 = schedule.invoke(fn, {
    key: 'key1',
    destoryable: true,
  }).catch(e => undefined);


  const [ value1, value2, value3, value4 ] = await Promise.all([task1, task2, task3, task4]);

  expect(value3).toEqual(1);
  expect(value4).toEqual(2);
});



// @ts-ignore
test('createSchedule 6', async () => {
  const schedule = createSchedule<number>({
    key: 'test6'
  });

  const fn = async (options: CreatesScheduleInvokeCallbackOptions<number>) => {
    const { wait, repeat, repeatCount, prev, current, result } = options;
    
    // If the previous object exists, wait for the previous result
    if (prev) {
      const prevResult = await wait();
      if (prevResult) {
        return prevResult + 1;
      }
    }
    // Repeat execution 4 times
    if (repeatCount > 4) {
      return (result || 0) + 100;
    }
    await timeout(10);
    return repeat(repeatCount);
  }
  const task1 = schedule.invoke(fn, {
    key: 'key1',
  });
  const task2 = schedule.invoke(fn, {
    key: 'key1',
  })


  const [ value1, value2 ] = await Promise.all([task1, task2]);

  // repeatCount starts from 0, so 5 times equals 104
  expect(value1).toEqual(104);
  expect(value2).toEqual(value1 + 1);
});