// F-4: lists the server pages (reports, announcements, change requests)
// load a page at a time, and still work with a backend that sends the
// whole list.
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { usePagedList } from './usePagedList.js'
import ShowMore from './panels/ShowMore.jsx'

function List({ fetchPage, filter = '' }) {
  const list = usePagedList((params) => fetchPage({ ...params, filter }), [filter], 10)
  if (list.loading) return <p>Loading…</p>
  const alert = list.error ? <p role="alert">{list.error}</p> : null
  if (!list.rows.length) return <div>{alert}<p>Nothing here.</p></div>
  return (
    <div>
      {alert}
      <ul>{list.rows.map((r) => <li key={r.id}>row {r.id}</li>)}</ul>
      <ShowMore shown={list.rows.length} total={list.total} onMore={list.loadMore} step={10} />
      <button type="button" onClick={list.reload}>Reload</button>
    </div>
  )
}

const rows = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => ({ id: from + i }))

function pages(total, size = 10) {
  return vi.fn(({ page }) => {
    const start = (page - 1) * size + 1
    const end = Math.min(page * size, total)
    return Promise.resolve({ count: total, next: end < total ? `?page=${page + 1}` : null,
      previous: page > 1 ? 'x' : null, results: rows(start, end) })
  })
}

describe('usePagedList', () => {
  it('shows the first page, then fetches the next one on "show more" until everything is loaded', async () => {
    const fetchPage = pages(25)
    render(<List fetchPage={fetchPage} />)
    expect(await screen.findByText('row 10')).toBeInTheDocument()
    expect(screen.queryByText('row 11')).not.toBeInTheDocument()
    expect(fetchPage).toHaveBeenLastCalledWith({ page: 1, page_size: 10, filter: '' })
    fireEvent.click(screen.getByRole('button', { name: /show 10 more/i }))
    expect(await screen.findByText('row 20')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /show 5 more/i }))
    expect(await screen.findByText('row 25')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /more/i })).not.toBeInTheDocument()
    expect(fetchPage).toHaveBeenCalledTimes(3)
  })

  it('pages a whole list from an older backend on screen', async () => {
    const fetchPage = vi.fn(() => Promise.resolve(rows(1, 23)))
    render(<List fetchPage={fetchPage} />)
    expect(await screen.findByText('row 10')).toBeInTheDocument()
    expect(screen.queryByText('row 11')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /show 10 more/i }))
    expect(screen.getByText('row 20')).toBeInTheDocument()
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })

  it('shows the empty state', async () => {
    render(<List fetchPage={pages(0)} />)
    expect(await screen.findByText('Nothing here.')).toBeInTheDocument()
  })

  it('shows an error, and a failed "show more" keeps the rows already loaded', async () => {
    render(<List fetchPage={vi.fn(() => Promise.reject(new Error('Could not load.')))} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load.')

    const flaky = pages(25)
    flaky.mockImplementationOnce(pages(25)).mockImplementationOnce(() => Promise.reject(new Error('Network down.')))
    const view = render(<List fetchPage={flaky} />)
    expect(await view.findByText('row 10')).toBeInTheDocument()
    await act(async () => fireEvent.click(view.getByRole('button', { name: /show 10 more/i })))
    expect(view.getByText('row 10')).toBeInTheDocument()
    expect(view.getAllByRole('alert').at(-1)).toHaveTextContent('Network down.')
  })

  it('starts again from page 1 when the filter changes or on reload', async () => {
    const fetchPage = pages(25)
    const view = render(<List fetchPage={fetchPage} filter="a" />)
    await view.findByText('row 10')
    fireEvent.click(view.getByRole('button', { name: /show 10 more/i }))
    await view.findByText('row 20')
    view.rerender(<List fetchPage={fetchPage} filter="b" />)
    await view.findByText('row 10')
    expect(view.queryByText('row 20')).not.toBeInTheDocument()
    expect(fetchPage).toHaveBeenLastCalledWith({ page: 1, page_size: 10, filter: 'b' })
  })
})
