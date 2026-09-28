// Tables marked `responsive-table` turn into cards on phones (see styles.css).
// Each card shows every value with its column name, which this fills in from
// the table's headings, so no table has to label its cells by hand. The
// first column becomes the card's title and a column of buttons its actions.
function label(table) {
  const heads = [...table.querySelectorAll(':scope > thead th')].map((th) => th.innerText.trim())
  if (!heads.length) return
  for (const row of table.querySelectorAll(':scope > tbody > tr')) {
    const cells = [...row.children]
    if (cells.length !== heads.length) continue // e.g. a detail row spanning every column
    cells.forEach((cell, i) => {
      if (!cell.hasAttribute('data-label')) cell.setAttribute('data-label', i === 0 ? '' : heads[i])
      if (i === 0 && !cell.classList.contains('row-title')) cell.classList.add('row-title')
      if (!heads[i] && i > 0 && cell.querySelector('button, a') && !cell.classList.contains('row-actions')) {
        cell.classList.add('row-actions')
      }
    })
  }
}

export function startResponsiveTables() {
  let queued = false
  const run = () => {
    queued = false
    document.querySelectorAll('table.responsive-table').forEach(label)
  }
  new MutationObserver(() => {
    if (!queued) { queued = true; requestAnimationFrame(run) }
  }).observe(document.body, { childList: true, subtree: true })
  run()
}
