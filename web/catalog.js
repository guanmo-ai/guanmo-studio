/** Browsing rules keep archived backgrounds and review states separate. */
export function activeThemes(backgrounds) {
  return backgrounds.filter(theme => !['superseded', 'removed'].includes(theme.status));
}

export function filterThemes(themes, filter = 'all', query = '') {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return themes.filter(theme => {
    if (filter !== 'all' && theme.category !== filter && theme.family !== filter) return false;
    const text = [theme.name, theme.en, theme.description, theme.label, ...(theme.tags || [])].join(' ').toLocaleLowerCase();
    return words.every(word => text.includes(word));
  });
}

export function initialThemeId(backgrounds, requested) {
  const theme = backgrounds.find(item => item.id === requested);
  const active = activeThemes(backgrounds);
  const target = theme?.status === 'superseded' ? theme.replacedBy : requested;
  return active.find(item => item.id === target)?.id || active[0]?.id;
}
