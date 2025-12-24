export function detectCirclesAndArcs(polylines, {
  maxRadialError = 0.8, minRadius = 3.0, maxRadius = 1e7, minPoints = 12, closedDist = 2.0,
  minArcAngleDeg = 15, angleMonotonicTolDeg = 25
} = {}) {
  const circles = [], arcs = [], remaining = [];
  for (const pl of polylines ?? []) {
    const pts = (pl ?? []).map(p => ({ x: p.x, y: p.y }));
    if (pts.length < minPoints) { remaining.push(pl); continue; }
    const pts2 = decimate(pts, 1.0);
    if (pts2.length < minPoints) { remaining.push(pl); continue; }
    const isClosed = dist(pts2[0], pts2[pts2.length - 1]) <= closedDist;
    const fit = fitCircleKasa(pts2);
    if (!fit) { remaining.push(pl); continue; }
    const { cx, cy, r } = fit;
    if (!(r >= minRadius && r <= maxRadius)) { remaining.push(pl); continue; }
    const err = maxRadialDeviation(pts2, cx, cy, r);
    if (err > maxRadialError) { remaining.push(pl); continue; }
    const angles = pts2.map(p => Math.atan2(p.y - cy, p.x - cx));
    const { spanDeg, monotonicOK, aStart, aEnd, ccw } = analyzeArcAngles(angles, { angleMonotonicTolDeg });
    if (isClosed && spanDeg > 300) { circles.push({ type: "CIRCLE", cx, cy, r, layer: pl.layer || "0" }); continue; }
    if (spanDeg >= minArcAngleDeg && monotonicOK) {
      arcs.push({ type: "ARC", cx, cy, r, startDeg: rad2deg(aStart), endDeg: rad2deg(aEnd), ccw, layer: pl.layer || "0" });
      continue;
    }
    remaining.push(pl);
  }
  return { circles, arcs, remainingPolylines: remaining };
}
function fitCircleKasa(points) {
  let sumX=0,sumY=0,sumX2=0,sumY2=0,sumXY=0,sumX3=0,sumY3=0,sumX1Y2=0,sumX2Y1=0;
  const n=points.length;
  for (const p of points) {
    const x=p.x,y=p.y,x2=x*x,y2=y*y;
    sumX+=x; sumY+=y; sumX2+=x2; sumY2+=y2; sumXY+=x*y;
    sumX3+=x2*x; sumY3+=y2*y; sumX1Y2+=x*y2; sumX2Y1+=x2*y;
  }
  const C=n*sumX2-sumX*sumX;
  const D=n*sumXY-sumX*sumY;
  const E=n*sumY2-sumY*sumY;
  const G=0.5*(n*(sumX3+sumX1Y2)-sumX*(sumX2+sumY2));
  const H=0.5*(n*(sumY3+sumX2Y1)-sumY*(sumX2+sumY2));
  const denom=(C*E-D*D);
  if (Math.abs(denom)<1e-9) return null;
  const cx=(G*E-D*H)/denom;
  const cy=(C*H-D*G)/denom;
  const meanR=points.reduce((acc,p)=>acc+Math.hypot(p.x-cx,p.y-cy),0)/n;
  return { cx, cy, r: meanR };
}
function maxRadialDeviation(points,cx,cy,r){
  let max=0;
  for (const p of points){ const rr=Math.hypot(p.x-cx,p.y-cy); const d=Math.abs(rr-r); if (d>max) max=d; }
  return max;
}
function analyzeArcAngles(angles,{angleMonotonicTolDeg}){
  const unwrapped=unwrapAngles(angles);
  const aMin=Math.min(...unwrapped), aMax=Math.max(...unwrapped);
  const span=aMax-aMin, spanDeg=span*180/Math.PI;
  const tol=(angleMonotonicTolDeg*Math.PI)/180;
  let back=0;
  for (let i=1;i<unwrapped.length;i++){ const delta=unwrapped[i]-unwrapped[i-1]; if (delta<-tol) back++; }
  const monotonicOK=back<=Math.max(2,Math.floor(unwrapped.length*0.05));
  let pos=0,neg=0;
  for (let i=1;i<unwrapped.length;i++){ const d=unwrapped[i]-unwrapped[i-1]; if (d>=0) pos++; else neg++; }
  const ccw=pos>=neg;
  return { spanDeg, monotonicOK, aStart: unwrapped[0], aEnd: unwrapped[unwrapped.length-1], ccw };
}
function unwrapAngles(angles){
  const out=[angles[0]];
  for (let i=1;i<angles.length;i++){
    let a=angles[i]; const prev=out[i-1];
    while (a-prev>Math.PI) a-=2*Math.PI;
    while (a-prev<-Math.PI) a+=2*Math.PI;
    out.push(a);
  }
  return out;
}
function decimate(points,minDist){
  if (!minDist||minDist<=0) return points;
  const out=[points[0]]; let last=points[0];
  for (let i=1;i<points.length;i++){ if (dist(points[i],last)>=minDist){ out.push(points[i]); last=points[i]; } }
  if (out.length>=2 && out[out.length-1]!==points[points.length-1]) out.push(points[points.length-1]);
  return out;
}
function dist(a,b){ return Math.hypot(a.x-b.x,a.y-b.y); }
function rad2deg(r){ let d=r*180/Math.PI; d=((d%360)+360)%360; return d; }
