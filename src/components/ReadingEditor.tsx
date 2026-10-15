import { useState } from 'react'
import type { FormEvent } from 'react'
import ProgressBar from './ProgressBar.tsx'
import { parseProgressInput, toProgressFormInput } from '../lib/reading.ts'
import type { ProgressFormInput } from '../lib/reading.ts'
import type { SaveRecordsResult } from '../lib/storage.ts'
import type { ReadingRecord } from '../types/reading.ts'

type ReadingEditorProps = {
  record: ReadingRecord
  updateProgress: (id: string, currentPage?: number, totalPages?: number) => SaveRecordsResult
  updateNote: (id: string, note: string) => SaveRecordsResult
}

type Feedback = { tone: 'ok' | 'warn'; text: string }

/**
 * 一本书的「阅读进度 + 读书笔记」编辑区。
 *
 * 注意：这个组件在详情页里必须带 key={record.book.id} 使用。
 * 从 A 书跳到 B 书时 React Router 会复用同一个页面实例，
 * 用 key 强制重建这个组件，草稿就会跟着换成新书的内容，
 * 否则会出现「A 书的笔记残留在 B 书输入框里」这种串书问题。
 *
 * 所有输入都只是组件内部的草稿，只有点保存才会写进正式数据；
 * 直接离开页面 = 放弃未保存的修改。
 */
export default function ReadingEditor({
  record,
  updateProgress,
  updateNote,
}: ReadingEditorProps) {
  const [progressForm, setProgressForm] = useState<ProgressFormInput>(() =>
    toProgressFormInput(record),
  )
  const [noteDraft, setNoteDraft] = useState(() => record.note ?? '')
  const [progressFeedback, setProgressFeedback] = useState<Feedback | null>(null)
  const [noteFeedback, setNoteFeedback] = useState<Feedback | null>(null)

  function updateProgressField(field: keyof ProgressFormInput, value: string) {
    setProgressForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleProgressSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProgressFeedback(null)

    const parsed = parseProgressInput(progressForm)
    if (!parsed.ok) {
      // 校验失败：保留用户当前输入，只提示哪里不对
      setProgressFeedback({ tone: 'warn', text: parsed.message })
      return
    }

    const result = updateProgress(record.book.id, parsed.currentPage, parsed.totalPages)
    setProgressFeedback(
      result.ok
        ? { tone: 'ok', text: '阅读进度已保存。' }
        : { tone: 'warn', text: '进度已在页面上更新，但' + result.message },
    )
  }

  function handleNoteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNoteFeedback(null)

    const result = updateNote(record.book.id, noteDraft)
    setNoteFeedback(
      result.ok
        ? {
            tone: 'ok',
            text: noteDraft.trim() === '' ? '笔记已清空。' : '笔记已保存。',
          }
        : { tone: 'warn', text: '笔记已在页面上更新，但' + result.message },
    )
  }

  return (
    <>
      <section className="panel">
        <h2 className="panel__title">阅读进度</h2>

        <ProgressBar currentPage={record.currentPage} totalPages={record.totalPages} />

        <form className="edit-form" onSubmit={handleProgressSubmit}>
          <div className="field-row">
            <label className="field">
              <span className="field__label">当前读到第几页</span>
              <input
                className="field__input"
                inputMode="numeric"
                value={progressForm.currentPage}
                onChange={(event) => updateProgressField('currentPage', event.target.value)}
                placeholder="例如：20，可留空"
              />
            </label>

            <label className="field">
              <span className="field__label">总页数</span>
              <input
                className="field__input"
                inputMode="numeric"
                value={progressForm.totalPages}
                onChange={(event) => updateProgressField('totalPages', event.target.value)}
                placeholder="不知道就留空"
              />
            </label>
          </div>

          <div className="edit-form__actions">
            <button className="button" type="submit">
              保存进度
            </button>
            <button
              className="button button--ghost"
              type="button"
              onClick={() => {
                setProgressForm(toProgressFormInput(record))
                setProgressFeedback(null)
              }}
            >
              放弃修改
            </button>
          </div>
        </form>

        {progressFeedback ? (
          <p
            className={
              progressFeedback.tone === 'ok'
                ? 'feedback feedback--ok'
                : 'feedback feedback--warn'
            }
            role="status"
          >
            {progressFeedback.text}
          </p>
        ) : null}
      </section>

      <section className="panel">
        <h2 className="panel__title">读书笔记</h2>
        <p className="panel__hint">
          {record.note
            ? '已保存的笔记：'
            : '还没有笔记，可以在下面写下自己的想法，支持换行。'}
        </p>

        {record.note ? <p className="note-view">{record.note}</p> : null}

        <form className="edit-form" onSubmit={handleNoteSubmit}>
          <label className="field">
            <span className="field__label">编辑笔记（纯文本）</span>
            <textarea
              className="field__input note-textarea"
              rows={6}
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder="例如：第三章关于黑暗森林法则的推演很精彩……"
            />
          </label>

          <div className="edit-form__actions">
            <button className="button" type="submit">
              保存笔记
            </button>
            <button
              className="button button--ghost"
              type="button"
              onClick={() => {
                setNoteDraft(record.note ?? '')
                setNoteFeedback(null)
              }}
            >
              放弃修改
            </button>
          </div>
        </form>

        {noteFeedback ? (
          <p
            className={
              noteFeedback.tone === 'ok' ? 'feedback feedback--ok' : 'feedback feedback--warn'
            }
            role="status"
          >
            {noteFeedback.text}
          </p>
        ) : null}
      </section>
    </>
  )
}
