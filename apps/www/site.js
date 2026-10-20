const form=document.getElementById('interest-form');
if(form)form.addEventListener('submit',async event=>{
  event.preventDefault();const status=document.getElementById('form-status'),button=form.querySelector('button'),data=new FormData(form),ar=document.documentElement.lang==='ar';
  button.disabled=true;status.textContent=ar?'جارٍ حفظ طلبك…':'Saving your interest…';
  try{
    const response=await fetch('/api/interest',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:data.get('name'),email:data.get('email'),goal:data.get('goal'),locale:ar?'ar':'en',consent:data.get('consent')==='on'}),signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error(String(response.status));
    const result=await response.json();if(result.accepted!==true)throw new Error('INVALID_RESPONSE');
    form.reset();status.textContent=ar?'وصلنا اهتمامك، شكرًا لك. سيتابع الفريق طلبك عند تجهيز التجربة.':'Your interest was saved. Our team will follow up when the experience is available.';
  }catch(error){status.textContent=error.message==='429'?(ar?'محاولات كثيرة. انتظر قليلًا ثم جرّب مجددًا.':'Too many attempts. Please try again later.'):(ar?'تعذّر حفظ الطلب الآن. بياناتك ما زالت في النموذج، أعد المحاولة.':'We could not save your request. Your details are still here; please retry.');}
  finally{button.disabled=false;}
});
