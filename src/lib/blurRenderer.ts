import { TrackedPerson } from "./tracker";

export function renderWithSelectiveBlur(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  persons: TrackedPerson[],
  selectedPersonId: number | null,
  blurAmount: number = 15
) {
  const W = canvas.width;
  const H = canvas.height;
  const VW = video.videoWidth;
  const VH = video.videoHeight;

  if (!VW || !VH) return;

  const scaleX = W / VW;
  const scaleY = H / VH;

  // Draw blurred background
  ctx.save();
  ctx.filter = `blur(${blurAmount}px)`;
  ctx.drawImage(video, 0, 0, W, H);
  ctx.restore();

  // If no person is selected → nothing to unblur
  if (selectedPersonId === null) return;

  const person = persons.find((p) => p.id === selectedPersonId);
  if (!person) return;

  // Extract bounding box
  const [bx, by, bw, bh] = person.bbox;

  // Scaled coordinates on canvas
  const dx = bx * scaleX;
  const dy = by * scaleY;
  const dw = bw * scaleX;
  const dh = bh * scaleY;

  // Draw sharp person (cut-out)
  ctx.save();
  ctx.beginPath();
  ctx.rect(dx, dy, dw, dh);   // exact bounding box region
  ctx.clip();

  // Draw SHARP video only inside person area
  ctx.filter = "none"; // remove blur
  ctx.drawImage(video, 0, 0, W, H);
  ctx.restore();
}