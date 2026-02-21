// Simple IoU-based person tracker

export interface Detection {
  id: number;
  bbox: [number, number, number, number]; // x, y, width, height
  score: number;
  class: string;
}

export interface TrackedPerson {
  id: number;
  bbox: [number, number, number, number];
  score: number;
  age: number; // frames since last seen
  velocity: [number, number]; // estimated velocity for prediction
}

function iou(a: [number, number, number, number], b: [number, number, number, number]): number {
  const x1 = Math.max(a[0], b[0]);
  const y1 = Math.max(a[1], b[1]);
  const x2 = Math.min(a[0] + a[2], b[0] + b[2]);
  const y2 = Math.min(a[1] + a[3], b[1] + b[3]);

  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const areaA = a[2] * a[3];
  const areaB = b[2] * b[3];
  const union = areaA + areaB - intersection;

  return union > 0 ? intersection / union : 0;
}

function centerDistance(a: [number, number, number, number], b: [number, number, number, number]): number {
  const cx1 = a[0] + a[2] / 2;
  const cy1 = a[1] + a[3] / 2;
  const cx2 = b[0] + b[2] / 2;
  const cy2 = b[1] + b[3] / 2;
  return Math.sqrt((cx1 - cx2) ** 2 + (cy1 - cy2) ** 2);
}

export class PersonTracker {
  private tracked: TrackedPerson[] = [];
  private nextId = 1;
  private readonly iouThreshold = 0.2;
  private readonly maxAge = 15; // frames before losing track

  update(detections: Detection[]): TrackedPerson[] {
    const personDetections = detections.filter(d => d.class === 'person');

    if (this.tracked.length === 0) {
      this.tracked = personDetections.map(d => ({
        id: this.nextId++,
        bbox: d.bbox,
        score: d.score,
        age: 0,
        velocity: [0, 0],
      }));
      return this.tracked;
    }

    // Match detections to existing tracks using IoU
    const matched = new Set<number>();
    const matchedDetections = new Set<number>();

    // Build cost matrix
    const costs: { trackIdx: number; detIdx: number; score: number }[] = [];
    for (let ti = 0; ti < this.tracked.length; ti++) {
      // Predict position using velocity
      const predicted: [number, number, number, number] = [
        this.tracked[ti].bbox[0] + this.tracked[ti].velocity[0],
        this.tracked[ti].bbox[1] + this.tracked[ti].velocity[1],
        this.tracked[ti].bbox[2],
        this.tracked[ti].bbox[3],
      ];
      for (let di = 0; di < personDetections.length; di++) {
        const iouScore = iou(predicted, personDetections[di].bbox);
        const dist = centerDistance(predicted, personDetections[di].bbox);
        const maxDim = Math.max(predicted[2], predicted[3], 100);
        const distScore = Math.max(0, 1 - dist / (maxDim * 2));
        const combinedScore = iouScore * 0.6 + distScore * 0.4;
        if (combinedScore > 0.1) {
          costs.push({ trackIdx: ti, detIdx: di, score: combinedScore });
        }
      }
    }

    // Greedy matching (sorted by score descending)
    costs.sort((a, b) => b.score - a.score);
    for (const { trackIdx, detIdx } of costs) {
      if (matched.has(trackIdx) || matchedDetections.has(detIdx)) continue;
      const det = personDetections[detIdx];
      const track = this.tracked[trackIdx];
      
      // Update velocity
      track.velocity = [
        det.bbox[0] - track.bbox[0],
        det.bbox[1] - track.bbox[1],
      ];
      track.bbox = det.bbox;
      track.score = det.score;
      track.age = 0;
      
      matched.add(trackIdx);
      matchedDetections.add(detIdx);
    }

    // Age unmatched tracks
    for (let ti = 0; ti < this.tracked.length; ti++) {
      if (!matched.has(ti)) {
        this.tracked[ti].age++;
        // Predict position
        this.tracked[ti].bbox[0] += this.tracked[ti].velocity[0];
        this.tracked[ti].bbox[1] += this.tracked[ti].velocity[1];
      }
    }

    // Remove old tracks
    this.tracked = this.tracked.filter(t => t.age < this.maxAge);

    // Add new detections
    for (let di = 0; di < personDetections.length; di++) {
      if (!matchedDetections.has(di)) {
        this.tracked.push({
          id: this.nextId++,
          bbox: personDetections[di].bbox,
          score: personDetections[di].score,
          age: 0,
          velocity: [0, 0],
        });
      }
    }

    return this.tracked;
  }

  reset() {
    this.tracked = [];
    this.nextId = 1;
  }

  getTracked(): TrackedPerson[] {
    return this.tracked;
  }
}

export function findPersonAtPoint(
  persons: TrackedPerson[],
  x: number,
  y: number,
  canvasWidth: number,
  canvasHeight: number,
  videoWidth: number,
  videoHeight: number
): TrackedPerson | null {
  const scaleX = videoWidth / canvasWidth;
  const scaleY = videoHeight / canvasHeight;
  const vx = x * scaleX;
  const vy = y * scaleY;

  for (const person of persons) {
    const [bx, by, bw, bh] = person.bbox;
    if (vx >= bx && vx <= bx + bw && vy >= by && vy <= by + bh) {
      return person;
    }
  }
  return null;
}
