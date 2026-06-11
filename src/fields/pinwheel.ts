/* fields/pinwheel.ts - BREEZE (new concept: a cheeky wind-puff cloud).
   A soft cloud with puffed cheeks blowing a little gust the way it pushes you.
   o.dir is a dir name */
import { C } from '../lib/palette';
import type { FieldFn, Dir4 } from '../lib/types';

export const pinwheel: FieldFn = (ctx, o) => {
  const px = o.px, py = o.py, cell = o.cell, now = o.now, dir = o.dir;
  const DIRS: Record<Dir4, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const dv: [number, number] = (dir != null ? DIRS[dir] : undefined) ?? [1, 0];
  ctx.save(); ctx.translate(px, py);

  /* gust puffs streaming out in the blow direction */
  ctx.save(); ctx.rotate(Math.atan2(dv[1], dv[0]));
  ctx.strokeStyle = C.portalLn; ctx.lineWidth = Math.max(2, cell * 0.04); ctx.lineCap = 'round';
  const ph = (now * 0.0015) % 1;
  for (let i = 0; i < 2; i++) {
    const prog = (ph + i / 2) % 1;
    const gx0 = cell * 0.22 + prog * cell * 0.2;
    ctx.globalAlpha = Math.sin(prog * Math.PI) * 0.45;
    const yy = (i - 0.5) * cell * 0.16;
    ctx.beginPath();
    ctx.moveTo(gx0, yy);
    ctx.quadraticCurveTo(gx0 + cell * 0.12, yy - cell * 0.07, gx0 + cell * 0.13, yy);
    ctx.quadraticCurveTo(gx0 + cell * 0.14, yy + cell * 0.06, gx0 + cell * 0.24, yy);
    ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.restore();

  /* cloud body: union of soft puffs with a faint blue rim */
  const puffs: ReadonlyArray<readonly [number, number, number]> =
    [[-0.17, 0.03, 0.16], [-0.02, -0.08, 0.19], [0.18, 0.0, 0.15], [0.02, 0.12, 0.16], [-0.05, 0.02, 0.17]];
  ctx.save();
  ctx.shadowColor = 'rgba(84,174,236,0.55)'; ctx.shadowBlur = cell * 0.05;
  const cg = ctx.createLinearGradient(0, -cell * 0.22, 0, cell * 0.22);
  cg.addColorStop(0, '#FFFFFF'); cg.addColorStop(1, '#D5EEFB');
  ctx.fillStyle = cg;
  ctx.beginPath();
  for (const pp of puffs) { ctx.moveTo(cell * pp[0] + cell * pp[2], cell * pp[1]); ctx.arc(cell * pp[0], cell * pp[1], cell * pp[2], 0, 7); }
  ctx.fill();
  ctx.restore();

  /* face */
  ctx.fillStyle = C.pupil;
  ctx.beginPath(); ctx.arc(-cell * 0.07, -cell * 0.005, cell * 0.026, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(cell * 0.07, -cell * 0.005, cell * 0.026, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-cell * 0.08, -cell * 0.015, cell * 0.009, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(cell * 0.06, -cell * 0.015, cell * 0.009, 0, 7); ctx.fill();
  /* blowing mouth */
  ctx.fillStyle = C.pupil;
  ctx.beginPath(); ctx.ellipse(0, cell * 0.07, cell * 0.028, cell * 0.038, 0, 0, 7); ctx.fill();
  /* puffed cheeks */
  ctx.fillStyle = '#9FD3F2'; ctx.globalAlpha = 0.7;
  ctx.beginPath(); ctx.arc(-cell * 0.16, cell * 0.05, cell * 0.045, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(cell * 0.16, cell * 0.05, cell * 0.045, 0, 7); ctx.fill();
  ctx.globalAlpha = 1;

  ctx.restore();
};
