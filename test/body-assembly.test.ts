import { describe, expect, it } from 'vitest';
import { buildCar } from '../src/car/buildCar';

describe('procedural A00 body assembly', () => {
  it('closes the capsule cabin and both rounded body ends across the full car width', () => {
    const car = buildCar();

    expect(car.root.getObjectByName('capsule-cabin-bridge')).toBeDefined();
    expect(car.root.getObjectByName('rounded-nose-crown')).toBeDefined();
    expect(car.root.getObjectByName('rounded-tail-crown')).toBeDefined();
  });

  it('does not put painted shell bars behind either windscreen', () => {
    const car = buildCar();
    expect(car.root.getObjectByName('capsule-roof-skin')).toBeUndefined();
  });

  it('uses one continuous three-dimensional exterior capsule shell', () => {
    const car = buildCar();
    expect(car.root.getObjectByName('capsule-exterior-shell')).toBeDefined();
    expect(car.root.getObjectByName('capsule-exterior-side-left')).toBeUndefined();
    expect(car.root.getObjectByName('capsule-exterior-side-right')).toBeUndefined();
  });

  it('builds a long capsule cabin from slim curved frames and separate quarter glazing', () => {
    const car = buildCar();
    for (const side of [-1, 1]) {
      expect(car.root.getObjectByName(`capsule-outline-${side}`)).toBeDefined();
      expect(car.root.getObjectByName(`capsule-roof-rail-${side}`)).toBeDefined();
      expect(car.root.getObjectByName(`capsule-quarter-glass-front-${side}`)).toBeDefined();
      expect(car.root.getObjectByName(`capsule-quarter-glass-rear-${side}`)).toBeDefined();
      expect(car.root.getObjectByName(`a-pillar-${side}`)).toBeUndefined();
      expect(car.root.getObjectByName(`c-pillar-${side}`)).toBeUndefined();
    }
  });

  it('keeps each door as a complete movable passenger entry assembly', () => {
    const car = buildCar();
    for (const anchor of car.doorAnchors) {
      expect(anchor.pivot.getObjectByName(`door-panel-${anchor.side > 0 ? 'left' : 'right'}`)).toBeDefined();
      expect(anchor.pivot.getObjectByName(`door-card-${anchor.side > 0 ? 'left' : 'right'}`)).toBeDefined();
      expect(anchor.pivot.getObjectByName(`door-window-${anchor.side > 0 ? 'left' : 'right'}`)).toBeDefined();
    }
  });
});
