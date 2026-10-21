/** The data of the dungeon screen: who is in the party, what is in the bag, who says what. */

export interface PartyMemberData {
  /** The portrait under `public/assets/ui-panels/portraits/<id>.png`, and the name of its frames. */
  id: string;
  name: string;
  maxHp: number;
  maxMp: number;
}

export const PARTY: readonly PartyMemberData[] = [
  {id: 'knight', name: 'SIGRUN', maxHp: 42, maxMp: 8},
  {id: 'rogue', name: 'VEX', maxHp: 28, maxMp: 12},
  {id: 'witch', name: 'MORWEN', maxHp: 22, maxMp: 36},
  {id: 'wizard', name: 'ALDRIC', maxHp: 20, maxMp: 40},
  {id: 'ranger', name: 'LIRAEL', maxHp: 30, maxMp: 16},
  {id: 'barbarian', name: 'BRAKKA', maxHp: 54, maxMp: 4},
];

export interface ItemData {
  /** A frame of `icons.json`. */
  icon: string;
  name: string;
}

/** The bag, slot by slot; `null` is an empty slot. */
export const INVENTORY: readonly (ItemData | null)[] = [
  {icon: 'icon-sword', name: 'Ember Sword'},
  {icon: 'icon-axe', name: 'Bearded Axe'},
  {icon: 'icon-shield', name: 'Oak Shield'},
  {icon: 'icon-helmet', name: 'Horned Helm'},
  {icon: 'icon-ring', name: 'Ring of Echoes'},
  {icon: 'icon-gem', name: 'Moon Opal'},
  {icon: 'icon-potion-red', name: 'Healing Draught'},
  {icon: 'icon-potion-blue', name: 'Mana Tonic'},
  {icon: 'icon-potion-green', name: 'Antidote'},
  {icon: 'icon-key', name: 'Crypt Key'},
  {icon: 'icon-scroll', name: 'Scroll of Light'},
  {icon: 'icon-book', name: 'Grimoire'},
  {icon: 'icon-bomb', name: 'Black Powder Bomb'},
  {icon: 'icon-torch', name: 'Torch'},
  {icon: 'icon-apple', name: 'Last Apple'},
  {icon: 'icon-heart', name: 'Heart Container'},
  {icon: 'icon-skull', name: 'Cursed Skull'},
  {icon: 'icon-coin', name: 'Lucky Coin'},
  null,
  {icon: 'icon-potion-red', name: 'Healing Draught'},
  null,
  null,
  {icon: 'icon-torch', name: 'Torch'},
  null,
];

export const INVENTORY_COLUMNS = 6;
export const INVENTORY_ROWS = 4;

export interface DialogLine {
  /** The id of the party member who speaks. */
  speaker: string;
  text: string;
}

export const DIALOG: readonly DialogLine[] = [
  {speaker: 'knight', text: 'Stay close. The crypt eats the careless, and I am not carrying anyone out of here twice.'},
  {speaker: 'rogue', text: 'Relax. I already picked the lock, the pocket of the guard and the best seat by the fire.'},
  {speaker: 'witch', text: 'The torches burn green down here. Something old is awake below us... and it is hungry.'},
  {speaker: 'wizard', text: 'Nonsense. A curse of the ninth circle, nothing more. Probably. Hand me the blue potion.'},
  {speaker: 'ranger', text: 'Footprints. Six pairs, all of them walking backwards. I will take point.'},
  {speaker: 'barbarian', text: 'Less talking, more smashing! And who ate the last apple? It was in the bag a minute ago!'},
];

export const TITLE = 'THE SUNKEN CRYPT - DEPTH 3';

export const QUEST =
  'QUEST: Find the Lost Crown of Ys before the candles burn down. The crypt shifts its corridors at every bell, ' +
  'so keep the map dry, the torches lit and the barbarian away from the levers.';
