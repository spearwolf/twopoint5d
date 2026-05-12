import {describe, expect, it} from 'vitest';
import {Chronometer} from './Chronometer.js';

describe('Chronometer', () => {
  it('create', () => {
    const chronus = new Chronometer(1975);

    expect(chronus.timeStart).toBe(1975);
    expect(chronus.deltaTime).toBe(0);
    expect(chronus.time).toBe(0);
    expect(chronus.isRunning).toBe(true);
    expect(chronus.lostTime).toBe(0);
  });

  it('c, update', () => {
    const chronus = new Chronometer(3000);
    chronus.update(4000);

    expect(chronus.isRunning).toBe(true);
    expect(chronus.deltaTime).toBe(1000);
    expect(chronus.time).toBe(1000);
    expect(chronus.lostTime).toBe(0);
  });

  it('c, u, update', () => {
    const chronus = new Chronometer(3000);
    chronus.update(4000);
    chronus.update(4500);

    expect(chronus.isRunning).toBe(true);
    expect(chronus.deltaTime).toBe(500);
    expect(chronus.time).toBe(1500);
    expect(chronus.lostTime).toBe(0);
  });

  it('c, u, u, stop', () => {
    const chronus = new Chronometer(3000);
    chronus.update(4000);
    chronus.update(4500);
    chronus.stop(4500);

    expect(chronus.isRunning).toBe(false);
    expect(chronus.deltaTime).toBe(500);
    expect(chronus.time).toBe(1500);
    expect(chronus.lostTime).toBe(0);
  });

  it('c, u, u, stop, start — start resets deltaTime to 0', () => {
    const chronus = new Chronometer(3000);
    chronus.update(4000);
    chronus.update(4500);
    chronus.stop(4500);
    chronus.start(4500);

    expect(chronus.isRunning).toBe(true);
    expect(chronus.deltaTime).toBe(0);
    expect(chronus.time).toBe(1500);
    expect(chronus.lostTime).toBe(0);
  });

  it('c, u, u, stop, update', () => {
    const chronus = new Chronometer(3000);
    chronus.update(4000);
    chronus.update(4500);
    chronus.stop(4500);
    chronus.update(5200);

    expect(chronus.isRunning).toBe(false);
    expect(chronus.deltaTime).toBe(500);
    expect(chronus.time).toBe(1500);
    expect(chronus.lostTime).toBe(700);
  });

  it('c, u, u, stop, u, update', () => {
    const chronus = new Chronometer(3000);
    chronus.update(4000);
    chronus.update(4500);
    chronus.stop(4500);
    chronus.update(5200);
    chronus.update(5350);

    expect(chronus.isRunning).toBe(false);
    expect(chronus.deltaTime).toBe(500);
    expect(chronus.time).toBe(1500);
    expect(chronus.lostTime).toBe(850);
  });

  it('c, u, u, stop, u, u, start', () => {
    const chronus = new Chronometer(3000);
    chronus.update(4000);
    chronus.update(4500);
    chronus.stop(4500);
    chronus.update(5200);
    chronus.update(5350);
    chronus.start(5350);

    expect(chronus.isRunning).toBe(true);
    expect(chronus.deltaTime).toBe(0);
    expect(chronus.time).toBe(1500);
    expect(chronus.lostTime).toBe(850);
  });

  it('c, u, u, stop, u, u, start, stop', () => {
    const chronus = new Chronometer(3000);
    chronus.update(4000);
    chronus.update(4500);
    chronus.stop(4500);
    chronus.update(5200);
    chronus.update(5350);
    chronus.start(5350);
    chronus.stop(5350);

    expect(chronus.isRunning).toBe(false);
    expect(chronus.deltaTime).toBe(0);
    expect(chronus.time).toBe(1500);
    expect(chronus.lostTime).toBe(850);
  });

  it('c, u, u, stop, u, u, start, update', () => {
    const chronus = new Chronometer(3000);
    chronus.update(4000);
    chronus.update(4500);
    chronus.stop(4500);
    chronus.update(5200);
    chronus.update(5350);
    chronus.start(5350);
    chronus.update(6000);

    expect(chronus.isRunning).toBe(true);
    expect(chronus.deltaTime).toBe(650);
    expect(chronus.time).toBe(2150);
    expect(chronus.lostTime).toBe(850);
  });

  it('c, u, u, stop, u, u, start, u, update', () => {
    const chronus = new Chronometer(3000);
    chronus.update(4000);
    chronus.update(4500);
    chronus.stop(4500);
    chronus.update(5200);
    chronus.update(5350);
    chronus.start(5350);
    chronus.update(6000);
    chronus.update(6066);

    expect(chronus.isRunning).toBe(true);
    expect(chronus.deltaTime).toBe(66);
    expect(chronus.time).toBe(2216);
    expect(chronus.lostTime).toBe(850);
  });

  describe('pause without update() during the pause', () => {
    it('start() closes the wall-clock gap in lostTime — no frame spike on the next update()', () => {
      const chronus = new Chronometer(3000);
      chronus.update(4000);
      chronus.stop(4000);
      // wall-clock advances by 10000 units, no update() during the pause
      chronus.start(14000);
      chronus.update(14100);

      expect(chronus.isRunning).toBe(true);
      expect(chronus.deltaTime).toBe(100);
      expect(chronus.time).toBe(1100);
      expect(chronus.lostTime).toBe(10000);
    });

    it('stop()/start() with the same timestamp is a zero-length pause', () => {
      const chronus = new Chronometer(1000);
      chronus.stop(1500);
      chronus.start(1500);
      chronus.update(2000);

      expect(chronus.time).toBe(1000);
      expect(chronus.deltaTime).toBe(500);
      expect(chronus.lostTime).toBe(0);
    });

    it('hybrid pause: some update()s during pause, then idle wall-clock, then start()', () => {
      const chronus = new Chronometer(0);
      chronus.update(1);
      chronus.stop(1);
      chronus.update(2); //   recentlyLostTime tick: +1
      chronus.update(3); //   recentlyLostTime tick: +1 (total 2)
      // 5 more units of wall-clock with no update()
      chronus.start(8);
      chronus.update(9);

      expect(chronus.deltaTime).toBe(1);
      expect(chronus.lostTime).toBe(7);
      expect(chronus.time).toBe(2);
    });
  });

  describe('idempotency', () => {
    it('stop() while already stopped does not overwrite pausedAt', () => {
      const chronus = new Chronometer(0);
      chronus.update(1);
      chronus.stop(1);
      chronus.stop(5); // no-op: pausedAt stays at 1
      chronus.start(10);
      chronus.update(11);

      expect(chronus.lostTime).toBe(9);
    });

    it('start() while already running is a no-op', () => {
      const chronus = new Chronometer(0);
      chronus.update(1);
      chronus.start(5); // no-op: already running
      chronus.update(2);

      expect(chronus.deltaTime).toBe(1);
      expect(chronus.time).toBe(2);
      expect(chronus.lostTime).toBe(0);
    });
  });

  describe('maxDeltaTime', () => {
    it('clamps the per-update delta and folds the overflow into lostTime', () => {
      const chronus = new Chronometer(0, 100);
      chronus.update(50);
      expect(chronus.deltaTime).toBe(50);
      expect(chronus.lostTime).toBe(0);

      chronus.update(500); // raw delta would be 450
      expect(chronus.deltaTime).toBe(100);
      expect(chronus.lostTime).toBe(350);
      expect(chronus.time).toBe(150);
    });

    it('maxDeltaTime = 0 disables clamping', () => {
      const chronus = new Chronometer(0, 0);
      chronus.update(10000);

      expect(chronus.deltaTime).toBe(10000);
      expect(chronus.lostTime).toBe(0);
      expect(chronus.time).toBe(10000);
    });

    it('maxDeltaTime can be set after construction', () => {
      const chronus = new Chronometer(0);
      chronus.maxDeltaTime = 50;
      chronus.update(1000);

      expect(chronus.deltaTime).toBe(50);
      expect(chronus.lostTime).toBe(950);
    });
  });

  describe('reset()', () => {
    it('returns the chronometer to its initial state', () => {
      const chronus = new Chronometer(0);
      chronus.update(100);
      chronus.stop(100);
      chronus.start(200);
      chronus.update(300);

      chronus.reset(1000);

      expect(chronus.timeStart).toBe(1000);
      expect(chronus.time).toBe(0);
      expect(chronus.deltaTime).toBe(0);
      expect(chronus.lostTime).toBe(0);
      expect(chronus.isRunning).toBe(true);
    });

    it('preserves maxDeltaTime', () => {
      const chronus = new Chronometer(0, 50);
      chronus.update(200);
      chronus.reset(0);
      chronus.update(1000);

      expect(chronus.deltaTime).toBe(50);
    });
  });
});
