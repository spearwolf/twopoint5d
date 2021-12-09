import {Chronometer} from './Chronometer';

describe('Chronometer', () => {
  it('create', () => {
    const chronus = new Chronometer(1975);

    expect(chronus.timeStart).toBe(1975);
    // expect(chronus.currentTime).toBe(1975);
    // expect(chronus.#previousTime).toBe(1975);
    expect(chronus.deltaTime).toBe(0);
    expect(chronus.time).toBe(0);
  });

  it('c, update', () => {
    const chronus = new Chronometer(3000);
    chronus.update(4000);

    expect(chronus.isRunning).toBe(true);
    // expect(chronus.#currentTime).toBe(4000);
    // expect(chronus.#previousTime).toBe(3000);
    expect(chronus.deltaTime).toBe(1000);
    expect(chronus.time).toBe(1000);
    // expect(chronus.#recentyLostTime).toBe(0);
    expect(chronus.lostTime).toBe(0);
  });

  it('c, u, update', () => {
    const chronus = new Chronometer(3000);
    chronus.update(4000);
    chronus.update(4500);

    expect(chronus.isRunning).toBe(true);
    // expect(chronus.#currentTime).toBe(4500);
    // expect(chronus.#previousTime).toBe(4000);
    expect(chronus.deltaTime).toBe(500);
    expect(chronus.time).toBe(1500);
    // expect(chronus.#recentyLostTime).toBe(0);
    expect(chronus.lostTime).toBe(0);
  });

  it('c, u, u, stop', () => {
    const chronus = new Chronometer(3000);
    chronus.update(4000);
    chronus.update(4500);
    chronus.stop();

    expect(chronus.isRunning).toBe(false);
    // expect(chronus.#currentTime).toBe(4500);
    // expect(chronus.#previousTime).toBe(4000);
    expect(chronus.deltaTime).toBe(500);
    expect(chronus.time).toBe(1500);
    // expect(chronus.#recentyLostTime).toBe(0);
    expect(chronus.lostTime).toBe(0);
  });

  it('c, u, u, stop, start', () => {
    const chronus = new Chronometer(3000);
    chronus.update(4000);
    chronus.update(4500);
    chronus.stop();
    chronus.start();

    expect(chronus.isRunning).toBe(true);
    // expect(chronus.#currentTime).toBe(4500);
    // expect(chronus.#previousTime).toBe(4000);
    expect(chronus.deltaTime).toBe(500);
    expect(chronus.time).toBe(1500);
    // expect(chronus.#recentyLostTime).toBe(0);
    expect(chronus.lostTime).toBe(0);
  });

  it('c, u, u, stop, update', () => {
    const chronus = new Chronometer(3000);
    chronus.update(4000);
    chronus.update(4500);
    chronus.stop();
    chronus.update(5200);

    expect(chronus.isRunning).toBe(false);
    // expect(chronus.#currentTime).toBe(5200);
    // expect(chronus.#previousTime).toBe(4500);
    expect(chronus.deltaTime).toBe(500);
    expect(chronus.time).toBe(1500);
    // expect(chronus.#recentyLostTime).toBe(700);
    expect(chronus.lostTime).toBe(700);
  });

  it('c, u, u, stop, u, update', () => {
    const chronus = new Chronometer(3000);
    chronus.update(4000);
    chronus.update(4500);
    chronus.stop();
    chronus.update(5200);
    chronus.update(5350);

    expect(chronus.isRunning).toBe(false);
    // expect(chronus.#currentTime).toBe(5350);
    // expect(chronus.#previousTime).toBe(5200);
    expect(chronus.deltaTime).toBe(500);
    expect(chronus.time).toBe(1500);
    // expect(chronus.#recentyLostTime).toBe(850);
    expect(chronus.lostTime).toBe(850);
  });

  it('c, u, u, stop, u, u, start', () => {
    const chronus = new Chronometer(3000);
    chronus.update(4000);
    chronus.update(4500);
    chronus.stop();
    chronus.update(5200);
    chronus.update(5350);
    chronus.start();

    expect(chronus.isRunning).toBe(true);
    // expect(chronus.#currentTime).toBe(5350);
    // expect(chronus.#previousTime).toBe(5200);
    expect(chronus.deltaTime).toBe(500);
    expect(chronus.time).toBe(1500);
    // expect(chronus.#recentyLostTime).toBe(0);
    expect(chronus.lostTime).toBe(850);
  });

  it('c, u, u, stop, u, u, start, stop', () => {
    const chronus = new Chronometer(3000);
    chronus.update(4000);
    chronus.update(4500);
    chronus.stop();
    chronus.update(5200);
    chronus.update(5350);
    chronus.start();
    chronus.stop();

    expect(chronus.isRunning).toBe(false);
    // expect(chronus.#currentTime).toBe(5350);
    // expect(chronus.#previousTime).toBe(5200);
    expect(chronus.deltaTime).toBe(500);
    expect(chronus.time).toBe(1500);
    // expect(chronus.#recentyLostTime).toBe(0);
    expect(chronus.lostTime).toBe(850);
  });

  it('c, u, u, stop, u, u, start, update', () => {
    const chronus = new Chronometer(3000);
    chronus.update(4000);
    chronus.update(4500);
    chronus.stop();
    chronus.update(5200);
    chronus.update(5350);
    chronus.start();
    chronus.update(6000);

    expect(chronus.isRunning).toBe(true);
    // expect(chronus.#currentTime).toBe(6000);
    // expect(chronus.#previousTime).toBe(5350);
    expect(chronus.deltaTime).toBe(650);
    expect(chronus.time).toBe(2150);
    // expect(chronus.#recentyLostTime).toBe(0);
    expect(chronus.lostTime).toBe(850);
  });

  it('c, u, u, stop, u, u, start, u, update', () => {
    const chronus = new Chronometer(3000);
    chronus.update(4000);
    chronus.update(4500);
    chronus.stop();
    chronus.update(5200);
    chronus.update(5350);
    chronus.start();
    chronus.update(6000);
    chronus.update(6066);

    expect(chronus.isRunning).toBe(true);
    // expect(chronus.#currentTime).toBe(6066);
    // expect(chronus.#previousTime).toBe(6000);
    expect(chronus.deltaTime).toBe(66);
    expect(chronus.time).toBe(2216);
    // expect(chronus.#recentyLostTime).toBe(0);
    expect(chronus.lostTime).toBe(850);
  });
});
