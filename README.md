# do-schedule
A tool for controlling and scheduling asynchronous functions



- Concurrent requests using the same cache
Expiration time control (note that you need to determine the expiration time yourself)

```js
import { createSchedule } from 'do-schedule';

const schedule = createSchedule({
  // Maximum number of cached items
  max: 1,
  // Expiration time in milliseconds (note: you need to determine the validity period yourself when fetching data;
  // the internal expiration time is only used for cleanup actions when the maximum cache count is exceeded)
  expires: 100,
});

// Multiple calls requesting the same key

const handleRequest = async ({ pre, wait }) => {
  // Determine data validity yourself
  if (prev && prev.expires < Date.now()) {
    return 1;
  }
  const prevResult = await wait();
  if (prevResult) {
    return prevResult + 1;
  }
  // Do something, e.g. make a network request to get the result
  return 1;
}

const result = await Promise.all([
  schedule.invoke(handleRequest, {
    key: 'key1',
  }),
  schedule.invoke(handleRequest, {
    key: 'key1',
  });
])

// Result: the second call reuses the first call's result
result === [1, 2]


// A new request will not reuse the previous cache because the key is different (since max is 1, the previous cache will be released)
const result2 = await schedule.invoke(handleRequest, {
  key: 'key2',
});

result2 === 1


/**
 * Because key1 above was released, key1 here will not reuse the previous cache
 * createSchedule's expires provides an expiration function for control, which can be used to manage task requests (the same key ultimately maintains the same expiration time) and when they expire
 */
const result1 = await schedule.invoke(handleRequest, {
  key: 'key1',
});

result1 === 1

```


- Automatically interruptible and destroyable tasks

```js
import { createSchedule } from 'do-schedule';

const schedule = createSchedule();

// Multiple calls requesting the same key

const handleRequest = async ({ wait}) => {
  const prevResult = await wait();
  if (prevResult) {
    return prevResult + 1;
  }
  // do something, for example make a network request to get the result
  // timeout simulates delayed waiting
  await new Promise(resolve => setTimeout(resolve, 1000));
  return 1;
}

const task1 = schedule.invoke(handleRequest, {
  key: 'key1',
})

const task2 = schedule.invoke(handleRequest, {
  key: 'key1',
  abortable: true,
  destoryable: true,
})



// Calling task2 will automatically interrupt task1, and task1 will throw an error
task1 throw error

// After task2 completes execution, it will be automatically destroyed, so task3 cannot get the result of task2
await task2

const task3 = schedule.invoke(handleRequest, {
  key: 'key1',
})

await task3 === 1

```


- Repeatable tasks

```js
import { createSchedule } from 'do-schedule';

const schedule = createSchedule();

// Multiple calls requesting the same key

const handleRequest = async ({ repeatCount, repeat, result }) => {
  // Simulate network request, for example polling 10 times to get results
  const res = await fetch('https://api.example.com/data');
  if (repeatCount < 10) {
    return repeat((result || []).concat([res]));
  }
  return result;
}

const result = await schedule.invoke(handleRequest)


// result equals the collection of 10 polling results
result === [res,...10]

```


- Added batch task control
```js
import { TaskBatcher } from 'do-schedule';
const batcher = new TaskBatcher<number>({
  batchSize: 3,
  maxWait: 1000,
  // Processing function
  process(buffer: T[]) {
    return sleep(0);
  }
});

batcher.push();

// You can also manually force trigger processing
batcher.flush();

```