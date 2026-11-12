/* The destination and its bookmarks are live immediately; only inert paper is animated. */
export function createBookMotion({book, canvas, cover}: {book: HTMLElement; canvas: HTMLElement; cover: HTMLElement}) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const app = book.closest<HTMLElement>('[data-reduced-motion]');
  const reduced = () => reduce.matches || app?.dataset.reducedMotion === 'true';
  const preference = new MutationObserver(() => { if(reduced())cancel(); });
  if(app)preference.observe(app,{attributes:true,attributeFilter:['data-reduced-motion']});
  const sections = ['story', 'thoughts', 'room', 'favorites'];
  const make = (className: string) => Object.assign(document.createElement('div'), {className});
  const liveLeaf = () => canvas.querySelector<HTMLElement>(':scope > [data-leaves]');
  let overlay: HTMLElement | null = null, anims: Animation[] = [], frame = 0;

  book.classList.add('bm-binding');
  canvas.classList.add('bm-canvas');
  cover.classList.add('bm-cover');
  cover.inert = true;
  cover.hidden = true;
  cover.setAttribute('aria-hidden','true');
  if (!cover.childElementCount) {
    const front = make('bm-cloth'), label = make('bm-cover-label');
    label.textContent = '窗边手记';
    front.append(label);
    cover.append(front, make('bm-endpaper'));
  }
  function cancel() {
    cancelAnimationFrame(frame);
    for (const a of anims) { a.onfinish=null; a.cancel(); }
    anims = [];
    overlay?.remove(); overlay=null;
    cover.hidden=true;
  }
  function open() {
    cancel();
    if (reduced() || !book.getClientRects().length) return;
    cover.hidden=false;
    const swing=cover.animate([
      {transform:'perspective(1050px) rotateY(0deg)',offset:0},
      {transform:'perspective(1050px) rotateY(-2.5deg)',offset:.13},
      {transform:'perspective(1050px) rotateY(-68deg)',offset:.63},
      {transform:'perspective(1050px) rotateY(-112deg)',offset:1}
    ],{duration:650,easing:'cubic-bezier(.30,.03,.2,1)',fill:'both'});
    anims.push(swing);
    swing.onfinish=cancel;
  }
  function snap(source: HTMLElement) {
    const copy=source.cloneNode(true) as HTMLElement, origNodes=[source,...source.querySelectorAll('*')];
    const offsets: [number,number,number][]=[];
    origNodes.forEach((n,i)=>{if(n.scrollTop || n.scrollLeft) offsets.push([i,n.scrollLeft,n.scrollTop]);});
    copy.removeAttribute('id');
    for (const e of copy.querySelectorAll('[id]')) e.removeAttribute('id');
    for (const e of copy.querySelectorAll('[autofocus], [aria-live], [role="status"], [role="alert"]')) {
      e.removeAttribute('autofocus');e.removeAttribute('aria-live');e.removeAttribute('role');
    }
    copy.inert=true;
    return {copy,offsets};
  }
  function restoreOffsets(copy: HTMLElement, offsets: [number,number,number][]) {
    if (!offsets.length)return;
    const nodes=[copy,...copy.querySelectorAll('*')];
    for (const [i,x,y] of offsets) if(nodes[i]){nodes[i]!.scrollLeft=x;nodes[i]!.scrollTop=y;}
  }
  // Bookmarks lift several leaves. All other destinations turn a single leaf.
  function switchSection(from: string,to: string,mutate: () => void) {
    if (from === to) { cancel(); mutate?.(); return; }
    animateTurn(sections.indexOf(to) > sections.indexOf(from), true, mutate);
  }
  function turnPage(direction: 'forward'|'back', mutate: () => void) {
    animateTurn(direction === 'forward', false, mutate);
  }
  // Publish the new page synchronously. The curvature is applied to an inert print of the page.
  function animateTurn(forward: boolean,chapter: boolean,mutate: () => void) {
    cancel();
    const source = liveLeaf();
    const w=canvas.clientWidth,h=canvas.clientHeight;
    if (reduced() || !source || w<10 || h<10 || !canvas.getClientRects().length) {
      mutate?.();return;
    }
    const previous=snap(source);
    mutate?.();
    const next=liveLeaf();
    if(!next)return;
    const moving=forward?previous:snap(next);
    overlay=make('bm-transition');
    overlay.dataset.direction=forward?'forward':'back';
    overlay.dataset.turn=chapter?'bookmark':'leaf';
    overlay.inert=true;overlay.setAttribute('aria-hidden','true');
    const camera=make('bm-camera'), shadow=make('bm-fold-shadow');
    let still;
    if (!forward) {
      still=make('bm-fixed-leaf'); still.append(previous.copy);overlay.append(still);
    }
    overlay.append(shadow,camera);
    const papers: HTMLElement[]=[];
    if (chapter) {
      for (let i=0;i<2;i++) {
        const paper=make('bm-stack-edge');camera.append(paper);papers.push(paper);
      }
    }
    const parts: {strip: HTMLElement;image: HTMLElement;tone: HTMLElement;leaf: HTMLElement}[]=[], count=chapter?10:12;
    for(let i=0;i<count;i++){
      const strip=make('bm-strip'), image=make('bm-image'), tone=make('bm-tone');
      const leaf=i===count-1?moving.copy:moving.copy.cloneNode(true) as HTMLElement;
      image.style.width=w+'px';image.style.left=(-w*i/count)+'px';
      image.append(leaf);strip.append(image,tone);camera.append(strip);
      parts.push({strip,image,tone,leaf});
    }
    canvas.append(overlay);
    if(still)restoreOffsets(previous.copy,previous.offsets);
    for(const {leaf} of parts)restoreOffsets(leaf,moving.offsets);
    const perf=performance.now(), ms=chapter?450:510;
    function draw(t: number){
      const q=forward?t:1-t;
      // Bend a little more at the free edge; all the printed strips meet along
      // their projected edges. The fixed spine stays at x=0 throughout the move.
      const arc=.88*Math.sin(Math.PI*q), base=q*1.88-arc*.35;
      const point=(u: number): [number,number] =>{
        const phase=base+arc*u;
        if(Math.abs(arc)<.0001)return [w*u*Math.cos(base),w*u*Math.sin(base)];
        return [w*(Math.sin(phase)-Math.sin(base))/arc, w*(Math.cos(base)-Math.cos(phase))/arc];
      };
      // Project each curved strip onto one plane. Native preserve-3d sorting can put
      // a strip behind a neighboring sheet and expose a white seam during the bend.
      const lens=Math.max(w*3.8,950),mid=h*.5;
      const frontEdge=[];
      for(let i=0;i<count;i++){
        const {strip,image,tone}=parts[i]!,  a=point(i/count), b=point((i+1)/count);
        const unit=w/count, dx=(b[0]-a[0])/unit,dz=(b[1]-a[1])/unit;
        const da=1-a[1]/lens, db=1-b[1]/lens;
        const yA=mid*(da-1)-a[1]*.017, yB=mid*(db-1)-b[1]*.017;
        strip.style.width=(unit+.55)+'px';
        strip.style.transform='matrix3d('+[dx,(yB-yA)/unit,0,(db-da)/unit,0,1,0,0,0,0,1,0,a[0],yA,0,da].join(',')+')';
        strip.style.zIndex=String(i+2);
        frontEdge.push(b[0]/db);
        image.style.opacity=dx<0?'.06':'1';
        tone.style.opacity=String(Math.sin(Math.PI*q)*Math.min(.19,Math.max(.015,dz*.16)));
      }
      const x=Math.max(0,Math.min(w,Math.max(...frontEdge)));
      for(let i=0;i<papers.length;i++){
        const edge=Math.min(w,x+(papers.length-i)*3.5*Math.sin(Math.PI*q));
        papers[i]!.style.clipPath='inset(0 '+(w-edge)+'px 0 0)';
      }
      shadow.style.transform='translateX('+(x-10)+'px)';
      shadow.style.opacity=String(.42*Math.sin(Math.PI*q));
    }
    draw(0);
    function tick(now: number){
      const t=Math.min(1,(now-perf)/ms);
      draw(t*t*(3-2*t));
      if(t<1)frame=requestAnimationFrame(tick); else cancel();
    }
    frame=requestAnimationFrame(tick);
  }
  reduce.addEventListener('change',cancel);
  return {open,switchSection,turnPage,cancel,dispose(){cancel();preference.disconnect();reduce.removeEventListener('change',cancel);}};
}
