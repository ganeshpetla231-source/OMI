import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { GUEST_MODE_KEY } from '../utils/authStorage';
import { LanguageProvider } from '../context/LanguageContext';
import NotesPage from './NotesPage';

function LocationOutput() {
  const location = useLocation();
  return <output data-testid="practice-state">{JSON.stringify(location.state)}</output>;
}

function renderNotes() {
  return render(
    <LanguageProvider>
      <MemoryRouter initialEntries={['/notes']}>
        <Routes>
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/interview/setup" element={<LocationOutput />} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );
}

describe('NotesPage', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(GUEST_MODE_KEY, 'true');
  });

  it('creates a local note, generates questions, and passes its ID to interview setup', async () => {
    renderNotes();
    fireEvent.click(await screen.findByRole('button', { name: 'Create note' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Caching basics' } });
    fireEvent.change(screen.getByLabelText('Note content'), {
      target: { value: '# Caching\nCaching is storing frequently used data for faster access. Cache invalidation keeps stored values current.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));

    expect(await screen.findByText('Caching basics')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    fireEvent.click(screen.getByRole('button', { name: 'Generate questions from this note' }));

    expect(await screen.findByText(/Explain Caching/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Practice with these' }));

    await waitFor(() => {
      expect(screen.getByTestId('practice-state')).toHaveTextContent('"source":"notes"');
      expect(screen.getByTestId('practice-state').textContent).toMatch(/"noteId":"local_note_/);
    });
  });
});
