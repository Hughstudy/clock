/** PRD v5 §7.11. Candidate entry labels use explicit, different verbs in FQ01/FQ03.
 * Action labels describe the intent before dispatch. The ended result has separate
 * saved/pending variants, selected using that session's own receipt.
 */
export const focusCopy = {
  selectDuration: '选时长',
  startFocus: (minutes: number) => `开始专注 · ${minutes} 分钟`,
  quickStart: (minutes: number) => `开始 ${minutes} 分钟专注`,
  startRest: (minutes: number) => `开始休息 · ${minutes} 分钟`,
  repeatFocus: (minutes: number) => `再开一段 · ${minutes} 分钟`,
  focusMode: '专注模式', restMode: '休息模式', shortRest: '选短休息',
  focusReady: '回到专注准备', prepare: '回到准备', cancelEnd: '先不结束',
  endRest: '结束休息', pauseRest: '暂停休息', resumeRest: '继续休息',
  finished: '已结束', finishedUnsaved: '已结束 · 尚未保存',
  savedRecord: '已记录', unsavedRecord: '尚未保存', focusElapsed: '本段实际投入', restElapsed: '本次休息',
  mark: '留个记号', write: '写想法', resumeDraft: '继续写想法', supplement: '补充文字',
  edit: '编辑文字', readSession: '看本段想法', sessionThoughts: '本段想法', saveThought: '保存想法',
  existingText: '这条想法的文字', newText: '想留在这里的事', savePending: '正在保存…',
  emptyExisting: '保存后只留下记号。', confirmEmpty: '确认只留下记号',
  originalEnded: '原来的专注已结束，文字仍属于那一段。',
  switchDraft: '还有一份草稿。可以先写完，也可以放弃它并打开所选内容。',
  keepDraft: '继续当前草稿', discardAndSwitch: '放弃草稿并切换', writeAnother: '另写一条',
  saveAsNew: '另存为新想法', reloadLatest: '查看最新版本',
  pending: '有更改尚未保存。', retry: '重试保存',
  askCategories: '按现在的需要选',
  askOptions: [
    { pool: 'ASKG', label: '想被支持一下' }, { pool: 'ASKS', label: '开始有点难' },
    { pool: 'ASKB', label: '刚被打断' }, { pool: 'ASKT', label: '有点累了' },
  ],
} as const
