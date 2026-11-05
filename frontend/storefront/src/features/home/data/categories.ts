import type { Category } from '../types';
export const categories: Category[] = [
  {
    id: 'electronics',
    name: 'Electronics',
    hi: 'इलेक्ट्रॉनिक्स',
    image: '/images/home/headphones.jpg',
    children: ['Headphones & audio', 'Smart watches', 'Computers & accessories', 'Cameras'],
  },
  {
    id: 'fashion',
    name: 'Fashion',
    hi: 'फ़ैशन',
    image: '/images/home/sneakers.jpg',
    children: ['Women’s clothing', 'Men’s clothing', 'Footwear', 'Bags & accessories'],
  },
  {
    id: 'home',
    name: 'Home & Living',
    hi: 'घर और जीवनशैली',
    image: '/images/home/chair.jpg',
    children: ['Furniture', 'Kitchen & dining', 'Lighting', 'Home décor'],
  },
  {
    id: 'beauty',
    name: 'Beauty',
    hi: 'ब्यूटी',
    image: '/images/home/skincare.jpg',
    children: ['Skincare', 'Haircare', 'Bath & body', 'Beauty essentials'],
  },
  {
    id: 'grocery',
    name: 'Grocery',
    hi: 'किराना',
    image: '/images/home/coffee.jpg',
    children: ['Tea & coffee', 'Pantry staples', 'Healthy snacks', 'Fresh picks'],
  },
  {
    id: 'sports',
    name: 'Sports & Outdoors',
    hi: 'खेल और आउटडोर',
    image: '/images/home/backpack.jpg',
    children: ['Fitness', 'Travel essentials', 'Outdoor gear', 'Activewear'],
  },
];
