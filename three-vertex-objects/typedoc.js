// eslint-disable-next-line no-undef
module.exports = {
  entryPoints: ['./src/index.ts'],
  excludeExternals: true,
  excludeInternal: true,
  excludePrivate: true,
  out: 'build/docs',
  theme: 'default',
  categoryOrder: [
    'Vertex Objects',
    'Texture Mapping',
    'Projection',
    '*',
    'Other',
  ],
};
