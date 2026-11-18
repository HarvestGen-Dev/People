import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cutoffDate, occurrenceDates } from '../src/components/preview-recurrence.ts';

test('leap-day horizon clamps to the last day of February', () => {
  assert.equal(cutoffDate('2028-02-29'), '2029-02-28');
});

test('monthly schedules skip missing dates', () => {
  assert.deepEqual(occurrenceDates('2027-01-31', '2027-05-31', {
    frequency: 'monthly', interval: 1, weekdays: [],
  }), ['2027-01-31', '2027-03-31', '2027-05-31']);
});

test('annual leap-day schedules skip non-leap years', () => {
  assert.deepEqual(occurrenceDates('2028-02-29', '2032-02-29', {
    frequency: 'annual', interval: 1, weekdays: [],
  }), ['2028-02-29', '2032-02-29']);
});

test('weekly schedules use Monday-based intervals and the earlier cutoff', () => {
  assert.deepEqual(occurrenceDates('2027-01-03', '2027-02-01', {
    frequency: 'weekly', interval: 2, weekdays: [1, 0], lastStart: '2027-01-21',
  }), ['2027-01-03', '2027-01-11', '2027-01-17']);
});
