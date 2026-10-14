export interface ShowroomStateSnapshot {
  bodyColor: string;
  wheelStyle: 1 | 2 | 3;
  roofRackVisible: boolean;
  ambientIntensity: number;
  autoRotate: boolean;
  headlightsOn: boolean;
  doorsOpen: boolean;
  configurationMode: boolean;
  explosionProgress: number;
}

export type ShowroomAction =
  | { type: 'bodyColor'; value: string }
  | { type: 'wheelStyle'; value: 1 | 2 | 3 }
  | { type: 'roofRackVisible'; value: boolean }
  | { type: 'ambientIntensity'; value: number }
  | { type: 'autoRotate'; value: boolean }
  | { type: 'headlightsOn'; value: boolean };

type Listener = (next: ShowroomStateSnapshot, previous: ShowroomStateSnapshot) => void;

/** Single source of truth shared by the DOM controls and the Three.js scene. */
export class ShowroomState {
  private snapshot: ShowroomStateSnapshot = {
    bodyColor: '#ff86cc', wheelStyle: 1, roofRackVisible: true,
    ambientIntensity: 1, autoRotate: true, headlightsOn: false,
    doorsOpen: false, configurationMode: false, explosionProgress: 0,
  };
  private listeners = new Set<Listener>();

  get value() { return this.snapshot; }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispatch(action: ShowroomAction) {
    switch (action.type) {
      case 'bodyColor': this.patch({ bodyColor: action.value }); break;
      case 'wheelStyle': this.patch({ wheelStyle: action.value }); break;
      case 'roofRackVisible': this.patch({ roofRackVisible: action.value }); break;
      case 'ambientIntensity': this.patch({ ambientIntensity: action.value }); break;
      case 'autoRotate': this.patch({ autoRotate: action.value }); break;
      case 'headlightsOn': this.patch({ headlightsOn: action.value }); break;
    }
  }

  setSceneMode(configurationMode: boolean, explosionProgress: number) {
    this.patch({ configurationMode, explosionProgress });
  }

  setDoorsOpen(doorsOpen: boolean) { this.patch({ doorsOpen }); }

  private patch(patch: Partial<ShowroomStateSnapshot>) {
    const next = { ...this.snapshot, ...patch };
    if (Object.keys(patch).every((key) => Object.is(
      this.snapshot[key as keyof ShowroomStateSnapshot], next[key as keyof ShowroomStateSnapshot],
    ))) return;
    const previous = this.snapshot;
    this.snapshot = next;
    this.listeners.forEach((listener) => listener(next, previous));
  }
}
