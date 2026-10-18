-- Member-authored custom meals composed from known food_items (no invented macros).
CREATE TABLE member_custom_meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  food_item_id uuid NOT NULL REFERENCES food_items (id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  servings integer NOT NULL DEFAULT 1 CHECK (servings >= 1 AND servings <= 20),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, food_item_id)
);

CREATE INDEX member_custom_meals_user_idx ON member_custom_meals (user_id, updated_at DESC);

CREATE TABLE member_custom_meal_ingredients (
  meal_id uuid NOT NULL REFERENCES member_custom_meals (id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position >= 0),
  food_item_id uuid NOT NULL REFERENCES food_items (id),
  quantity_grams integer NOT NULL CHECK (quantity_grams >= 1 AND quantity_grams <= 2000),
  PRIMARY KEY (meal_id, position)
);

CREATE INDEX member_custom_meal_ingredients_food_idx ON member_custom_meal_ingredients (food_item_id);
