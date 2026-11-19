(() => {
  const status=document.getElementById("cloudStatus");
  if(!window.supabase){
    status.textContent="Cloud backup is unavailable. Games still save on this device.";
    return;
  }
  const client=window.supabase.createClient("https://svaozzitkajgqzacldur.supabase.co","sb_publishable_scbeO9M_PR8Zvkh-1nbheA_lZLwl31b",{
    auth:{storageKey:"squirrel-auth",detectSessionInUrl:false}
  });
  const form=document.getElementById("cloudAuthForm");
  const email=document.getElementById("cloudEmail");
  const password=document.getElementById("cloudPassword");
  const syncButton=document.getElementById("cloudSyncButton");
  const signOut=document.getElementById("cloudSignOut");
  const table="squirrel_backups";
  let user=null, running=false, pending=false, signingOut=false, timer, uploaded=null;

  function schedule(delay=250){
    if(!user || signingOut)return;
    pending=true;
    clearTimeout(timer);
    timer=setTimeout(sync,delay);
  }
  async function sync(){
    if(running || !user || signingOut || state.cloudOwner!==user.id)return;
    running=true;
    pending=false;
    const owner=user.id;
    const device=state.cloudDevice;
    const payload=JSON.stringify(cloudLedger());
    status.textContent="Syncing with Supabase…";
    try{
      if(uploaded!==payload){
        const {error}=await client.from(table).upsert({
          user_id:owner,device_id:device,ledger:JSON.parse(payload),updated_at:new Date().toISOString()
        },{onConflict:"user_id,device_id"});
        if(error)throw error;
        if(user?.id!==owner)return;
        uploaded=payload;
      }
      const {data,error}=await client.from(table).select("device_id,ledger,updated_at")
        .eq("user_id",owner).neq("device_id",device).order("updated_at",{ascending:false});
      if(error)throw error;
      if(user?.id!==owner)return;
      cloudBackups=data;
      refreshGameList();
      if(document.getElementById("statsModal").style.display==="flex")openStats();
      const current=JSON.stringify(cloudLedger())===payload;
      status.textContent=current?"Backed up · "+user.email:"New changes saved on this device. Sync pending.";
    }catch(error){
      if(user?.id===owner){
        console.error("Squirrel backup",error);
        status.textContent="Cloud sync couldn't finish. This device still has your games. Use Sync Now to retry.";
      }
    }finally{
      running=false;
      if(pending)schedule(0);
    }
  }
  function setSession(session){
    const next=session?.user??null;
    if(next?.id!==user?.id){
      cloudBackups=[];
      uploaded=null;
      refreshGameList();
      if(document.getElementById("statsModal").style.display==="flex")openStats();
    }
    user=next;
    form.hidden=!!user;
    signOut.hidden=!user;
    syncButton.hidden=!user;
    if(!user){
      status.textContent="Sign in to back up scores and open games on another device.";
      return;
    }
    if(state.cloudOwner && state.cloudOwner!==user.id){
      syncButton.hidden=true;
      status.textContent="This device's games are linked to a different account. Sign in with that account to sync.";
      return;
    }
    if(!state.cloudOwner || !state.cloudDevice){
      state.cloudOwner=user.id;
      state.cloudDevice=newGameId();
      save();
    }
    schedule(0);
  }

  client.auth.onAuthStateChange((event,session)=>{
    if(event==="INITIAL_SESSION" || event==="SIGNED_IN" || event==="SIGNED_OUT"){
      setTimeout(()=>setSession(session),0);
    }
  });
  form.addEventListener("submit",async event=>{
    event.preventDefault();
    const buttons=[...form.querySelectorAll("button")];
    buttons.forEach(button=>button.disabled=true);
    status.textContent="Contacting Supabase…";
    try{
      const credentials={email:email.value.trim(),password:password.value};
      const signup=event.submitter?.value==="signup";
      const {data,error}=signup ? await client.auth.signUp(credentials) : await client.auth.signInWithPassword(credentials);
      if(error)throw error;
      if(signup && !data.session)status.textContent="Check your email to confirm your account, then return here to sign in.";
      password.value="";
    }catch(error){
      status.textContent=error.message||"Sign-in is unavailable. Try again.";
    }finally{
      buttons.forEach(button=>button.disabled=false);
    }
  });
  syncButton.onclick=()=>schedule(0);
  signOut.onclick=async()=>{
    if(state.cloudOwner===user?.id && uploaded!==JSON.stringify(cloudLedger()) &&
       !window.confirm("Some changes are only saved on this device. Sign out anyway?"))return;
    signingOut=true;
    try{
      const {error}=await client.auth.signOut({scope:"local"});
      if(error)throw error;
    }catch(error){
      status.textContent=error.message||"Could not sign out.";
    }finally{
      signingOut=false;
    }
  };
  window.addEventListener("squirrel-change",()=>{
    if(user && state.cloudOwner===user.id){
      status.textContent="Saved on this device · syncing…";
      schedule();
    }
  });
  window.addEventListener("squirrel-check-cloud",()=>schedule(0));
  window.addEventListener("online",()=>schedule(0));
  window.addEventListener("focus",()=>schedule());
})();
