/** Focus-page labels (PRD v26 §5.2, B.5). The time is shown by the digits, so
 * action labels stay short verbs. The ended result has separate saved/pending
 * variants, selected using that session's own receipt.
 */
export const focusCopy = {
  startFocus: '开始专注', startRest: '开始休息',
  restFor: (minutes: number) => `休息 ${minutes} 分钟`,
  repeatFocus: (minutes: number) => `再专注 ${minutes} 分钟`,
  minutes: (minutes: number) => `${minutes} 分钟`,
  target: (minutes: number) => `目标 ${minutes} 分钟`,
  otherDuration: '其他', otherTitle: '其他时长', useDuration: '用这个时长', cancel: '取消',
  durationRange: (min: number, max: number) => `${min}–${max} 分钟，只用于这一段`,
  durationError: (min: number, max: number) => `可以设为 ${min} 到 ${max} 之间的整数分钟。`,
  restoreDuration: '恢复上次值',
  restMode: '休息一下', focusMode: '回到专注', changeDuration: '换个时长',
  ready: '准备好了', running: '计时中', paused: '已暂停',
  cancelEnd: '先不结束', endQuestion: '现在结束专注？',
  endRunning: '计时在确认前继续。结束后会记录实际计时。', endPaused: '计时已暂停。结束后会记录实际计时。',
  endRest: '结束休息', pauseRest: '暂停休息', resumeRest: '继续休息', resumeFocus: '继续专注',
  focusElapsed: '本段计时', restElapsed: '休息好了 · 本次休息',
  savedRecord: '已保存', unsavedRecord: '尚未保存',
  stepAdd: '＋ 这一小步', stepPrefix: '这一小步：', stepDone: '好了',
  mark: '留个标记', write: '写想法', resumeDraft: '继续写想法', supplement: '补一句',
  edit: '编辑文字', readSession: '本段想法', sessionThoughts: '本段想法', saveThought: '保存想法',
  existingText: '这条想法的文字', newText: '想法先放这里', savePending: '正在保存…',
  emptyExisting: '保存后只留下标记。', confirmEmpty: '确认只留下标记',
  originalEnded: '原来的专注已结束，文字仍属于那一段。',
  switchDraft: '还有一份草稿。可以先写完，也可以放弃它并打开所选内容。',
  keepDraft: '继续当前草稿', discardAndSwitch: '放弃草稿并切换', writeAnother: '另写一条',
  saveAsNew: '另存为新想法', reloadLatest: '查看最新版本',
  pending: '有更改尚未保存。', retry: '重试保存', memoryOnly: '仅在此页',
  askCategories: '换一种鼓励', dismiss: '收到鼓励了',
  askOptions: [
    { pool: 'ASKG', label: '想被支持一下' }, { pool: 'ASKS', label: '开始有点难' },
    { pool: 'ASKB', label: '刚被打断' }, { pool: 'ASKT', label: '有点累了' },
  ],
} as const
