import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { deepApiMock } from '../test/apiMock.js'

const mockApi = { current: null }
vi.mock('../api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get api() {
    return mockApi.current
  },
}))

const { default: GradesImport } = await import('./GradesImport.jsx')

const me = { role: 'teacher', assignments: [{ school_class: 1, subject: 10 }], roles: [], permissions: { classes: { academic: [1] } } }
const subjects = [{ id: 10, name: 'Maths' }, { id: 11, name: 'French' }]
const terms = [{ id: 5, name: 'Term 1', is_locked: false }, { id: 6, name: 'Old term', is_locked: true }]
const types = [{ id: 3, name: 'CAT' }]

function choose() {
  fireEvent.click(screen.getByRole('button', { name: 'Import marks' }))
}

describe('importing marks from Excel', () => {
  it('offers only my classes, the subjects I teach there and open terms; downloads the sheet; checks then imports', async () => {
    const template = vi.fn(() => Promise.resolve())
    const importFile = vi.fn((file, params, commit) => Promise.resolve(commit ? { imported: 2 } : {
      counts: { ready: 2, skipped: 1, errors: 1, missing: 1 }, missing: ['Cy X'], imported: 0,
      rows: [
        { row: 6, admission_number: 'ADM/1', name: 'Ann X', mark: '42', status: 'ok', message: '' },
        { row: 7, admission_number: 'ADM/2', name: 'Ben X', mark: 'ABS', status: 'skipped', message: 'No mark: skipped.' },
        { row: 8, admission_number: 'ADM/9', name: '', mark: '10', status: 'error', message: 'No student has this admission number.' },
      ],
    }))
    const onImported = vi.fn()
    mockApi.current = deepApiMock({
      'schoolClasses.list': () => Promise.resolve([{ id: 1, name: '7A' }, { id: 2, name: '7B' }]),
      'marksheets.template': template, 'marksheets.importFile': importFile,
    })
    render(<GradesImport me={me} subjects={subjects} terms={terms} types={types} onImported={onImported} />)
    choose()
    const klass = await screen.findByLabelText('Class')
    await waitFor(() => expect(klass.querySelectorAll('option')).toHaveLength(2)) // Choose… and 7A only
    fireEvent.change(klass, { target: { value: '1' } })
    const subject = screen.getByLabelText('Subject')
    expect([...subject.querySelectorAll('option')].map((o) => o.textContent)).toEqual(['Choose…', 'Maths'])
    expect([...screen.getByLabelText('Term').querySelectorAll('option')].map((o) => o.textContent)).toEqual(['Choose…', 'Term 1'])
    fireEvent.change(subject, { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Term'), { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText('Assessment type'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Out of'), { target: { value: '50' } })
    fireEvent.click(screen.getByRole('button', { name: 'Download mark sheet' }))
    const params = { school_class: '1', subject: '10', term: '5', assessment_type: '3', max_score: '50' }
    await waitFor(() => expect(template).toHaveBeenCalledWith(params))

    const file = new File(['x'], 'marks.xlsx')
    fireEvent.change(screen.getByLabelText('Filled-in mark sheet'), { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: 'Check the file' }))
    expect(await screen.findByText(/No student has this admission number/)).toBeInTheDocument()
    // Only the rows to look at, until asked for all.
    expect(screen.queryByText('Ann X')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show all 3 rows' }))
    expect(screen.getByText('Ann X')).toBeInTheDocument()
    expect(screen.getByText('Not in the sheet: Cy X.')).toBeInTheDocument()
    expect(importFile).toHaveBeenLastCalledWith(file, params, false)
    fireEvent.click(screen.getByRole('button', { name: 'Import 2 marks' }))
    expect(await screen.findByText('Imported 2 marks.')).toBeInTheDocument()
    expect(importFile).toHaveBeenLastCalledWith(file, params, true)
    expect(onImported).toHaveBeenCalled()
  })

  it('shows the server’s reason when a file can’t be read', async () => {
    mockApi.current = deepApiMock({
      'schoolClasses.list': () => Promise.resolve([{ id: 1, name: '7A' }]),
      'marksheets.importFile': () => Promise.reject(new Error("That isn't an Excel file HouseMaster can read.")),
    })
    render(<GradesImport me={me} subjects={subjects} terms={terms} types={[]} />)
    choose()
    fireEvent.change(await screen.findByLabelText('Class'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Term'), { target: { value: '5' } })
    expect(screen.queryByLabelText('Assessment type')).toBeNull()
    fireEvent.change(screen.getByLabelText('Filled-in mark sheet'), { target: { files: [new File(['x'], 'a.xlsx')] } })
    fireEvent.click(screen.getByRole('button', { name: 'Check the file' }))
    expect(await screen.findByText(/isn't an Excel file/)).toBeInTheDocument()
  })
})
