'use strict';

function trimSlash(value){return String(value||'').replace(/\/+$/,'');}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

class ComfyClient {
  constructor({baseUrl,timeoutMs=120000,pollMs=700}={}){
    this.baseUrl=trimSlash(baseUrl);
    this.timeoutMs=timeoutMs;
    this.pollMs=pollMs;
    if(!this.baseUrl)throw new Error('comfy_base_url_required');
  }

  async request(path,options={}){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),this.timeoutMs);
    try{
      const res=await fetch(this.baseUrl+path,{...options,signal:controller.signal});
      if(!res.ok){
        const text=await res.text().catch(()=> '');
        throw new Error('comfy_http_'+res.status+(text?':'+text.slice(0,300):''));
      }
      return res;
    }finally{clearTimeout(timer)}
  }

  async uploadImage({buffer,filename='oracle-input.png',mimeType='image/png'}){
    const form=new FormData();
    form.append('image',new Blob([buffer],{type:mimeType}),filename);
    form.append('type','input');
    form.append('overwrite','true');
    const res=await this.request('/upload/image',{method:'POST',body:form});
    const json=await res.json();
    return json.name||filename;
  }

  async queuePrompt(prompt){
    const clientId=crypto.randomUUID();
    const promptId=crypto.randomUUID();
    const res=await this.request('/prompt',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({prompt,client_id:clientId,prompt_id:promptId})
    });
    const json=await res.json();
    return json.prompt_id||promptId;
  }

  async waitForHistory(promptId){
    const started=Date.now();
    while(Date.now()-started<this.timeoutMs){
      const res=await this.request('/history/'+encodeURIComponent(promptId),{method:'GET'});
      const json=await res.json();
      const item=json?.[promptId];
      if(item?.outputs)return item;
      await sleep(this.pollMs);
    }
    throw new Error('comfy_timeout');
  }

  async fetchFirstImage(history){
    for(const output of Object.values(history?.outputs||{})){
      const image=output?.images?.[0];
      if(!image)continue;
      const q=new URLSearchParams({
        filename:image.filename||'',
        subfolder:image.subfolder||'',
        type:image.type||'output'
      });
      const res=await this.request('/view?'+q.toString(),{method:'GET'});
      const buf=Buffer.from(await res.arrayBuffer());
      const type=res.headers.get('content-type')||'image/png';
      return {buffer:buf,mimeType:type,filename:image.filename||'oracle-output.png'};
    }
    throw new Error('comfy_no_output_image');
  }

  async run({workflow,inputBuffer,inputFilename='oracle-input.png',inputMimeType='image/png'}){
    const stagedName=await this.uploadImage({buffer:inputBuffer,filename:inputFilename,mimeType:inputMimeType});
    const prompt=JSON.parse(JSON.stringify(workflow));
    for(const node of Object.values(prompt)){
      if(node?.class_type==='LoadImage'&&node?.inputs?.image==='__ORACLE_INPUT__'){
        node.inputs.image=stagedName;
      }
    }
    const promptId=await this.queuePrompt(prompt);
    const history=await this.waitForHistory(promptId);
    const output=await this.fetchFirstImage(history);
    return {...output,promptId};
  }
}

module.exports={ComfyClient};
