import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activeDirectoryMissions,
  directoryOptions,
  directoryStats,
  matchesDirectorySearch,
  type DirectoryCube,
} from '../../frontend/src/utils/directory';

const fixture: DirectoryCube[] = [
  { id: 'original', cube_number: '000', current_level: 'Cube' },
  {
    id: 'a',
    cube_number: '001',
    current_level: 'Senior_Cube',
    user: { name: 'Elif' },
    skills: ['React', 'TypeScript'],
    interests: ['Research'],
    nda_signed: true,
    assigned_mentor: { id: 'mentor', name: 'Onur' },
    team_memberships: [
      {
        team: {
          mission: {
            id: 'mission',
            title: 'Automation tools',
            status: 'researching',
          },
        },
      },
      {
        team: {
          mission: {
            id: 'mission',
            title: 'Automation tools',
            status: 'researching',
          },
        },
      },
      {
        team: {
          mission: { id: 'old', title: 'Old work', status: 'completed' },
        },
      },
    ],
  },
  {
    id: 'b',
    cube_number: '002',
    current_level: 'Cube',
    user: null,
    skills: null,
    team_memberships: [{ team: null }],
  },
  { id: 'c', cube_number: '003', current_level: 'Alumni' },
  { id: 'd', cube_number: '004', current_level: 'Iceberger' },
];

test('directory statistics exclude the original Cube and exited people from operational gaps', () => {
  assert.deepEqual(directoryStats(fixture, 'a'), {
    total: 4,
    programme: 2,
    teammates: 1,
    senior: 1,
    noMission: 1,
    noMentor: 1,
    ndaOutstanding: 1,
    alumni: 1,
    skills: 2,
    missions: 1,
  });
});

test('mission totals deduplicate memberships and exclude completed work', () => {
  assert.deepEqual(
    activeDirectoryMissions(fixture[1]).map((mission) => mission.id),
    ['mission']
  );
  assert.deepEqual(
    activeDirectoryMissions({ ...fixture[1], current_level: 'Alumni' }),
    []
  );
});

test('search handles missing relations and matches skills, interests, mentor and mission together', () => {
  assert.equal(matchesDirectorySearch(fixture[2], 'react'), false);
  assert.equal(
    matchesDirectorySearch(fixture[1], 'React research Onur automation'),
    true
  );
  assert.equal(matchesDirectorySearch(fixture[0], '#000 original'), true);
});

test('skill options collapse casing and whitespace variants', () => {
  assert.deepEqual(directoryOptions(['React', ' react ', '', 'TypeScript']), [
    'React',
    'TypeScript',
  ]);
});
