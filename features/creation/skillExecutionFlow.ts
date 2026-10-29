/** 独立步骤声明，不改变旧 workflow_steps 问答或 workflows/plan_type 含义。 */
export interface SkillFlowStep {id:string;title:string;type:string;/** 待接通步骤保留计划能力，仅供编辑配置，不构成执行授权。 */planned_type?:string|null;instructions:string;inputs:string[];unavailable_reason?:string;allowed_models?:string[];style_id?:string;style_prompt?:string;prompt_template?:string}
export interface SkillFlow {version:1;steps:SkillFlowStep[];source_document?:string|null}
