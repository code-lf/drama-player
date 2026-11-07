/** 从真实PCM提取静态峰值，不使用随机条形或把装饰动画冒充音频波形。 */
export function waveformPeaks(channels:Float32Array[],bars=72){
  const length=channels[0]?.length||0
  if(!length||!Number.isInteger(bars)||bars<1)return []
  const count=Math.min(bars,length),peaks:number[]=[]
  for(let bar=0;bar<count;bar++){
    const start=Math.floor(bar*length/count),end=Math.floor((bar+1)*length/count)
    let peak=0
    for(const channel of channels)for(let index=start;index<Math.min(end,channel.length);index++)peak=Math.max(peak,Math.abs(channel[index]||0))
    peaks.push(peak)
  }
  const max=Math.max(...peaks)
  return peaks.map(peak=>max?peak/max:0)
}

/** 只读取当前已授权播放的文件；限制下载与解码资源，失败时不绘制波形。 */
export async function readAudioWaveform(url:string,signal:AbortSignal){
  const limit=24*1024*1024
  const response=await fetch(url,{signal,credentials:'omit',redirect:'error'})
  if(!response.ok||Number(response.headers.get('content-length'))>limit||!response.body)throw new Error('音频波形暂不可读')
  const reader=response.body.getReader(),chunks:Uint8Array[]=[]
  let size=0
  try{
    while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit)throw new Error('音频过大');chunks.push(value)}
  }finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
  if(signal.aborted)throw new Error('波形读取已取消')
  const bytes=new Uint8Array(size)
  let offset=0
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
  return decodeAudioWaveform(bytes.buffer,signal)
}

/** 浏览器直接读取和本人曲目的鉴权回退共用同一离线解码。 */
export async function decodeAudioWaveform(bytes:ArrayBuffer,signal:AbortSignal){
  if(signal.aborted||bytes.byteLength>24*1024*1024)throw new Error('音频波形暂不可读')
  // 离线低采样率解码不输出声音；不连接AudioContext或上传用户音频。
  const context=new OfflineAudioContext(1,1,12000),buffer=await context.decodeAudioData(bytes)
  if(signal.aborted||buffer.duration>900)throw new Error('波形读取已结束')
  return waveformPeaks(Array.from({length:buffer.numberOfChannels},(_,index)=>buffer.getChannelData(index)))
}
