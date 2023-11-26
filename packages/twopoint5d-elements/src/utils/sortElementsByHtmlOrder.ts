class ElementItem {
  container: HTMLElement;
  children: HTMLElement[];

  constructor(container: HTMLElement, children: HTMLElement[] = []) {
    this.container = container;
    this.children = children;
  }

  getParent(): HTMLElement {
    return this.container.parentElement!;
  }
}

interface DepthLayer {
  leafs: ElementItem[];
  depth: number;
}

export function sortElementsByHtmlOrder(root: HTMLElement, elements: HTMLElement[]): HTMLElement[] {
  const layers: DepthLayer[] = [];

  const getDepth = (child: HTMLElement): number => {
    let depth = 0;
    let el = child;
    while (el !== root) {
      depth++;
      el = el.parentElement!;
    }
    return depth;
  };

  const findOrCreateLayer = (depth: number): DepthLayer => {
    if (!layers[depth]) {
      layers[depth] = {leafs: [], depth};
    }
    return layers[depth];
  };

  for (const leaf of elements.map((el) => new ElementItem(el, [el]))) {
    findOrCreateLayer(getDepth(leaf.container)).leafs.push(leaf);
  }

  while (layers.length > 1) {
    const layer = layers.pop();
    if (!layer) continue;

    const parents = new Set<HTMLElement>(layer.leafs.map((leaf) => leaf.getParent()));

    for (const parent of parents) {
      const children = sortByHtmlOrder(
        parent,
        layer.leafs.filter((leaf) => leaf.getParent() === parent),
      );

      findOrCreateLayer(getDepth(parent)).leafs.push(
        new ElementItem(
          parent,
          children.flatMap((leaf) => leaf.children),
        ),
      );
    }
  }

  return layers.length === 1 ? layers[0].leafs.flatMap((leaf) => leaf.children) : [];
}

function sortByHtmlOrder(parent: HTMLElement, children: ElementItem[]): ElementItem[] {
  return Array.from(parent.children)
    .map((el) => children.find((item) => item.container === el))
    .filter(Boolean) as ElementItem[];
}
