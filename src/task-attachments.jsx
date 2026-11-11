import { useEffect, useState } from 'react'
import { Download, FileText, Paperclip, Trash2, X } from 'lucide-react'
import {
  prepareAttachment,
  saveAttachmentFile,
  uploadTaskAttachments,
} from './attachments.js'
import { Dialog, ErrorText, IconButton, readableError } from './ui.jsx'

const fileSize = (size) => {
  if (typeof size !== 'number') return ''
  if (size >= 1024 * 1024) return (size / (1024 * 1024)).toFixed(1) + ' MB'
  if (size >= 1024) return Math.ceil(size / 1024) + ' KB'
  return size + ' B'
}

function FileRow({ attachment, children }) {
  return (
    <li className="attachment-row">
      <FileText size={16} aria-hidden="true" />
      <span className="attachment-name" title={attachment.name}>
        {attachment.name}
      </span>
      <small className="muted">{fileSize(attachment.size)}</small>
      {children}
    </li>
  )
}

function DraftAttachments({ code, drafts, change }) {
  const [error, setError] = useState('')
  function choose(event) {
    const selected = []
    const errors = []
    for (const file of event.target.files) {
      try {
        selected.push(prepareAttachment(file))
      } catch (problem) {
        errors.push(problem.message)
      }
    }
    event.target.value = ''
    if (selected.length) change([...drafts, ...selected])
    setError(errors.join(' '))
  }
  return (
    <>
      {drafts.length > 0 && (
        <ul className="attachment-list" aria-label={'Tệp chờ lưu ' + code}>
          {drafts.map((attachment) => (
            <FileRow attachment={attachment} key={attachment.key}>
              <IconButton
                label={'Bỏ chọn ' + attachment.name}
                onClick={() =>
                  change(drafts.filter((item) => item.key !== attachment.key))
                }
              >
                <X size={15} />
              </IconButton>
            </FileRow>
          ))}
        </ul>
      )}
      <div className="attachment-tools">
        <label className="attachment-picker button secondary">
          <Paperclip size={15} /> Chọn tệp
          <input
            className="sr-only"
            type="file"
            multiple
            aria-label={'Chọn tệp ' + code}
            onChange={choose}
          />
        </label>
        <small className="muted">Tối đa 10 MB mỗi tệp</small>
      </div>
      <ErrorText message={error} />
    </>
  )
}

function SavedAttachments({ task, repo, code, canRemove, hasDrafts }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loadKey, setLoadKey] = useState(0)
  useEffect(() => {
    let active = true
    repo
      .listAttachments(task)
      .then((files) => {
        if (active) setRows(files)
      })
      .catch((problem) => {
        if (active) setError(readableError(problem))
      })
    return () => {
      active = false
    }
  }, [repo, task, loadKey])

  async function act(attachment, remove) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      if (remove) {
        await repo.removeAttachment(task, attachment.key)
        setRows((current) =>
          current.filter((item) => item.key !== attachment.key),
        )
      } else {
        const blob = await repo.downloadAttachment(task, attachment.key)
        saveAttachmentFile(blob, attachment.name)
      }
    } catch (problem) {
      setError(readableError(problem))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {!rows && !error && (
        <p className="muted field-hint" role="status">
          Đang tải danh sách tệp…
        </p>
      )}
      {rows?.length === 0 && !hasDrafts && (
        <p className="muted field-hint">Chưa có tài liệu đính kèm.</p>
      )}
      {rows?.length > 0 && (
        <ul className="attachment-list" aria-label={'Tệp đã lưu ' + code}>
          {rows.map((attachment) => (
            <FileRow attachment={attachment} key={attachment.key}>
              <IconButton
                label={'Tải xuống ' + attachment.name}
                disabled={busy}
                onClick={() => act(attachment, false)}
              >
                <Download size={15} />
              </IconButton>
              {canRemove && (
                <IconButton
                  label={'Gỡ tệp ' + attachment.name}
                  disabled={busy}
                  onClick={() => act(attachment, true)}
                >
                  <Trash2 size={15} />
                </IconButton>
              )}
            </FileRow>
          ))}
        </ul>
      )}
      <ErrorText message={error} />
      {!rows && error && (
        <button
          type="button"
          className="link-button"
          onClick={() => {
            setError('')
            setLoadKey((value) => value + 1)
          }}
        >
          Thử tải danh sách lại
        </button>
      )}
    </>
  )
}

export function TaskAttachments({
  code,
  task,
  repo,
  drafts = [],
  change,
  collapsed,
}) {
  const [open, setOpen] = useState(false)
  if (collapsed)
    return (
      <details
        className="task-attachments"
        onToggle={(event) => setOpen(event.currentTarget.open)}
      >
        <summary aria-label={'Tài liệu đính kèm ' + code}>
          <Paperclip size={14} /> Tài liệu đính kèm
        </summary>
        {open && <SavedAttachments {...{ task, repo, code }} />}
      </details>
    )
  return (
    <section
      className="task-attachments"
      aria-label={'Tài liệu đính kèm ' + code}
    >
      <p className="attachment-heading">
        <Paperclip size={14} /> Tài liệu đính kèm
      </p>
      {task && (
        <SavedAttachments
          {...{ task, repo, code }}
          canRemove={Boolean(change)}
          hasDrafts={drafts.length > 0}
        />
      )}
      {change && <DraftAttachments {...{ code, drafts, change }} />}
    </section>
  )
}

export function AttachmentRetryDialog({ repo, jobs, onClose, onComplete }) {
  const [failed, setFailed] = useState(jobs)
  const [busy, setBusy] = useState(false)
  async function retry() {
    setBusy(true)
    const remaining = await uploadTaskAttachments(repo, failed)
    if (!remaining.length) onComplete()
    else {
      setFailed(remaining)
      setBusy(false)
    }
  }
  return (
    <Dialog
      title="Tệp chưa tải lên"
      description="Công việc đã được lưu. Bạn có thể thử lại các tệp bên dưới."
      onClose={() => {
        if (!busy) onClose()
      }}
    >
      <div className="dialog-form">
        <ul className="attachment-list">
          {failed.map(({ task, attachment, error }) => (
            <FileRow attachment={attachment} key={attachment.key}>
              <span className="attachment-problem">
                {task.title} · {readableError(error)}
              </span>
            </FileRow>
          ))}
        </ul>
        <div className="form-actions">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={onClose}
          >
            Đóng
          </button>
          <button
            type="button"
            className="button primary"
            disabled={busy}
            onClick={retry}
          >
            {busy ? 'Đang tải lên…' : 'Thử tải lại'}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
