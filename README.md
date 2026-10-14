# NEONETTE — Y2K City Pod

基于 Three.js 和 TypeScript 的 Y2K 风格 A00 微型代步车展示页。车辆外壳、车门、玻璃、内饰、车轮和车架均由程序化几何生成，不依赖外部 GLB/GLTF 模型。

## 本地运行

```bash
npm install
npm run dev
```

然后打开终端显示的本地地址。

## 构建

```bash
npm run build
```

## 主要交互

- 车身颜色：泡泡糖粉、冰蓝、荧光青柠
- 车门开合与真实门洞
- 车灯开关
- 轮毂样式、车顶行李架、环境亮度和自动旋转
- 滚轮缩放触发车辆拆解视图

## 目录说明

- `src/car/`：程序化车身、车门、玻璃、车轮、车架和内饰
- `src/app/`：展示页状态、交互和控制面板
- `ROUND1.md` 至 `ROUND5.md`：迭代交付记录
