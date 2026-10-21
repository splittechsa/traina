import { createSessionTransport } from './session-request.mjs';
const sessionFetch = createSessionTransport();
const $=id=>document.getElementById(id);
const escape=value=>String(value??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=value=>value?new Intl.DateTimeFormat('ar-SA',{dateStyle:'medium',timeZone:'Asia/Riyadh',calendar:'gregory'}).format(new Date(value)):'—';
const number=value=>new Intl.NumberFormat('ar-SA').format(Number(value??0));
const names={active:'نشط',pending:'بانتظار التحقق',suspended:'موقوف',new:'جديد',contacted:'تم التواصل',closed:'مغلق',open:'مفتوح',resolved:'تم الحل',strength:'القوة',fitness:'اللياقة',nutrition:'التغذية',normal:'عادية',high:'عالية',low:'منخفضة',member:'عضو',admin:'إدارة',coach_reviewer:'مدرب',MEMBER_SUBMITTED:'أرسلها العضو',WEEKLY_REVIEW_DUE:'مراجعة مستحقة',QUEUED_FOR_HUMAN:'بانتظار المدرب',IN_REVIEW:'قيد المراجعة',FEEDBACK_SENT:'تم إرسال الملاحظات',OVERDUE:'متأخرة',ESCALATED:'مصعّدة'};
let current='overview',offset=0,search='',loading=false,generation=0;
const titles={overview:['نظرة على نشاط المنصة','كل يوم، خطوة للأمام.'],members:['إدارة المجتمع','الأعضاء'],coaching:['المتابعة البشرية','المدربون والمراجعات'],interests:['من اللاندينق إلى الفريق','طلبات الاهتمام'],support:['متابعة طلبات الأعضاء','مساحة الدعم'],audit:['شفافية التشغيل','سجل النشاط']};
async function api(path,{method='GET',body}={}) {
  const response=await sessionFetch('/api/'+path,{method,credentials:'same-origin',headers:{'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
  let data;try{data=await response.json();}catch{throw new Error('تعذّر قراءة رد الخادم. أعد المحاولة.');}
  if(response.status===409 && data?.error?.code==='SESSION_REFRESH_RETRY'){showLogin();throw new Error('تعذر تجديد الجلسة. سجّل الدخول مجددًا.');}
  if(response.status===401||response.status===403){showLogin();throw new Error(response.status===403?'هذا الحساب لا يملك صلاحية الإدارة.':'انتهت الجلسة. سجّل الدخول مجددًا.');}
  if(!response.ok)throw new Error(response.status===409?'تغيّرت البيانات. حدّث الصفحة قبل المحاولة.':response.status===429?'محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.':'تعذّر تنفيذ الطلب. تحقق من الاتصال وأعد المحاولة.');
  return data;
}
function showLogin(){generation++;$('login').hidden=false;$('workspace').hidden=true;$('view').replaceChildren();}
function showWorkspace(){$('login').hidden=true;$('workspace').hidden=false;}
function fail(error){$('error').textContent=error.message;$('error').hidden=false;}
function badge(value){return `<span class="badge">${escape(names[value]??value)}</span>`;}
function identifier(value){return `<span class="id" title="${escape(value)}">${escape(value)}</span>`;}
function table(headings,rows){return rows.length?`<div class="table-wrap"><table><thead><tr>${headings.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:'<div class="empty">لا توجد سجلات في هذه الصفحة.</div>';}
function panel(title,content){return `<section class="panel"><div class="panel-head"><h2>${title}</h2></div>${content}</section>`;}
function pages(hasMore){return `<div class="pagination"><button class="quiet" id="prev" ${offset===0?'disabled':''}>السابق</button><button class="quiet" id="next" ${hasMore?'':'disabled'}>التالي</button></div>`;}
function paging(data){$('prev')?.addEventListener('click',()=>{offset=Math.max(0,offset-50);void load();});$('next')?.addEventListener('click',()=>{if(data.hasMore){offset+=50;void load();}});}
function statusSelect(kind,row,values){return `<label><span class="small muted">تحديث الحالة</span><select aria-label="تحديث حالة السجل" data-kind="${kind}" data-id="${escape(row.id)}" data-old="${escape(row.status)}">${values.map(v=>`<option value="${v}" ${v===row.status?'selected':''}>${names[v]??v}</option>`).join('')}</select></label>`;}
function statuses(){for(const select of $('view').querySelectorAll('[data-kind]'))select.addEventListener('change',async()=>{const old=select.dataset.old,next=select.value;if(!confirm('تأكيد تغيير الحالة إلى «'+(names[next]??next)+'»؟')){select.value=old;return;}select.disabled=true;try{await api(select.dataset.kind+'/'+select.dataset.id,{method:'PATCH',body:{status:next,expectedStatus:old}});await load();}catch(e){select.value=old;fail(e);}finally{select.disabled=false;}});}
async function load(){
  if(loading)return;loading=true;const version=++generation;const view=current;$('loading').hidden=false;$('error').hidden=true;$('refresh').disabled=true;
  $('page-kicker').textContent=titles[view][0];$('page-title').textContent=titles[view][1];$('view').replaceChildren();
  for(const button of document.querySelectorAll('[data-view]')){if(button.dataset.view===view)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}
  try{
    const data=await api(view+'?offset='+offset+'&q='+encodeURIComponent(search));if(version!==generation)return;showWorkspace();
    $('updated').textContent='آخر تحديث '+new Intl.DateTimeFormat('ar-SA',{timeStyle:'short',timeZone:'Asia/Riyadh'}).format(new Date());
    if(view==='overview'){
      const m=data.metrics;
      const metrics=[['حسابات المنصة',m.members,'حسابات المنصة'],['تمارين مكتملة',m.completed_workouts_30d,'آخر ٣٠ يومًا'],['برامج نشطة',m.active_programs,'مرتبطة بالأعضاء'],['طلبات اهتمام جديدة',m.new_interests,'من الموقع']];
      $('view').innerHTML=`<div class="metrics">${metrics.map(([label,value,hint])=>`<article class="metric"><label>${label}</label><div class="number">${number(value)}</div><small>${hint}</small></article>`).join('')}</div><div class="two-col">${panel('إيقاع التدريب','<p class="small muted">الجلسات المكتملة خلال آخر ١٤ يومًا · توقيت الرياض</p><div class="trend" id="trend"></div>')}${panel('يحتاج متابعتك',`<div class="task"><span>مراجعات بشرية معلّقة</span><strong>${number(m.pending_reviews)}</strong></div><div class="task"><span>تذاكر دعم مفتوحة</span><strong>${number(m.open_tickets)}</strong></div><div class="task"><span>حسابات نشطة</span><strong>${number(m.active_members)}</strong></div>`)}</div>${panel('حالة البيئة','<p>أنت تعمل على بيئة الاختبار. التسجيلات والطلبات هنا لا تعني جاهزية الإطلاق التجاري.</p><span class="badge">المدفوعات غير مفعّلة</span>')}`;
      const trend=Array.from({length:14},(_,i)=>{const day=new Date(Date.parse(data.asOf)+3*3600000-(13-i)*86400000).toISOString().slice(0,10);return {day,count:data.workoutTrend.find(point=>point.day===day)?.count??0};}),max=Math.max(1,...trend.map(p=>p.count));if(!trend.length)$('trend').textContent='لم تُسجّل جلسات مكتملة خلال الفترة.';
      for(const point of trend){const col=document.createElement('div');col.className='bar-column';col.title=point.day+': '+point.count;const label=document.createElement('span');label.textContent=number(point.count);const bar=document.createElement('span');bar.className='bar';bar.style.height=(point.count/max*140)+'px';const day=document.createElement('small');day.textContent=point.day.slice(5);col.append(label,bar,day);$('trend').append(col);}
    }else if(view==='members'){
      $('view').innerHTML=panel('دليل الأعضاء',`<form id="search" class="search"><input aria-label="ابحث بالاسم أو البريد" placeholder="ابحث بالاسم أو البريد" value="${escape(search)}" maxlength="80"><button class="quiet">بحث</button></form>`+table(['العضو','الحالة','الصلاحيات','تمارين مكتملة','تاريخ الانضمام'],data.members.map(m=>[`${escape(m.display_name??'عضو')}<small dir="ltr">${escape(m.email)}</small>${identifier(m.id)}`,badge(m.status),m.roles.map(r=>escape(names[r]??r)).join(' · '),number(m.completed_workouts),date(m.created_at)]))+pages(data.hasMore));
      $('search').addEventListener('submit',event=>{event.preventDefault();search=event.currentTarget.querySelector('input').value;offset=0;void load();});paging(data);
    }else if(view==='coaching'){
      $('view').innerHTML=panel('ربط مدرب بعضو',`<p class="small muted">الربط لا يمنح الوصول لبيانات العضو دون موافقته. استخدم معرّف العضو من دليل الأعضاء.</p><form id="assignment" class="action-form"><label>المدرب<select name="coach" required>${data.coaches.map(c=>`<option value="${escape(c.id)}">${escape(c.display_name??c.email)}</option>`).join('')}</select></label><label>معرّف العضو<input name="member" dir="ltr" pattern="[0-9a-fA-F-]{36}" required></label><label>سبب الربط<input name="reason" required minlength="5" maxlength="500"></label><button class="primary">حفظ الربط</button></form>`)+panel('الارتباطات النشطة',table(['المدرب','العضو','منذ','الإجراء'],data.assignments.map(a=>[identifier(a.coach_user_id),identifier(a.member_user_id),date(a.assigned_at),`<button class="quiet" data-revoke="${escape(a.coach_user_id)}" data-member="${escape(a.member_user_id)}">إلغاء الربط</button>`])))+panel('قائمة المراجعات',table(['الأسبوع','العضو','المدرب','الحالة'],data.reviews.map(r=>[date(r.week_of),identifier(r.member_user_id),identifier(r.coach_user_id),badge(r.status)])));
      $('assignment').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('button'),v=new FormData(form);button.disabled=true;try{await api('assignments',{method:'POST',body:{coachUserId:v.get('coach'),memberUserId:v.get('member'),reason:v.get('reason')}});await load();}catch(e){fail(e);}finally{button.disabled=false;}});
      for(const button of document.querySelectorAll('[data-revoke]'))button.addEventListener('click',async()=>{const reason=prompt('سبب إلغاء الربط (٥ أحرف على الأقل):');if(!reason||reason.trim().length<5)return;button.disabled=true;try{await api('revoke',{method:'DELETE',body:{coachUserId:button.dataset.revoke,memberUserId:button.dataset.member,reason}});await load();}catch(e){fail(e);}finally{button.disabled=false;}});
    }else if(view==='interests'){
      $('view').innerHTML=panel('طلبات الموقع',table(['الاسم والبريد','الاهتمام','الحالة','تاريخ التسجيل','متابعة'],data.interests.map(r=>[`${escape(r.name)}<small dir="ltr">${escape(r.email)}</small>`,escape(names[r.goal]??r.goal),badge(r.status),date(r.created_at),statusSelect('interests',r,['new','contacted','closed'])]))+pages(data.hasMore));paging(data);statuses();
    }else if(view==='support'){
      $('view').innerHTML=panel('تذاكر الأعضاء',table(['الموضوع','العضو','الأولوية','الحالة','متابعة'],data.tickets.map(r=>[escape(r.subject),identifier(r.user_id),badge(r.priority),badge(r.status),statusSelect('support',r,['open','pending','resolved','closed'])]))+pages(data.hasMore));paging(data);statuses();
    }else{
      $('view').innerHTML=panel('سجل التغييرات',table(['الإجراء','المورد','المنفّذ','التاريخ'],data.events.map(e=>[escape(e.action),`${escape(e.resource_type)}<small>${identifier(e.resource_id)}</small>`,identifier(e.actor_user_id),date(e.created_at)]))+pages(data.hasMore));paging(data);
    }
  }catch(e){fail(e);}finally{loading=false;$('loading').hidden=true;$('refresh').disabled=false;}
}
$('login-form').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('button'),values=new FormData(form);button.disabled=true;$('login-error').textContent='';try{await api('login',{method:'POST',body:{email:values.get('email'),password:values.get('password')}});form.reset();showWorkspace();await load();}catch(e){$('login-error').textContent=e.message;}finally{button.disabled=false;}});
for(const button of document.querySelectorAll('[data-view]'))button.addEventListener('click',()=>{if(loading)return;current=button.dataset.view;offset=0;search='';void load();});
$('refresh').addEventListener('click',()=>void load());
$('logout').addEventListener('click',async()=>{try{await api('logout',{method:'POST',body:{}});}catch{}finally{showLogin();}});
void load();
