import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Input } from './Input';

describe('Input', () => {
  it('connects its label and field-level error accessibly', async () => {
    const user = userEvent.setup();
    render(<Input label="Email" type="email" error="Enter a valid email address" />);
    const input = screen.getByRole('textbox', { name: 'Email' });

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a valid email address');
    await user.type(input, 'student@example.com');
    expect(input).toHaveValue('student@example.com');
  });
});
