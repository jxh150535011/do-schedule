# do-schedule
A utility for controlling and scheduling asynchronous functions

```
npm install do-schedule
```

- Use the same cache under concurrent requests
- Expiration time control (note: you need to check the expiration time yourself when fetching data)

```js
import { createSchedule } from 'do-schedule';

const schedule = createSchedule({
  // Maximum number of cached items
  max: 1,
  // Expiration time in milliseconds, defaults to 1 day
  // When invoke is called, the expiration time is checked by default. If it has expired,
  // prev in the callback will be empty
  // You can disable the expiration check with checkExpires: false,
  // in which case an expired task (e.g. one that has not been cleaned up) may be returned
  expires: 100,
});

// Multiple calls request the same key

const handleRequest = async ({ prev, wait }) => {
  // You can also judge manually. It usually only makes sense when checkExpires: false is set.
  if (prev && prev.expires < Date.now()) {
    return 1;
  }
  const prevResult = await wait();
  if (prevResult) {
    return prevResult + 1;
  }
  // do something, for example make a network request to get the result
  return 1;
}

const result = await Promise.all([
  schedule.invoke(handleRequest, {
    key: 'key1',
  }),
  schedule.invoke(handleRequest, {
    key: 'key1',
    // If you want to reuse an expired task, you can disable the expiration check with checkExpires: false
    // Note: this may cause an expired task to be returned, and it is not 100% guaranteed to be returned —
    // when the max limit is exceeded, it will be released with priority
    checkExpires: false,
  });
])

// Result: the second call reuses the result from the first call
result === [1, 2]


// A new request will not reuse the previous cache because the key is different
// (since the max cache count is 1, the previous cache will be released)
const result2 = await schedule.invoke(handleRequest, {
  key: 'key2',
});

result2 === 1


/**
 * Because key1 above was released, key1 here will not reuse the previous cache
 * createSchedule's expires provides an expiration function for control, which can be used to manage
 * when task requests (the same key ultimately maintain the same expiration time) expire
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

// Multiple calls request the same key

const handleRequest = async ({ wait }) => {
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

// Multiple calls request the same key

const handleRequest = async ({ repeatCount, repeat, result }) => {
  // Simulate a network request, e.g. poll 10 times to get the result
  const res = await fetch('https://api.example.com/data');
  if (repeatCount < 10) {
    return repeat((result || []).concat([res]));
  }
  return result;
}

const result = await schedule.invoke(handleRequest)


// result equals the collection of 10 polling results
result === [res, ...10]

```

- New batch task control

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

// You can also manually force processing
batcher.flush();

```


## 1.1.0
- Adjusted default expiration control
  - This change modifies the default expires expiration logic. When invoke is called, the expiration time is checked by default. If it has expired, prev in the callback will be empty
  - You can disable the expiration check with checkExpires: false, which may cause an expired task (e.g. one that has not been cleaned up) to be returned
