# 可观测性菜单排序设计

> 对应 Issue：[openbkn-ai/bkn-studio #532](https://github.com/openbkn-ai/bkn-studio/issues/532)

## 目标

将主线左侧导航中的可观测性整体菜单置于模型管理之后、系统管理之前。

## 方案

顶级菜单由 `src/app/shell/console-navigation.tsx` 组装。基础菜单与顶级
模块贡献分属两组，单纯调整贡献数组不能将可观测性插入二者之间。因此在
`ConsoleNavContribution` 上增加可选的 `afterKey` 锚点；BKN Trace 以
`model-resources` 为锚点，由组装器将它插入模型管理之后。

不引入排序权重，也不改渲染层。路由、子菜单、权限过滤和菜单 key 都保持
不变。

## 验证

在 `console-navigation.test.ts` 中增加顶级菜单相对顺序断言，确认模型管理、
可观测性与系统管理依次出现。保留现有权限过滤测试，证明排序改动不会改变
可观测性对普通用户的可见性。
