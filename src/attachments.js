export const attachmentLimit = 10 * 1024 * 1024
const filenameLimit = 240

export function prepareAttachment(file) {
  if (!file.size) throw new Error(file.name + ' là tệp trống.')
  if (file.size > attachmentLimit)
    throw new Error(file.name + ' vượt quá 10 MB.')
  const bytes = new TextEncoder().encode(file.name)
  if (!bytes.length || bytes.length > filenameLimit)
    throw new Error('Hãy rút ngắn tên tệp trước khi đính kèm.')
  const encoded = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return {
    key: crypto.randomUUID() + '_' + encoded,
    name: file.name,
    size: file.size,
    file,
  }
}

export function attachmentName(key) {
  const encoded = key.slice(37).replace(/-/g, '+').replace(/_/g, '/')
  try {
    return (
      new TextDecoder('utf-8', { fatal: true }).decode(
        Uint8Array.from(atob(encoded), (letter) => letter.charCodeAt(0)),
      ) || 'Tài liệu đính kèm'
    )
  } catch {
    return 'Tài liệu đính kèm'
  }
}

export async function uploadTaskAttachments(repo, jobs) {
  const failed = []
  for (const job of jobs) {
    try {
      await repo.uploadAttachment(job.task, job.attachment)
    } catch (error) {
      failed.push({ ...job, error })
    }
  }
  return failed
}

export function saveAttachmentFile(blob, name) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
