import { describe, it, expect } from 'vitest';
import { formatCost, formatDurationMs, formatDurationSec, formatRelativeTime } from './format';

describe('formatCost', () => {
  it('renders two decimals with a dollar sign', () => {
    expect(formatCost(0)).toBe('$0.00');
    expect(formatCost(4.5)).toBe('$4.50');
    expect(formatCost(0.023)).toBe('$0.02');
  });
});

describe('formatDurationMs', () => {
  it('renders seconds with one decimal', () => {
    expect(formatDurationMs(800)).toBe('0.8s');
    expect(formatDurationMs(4200)).toBe('4.2s');
  });
  it('renders an em dash for null', () => {
    expect(formatDurationMs(null)).toBe('—');
  });
});

describe('formatDurationSec', () => {
  it('renders seconds under a minute', () => {
    expect(formatDurationSec(45)).toBe('45s');
  });
  it('renders minutes and seconds past a minute', () => {
    expect(formatDurationSec(83)).toBe('1m 23s');
  });
  it('renders an em dash for null', () => {
    expect(formatDurationSec(null)).toBe('—');
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-06-20T12:00:00Z').getTime();
  it('renders "just now" within a minute', () => {
    expect(formatRelativeTime('2026-06-20T11:59:30Z', now)).toBe('just now');
  });
  it('renders minutes and hours ago', () => {
    expect(formatRelativeTime('2026-06-20T11:45:00Z', now)).toBe('15 min ago');
    expect(formatRelativeTime('2026-06-20T09:00:00Z', now)).toBe('3 h ago');
  });
  it('renders days ago', () => {
    expect(formatRelativeTime('2026-06-18T12:00:00Z', now)).toBe('2 days ago');
  });
});
