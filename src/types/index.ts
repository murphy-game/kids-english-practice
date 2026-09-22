export interface Lesson{lesson_id:string;course:string;lesson:string;topic:string;page:string;active:boolean}
export interface ContentItem{item_id:string;lesson_id:string;type:string;english:string;chinese:string;example:string;answer_pattern:string;phonics_type:string;image_key:string;need_image:string;audio_mp3:string;difficulty:number}
export interface LessonPractice{lesson_id:string;category:string;recommended_question_types:string}
export interface Asset{image_key:string;display_type:string;emoji:string;image_file:string;status:string;note:string}
export interface DataLoadResult{lessons:Lesson[];content:ContentItem[];lessonPractice:LessonPractice[];assets:Asset[];source:'google_sheet'|'local_fallback';loadedAt:string}
