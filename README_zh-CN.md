# do-schedule
用于控制和调度异步函数的工具

```
npm install do-schedule
```

- 并发请求下，使用相同的缓存

```js
import { createSchedule } from 'do-schedule';

const schedule = createSchedule({
  // 缓存最大数
  max: 1,
});

// 多次调用请求相同的key

const handleRequest = async ({ wait}) => {
  const prevResult = await wait();
  if (prevResult) {
    return prevResult + 1;
  }
  // do something， 例如发起网络请求 获取结果
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

// 结果为: 第二次 复用了第一次的结果
result === [1, 2]


// 新的一个请求，不会复用之前的缓存 key 不一样（因为max 最大缓存为1 ，所以会被释放）
const result2 = await schedule.invoke(handleRequest, {
  key: 'key2',
});

result2 === 1


/**
 * 因为上面的key1 被释放了，所以这里的key1 不会复用之前的缓存
 * createSchedule expires 提供了过期函数控制，可以用于管理任务请求(相同的key 最终维持相同的过期时间) 什么时候会过期
 */
const result1 = await schedule.invoke(handleRequest, {
  key: 'key1',
});

result1 === 1


```


- 自动可中断、销毁 任务

```js
import { createSchedule } from 'do-schedule';

const schedule = createSchedule();

// 多次调用请求相同的key

const handleRequest = async ({ wait}) => {
  const prevResult = await wait();
  if (prevResult) {
    return prevResult + 1;
  }
  // do something， 例如发起网络请求 获取结果
  // timeout 模拟延迟等待
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



// 调用 task2 会自动中断 task1 , 并且task1 会抛出错误
task1 throw error

// task2 执行完成后，会自动销毁, 所以task3 无法获取到task2的结果
await task2

const task3 = schedule.invoke(handleRequest, {
  key: 'key1',
})

await task3 === 1

```


- 可重复执行的任务

```js
import { createSchedule } from 'do-schedule';

const schedule = createSchedule();

// 多次调用请求相同的key

const handleRequest = async ({ repeatCount, repeat, result }) => {
  // 模拟网络请求, 例如轮询 10 次 获取结果
  const res = await fetch('https://api.example.com/data');
  if (repeatCount < 10) {
    return repeat((result || []).concat([res]));
  }
  return result;
}

const result = await schedule.invoke(handleRequest)


// result 等 10 次 轮询结果 集合
result === [res,...10]

```
