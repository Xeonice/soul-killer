## 1. ANSI Logo 湮灭工具

- [x] 1.1 创建 `src/cli/animation/logo-annihilator.ts`：实现 ANSI-aware 字符位置映射，识别可见字符 vs 转义序列
- [x] 1.2 实现 `annihilateFrame()` 函数：接受 logo 行数组 + alive 布尔数组，随机将 ~5% alive 字符设为 dead（输出空格），返回处理后的字符串数组
- [x] 1.3 实现颜色衰减逻辑：根据已溶解百分比返回当前颜色（<30% → PRIMARY, 30-70% → DIM, >70% → DARK）

## 2. 退出动画重写

- [x] 2.1 重写 `exit-animation.tsx` Phase 1（系统关闭，3s）：shutdown 警告、日文元素「接続切断中」、neural state 压缩进度条、心跳衰减至平线、NEURAL LINK STATUS SEVERED
- [x] 2.2 实现 Phase 2（数据崩溃，4s）：GlitchEngine 生成 hex 行，故障强度 0→1.0 递增，行生成速度从快到慢（80ms→350ms）
- [x] 2.3 实现 Phase 3（Logo 湮灭，4s）：加载 ANSI logo → 停留 1s → 调用 annihilateFrame 逐帧消散 → 颜色衰减 → 消失
- [x] 2.4 实现 Phase 4（最终消息，1.5s）：暗红色显示 「 flatline. connection terminated 」后退出

## 3. 测试更新

- [x] 3.1 运行 `npx vitest run --update` 更新退出动画相关快照
- [ ] 3.2 手动验证完整退出流程视觉效果
