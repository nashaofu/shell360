export type OverlayCloseFn = () => unknown;

const OVERLAY_CLOSE_FNS: OverlayCloseFn[] = [];

export default {
  add: (fn: OverlayCloseFn) => {
    OVERLAY_CLOSE_FNS.push(fn);
  },
  delete: (fn: OverlayCloseFn) => {
    const index = OVERLAY_CLOSE_FNS.findIndex((item) => item === fn);
    if (index !== -1) {
      OVERLAY_CLOSE_FNS.splice(index, 1);
    }
  },
  pop: () => OVERLAY_CLOSE_FNS.pop(),
  get length() {
    return OVERLAY_CLOSE_FNS.length;
  },
};
