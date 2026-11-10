# Klarka_cookbook
Klarcin cookbook

A recipe app prototype: type what's in your kitchen and get a recipe, browse 24 recipes, save favorites, find quick meals and see how each recipe fits your calorie goal.

Open `index.html` in a browser, or publish the repo with GitHub Pages.

## Editing
- Recipes, ingredients and nutrition values: `src/data.js`
- Dish illustrations: `src/art.js`
- Look and feel: `src/style.css`, page layout: `src/shell.html`, app logic: `src/app.js`

After changing anything in `src/`, rebuild `index.html` with `python3 build.py`.

## Photos
`photo-prompts.txt` has a prompt for every recipe for generating photos in one consistent style. Put the photos in a `photos/` folder and add `photo: { src: 'photos/scrambled-eggs.jpg' }` to the recipe in `src/data.js`. A photo replaces the illustration.

Nutrition values are approximate.
