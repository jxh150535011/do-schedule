## 1.0.3
- 兼容 AbortController 判断，对于不支持的环境默认不启用

## 1.1.0
- Adjusted default expiration control
  - This change modifies the default expires expiration logic. When invoke is called, the expiration time is checked by default. If it has expired, prev in the callback will be empty
  - You can disable the expiration check with checkExpires: false, which may cause an expired task (e.g. one that has not been cleaned up) to be returned