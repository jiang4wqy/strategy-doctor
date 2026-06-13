## 目标

<!-- 一个 PR 只描述一个模块目标。 -->

## 修改文件

<!-- 列出实际修改路径。 -->

## 未包含范围

<!-- 明确本 PR 没有顺手修改的模块。 -->

## 公共接口变化

- [ ] 无
- [ ] 有，已说明迁移影响、示例 JSON 和受影响 owner

说明：

## 跨模块依赖与合并顺序

<!-- 写明前置 PR/commit；无依赖时写“无”。 -->

## 验证

```text
npm.cmd ci:
npm.cmd run verify:
git diff --check:
```

- Tests:
- Passed:
- Skipped:
- Coverage:

## 安全与兼容检查

- [ ] 默认 demo 和 CI 仍离线
- [ ] 未加入账户、持仓或下单能力
- [ ] 未提交 key、secret、passphrase 或私有数据
- [ ] 未降低 coverage 门槛
- [ ] 未修改 shock 来强制策略死亡
- [ ] `ma-cross` 基线无意外变化，或已清楚说明原因

## 已知限制

<!-- 没有时写“无”。 -->
