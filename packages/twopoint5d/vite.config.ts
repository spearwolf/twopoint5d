import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    // Die Suite liegt in den Quellen: eine Spec heißt `*.spec.ts` und steht neben
    // ihrem Modul. Das Muster ist deshalb auf `src/` festgenagelt statt auf den
    // Standard-Glob — kompilierte Ausgabe unter `dist/` trägt dieselben Specs als
    // `.js` und darf nicht mitgesammelt werden.
    include: ['src/**/*.spec.ts'],
  },
});
