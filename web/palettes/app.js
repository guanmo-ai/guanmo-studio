const templateDirectory = new URL('../../templates/card-carousel/', import.meta.url);

async function readCatalog(name) {
  const response = await fetch(new URL(name, templateDirectory));
  if (!response.ok) throw new Error(`${name} 加载失败`);
  return response.json();
}

export async function additionalStudies() {
  const [{ palettes }, looks] = await Promise.all([readCatalog('front-styles.json'), readCatalog('looks.json')]);
  return palettes.filter(palette => palette.origin === 'look' || palette.origin === 'light').map(palette => {
    const look = looks[palette.id.replace(/^look-/, '')];
    const [face, secondary, edge] = palette.papers;
    return {
      id: `palette-${palette.id}`,
      name: palette.name,
      group: palette.group,
      description: palette.note,
      colors: [look?.stage?.bg ?? palette.light, face, palette.edge ?? edge ?? palette.accent, palette.accent, palette.ink],
      swatches: palette.swatches ?? [palette.light, ...palette.papers, palette.ink],
      secondary,
      material: palette.material,
      backdrop: 'ambient',
    };
  });
}
