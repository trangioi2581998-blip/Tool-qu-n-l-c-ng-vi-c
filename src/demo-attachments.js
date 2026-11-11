let database

function openDatabase() {
  database ||= new Promise((resolve, reject) => {
    const request = indexedDB.open('nhip-viec-attachments', 1)
    request.onupgradeneeded = () => {
      request.result
        .createObjectStore('files', { keyPath: ['taskId', 'key'] })
        .createIndex('taskId', 'taskId')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  }).catch(() => {
    database = undefined
    throw new Error('Trình duyệt không mở được kho tệp của bản demo.')
  })
  return database
}

async function useStore(mode, action) {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('files', mode)
    const request = action(transaction.objectStore('files'))
    transaction.oncomplete = () => resolve(request.result)
    transaction.onabort = () =>
      reject(new Error('Không thể cập nhật kho tệp của bản demo.'))
  })
}

export async function listDemoAttachments(taskId) {
  const rows = await useStore('readonly', (store) =>
    store.index('taskId').getAll(taskId),
  )
  return rows.map(({ key, name, size }) => ({ key, name, size }))
}

export async function hasDemoAttachments(taskId) {
  return Boolean(
    await useStore('readonly', (store) => store.index('taskId').count(taskId)),
  )
}

export function putDemoAttachment(taskId, attachment) {
  return useStore('readwrite', (store) => store.put({ taskId, ...attachment }))
}

export async function readDemoAttachment(taskId, key) {
  const row = await useStore('readonly', (store) => store.get([taskId, key]))
  if (!row) throw new Error('Tệp đính kèm không còn khả dụng.')
  return row.file
}

export function removeDemoAttachment(taskId, key) {
  return useStore('readwrite', (store) => store.delete([taskId, key]))
}
