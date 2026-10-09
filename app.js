'use strict';
(() => {
  const ROOMS = {10:['201','301','302','303','304','305','306'],11:['201','301','302','303','304','305','306','406','407','408']};
  const SLOTS = {
    10:[['09:00','09:50'],['10:00','12:50'],['12:50','13:50','昼休み'],['13:50','14:40'],['14:50','15:40','総会（201号室）'],['15:50','16:40'],['16:50','17:40']],
    11:[['09:00','09:50'],['10:00','10:50'],['11:00','11:50'],['12:00','13:00','昼休み'],['13:00','13:50'],['14:00','14:50'],['15:00','15:50'],['16:00','16:50'],['17:00','17:50'],['18:00','18:50']]
  };
  const TYPE_LABEL={talk:'個人・共同研究',lecture:'テーマレクチャー',workshop:'ワークショップ',poster:'ポスター'};
  const TYPE_ORDER={lecture:0,workshop:1,talk:2,poster:3};
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const fmt=s=>String(s).normalize('NFKC').toLocaleLowerCase('ja').replace(/[\s\u3000・:：\-—−]/g,'');
  const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // Every link points to a self-contained PDF starting with this presentation.
  // The GitHub Actions deployment job generates these assets from the official PDF.
  const pageUrl=page=>`./abstracts/p${String(page).padStart(3,'0')}.pdf`;
  const LOCAL_STORAGE_KEY='wakate-forum-2026-favorites-v1';
  const loadFavs=()=>{try{return new Set(JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY)||'[]'));}catch{return new Set();}};
  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const isoDay=()=>today()==='2026-10-11'?11:10;
  const state={day:isoDay(),view:matchMedia('(min-width: 1000px)').matches?'grid':'agenda',query:'',room:'all',type:'all',onlyFav:false,compact:false,all:[],favorites:loadFavs()};
  const filtered=()=>state.all.filter(e=>e.day===state.day && (state.room==='all'||e.room===state.room) && (state.type==='all'||e.type===state.type) && (!state.onlyFav||state.favorites.has(e.id)) && (!state.query || fmt([e.title,e.presenter,e.room,e.type,TYPE_LABEL[e.type],...(e.talks||[]).flatMap(t=>[t.title,t.presenter])].join(' ')).includes(fmt(state.query))));
  const order=(a,b)=>+a.room- +b.room||TYPE_ORDER[a.type]-TYPE_ORDER[b.type]||a.title.localeCompare(b.title,'ja');
  function nowInfo(){const localDate=today();const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());const d=localDate==='2026-10-10'?10:localDate==='2026-10-11'?11:null;return {day:d,time:parts};}
  function currentSlot(slot){const n=nowInfo();return n.day===state.day && n.time>=slot[0] && n.time<slot[1];}
  function ongoing(e,slot){return e.start<slot[0]&&e.end>slot[0];}
  function card(e,slot=null){
    const saved=state.favorites.has(e.id);
    const continuing=slot&&ongoing(e,slot);
    const head=`<div class="event-top"><span class="event-room">${safe(e.room)}号室</span><span class="event-tag">${safe(TYPE_LABEL[e.type])}${e.part?' · 第'+e.part+'部':''}${continuing?' · <span class="card-ongoing">継続中</span>':''}</span></div>`;
    const detail=e.type==='lecture'?
      `<div class="lecture-talks">${e.talks.map(t=>`<a href="${pageUrl(t.page)}" target="_blank" rel="noopener noreferrer" aria-label="${safe(t.title)}の講演要旨を開く（公式PDFの${t.page}ページから）"><strong>${safe(t.title)}</strong><span>${safe(t.presenter)}　·　要旨（原本P.${t.page}）↗</span></a>`).join('')}</div><p class="special-note">※ 講演ごとの個別開始時刻は公式時間割に記載なし</p>`:
      `<h3 class="event-title">${e.unpublished?safe(e.title):`<a href="${pageUrl(e.page)}" target="_blank" rel="noopener noreferrer" aria-label="${safe(e.title)}の要旨を開く（PDF ${e.page}ページ）">${safe(e.title)}</a>`}</h3>`;
    const extra=e.unpublished?'<span class="special-note">発表者の意向により非公開</span>':e.type==='lecture'?'<span class="abstract-link">講演要旨：上記の2件 ↗</span>':`<a class="abstract-link" href="${pageUrl(e.page)}" target="_blank" rel="noopener noreferrer" aria-label="${safe(e.title)}の要旨PDF、原本${e.page}ページから">要旨を読む　原本P.${e.page} ↗</a>`;
    return `<article class="event-card ${e.type}" data-id="${safe(e.id)}">${head}${detail}<div class="event-speaker">${safe(e.presenter)}</div><div class="event-bottom">${extra}<button type="button" class="star-button" data-star="${safe(e.id)}" aria-pressed="${saved}" aria-label="${saved?'保存を解除':'この発表を保存'}：${safe(e.title)}" title="${saved?'保存を解除':'気になる発表を保存'}">${saved?'★':'☆'}</button></div></article>`;
  }
  function renderAgenda(entries){
    if(!entries.length)return `<div class="empty"><strong>該当する発表がありません。</strong>検索語や絞り込み条件を変更してください。</div>`;
    let out='';
    for(const slot of SLOTS[state.day]){
      const list=entries.filter(e=>e.start===slot[0]).sort(order);
      if(!list.length){if(slot[2]&&!state.query&&state.room==='all'&&state.type==='all'&&!state.onlyFav){out+=`<section class="time-section" data-time="${slot[0]}"><div class="time-rail"><span class="time-large">${slot[0]}</span><span class="time-small">${slot[1]}まで</span></div><div class="meta-row"><strong>${safe(slot[2])}</strong></div></section>`;}continue;}
      const live=currentSlot(slot);
      out+=`<section class="time-section ${live?'now-line':''}" data-time="${slot[0]}"><div class="time-rail"><span class="time-large">${slot[0]}</span><span class="time-small">${slot[1]}まで</span>${live?'<span class="now-label">現在の時間帯</span>':''}</div><div class="time-cards">${list.map(e=>card(e)).join('')}</div></section>`;
      if(state.day===11 && [1,2,3].some(p=>slot[0]===({1:'09:00',2:'11:00',3:'13:00'}[p])) && (state.type==='poster'||state.type==='all') && !state.query && state.room==='all' && !state.onlyFav){const notes={'09:00':'10:00–10:50 閲覧専用（第1部）','11:00':'12:00–13:00 閲覧専用（第2部・昼休み）','13:00':'14:00–14:50 閲覧専用（第3部）'};out+=`<div class="poster-hint">${notes[slot[0]]}。コアタイム終了後は発表者不在での閲覧時間です。</div>`;}
    }
    return out||'<div class="empty"><strong>該当する発表がありません。</strong></div>';
  }
  function renderGrid(entries){
    if(!entries.length)return `<div class="empty"><strong>該当する発表がありません。</strong>検索語や絞り込み条件を変更してください。</div>`;
    // Only render columns with at least one event after *all* filters are applied.
    // The room selector stays complete, so hidden rooms can still be chosen explicitly.
    const rooms=(state.room==='all'?ROOMS[state.day]:[state.room])
      .filter(r=>entries.some(e=>e.room===r));
    const hidden=ROOMS[state.day].length-rooms.length;
    const timeWidth=state.compact?92:104;
    const roomWidth=state.compact?184:232;
    const width=timeWidth+rooms.length*roomWidth;
    const roomOptions=rooms.map(r=>`<option value="${r}">${r}号室</option>`).join('');
    let out=`<section class="grid-shell ${state.compact?'is-compact':''}" aria-label="教室別時間割">
      <div class="matrix-navigation" aria-label="横方向の移動操作">
        <div class="matrix-nav-row">
          <div class="matrix-nav-summary"><strong id="matrix-visible-room" aria-live="off">${rooms[0]}号室から表示</strong>
            <span>${rooms.length}教室を表示${hidden?'（空の'+hidden+'教室を非表示）':''}</span></div>
          <div class="matrix-nav-actions">
            <label class="matrix-compact"><input id="grid-compact" type="checkbox" ${state.compact?'checked':''}> 列を詰める</label>
            <label class="matrix-jump">教室へ <select id="grid-jump-room" aria-label="ジャンプ先の教室">${roomOptions}</select></label>
            <button type="button" class="matrix-arrow" data-grid-step="-1" aria-label="左の教室へスクロール" title="左へ移動">←</button>
            <button type="button" class="matrix-arrow" data-grid-step="1" aria-label="右の教室へスクロール" title="右へ移動">→</button>
          </div>
        </div>
        <div class="matrix-progress"><span>左端</span><input type="range" id="grid-scroll-range" min="0" max="100" value="0" step="1" aria-label="時間割の横スクロール位置"><span>右端</span></div>
      </div>
      <div class="matrix-scroll" role="region" aria-label="教室別時間割（横スクロール可能）" tabindex="0">
      <table class="matrix" style="min-width:${width}px;--time-col:${timeWidth}px"><colgroup><col style="width:${timeWidth}px">${rooms.map(()=>`<col style="width:${roomWidth}px">`).join('')}</colgroup>
      <thead><tr><th scope="col">時間</th>${rooms.map(r=>`<th scope="col" data-room="${r}">${r}号室</th>`).join('')}</tr></thead><tbody>`;
    for(const slot of SLOTS[state.day]){
      const active=entries.filter(e=>e.start<=slot[0]&&e.end>slot[0]);
      if(!active.length&&(!slot[2]||state.query||state.type!=='all'||state.onlyFav||state.room!=='all'))continue;
      const live=currentSlot(slot);
      out+=`<tr class="${live?'live':''}" data-time="${slot[0]}"><td><span class="time-large">${slot[0]}</span><span class="time-small">${slot[1]}まで</span>${live?'<span class="now-label">進行中</span>':''}</td>`;
      if(slot[2]){
        out+=`<td colspan="${rooms.length}" class="matrix-empty"><div class="meta-row"><strong>${safe(slot[2])}</strong></div></td>`;
      }else{
        for(const r of rooms){const items=active.filter(e=>e.room===r).sort(order);out+=`<td class="${items.length?'':'matrix-empty'}">${items.map(e=>card(e,slot)).join('')}</td>`;}
      }
      out+='</tr>';
    }
    return out+'</tbody></table></div></section>';
  }

  function bindGridControls(previousScroll=0){
    const shell=$('.grid-shell');
    if(!shell)return;
    const scroller=shell.querySelector('.matrix-scroll');
    const slider=shell.querySelector('#grid-scroll-range');
    const select=shell.querySelector('#grid-jump-room');
    const summary=shell.querySelector('#matrix-visible-room');
    const roomHeads=[...scroller.querySelectorAll('thead th[data-room]')];
    const arrows=[...shell.querySelectorAll('[data-grid-step]')];
    const maxScroll=()=>Math.max(0,scroller.scrollWidth-scroller.clientWidth);
    const update=()=>{
      const max=maxScroll(),left=scroller.scrollLeft;
      slider.disabled=max<2;
      slider.value=max>0?String(Math.round(100*left/max)):'0';
      arrows[0].disabled=max<2||left<2;
      arrows[1].disabled=max<2||left>=max-2;
      // The first non-sticky room column at the left of the viewport.
      const threshold=left+scroller.querySelector('thead th').offsetWidth+12;
      let active=roomHeads[0];
      for(const th of roomHeads){if(th.offsetLeft<=threshold)active=th;else break;}
      if(active){summary.textContent=`${active.dataset.room}号室から表示`;}
    };
    scroller.addEventListener('scroll',update,{passive:true});
    // An explicit range input also provides a draggable horizontal scrollbar
    // for mice without a horizontal wheel or a trackpad.
    slider.addEventListener('input',()=>{scroller.scrollLeft=Number(slider.value)*maxScroll()/100;});
    arrows.forEach(b=>b.addEventListener('click',()=>{
      const distance=Math.max(184,Math.round((scroller.clientWidth-104)*0.76));
      scroller.scrollBy({left:Number(b.dataset.gridStep)*distance,behavior:'smooth'});
    }));
    select.addEventListener('change',()=>{
      const th=roomHeads.find(x=>x.dataset.room===select.value);
      if(th)scroller.scrollTo({left:th.offsetLeft-scroller.querySelector('thead th').offsetWidth,behavior:'smooth'});
    });
    shell.querySelector('#grid-compact').addEventListener('change',e=>{state.compact=e.target.checked;render({preserveHorizontal:true});});
    // For keyboard users, arrows scroll the focused timetable without
    // interfering with activation of links, favorite controls or text input.
    scroller.addEventListener('keydown',e=>{
      if(e.target!==scroller||!['ArrowLeft','ArrowRight'].includes(e.key))return;
      e.preventDefault();scroller.scrollBy({left:e.key==='ArrowRight'?200:-200,behavior:'smooth'});
    });
    scroller.scrollLeft=Math.min(previousScroll,maxScroll());
    update();
  }
  function render({preserveHorizontal=false}={}){
    const previousScroll=preserveHorizontal?($('.matrix-scroll')?.scrollLeft||0):0;
    $$('.day-tab').forEach(b=>{const is=+b.dataset.day===state.day;b.classList.toggle('active',is);b.setAttribute('aria-pressed',String(is));});
    $$('.view-switch button').forEach(b=>{const is=b.dataset.view===state.view;b.classList.toggle('active',is);b.setAttribute('aria-pressed',String(is));});
    const roomSelect=$('#room-select');const wanted=state.room;
    roomSelect.innerHTML='<option value="all">すべて</option>'+ROOMS[state.day].map(r=>`<option value="${r}">${r}号室</option>`).join('');
    if(wanted!=='all'&&!ROOMS[state.day].includes(wanted))state.room='all';
    roomSelect.value=state.room;
    $('#type-select').value=state.type;
    $('#favorites-only').checked=state.onlyFav;
    const entries=filtered();
    const totals=state.all.filter(e=>e.day===state.day).length;
    $('#result-summary').textContent=`${state.day===10?'10月10日（土）':'10月11日（日）'}　${entries.length}枠を表示 / ${totals}枠 · ☆で気になる発表を保存`;
    $('#clear-filters').hidden=!(state.query||state.room!=='all'||state.type!=='all'||state.onlyFav);
    $('#view-notice').hidden=state.view!=='grid'||!entries.length;
    const elem=$('#schedule-content');elem.className='schedule-content';elem.innerHTML=state.view==='agenda'?renderAgenda(entries):renderGrid(entries);
    if(state.view==='grid'&&entries.length)bindGridControls(previousScroll);
  }
  function initialize(){
    $$('.day-tab').forEach(b=>b.addEventListener('click',()=>{state.day=+b.dataset.day;state.room='all';render();}));
    $$('.view-switch button').forEach(b=>b.addEventListener('click',()=>{state.view=b.dataset.view;render();}));
    $('#search-input').addEventListener('input',e=>{state.query=e.target.value;render();});
    $('#room-select').addEventListener('change',e=>{state.room=e.target.value;render();});
    $('#type-select').addEventListener('change',e=>{state.type=e.target.value;render();});
    $('#favorites-only').addEventListener('change',e=>{state.onlyFav=e.target.checked;render();});
    $('#clear-filters').addEventListener('click',()=>{state.query='';state.room='all';state.type='all';state.onlyFav=false;$('#search-input').value='';render();});
    $('#schedule-content').addEventListener('click',e=>{const btn=e.target.closest('[data-star]');if(!btn)return;const id=btn.dataset.star;if(state.favorites.has(id))state.favorites.delete(id);else state.favorites.add(id);try{localStorage.setItem(LOCAL_STORAGE_KEY,JSON.stringify([...state.favorites]));}catch{}render({preserveHorizontal:true});});
    $('#now-button').addEventListener('click',()=>{const n=nowInfo();if(n.day){state.day=n.day;state.query='';state.room='all';state.type='all';state.onlyFav=false;$('#search-input').value='';render();const slots=SLOTS[state.day];const live=slots.find(s=>s[0]<=n.time && n.time<s[1]);const upcoming=slots.find(s=>s[0]>n.time);const target=live||upcoming||slots[slots.length-1];const row=[...$$('[data-time]')].find(e=>e.dataset.time===target[0]);(row||$('#schedule')).scrollIntoView({behavior:'smooth',block:'start'});}else{alert('「現在時刻」は2026年10月10日・11日の日本時間に対応しています。');}});
    document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!e.ctrlKey&&!e.metaKey){e.preventDefault();$('#search-input').focus();}});
    setInterval(()=>{if(!state.query)render({preserveHorizontal:true});},60000);
  }
  async function load(){
    initialize();
    try{const res=await fetch('./data.json',{cache:'no-store'});if(!res.ok)throw new Error(`HTTP ${res.status}`);const json=await res.json();if(!Array.isArray(json))throw new Error('データ形式が不正です');state.all=json;render();}
    catch(e){$('#result-summary').textContent='時間割データを読み込めませんでした。';$('#schedule-content').innerHTML=`<div class="empty"><strong>読み込みに失敗しました。</strong>GitHub PagesまたはローカルHTTPサーバーで開いてください。<a href="https://www.wakate-forum.org/data/2026/2026_timetable.pdf" target="_blank" rel="noopener noreferrer">公式タイムテーブルPDF ↗</a></div>`;console.error(e);}
  }
  load();
})();
