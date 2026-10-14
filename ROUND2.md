# Round 2 — Y2K 材质与环境氛围

## 交付标准对照

- [x] 车壳使用 `MeshPhysicalMaterial`：Transmission、低 Roughness、Clearcoat、IOR、厚度与淡乳白吸收色。
- [x] 车窗独立物理玻璃材质，具 Transmission / 折射厚度 / 轻微粗糙度；座椅、方向盘和结构架留在窗后。
- [x] 原生薄膜干涉参数：Iridescence、IOR、Thickness Range。
- [x] 三种车漆通过同一组物理材质参数切换颜色。
- [x] 镀铬轮毂使用高金属度、低粗糙度，并受 HDR 环境照明。
- [x] 三种轮毂为不同几何：多层环、五辐、十四向放射结构；UI 可切换。
- [x] 座椅、仪表台、方向盘、车内地板与车门内侧使用独立浅色内饰材质；不继承虹彩车漆。
- [x] 车漆状态只绑定外壳和车门外侧材质；内饰颜色不随车漆切换。
- [x] 本地 HDRI 通过 RGBELoader 加载，经 PMREM 转换后设为 `scene.environment`。
- [x] 地面用 Three.js `Reflector`，自定义九点采样柔化反射；没有使用实时 Cubemap。
- [x] 低饱和渐变网格背景。
- [x] 按最新场景要求恢复一颗星芒与两枚缓慢浮动/旋转的水滴；装饰会自然进入 Reflector 地面反射。环形漂浮物仍保持移除。

## 验证记录

- `npm run build`：通过。
- 结构检查覆盖车门关闭/打开 × 粉/蓝/绿车漆，共 6 种组合：关闭时首个侧向命中为车门外板，打开时首个命中为座椅；全部内饰材质颜色保持不变。
- 本地页面与 `/hdr/studio_small_03_1k.hdr`：开发服务器 HTTP 200。
- 浏览器 WebGL 画面签收尚未完成：当前受限环境没有可连接的自动化浏览器实例。需要浏览器目视确认反射柔化、Transmission / Iridescence 的最终观感及材质编译。

## 环境贴图

`public/hdr/studio_small_03_1k.hdr`：Poly Haven “Studio Small 03”，1K HDR，CC0。HDR 仅用于环境照明；汽车模型仍为程序化几何。

Round 3 的交付与验收记录见 [ROUND3.md](./ROUND3.md)。
