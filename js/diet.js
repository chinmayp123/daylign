// ========== Diet ==========
const FOOD_DATABASE = {
  // Proteins
  'chicken breast': { calories: 165, protein: 31, carbs: 0, fat: 3.6, serving: '100g', fiber: 0, sugar: 0 },
  'chicken thigh': { calories: 209, protein: 26, carbs: 0, fat: 11, serving: '100g', fiber: 0, sugar: 0 },
  'chicken wing': { calories: 203, protein: 30, carbs: 0, fat: 8, serving: '100g', fiber: 0, sugar: 0 },
  'chicken drumstick': { calories: 172, protein: 28, carbs: 0, fat: 6, serving: '100g', fiber: 0, sugar: 0 },
  'grilled chicken': { calories: 165, protein: 31, carbs: 0, fat: 3.6, serving: '100g', fiber: 0, sugar: 0 },
  'rotisserie chicken': { calories: 190, protein: 25, carbs: 0, fat: 10, serving: '100g', fiber: 0, sugar: 0 },
  'turkey breast': { calories: 135, protein: 30, carbs: 0, fat: 1, serving: '100g', fiber: 0, sugar: 0 },
  'ground turkey': { calories: 170, protein: 21, carbs: 0, fat: 9, serving: '100g', fiber: 0, sugar: 0 },
  'steak': { calories: 271, protein: 26, carbs: 0, fat: 18, serving: '100g (sirloin)', fiber: 0, sugar: 0 },
  'ribeye': { calories: 291, protein: 24, carbs: 0, fat: 21, serving: '100g', fiber: 0, sugar: 0 },
  'filet mignon': { calories: 267, protein: 26, carbs: 0, fat: 17, serving: '100g', fiber: 0, sugar: 0 },
  'ground beef': { calories: 254, protein: 17, carbs: 0, fat: 20, serving: '100g (80/20)', fiber: 0, sugar: 0 },
  'ground beef lean': { calories: 176, protein: 20, carbs: 0, fat: 10, serving: '100g (90/10)', fiber: 0, sugar: 0 },
  'pork chop': { calories: 231, protein: 25, carbs: 0, fat: 14, serving: '100g', fiber: 0, sugar: 0 },
  'pork tenderloin': { calories: 143, protein: 26, carbs: 0, fat: 3.5, serving: '100g', fiber: 0, sugar: 0 },
  'pulled pork': { calories: 210, protein: 26, carbs: 2, fat: 10, serving: '100g', fiber: 0, sugar: 1 },
  'lamb': { calories: 258, protein: 25, carbs: 0, fat: 17, serving: '100g', fiber: 0, sugar: 0 },
  'bison': { calories: 143, protein: 28, carbs: 0, fat: 2.4, serving: '100g', fiber: 0, sugar: 0 },
  'venison': { calories: 158, protein: 30, carbs: 0, fat: 3.2, serving: '100g', fiber: 0, sugar: 0 },
  'salmon': { calories: 208, protein: 20, carbs: 0, fat: 13, serving: '100g (Atlantic)', fiber: 0, sugar: 0 },
  'tuna': { calories: 132, protein: 28, carbs: 0, fat: 1, serving: '1 can drained (142g)', fiber: 0, sugar: 0 },
  'tuna steak': { calories: 144, protein: 23, carbs: 0, fat: 5, serving: '100g', fiber: 0, sugar: 0 },
  'shrimp': { calories: 99, protein: 24, carbs: 0.2, fat: 0.3, serving: '100g', fiber: 0, sugar: 0 },
  'tilapia': { calories: 128, protein: 26, carbs: 0, fat: 2.7, serving: '1 fillet (113g)', fiber: 0, sugar: 0 },
  'cod': { calories: 82, protein: 18, carbs: 0, fat: 0.7, serving: '100g', fiber: 0, sugar: 0 },
  'sardines': { calories: 208, protein: 25, carbs: 0, fat: 11, serving: '1 can (92g)', fiber: 0, sugar: 0 },
  'crab': { calories: 97, protein: 19, carbs: 0, fat: 1.5, serving: '100g', fiber: 0, sugar: 0 },
  'lobster': { calories: 89, protein: 19, carbs: 0, fat: 0.9, serving: '100g', fiber: 0, sugar: 0 },
  'scallops': { calories: 111, protein: 20, carbs: 5, fat: 0.8, serving: '100g', fiber: 0, sugar: 0 },
  'bacon': { calories: 43, protein: 3, carbs: 0, fat: 3.3, serving: '1 slice (8g)', fiber: 0, sugar: 0 },
  'sausage': { calories: 170, protein: 9, carbs: 1, fat: 14, serving: '1 link (67g)', fiber: 0, sugar: 0 },
  'pepperoni': { calories: 494, protein: 22, carbs: 0, fat: 44, serving: '100g', fiber: 0, sugar: 0 },
  'ham': { calories: 145, protein: 21, carbs: 1.5, fat: 6, serving: '100g', fiber: 0, sugar: 0 },
  'hot dog': { calories: 290, protein: 10, carbs: 2, fat: 26, serving: '1 frank (57g)', fiber: 0, sugar: 0 },
  'egg': { calories: 72, protein: 6.3, carbs: 0.4, fat: 4.8, serving: '1 large', fiber: 0, sugar: 0.2 },
  'eggs': { calories: 72, protein: 6.3, carbs: 0.4, fat: 4.8, serving: '1 large', fiber: 0, sugar: 0.2 },
  'egg whites': { calories: 17, protein: 3.6, carbs: 0.2, fat: 0.1, serving: '1 large white', fiber: 0, sugar: 0.2 },
  'hard boiled egg': { calories: 78, protein: 6.3, carbs: 0.6, fat: 5.3, serving: '1 large', fiber: 0, sugar: 0.6 },
  'tofu': { calories: 144, protein: 17, carbs: 3.5, fat: 8.7, serving: '1/2 block (126g)', fiber: 2, sugar: 0 },
  'tempeh': { calories: 192, protein: 20, carbs: 8, fat: 11, serving: '100g', fiber: 5, sugar: 0 },
  'protein shake': { calories: 120, protein: 24, carbs: 3, fat: 1.5, serving: '1 scoop (30g)', fiber: 0, sugar: 1 },
  'whey protein': { calories: 120, protein: 24, carbs: 3, fat: 1.5, serving: '1 scoop (30g)', fiber: 0, sugar: 1 },
  'protein bar': { calories: 220, protein: 20, carbs: 25, fat: 8, serving: '1 bar (60g)', fiber: 3, sugar: 6 },

  // Grains & Carbs
  'white rice': { calories: 206, protein: 4.3, carbs: 45, fat: 0.4, serving: '1 cup cooked', fiber: 0.6, sugar: 0 },
  'brown rice': { calories: 216, protein: 5, carbs: 45, fat: 1.8, serving: '1 cup cooked', fiber: 3.5, sugar: 0.7 },
  'jasmine rice': { calories: 205, protein: 4.2, carbs: 45, fat: 0.4, serving: '1 cup cooked', fiber: 0.6, sugar: 0 },
  'quinoa': { calories: 222, protein: 8.1, carbs: 39, fat: 3.6, serving: '1 cup cooked', fiber: 5, sugar: 1.6 },
  'oatmeal': { calories: 154, protein: 5.3, carbs: 27, fat: 2.6, serving: '1 cup cooked', fiber: 4, sugar: 1.1 },
  'oats': { calories: 154, protein: 5.3, carbs: 27, fat: 2.6, serving: '1/2 cup dry', fiber: 4, sugar: 1.1 },
  'pasta': { calories: 220, protein: 8, carbs: 43, fat: 1.3, serving: '1 cup cooked', fiber: 2.5, sugar: 0.8 },
  'spaghetti': { calories: 220, protein: 8, carbs: 43, fat: 1.3, serving: '1 cup cooked', fiber: 2.5, sugar: 0.8 },
  'bread': { calories: 79, protein: 2.7, carbs: 15, fat: 1, serving: '1 slice', fiber: 0.6, sugar: 1.5 },
  'wheat bread': { calories: 81, protein: 4, carbs: 14, fat: 1.1, serving: '1 slice', fiber: 1.9, sugar: 1.4 },
  'bagel': { calories: 270, protein: 10, carbs: 53, fat: 1.6, serving: '1 medium', fiber: 2, sugar: 6 },
  'english muffin': { calories: 132, protein: 5, carbs: 26, fat: 1, serving: '1 muffin', fiber: 2, sugar: 2 },
  'tortilla': { calories: 120, protein: 3, carbs: 20, fat: 3, serving: '1 medium (45g)', fiber: 1, sugar: 0.5 },
  'tortilla chips': { calories: 140, protein: 2, carbs: 18, fat: 7, serving: '1 oz (28g)', fiber: 1, sugar: 0.3 },
  'pancakes': { calories: 227, protein: 6.4, carbs: 28, fat: 10, serving: '2 medium', fiber: 1, sugar: 5 },
  'waffle': { calories: 218, protein: 5.6, carbs: 25, fat: 11, serving: '1 medium', fiber: 0.8, sugar: 3 },
  'cereal': { calories: 110, protein: 2, carbs: 25, fat: 0.5, serving: '1 cup (30g)', fiber: 3, sugar: 9 },
  'honey bunches of oats': { calories: 160, protein: 3, carbs: 33, fat: 2.5, serving: '3/4 cup (42g)', fiber: 2, sugar: 12 },
  'cheerios': { calories: 100, protein: 3, carbs: 20, fat: 2, serving: '1 cup (28g)', fiber: 3, sugar: 1 },
  'frosted flakes': { calories: 130, protein: 1, carbs: 32, fat: 0, serving: '3/4 cup (30g)', fiber: 0, sugar: 12 },
  'cinnamon toast crunch': { calories: 130, protein: 1, carbs: 25, fat: 3.5, serving: '3/4 cup (31g)', fiber: 1, sugar: 12 },
  'special k': { calories: 120, protein: 7, carbs: 23, fat: 0.5, serving: '1 cup (31g)', fiber: 1, sugar: 4 },
  'granola': { calories: 210, protein: 5, carbs: 29, fat: 9, serving: '1/2 cup (50g)', fiber: 3, sugar: 11 },
  'crackers': { calories: 130, protein: 3, carbs: 22, fat: 3.5, serving: '5 crackers (30g)', fiber: 1, sugar: 0 },
  'croissant': { calories: 231, protein: 5, carbs: 26, fat: 12, serving: '1 medium', fiber: 1.5, sugar: 5 },
  'cornbread': { calories: 173, protein: 4, carbs: 28, fat: 5, serving: '1 piece', fiber: 1, sugar: 7 },
  'couscous': { calories: 176, protein: 6, carbs: 36, fat: 0.3, serving: '1 cup cooked', fiber: 2, sugar: 0.2 },
  'naan': { calories: 262, protein: 8.7, carbs: 45, fat: 5.1, serving: '1 piece', fiber: 2, sugar: 3 },
  'pita': { calories: 165, protein: 5.5, carbs: 33, fat: 0.7, serving: '1 large', fiber: 1.3, sugar: 0.7 },

  // Vegetables
  'broccoli': { calories: 55, protein: 3.7, carbs: 11, fat: 0.6, serving: '1 cup', fiber: 5.1, sugar: 2.2 },
  'spinach': { calories: 7, protein: 0.9, carbs: 1.1, fat: 0.1, serving: '1 cup raw', fiber: 0.7, sugar: 0.1 },
  'sweet potato': { calories: 103, protein: 2.3, carbs: 24, fat: 0.1, serving: '1 medium (114g)', fiber: 3.8, sugar: 7.4 },
  'potato': { calories: 161, protein: 4.3, carbs: 37, fat: 0.2, serving: '1 medium (150g)', fiber: 3.8, sugar: 1.7 },
  'baked potato': { calories: 161, protein: 4.3, carbs: 37, fat: 0.2, serving: '1 medium (150g)', fiber: 3.8, sugar: 1.7 },
  'mashed potatoes': { calories: 174, protein: 3.4, carbs: 24, fat: 8, serving: '1 cup', fiber: 2, sugar: 2.5 },
  'corn': { calories: 96, protein: 3.4, carbs: 21, fat: 1.5, serving: '1 ear', fiber: 2.4, sugar: 5 },
  'green beans': { calories: 31, protein: 1.8, carbs: 7, fat: 0.2, serving: '1 cup', fiber: 2.7, sugar: 3.3 },
  'peas': { calories: 118, protein: 8, carbs: 21, fat: 0.6, serving: '1 cup', fiber: 8.8, sugar: 8.2 },
  'asparagus': { calories: 27, protein: 3, carbs: 5.2, fat: 0.2, serving: '1 cup', fiber: 2.8, sugar: 2.5 },
  'bell pepper': { calories: 31, protein: 1, carbs: 6, fat: 0.3, serving: '1 medium', fiber: 2.1, sugar: 4.2 },
  'carrot': { calories: 25, protein: 0.6, carbs: 6, fat: 0.1, serving: '1 medium', fiber: 1.7, sugar: 2.9 },
  'cucumber': { calories: 16, protein: 0.7, carbs: 3.6, fat: 0.1, serving: '1 cup sliced', fiber: 0.5, sugar: 1.7 },
  'tomato': { calories: 22, protein: 1.1, carbs: 4.8, fat: 0.2, serving: '1 medium', fiber: 1.5, sugar: 3.2 },
  'onion': { calories: 44, protein: 1.2, carbs: 10, fat: 0.1, serving: '1 medium', fiber: 1.9, sugar: 4.7 },
  'mushrooms': { calories: 15, protein: 2.2, carbs: 2.3, fat: 0.2, serving: '1 cup sliced', fiber: 0.7, sugar: 1.4 },
  'lettuce': { calories: 5, protein: 0.5, carbs: 1, fat: 0.1, serving: '1 cup shredded', fiber: 0.5, sugar: 0.4 },
  'kale': { calories: 33, protein: 2.9, carbs: 6, fat: 0.6, serving: '1 cup', fiber: 1.3, sugar: 0 },
  'cauliflower': { calories: 25, protein: 2, carbs: 5, fat: 0.3, serving: '1 cup', fiber: 2, sugar: 1.9 },
  'zucchini': { calories: 17, protein: 1.2, carbs: 3.1, fat: 0.3, serving: '1 cup', fiber: 1, sugar: 2.5 },
  'cabbage': { calories: 22, protein: 1.3, carbs: 5.2, fat: 0.1, serving: '1 cup shredded', fiber: 2.1, sugar: 2.9 },
  'brussels sprouts': { calories: 56, protein: 3.4, carbs: 11, fat: 0.8, serving: '1 cup', fiber: 4.1, sugar: 2.7 },
  'celery': { calories: 6, protein: 0.3, carbs: 1.2, fat: 0.1, serving: '1 stalk', fiber: 0.6, sugar: 0.5 },
  'edamame': { calories: 188, protein: 18, carbs: 14, fat: 8, serving: '1 cup shelled', fiber: 8, sugar: 3.4 },
  'salad': { calories: 20, protein: 1.5, carbs: 3.5, fat: 0.2, serving: '2 cups mixed greens', fiber: 2, sugar: 1 },
  'beetroot': { calories: 43, protein: 1.6, carbs: 10, fat: 0.2, serving: '1 medium (82g)', fiber: 2, sugar: 6.8 },
  'beet root': { calories: 43, protein: 1.6, carbs: 10, fat: 0.2, serving: '1 medium (82g)', fiber: 2, sugar: 6.8 },
  'beets': { calories: 43, protein: 1.6, carbs: 10, fat: 0.2, serving: '1 medium (82g)', fiber: 2, sugar: 6.8 },
  'radish': { calories: 19, protein: 0.8, carbs: 4, fat: 0.1, serving: '1 cup sliced', fiber: 1.9, sugar: 2.2 },
  'turnip': { calories: 36, protein: 1.2, carbs: 8, fat: 0.1, serving: '1 medium (122g)', fiber: 2.3, sugar: 4.9 },
  'parsnip': { calories: 100, protein: 1.6, carbs: 24, fat: 0.4, serving: '1 medium (133g)', fiber: 6.5, sugar: 6.4 },
  'eggplant': { calories: 20, protein: 0.8, carbs: 5, fat: 0.2, serving: '1 cup cubed', fiber: 2.5, sugar: 2.9 },
  'artichoke': { calories: 60, protein: 3.5, carbs: 13, fat: 0.2, serving: '1 medium', fiber: 6.9, sugar: 1.3 },
  'okra': { calories: 33, protein: 1.9, carbs: 7, fat: 0.2, serving: '1 cup', fiber: 3.2, sugar: 1.5 },
  'arugula': { calories: 5, protein: 0.5, carbs: 0.7, fat: 0.1, serving: '1 cup', fiber: 0.3, sugar: 0.4 },
  'bok choy': { calories: 9, protein: 1, carbs: 1.5, fat: 0.1, serving: '1 cup shredded', fiber: 0.7, sugar: 0.8 },
  'collard greens': { calories: 12, protein: 1, carbs: 2, fat: 0.2, serving: '1 cup', fiber: 1.4, sugar: 0.2 },
  'swiss chard': { calories: 7, protein: 0.6, carbs: 1.4, fat: 0.1, serving: '1 cup', fiber: 0.6, sugar: 0.4 },
  'watercress': { calories: 4, protein: 0.8, carbs: 0.4, fat: 0, serving: '1 cup', fiber: 0.2, sugar: 0.1 },
  'jalapeno': { calories: 4, protein: 0.1, carbs: 0.9, fat: 0, serving: '1 pepper', fiber: 0.4, sugar: 0.6 },
  'garlic': { calories: 4, protein: 0.2, carbs: 1, fat: 0, serving: '1 clove', fiber: 0.1, sugar: 0 },
  'ginger': { calories: 2, protein: 0, carbs: 0.4, fat: 0, serving: '1 tsp grated', fiber: 0.1, sugar: 0 },
  'snap peas': { calories: 41, protein: 2.7, carbs: 7.4, fat: 0.2, serving: '1 cup', fiber: 2.6, sugar: 4 },
  'butternut squash': { calories: 63, protein: 1.4, carbs: 16, fat: 0.1, serving: '1 cup cubed', fiber: 2.8, sugar: 3 },
  'acorn squash': { calories: 56, protein: 1.1, carbs: 15, fat: 0.1, serving: '1 cup cubed', fiber: 2.1, sugar: 0 },
  'spaghetti squash': { calories: 42, protein: 1, carbs: 10, fat: 0.4, serving: '1 cup', fiber: 2.2, sugar: 3.9 },
  'leek': { calories: 54, protein: 1.3, carbs: 13, fat: 0.3, serving: '1 medium', fiber: 1.6, sugar: 3.5 },
  'green onion': { calories: 5, protein: 0.3, carbs: 1.1, fat: 0, serving: '1 stalk', fiber: 0.4, sugar: 0.4 },
  'fennel': { calories: 27, protein: 1, carbs: 6, fat: 0.2, serving: '1 cup sliced', fiber: 2.7, sugar: 3.4 },
  'jicama': { calories: 46, protein: 0.9, carbs: 11, fat: 0.1, serving: '1 cup', fiber: 5.9, sugar: 2.2 },
  'daikon': { calories: 18, protein: 0.6, carbs: 4, fat: 0.1, serving: '1 cup', fiber: 1.6, sugar: 2.5 },
  'bamboo shoots': { calories: 41, protein: 3.9, carbs: 7.9, fat: 0.5, serving: '1 cup', fiber: 3.3, sugar: 4.5 },
  'water chestnuts': { calories: 60, protein: 0.9, carbs: 15, fat: 0.1, serving: '1/2 cup sliced', fiber: 1.8, sugar: 3 },
  'taro': { calories: 187, protein: 0.7, carbs: 46, fat: 0.1, serving: '1 cup', fiber: 6.7, sugar: 0.7 },
  'yam': { calories: 158, protein: 2, carbs: 38, fat: 0.2, serving: '1 cup cubed', fiber: 5.3, sugar: 0.7 },
  'plantain': { calories: 181, protein: 1.9, carbs: 47, fat: 0.5, serving: '1 medium', fiber: 3.4, sugar: 22 },

  // Fruits
  'banana': { calories: 105, protein: 1.3, carbs: 27, fat: 0.4, serving: '1 medium (118g)', fiber: 3.1, sugar: 14 },
  'apple': { calories: 95, protein: 0.5, carbs: 25, fat: 0.3, serving: '1 medium (182g)', fiber: 4.4, sugar: 19 },
  'orange': { calories: 62, protein: 1.2, carbs: 15, fat: 0.2, serving: '1 medium', fiber: 3.1, sugar: 12 },
  'strawberries': { calories: 49, protein: 1, carbs: 12, fat: 0.5, serving: '1 cup', fiber: 3, sugar: 7.4 },
  'blueberries': { calories: 84, protein: 1.1, carbs: 21, fat: 0.5, serving: '1 cup', fiber: 3.6, sugar: 15 },
  'grapes': { calories: 104, protein: 1.1, carbs: 27, fat: 0.2, serving: '1 cup', fiber: 1.4, sugar: 23 },
  'watermelon': { calories: 46, protein: 0.9, carbs: 12, fat: 0.2, serving: '1 cup diced', fiber: 0.6, sugar: 9.4 },
  'mango': { calories: 99, protein: 1.4, carbs: 25, fat: 0.6, serving: '1 cup', fiber: 2.6, sugar: 23 },
  'pineapple': { calories: 82, protein: 0.9, carbs: 22, fat: 0.2, serving: '1 cup', fiber: 2.3, sugar: 16 },
  'peach': { calories: 59, protein: 1.4, carbs: 14, fat: 0.4, serving: '1 medium', fiber: 2.3, sugar: 13 },
  'pear': { calories: 101, protein: 0.6, carbs: 27, fat: 0.2, serving: '1 medium', fiber: 5.5, sugar: 17 },
  'avocado': { calories: 240, protein: 3, carbs: 12, fat: 22, serving: '1 whole (150g)', fiber: 10, sugar: 1 },
  'cherries': { calories: 87, protein: 1.5, carbs: 22, fat: 0.3, serving: '1 cup', fiber: 2.9, sugar: 18 },
  'kiwi': { calories: 42, protein: 0.8, carbs: 10, fat: 0.4, serving: '1 medium', fiber: 2.1, sugar: 6.2 },
  'raspberries': { calories: 64, protein: 1.5, carbs: 15, fat: 0.8, serving: '1 cup', fiber: 8, sugar: 5.4 },
  'cantaloupe': { calories: 54, protein: 1.3, carbs: 13, fat: 0.3, serving: '1 cup diced', fiber: 1.4, sugar: 12 },
  'grapefruit': { calories: 52, protein: 1, carbs: 13, fat: 0.2, serving: '1/2 medium', fiber: 2, sugar: 8.5 },
  'dried cranberries': { calories: 123, protein: 0.1, carbs: 33, fat: 0.4, serving: '1/4 cup', fiber: 2.3, sugar: 29 },
  'raisins': { calories: 129, protein: 1.3, carbs: 34, fat: 0.2, serving: '1/4 cup', fiber: 1.6, sugar: 25 },
  'dates': { calories: 66, protein: 0.4, carbs: 18, fat: 0, serving: '1 date (24g)', fiber: 1.6, sugar: 16 },

  // Dairy
  'milk': { calories: 149, protein: 8, carbs: 12, fat: 8, serving: '1 cup whole', fiber: 0, sugar: 12 },
  'whole milk': { calories: 149, protein: 8, carbs: 12, fat: 8, serving: '1 cup', fiber: 0, sugar: 12 },
  'skim milk': { calories: 83, protein: 8.3, carbs: 12, fat: 0.2, serving: '1 cup', fiber: 0, sugar: 12 },
  '2% milk': { calories: 122, protein: 8.1, carbs: 12, fat: 4.8, serving: '1 cup', fiber: 0, sugar: 12 },
  'almond milk': { calories: 30, protein: 1, carbs: 1, fat: 2.5, serving: '1 cup unsweetened', fiber: 0.5, sugar: 0 },
  'oat milk': { calories: 120, protein: 3, carbs: 16, fat: 5, serving: '1 cup', fiber: 2, sugar: 7 },
  'greek yogurt': { calories: 100, protein: 17, carbs: 6, fat: 0.7, serving: '170g (nonfat)', fiber: 0, sugar: 6 },
  'yogurt': { calories: 149, protein: 8.5, carbs: 17, fat: 5, serving: '1 cup', fiber: 0, sugar: 17 },
  'cheese': { calories: 113, protein: 7, carbs: 0.4, fat: 9, serving: '1 oz cheddar', fiber: 0, sugar: 0.1 },
  'mozzarella': { calories: 85, protein: 6, carbs: 1, fat: 6, serving: '1 oz', fiber: 0, sugar: 0.3 },
  'parmesan': { calories: 110, protein: 10, carbs: 0.9, fat: 7.3, serving: '1 oz', fiber: 0, sugar: 0.3 },
  'cream cheese': { calories: 99, protein: 1.7, carbs: 1.6, fat: 10, serving: '1 oz', fiber: 0, sugar: 0.5 },
  'cottage cheese': { calories: 206, protein: 28, carbs: 6, fat: 9, serving: '1 cup', fiber: 0, sugar: 6 },
  'butter': { calories: 102, protein: 0.1, carbs: 0, fat: 12, serving: '1 tbsp', fiber: 0, sugar: 0 },
  'sour cream': { calories: 23, protein: 0.3, carbs: 0.5, fat: 2.4, serving: '1 tbsp', fiber: 0, sugar: 0.4 },

  // Nuts & Seeds
  'almonds': { calories: 164, protein: 6, carbs: 6, fat: 14, serving: '1 oz (23 nuts)', fiber: 3.5, sugar: 1.1 },
  'peanuts': { calories: 161, protein: 7, carbs: 4.6, fat: 14, serving: '1 oz', fiber: 2.4, sugar: 1.1 },
  'peanut butter': { calories: 188, protein: 8, carbs: 6, fat: 16, serving: '2 tbsp', fiber: 2, sugar: 3 },
  'almond butter': { calories: 196, protein: 7, carbs: 6, fat: 18, serving: '2 tbsp', fiber: 3, sugar: 2 },
  'walnuts': { calories: 185, protein: 4.3, carbs: 3.9, fat: 18, serving: '1 oz', fiber: 1.9, sugar: 0.7 },
  'cashews': { calories: 157, protein: 5, carbs: 8.6, fat: 12, serving: '1 oz', fiber: 0.9, sugar: 1.7 },
  'pecans': { calories: 196, protein: 2.6, carbs: 3.9, fat: 20, serving: '1 oz', fiber: 2.7, sugar: 1.1 },
  'pistachios': { calories: 159, protein: 5.7, carbs: 7.7, fat: 13, serving: '1 oz', fiber: 2.9, sugar: 2.2 },
  'sunflower seeds': { calories: 165, protein: 5.5, carbs: 6.5, fat: 14, serving: '1 oz', fiber: 3.2, sugar: 0.8 },
  'chia seeds': { calories: 138, protein: 4.7, carbs: 12, fat: 8.7, serving: '1 oz', fiber: 10, sugar: 0 },
  'flax seeds': { calories: 150, protein: 5.1, carbs: 8.1, fat: 12, serving: '1 oz ground', fiber: 7.6, sugar: 0.4 },
  'hemp seeds': { calories: 166, protein: 9.5, carbs: 2.6, fat: 14.6, serving: '1 oz', fiber: 1.2, sugar: 0.4 },
  'trail mix': { calories: 175, protein: 4.6, carbs: 16, fat: 11, serving: '1/4 cup', fiber: 1.5, sugar: 9 },

  // Legumes
  'beans': { calories: 227, protein: 15, carbs: 41, fat: 0.9, serving: '1 cup cooked', fiber: 15, sugar: 0.6 },
  'black beans': { calories: 227, protein: 15, carbs: 41, fat: 0.9, serving: '1 cup cooked', fiber: 15, sugar: 0.6 },
  'kidney beans': { calories: 225, protein: 15, carbs: 40, fat: 0.9, serving: '1 cup cooked', fiber: 11, sugar: 0.6 },
  'chickpeas': { calories: 269, protein: 14.5, carbs: 45, fat: 4.3, serving: '1 cup cooked', fiber: 12.5, sugar: 8 },
  'lentils': { calories: 230, protein: 18, carbs: 40, fat: 0.8, serving: '1 cup cooked', fiber: 15.6, sugar: 3.6 },
  'hummus': { calories: 166, protein: 7.9, carbs: 14.3, fat: 9.6, serving: '1/3 cup', fiber: 4, sugar: 0.3 },
  'refried beans': { calories: 217, protein: 13, carbs: 37, fat: 3, serving: '1 cup', fiber: 12, sugar: 3 },

  // Common Meals & Fast Food
  'pizza': { calories: 285, protein: 12, carbs: 36, fat: 10, serving: '1 slice (cheese)', fiber: 2, sugar: 4 },
  'hamburger': { calories: 354, protein: 20, carbs: 29, fat: 17, serving: '1 burger', fiber: 1, sugar: 5 },
  'cheeseburger': { calories: 410, protein: 24, carbs: 30, fat: 21, serving: '1 burger', fiber: 1, sugar: 6 },
  'french fries': { calories: 365, protein: 4, carbs: 48, fat: 17, serving: '1 medium serving', fiber: 4, sugar: 0.2 },
  'burrito': { calories: 430, protein: 22, carbs: 48, fat: 16, serving: '1 large', fiber: 5, sugar: 3 },
  'taco': { calories: 210, protein: 9, carbs: 21, fat: 10, serving: '1 taco', fiber: 2, sugar: 2 },
  'sub sandwich': { calories: 430, protein: 22, carbs: 46, fat: 17, serving: '6 inch', fiber: 3, sugar: 7 },
  'chicken nuggets': { calories: 296, protein: 15, carbs: 16, fat: 19, serving: '6 pieces', fiber: 0.5, sugar: 0.5 },
  'mac and cheese': { calories: 310, protein: 11, carbs: 36, fat: 14, serving: '1 cup', fiber: 1.5, sugar: 6 },
  'ramen': { calories: 380, protein: 10, carbs: 52, fat: 14, serving: '1 package', fiber: 2, sugar: 1 },
  'fried rice': { calories: 238, protein: 5.5, carbs: 33, fat: 9, serving: '1 cup', fiber: 1, sugar: 1 },
  'sushi roll': { calories: 255, protein: 9, carbs: 38, fat: 7, serving: '6 pieces', fiber: 3, sugar: 8 },
  'grilled cheese': { calories: 366, protein: 14, carbs: 28, fat: 22, serving: '1 sandwich', fiber: 1.5, sugar: 4 },
  'blt': { calories: 344, protein: 12, carbs: 29, fat: 20, serving: '1 sandwich', fiber: 2, sugar: 4 },
  'pbj': { calories: 376, protein: 12, carbs: 48, fat: 16, serving: '1 sandwich', fiber: 3, sugar: 18 },
  'soup': { calories: 100, protein: 5, carbs: 15, fat: 2, serving: '1 cup', fiber: 2, sugar: 3 },
  'chicken soup': { calories: 75, protein: 4, carbs: 9, fat: 2.5, serving: '1 cup', fiber: 1, sugar: 1 },
  'chili': { calories: 247, protein: 16, carbs: 22, fat: 11, serving: '1 cup', fiber: 5, sugar: 4 },
  'hot dog': { calories: 290, protein: 11, carbs: 24, fat: 17, serving: '1 hot dog with bun', fiber: 1, sugar: 4 },
  'corn dog': { calories: 330, protein: 10, carbs: 34, fat: 17, serving: '1 corn dog', fiber: 1, sugar: 7 },
  'quesadilla': { calories: 475, protein: 22, carbs: 37, fat: 26, serving: '1 quesadilla', fiber: 2, sugar: 2 },
  'nachos': { calories: 346, protein: 9, carbs: 36, fat: 19, serving: '6-8 chips with cheese', fiber: 3, sugar: 2 },

  // McDonald's
  'big mac': { calories: 550, protein: 25, carbs: 45, fat: 30, serving: '1 burger', fiber: 3, sugar: 9 },
  'mcchicken': { calories: 400, protein: 14, carbs: 40, fat: 21, serving: '1 sandwich', fiber: 2, sugar: 5 },
  'mcdouble': { calories: 400, protein: 22, carbs: 33, fat: 20, serving: '1 burger', fiber: 2, sugar: 7 },
  'quarter pounder': { calories: 520, protein: 30, carbs: 42, fat: 26, serving: '1 burger', fiber: 2, sugar: 10 },
  'mcnuggets': { calories: 170, protein: 10, carbs: 10, fat: 10, serving: '4 piece', fiber: 0.5, sugar: 0 },
  'mcnuggets 10pc': { calories: 410, protein: 24, carbs: 25, fat: 24, serving: '10 piece', fiber: 1, sugar: 0 },
  'egg mcmuffin': { calories: 300, protein: 17, carbs: 30, fat: 12, serving: '1 sandwich', fiber: 2, sugar: 3 },
  'sausage mcmuffin': { calories: 400, protein: 14, carbs: 29, fat: 26, serving: '1 sandwich', fiber: 2, sugar: 2 },
  'mcdonald fries': { calories: 320, protein: 3, carbs: 43, fat: 15, serving: 'medium', fiber: 4, sugar: 0 },
  'filet-o-fish': { calories: 390, protein: 16, carbs: 39, fat: 19, serving: '1 sandwich', fiber: 2, sugar: 5 },
  'mcflurry': { calories: 510, protein: 13, carbs: 73, fat: 18, serving: 'regular oreo', fiber: 1, sugar: 57 },

  // Chick-fil-A
  'chick-fil-a sandwich': { calories: 440, protein: 28, carbs: 40, fat: 19, serving: '1 sandwich', fiber: 2, sugar: 6 },
  'chick-fil-a spicy sandwich': { calories: 450, protein: 28, carbs: 41, fat: 19, serving: '1 sandwich', fiber: 2, sugar: 6 },
  'chick-fil-a nuggets': { calories: 250, protein: 27, carbs: 11, fat: 11, serving: '8 count', fiber: 0.5, sugar: 1 },
  'chick-fil-a nuggets 12': { calories: 380, protein: 40, carbs: 16, fat: 17, serving: '12 count', fiber: 1, sugar: 1 },
  'chick-fil-a waffle fries': { calories: 360, protein: 4, carbs: 43, fat: 19, serving: 'medium', fiber: 5, sugar: 0 },
  'chick-fil-a milkshake': { calories: 580, protein: 13, carbs: 82, fat: 22, serving: 'small cookies & cream', fiber: 1, sugar: 71 },

  // Wendy's
  'wendys baconator': { calories: 940, protein: 57, carbs: 38, fat: 62, serving: '1 burger', fiber: 2, sugar: 8 },
  'wendys dave single': { calories: 570, protein: 30, carbs: 39, fat: 34, serving: '1 burger', fiber: 2, sugar: 8 },
  'wendys spicy chicken': { calories: 470, protein: 27, carbs: 44, fat: 21, serving: '1 sandwich', fiber: 2, sugar: 5 },
  'wendys nuggets': { calories: 170, protein: 10, carbs: 10, fat: 11, serving: '4 piece', fiber: 0, sugar: 0 },
  'wendys frosty': { calories: 340, protein: 9, carbs: 56, fat: 9, serving: 'small chocolate', fiber: 0, sugar: 47 },

  // Taco Bell
  'crunchwrap supreme': { calories: 530, protein: 16, carbs: 71, fat: 21, serving: '1 crunchwrap', fiber: 4, sugar: 6 },
  'chalupa': { calories: 350, protein: 12, carbs: 30, fat: 21, serving: '1 chalupa supreme', fiber: 3, sugar: 3 },
  'cheesy gordita crunch': { calories: 500, protein: 20, carbs: 41, fat: 28, serving: '1 item', fiber: 3, sugar: 4 },
  'mexican pizza': { calories: 540, protein: 20, carbs: 46, fat: 31, serving: '1 pizza', fiber: 7, sugar: 3 },
  'taco bell taco': { calories: 170, protein: 8, carbs: 13, fat: 9, serving: '1 crunchy taco', fiber: 2, sugar: 1 },
  'bean burrito': { calories: 380, protein: 14, carbs: 55, fat: 11, serving: '1 burrito', fiber: 8, sugar: 3 },
  'quesarito': { calories: 650, protein: 27, carbs: 64, fat: 33, serving: '1 quesarito', fiber: 6, sugar: 4 },

  // Subway
  'subway turkey': { calories: 280, protein: 18, carbs: 39, fat: 3.5, serving: '6 inch', fiber: 3, sugar: 6 },
  'subway italian bmt': { calories: 410, protein: 20, carbs: 41, fat: 18, serving: '6 inch', fiber: 3, sugar: 7 },
  'subway meatball': { calories: 480, protein: 22, carbs: 51, fat: 20, serving: '6 inch', fiber: 4, sugar: 10 },
  'subway chicken teriyaki': { calories: 340, protein: 26, carbs: 45, fat: 5, serving: '6 inch', fiber: 3, sugar: 12 },
  'subway steak and cheese': { calories: 390, protein: 26, carbs: 40, fat: 12, serving: '6 inch', fiber: 3, sugar: 7 },

  // Chipotle
  'chipotle burrito bowl': { calories: 665, protein: 36, carbs: 74, fat: 22, serving: 'chicken bowl', fiber: 11, sugar: 4 },
  'chipotle burrito': { calories: 955, protein: 39, carbs: 108, fat: 36, serving: 'chicken burrito', fiber: 13, sugar: 5 },
  'chipotle tacos': { calories: 560, protein: 32, carbs: 38, fat: 28, serving: '3 chicken tacos', fiber: 5, sugar: 3 },
  'chipotle chips': { calories: 540, protein: 7, carbs: 68, fat: 26, serving: 'chips & guac', fiber: 7, sugar: 2 },

  // Popeyes
  'popeyes chicken sandwich': { calories: 700, protein: 28, carbs: 50, fat: 42, serving: '1 sandwich', fiber: 2, sugar: 8 },
  'popeyes tender': { calories: 150, protein: 8, carbs: 8, fat: 9, serving: '1 tender', fiber: 0.5, sugar: 0 },

  // Five Guys
  'five guys burger': { calories: 840, protein: 43, carbs: 40, fat: 55, serving: '1 cheeseburger', fiber: 2, sugar: 9 },
  'five guys little burger': { calories: 550, protein: 27, carbs: 39, fat: 32, serving: '1 little cheeseburger', fiber: 2, sugar: 8 },
  'five guys fries': { calories: 530, protein: 8, carbs: 60, fat: 30, serving: 'regular', fiber: 6, sugar: 1 },

  // Panda Express
  'orange chicken': { calories: 490, protein: 25, carbs: 51, fat: 21, serving: '1 entree', fiber: 0, sugar: 19 },
  'beijing beef': { calories: 470, protein: 14, carbs: 57, fat: 22, serving: '1 entree', fiber: 2, sugar: 25 },
  'broccoli beef': { calories: 150, protein: 9, carbs: 13, fat: 7, serving: '1 entree', fiber: 2, sugar: 5 },
  'chow mein': { calories: 510, protein: 13, carbs: 80, fat: 16, serving: '1 side', fiber: 6, sugar: 9 },
  'fried rice': { calories: 520, protein: 11, carbs: 85, fat: 16, serving: '1 side panda express', fiber: 2, sugar: 3 },

  // Pizza (specific)
  'dominos cheese pizza': { calories: 200, protein: 8, carbs: 25, fat: 8, serving: '1 medium slice', fiber: 1, sugar: 3 },
  'dominos pepperoni': { calories: 220, protein: 9, carbs: 25, fat: 9, serving: '1 medium slice', fiber: 1, sugar: 3 },
  'pizza hut cheese': { calories: 220, protein: 9, carbs: 26, fat: 9, serving: '1 medium slice', fiber: 1, sugar: 3 },
  'little caesars': { calories: 220, protein: 9, carbs: 26, fat: 9, serving: '1 medium slice', fiber: 1, sugar: 3 },

  // KFC
  'kfc original chicken': { calories: 390, protein: 39, carbs: 11, fat: 21, serving: '1 breast', fiber: 0.5, sugar: 0 },
  'kfc extra crispy': { calories: 490, protein: 34, carbs: 17, fat: 32, serving: '1 breast', fiber: 1, sugar: 0 },
  'kfc mashed potatoes': { calories: 120, protein: 2, carbs: 17, fat: 5, serving: 'individual', fiber: 1, sugar: 0 },

  // Snacks & Sweets
  'ice cream': { calories: 207, protein: 3.5, carbs: 24, fat: 11, serving: '1/2 cup', fiber: 0.5, sugar: 21 },
  'chocolate': { calories: 155, protein: 1.4, carbs: 17, fat: 9, serving: '1 oz dark', fiber: 2, sugar: 12 },
  'cookie': { calories: 140, protein: 1.5, carbs: 20, fat: 7, serving: '1 medium', fiber: 0.5, sugar: 11 },
  'brownie': { calories: 227, protein: 2.7, carbs: 36, fat: 9, serving: '1 piece', fiber: 1, sugar: 21 },
  'donut': { calories: 269, protein: 4, carbs: 31, fat: 15, serving: '1 medium glazed', fiber: 0.7, sugar: 13 },
  'muffin': { calories: 340, protein: 6, carbs: 49, fat: 14, serving: '1 large blueberry', fiber: 2, sugar: 26 },
  'chips': { calories: 152, protein: 2, carbs: 15, fat: 10, serving: '1 oz (15 chips)', fiber: 1.2, sugar: 0.1 },
  'banana chips': { calories: 147, protein: 0.7, carbs: 17, fat: 9.5, serving: '1 oz (28g)', fiber: 2.2, sugar: 10 },
  'doritos': { calories: 140, protein: 2, carbs: 18, fat: 7, serving: '1 oz (11 chips)', fiber: 1, sugar: 0.5 },
  'lays': { calories: 160, protein: 2, carbs: 15, fat: 10, serving: '1 oz (15 chips)', fiber: 1, sugar: 0.5 },
  'cheetos': { calories: 160, protein: 2, carbs: 15, fat: 10, serving: '1 oz (21 pieces)', fiber: 0.5, sugar: 1 },
  'pringles': { calories: 150, protein: 1, carbs: 15, fat: 9, serving: '1 oz (16 crisps)', fiber: 0.5, sugar: 0.5 },
  'fritos': { calories: 160, protein: 2, carbs: 16, fat: 10, serving: '1 oz (32 chips)', fiber: 1, sugar: 0 },
  'sun chips': { calories: 140, protein: 2, carbs: 19, fat: 6, serving: '1 oz (16 chips)', fiber: 2, sugar: 2 },
  'kettle chips': { calories: 150, protein: 2, carbs: 16, fat: 9, serving: '1 oz (13 chips)', fiber: 1, sugar: 0.5 },
  'ruffles': { calories: 160, protein: 2, carbs: 14, fat: 10, serving: '1 oz (12 chips)', fiber: 1, sugar: 0.5 },
  'tostitos': { calories: 140, protein: 2, carbs: 19, fat: 7, serving: '1 oz (6 chips)', fiber: 1, sugar: 0 },
  'takis': { calories: 140, protein: 2, carbs: 17, fat: 8, serving: '1 oz (12 pieces)', fiber: 1, sugar: 0.5 },
  'veggie chips': { calories: 130, protein: 1, carbs: 18, fat: 6, serving: '1 oz', fiber: 1, sugar: 2 },
  'plantain chips': { calories: 150, protein: 1, carbs: 18, fat: 8, serving: '1 oz (28g)', fiber: 2, sugar: 3 },
  'popcorn': { calories: 93, protein: 3, carbs: 19, fat: 1.1, serving: '3 cups air-popped', fiber: 3.6, sugar: 0.2 },
  'pretzels': { calories: 108, protein: 3, carbs: 23, fat: 0.5, serving: '1 oz', fiber: 0.9, sugar: 0.5 },
  'rice cake': { calories: 35, protein: 0.7, carbs: 7.3, fat: 0.3, serving: '1 cake', fiber: 0.4, sugar: 0 },
  'granola bar': { calories: 140, protein: 3, carbs: 22, fat: 5, serving: '1 bar', fiber: 2, sugar: 10 },
  'candy bar': { calories: 250, protein: 4, carbs: 33, fat: 12, serving: '1 bar (50g)', fiber: 1, sugar: 25 },
  'cheez-its': { calories: 150, protein: 3, carbs: 17, fat: 8, serving: '1 oz (27 crackers)', fiber: 0.5, sugar: 0.5 },
  'cheez-it': { calories: 150, protein: 3, carbs: 17, fat: 8, serving: '1 oz (27 crackers)', fiber: 0.5, sugar: 0.5 },
  'goldfish': { calories: 140, protein: 4, carbs: 20, fat: 5, serving: '1 oz (55 pieces)', fiber: 0.5, sugar: 1 },
  'uncrustables': { calories: 210, protein: 6, carbs: 26, fat: 9, serving: '1 sandwich', fiber: 2, sugar: 9 },
  'chips ahoy': { calories: 160, protein: 1, carbs: 22, fat: 8, serving: '3 cookies (33g)', fiber: 0.5, sugar: 11 },
  'oreos': { calories: 160, protein: 1, carbs: 25, fat: 7, serving: '3 cookies (34g)', fiber: 0.5, sugar: 14 },
  'nutter butter': { calories: 130, protein: 2, carbs: 19, fat: 5, serving: '2 cookies (26g)', fiber: 0.5, sugar: 9 },
  'fig newtons': { calories: 200, protein: 2, carbs: 40, fat: 4, serving: '2 cookies (56g)', fiber: 2, sugar: 24 },
  'biscuits': { calories: 166, protein: 3.2, carbs: 22, fat: 7.5, serving: '1 biscuit (60g)', fiber: 0.7, sugar: 2.5 },
  'ritz crackers': { calories: 80, protein: 1, carbs: 10, fat: 4, serving: '5 crackers (16g)', fiber: 0, sugar: 1 },
  'triscuits': { calories: 120, protein: 3, carbs: 20, fat: 4.5, serving: '6 crackers (28g)', fiber: 3, sugar: 0 },
  'wheat thins': { calories: 140, protein: 2, carbs: 22, fat: 5, serving: '16 crackers (31g)', fiber: 2, sugar: 5 },
  'graham crackers': { calories: 130, protein: 2, carbs: 24, fat: 3, serving: '2 sheets (31g)', fiber: 1, sugar: 8 },
  'animal crackers': { calories: 130, protein: 2, carbs: 22, fat: 4, serving: '16 crackers (30g)', fiber: 0.5, sugar: 7 },
  'pop-tarts': { calories: 200, protein: 2, carbs: 38, fat: 5, serving: '1 pastry', fiber: 0.5, sugar: 17 },
  'nutri-grain bar': { calories: 130, protein: 2, carbs: 26, fat: 3, serving: '1 bar (37g)', fiber: 3, sugar: 12 },
  'nature valley bar': { calories: 190, protein: 4, carbs: 29, fat: 7, serving: '2 bars (42g)', fiber: 2, sugar: 11 },
  'almonds': { calories: 164, protein: 6, carbs: 6, fat: 14, serving: '1 oz (23 almonds)', fiber: 3.5, sugar: 1.2 },
  'cashews': { calories: 157, protein: 5, carbs: 9, fat: 12, serving: '1 oz (18 cashews)', fiber: 0.9, sugar: 1.7 },
  'walnuts': { calories: 185, protein: 4.3, carbs: 4, fat: 18, serving: '1 oz (14 halves)', fiber: 1.9, sugar: 0.7 },
  'pecans': { calories: 196, protein: 2.6, carbs: 4, fat: 20, serving: '1 oz (19 halves)', fiber: 2.7, sugar: 1.1 },
  'peanuts': { calories: 161, protein: 7, carbs: 4.6, fat: 14, serving: '1 oz (28g)', fiber: 2.4, sugar: 1 },
  'pistachios': { calories: 159, protein: 6, carbs: 8, fat: 13, serving: '1 oz (49 kernels)', fiber: 2.9, sugar: 2 },
  'macadamia nuts': { calories: 204, protein: 2.2, carbs: 4, fat: 21, serving: '1 oz (10-12 nuts)', fiber: 2.4, sugar: 1.3 },
  'mixed nuts': { calories: 172, protein: 5, carbs: 7, fat: 15, serving: '1 oz (28g)', fiber: 2, sugar: 1.5 },
  'sunflower seeds': { calories: 165, protein: 5.5, carbs: 7, fat: 14, serving: '1 oz (28g)', fiber: 3.2, sugar: 0.8 },
  'pumpkin seeds': { calories: 126, protein: 5.3, carbs: 15, fat: 5.5, serving: '1 oz (28g)', fiber: 5.2, sugar: 0.3 },
  'beef jerky': { calories: 116, protein: 9.4, carbs: 3.1, fat: 7.3, serving: '1 oz (28g)', fiber: 0.4, sugar: 2.6 },
  'string cheese': { calories: 80, protein: 7, carbs: 0.5, fat: 5, serving: '1 stick (28g)', fiber: 0, sugar: 0 },
  'fruit snacks': { calories: 80, protein: 0, carbs: 20, fat: 0, serving: '1 pouch (25g)', fiber: 0, sugar: 11 },
  'rice krispies treat': { calories: 90, protein: 1, carbs: 17, fat: 2.5, serving: '1 bar (22g)', fiber: 0, sugar: 8 },
  'teddy grahams': { calories: 130, protein: 2, carbs: 22, fat: 4.5, serving: '24 pieces (30g)', fiber: 1, sugar: 8 },
  'chex mix': { calories: 120, protein: 3, carbs: 19, fat: 4.5, serving: '2/3 cup (30g)', fiber: 1, sugar: 2 },
  'cheese puffs': { calories: 160, protein: 2, carbs: 14, fat: 10, serving: '1 oz (28g)', fiber: 0.5, sugar: 1 },
  'hot cheetos': { calories: 170, protein: 2, carbs: 15, fat: 11, serving: '1 oz (21 pieces)', fiber: 0.5, sugar: 1 },

  // Beverages
  'orange juice': { calories: 112, protein: 1.7, carbs: 26, fat: 0.5, serving: '1 cup', fiber: 0.5, sugar: 21 },
  'apple juice': { calories: 114, protein: 0.3, carbs: 28, fat: 0.3, serving: '1 cup', fiber: 0.5, sugar: 24 },
  'smoothie': { calories: 210, protein: 5, carbs: 40, fat: 3, serving: '1 cup', fiber: 3, sugar: 30 },
  'coffee': { calories: 2, protein: 0.3, carbs: 0, fat: 0, serving: '1 cup black', fiber: 0, sugar: 0 },
  'latte': { calories: 190, protein: 13, carbs: 18, fat: 7, serving: '16 oz with whole milk', fiber: 0, sugar: 17 },
  'cappuccino': { calories: 120, protein: 8, carbs: 10, fat: 6, serving: '12 oz', fiber: 0, sugar: 10 },
  'beer': { calories: 153, protein: 1.6, carbs: 13, fat: 0, serving: '12 oz', fiber: 0, sugar: 0.7 },
  'wine': { calories: 125, protein: 0.1, carbs: 3.8, fat: 0, serving: '5 oz glass', fiber: 0, sugar: 0.9 },
  'soda': { calories: 140, protein: 0, carbs: 39, fat: 0, serving: '12 oz can', fiber: 0, sugar: 39 },
  'sports drink': { calories: 80, protein: 0, carbs: 21, fat: 0, serving: '12 oz', fiber: 0, sugar: 21 },
  'coconut water': { calories: 46, protein: 1.7, carbs: 9, fat: 0.5, serving: '1 cup', fiber: 2.6, sugar: 6.3 },

  // Condiments & Extras
  'olive oil': { calories: 119, protein: 0, carbs: 0, fat: 14, serving: '1 tbsp', fiber: 0, sugar: 0 },
  'coconut oil': { calories: 121, protein: 0, carbs: 0, fat: 14, serving: '1 tbsp', fiber: 0, sugar: 0 },
  'mayonnaise': { calories: 94, protein: 0.1, carbs: 0.1, fat: 10, serving: '1 tbsp', fiber: 0, sugar: 0.1 },
  'ketchup': { calories: 20, protein: 0.2, carbs: 5, fat: 0, serving: '1 tbsp', fiber: 0, sugar: 3.7 },
  'mustard': { calories: 3, protein: 0.2, carbs: 0.3, fat: 0.2, serving: '1 tsp', fiber: 0.1, sugar: 0.1 },
  'ranch dressing': { calories: 73, protein: 0.1, carbs: 1, fat: 8, serving: '1 tbsp', fiber: 0, sugar: 0.5 },
  'salsa': { calories: 10, protein: 0.5, carbs: 2, fat: 0.1, serving: '2 tbsp', fiber: 0.5, sugar: 1.3 },
  'guacamole': { calories: 50, protein: 0.6, carbs: 3, fat: 4.5, serving: '2 tbsp', fiber: 2, sugar: 0.2 },
  'honey': { calories: 64, protein: 0.1, carbs: 17, fat: 0, serving: '1 tbsp', fiber: 0, sugar: 17 },
  'maple syrup': { calories: 52, protein: 0, carbs: 13, fat: 0, serving: '1 tbsp', fiber: 0, sugar: 12 },
  'soy sauce': { calories: 9, protein: 0.9, carbs: 1, fat: 0, serving: '1 tbsp', fiber: 0, sugar: 0.2 },
  'bbq sauce': { calories: 29, protein: 0.2, carbs: 7, fat: 0.1, serving: '1 tbsp', fiber: 0.2, sugar: 5.5 },

  // South Indian / Indian
  'dosa': { calories: 133, protein: 3.9, carbs: 18, fat: 5, serving: '1 medium plain', fiber: 1, sugar: 0.5 },
  'masala dosa': { calories: 250, protein: 5.5, carbs: 30, fat: 12, serving: '1 dosa with filling', fiber: 2.5, sugar: 1 },
  'idli': { calories: 39, protein: 2, carbs: 8, fat: 0.2, serving: '1 piece', fiber: 0.5, sugar: 0.3 },
  'sambar': { calories: 130, protein: 6, carbs: 18, fat: 3.5, serving: '1 cup', fiber: 5, sugar: 3 },
  'rasam': { calories: 45, protein: 1.5, carbs: 8, fat: 0.5, serving: '1 cup', fiber: 1, sugar: 2 },
  'upma': { calories: 210, protein: 5, carbs: 30, fat: 8, serving: '1 cup', fiber: 2.5, sugar: 1 },
  'vada': { calories: 165, protein: 5.5, carbs: 14, fat: 10, serving: '1 piece', fiber: 2, sugar: 0.5 },
  'medu vada': { calories: 165, protein: 5.5, carbs: 14, fat: 10, serving: '1 piece', fiber: 2, sugar: 0.5 },
  'uttapam': { calories: 180, protein: 4.5, carbs: 22, fat: 8, serving: '1 medium', fiber: 1.5, sugar: 1 },
  'pongal': { calories: 220, protein: 6, carbs: 32, fat: 8, serving: '1 cup', fiber: 2, sugar: 0.5 },
  'ven pongal': { calories: 220, protein: 6, carbs: 32, fat: 8, serving: '1 cup', fiber: 2, sugar: 0.5 },
  'appam': { calories: 120, protein: 2, carbs: 22, fat: 2.5, serving: '1 piece', fiber: 0.5, sugar: 1 },
  'puttu': { calories: 215, protein: 4, carbs: 40, fat: 4.5, serving: '1 cylinder', fiber: 3, sugar: 1 },
  'coconut chutney': { calories: 72, protein: 1.5, carbs: 4, fat: 6, serving: '2 tbsp', fiber: 1.5, sugar: 1 },
  'tomato chutney': { calories: 35, protein: 0.5, carbs: 5, fat: 1.5, serving: '2 tbsp', fiber: 0.5, sugar: 2 },
  'biryani': { calories: 350, protein: 15, carbs: 45, fat: 12, serving: '1 cup', fiber: 2, sugar: 1 },
  'chicken biryani': { calories: 400, protein: 22, carbs: 42, fat: 16, serving: '1 cup', fiber: 2, sugar: 1 },
  'dal': { calories: 198, protein: 13, carbs: 30, fat: 3, serving: '1 cup', fiber: 8, sugar: 3 },
  'dal rice': { calories: 340, protein: 12, carbs: 58, fat: 6, serving: '1 plate', fiber: 5, sugar: 2 },
  'chapati': { calories: 104, protein: 3.5, carbs: 18, fat: 2.5, serving: '1 piece', fiber: 2, sugar: 0.4 },
  'roti': { calories: 104, protein: 3.5, carbs: 18, fat: 2.5, serving: '1 piece', fiber: 2, sugar: 0.4 },
  'paratha': { calories: 180, protein: 4, carbs: 22, fat: 8, serving: '1 piece', fiber: 1.5, sugar: 0.5 },
  'paneer': { calories: 265, protein: 18, carbs: 1.2, fat: 21, serving: '100g', fiber: 0, sugar: 1 },
  'paneer butter masala': { calories: 320, protein: 14, carbs: 12, fat: 25, serving: '1 cup', fiber: 2, sugar: 4 },
  'palak paneer': { calories: 240, protein: 14, carbs: 8, fat: 18, serving: '1 cup', fiber: 3, sugar: 2 },
  'curd rice': { calories: 210, protein: 6, carbs: 35, fat: 5, serving: '1 cup', fiber: 0.5, sugar: 3 },
  'yogurt rice': { calories: 210, protein: 6, carbs: 35, fat: 5, serving: '1 cup', fiber: 0.5, sugar: 3 },
  'chole': { calories: 270, protein: 14, carbs: 40, fat: 6, serving: '1 cup', fiber: 10, sugar: 5 },
  'chana masala': { calories: 270, protein: 14, carbs: 40, fat: 6, serving: '1 cup', fiber: 10, sugar: 5 },
  'rajma': { calories: 235, protein: 15, carbs: 38, fat: 3, serving: '1 cup', fiber: 11, sugar: 2 },
  'aloo gobi': { calories: 180, protein: 4, carbs: 22, fat: 9, serving: '1 cup', fiber: 4, sugar: 3 },
  'chicken curry': { calories: 290, protein: 22, carbs: 10, fat: 18, serving: '1 cup', fiber: 2, sugar: 3 },
  'fish curry': { calories: 220, protein: 20, carbs: 8, fat: 12, serving: '1 cup', fiber: 1.5, sugar: 2 },
  'egg curry': { calories: 250, protein: 14, carbs: 10, fat: 18, serving: '1 cup (2 eggs)', fiber: 2, sugar: 3 },
  'baingan bharta': { calories: 165, protein: 4, carbs: 14, fat: 11, serving: '1 cup', fiber: 5, sugar: 5 },
  'baingan masala': { calories: 165, protein: 4, carbs: 14, fat: 11, serving: '1 cup', fiber: 5, sugar: 5 },
  'aloo paratha': { calories: 210, protein: 5, carbs: 28, fat: 9, serving: '1 piece', fiber: 2, sugar: 1 },
  'gobi paratha': { calories: 200, protein: 5, carbs: 26, fat: 8, serving: '1 piece', fiber: 2.5, sugar: 1 },
  'paneer paratha': { calories: 250, protein: 8, carbs: 25, fat: 13, serving: '1 piece', fiber: 1.5, sugar: 0.5 },
  'methi paratha': { calories: 190, protein: 5, carbs: 24, fat: 8, serving: '1 piece', fiber: 2, sugar: 0.5 },
  'mooli paratha': { calories: 195, protein: 4.5, carbs: 25, fat: 8, serving: '1 piece', fiber: 2, sugar: 1 },
  'chole bhature': { calories: 450, protein: 14, carbs: 55, fat: 20, serving: '1 plate (2 bhature + chole)', fiber: 8, sugar: 4 },
  'dal makhani': { calories: 260, protein: 12, carbs: 28, fat: 12, serving: '1 cup', fiber: 7, sugar: 3 },
  'dal tadka': { calories: 200, protein: 12, carbs: 28, fat: 5, serving: '1 cup', fiber: 7, sugar: 2 },
  'dal fry': { calories: 210, protein: 13, carbs: 28, fat: 5, serving: '1 cup', fiber: 7, sugar: 2 },
  'kadhi': { calories: 150, protein: 5, carbs: 12, fat: 9, serving: '1 cup', fiber: 1, sugar: 3 },
  'kadhi pakora': { calories: 200, protein: 6, carbs: 16, fat: 13, serving: '1 cup', fiber: 1.5, sugar: 3 },
  'shahi paneer': { calories: 330, protein: 14, carbs: 10, fat: 27, serving: '1 cup', fiber: 2, sugar: 4 },
  'matar paneer': { calories: 280, protein: 14, carbs: 15, fat: 19, serving: '1 cup', fiber: 4, sugar: 4 },
  'malai kofta': { calories: 350, protein: 10, carbs: 18, fat: 27, serving: '1 cup (3 kofta)', fiber: 3, sugar: 5 },
  'bhindi masala': { calories: 130, protein: 3, carbs: 10, fat: 9, serving: '1 cup', fiber: 4, sugar: 3 },
  'aloo matar': { calories: 180, protein: 5, carbs: 24, fat: 7, serving: '1 cup', fiber: 4, sugar: 3 },
  'aloo palak': { calories: 170, protein: 4, carbs: 20, fat: 8, serving: '1 cup', fiber: 3.5, sugar: 2 },
  'mixed veg curry': { calories: 160, protein: 4, carbs: 16, fat: 9, serving: '1 cup', fiber: 4, sugar: 4 },
  'mushroom masala': { calories: 175, protein: 6, carbs: 10, fat: 12, serving: '1 cup', fiber: 2, sugar: 3 },
  'keema': { calories: 310, protein: 24, carbs: 8, fat: 20, serving: '1 cup', fiber: 2, sugar: 3 },
  'keema matar': { calories: 320, protein: 24, carbs: 12, fat: 20, serving: '1 cup', fiber: 3, sugar: 3 },
  'butter chicken': { calories: 340, protein: 24, carbs: 10, fat: 22, serving: '1 cup', fiber: 2, sugar: 4 },
  'chicken tikka masala': { calories: 310, protein: 22, carbs: 12, fat: 20, serving: '1 cup', fiber: 2, sugar: 4 },
  'lamb curry': { calories: 330, protein: 26, carbs: 10, fat: 22, serving: '1 cup', fiber: 2, sugar: 3 },
  'lamb rogan josh': { calories: 340, protein: 26, carbs: 8, fat: 24, serving: '1 cup', fiber: 2, sugar: 3 },
  'goat curry': { calories: 310, protein: 28, carbs: 8, fat: 18, serving: '1 cup', fiber: 2, sugar: 3 },
  'shrimp curry': { calories: 230, protein: 22, carbs: 10, fat: 12, serving: '1 cup', fiber: 2, sugar: 3 },
  'korma': { calories: 300, protein: 18, carbs: 12, fat: 22, serving: '1 cup', fiber: 2, sugar: 4 },
  'vindaloo': { calories: 290, protein: 24, carbs: 10, fat: 18, serving: '1 cup', fiber: 2, sugar: 3 },
  'saag': { calories: 180, protein: 8, carbs: 10, fat: 13, serving: '1 cup', fiber: 4, sugar: 2 },
  'sarson ka saag': { calories: 190, protein: 8, carbs: 12, fat: 13, serving: '1 cup', fiber: 5, sugar: 2 },
  'makki ki roti': { calories: 120, protein: 3, carbs: 22, fat: 2.5, serving: '1 piece', fiber: 2, sugar: 0.5 },
  'bhature': { calories: 200, protein: 4, carbs: 28, fat: 8, serving: '1 piece', fiber: 1, sugar: 1 },
  'thepla': { calories: 150, protein: 4, carbs: 18, fat: 7, serving: '1 piece', fiber: 2, sugar: 0.5 },
  'kulcha': { calories: 175, protein: 5, carbs: 28, fat: 5, serving: '1 piece', fiber: 1.5, sugar: 1 },
  'samosa': { calories: 260, protein: 5, carbs: 30, fat: 14, serving: '1 piece', fiber: 2, sugar: 2 },
  'pakora': { calories: 180, protein: 4, carbs: 16, fat: 12, serving: '5 pieces', fiber: 1.5, sugar: 1 },
  'onion bhaji': { calories: 170, protein: 3, carbs: 15, fat: 11, serving: '3 pieces', fiber: 1, sugar: 2 },
  'pav bhaji': { calories: 380, protein: 10, carbs: 48, fat: 16, serving: '1 plate (2 pav + bhaji)', fiber: 5, sugar: 6 },
  'poori': { calories: 101, protein: 2.5, carbs: 12, fat: 5, serving: '1 piece', fiber: 0.5, sugar: 0.3 },
  'papadam': { calories: 40, protein: 2, carbs: 5, fat: 1.5, serving: '1 piece', fiber: 1, sugar: 0.2 },
  'raita': { calories: 60, protein: 3, carbs: 5, fat: 3, serving: '1/2 cup', fiber: 0.5, sugar: 4 },
  'lassi': { calories: 170, protein: 6, carbs: 26, fat: 5, serving: '1 glass (250ml)', fiber: 0, sugar: 22 },
  'mango lassi': { calories: 200, protein: 6, carbs: 32, fat: 5, serving: '1 glass (250ml)', fiber: 0.5, sugar: 28 },
  'chai': { calories: 90, protein: 3, carbs: 12, fat: 3, serving: '1 cup with milk', fiber: 0, sugar: 10 },
  'masala chai': { calories: 90, protein: 3, carbs: 12, fat: 3, serving: '1 cup with milk', fiber: 0, sugar: 10 },
  'gulab jamun': { calories: 175, protein: 3, carbs: 28, fat: 6, serving: '2 pieces', fiber: 0.3, sugar: 22 },
  'jalebi': { calories: 150, protein: 1, carbs: 30, fat: 4, serving: '2 pieces', fiber: 0, sugar: 25 },
  'laddu': { calories: 180, protein: 3, carbs: 22, fat: 9, serving: '1 piece', fiber: 1, sugar: 15 },
  'payasam': { calories: 220, protein: 5, carbs: 35, fat: 7, serving: '1 cup', fiber: 0.5, sugar: 28 },
  'filter coffee': { calories: 75, protein: 2, carbs: 8, fat: 3.5, serving: '1 cup with milk', fiber: 0, sugar: 7 },
};

let dietBackfillNotified = false;
let recentFoodsOpen = null; // per-meal open/collapsed state, survives re-renders

function renderDiet() {
  const dateInput = $('#dietDate');
  if (!dateInput) return;

  // Bank any dishes from the log that aren't in the food bank yet
  // (history from before auto-remember, or entries synced from other devices)
  const backfilled = backfillRememberedFoods();
  if (backfilled > 0) {
    saveData(state);
    if (!dietBackfillNotified) {
      dietBackfillNotified = true;
      showToast(`Added ${backfilled} dish${backfilled === 1 ? '' : 'es'} from your log to My Foods`);
    }
  }
  // Ensure dietViewDate is set
  if (!dietViewDate) dietViewDate = getTodayStr();
  dateInput.value = dietViewDate;

  // Date navigation label
  const todayStr = getTodayStr();
  const isToday = dietViewDate === todayStr;
  const viewDate = new Date(dietViewDate + 'T00:00:00');
  $('#dietDateLabel').textContent = isToday ? 'Today' :
    viewDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const dayLabel = isToday ? "Today's Nutrition" :
    new Date(dietViewDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  $('#dietSummaryTitle').textContent = dietViewDate === todayStr ? "Today's Nutrition" : dayLabel;

  const dayEntries = state.diet.filter(e => e.date === dietViewDate);

  // Totals
  const totals = dayEntries.reduce((acc, e) => {
    acc.calories += (e.calories || 0);
    acc.protein += (e.protein || 0);
    acc.carbs += (e.carbs || 0);
    acc.fat += (e.fat || 0);
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

  // Goal tracker
  renderDietGoals(totals);

  // Food recommendations based on remaining macros
  renderDietRecs(totals);

  // Skip-list for today, learned from the last logged day
  renderYesterdayAdvice();

  // End-of-day review: what pushed you over each macro
  renderDietReview(totals, dayEntries);

  // Water tracker
  renderWater();

  // Meals grouped
  const meals = ['breakfast', 'lunch', 'dinner', 'snack'];
  const mealLabels = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };

  // Every meal is listed, even empty ones (design_handoff_daylign_v2 section 4:
  // "Empty meals still show (0 cal + add row)"). A day's plan reads as a whole
  // this way — an empty Dinner is information, and it gives you somewhere to
  // tap. Hiding it made the log look finished when it wasn't.
  const mealGroups = meals.map(meal => ({
    meal,
    label: mealLabels[meal],
    entries: dayEntries.filter(e => e.meal === meal),
  }));

  {
    $('#dietMealsList').innerHTML = mealGroups.map(g => {
      const mealMacros = g.entries.reduce((s, e) => {
        s.calories += (e.calories || 0);
        s.protein += (e.protein || 0);
        s.carbs += (e.carbs || 0);
        s.fat += (e.fat || 0);
        return s;
      }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
      const isEmpty = g.entries.length === 0;
      return `
        <div class="diet-meal-group${isEmpty ? ' is-empty' : ''}">
          <div class="diet-meal-header">
            <span class="diet-meal-name">${g.label}</span>
            <span class="diet-meal-cal">
              <span class="diet-meal-cal-val">${Math.round(mealMacros.calories)} cal</span>
              ${isEmpty ? '' : `
              <span class="diet-meal-macro">${Math.round(mealMacros.protein)}g P</span>
              <span class="diet-meal-macro">${Math.round(mealMacros.carbs)}g C</span>
              <span class="diet-meal-macro">${Math.round(mealMacros.fat)}g F</span>`}
            </span>
          </div>
          ${g.entries.map(e => {
            const idx = state.diet.indexOf(e);
            return `
              <div class="diet-food-entry">
                <div class="diet-food-entry-main">
                  <span class="diet-food-name">${esc(e.food)}</span>
                  <span class="diet-food-servings">${e.servings !== 1 ? e.servings + 'x' : ''}</span>
                  <button class="diet-delete-food" data-diet-idx="${idx}">&times;</button>
                </div>
                <div class="diet-food-macros">
                  <span>${Math.round(e.calories || 0)} cal</span>
                  <span>${Math.round(e.protein || 0)}g P</span>
                  <span>${Math.round(e.carbs || 0)}g C</span>
                  <span>${Math.round(e.fat || 0)}g F</span>
                </div>
              </div>`;
          }).join('')}
          <button type="button" class="diet-meal-add" data-add-meal="${g.meal}">+ Add to ${g.label}</button>
        </div>`;
    }).join('');
  }

  // "Add to <meal>" jumps to the log form with that meal preselected, so the
  // row you tapped is the row the food lands in.
  $$('.diet-meal-add').forEach(btn => {
    btn.addEventListener('click', () => {
      const select = $('#dietMeal');
      if (select) select.value = btn.dataset.addMeal;
      const name = $('#dietFoodName');
      if (name) {
        name.scrollIntoView({ behavior: 'smooth', block: 'center' });
        name.focus();
      }
    });
  });

  // Delete food
  $$('.diet-delete-food').forEach(btn => {
    btn.addEventListener('click', () => {
      state.diet.splice(Number(btn.dataset.dietIdx), 1);
      saveData(state);
      renderDiet();
    });
  });

  // Recent Foods — unique dishes per meal, newest first, tap to re-log.
  // Grouped into collapsible time-of-day sections; the bank keeps powering search.
  const RECENT_MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];
  const RECENT_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };
  const PER_MEAL_LIMIT = 6;
  const recentGroups = { breakfast: [], lunch: [], dinner: [], snack: [] };
  const recentSeen = { breakfast: new Set(), lunch: new Set(), dinner: new Set(), snack: new Set() };
  const recentFoods = []; // flat list so click/delete handlers can index into it

  for (let i = state.diet.length - 1; i >= 0; i--) {
    const e = state.diet[i];
    const name = (e.food || '').trim();
    if (!name) continue;
    const meal = RECENT_MEALS.includes(e.meal) ? e.meal : 'snack';
    if (recentGroups[meal].length >= PER_MEAL_LIMIT) continue;
    const lower = name.toLowerCase();
    if (recentSeen[meal].has(lower) || isRemovedFood(lower)) continue;
    recentSeen[meal].add(lower);
    // Per-serving macros from the bank when available, else derived from the entry
    const bankedEntry = Object.entries(state.customFoods).find(([k]) => k.toLowerCase() === lower);
    const banked = (bankedEntry && bankedEntry[1]) || FOOD_DATABASE[lower] || (typeof sharedFoods !== 'undefined' && sharedFoods[lower]);
    const n = Number(e.servings) > 0 ? Number(e.servings) : 1;
    const per = banked || {
      calories: Math.round((e.calories || 0) / n),
      protein: Math.round(((e.protein || 0) / n) * 10) / 10,
      carbs: Math.round(((e.carbs || 0) / n) * 10) / 10,
      fat: Math.round(((e.fat || 0) / n) * 10) / 10,
      serving: '1 serving',
    };
    const item = { name, meal, per, idx: recentFoods.length };
    recentFoods.push(item);
    recentGroups[meal].push(item);
  }

  // First render: open the meal that matches the time of day, collapse the rest
  if (!recentFoodsOpen) {
    const hour = new Date().getHours();
    const nowMeal = hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : hour < 22 ? 'dinner' : 'snack';
    recentFoodsOpen = { breakfast: false, lunch: false, dinner: false, snack: false, [nowMeal]: true };
  }

  // Full food bank — every banked dish (your South Indian pool + saved brands), A→Z
  const bankEntries = Object.entries(state.customFoods).sort((a, b) => a[0].localeCompare(b[0]));

  if (!recentFoods.length && !bankEntries.length) {
    $('#dietCustomList').innerHTML = '<div class="empty-state"><p>Foods you log will show up here for quick re-adding</p></div>';
  } else {
    const chevron = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9,6 15,12 9,18"/></svg>';
    const foodItem = (name, per, attrs) => `
      <div class="diet-custom-item" ${attrs}>
        <div class="diet-custom-item-main">
          <span class="diet-custom-item-name">${esc(name)}</span>
          <button class="diet-custom-edit" data-edit-name="${esc(name)}" title="Fix this food's macros"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>
          <button class="diet-custom-del" data-del-name="${esc(name)}" title="Remove from the food bank">&times;</button>
        </div>
        <div class="diet-custom-item-macros">
          <span>${Math.round(per.calories)} cal</span>
          <span>${per.protein}g P</span>
          <span>${per.carbs}g C</span>
          <span>${per.fat}g F</span>
        </div>
      </div>`;

    const groupsHtml = RECENT_MEALS.filter(m => recentGroups[m].length).map(meal => `
      <div class="recent-meal ${recentFoodsOpen[meal] ? 'open' : ''}" data-recent-meal="${meal}">
        <div class="recent-meal-header">
          <span class="recent-meal-chevron">${chevron}</span>
          <span class="recent-meal-label">${RECENT_LABELS[meal]}</span>
          <span class="recent-meal-count">${recentGroups[meal].length}</span>
        </div>
        <div class="recent-meal-body">
          ${recentGroups[meal].map(f => foodItem(f.name, f.per, `data-recent-idx="${f.idx}"`)).join('')}
        </div>
      </div>
    `).join('');

    const bankHtml = bankEntries.length ? `
      <div class="recent-meal recent-bank ${recentFoodsOpen.bank ? 'open' : ''}" data-recent-meal="bank">
        <div class="recent-meal-header">
          <span class="recent-meal-chevron">${chevron}</span>
          <span class="recent-meal-label">My Food Bank</span>
          <span class="recent-meal-count">${bankEntries.length}</span>
        </div>
        <div class="recent-meal-body">
          ${bankEntries.map(([name, data]) => foodItem(name, data, `data-bank-name="${esc(name)}"`)).join('')}
        </div>
      </div>` : '';

    $('#dietCustomList').innerHTML = groupsHtml + bankHtml;

    // Toggle sections without a full re-render (keeps it snappy)
    $$('.recent-meal-header').forEach(header => {
      header.addEventListener('click', () => {
        const group = header.closest('.recent-meal');
        const meal = group.dataset.recentMeal;
        recentFoodsOpen[meal] = !recentFoodsOpen[meal];
        group.classList.toggle('open', recentFoodsOpen[meal]);
      });
    });

    $$('.diet-custom-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.delName;
        if (!name) return;
        const lower = name.toLowerCase();
        state.removedFoods = state.removedFoods || [];
        if (!state.removedFoods.includes(lower)) state.removedFoods.push(lower);
        // Drop any case-variant from the food bank
        for (const k of Object.keys(state.customFoods)) {
          if (k.toLowerCase() === lower) delete state.customFoods[k];
        }
        saveData(state);
        renderDiet();
        showToast(`${name} removed — it won't be auto-added again`);
      });
    });

    // Edit: load the food into the form so corrected macros can overwrite it
    $$('.diet-custom-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const name = btn.dataset.editName;
        if (!name) return;
        const lower = name.toLowerCase();
        const entry = Object.entries(state.customFoods).find(([k]) => k.toLowerCase() === lower);
        const data = (entry && entry[1]) || FOOD_DATABASE[lower] || (typeof sharedFoods !== 'undefined' && sharedFoods[lower]);
        if (!data) return;
        selectFoodFromDropdown(entry ? entry[0] : name, data);
        $('#dietFoodName').scrollIntoView({ behavior: 'smooth', block: 'center' });
        showToast(`Editing ${name} — fix the macros, then press Update My Food`);
      });
    });

    $$('.diet-custom-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.diet-custom-del')) return;
        if (el.dataset.recentIdx !== undefined) {
          const f = recentFoods[Number(el.dataset.recentIdx)];
          if (!f) return;
          selectFoodFromDropdown(f.name, f.per);
          if (f.meal) $('#dietMeal').value = f.meal;
        } else if (el.dataset.bankName) {
          const data = state.customFoods[el.dataset.bankName];
          if (data) selectFoodFromDropdown(el.dataset.bankName, data);
        }
      });
    });
  }

  // History (last 14 unique days)
  const historyDays = [...new Set(state.diet.map(e => e.date))].sort().reverse().filter(d => d !== dietViewDate).slice(0, 14);
  if (!historyDays.length) {
    $('#dietHistoryList').innerHTML = '<div class="empty-state"><p>No diet history</p></div>';
  } else {
    $('#dietHistoryList').innerHTML = historyDays.map(day => {
      const entries = state.diet.filter(e => e.date === day);
      const dayTotals = entries.reduce((acc, e) => {
        acc.calories += (e.calories || 0);
        acc.protein += (e.protein || 0);
        acc.carbs += (e.carbs || 0);
        acc.fat += (e.fat || 0);
        return acc;
      }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
      return `
        <div class="diet-history-day" data-diet-day="${day}">
          <div class="diet-history-day-header">
            <span class="diet-history-date">${new Date(day + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            <span class="diet-history-cal ${dayTotals.calories > getGoals().calories ? 'over-budget' : 'under-budget'}"
              title="${dayTotals.calories > getGoals().calories ? 'Over' : 'Under'} the ${getGoals().calories} cal budget">${Math.round(dayTotals.calories)} cal</span>
          </div>
          <div class="diet-history-macros">
            <span>${Math.round(dayTotals.protein)}g P</span>
            <span>${Math.round(dayTotals.carbs)}g C</span>
            <span>${Math.round(dayTotals.fat)}g F</span>
          </div>
        </div>`;
    }).join('');

    $$('.diet-history-day').forEach(el => {
      el.addEventListener('click', () => {
        dietViewDate = el.dataset.dietDay;
        renderDiet();
      });
    });
  }
}

function searchFoodDatabase(query) {
  query = query.toLowerCase().trim();
  if (!query) return [];
  const results = [];

  // Search custom foods first (score -1 to prioritize)
  for (const [name, data] of Object.entries(state.customFoods)) {
    const lower = name.toLowerCase();
    if (lower.startsWith(query)) {
      results.push({ name, data, score: -1, custom: true });
    } else if (lower.includes(query)) {
      results.push({ name, data, score: 0, custom: true });
    } else {
      const words = query.split(/\s+/);
      if (words.every(w => lower.includes(w))) {
        results.push({ name, data, score: 1, custom: true });
      }
    }
  }

  // Shared community bank (foods other people saved), skipping anything already
  // in your own bank so it isn't listed twice.
  const own = new Set(Object.keys(state.customFoods).map(k => k.toLowerCase()));
  if (typeof sharedFoods !== 'undefined' && sharedFoods) {
    for (const [lower, data] of Object.entries(sharedFoods)) {
      if (own.has(lower)) continue;
      const name = data.name || lower;
      if (lower.startsWith(query)) results.push({ name, data, score: -0.5, shared: true });
      else if (lower.includes(query)) results.push({ name, data, score: 0.5, shared: true });
      else {
        const words = query.split(/\s+/);
        if (words.every(w => lower.includes(w))) results.push({ name, data, score: 1.5, shared: true });
      }
    }
  }

  // Then built-in database
  const already = new Set(results.map(r => r.name.toLowerCase()));
  for (const [name, data] of Object.entries(FOOD_DATABASE)) {
    if (already.has(name.toLowerCase())) continue;
    if (name.startsWith(query)) {
      results.push({ name, data, score: 0 });
    } else if (name.includes(query)) {
      results.push({ name, data, score: 1 });
    } else {
      const words = query.split(/\s+/);
      if (words.every(w => name.includes(w))) {
        results.push({ name, data, score: 2 });
      }
    }
  }
  return results.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name)).slice(0, 8);
}

function selectFoodFromDropdown(name, data) {
  $('#dietFoodName').value = name.charAt(0).toUpperCase() + name.slice(1);
  dietBaseMacros = { calories: data.calories, protein: data.protein, carbs: data.carbs, fat: data.fat };
  $('#dietServings').value = 1;
  updateMacrosByServings();
  $('#dietSearchDropdown').innerHTML = '';
  $('#dietSearchDropdown').classList.remove('visible');
  const info = [`Per serving: ${data.serving}`];
  if (data.fiber) info.push(`Fiber: ${data.fiber}g`);
  if (data.sugar) info.push(`Sugar: ${data.sugar}g`);
  $('#dietServingInfo').innerHTML = `<span class="diet-serving-tag">${info.join(' &middot; ')}</span>`;
  syncSaveCustomLabel();
}

// "Save as My Food" flips to "Update My Food" when the typed name is already banked
function syncSaveCustomLabel() {
  const label = $('#dietSaveCustomLabel');
  if (!label) return;
  const name = ($('#dietFoodName').value || '').trim().toLowerCase();
  const exists = name && Object.keys(state.customFoods).some(k => k.toLowerCase() === name);
  label.textContent = exists ? 'Update My Food' : 'Save as My Food';
}

// Auto-add a logged food to the searchable food database (My Foods) if it's new.
// Stores PER-SERVING macros so quantities scale correctly next time.
// Foods the user explicitly deleted — never auto-add these again
function isRemovedFood(name) {
  return (state.removedFoods || []).includes((name || '').trim().toLowerCase());
}

function rememberFood(name, totals, servings) {
  const key = (name || '').trim();
  if (!key) return false;
  const lower = key.toLowerCase();
  // User deleted this food before — respect that.
  if (isRemovedFood(lower)) return false;
  // Already a built-in food? Nothing to remember.
  if (FOOD_DATABASE[lower]) return false;
  // Already saved (case-insensitive)? Don't duplicate or overwrite.
  if (Object.keys(state.customFoods).some(k => k.toLowerCase() === lower)) return false;
  // No macros worth saving.
  if (!totals.calories) return false;

  // Fractional servings (0.5x chutney) must divide correctly — never round up to 1
  const n = Number(servings) > 0 ? Number(servings) : 1;
  // Prefer per-serving macros captured when picking from a dropdown; otherwise
  // derive them from the entered totals divided by servings.
  const per = dietBaseMacros ? dietBaseMacros : {
    calories: Math.round(totals.calories / n),
    protein: Math.round((totals.protein / n) * 10) / 10,
    carbs: Math.round((totals.carbs / n) * 10) / 10,
    fat: Math.round((totals.fat / n) * 10) / 10,
  };
  const serving = ($('#dietServingInfo').textContent || '')
    .replace(/^Per\s+(serving:\s*)?/i, '')
    .split('·')[0]
    .replace(/\(.*$/, '')
    .trim() || '1 serving';

  state.customFoods[key] = {
    calories: per.calories,
    protein: per.protein,
    carbs: per.carbs,
    fat: per.fat,
    serving,
    fiber: 0,
    sugar: 0,
  };
  if (typeof publishFoodToBank === 'function') publishFoodToBank(key, state.customFoods[key]);
  return true;
}

// Sweep the whole diet log and bank any dish that isn't searchable yet.
// Catches foods logged before auto-remember existed and entries synced in
// from other devices. Iterates newest-first so the latest macros win.
function backfillRememberedFoods() {
  let added = 0;
  const seen = new Set(Object.keys(state.customFoods).map(k => k.toLowerCase()));
  for (let i = state.diet.length - 1; i >= 0; i--) {
    const e = state.diet[i];
    const key = (e.food || '').trim();
    if (!key) continue;
    const lower = key.toLowerCase();
    if (FOOD_DATABASE[lower] || seen.has(lower) || isRemovedFood(lower)) continue;
    if (!e.calories) continue;
    const n = Number(e.servings) > 0 ? Number(e.servings) : 1;
    state.customFoods[key] = {
      calories: Math.round(e.calories / n),
      protein: Math.round(((e.protein || 0) / n) * 10) / 10,
      carbs: Math.round(((e.carbs || 0) / n) * 10) / 10,
      fat: Math.round(((e.fat || 0) / n) * 10) / 10,
      serving: '1 serving',
      fiber: 0,
      sugar: 0,
    };
    if (typeof publishFoodToBank === 'function') publishFoodToBank(key, state.customFoods[key]);
    seen.add(lower);
    added++;
  }
  return added;
}

function updateMacrosByServings() {
  if (!dietBaseMacros) return;
  const servings = Number($('#dietServings').value) || 1;
  $('#dietCalories').value = Math.round(dietBaseMacros.calories * servings);
  $('#dietProtein').value = Math.round(dietBaseMacros.protein * servings * 10) / 10;
  $('#dietCarbs').value = Math.round(dietBaseMacros.carbs * servings * 10) / 10;
  $('#dietFat').value = Math.round(dietBaseMacros.fat * servings * 10) / 10;
}

function parseOFFNutrients(product) {
  const n = product.nutriments || {};
  // energy-kcal_100g is preferred; fallback to energy_100g (kJ) converted to kcal
  let cal = n['energy-kcal_100g'] || n['energy-kcal_serving'] || n['energy-kcal'] || 0;
  if (!cal && (n['energy_100g'] || n['energy'])) {
    cal = Math.round((n['energy_100g'] || n['energy']) / 4.184);
  }
  return {
    calories: Math.round(cal),
    protein: Math.round((n.proteins_100g || n.proteins_serving || n.proteins || 0) * 10) / 10,
    carbs: Math.round((n.carbohydrates_100g || n.carbohydrates_serving || n.carbohydrates || 0) * 10) / 10,
    fat: Math.round((n.fat_100g || n.fat_serving || n.fat || 0) * 10) / 10,
    fiber: Math.round((n.fiber_100g || n.fiber_serving || n.fiber || 0) * 10) / 10,
    sugar: Math.round((n.sugars_100g || n.sugars_serving || n.sugars || 0) * 10) / 10,
  };
}

function fetchWithTimeout(url, ms = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function lookupFoodAPI(query) {
  const dropdown = $('#dietSearchDropdown');
  // Don't replace dropdown if user is hovering over it
  const isHovered = dropdown.matches(':hover');
  if (isHovered) return;
  dropdown.innerHTML = '<div class="diet-search-loading">Searching food databases...</div>';
  dropdown.classList.add('visible');

  // Run both APIs in parallel with a 3s timeout each
  const offUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=6&fields=product_name,brands,nutriments,serving_size`;
  const usdaUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=6&dataType=Survey%20(FNDDS),Branded&api_key=DEMO_KEY`;

  const [offResult, usdaResult] = await Promise.allSettled([
    fetchWithTimeout(offUrl).then(r => r.ok ? r.json() : null).catch(() => null),
    fetchWithTimeout(usdaUrl).then(r => r.ok ? r.json() : null).catch(() => null),
  ]);

  let results = [];

  // Parse Open Food Facts
  const offData = offResult.status === 'fulfilled' ? offResult.value : null;
  if (offData && offData.products) {
    results.push(...offData.products
      .filter(p => p.product_name && p.nutriments)
      .map(p => ({
        name: p.product_name,
        brand: p.brands || '',
        serving: p.serving_size || '100g',
        source: 'OFF',
        ...parseOFFNutrients(p),
      })));
  }

  // Parse USDA
  const usdaData = usdaResult.status === 'fulfilled' ? usdaResult.value : null;
  if (usdaData && usdaData.foods) {
    usdaData.foods.forEach(food => {
      const nutrients = {};
      (food.foodNutrients || []).forEach(n => {
        if (n.nutrientName === 'Energy') nutrients.calories = Math.round(n.value || 0);
        if (n.nutrientName === 'Protein') nutrients.protein = Math.round((n.value || 0) * 10) / 10;
        if (n.nutrientName === 'Carbohydrate, by difference') nutrients.carbs = Math.round((n.value || 0) * 10) / 10;
        if (n.nutrientName === 'Total lipid (fat)') nutrients.fat = Math.round((n.value || 0) * 10) / 10;
        if (n.nutrientName === 'Fiber, total dietary') nutrients.fiber = Math.round((n.value || 0) * 10) / 10;
        if (n.nutrientName === 'Sugars, total including NLEA') nutrients.sugar = Math.round((n.value || 0) * 10) / 10;
      });
      results.push({
        name: food.description,
        brand: food.brandName || food.brandOwner || '',
        serving: food.servingSize ? `${food.servingSize}${food.servingSizeUnit || 'g'}` : '100g',
        source: 'USDA',
        ...nutrients,
      });
    });
  }

  // Deduplicate by name
  const seen = new Set();
  results = results.filter(r => {
    const key = (r.name + r.brand).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return r.calories > 0;
  }).slice(0, 8);

  if (!results.length) {
    dropdown.innerHTML = '<div class="diet-search-empty">No results found. Try a different search or enter macros manually.</div>';
    return;
  }

  dropdown.innerHTML = results.map((r, i) => `
    <div class="diet-search-item diet-api-result" data-api-idx="${i}">
      <div class="diet-search-item-name">${esc(r.name)}${r.brand ? ` <span class="diet-search-brand">${esc(r.brand)}</span>` : ''}</div>
      <div class="diet-search-item-macros">
        <span>${r.calories} cal</span>
        <span>${r.protein}g P</span>
        <span>${r.carbs}g C</span>
        <span>${r.fat}g F</span>
        <span class="diet-search-per">per ${r.serving}</span>
      </div>
    </div>
  `).join('');

  $$('.diet-api-result').forEach((el, i) => {
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const r = results[i];
      const displayName = r.name.split(',')[0].split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      $('#dietFoodName').value = r.brand ? `${displayName} (${r.brand})` : displayName;
      dietBaseMacros = { calories: r.calories || 0, protein: r.protein || 0, carbs: r.carbs || 0, fat: r.fat || 0 };
      $('#dietServings').value = 1;
      updateMacrosByServings();
      dropdown.innerHTML = '';
      dropdown.classList.remove('visible');
      const info = [`Per ${r.serving} (${r.source}${r.brand ? ' - ' + r.brand : ''})`];
      if (r.fiber) info.push(`Fiber: ${r.fiber}g`);
      if (r.sugar) info.push(`Sugar: ${r.sugar}g`);
      $('#dietServingInfo').innerHTML = `<span class="diet-serving-tag">${info.join(' &middot; ')}</span>`;
    });
  });
}

let dietSearchTimeout = null;

function bindDietEvents() {
  $('#dietDate').addEventListener('change', (e) => { dietViewDate = e.target.value; renderDiet(); });
  $('#dietPrevDay').addEventListener('click', () => {
    const d = new Date(dietViewDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    dietViewDate = toLocalDateStr(d);
    renderDiet();
  });
  $('#dietNextDay').addEventListener('click', () => {
    const d = new Date(dietViewDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    dietViewDate = toLocalDateStr(d);
    renderDiet();
  });
  $('#dietToday').addEventListener('click', () => {
    dietViewDate = getTodayStr();
    renderDiet();
  });

  // Servings → recalculate macros in real time
  $('#dietServings').addEventListener('input', updateMacrosByServings);

  // Water
  bindWaterEvents();

  const foodInput = $('#dietFoodName');
  const dropdown = $('#dietSearchDropdown');
  let localSearchTimeout = null;
  let dropdownHovered = false;

  // Track mouse over dropdown — never replace content while hovered
  dropdown.addEventListener('mouseenter', () => { dropdownHovered = true; });
  dropdown.addEventListener('mouseleave', () => { dropdownHovered = false; });

  function buildDropdown(query) {
    const localResults = searchFoodDatabase(query);

    if (localResults.length) {
      dropdown.innerHTML = localResults.map(r => `
        <div class="diet-search-item" data-food-key="${r.name}" data-food-custom="${r.custom ? '1' : ''}">
          <div class="diet-search-item-name">${esc(r.name.charAt(0).toUpperCase() + r.name.slice(1))}${r.custom ? ' <span class="diet-custom-badge">My Food</span>' : r.shared ? ' <span class="diet-custom-badge diet-shared-badge">Community</span>' : ''}</div>
          <div class="diet-search-item-macros">
            <span>${r.data.calories} cal</span>
            <span>${r.data.protein}g P</span>
            <span>${r.data.carbs}g C</span>
            <span>${r.data.fat}g F</span>
            <span class="diet-search-per">${r.data.serving}</span>
          </div>
        </div>
      `).join('') + `<div class="diet-search-item diet-search-api-btn" id="dietApiLookup">
        <div class="diet-search-item-name">Search online for "${esc(query)}"...</div>
      </div>`;
      dropdown.classList.add('visible');

      if (localResults.length <= 2) {
        dietSearchTimeout = setTimeout(() => {
          if (!dropdownHovered) lookupFoodAPI(query);
        }, 3000);
      }
    } else {
      dropdown.innerHTML = '<div class="diet-search-empty-hint">No local match. Searching online...</div>';
      dropdown.classList.add('visible');
      dietSearchTimeout = setTimeout(() => {
        if (!dropdownHovered) lookupFoodAPI(query);
      }, 1500);
    }

    bindDropdownClicks(query);
  }

  function bindDropdownClicks(query) {
    $$('.diet-search-item[data-food-key]').forEach(el => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const key = el.dataset.foodKey;
        const data = state.customFoods[key] || FOOD_DATABASE[key.toLowerCase()] || (typeof sharedFoods !== 'undefined' && sharedFoods[key.toLowerCase()]);
        if (data) selectFoodFromDropdown(key, data);
      });
    });
    const apiBtn = $('#dietApiLookup');
    if (apiBtn) {
      apiBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        lookupFoodAPI(query);
      });
    }
  }

  foodInput.addEventListener('input', () => {
    dietBaseMacros = null;
    clearTimeout(dietSearchTimeout);
    clearTimeout(localSearchTimeout);
    $('#dietServingInfo').innerHTML = '';
    syncSaveCustomLabel();

    const query = foodInput.value.trim();
    if (query.length < 2) {
      if (!dropdownHovered) {
        dropdown.innerHTML = '';
        dropdown.classList.remove('visible');
      }
      return;
    }

    // Show local results immediately (no debounce) — only debounce API lookups
    if (!dropdownHovered) buildDropdown(query);
  });

  // Close dropdown on click outside
  document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('.diet-search-wrapper')) {
      dropdown.innerHTML = '';
      dropdown.classList.remove('visible');
    }
  });

  // Re-open on focus only if dropdown is closed
  foodInput.addEventListener('focus', () => {
    const query = foodInput.value.trim();
    if (query.length >= 2 && !dropdown.classList.contains('visible')) {
      buildDropdown(query);
    }
  });

  $('#dietSaveBtn').addEventListener('click', () => {
    const food = $('#dietFoodName').value.trim();
    if (!food) return;
    const servings = Number($('#dietServings').value) || 1;
    const calories = Number($('#dietCalories').value) || 0;
    const protein = Number($('#dietProtein').value) || 0;
    const carbs = Number($('#dietCarbs').value) || 0;
    const fat = Number($('#dietFat').value) || 0;
    state.diet.push({
      date: dietViewDate,
      meal: $('#dietMeal').value,
      food,
      servings,
      // Macros already include servings multiplier from the input fields
      calories,
      protein,
      carbs,
      fat,
    });
    // Auto-remember any new food so it shows up in search next time
    if (rememberFood(food, { calories, protein, carbs, fat }, servings)) {
      showToast(`✓ ${food} saved to My Foods`);
    }
    saveData(state);
    clearDietForm();
    renderDiet();
  });

  // Save as custom food — also the override path for fixing a banked mistake
  $('#dietSaveCustomBtn').addEventListener('click', () => {
    const food = $('#dietFoodName').value.trim();
    const calories = Number($('#dietCalories').value);
    if (!food) { alert('Enter a food name first.'); return; }
    if (!calories) { alert('Fill in the macros before saving.'); return; }
    const lower = food.toLowerCase();
    // Explicit save overrides an earlier delete
    state.removedFoods = (state.removedFoods || []).filter(n => n !== lower);
    // Replace any case-variant instead of duplicating it
    const existed = Object.keys(state.customFoods).some(k => k.toLowerCase() === lower);
    for (const k of Object.keys(state.customFoods)) {
      if (k.toLowerCase() === lower) delete state.customFoods[k];
    }
    // The macro fields hold totals for the current servings count — bank per-serving
    const n = Number($('#dietServings').value) > 0 ? Number($('#dietServings').value) : 1;
    const serving = ($('#dietServingInfo').textContent || '').replace(/^Per serving:\s*/i, '').split('·')[0].trim() || '1 serving';
    state.customFoods[food] = {
      calories: Math.round(calories / n),
      protein: Math.round(((Number($('#dietProtein').value) || 0) / n) * 10) / 10,
      carbs: Math.round(((Number($('#dietCarbs').value) || 0) / n) * 10) / 10,
      fat: Math.round(((Number($('#dietFat').value) || 0) / n) * 10) / 10,
      serving,
      fiber: 0,
      sugar: 0,
    };
    if (typeof publishFoodToBank === 'function') publishFoodToBank(food, state.customFoods[food]);
    saveData(state);
    renderDiet();
    showToast(existed ? `✓ ${food} updated in My Foods` : `✓ ${food} saved to My Foods`);
    $('#dietServingInfo').innerHTML = `<span class="diet-serving-tag">${existed ? 'Updated!' : 'Saved to My Foods!'}</span>`;
    syncSaveCustomLabel();
  });
}

// ========== Goal Tracker ==========
// Defaults: 25yo male, 5'10", ~160 lbs → 150 lbs cut (started Jul 2026)
// BMR ~1720, TDEE ~2500, -500 deficit = ~2000 cal/day (~1 lb/week)
// User-editable via the Goals modal; overrides live in state.goals (synced).
const DEFAULT_GOALS = {
  calories: 2000,
  protein: 150,  // keep high on a cut to hold onto muscle
  carbs: 215,
  fat: 60,
  water: 66,     // oz/day
  weight: 150,   // lbs target
  burn: 300,     // cal/day from exercise — pads the deficit so diet slip-ups still net out
};

function getGoals() {
  return { ...DEFAULT_GOALS, ...(state.goals || {}) };
}

// Redesigned per design_handoff_daylign_v2 §4: a big calorie ring plus three
// macro mini-rings that spell out eaten / goal in grams with a "left" chip —
// the explicit user correction was that a percent alone isn't enough.
// Daylign's burn-aware net line is preserved as a caption under the ring.
function renderDietGoals(totals) {
  const goals = getGoals();
  const cal = Math.round(totals.calories);
  const calPct = Math.min(100, Math.round((cal / goals.calories) * 100));
  const calLeft = goals.calories - cal;

  const burnInfo = (typeof burnForDate === 'function') ? burnForDate(dietViewDate)
    : (typeof estimateBurnForDate === 'function') ? { cal: estimateBurnForDate(dietViewDate), watch: false }
    : { cal: 0, watch: false };
  const burn = Number.isFinite(burnInfo.cal) ? Math.max(0, Math.round(burnInfo.cal)) : 0;
  const src = burnInfo.watch ? 'activity' : 'training';
  let netLine;
  if (calLeft >= 0) {
    netLine = burn > 0 ? `${calLeft} left · +${burn} from ${src} → ${calLeft + burn} net` : `${calLeft} left`;
  } else {
    const overBy = -calLeft;
    netLine = burn > 0
      ? (overBy - burn <= 0 ? `Over by ${overBy} — ${src} covered it, net under` : `Over by ${overBy} · net ${overBy - burn} over after ${src}`)
      : `Over by ${overBy}`;
  }

  // README run/domain palette: protein green, carbs blue, fat amber.
  const macros = [
    { label: 'Protein', current: Math.round(totals.protein), goal: goals.protein, color: '#34d399' },
    { label: 'Carbs', current: Math.round(totals.carbs), goal: goals.carbs, color: '#5aa5f9' },
    { label: 'Fat', current: Math.round(totals.fat), goal: goals.fat, color: '#fbbf24' },
  ];

  const macroHTML = macros.map(m => {
    const pct = Math.min(100, Math.round((m.current / m.goal) * 100));
    const left = m.goal - m.current;
    const leftTxt = left >= 0 ? `${left}g left` : `${-left}g over`;
    return `
      <div class="dg-macro">
        <div class="dg-macro-ring" style="background:conic-gradient(${m.color} 0 ${pct}%, var(--border) ${pct}% 100%)">
          <div class="dg-macro-hole"><span class="tnum" style="color:${m.color}">${pct}%</span></div>
        </div>
        <div class="dg-macro-val tnum">${m.current}<span class="dg-macro-goal"> / ${m.goal}g</span></div>
        <div class="dg-macro-label">${m.label}</div>
        <div class="dg-macro-left tnum" style="color:${m.color}">${leftTxt}</div>
      </div>`;
  }).join('');

  $('#dietGoals').innerHTML = `
    <div class="dg-cal-wrap">
      <div class="dg-cal-ring" style="background:conic-gradient(var(--accent) 0 ${calPct}%, var(--border) ${calPct}% 100%)">
        <div class="dg-cal-hole">
          <span class="dg-cal-num tnum">${cal}</span>
          <span class="dg-cal-of">of ${goals.calories} cal</span>
          <span class="dg-cal-left tnum ${calLeft < 0 ? 'over' : ''}">${calLeft >= 0 ? calLeft + ' left' : -calLeft + ' over'}</span>
        </div>
      </div>
    </div>
    <div class="dg-net">${netLine}</div>
    <div class="dg-macros">${macroHTML}</div>`;
}

// ========== Food Recommendations ==========
// Cutting: high protein, high volume, calorie-conscious (South Indian friendly)
const CUT_RECOMMENDATIONS = [
  { meal: 'Breakfast', foods: [
    { name: 'Egg white omelette + 1 toast', cal: 250, p: 24, desc: '4 whites + 1 whole egg, veggies' },
    { name: '2 idli + sambar', cal: 200, p: 8, desc: 'Skip the coconut chutney' },
    { name: 'Greek yogurt + berries', cal: 180, p: 20, desc: '170g nonfat yogurt' },
    { name: 'Protein shake + banana', cal: 250, p: 27, desc: '1 scoop whey in water + banana' },
    { name: 'Moong dal chilla (2)', cal: 220, p: 14, desc: 'Minimal oil, with mint chutney' },
    { name: '3 boiled eggs', cal: 210, p: 18, desc: 'With black pepper' },
  ]},
  { meal: 'Lunch', foods: [
    { name: "Auntie's plate: rice + dal + curry + yogurt", cal: 520, p: 20, desc: '1 cup rice, load the dal & yogurt, go light on oily curry' },
    { name: 'Rice + 2 curries + extra dal + curd', cal: 500, p: 22, desc: 'Cap rice at 1 cup, double the dal for protein' },
    { name: 'Half rice + dal + curry + big curd', cal: 430, p: 21, desc: 'Swap ½ the rice for more veg curry & yogurt' },
    { name: 'Chicken breast + 1 cup rice + salad', cal: 450, p: 42, desc: '150g grilled chicken' },
    { name: 'Rice + pappu charu + veggies', cal: 400, p: 12, desc: '1 cup rice, light on oil' },
    { name: 'Dal + 2 phulka (no ghee)', cal: 350, p: 16, desc: 'With cucumber raita' },
    { name: 'Fish curry + 1 cup rice', cal: 420, p: 30, desc: 'South Indian style, measured rice' },
  ]},
  { meal: 'Dinner', foods: [
    { name: 'Grilled fish + sauteed veggies', cal: 350, p: 35, desc: '150g fish, minimal oil' },
    { name: 'Soya chunk curry + 1 cup rice', cal: 400, p: 28, desc: 'Your usual, measured rice' },
    { name: 'Chicken curry (lean) + 1 roti', cal: 400, p: 32, desc: 'Breast meat, light oil' },
    { name: 'Paneer bhurji + salad', cal: 350, p: 22, desc: 'Low-fat paneer, no butter' },
    { name: 'Egg curry (2 eggs) + veggies', cal: 320, p: 16, desc: 'Skip the rice tonight' },
  ]},
  { meal: 'Snacks', foods: [
    { name: 'Buttermilk (majjiga)', cal: 60, p: 3, desc: '1 glass, spiced' },
    { name: 'Greek yogurt cup', cal: 100, p: 17, desc: 'Plain nonfat' },
    { name: 'Roasted chana (1/4 cup)', cal: 120, p: 7, desc: 'Crunchy, filling' },
    { name: 'Protein shake in water', cal: 120, p: 24, desc: '1 scoop whey' },
    { name: 'Apple + 10 almonds', cal: 170, p: 3, desc: 'Fiber + crunch' },
    { name: 'Cucumber + hummus', cal: 150, p: 5, desc: '2 tbsp hummus' },
  ]},
];

function renderDietRecs(totals) {
  const recGoals = getGoals();
  const remaining = {
    calories: Math.max(0, recGoals.calories - Math.round(totals.calories)),
    protein: Math.max(0, recGoals.protein - Math.round(totals.protein)),
  };

  // On a cut, hitting the budget means the kitchen is closed
  if (remaining.calories <= 100) {
    $('#dietRecs').innerHTML = '<div class="diet-recs-done">Calorie budget used up — kitchen\'s closed for today!</div>';
    return;
  }

  // Figure out which meals haven't been logged today
  const dayEntries = state.diet.filter(e => e.date === dietViewDate);
  const loggedMeals = new Set(dayEntries.map(e => e.meal));

  // Group meal name ("Snacks") -> entry meal key ("snack")
  const keyOf = name => name.toLowerCase() === 'snacks' ? 'snack' : name.toLowerCase();

  // Time-of-day awareness (only when viewing today — a past day has no "now")
  const isToday = dietViewDate === getTodayStr();
  const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];
  const mealForHour = h => {
    if (h >= 4 && h < 11) return 'breakfast';
    if (h >= 11 && h < 16) return 'lunch';
    if (h >= 16 && h < 21) return 'dinner';
    return 'snack';
  };
  const nowMeal = isToday ? mealForHour(new Date().getHours()) : null;

  // Starting from the current time window, find the first meal still worth
  // eating (unlogged real meal, or a snack which is always fair game).
  let featuredKey = null;
  if (nowMeal) {
    const start = MEAL_ORDER.indexOf(nowMeal);
    for (let i = 0; i < MEAL_ORDER.length; i++) {
      const k = MEAL_ORDER[(start + i) % MEAL_ORDER.length];
      if (k === 'snack' || !loggedMeals.has(k)) { featuredKey = k; break; }
    }
  }

  // Pick recommendations for unlogged meals, or snacks if all meals logged
  let suggestions = [];
  for (const group of CUT_RECOMMENDATIONS) {
    const mealKey = keyOf(group.meal);
    if (!loggedMeals.has(mealKey) || mealKey === 'snack') {
      // Pick 1-2 random foods from this meal
      const shuffled = [...group.foods].sort(() => Math.random() - 0.5);
      suggestions.push({ meal: group.meal, foods: shuffled.slice(0, 2) });
    }
  }

  if (!suggestions.length) {
    suggestions = [{ meal: 'Snacks', foods: CUT_RECOMMENDATIONS[3].foods.slice(0, 2) }];
  }

  // Lead with the time-appropriate meal and flag it as "now"
  if (featuredKey) {
    suggestions = [
      ...suggestions.filter(s => keyOf(s.meal) === featuredKey),
      ...suggestions.filter(s => keyOf(s.meal) !== featuredKey),
    ];
    if (suggestions[0] && keyOf(suggestions[0].meal) === featuredKey) suggestions[0].now = true;
  }

  // Header context reflects the time of day
  const DISPLAY = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };
  const NOW_LABEL = { breakfast: 'Breakfast time', lunch: 'Lunchtime', dinner: 'Dinner time', snack: 'Snack time' };
  let contextLabel = 'Suggestions';
  if (featuredKey) {
    contextLabel = featuredKey === nowMeal ? NOW_LABEL[nowMeal] : `Up next: ${DISPLAY[featuredKey]}`;
  }

  const isOpen = $('#dietRecs').classList.contains('open');
  $('#dietRecs').innerHTML = `
    <div class="diet-recs-toggle" id="dietRecsToggle">
      <svg class="diet-recs-chevron" width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span class="diet-recs-title">${contextLabel}</span>
      <span class="diet-recs-remaining">${remaining.calories} cal &middot; ${remaining.protein}g protein to go</span>
    </div>
    <div class="diet-recs-body">
      ${suggestions.map(s => `
        <div class="diet-recs-meal">
          <span class="diet-recs-meal-label">${s.meal}${s.now ? '<span class="diet-recs-now">now</span>' : ''}</span>
          ${s.foods.map(f => `
            <div class="diet-rec-item">
              <div class="diet-rec-name">${f.name}</div>
              <div class="diet-rec-meta">
                <span>${f.cal} cal</span>
                <span>${f.p}g protein</span>
                <span class="diet-rec-desc">${f.desc}</span>
              </div>
            </div>
          `).join('')}
        </div>
      `).join('')}
    </div>
  `;
  if (isOpen) $('#dietRecs').classList.add('open');

  $('#dietRecsToggle').addEventListener('click', () => {
    $('#dietRecs').classList.toggle('open');
  });
}

// ========== Yesterday's Skip-list ==========
// Forward-looking twin of the end-of-day review: analyze the most recent
// logged day and call out the specific foods to skip or shrink today.
// Shown only on the live day — browsing history shows the review instead.
function renderYesterdayAdvice() {
  const el = $('#dietYesterday');
  if (!el) return;
  const hide = () => { el.innerHTML = ''; el.classList.remove('has-content'); };

  const todayStr = getTodayStr();
  if (dietViewDate !== todayStr) return hide();

  // Most recent day before today with food logged, no older than a week
  const prev = [...new Set(state.diet.map(e => e.date))]
    .filter(d => d && d < todayStr).sort().reverse()[0];
  if (!prev) return hide();
  const weekAgo = new Date(todayStr + 'T00:00:00');
  weekAgo.setDate(weekAgo.getDate() - 7);
  if (new Date(prev + 'T00:00:00') < weekAgo) return hide();

  const y = new Date(todayStr + 'T00:00:00');
  y.setDate(y.getDate() - 1);
  const yesterdayStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
  const dayName = prev === yesterdayStr ? 'yesterday' :
    new Date(prev + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });

  // Aggregate repeat foods so two chapati entries read as one line
  const byFood = {};
  for (const e of state.diet.filter(en => en.date === prev)) {
    const name = (e.food || '').trim();
    if (!name) continue;
    const f = byFood[name.toLowerCase()] ||
      (byFood[name.toLowerCase()] = { food: name, meal: e.meal, calories: 0, protein: 0, carbs: 0, fat: 0 });
    f.calories += e.calories || 0;
    f.protein += e.protein || 0;
    f.carbs += e.carbs || 0;
    f.fat += e.fat || 0;
  }
  const foods = Object.values(byFood);
  if (!foods.length) return hide();

  const totals = foods.reduce((acc, f) => {
    acc.calories += f.calories; acc.carbs += f.carbs; acc.fat += f.fat;
    return acc;
  }, { calories: 0, carbs: 0, fat: 0 });

  const goals = getGoals();
  const overCal = Math.round(totals.calories - goals.calories);
  const overCarbs = Math.round(totals.carbs - goals.carbs);
  const overFat = Math.round(totals.fat - goals.fat);

  // Stayed on budget → one quiet green line, no nagging
  if (overCal <= 0 && overCarbs <= 0 && overFat <= 0) {
    el.classList.add('has-content');
    el.innerHTML = `<div class="diet-yesterday-ok">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
      You stayed on budget ${dayName === 'yesterday' ? 'yesterday' : 'on ' + dayName} &mdash; same playbook today.
    </div>`;
    return;
  }

  // Flag the foods that did the damage, worst first. Protein-dense foods get
  // "shrink" advice instead of "skip" — dropping them to fix a carb/fat overage
  // costs the one macro worth protecting on a cut.
  const flagged = [];
  for (const f of foods) {
    const cal = Math.round(f.calories);
    const protein = Math.round(f.protein);
    const proteinPer100 = f.calories > 0 ? (f.protein / f.calories) * 100 : 0;
    const proteinDense = protein >= 15 || proteinPer100 >= 8;
    let reason = '';
    if (overCal > 0 && f.calories >= overCal) {
      reason = proteinDense
        ? `${cal} cal covers the overage, but it carried ${protein}g protein — shrink the portion, don't skip it`
        : `${cal} cal — skipping this alone puts you back under budget`;
    } else if (overCal > 0 && f.calories >= overCal * 0.5) {
      reason = `${cal} cal — half of the ${overCal} cal overage by itself${proteinDense ? ` (but ${protein}g protein: shrink, don't skip)` : ''}`;
    } else if (overCarbs > 0 && f.carbs >= Math.max(30, overCarbs * 0.5)) {
      reason = `${Math.round(f.carbs)}g carbs on a day that ran ${overCarbs}g over${proteinDense ? ` — shrink it, it also brought ${protein}g protein` : ''}`;
    } else if (overFat > 0 && f.fat >= Math.max(10, overFat * 0.5)) {
      reason = proteinDense
        ? `${Math.round(f.fat)}g fat but also ${protein}g protein — go for a leaner version instead of skipping`
        : `${Math.round(f.fat)}g fat on a day that ran ${overFat}g over`;
    } else if (overCal > 0 && f.calories >= 200 && proteinPer100 < 4) {
      reason = `${cal} cal for only ${protein}g protein — weak trade on a cut`;
    }
    if (reason) flagged.push({ ...f, reason });
  }
  // Protein-light offenders first — they're the cheapest cuts
  flagged.sort((a, b) => (a.protein / Math.max(a.calories, 1)) - (b.protein / Math.max(b.calories, 1)) || b.calories - a.calories);
  const top = flagged.slice(0, 4);
  if (!top.length) return hide();

  const overBits = [];
  if (overCal > 0) overBits.push(`${overCal} cal`);
  if (overCarbs > 0) overBits.push(`${overCarbs}g carbs`);
  if (overFat > 0) overBits.push(`${overFat}g fat`);

  el.classList.add('has-content');
  el.innerHTML = `
    <div class="diet-review-header">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
      <span class="diet-review-title">Skip or shrink today</span>
      <span class="diet-review-sub">${dayName} ran over by ${overBits.join(' · ')}</span>
    </div>
    <div class="diet-yesterday-list">
      ${top.map(f => `
        <div class="diet-yesterday-item">
          <div class="diet-yesterday-item-head">
            <span class="diet-yesterday-name">${esc(f.food)}</span>
            <span class="diet-review-culprit-meal">${esc(f.meal || '')}</span>
          </div>
          <div class="diet-yesterday-reason">${f.reason}</div>
        </div>`).join('')}
    </div>`;
}

// ========== End-of-day Review ==========
// Retrospective: for each macro that finished over goal, surface the foods
// that drove it so you can see exactly where to cut back next time.
// Protein is intentionally excluded — going over protein isn't a problem on a cut.
function renderDietReview(totals, dayEntries) {
  const el = $('#dietReview');
  if (!el) return;

  // Nothing logged yet → nothing to review
  if (!dayEntries.length) { el.innerHTML = ''; el.classList.remove('has-content'); return; }

  const goals = getGoals();
  const LIMITING = [
    { key: 'calories', label: 'Calories', unit: '', color: 'var(--accent)' },
    { key: 'carbs', label: 'Carbs', unit: 'g', color: '#eab308' },
    { key: 'fat', label: 'Fat', unit: 'g', color: '#ef4444' },
  ];

  const over = LIMITING
    .map(m => {
      const current = Math.round(totals[m.key]);
      return { ...m, current, amount: current - goals[m.key] };
    })
    .filter(m => m.amount > 0);

  // Stayed within every limiting macro → a quick win, no culprit list needed
  if (!over.length) {
    el.classList.add('has-content');
    el.innerHTML = `
      <div class="diet-review-header ok">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        <span class="diet-review-title">Day review</span>
      </div>
      <div class="diet-review-clean">Nice — you finished within your calorie, carb, and fat goals.</div>`;
    return;
  }

  el.classList.add('has-content');

  const sections = over.map(m => {
    const total = m.current;
    // Rank the day's foods by how much of THIS macro they contributed
    const culprits = dayEntries
      .map(e => ({ food: e.food, meal: e.meal, val: Math.round(e[m.key] || 0), protein: Math.round(e.protein || 0) }))
      .filter(c => c.val > 0)
      .sort((a, b) => b.val - a.val)
      .slice(0, 3);

    // Advice must weigh the protein cost: on a cut, cutting a protein-dense food
    // to fix a small carb/fat overage is a net loss. Prefer the fix that
    // sacrifices the least protein, and downgrade "skip" to "shrink" when the
    // overage is small or every fix would cost real protein.
    const top = culprits[0];
    let tip = '';
    if (top) {
      const coverers = culprits.filter(c => c.val >= m.amount);
      const best = coverers.length
        ? coverers.reduce((a, b) => (a.protein <= b.protein ? a : b))
        : top;
      const smallOverage = m.key === 'calories' ? m.amount <= 120 : m.amount <= 8;

      if (smallOverage) {
        tip = `Only ${m.amount}${m.unit} over — a slightly smaller serving of <strong>${esc(best.food)}</strong> covers it. Nothing here is worth skipping${best.protein >= 10 ? ` (it carried ${best.protein}g protein)` : ''}.`;
      } else if (coverers.length && best.protein >= 12) {
        tip = `<strong>${esc(best.food)}</strong> covers the ${m.amount}${m.unit} overage, but it also brought ${best.protein}g protein — shrink the portion or swap for a leaner version rather than skipping it.`;
      } else if (coverers.length) {
        tip = `Skipping <strong>${esc(best.food)}</strong> alone would have kept you under your ${m.label.toLowerCase()} goal${best.protein > 0 ? ` at a cost of only ${best.protein}g protein` : ''}.`;
      } else {
        tip = `<strong>${esc(top.food)}</strong> was the biggest driver — trimming it claws back ${top.val}${m.unit} of the ${m.amount}${m.unit} overage.`;
      }
    }

    return `
      <div class="diet-review-macro">
        <div class="diet-review-macro-head">
          <span class="diet-review-dot" style="background:${m.color}"></span>
          <span class="diet-review-macro-label">${m.label}</span>
          <span class="diet-review-over">over by ${m.amount}${m.unit}</span>
        </div>
        <div class="diet-review-culprits">
          ${culprits.map(c => {
            const pct = total > 0 ? Math.round((c.val / total) * 100) : 0;
            return `
              <div class="diet-review-culprit">
                <span class="diet-review-culprit-name">${esc(c.food)}</span>
                <span class="diet-review-culprit-meal">${c.meal}</span>
                <span class="diet-review-culprit-val">${c.val}${m.unit} &middot; ${pct}%${c.protein >= 5 ? ` &middot; <span class="diet-review-culprit-protein">${c.protein}g P</span>` : ''}</span>
              </div>`;
          }).join('')}
        </div>
        ${tip ? `<div class="diet-review-tip">${tip}</div>` : ''}
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="diet-review-header">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
      <span class="diet-review-title">Where you went over</span>
      <span class="diet-review-sub">${over.length} macro${over.length === 1 ? '' : 's'} above goal</span>
    </div>
    ${sections}`;
}

// ========== Water Tracker ==========
function renderWater() {
  const waterGoal = getGoals().water;
  const entries = state.water[dietViewDate] || [];
  const total = entries.reduce((s, v) => s + v, 0);
  const pct = Math.min(100, Math.round((total / waterGoal) * 100));

  $('#waterProgress').textContent = `${total} / ${waterGoal} oz`;
  $('#waterBarFill').style.width = pct + '%';

  // Color the bar based on progress
  const fill = $('#waterBarFill');
  if (pct >= 100) fill.className = 'water-bar-fill water-complete';
  else if (pct >= 60) fill.className = 'water-bar-fill water-good';
  else fill.className = 'water-bar-fill';

  // Log entries
  if (!entries.length) {
    $('#waterLog').innerHTML = '';
  } else {
    $('#waterLog').innerHTML = entries.map((oz, i) => `<span class="water-log-chip">${oz} oz</span>`).join('');
  }
}

function addWater(oz) {
  if (!state.water[dietViewDate]) state.water[dietViewDate] = [];
  state.water[dietViewDate].push(oz);
  saveData(state);
  renderWater();
}

function undoWater() {
  if (!state.water[dietViewDate] || !state.water[dietViewDate].length) return;
  state.water[dietViewDate].pop();
  saveData(state);
  renderWater();
}

// ========== Goals Modal ==========
function openGoalsModal() {
  const g = getGoals();
  $('#goalCalories').value = g.calories;
  $('#goalProtein').value = g.protein;
  $('#goalCarbs').value = g.carbs;
  $('#goalFat').value = g.fat;
  $('#goalWater').value = g.water;
  $('#goalWeight').value = g.weight;
  $('#goalBurn').value = g.burn;
  $('#goalsModal').classList.add('active');
}

function closeGoalsModal() {
  $('#goalsModal').classList.remove('active');
}

function bindGoalsEvents() {
  $('#editGoalsBtn').addEventListener('click', openGoalsModal);
  const weightChip = $('#weightGoalChip');
  if (weightChip) weightChip.addEventListener('click', openGoalsModal);
  $('#goalsModalClose').addEventListener('click', closeGoalsModal);
  $('#goalsCancelBtn').addEventListener('click', closeGoalsModal);
  $('#goalsModal').addEventListener('click', (e) => {
    if (e.target === $('#goalsModal')) closeGoalsModal();
  });
  $('#goalsSaveBtn').addEventListener('click', () => {
    const read = (id, fallback) => {
      const v = Number($(id).value);
      return v > 0 ? v : fallback;
    };
    const prev = getGoals();
    // Spread prev so cardio race targets (raceKey/raceDate/weeklyMiles) and the
    // _onboarded marker survive — rebuilding the object from scratch dropped them.
    state.goals = {
      ...prev,
      calories: read('#goalCalories', prev.calories),
      protein: read('#goalProtein', prev.protein),
      carbs: read('#goalCarbs', prev.carbs),
      fat: read('#goalFat', prev.fat),
      water: read('#goalWater', prev.water),
      weight: read('#goalWeight', prev.weight),
      burn: read('#goalBurn', prev.burn),
    };
    saveData(state);
    closeGoalsModal();
    if (typeof render === 'function') render();
    showToast('Goals updated');
  });
}

function bindWaterEvents() {
  $$('.water-btn[data-oz]').forEach(btn => {
    btn.addEventListener('click', () => addWater(Number(btn.dataset.oz)));
  });
  $('#waterCustomBtn').addEventListener('click', () => {
    const val = prompt('Enter oz:');
    const oz = Number(val);
    if (oz > 0) addWater(oz);
  });
  $('#waterUndoBtn').addEventListener('click', undoWater);
}

function clearDietForm() {
  $('#dietFoodName').value = '';
  $('#dietServings').value = 1;
  $('#dietCalories').value = '';
  $('#dietProtein').value = '';
  $('#dietCarbs').value = '';
  $('#dietFat').value = '';
  $('#dietServingInfo').innerHTML = '';
  dietBaseMacros = null;
}

