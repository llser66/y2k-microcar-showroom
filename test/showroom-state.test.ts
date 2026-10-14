import { describe, expect, it, vi } from 'vitest';
import { ShowroomState } from '../src/app/ShowroomState';

describe('ShowroomState', () => {
  it('starts from the default snapshot', () => {
    const state = new ShowroomState();
    expect(state.value).toMatchObject({
      bodyColor: '#ff86cc', wheelStyle: 1, roofRackVisible: true,
      ambientIntensity: 1, autoRotate: true, headlightsOn: false,
      doorsOpen: false, configurationMode: false, explosionProgress: 0,
    });
  });

  it('applies a bodyColor patch immutably and notifies with previous state', () => {
    const state = new ShowroomState();
    const listener = vi.fn();
    state.subscribe(listener);
    const previous = state.value;

    state.dispatch({ type: 'bodyColor', value: '#83d9ed' });

    expect(state.value.bodyColor).toBe('#83d9ed');
    expect(previous.bodyColor).toBe('#ff86cc');
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].bodyColor).toBe('#83d9ed');
    expect(listener.mock.calls[0][1]).toBe(previous);
  });

  it('does not notify when the patch is a no-op', () => {
    const state = new ShowroomState();
    const listener = vi.fn();
    state.subscribe(listener);

    state.dispatch({ type: 'bodyColor', value: '#ff86cc' });

    expect(listener).not.toHaveBeenCalled();
  });

  it('tracks wheel style and scene mode', () => {
    const state = new ShowroomState();
    state.dispatch({ type: 'wheelStyle', value: 3 });
    state.setSceneMode(true, 0.5);

    expect(state.value.wheelStyle).toBe(3);
    expect(state.value.configurationMode).toBe(true);
    expect(state.value.explosionProgress).toBe(0.5);
  });

  it('supports unsubscribing a listener', () => {
    const state = new ShowroomState();
    const listener = vi.fn();
    const unsubscribe = state.subscribe(listener);
    unsubscribe();

    state.dispatch({ type: 'autoRotate', value: false });

    expect(listener).not.toHaveBeenCalled();
  });
});
