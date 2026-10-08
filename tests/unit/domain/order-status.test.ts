import { describe, expect, it } from 'vitest';

import {
  assertOrderTransition,
  canTransitionOrder,
} from '../../../src/domain/model/order-status.js';
import { ValidationError } from '../../../src/domain/errors/index.js';

describe('order status state machine', () => {
  it('allows PENDING → PAID, FAILED and CANCELLED', () => {
    expect(canTransitionOrder('PENDING', 'PAID')).toBe(true);
    expect(canTransitionOrder('PENDING', 'FAILED')).toBe(true);
    expect(canTransitionOrder('PENDING', 'CANCELLED')).toBe(true);
  });

  it('never allows transitions from terminal states', () => {
    expect(canTransitionOrder('PAID', 'FAILED')).toBe(false);
    expect(canTransitionOrder('PAID', 'CANCELLED')).toBe(false);
    expect(canTransitionOrder('FAILED', 'PAID')).toBe(false);
    expect(canTransitionOrder('FAILED', 'CANCELLED')).toBe(false);
    expect(canTransitionOrder('CANCELLED', 'PENDING')).toBe(false);
    expect(canTransitionOrder('CANCELLED', 'PAID')).toBe(false);
  });

  it('disallows self-transitions and backwards steps', () => {
    expect(canTransitionOrder('PENDING', 'PENDING')).toBe(false);
    expect(canTransitionOrder('PENDING', 'PAID')).toBe(true);
  });

  it('throws a domain ValidationError on illegal transitions', () => {
    expect(() => assertOrderTransition('PAID', 'FAILED')).toThrow(ValidationError);
  });

  it('accepts a legal transition without throwing', () => {
    expect(() => assertOrderTransition('PENDING', 'PAID')).not.toThrow();
  });
});
