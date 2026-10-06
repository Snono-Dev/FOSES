export function toast(msg){
  const box=document.getElementById('toasts');
  const el=document.createElement('div'); el.className='toast'; el.textContent=msg;
  box.appendChild(el); setTimeout(()=>el.remove(),2800);
}
export function modal(html){
  const root=document.getElementById('modalRoot');
  root.innerHTML=`<div class="modal-bg"><div class="modal"><button class="modal-x" aria-label="إغلاق">✕</button>${html}</div></div>`;
  root.querySelector('.modal-bg').addEventListener('click',e=>{ if(e.target.classList.contains('modal-bg')) root.innerHTML=''; });
  root.querySelector('.modal-x').addEventListener('click',()=>{ root.innerHTML=''; });
  const esc2=e=>{ if(e.key==='Escape') closeModal(); };
  document.addEventListener('keydown',esc2,{once:true});
  return ()=>root.innerHTML='';
}
export function closeModal(){ document.getElementById('modalRoot').innerHTML=''; }
export function download(name, obj){
  const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}
