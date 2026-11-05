import { products } from './products';
/** A static frontend rule: prefer the last viewed category, then fill with other picks. */
export function getRecommendations(recentIds: string[]) {
  const category = products.find((product) => product.id === recentIds[0])?.category;
  return [...products]
    .sort((a, b) => Number(b.category === category) - Number(a.category === category))
    .slice(0, 5);
}
