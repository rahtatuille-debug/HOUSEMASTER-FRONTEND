import { useCallback, useEffect, useRef, useState } from 'react'
import { isPage } from './api.js'
import { PAGE } from './panels/ShowMore.jsx'

// A list the server sends a page at a time (F-4). `fetchPage({page,
// page_size})` asks for one page; the first page loads whenever `deps`
// change, and loadMore() fetches the next. A backend that still sends the
// whole list is paged on screen instead, so both work.
export function usePagedList(fetchPage, deps, pageSize = PAGE) {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [nextPage, setNextPage] = useState(null)
  const [serverPaged, setServerPaged] = useState(false)
  const [limit, setLimit] = useState(pageSize)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const fetchRef = useRef(fetchPage)
  fetchRef.current = fetchPage
  // Ignore answers to requests made before the latest reload.
  const generation = useRef(0)

  const reload = useCallback(async () => {
    const mine = ++generation.current
    setLoading(true)
    setError('')
    setLimit(pageSize)
    try {
      const data = await fetchRef.current({ page: 1, page_size: pageSize })
      if (mine !== generation.current) return
      if (isPage(data)) {
        setRows(data.results)
        setTotal(data.count)
        setNextPage(data.next ? 2 : null)
        setServerPaged(true)
      } else {
        const all = Array.isArray(data) ? data : []
        setRows(all)
        setTotal(all.length)
        setNextPage(null)
        setServerPaged(false)
      }
    } catch (err) {
      if (mine === generation.current) setError(err.message || 'Could not load the list.')
    } finally {
      if (mine === generation.current) setLoading(false)
    }
  }, [pageSize])

  async function loadMore() {
    if (!serverPaged) {
      setLimit((current) => current + pageSize)
      return
    }
    if (!nextPage || loadingMore) return
    const mine = generation.current
    setLoadingMore(true)
    try {
      const data = await fetchRef.current({ page: nextPage, page_size: pageSize })
      if (mine !== generation.current) return
      setRows((current) => [...current, ...data.results])
      setTotal(data.count)
      setNextPage(data.next ? nextPage + 1 : null)
    } catch (err) {
      if (mine === generation.current) setError(err.message || 'Could not load more.')
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return {
    rows: serverPaged ? rows : rows.slice(0, limit),
    // Whether the server paged (and filtered) the list; with an older server everything is in allRows.
    serverPaged,
    allRows: rows,
    total,
    loading,
    loadingMore,
    error,
    loadMore,
    reload,
  }
}
