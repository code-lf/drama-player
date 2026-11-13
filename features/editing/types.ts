/** 平台业务引用；临时媒体地址不属于草稿或编辑命令。 */
export type EditingSource = {type:'library';item_id:string;version_id:string}|{type:'task';task_id:string;result_id:string}
export interface VisualTransform {x:number;y:number;scale:number;rotation:number}
export type EditingVisual = ({id:string;kind:'image';source:EditingSource;duration_ms:number}|{
  id:string;kind:'video';source:EditingSource;trim_start_ms:number;trim_end_ms:number;original_volume:number
}) & {transform?:VisualTransform}
export interface EditingAudio {
  id:string;role:'bgm'|'narration';source:Extract<EditingSource,{type:'library'}>
  trim_start_ms:number;trim_end_ms:number;start_ms:number;volume:number;repeat_mode:'none'|'loop';play_duration_ms:number|null
}
/** revision只随服务端实际提交推进；单轨用有序数组，不存第二套start坐标。 */
export interface EditingDraft {schema_version:3;revision:number;aspect:'16:9'|'9:16'|'1:1';visuals:EditingVisual[];audio_tracks:EditingAudio[]}
export type EditingOperation =
  |{type:'add_visual';clip:EditingVisual;before_id:string|null}
  |{type:'move_visual';clip_id:string;before_id:string|null}
  |{type:'split_visual';clip_id:string;at_ms:number;right_id:string}
  |{type:'trim_video';clip_id:string;trim_start_ms:number;trim_end_ms:number}
  |{type:'remove_visual';clip_id:string}
  |{type:'set_image_duration';clip_id:string;duration_ms:number}
  |{type:'set_original_volume';clip_id:string;volume:number}
  |{type:'set_visual_transform';clip_id:string;transform:VisualTransform}
  |{type:'set_audio';role:'bgm'|'narration';track:EditingAudio|null}
  |{type:'set_aspect';aspect:EditingDraft['aspect']}
export interface EditingCommand {request_id:string;expected_revision:number;operations:EditingOperation[]}
export interface EditingReceipt {output_id:string;request_id:string;previous_revision:number;revision:number;draft:EditingDraft;changes:Array<{type:string;id?:string;duration_ms?:number;reason?:string}>}
