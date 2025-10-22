# async-schedule
A tool for controlling and scheduling asynchronous functions



- Using the same cache under concurrent requests

```js
import { createSchedule } from 'async-schedule';

const schedule = createSchedule({
  // Maximum cache count
  max: 1,
});

// Multiple calls requesting the same key

const handleRequest = async ({ wait}) => {
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
  });
])

// Result: The second call reuses the result of the first call
result === [1, 2]


// A new request will not reuse the previous cache (different key, and max cache is 1, so it will be released)
const result2 = await schedule.invoke(handleRequest, {
  key: 'key2',
});

result2 === 1


/**
 * Since key1 above was released, key1 here will not reuse the previous cache
 * createSchedule expires provides expiration function control, which can be used to manage when task requests (same key ultimately maintains the same expiration time) will expire
 */
const result1 = await schedule.invoke(handleRequest, {
  key: 'key1',
});

result1 === 1


```


- Automatically interruptible and destroyable tasks

```js
import { createSchedule } from 'async-schedule';

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
import { createSchedule } from 'async-schedule';

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