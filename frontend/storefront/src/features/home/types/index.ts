export interface Category {
  id: string;
  name: string;
  hi: string;
  image: string;
  children: string[];
}
export interface Product {
  id: string;
  name: string;
  category: string;
  image: string;
  price: number;
  originalPrice: number;
  rating: string;
  seller: string;
  isPlatformOwned: boolean;
  badge?: string;
}
export interface Banner {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  cta: string;
  image: string;
  href: string;
}
export interface Store {
  id: string;
  name: string;
  initials: string;
  description: string;
  score: string;
  image: string;
}
export interface Seller {
  id: string;
  name: string;
  initials: string;
  location: string;
  category: string;
}
