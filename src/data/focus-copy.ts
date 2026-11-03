/** Focus-page labels (PRD v35 A.1, A.4 and B.6). The time is shown by the digits, so
 * action labels stay short verbs. The ended result has separate saved/pending
 * variants, selected using that session's own receipt.
 */
export const focusCopy = {
  startFocus: '开始专注', startRest: '开始休息',
  prepareFocus: '准备专注',
  minutes: (minutes: number) => `${minutes} 分钟`,
  target: (minutes: number) => `目标 ${minutes} 分钟`,
  useDuration: '用这个时长', cancel: '取消', durationTitle: '调专注时长', durationHint: '点时间可调时长',
  dialHint: '点或拖表盘，一圈 60 分钟', durationKept: '开始后，下次沿用这个时长',
  durationError: (min: number, max: number) => `可以设为 ${min} 到 ${max} 之间的整数分钟。`,
  restoreDuration: '恢复上次值',
  restMode: '选择休息', focusMode: '返回专注',
  ready: '准备好了', running: '计时中', paused: '已暂停',
  cancelEnd: '返回计时', endQuestion: '结束本次专注？', confirmEnd: '确认结束',
  endExplanation: '本次将按实际计时时长记录。', endExpired: '本次专注已结束。可以返回查看实际计时和保存状态。',
  endRest: '结束休息', pauseFocus: '暂停专注', pauseRest: '暂停休息', resumeRest: '继续休息', resumeFocus: '继续专注',
  focusElapsed: '本段计时', restElapsed: '休息计时已结束 · 本次休息',
  savedRecord: '已保存', unsavedRecord: '尚未保存',
  viewResult: '查看结果', backToFocus: '回到专注', gotIt: '知道了', focusEndedTitle: '专注结束', restEndedTitle: '休息结束',
  stepAdd: '＋ 这一小步', stepPrefix: '这一小步：', stepDone: '好了',
  mark: '留个标记', write: '记下想法', resumeDraft: '继续草稿', supplement: '补充文字',
  edit: '编辑文字', readSession: '本段想法', sessionThoughts: '本段想法', saveThought: '保存想法',
  existingText: '这条想法的文字', newText: '想法先放这里', savePending: '正在保存…',
  emptyExisting: '保存后只留下标记。', confirmEmpty: '确认只留下标记',
  originalEnded: '原来的专注已结束，文字仍属于那一段。',
  switchDraft: '还有一份草稿。可以先写完，也可以放弃它并打开所选内容。',
  keepDraft: '继续当前草稿', discardAndSwitch: '放弃草稿并切换', writeAnother: '另写一条',
  saveAsNew: '另存为新想法', reloadLatest: '查看最新版本',
  pending: '有更改尚未保存。', retry: '重试保存', memoryOnly: '仅在此页',
  askCategories: '换一种鼓励', dismiss: '收到鼓励了', chooseEncouragement: '选择鼓励类型', returnEncouragement: '返回鼓励',
  encouragementTitle: '一句鼓励', fullText: '查看全文', statusTitle: '保存与撤销', statusDetails: '查看状态',
  askOptions: [
    { pool: 'ASKG', label: '日常鼓励' }, { pool: 'ASKS', label: '开始有点难' },
    { pool: 'ASKB', label: '刚被打断' }, { pool: 'ASKT', label: '有点累了' },
  ],
} as const
