export type TemplateItem = { name: string; description?: string; priceCents: number; category: string };
export type MenuTemplate = { key: string; label: string; cuisine: string; items: TemplateItem[] };

export const MENU_TEMPLATES: MenuTemplate[] = [
  {
    key: "japanese",
    label: "Japanese starter menu",
    cuisine: "Japanese",
    items: [
      { name: "Salmon set", description: "Grilled salmon, rice, and seasonal sides.", priceCents: 1250, category: "Mains" },
      { name: "Chirashi bowl", description: "Assorted sashimi over seasoned sushi rice.", priceCents: 1350, category: "Mains" },
      { name: "Unagi don", description: "Grilled eel glazed in sweet soy, over rice.", priceCents: 1400, category: "Mains" },
      { name: "Chicken katsu curry", description: "Breaded chicken cutlet, Japanese curry sauce, rice.", priceCents: 1150, category: "Mains" },
      { name: "Vegetable gyoza", description: "Pan-fried dumplings, ponzu dipping sauce.", priceCents: 650, category: "Sides" },
      { name: "Miso soup", priceCents: 350, category: "Sides" },
      { name: "Edamame", description: "Steamed soybeans, sea salt.", priceCents: 400, category: "Sides" },
    ],
  },
  {
    key: "italian",
    label: "Italian starter menu",
    cuisine: "Italian",
    items: [
      { name: "Lasagna", description: "Layered pasta, slow-cooked ragù, béchamel.", priceCents: 1100, category: "Mains" },
      { name: "Margherita pizza", description: "San Marzano tomato, mozzarella, basil.", priceCents: 950, category: "Mains" },
      { name: "Spaghetti carbonara", description: "Guanciale, pecorino, egg, black pepper.", priceCents: 1050, category: "Mains" },
      { name: "Chicken parmigiana", description: "Breaded chicken, tomato sauce, melted mozzarella.", priceCents: 1250, category: "Mains" },
      { name: "Caprese salad", description: "Tomato, buffalo mozzarella, basil, olive oil.", priceCents: 650, category: "Sides" },
      { name: "Garlic bread", priceCents: 450, category: "Sides" },
      { name: "Tiramisu", description: "Espresso-soaked sponge, mascarpone, cocoa.", priceCents: 550, category: "Desserts" },
    ],
  },
  {
    key: "indian",
    label: "Indian starter menu",
    cuisine: "Indian",
    items: [
      { name: "Chicken tikka masala", description: "Grilled chicken in a spiced tomato-cream sauce.", priceCents: 1200, category: "Mains" },
      { name: "Lamb rogan josh", description: "Slow-braised lamb, Kashmiri chilli, aromatic spices.", priceCents: 1350, category: "Mains" },
      { name: "Paneer butter masala", description: "Paneer in a rich buttery tomato sauce.", priceCents: 1050, category: "Mains" },
      { name: "Vegetable biryani", description: "Basmati rice layered with spiced vegetables.", priceCents: 1100, category: "Mains" },
      { name: "Garlic naan", priceCents: 350, category: "Sides" },
      { name: "Samosas (2pc)", description: "Crisp pastry, spiced potato and pea filling.", priceCents: 450, category: "Sides" },
      { name: "Mango lassi", priceCents: 400, category: "Drinks" },
    ],
  },
  {
    key: "west-african",
    label: "West African starter menu",
    cuisine: "West African",
    items: [
      { name: "Jollof rice", description: "Smoky tomato-pepper rice, a West African staple.", priceCents: 1100, category: "Mains" },
      { name: "Suya", description: "Grilled spiced beef skewers, suya pepper spice mix.", priceCents: 950, category: "Mains" },
      { name: "Egusi soup", description: "Ground melon seed stew with leafy greens, served with pounded yam.", priceCents: 1250, category: "Mains" },
      { name: "Jollof rice with grilled chicken", description: "Jollof rice served with a grilled chicken thigh.", priceCents: 1350, category: "Mains" },
      { name: "Plantain (fried)", priceCents: 400, category: "Sides" },
      { name: "Puff puff", description: "Lightly sweet fried dough balls.", priceCents: 450, category: "Desserts" },
      { name: "Chin chin", description: "Crunchy sweet fried pastry snack.", priceCents: 350, category: "Desserts" },
    ],
  },
  {
    key: "east-african",
    label: "Ethiopian & East African starter menu",
    cuisine: "Ethiopian",
    items: [
      { name: "Doro wat", description: "Slow-simmered spiced chicken stew, berbere sauce, served with injera.", priceCents: 1300, category: "Mains" },
      { name: "Tibs", description: "Sautéed beef or lamb with onions, peppers, and rosemary.", priceCents: 1250, category: "Mains" },
      { name: "Misir wot", description: "Spiced red lentil stew, a staple vegetarian dish.", priceCents: 950, category: "Mains" },
      { name: "Vegetarian combo", description: "Selection of lentil, cabbage, and collard green sides with injera.", priceCents: 1150, category: "Mains" },
      { name: "Injera (extra)", description: "Traditional sourdough flatbread made from teff.", priceCents: 350, category: "Sides" },
      { name: "Sambusa (3pc)", description: "Crisp pastry filled with spiced lentils or beef.", priceCents: 500, category: "Sides" },
      { name: "Ethiopian coffee", description: "Traditionally brewed, served strong.", priceCents: 300, category: "Drinks" },
    ],
  },
  {
    key: "healthy",
    label: "Healthy / salads starter menu",
    cuisine: "Healthy",
    items: [
      { name: "Grilled chicken Caesar salad", priceCents: 950, category: "Mains" },
      { name: "Quinoa power bowl", priceCents: 1050, category: "Mains" },
      { name: "Falafel wrap", priceCents: 850, category: "Mains" },
      { name: "Poke bowl", priceCents: 1150, category: "Mains" },
      { name: "Avocado toast", priceCents: 750, category: "Sides" },
      { name: "Overnight oats", priceCents: 500, category: "Sides" },
      { name: "Green smoothie", priceCents: 450, category: "Drinks" },
    ],
  },
  {
    key: "burgers",
    label: "Burgers & grill starter menu",
    cuisine: "American",
    items: [
      { name: "Classic cheeseburger", priceCents: 950, category: "Mains" },
      { name: "Bacon BBQ burger", priceCents: 1100, category: "Mains" },
      { name: "Veggie burger", priceCents: 900, category: "Mains" },
      { name: "Loaded fries", priceCents: 550, category: "Sides" },
      { name: "Chicken wings (6pc)", priceCents: 750, category: "Sides" },
      { name: "Onion rings", priceCents: 450, category: "Sides" },
      { name: "Milkshake", priceCents: 500, category: "Drinks" },
    ],
  },
];

export function getTemplate(key: string): MenuTemplate | undefined {
  return MENU_TEMPLATES.find((t) => t.key === key);
}
