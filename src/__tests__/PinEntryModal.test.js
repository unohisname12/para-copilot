import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PinEntryModal, PinDigitRow } from '../features/stealth/PinEntryModal';
import { setPin, hasPin, clearPin } from '../features/stealth/pinStorage';

beforeEach(() => {
  globalThis.localStorage.clear();
});

function getDigitInputs() {
  // Each digit input has aria-label="PIN digit N"
  return [1, 2, 3, 4].map(i => screen.getByLabelText(`PIN digit ${i}`));
}

function typeDigits(inputs, digits) {
  digits.split('').forEach((d, i) => {
    fireEvent.change(inputs[i], { target: { value: d } });
  });
}

describe('PinDigitRow', () => {
  test('renders 4 inputs', () => {
    render(<PinDigitRow value="" onChange={() => {}} />);
    expect(getDigitInputs()).toHaveLength(4);
  });

  test('typing a digit auto-advances focus', () => {
    let v = '';
    const onChange = (next) => { v = next; };
    const { rerender } = render(<PinDigitRow value={v} onChange={onChange} />);
    const inputs = getDigitInputs();
    fireEvent.change(inputs[0], { target: { value: '1' } });
    rerender(<PinDigitRow value={v} onChange={onChange} />);
    expect(document.activeElement).toBe(inputs[1]);
  });

  test('non-digits are stripped', () => {
    let v = '';
    const onChange = (next) => { v = next; };
    render(<PinDigitRow value={v} onChange={onChange} />);
    const inputs = getDigitInputs();
    fireEvent.change(inputs[0], { target: { value: 'a' } });
    expect(v).toBe('');
  });

  test('onComplete fires when 4th digit entered', async () => {
    let v = '';
    const onComplete = jest.fn();
    function Wrapper() {
      const [val, setVal] = React.useState('');
      v = val;
      return <PinDigitRow value={val} onChange={setVal} onComplete={onComplete} />;
    }
    render(<Wrapper />);
    const inputs = getDigitInputs();
    typeDigits(inputs, '1234');
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith('1234'));
  });
});

describe('PinEntryModal — verify mode', () => {
  test('correct PIN calls onSuccess', async () => {
    await setPin('1234');
    const onSuccess = jest.fn();
    const onCancel = jest.fn();
    render(<PinEntryModal mode="verify" onSuccess={onSuccess} onCancel={onCancel} />);
    const inputs = getDigitInputs();
    typeDigits(inputs, '1234');
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('1234'));
  });

  test('wrong PIN does NOT call onSuccess', async () => {
    await setPin('1234');
    const onSuccess = jest.fn();
    const onCancel = jest.fn();
    render(<PinEntryModal mode="verify" onSuccess={onSuccess} onCancel={onCancel} />);
    const inputs = getDigitInputs();
    typeDigits(inputs, '9999');
    // Give the async verify a tick
    await new Promise(r => setTimeout(r, 50));
    expect(onSuccess).not.toHaveBeenCalled();
    // Error message renders
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  });

  test('cancel button calls onCancel', async () => {
    await setPin('1234');
    const onSuccess = jest.fn();
    const onCancel = jest.fn();
    render(<PinEntryModal mode="verify" onSuccess={onSuccess} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });
});

describe('PinEntryModal — set mode', () => {
  test('matching PIN + confirm saves and calls onSuccess', async () => {
    expect(hasPin()).toBe(false);
    const onSuccess = jest.fn();
    render(<PinEntryModal mode="set" onSuccess={onSuccess} onCancel={() => {}} />);
    // Two PIN rows: one for new PIN, one for confirm. Each row has aria-labels
    // "PIN digit 1..4" — both rows share those labels, so we use getAllByLabelText.
    const allDigit1 = screen.getAllByLabelText('PIN digit 1');
    expect(allDigit1).toHaveLength(2);
    const newRow = [1, 2, 3, 4].map(i => screen.getAllByLabelText(`PIN digit ${i}`)[0]);
    const confirmRow = [1, 2, 3, 4].map(i => screen.getAllByLabelText(`PIN digit ${i}`)[1]);
    typeDigits(newRow, '5678');
    typeDigits(confirmRow, '5678');
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('5678'));
    expect(hasPin()).toBe(true);
  });

  test('mismatched confirm does NOT save', async () => {
    const onSuccess = jest.fn();
    render(<PinEntryModal mode="set" onSuccess={onSuccess} onCancel={() => {}} />);
    const newRow = [1, 2, 3, 4].map(i => screen.getAllByLabelText(`PIN digit ${i}`)[0]);
    const confirmRow = [1, 2, 3, 4].map(i => screen.getAllByLabelText(`PIN digit ${i}`)[1]);
    typeDigits(newRow, '1111');
    typeDigits(confirmRow, '2222');
    await new Promise(r => setTimeout(r, 50));
    expect(onSuccess).not.toHaveBeenCalled();
    expect(hasPin()).toBe(false);
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  });
});

afterEach(() => clearPin());
