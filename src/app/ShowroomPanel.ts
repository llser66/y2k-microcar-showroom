import type { ShowroomAction, ShowroomStateSnapshot } from './ShowroomState';

export class ShowroomPanel {
  constructor(
    private host: HTMLElement,
    private dispatch: (action: ShowroomAction) => void,
    private toggleDoors: () => void,
  ) {
    this.bind();
  }

  static markup() {
    return `<aside class="panel mobile-collapsed"><button type="button" class="mobile-panel-toggle" aria-expanded="false" aria-controls="mobile-panel-content"><span class="mobile-panel-heading"><small>车辆配置</small><strong>座驾设置</strong></span><span class="mobile-panel-action">展开配置 <i>⌃</i></span></button><div class="panel-content" id="mobile-panel-content"><div class="panel-head"><div><span class="eyebrow">车辆配置</span><h2>座驾设置</h2></div><span class="live" id="view-mode"><i></i> 展示模式</span></div>
      <div class="explosion-readout"><span>爆炸视图</span><b id="explosion-percent">0%</b><div class="explosion-track"><i id="explosion-progress"></i></div><small>滚动缩放以拆解车辆</small></div>
      <div class="control"><div class="control-title"><span>01 / 车身颜色</span><small>虹彩糖果车漆</small></div><div class="swatches"><button class="swatch pink selected" data-color="#ff86cc" data-name="泡泡糖粉" aria-label="泡泡糖粉" aria-pressed="true"></button><button class="swatch blue" data-color="#83d9ed" data-name="冰蓝" aria-label="冰蓝" aria-pressed="false"></button><button class="swatch lime" data-color="#c6ed69" data-name="荧光青柠" aria-label="荧光青柠" aria-pressed="false"></button></div><div class="color-name">泡泡糖粉 <span>●</span></div></div>
      <div class="control"><div class="control-title"><span>02 / 轮毂样式</span><small>镀铬系列</small></div><div class="wheel-options"><button data-wheel="1" class="active" aria-pressed="true">01 <span>星环</span></button><button data-wheel="2" aria-pressed="false">02 <span>五辐</span></button><button data-wheel="3" aria-pressed="false">03 <span>放射</span></button></div></div>
      <div class="control toggles"><label for="rack"><span><b>车顶行李架</b><small>镀铬行李架</small></span><input id="rack" type="checkbox" checked><i></i></label><label for="auto"><span><b>自动旋转</b><small>展示台旋转</small></span><input id="auto" type="checkbox" checked><i></i></label></div>
      <div class="control brightness"><div class="control-title"><span>03 / 环境光照</span><b>1.00</b></div><input id="brightness" type="range" min="0.5" max="1.8" step="0.05" value="1"></div>
      <footer class="panel-foot"><span>为城市而设计<br><b>为明天而造。</b></span><span>↗ &nbsp;2026</span></footer></div></aside>`;
  }

  render(state: ShowroomStateSnapshot) {
    this.host.classList.toggle('configuration-mode', state.configurationMode);
    const mode = this.host.querySelector('#view-mode');
    if (mode) mode.innerHTML = `<i></i> ${state.configurationMode ? '配置模式' : '展示模式'}`;
    const percent = Math.round(state.explosionProgress * 100);
    const readout = this.host.querySelector('#explosion-percent'); if (readout) readout.textContent = `${percent}%`;
    const fill = this.host.querySelector<HTMLElement>('#explosion-progress'); if (fill) fill.style.width = `${percent}%`;
    this.host.querySelectorAll<HTMLButtonElement>('[data-color]').forEach((button) => {
      const selected = button.dataset.color === state.bodyColor;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', `${selected}`);
    });
    const name = this.host.querySelector('.color-name');
    const selectedColor = this.host.querySelector<HTMLButtonElement>(`[data-color="${state.bodyColor}"]`);
    if (name && selectedColor) name.innerHTML = `${selectedColor.dataset.name} <span>●</span>`;
    this.host.querySelectorAll<HTMLButtonElement>('[data-wheel]').forEach((button) => {
      const selected = Number(button.dataset.wheel) === state.wheelStyle;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', `${selected}`);
    });
    const rack = this.host.querySelector<HTMLInputElement>('#rack'); if (rack) rack.checked = state.roofRackVisible;
    const auto = this.host.querySelector<HTMLInputElement>('#auto'); if (auto) auto.checked = state.autoRotate;
    const brightness = this.host.querySelector<HTMLInputElement>('#brightness'); if (brightness) brightness.value = `${state.ambientIntensity}`;
    const brightnessReadout = this.host.querySelector('.brightness .control-title b');
    if (brightnessReadout) brightnessReadout.textContent = state.ambientIntensity.toFixed(2);
    const doorLabel = this.host.querySelector('#door-action-label');
    if (doorLabel) doorLabel.textContent = state.doorsOpen ? '关闭车门' : '打开车门';
    const doorButton = this.host.querySelector('#door-action');
    doorButton?.setAttribute('aria-pressed', `${state.doorsOpen}`);
    const lampButton = this.host.querySelector('#lamp-action');
    lampButton?.classList.toggle('on', state.headlightsOn);
    lampButton?.setAttribute('aria-pressed', `${state.headlightsOn}`);
    const lampLabel = this.host.querySelector('#lamp-action-label');
    if (lampLabel) lampLabel.textContent = state.headlightsOn ? '● 车灯：开启' : '○ 车灯：关闭';
  }

  private bind() {
    const mobileToggle = this.host.querySelector<HTMLButtonElement>('.mobile-panel-toggle')!;
    const panel = this.host.querySelector<HTMLElement>('.panel')!;
    mobileToggle.addEventListener('click', () => {
      const expanded = panel.classList.toggle('mobile-expanded');
      panel.classList.toggle('mobile-collapsed', !expanded);
      mobileToggle.setAttribute('aria-expanded', `${expanded}`);
      const action = mobileToggle.querySelector('.mobile-panel-action');
      if (action) action.innerHTML = expanded ? '收起配置 <i>⌄</i>' : '展开配置 <i>⌃</i>';
    });
    this.host.querySelectorAll<HTMLButtonElement>('[data-color]').forEach((button) => button.addEventListener('click', () => {
      this.dispatch({ type: 'bodyColor', value: button.dataset.color! });
    }));
    this.host.querySelectorAll<HTMLButtonElement>('[data-wheel]').forEach((button) => button.addEventListener('click', () => {
      this.dispatch({ type: 'wheelStyle', value: Number(button.dataset.wheel) as 1 | 2 | 3 });
    }));
    this.host.querySelector<HTMLInputElement>('#rack')!.addEventListener('change', (event) => {
      this.dispatch({ type: 'roofRackVisible', value: (event.target as HTMLInputElement).checked });
    });
    this.host.querySelector<HTMLInputElement>('#auto')!.addEventListener('change', (event) => {
      this.dispatch({ type: 'autoRotate', value: (event.target as HTMLInputElement).checked });
    });
    this.host.querySelector<HTMLInputElement>('#brightness')!.addEventListener('input', (event) => {
      this.dispatch({ type: 'ambientIntensity', value: Number((event.target as HTMLInputElement).value) });
    });
    this.host.querySelector('#door-action')!.addEventListener('click', () => {
      this.toggleDoors();
    });
    this.host.querySelector('#lamp-action')!.addEventListener('click', () => {
      const button = this.host.querySelector('#lamp-action')!;
      this.dispatch({ type: 'headlightsOn', value: !button.classList.contains('on') });
    });
  }
}
