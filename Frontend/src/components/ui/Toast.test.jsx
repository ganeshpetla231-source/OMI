import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ToastProvider, useToast } from './Toast';

function ToastTrigger() {
  const toast = useToast();
  return <button type="button" onClick={() => toast.success('Saved successfully')}>Save</button>;
}

describe('Toast system', () => {
  it('announces and dismisses a success message', async () => {
    const user = userEvent.setup();
    render(<ToastProvider><ToastTrigger /></ToastProvider>);

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('status')).toHaveTextContent('Saved successfully');
    await user.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(screen.queryByText('Saved successfully')).not.toBeInTheDocument();
  });
});
