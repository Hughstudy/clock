import type { RecordStoryId, RecordsBand } from '../logic/record-stories'

export const recordsGreeting = {
  morning: '它掀起窗帘一角，偷偷看了一眼果园。',
  afternoon: '窗外的蝴蝶飞到哪儿，它就看到哪儿。',
  evening: '它举起叶子，看看晚霞把叶脉照成了什么颜色。',
  night: '它把书拉到灯下，给下一页留了一小圈光。',
} satisfies Record<RecordsBand, string>

export const recordStories = {
  leaf: { title: '叶子里的小树', caption: '它从书页里接住了一片叶子。对着光一看，叶脉像一棵更小的树。' },
  map: { title: '地图的终点', caption: '书里藏着一张小地图。它用指尖沿着虚线走，终点竟是身旁的那把小椅子。' },
  star: { title: '鼻尖的星星', caption: '翻页时，一颗纸星星贴上了鼻尖。它把眼睛往中间一凑，终于看清了这位小客人。' },
} satisfies Record<RecordStoryId, { title: string; caption: string }>
