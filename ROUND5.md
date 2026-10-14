# Round 5 — 加载体验、后处理与最终优化

## 交付标准对照

### 1. 首屏 Loading

- [x] Y2K / 像素感加载屏：`N•` 品牌标识、`ASSEMBLING YOUR CITY POD R1` 文案、条纹像素进度条（`image-rendering: pixelated` + `steps(10,end)` 过渡）。
- [x] 进度显示：`000% — 加载 HDR 光照` 由 `LoadingManager` 的 `onStart / onProgress / onError / onLoad` 驱动。
- [x] 进度关联真实资源加载（RGBELoader 通过同一个 LoadingManager 加载 HDR），不再使用固定延迟。
- [x] 兜底：HDR 失败时 `onError` 回退默认光照；另加 8s 硬超时，资源挂起也不会卡在加载屏。

### 2. 汽车入场动画

- [x] 从下方进入：`position.y` 由 -0.8 上升至 0。
- [x] Opacity 0→1：`setCarOpacity` 逐材质恢复原始透明度。
- [x] Scale 弹性：0.8 → 1.05 → 0.98 → 1.0（`getEntranceFrame` 关键帧插值 + easeOutCubic）。
- [x] 轻微 overshoot 后稳定到 1。单测覆盖 0s / 1.35s / 0.945s 三个关键点。

### 3. Bloom

- [x] EffectComposer + RenderPass + UnrealBloomPass + OutputPass。
- [x] 车灯/高光有明确但克制的 Bloom（strength 0.16、radius 0.22、threshold 0.92），不过曝。

### 4. 轻微色散

- [x] RGBShiftShader 强度 0.0002，只提供 Y2K 数码镜头感，不做严重 RGB 分离。

### 5. 软阴影

- [x] `PCFSoftShadowMap`，ShadowMap 分辨率 1024（低档 512），不使用超高分辨率阴影。

### 6. 性能管理

- [x] DPR 上限：桌面 1.8 / 低档 1.25。
- [x] Shadow Map 尺寸受控，主光源阴影范围收紧到 ±5。
- [x] Geometry 复用：轮胎、车壳、水滴几何体克隆复用；Material 复用：金属/内饰/玻璃等共享材质实例。
- [x] 渲染循环内只更新位置/旋转/爆炸进度，不重复创建资源。
- [x] 漂浮物数量受控（桌面 3 个，低档 1 个）。
- [x] Reflector 参数合理：分辨率 768（低档 384），九点采样柔化反射，无实时 Cubemap。

### 7. 移动端自动降级

检测 `viewportWidth / coarsePointer / hardwareConcurrency / deviceMemory` 后（`getQualityProfile`）：

- [x] Bloom OFF（跳过整条后处理链，直接 `renderer.render`）。
- [x] 色散 OFF（同后处理链跳过）。
- [x] Shadow 降级（512）。
- [x] DPR 降级（1.25）。
- [x] 漂浮元素减少（低档只保留星芒，移除两枚水滴及其 Reflector 成本）。
- [x] Reflector 降低质量（分辨率 384 + 更大 blurStep）。

### 8. 响应式

- [x] Desktop / Tablet / Mobile 三档 CSS 断点（900px、650px）自适应 UI。
- [x] Camera resize、Renderer resize、Composer resize 统一在 `resize()` 内更新。

### 9. 资源释放

- [x] `dispose()` 完整释放：Geometry / Material / Texture 经 `scene.traverse` 逐个 dispose。
- [x] RenderTarget（PMREM 环境）与 PMREMGenerator 释放。
- [x] Composer、Reflector（其内部 RenderTarget 不在 scene graph，显式 `reflector.dispose()`）、OrbitControls、RaycastInteractions、Tween 释放。
- [x] 取消 `animationFrame`、`resize` 监听与加载兜底计时器；`pagehide` 触发一次性 `dispose()`。

### 10. 最终回归测试

- [x] 汽车模型 / 车漆 / 三种颜色 / 三种轮毂 / HDR / Reflector / 漂浮元素 / OrbitControls / 车门 / 车灯 / 地面光斑 / 爆炸视图 / UI / Loading / Bloom / 色散 / 移动端降级：经 `npm run build` + 单测 + 三端截图回归，均正常。

### 11. 车体轮廓与开门空间精修

- [x] 车身新增跨全宽的 `rounded-nose-crown` 与 `rounded-tail-crown` 曲面，圆角车头、车尾与两侧轮拱不再只是平面侧板组合。
- [x] 新增 `capsule-cabin-bridge` 半透明胶囊顶桥；保留下方全景玻璃与独立座舱，座椅、骨架和方向盘仍可从开启的门洞看到。
- [x] 车门继续作为独立 Pivot：外门板、车窗、内门板、窗框和把手全部随铰链旋转，未以隐藏车身伪造门洞。
- [x] 车壳与车门的 Transmission 从过度通透调整为乳白磨砂糖果塑料；玻璃维持更高透明度，内饰仍使用独立浅色材质。
- [x] 调低 ACES 曝光、环境补光、主/辅灯、Bloom、色散与 Reflector 九点采样权重，恢复车漆虹彩、镀铬轮毂与座舱细节。

## 本轮新增

- `ShowroomApp` 增加 `reflector` 引用并在销毁时释放；低质量档位移除两枚水滴漂浮物。
- 加载完成逻辑抽取为 `finishLoading()`，带幂等保护与 8s 硬超时兜底。
- 新增 `test/showroom-state.test.ts`，覆盖 `ShowroomState` 的默认快照、不可变更新、no-op 抑制、场景模式与退订。

## 验证记录

- `npm run build`：通过（TypeScript 检查 + Vite 生产构建）。
- `npm run test`：6 个测试文件、46 项测试全部通过；新增车体测试确认胶囊顶桥、圆角鼻部/尾部与完整门组件存在。
- `npm run preview` 后本地 `curl`：`/` 与 `/hdr/studio_small_03_1k.hdr` 均 HTTP 200。
- 无头 Edge 截图（1440×900 / 820×1180 / 390×844）：三档均正常渲染，粉色车身可见、加载屏已消除、场景非空白，移动端降级路径（无后处理）仍正常出图。
- 已知非阻塞项：生产 JS chunk 626 kB（gzip 164 kB）超过 Vite 500 kB 提示，源于 Three.js 单一依赖，不影响交付；如需进一步可做 manualChunks 拆分。
