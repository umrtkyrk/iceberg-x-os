import assert from 'node:assert/strict';
import test from 'node:test';
import { disciplineKey, suggestCubeDiscipline, suggestMissionDiscipline } from '../src/services/discipline.service';

test('discipline keys are stable, ASCII and URL-safe', () => {
  assert.equal(disciplineKey('Customer Success'), 'customer-success');
  assert.equal(disciplineKey('  İçerik & Sosyal Medya '), 'icerik-sosyal-medya');
  assert.throws(() => disciplineKey('!!!'));
});

test('engineering mission categories suggest Engineer', () => {
  assert.deepEqual(suggestMissionDiscipline({ category: 'Backend', title: 'Search API' }), { key: 'engineer', reason: 'Category is Backend' });
  assert.equal(suggestMissionDiscipline({ category: 'AI/ML', title: 'Brand voice model' })?.key, 'engineer');
});

test('a General mission with marketing words in the title suggests Marketing', () => {
  assert.equal(suggestMissionDiscipline({ category: 'General', title: 'Q1 social media campaign' })?.key, 'marketing');
  assert.equal(suggestMissionDiscipline({ category: 'General', title: 'Internal tooling' })?.key, 'engineer');
  // A category that is neither engineering nor general gets no guess.
  assert.equal(suggestMissionDiscipline({ category: 'Design', title: 'New onboarding flow' }), null);
});

test('legacy scorecards outweigh missions, which outweigh the department', () => {
  assert.equal(
    suggestCubeDiscipline({ legacy_scorecards: 2, mission_discipline_keys: ['marketing'], department: 'Pazarlama' })?.key,
    'engineer'
  );
  assert.deepEqual(
    suggestCubeDiscipline({ legacy_scorecards: 0, mission_discipline_keys: ['marketing', 'marketing', 'engineer'], department: 'Bilgisayar Mühendisliği' }),
    { key: 'marketing', reason: '2 of their missions are marketing' }
  );
  assert.equal(suggestCubeDiscipline({ legacy_scorecards: 0, mission_discipline_keys: [], department: 'İşletme ve Pazarlama' })?.key, 'marketing');
  assert.equal(suggestCubeDiscipline({ legacy_scorecards: 0, mission_discipline_keys: [], department: 'Computer Engineering' })?.key, 'engineer');
  assert.equal(suggestCubeDiscipline({ legacy_scorecards: 0, mission_discipline_keys: [], department: '' }), null);
});
