import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  gamesRegistry,
  getGamesByState,
  findGame,
  evaluateGameStatus,
  type State,
} from '../../src/config/games.registry.ts';

describe('ING-3 / games.registry: data-driven game scope', () => {
  it('registry drives polling scope restricted to FL/GA/NY registered games', () => {
    const all = gamesRegistry.games;
    assert.ok(all.length > 0, 'registry must contain games');
    const states = new Set(all.map((g) => g.state));
    assert.deepEqual([...states].sort(), ['FL', 'GA', 'NY'], 'only FL/GA/NY are registered');

    // FL registered games per ING-3 (incl. the possibly-retired CASH4LIFE).
    const fl = getGamesByState('FL').map((g) => g.gameId).sort();
    assert.deepEqual(fl, ['cash4life', 'fantasy5', 'mega-millions', 'pick2', 'pick3', 'pick4', 'pick5', 'powerball']);
  });

  it('getGamesByState returns only games for that state', () => {
    const ny = getGamesByState('NY');
    assert.ok(ny.length > 0);
    assert.ok(ny.every((g) => g.state === 'NY'), 'every NY game must have state NY');
  });

  it('findGame locates a game by state and id, undefined for unknown', () => {
    const gaFantasy = findGame('GA', 'fantasy5');
    assert.equal(gaFantasy?.gameName, 'Fantasy 5');
    assert.equal(findGame('FL', 'no-such-game'), undefined);
  });
});

describe('ING-3 / games.registry: schedules', () => {
  it('CASH4LIFE is registered as a daily-evening FL game with lastObservedDraw 2026-02-21', () => {
    const cash = findGame('FL', 'cash4life');
    assert.ok(cash, 'CASH4LIFE must be in the registry');
    assert.equal(cash.gameName, 'CASH4LIFE');
    assert.equal(cash.state, 'FL');
    assert.deepEqual(cash.drawDays, [0, 1, 2, 3, 4, 5, 6], 'CASH4LIFE draws daily');
    assert.equal(cash.lastObservedDraw, '2026-02-21', 'last observed draw per ING-3');
  });

  it('Powerball and Mega Millions have their official draw days', () => {
    const flPb = findGame('FL', 'powerball');
    assert.deepEqual(flPb?.drawDays, [1, 3, 6], 'PB draws Mon/Wed/Sat');
    const gaMm = findGame('GA', 'mega-millions');
    assert.deepEqual(gaMm?.drawDays, [2, 5], 'MM draws Tue/Fri');
  });

  it('all registered games define a non-empty schedule (drawDays + draw types)', () => {
    for (const game of gamesRegistry.games) {
      assert.ok(Array.isArray(game.drawDays) && game.drawDays.length > 0, `${game.state}/${game.gameId} must have drawDays`);
      assert.ok(Array.isArray(game.drawTypes) && game.drawTypes.length > 0, `${game.state}/${game.gameId} must have drawTypes`);
    }
  });
});

describe('ING-3 / games.registry: silent retirement health window', () => {
  it('a game silent past its health window evaluates to possible_retired', () => {
    const cash = findGame('FL', 'cash4life')!;
    // CASH4LIFE last observed 2026-02-21; well past a daily game's window.
    assert.equal(evaluateGameStatus(cash, '2026-02-25', { maxSilentDays: 2 }), 'possible_retired');
  });

  it('a game silent but within its health window stays active', () => {
    const cash = findGame('FL', 'cash4life')!;
    assert.equal(evaluateGameStatus(cash, '2026-02-22', { maxSilentDays: 2 }), 'active');
  });

  it('an explicitly retired game stays retired regardless of last observed draw', () => {
    const cash = findGame('FL', 'cash4life')!;
    assert.equal(evaluateGameStatus({ ...cash, status: 'retired' }, '2026-02-22', { maxSilentDays: 2 }), 'retired');
  });

  it('a game with no lastObservedDraw is always active (nothing to flag)', () => {
    const pb = findGame('FL', 'powerball')!;
    assert.equal(evaluateGameStatus(pb, '2026-08-16', { maxSilentDays: 2 }), 'active');
  });
});

describe('ING-3 / games.registry: default health window for CASH4LIFE', () => {
  it('uses a per-game default window when none is provided, flagging CASH4LIFE as possibly retired', () => {
    const cash = findGame('FL', 'cash4life')!;
    assert.equal(evaluateGameStatus(cash, '2026-08-16'), 'possible_retired');
  });
});
