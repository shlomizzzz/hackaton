export type RocketSkinId =
  | "green"
  | "blue"
  | "yellow"
  | "red";

export interface RocketSkin {
  id: RocketSkinId;
  name: string;
  svg: string;
}

const img = (src: string, alt: string) =>
  `<img src="${src}" alt="${alt}" draggable="false" />`;

export const ROCKET_SKINS: RocketSkin[] = [
  { id: "green", name: "Lime Pod", svg: img("/rocket-green.png", "Lime Pod") },
  { id: "blue", name: "Atlas Blue", svg: img("/rocket-blue.png", "Atlas Blue") },
  { id: "yellow", name: "Sunray", svg: img("/rocket-yellow.png", "Sunray") },
  { id: "red", name: "Classic Red", svg: img("/rocket-red.png", "Classic Red") },
];

export const DEFAULT_SKIN_ID: RocketSkinId = "green";

export function getSkin(id: string | null | undefined): RocketSkin {
  const found = ROCKET_SKINS.find((s) => s.id === id);
  return found ?? ROCKET_SKINS[0]!;
}
