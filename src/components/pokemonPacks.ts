export interface PokemonItem {
  id: string;
  w: number;
  label: string;
  accent: string;
  type: string;
}

export const POKEMON_ITEMS: PokemonItem[] = [
  { id: 'pikachu', w: 94, label: 'Pikachu', accent: '#F2C12E', type: 'ELECTRIC' },
  { id: 'charmander', w: 80, label: 'Charmander', accent: '#EF8A3C', type: 'FIRE' },
  { id: 'squirtle', w: 78, label: 'Squirtle', accent: '#4FA6D6', type: 'WATER' },
  { id: 'bulbasaur', w: 82, label: 'Bulbasaur', accent: '#5FA86A', type: 'GRASS' },
  { id: 'eevee', w: 90, label: 'Eevee', accent: '#C39A6B', type: 'NORMAL' },
  { id: 'jigglypuff', w: 82, label: 'Jigglypuff', accent: '#EE9CBE', type: 'FAIRY' },
  { id: 'meowth', w: 88, label: 'Meowth', accent: '#D9A441', type: 'NORMAL' },
  { id: 'psyduck', w: 76, label: 'Psyduck', accent: '#EAC24A', type: 'WATER' },
  { id: 'snorlax', w: 110, label: 'Snorlax', accent: '#5A7A88', type: 'NORMAL' },
  { id: 'togepi', w: 78, label: 'Togepi', accent: '#D9B85A', type: 'FAIRY' },
  { id: 'mew', w: 78, label: 'Mew', accent: '#E89BBC', type: 'PSYCHIC' }
];

export const POKEMON_META: Record<string, { label: string; accent: string; type: string }> =
  POKEMON_ITEMS.reduce((acc, p) => {
    acc[p.id] = { label: p.label, accent: p.accent, type: p.type };
    return acc;
  }, {} as Record<string, { label: string; accent: string; type: string }>);
