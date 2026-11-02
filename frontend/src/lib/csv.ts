export function downloadCsv(
  fileName: string,
  headers: string[],
  rows: (string | number | null)[][],
) {
  const escapeCell = (value: string | number | null) => {
    let text = value === null ? '' : String(value)
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
    return `"${text.replaceAll('"', '""')}"`
  }
  const content = [headers, ...rows]
    .map((row) => row.map(escapeCell).join(';'))
    .join('\r\n')
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
