import type { ReadingIllustration, ReadingStage, ReadingVariant } from './reading-story'

interface Passage {
  stage: ReadingStage
  caption: string
  illustration: ReadingIllustration
  excerpt?: string
}

interface ReadingChapter {
  minutes: number
  title: string
  beats: readonly (Passage & { at: number })[]
  ending: Passage
}

const bakeryLine = '风把面包香吹过来，小狗只好先把帽子戴好。'

// Edition 1 remains available to sessions bound before later editorial changes.
export const readingEdition1: Readonly<Record<ReadingVariant, ReadingChapter>> = {
  hat: {
    minutes: 1,
    title: '面包店门口的那只小狗',
    beats: [
      { at: 0, stage: 'open', illustration: 'dog-hat', caption: '书摊在桌上。画里有一只戴着红帽子的小狗。' },
      { at: 0.35, stage: 'turn', illustration: 'reading', caption: '这只小狗好眼熟。它翻回车票夹着的那一页。' },
      { at: 0.70, stage: 'found', illustration: 'dog-found', caption: '在面包店门口找到了！小狗那时还叼着帽子。', excerpt: bakeryLine },
    ],
    ending: { stage: 'found', illustration: 'dog-found', caption: '它翻回车票夹着的那一页：原来，小狗那时正叼着帽子。', excerpt: bakeryLine },
  },
  chapter: {
    minutes: 25,
    title: '车票夹着的那一页',
    beats: [
      { at: 0, stage: 'open', illustration: 'reading', caption: '它从车票夹着的那一页打开了书。' },
      { at: 0.25, stage: 'turn', illustration: 'reading', caption: '刚才有几行很喜欢。它往回翻了两页，又读了一遍。' },
      { at: 0.65, stage: 'later', illustration: 'reading', caption: '它读到了这一章的后半，车票还夹在先前的地方。' },
      { at: 0.85, stage: 'linger', illustration: 'reading', caption: '它把末尾那句话又念了一遍，书还摊在桌上。' },
    ],
    ending: { stage: 'closed', illustration: 'closed-book', caption: '它把车票夹在下一章，合上了书。' },
  },
  reread: {
    minutes: 25,
    title: '从书签往回翻',
    beats: [
      { at: 0, stage: 'open', illustration: 'reading', caption: '车票夹在下一章的开头。它打开书，想再读读前一章。' },
      { at: 0.25, stage: 'turn', illustration: 'reading', caption: '它从书签往前翻，找到了喜欢的那一段。' },
      { at: 0.65, stage: 'later', illustration: 'reading', caption: '重读的时候，它又留意到前后两页呼应的地方。' },
      { at: 0.85, stage: 'linger', illustration: 'reading', caption: '它在熟悉的末页停了一会儿，车票还夹在下一章。' },
    ],
    ending: { stage: 'closed', illustration: 'closed-book', caption: '它又把喜欢的这一章读了一遍，夹好原处的车票，合上了书。' },
  },
}
