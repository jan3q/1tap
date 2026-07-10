import { Question } from '@/types';

export function getScaleValues(q: Question): number[] {
  const min = q.scaleMin ?? 1;
  const max = q.scaleMax ?? 10;
  const step = Math.abs(q.scaleStep ?? 1);
  
  if (step <= 0) return [min];
  
  const vals: number[] = [];
  const pushVal = (v: number) => {
    const rounded = Math.round(v * 1e6) / 1e6;
    if (!vals.includes(rounded)) {
      vals.push(rounded);
    }
  };

  if (min <= max) {
    pushVal(min);
    let startMultiple = Math.ceil(min / step) * step;
    if (Math.abs(startMultiple - min) < 1e-9) {
      startMultiple = min + step;
    }
    for (let v = startMultiple; v <= max + 1e-9; v += step) {
      pushVal(v);
      if (vals.length > 1000) break;
    }
  } else {
    // Descending scale
    pushVal(min);
    let startMultiple = Math.floor(min / step) * step;
    if (Math.abs(startMultiple - min) < 1e-9) {
      startMultiple = min - step;
    }
    for (let v = startMultiple; v >= max - 1e-9; v -= step) {
      pushVal(v);
      if (vals.length > 1000) break;
    }
  }
  return vals;
}
