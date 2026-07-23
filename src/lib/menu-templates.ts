export type TemplateItem = { name: string; description?: string; priceCents: number };
export type MenuTemplate = { key: string; label: string; cuisine: string; items: TemplateItem[] };

export const MENU_TEMPLATES: MenuTemplate[] = [
  {
    key: "japanese",
    label: "Japanese starter menu",
    cuisine: "Japanese",
    items: [
      { name: "Salmon set", description: "Grilled salmon, rice, and seasonal sides.", priceCents: 1250 },
      { name: "Chirashi bowl", description: "Assorted sashimi over seasoned sushi rice.", priceCents: 1350 },
      { name: "Unagi don", description: "Grilled eel glazed in sweet soy, over rice.", priceCents: 1400 },
      { name: "Chicken katsu curry", description: "Breaded chicken cutlet, Japanese curry sauce, rice.", priceCents: 1150 },
      { name: "Vegetable gyoza", description: "Pan-fried dumplings, ponzu dipping sauce.", priceCents: 650 },
      { name: "Miso soup", priceCents: 350 },
      { name: "Edamame", description: "Steamed soybeans, sea salt.", priceCents: 400 },
    ],
  },
  {
    key: "italian",
    label: "Italian starter menu",
    cuisine: "Italian",
    items: [
      { name: "Lasagna", description: "Layered pasta, slow-cooked ragù, béchamel.", priceCents: 1100 },
      { name: "Margherita pizza", description: "San Marzano tomato, mozzarella, basil.", priceCents: 950 },
      { name: "Spaghetti carbonara", description: "Guanciale, pecorino, egg, black pepper.", priceCents: 1050 },
      { name: "Chicken parmigiana", description: "Breaded chicken, tomato sauce, melted mozzarella.", priceCents: 1250 },
      { name: "Caprese salad", description: "Tomato, buffalo mozzarella, basil, olive oil.", priceCents: 650 },
      { name: "Garlic bread", priceCents: 450 },
      { name: "Tiramisu", description: "Espresso-soaked sponge, mascarpone, cocoa.", priceCents: 550 },
    ],
  },
  {
    key: "indian",
    label: "Indian starter menu",
    cuisine: "Indian",
    items: [
      { name: "Chicken tikka masala", description: "Grilled chicken in a spiced tomato-cream sauce.", priceCents: 1200 },
      { name: "Lamb rogan josh", description: "Slow-braised lamb, Kashmiri chilli, aromatic spices.", priceCents: 1350 },
      { name: "Paneer butter masala", description: "Paneer in a rich buttery tomato sauce.", priceCents: 1050 },
      { name: "Vegetable biryani", description: "Basmati rice layered with spiced vegetables.", priceCents: 1100 },
      { name: "Garlic naan", priceCents: 350 },
      { name: "Samosas (2pc)", description: "Crisp pastry, spiced potato and pea filling.", priceCents: 450 },
      { name: "Mango lassi", priceCents: 400 },
    ],
  },
  {
    key: "west-african",
    label: "West African starter menu",
    cuisine: "West African",
    items: [
      { name: "Jollof rice", description: "Smoky tomato-pepper rice, a West African staple.", priceCents: 1100 },
      { name: "Suya", description: "Grilled spiced beef skewers, suya pepper spice mix.", priceCents: 950 },
      { name: "Egusi soup", description: "Ground melon seed stew with leafy greens, served with pounded yam.", priceCents: 1250 },
      { name: "Puff puff", description: "Lightly sweet fried dough balls.", priceCents: 450 },
      { name: "Jollof rice with grilled chicken", description: "Jollof rice served with a grilled chicken thigh.", priceCents: 1350 },
      { name: "Plantain (fried)", priceCents: 400 },
      { name: "Chin chin", description: "Crunchy sweet fried pastry snack.", priceCents: 350 },
    ],
  },
  {
    key: "east-african",
    label: "Ethiopian & East African starter menu",
    cuisine: "Ethiopian",
    items: [
      { name: "Doro wat", description: "Slow-simmered spiced chicken stew, berbere sauce, served with injera.", priceCents: 1300 },
      { name: "Tibs", description: "Sautéed beef or lamb with onions, peppers, and rosemary.", priceCents: 1250 },
      { name: "Misir wot", description: "Spiced red lentil stew, a staple vegetarian dish.", priceCents: 950 },
      { name: "Vegetarian combo", description: "Selection of lentil, cabbage, and collard green sides with injera.", priceCents: 1150 },
      { name: "Injera (extra)", description: "Traditional sourdough flatbread made from teff.", priceCents: 350 },
      { name: "Sambusa (3pc)", description: "Crisp pastry filled with spiced lentils or beef.", priceCents: 500 },
      { name: "Ethiopian coffee", description: "Traditionally brewed, served strong.", priceCents: 300 },
    ],
  },
  {
    key: "healthy",
    label: "Healthy / salads starter menu",
    cuisine: "Healthy",
    items: [
      { name: "Grilled chicken Caesar salad", priceCents: 950 },
      { name: "Quinoa power bowl", priceCents: 1050 },
      { name: "Falafel wrap", priceCents: 850 },
      { name: "Poke bowl", priceCents: 1150 },
      { name: "Avocado toast", priceCents: 750 },
      { name: "Green smoothie", priceCents: 450 },
      { name: "Overnight oats", priceCents: 500 },
    ],
  },
  {
    key: "burgers",
    label: "Burgers & grill starter menu",
    cuisine: "American",
    items: [
      { name: "Classic cheeseburger", priceCents: 950 },
      { name: "Bacon BBQ burger", priceCents: 1100 },
      { name: "Veggie burger", priceCents: 900 },
      { name: "Loaded fries", priceCents: 550 },
      { name: "Chicken wings (6pc)", priceCents: 750 },
      { name: "Onion rings", priceCents: 450 },
      { name: "Milkshake", priceCents: 500 },
    ],
  },
];

export function getTemplate(key: string): MenuTemplate | undefined {
  return MENU_TEMPLATES.find((t) => t.key === key);
}
