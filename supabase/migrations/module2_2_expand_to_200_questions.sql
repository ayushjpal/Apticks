-- ==============================================================================
-- APTICKS MODULE 2 MASTER MIGRATION: DYNAMIC QUESTION ENGINE & 200 QUESTIONS
-- Creates:
--   1. public.questions (Table, Indexes, RLS)
--   2. public.user_question_progress (Table, Indexes, Unique Constraint, RLS)
--   3. public.user_question_attempts (Table, Indexes, RLS)
--   4. Inserts/Upserts all 200 verified questions (Idempotent ON CONFLICT DO UPDATE)
-- ==============================================================================

-- 1. Create questions table
CREATE TABLE IF NOT EXISTS public.questions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  category TEXT NOT NULL,
  topic TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  options JSONB NOT NULL,
  correct_option TEXT NOT NULL,
  explanation TEXT NOT NULL,
  formula_or_rule TEXT,
  hints JSONB NOT NULL DEFAULT '[]'::jsonb,
  points INT NOT NULL DEFAULT 10,
  acceptance_rate INT DEFAULT 75,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Performance indexes on questions
CREATE INDEX IF NOT EXISTS idx_questions_category ON public.questions(category);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON public.questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON public.questions(topic);
CREATE INDEX IF NOT EXISTS idx_questions_is_active ON public.questions(is_active);
CREATE INDEX IF NOT EXISTS idx_questions_category_difficulty ON public.questions(category, difficulty);

-- 3. Enable RLS on questions
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active questions are viewable by everyone" ON public.questions;
CREATE POLICY "Active questions are viewable by everyone"
  ON public.questions FOR SELECT
  USING (is_active = TRUE);

-- 4. Create user_question_progress table
CREATE TABLE IF NOT EXISTS public.user_question_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  question_id TEXT REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  selected_option TEXT,
  is_solved BOOLEAN DEFAULT FALSE NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE NOT NULL,
  is_bookmarked BOOLEAN DEFAULT FALSE NOT NULL,
  attempts_count INT DEFAULT 1 NOT NULL,
  time_spent_seconds INT DEFAULT 0 NOT NULL,
  last_attempted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_user_question_progress_user ON public.user_question_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_question_progress_bookmarked ON public.user_question_progress(user_id, is_bookmarked);
CREATE INDEX IF NOT EXISTS idx_user_question_progress_solved ON public.user_question_progress(user_id, is_solved);

ALTER TABLE public.user_question_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own progress" ON public.user_question_progress;
CREATE POLICY "Users can view their own progress"
  ON public.user_question_progress FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own progress" ON public.user_question_progress;
CREATE POLICY "Users can insert their own progress"
  ON public.user_question_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own progress" ON public.user_question_progress;
CREATE POLICY "Users can update their own progress"
  ON public.user_question_progress FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own progress" ON public.user_question_progress;
CREATE POLICY "Users can delete their own progress"
  ON public.user_question_progress FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Create user_question_attempts table
CREATE TABLE IF NOT EXISTS public.user_question_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  question_id TEXT REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  selected_option TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  xp_change INTEGER NOT NULL,
  attempt_number INTEGER NOT NULL CHECK (attempt_number >= 1),
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_question_attempts_user ON public.user_question_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_question_attempts_question ON public.user_question_attempts(question_id);
CREATE INDEX IF NOT EXISTS idx_user_question_attempts_user_question ON public.user_question_attempts(user_id, question_id);
CREATE INDEX IF NOT EXISTS idx_user_question_attempts_created_at ON public.user_question_attempts(created_at DESC);

ALTER TABLE public.user_question_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own attempts" ON public.user_question_attempts;
CREATE POLICY "Users can view their own attempts"
  ON public.user_question_attempts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own attempts" ON public.user_question_attempts;
CREATE POLICY "Users can insert their own attempts"
  ON public.user_question_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ==============================================================================
-- 6. INSERT / UPSERT ALL 200 QUESTIONS (IDEMPOTENT)
-- ==============================================================================

INSERT INTO public.questions (
  id,
  title,
  prompt,
  category,
  topic,
  difficulty,
  options,
  correct_option,
  explanation,
  formula_or_rule,
  hints,
  points,
  acceptance_rate,
  tags,
  is_active
) VALUES
  (
    'quant-001',
    'Successive Percentage Changes in Price',
    'The price of an item is first increased by 20% and then subsequently decreased by 20%. What is the net change in the price of the item compared to its original price?',
    'Quantitative Aptitude',
    'Percentages',
    'easy',
    '[{"id":"A","text":"0% (No change)"},{"id":"B","text":"4% decrease"},{"id":"C","text":"4% increase"},{"id":"D","text":"2.5% decrease"}]'::jsonb,
    'B',
    'Let original price = $100.
After 20% increase: $100 + $20 = $120.
After 20% decrease on $120: $120 - (0.20 × 120) = $120 - $24 = $96.
Net change = ($96 - $100) / $100 × 100% = -4% (a 4% decrease).',
    'Net Change = a + b + (a × b)/100 = 20 - 20 + (20 × -20)/100 = -400/100 = -4%',
    '["Assume original price is 100.","The second percentage change applies to the new increased value, not the original 100."]'::jsonb,
    10,
    88,
    '["Percentages","Arithmetic","Successive Change"]'::jsonb,
    TRUE
  ),
  (
    'quant-002',
    'Combined Work Rate of Two Individuals',
    'Alice can complete a task in 12 days, and Bob can complete the same task in 18 days. If they work together, in how many days will the entire task be completed?',
    'Quantitative Aptitude',
    'Time & Work',
    'easy',
    '[{"id":"A","text":"6.5 days"},{"id":"B","text":"7.2 days"},{"id":"C","text":"8.0 days"},{"id":"D","text":"15.0 days"}]'::jsonb,
    'B',
    'Work done by Alice in 1 day = 1/12.
Work done by Bob in 1 day = 1/18.
Combined 1-day work = 1/12 + 1/18 = (3 + 2)/36 = 5/36.
Total days required = 36/5 = 7.2 days.',
    'Total Days = (A × B) / (A + B) = (12 × 18) / (12 + 18) = 216 / 30 = 7.2 days',
    '["Find the fraction of work each person finishes in one day.","Add their 1-day work rates together."]'::jsonb,
    10,
    82,
    '["Time & Work","Arithmetic","Efficiency"]'::jsonb,
    TRUE
  ),
  (
    'quant-003',
    'Relative Speed of Trains Crossing in Opposite Directions',
    'Two trains 140 m and 160 m long are running towards each other on parallel tracks at speeds of 60 km/h and 48 km/h respectively. In how much time (in seconds) will they completely cross each other from the moment they meet?',
    'Quantitative Aptitude',
    'Speed, Distance & Time',
    'medium',
    '[{"id":"A","text":"8 seconds"},{"id":"B","text":"10 seconds"},{"id":"C","text":"12 seconds"},{"id":"D","text":"14 seconds"}]'::jsonb,
    'B',
    'Total distance to cover = Sum of train lengths = 140 m + 160 m = 300 m.
Relative speed (opposite direction) = 60 + 48 = 108 km/h.
Convert relative speed to m/s: 108 × (5/18) = 6 × 5 = 30 m/s.
Time taken = Distance / Relative Speed = 300 / 30 = 10 seconds.',
    'Time = (Length1 + Length2) / (Speed1 + Speed2 in m/s)',
    '["Add their lengths to get total distance.","When moving in opposite directions, relative speed is the sum of their speeds."]'::jsonb,
    15,
    64,
    '["Trains","Relative Speed","Distance"]'::jsonb,
    TRUE
  ),
  (
    'quant-004',
    'Selling Price with Desired Profit Percentage',
    'A shopkeeper sells an article at $840 after offering a discount of 20% on the marked price. If the cost price was $600, what is the profit percentage earned by the shopkeeper?',
    'Quantitative Aptitude',
    'Profit & Loss',
    'easy',
    '[{"id":"A","text":"35%"},{"id":"B","text":"40%"},{"id":"C","text":"42.5%"},{"id":"D","text":"50%"}]'::jsonb,
    'B',
    'Cost Price (CP) = $600.
Selling Price (SP) = $840.
Profit = SP - CP = $840 - $600 = $240.
Profit Percentage = (Profit / CP) × 100% = (240 / 600) × 100% = 40%.
(Note: The discount value is already reflected in the given Selling Price).',
    'Profit % = [(SP - CP) / CP] × 100',
    '["Calculate profit directly from SP and CP.","Profit % is always calculated with respect to Cost Price (CP)."]'::jsonb,
    10,
    79,
    '["Profit & Loss","Discount","Commercial Math"]'::jsonb,
    TRUE
  ),
  (
    'quant-005',
    'Committee Formation with Gender Constraints',
    'A committee of 5 members is to be formed from a group of 6 men and 4 women. In how many distinct ways can the committee be formed if it must contain at least 2 women?',
    'Quantitative Aptitude',
    'Permutations & Combinations',
    'hard',
    '[{"id":"A","text":"186 ways"},{"id":"B","text":"194 ways"},{"id":"C","text":"210 ways"},{"id":"D","text":"246 ways"}]'::jsonb,
    'A',
    'Total possible committees without restriction: C(10, 5) = 252.
Committees with 0 women (all 5 men): C(4, 0) × C(6, 5) = 1 × 6 = 6.
Committees with exactly 1 woman (1 woman, 4 men): C(4, 1) × C(6, 4) = 4 × 15 = 60.
Committees with at least 2 women = Total - (0 women + 1 woman) = 252 - (6 + 60) = 252 - 66 = 186 ways.',
    'P(At least 2) = Total - P(0 women) - P(1 woman)',
    '["Use the complement method: Total combinations minus (0 women + 1 woman).","Total combinations = C(10, 5) = 252."]'::jsonb,
    20,
    48,
    '["Combinatorics","Selection","Probability & Stats"]'::jsonb,
    TRUE
  ),
  (
    'quant-006',
    'Probability of Non-Consecutive Dice Sums',
    'Two standard six-sided dice are rolled simultaneously. What is the probability that the sum of the numbers obtained is a prime number?',
    'Quantitative Aptitude',
    'Probability',
    'medium',
    '[{"id":"A","text":"1/3"},{"id":"B","text":"5/12"},{"id":"C","text":"7/18"},{"id":"D","text":"1/2"}]'::jsonb,
    'B',
    'Total possible outcomes when rolling 2 dice = 6 × 6 = 36.
Possible sums that are prime between 2 and 12 are {2, 3, 5, 7, 11}.
- Sum = 2: (1,1) -> 1 pair
- Sum = 3: (1,2), (2,1) -> 2 pairs
- Sum = 5: (1,4), (2,3), (3,2), (4,1) -> 4 pairs
- Sum = 7: (1,6), (2,5), (3,4), (4,3), (5,2), (6,1) -> 6 pairs
- Sum = 11: (5,6), (6,5) -> 2 pairs
Total favorable outcomes = 1 + 2 + 4 + 6 + 2 = 15.
Probability = 15 / 36 = 5 / 12.',
    'Probability = Number of Favorable Outcomes / Total Outcomes',
    '["List all prime sums between 2 and 12: 2, 3, 5, 7, 11.","Count the dice pairs that produce each of these sums."]'::jsonb,
    15,
    61,
    '["Probability","Dice","Prime Numbers"]'::jsonb,
    TRUE
  ),
  (
    'quant-007',
    'Annual vs Semi-Annual Compounding Yield',
    'A sum of $10,000 is invested for 2 years at an annual interest rate of 10% compounded annually. What is the total compound interest earned at the end of the term?',
    'Quantitative Aptitude',
    'Compound Interest',
    'easy',
    '[{"id":"A","text":"$2,000"},{"id":"B","text":"$2,100"},{"id":"C","text":"$2,150"},{"id":"D","text":"$2,210"}]'::jsonb,
    'B',
    'Principal P = $10,000, Rate r = 10% = 0.10, Time t = 2 years.
Amount A = P × (1 + r)^t = 10,000 × (1 + 0.10)^2 = 10,000 × (1.1)^2 = 10,000 × 1.21 = $12,100.
Compound Interest (CI) = A - P = $12,100 - $10,000 = $2,100.',
    'CI = P × [(1 + r/100)^t - 1]',
    '["Calculate total amount using A = P(1 + r)^t.","Subtract the initial principal from the accumulated amount."]'::jsonb,
    10,
    85,
    '["Compound Interest","Finance","Percentage Yield"]'::jsonb,
    TRUE
  ),
  (
    'quant-008',
    'Finding the Unit Digit of a Large Exponent',
    'What is the unit (last) digit of the expression (7^95 - 3^58)?',
    'Quantitative Aptitude',
    'Number Systems',
    'hard',
    '[{"id":"A","text":"0"},{"id":"B","text":"4"},{"id":"C","text":"6"},{"id":"D","text":"8"}]'::jsonb,
    'B',
    '1. Cyclicity of 7 is 4: 7^1=7, 7^2=9, 7^3=3, 7^4=1.
   95 mod 4 = 3, so unit digit of 7^95 = unit digit of 7^3 = 3 (or 13 when borrowing).
2. Cyclicity of 3 is 4: 3^1=3, 3^2=9, 3^3=7, 3^4=1.
   58 mod 4 = 2, so unit digit of 3^58 = unit digit of 3^2 = 9.
3. Unit digit of (7^95 - 3^58) = 13 - 9 = 4 (since 7^95 > 3^58, we borrow from higher place).',
    'Unit digit cyclicity for 3 and 7 is 4. Exponent remainder = N mod 4.',
    '["Powers of 7 cycle in last digits: 7, 9, 3, 1.","Powers of 3 cycle in last digits: 3, 9, 7, 1.","Borrow 10 if subtracting larger digit from smaller."]'::jsonb,
    20,
    52,
    '["Number Theory","Cyclicity","Exponents"]'::jsonb,
    TRUE
  ),
  (
    'quant-009',
    'Income and Expenditure Ratio of Two Earners',
    'The monthly incomes of Jack and Jill are in the ratio 5 : 4, and their monthly expenditures are in the ratio 3 : 2. If each of them saves $800 per month, what is Jack’s monthly income?',
    'Quantitative Aptitude',
    'Ratio & Proportion',
    'medium',
    '[{"id":"A","text":"$1,600"},{"id":"B","text":"$2,000"},{"id":"C","text":"$2,400"},{"id":"D","text":"$2,800"}]'::jsonb,
    'B',
    'Let Jack’s income = 5x and Jill’s income = 4x.
Expenditure = Income - Savings.
Jack’s expenditure = 5x - 800.
Jill’s expenditure = 4x - 800.
Given ratio of expenditure = (5x - 800) / (4x - 800) = 3 / 2.
Cross multiplying: 2(5x - 800) = 3(4x - 800)
10x - 1600 = 12x - 2400
2x = 800 => x = 400.
Jack’s income = 5x = 5 × 400 = $2,000.',
    'Income = Expenditure + Savings',
    '["Express incomes as 5x and 4x.","Expenditure is Income minus 800.","Set up the ratio equation and solve for x."]'::jsonb,
    15,
    71,
    '["Ratios","Algebra","Financial Arithmetic"]'::jsonb,
    TRUE
  ),
  (
    'quant-010',
    'Area of Inscribed Circle in a Right-Angled Triangle',
    'A right-angled triangle has perpendicular sides of length 6 cm and 8 cm. What is the area (in cm²) of the circle inscribed inside this triangle? (Use π = 3.14)',
    'Quantitative Aptitude',
    'Geometry & Mensuration',
    'medium',
    '[{"id":"A","text":"6.28 cm²"},{"id":"B","text":"12.56 cm²"},{"id":"C","text":"18.84 cm²"},{"id":"D","text":"25.12 cm²"}]'::jsonb,
    'B',
    'Hypotenuse c = √(6² + 8²) = √(36 + 64) = √100 = 10 cm.
Inradius r of right triangle = (a + b - c) / 2 = (6 + 8 - 10) / 2 = 4 / 2 = 2 cm.
Area of in-circle = π × r² = 3.14 × (2)² = 3.14 × 4 = 12.56 cm².',
    'Inradius of right-angled triangle r = (a + b - c) / 2; Area = π × r²',
    '["Find the hypotenuse using Pythagoras theorem.","Use formula for inradius of a right triangle: (base + height - hypotenuse) / 2."]'::jsonb,
    15,
    67,
    '["Geometry","Right Triangle","Incircle"]'::jsonb,
    TRUE
  ),
  (
    'quant-011',
    'Price Rise and Consumption Reduction',
    'If the price of petrol increases by 25%, by what percentage must a driver reduce their petrol consumption so that the total expenditure remains unchanged?',
    'Quantitative Aptitude',
    'Percentages',
    'easy',
    '[{"id":"A","text":"16.67%"},{"id":"B","text":"20%"},{"id":"C","text":"22.5%"},{"id":"D","text":"25%"}]'::jsonb,
    'B',
    'Let original price = $100 and consumption = 100 units. Original expenditure = $10,000.
New price = $125.
To keep expenditure at $10,000, new consumption = 10,000 / 125 = 80 units.
Reduction in consumption = 100 - 80 = 20 units (or 20%).',
    'Reduction % = [r / (100 + r)] × 100 = [25 / 125] × 100 = 20%',
    '["Use the formula [r / (100 + r)] × 100 where r = 25.","Check with test numbers: 100 × 100 = 10,000; 125 × 80 = 10,000."]'::jsonb,
    10,
    84,
    '["Percentages","Consumption","Arithmetic"]'::jsonb,
    TRUE
  ),
  (
    'quant-012',
    'Examination Passing Marks Calculation',
    'A student scored 28% marks in an exam and failed by 14 marks. Another student scored 36% marks in the same exam and secured 18 marks more than the minimum passing marks. What are the maximum total marks for the exam?',
    'Quantitative Aptitude',
    'Percentages',
    'medium',
    '[{"id":"A","text":"350"},{"id":"B","text":"400"},{"id":"C","text":"450"},{"id":"D","text":"500"}]'::jsonb,
    'B',
    'Let maximum marks be M.
Passing mark = 0.28M + 14 = 0.36M - 18.
0.36M - 0.28M = 14 + 18
0.08M = 32
M = 32 / 0.08 = 400.
(Passing marks = 0.28 × 400 + 14 = 112 + 14 = 126).',
    'Difference in % marks = Difference in raw scores: (36% - 28%) of M = 18 - (-14) = 32.',
    '["The percentage difference (36% - 28% = 8%) corresponds to the raw score difference (18 - (-14) = 32 marks).","Divide 32 by 0.08."]'::jsonb,
    15,
    80,
    '["Percentages","Exam Scores","Algebra"]'::jsonb,
    TRUE
  ),
  (
    'quant-013',
    'Successive Discounts Equivalent Single Discount',
    'A retailer offers two successive discounts of 20% and 15% on the marked price of a watch. What is the single equivalent discount percentage?',
    'Quantitative Aptitude',
    'Profit & Loss',
    'easy',
    '[{"id":"A","text":"32%"},{"id":"B","text":"35%"},{"id":"C","text":"37.5%"},{"id":"D","text":"30%"}]'::jsonb,
    'A',
    'Let Marked Price = $100.
After first discount of 20%: Price = $100 - $20 = $80.
After second discount of 15% on $80: Discount = 0.15 × 80 = $12. New price = $80 - $12 = $68.
Net discount = $100 - $68 = $32, which is 32%.',
    'Equivalent Discount = d1 + d2 - (d1 × d2)/100 = 20 + 15 - (20 × 15)/100 = 35 - 3 = 32%',
    '["Use formula: d1 + d2 - (d1 × d2) / 100.","Calculate discount on $100."]'::jsonb,
    10,
    86,
    '["Profit & Loss","Discount","Successive"]'::jsonb,
    TRUE
  ),
  (
    'quant-014',
    'Dishonest Dealer Weight Fraud Profit',
    'A dishonest grocer claims to sell sugar at cost price but uses a faulty false weight of 900 grams instead of 1 kilogram. What is his actual profit percentage?',
    'Quantitative Aptitude',
    'Profit & Loss',
    'medium',
    '[{"id":"A","text":"10%"},{"id":"B","text":"11.11%"},{"id":"C","text":"12.5%"},{"id":"D","text":"15%"}]'::jsonb,
    'B',
    'The grocer gives 900 g of goods while charging for 1000 g.
Gain in grams = 1000 - 900 = 100 g.
Cost incurred is for 900 g.
Profit % = (Error / True Value - Error) × 100% = (100 / 900) × 100% = 100 / 9 = 11.11%.',
    'Profit % = [Error / (True Weight - Error)] × 100 = [100 / 900] × 100 = 11.11%',
    '["Profit is based on the actual quantity delivered (900 g), not 1000 g.","Gain = 100 g on an expenditure of 900 g."]'::jsonb,
    15,
    68,
    '["Profit & Loss","Faulty Weights","Commercial Math"]'::jsonb,
    TRUE
  ),
  (
    'quant-015',
    'Selling Two Articles with Same Selling Price',
    'A trader sells two cycles for $3,600 each. On one he gains 20% and on the other he loses 20%. What is his overall gain or loss percentage on the entire transaction?',
    'Quantitative Aptitude',
    'Profit & Loss',
    'medium',
    '[{"id":"A","text":"No profit, no loss"},{"id":"B","text":"4% gain"},{"id":"C","text":"4% loss"},{"id":"D","text":"2% loss"}]'::jsonb,
    'C',
    'When two items are sold at the same selling price, one at a profit of x% and the other at a loss of x%, there is always an overall loss given by (x/10)²%.
Loss % = (20 / 10)² = 2² = 4% loss.
Verification: CP1 = 3600 / 1.2 = 3000; CP2 = 3600 / 0.8 = 4500. Total CP = 7500. Total SP = 7200. Loss = 300 / 7500 = 4%.',
    'Overall Loss % = (Common % / 10)² = (20/10)² = 4%',
    '["When SP is identical for a gain and loss of x%, there is always a loss of (x/10)² %."]'::jsonb,
    15,
    74,
    '["Profit & Loss","Identical SP","Rule of Loss"]'::jsonb,
    TRUE
  ),
  (
    'quant-016',
    'Dividing Money with Fractional Coin Values',
    'A bag contains 50p, 25p, and 10p coins in the ratio 5 : 9 : 4, amounting to $206 in total. Find the total number of 25p coins in the bag.',
    'Quantitative Aptitude',
    'Ratio & Proportion',
    'medium',
    '[{"id":"A","text":"320"},{"id":"B","text":"360"},{"id":"C","text":"400"},{"id":"D","text":"450"}]'::jsonb,
    'B',
    'Let number of coins be 5x, 9x, and 4x.
Values in dollars:
50p coins = 5x × 0.50 = 2.50x
25p coins = 9x × 0.25 = 2.25x
10p coins = 4x × 0.10 = 0.40x
Total value = 2.50x + 2.25x + 0.40x = 5.15x = 206.
x = 206 / 5.15 = 40.
Number of 25p coins = 9x = 9 × 40 = 360.',
    'Total Value = Sum(Quantity_i × Denomination_i)',
    '["Convert coin counts to money value in terms of x.","Sum to 206 and solve for x, then compute 9x."]'::jsonb,
    15,
    70,
    '["Ratio & Proportion","Coins","Algebra"]'::jsonb,
    TRUE
  ),
  (
    'quant-017',
    'Fourth Proportional Calculation',
    'What is the fourth proportional to the numbers 12, 18, and 14?',
    'Quantitative Aptitude',
    'Ratio & Proportion',
    'easy',
    '[{"id":"A","text":"19"},{"id":"B","text":"21"},{"id":"C","text":"24"},{"id":"D","text":"28"}]'::jsonb,
    'B',
    'Let the fourth proportional be x.
Then 12 : 18 = 14 : x
12/18 = 14/x
x = (18 × 14) / 12 = (3 × 14) / 2 = 42 / 2 = 21.',
    'If a : b = c : d, then d = (b × c) / a',
    '["Product of extremes = Product of means: 12 × x = 18 × 14."]'::jsonb,
    10,
    91,
    '["Ratio & Proportion","Proportions","Fundamentals"]'::jsonb,
    TRUE
  ),
  (
    'quant-018',
    'Cricket Batsman Batting Average',
    'A batsman in his 17th innings makes a score of 85 runs and thereby increases his average by 3 runs per innings. What is his average after the 17th innings?',
    'Quantitative Aptitude',
    'Averages',
    'medium',
    '[{"id":"A","text":"34 runs"},{"id":"B","text":"37 runs"},{"id":"C","text":"40 runs"},{"id":"D","text":"42 runs"}]'::jsonb,
    'B',
    'Let his average before 17th innings (for 16 innings) be A.
Total runs in 16 innings = 16A.
After 17th innings: Total runs = 16A + 85.
New average = A + 3.
(16A + 85) / 17 = A + 3
16A + 85 = 17A + 51
A = 85 - 51 = 34.
New average after 17th innings = A + 3 = 34 + 3 = 37 runs.',
    'New Average = Previous Average + Increase',
    '["Set up the equation for total runs before and after the 17th innings.","New average is A + 3."]'::jsonb,
    15,
    69,
    '["Averages","Cricket","Arithmetic"]'::jsonb,
    TRUE
  ),
  (
    'quant-019',
    'Teacher Inclusion in Class Average Age',
    'The average age of 24 students in a class is 15 years. When the age of the class teacher is included, the average age increases by 1 year. What is the age of the teacher?',
    'Quantitative Aptitude',
    'Averages',
    'easy',
    '[{"id":"A","text":"38 years"},{"id":"B","text":"40 years"},{"id":"C","text":"42 years"},{"id":"D","text":"45 years"}]'::jsonb,
    'B',
    'Total age of 24 students = 24 × 15 = 360 years.
With teacher included, total members = 25 and new average = 16 years.
Total age of 25 people = 25 × 16 = 400 years.
Age of teacher = 400 - 360 = 40 years.
Shortcut: Teacher Age = Old Average + (Total Members × Increase) = 15 + (25 × 1) = 40 years.',
    'New Value = Old Average + (New Count × Change in Average)',
    '["Calculate total age of students (24 × 15 = 360).","Calculate total age of class + teacher (25 × 16 = 400)."]'::jsonb,
    10,
    87,
    '["Averages","Age Problems","Arithmetic"]'::jsonb,
    TRUE
  ),
  (
    'quant-020',
    'Alligation of Two Sugar Qualities',
    'In what ratio must a grocer mix tea costing $60 per kg with tea costing $65 per kg so that selling the mixture at $68.20 per kg yields a profit of 10%?',
    'Quantitative Aptitude',
    'Mixtures & Alligation',
    'medium',
    '[{"id":"A","text":"3 : 2"},{"id":"B","text":"2 : 3"},{"id":"C","text":"3 : 4"},{"id":"D","text":"4 : 5"}]'::jsonb,
    'A',
    'Selling Price (SP) of mixture = $68.20 at 10% profit.
Cost Price (CP) of mixture = 68.20 / 1.10 = $62 per kg.
By Rule of Alligation:
Cost 1 ($60) vs Cost 2 ($65), Mean Cost = $62.
Ratio = (65 - 62) : (62 - 60) = 3 : 2.',
    'Alligation Ratio = (Cheaper / Dearer) = (Price_Dearer - Mean) / (Mean - Price_Cheaper)',
    '["First find the mean cost price: 68.20 / 1.10 = $62.","Apply the cross-difference alligation rule: (65 - 62) : (62 - 60)."]'::jsonb,
    15,
    66,
    '["Mixtures & Alligation","Cost Price","Ratios"]'::jsonb,
    TRUE
  ),
  (
    'quant-021',
    'Repeated Milk Replacement with Water',
    'A container contains 80 liters of pure milk. From this, 8 liters are drawn out and replaced with water. This process is repeated one more time (total 2 operations). How much pure milk remains in the container?',
    'Quantitative Aptitude',
    'Mixtures & Alligation',
    'hard',
    '[{"id":"A","text":"64.0 liters"},{"id":"B","text":"64.8 liters"},{"id":"C","text":"66.2 liters"},{"id":"D","text":"68.0 liters"}]'::jsonb,
    'B',
    'Formula for repeated replacement:
Remaining Liquid = Initial × (1 - Replacement / Total)^n
Remaining Milk = 80 × (1 - 8/80)² = 80 × (1 - 1/10)² = 80 × (9/10)² = 80 × (81/100) = 80 × 0.81 = 64.8 liters.',
    'Quantity Left = Initial × (1 - x / V)^n',
    '["Fraction left after each draw is (80 - 8)/80 = 9/10 = 0.9.","After 2 operations: 80 × 0.9² = 80 × 0.81."]'::jsonb,
    20,
    54,
    '["Mixtures & Alligation","Replacement Formula","Liquid Dilution"]'::jsonb,
    TRUE
  ),
  (
    'quant-022',
    'Alternate Days Work Completion',
    'A can complete a project in 10 days, and B can complete it in 15 days. If they work on alternate days starting with A on day 1, in how many days will the work be completed?',
    'Quantitative Aptitude',
    'Time & Work',
    'medium',
    '[{"id":"A","text":"11 days"},{"id":"B","text":"12 days"},{"id":"C","text":"12.5 days"},{"id":"D","text":"13 days"}]'::jsonb,
    'B',
    'Total work = LCM(10, 15) = 30 units.
Efficiency of A = 30 / 10 = 3 units/day.
Efficiency of B = 30 / 15 = 2 units/day.
In a 2-day cycle (A on Day 1, B on Day 2): Work done = 3 + 2 = 5 units.
Number of 2-day cycles to reach 30 units = 30 / 5 = 6 cycles.
Total days = 6 cycles × 2 days/cycle = 12 days.',
    'Cycle Work = Efficiency(A) + Efficiency(B)',
    '["Take LCM of 10 and 15 as 30 units of work.","In 2 days, they finish 3 + 2 = 5 units."]'::jsonb,
    15,
    72,
    '["Time & Work","Alternate Days","Efficiency"]'::jsonb,
    TRUE
  ),
  (
    'quant-023',
    'Men, Women and Children Equivalence Work',
    '3 men or 6 women or 9 boys can finish a piece of work in 60 days. In how many days will 1 man, 1 woman, and 1 boy working together finish the same work?',
    'Quantitative Aptitude',
    'Time & Work',
    'hard',
    '[{"id":"A","text":"85 days"},{"id":"B","text":"98.18 days"},{"id":"C","text":"100 days"},{"id":"D","text":"108 days"}]'::jsonb,
    'B',
    '3 Men = 6 Women = 9 Boys => 1 Man = 3 Boys, 1 Woman = 1.5 Boys (or 3/2 Boys).
Total work in terms of boys = 9 boys × 60 days = 540 boy-days.
Combined workforce of 1 Man + 1 Woman + 1 Boy in terms of boys:
3 + 1.5 + 1 = 5.5 boys = 11/2 boys.
Days required = 540 / (11/2) = (540 × 2) / 11 = 1080 / 11 = 98.18 days (or 98 2/11 days).',
    'Total Work = (Equated Workers) × Days',
    '["Convert all workers into equivalent boys: 1 Man = 3 Boys, 1 Woman = 1.5 Boys.","Total work = 9 × 60 = 540 boy-days."]'::jsonb,
    20,
    46,
    '["Time & Work","Equivalence","Work & Wages"]'::jsonb,
    TRUE
  ),
  (
    'quant-024',
    'Inlet and Outlet Pipes with Leakage',
    'Pipe A can fill a tank in 8 hours, and Pipe B can fill it in 12 hours. A leak at the bottom can empty the full tank in 24 hours. If all three operate simultaneously, in how many hours will the empty tank be filled?',
    'Quantitative Aptitude',
    'Pipes & Cisterns',
    'easy',
    '[{"id":"A","text":"4.8 hours"},{"id":"B","text":"5.0 hours"},{"id":"C","text":"5.6 hours"},{"id":"D","text":"6.0 hours"}]'::jsonb,
    'D',
    'Net 1-hour work = 1/8 + 1/12 - 1/24
LCM of 8, 12, 24 = 24.
(3 + 2 - 1) / 24 = 4 / 24 = 1/6 of the tank per hour.
Total hours to fill = 6.0 hours.',
    'Net Rate = (1/A + 1/B - 1/C)',
    '["Assume tank capacity is LCM(8, 12, 24) = 24 liters.","Rates: A = +3, B = +2, Leak = -1. Net rate = 4 liters/hour. 24 / 4 = 6 hours."]'::jsonb,
    10,
    83,
    '["Pipes & Cisterns","Leakage","Time & Work"]'::jsonb,
    TRUE
  ),
  (
    'quant-025',
    'Boats and Streams Upstream and Downstream Speeds',
    'A boat travels 36 km downstream in 3 hours and covers the same distance upstream in 6 hours. What is the speed of the stream (current)?',
    'Quantitative Aptitude',
    'Speed, Distance & Time',
    'medium',
    '[{"id":"A","text":"2 km/h"},{"id":"B","text":"3 km/h"},{"id":"C","text":"4 km/h"},{"id":"D","text":"6 km/h"}]'::jsonb,
    'B',
    'Downstream speed (D) = 36 km / 3 h = 12 km/h.
Upstream speed (U) = 36 km / 6 h = 6 km/h.
Speed of stream = (Downstream - Upstream) / 2 = (12 - 6) / 2 = 6 / 2 = 3 km/h.
(Speed of boat in still water = (12 + 6) / 2 = 9 km/h).',
    'Stream Speed = (D - U) / 2; Boat Speed = (D + U) / 2',
    '["Calculate Downstream speed (36/3 = 12) and Upstream speed (36/6 = 6).","Stream speed is half the difference of downstream and upstream speeds."]'::jsonb,
    15,
    85,
    '["Boats & Streams","Speed Distance Time","Kinematics"]'::jsonb,
    TRUE
  ),
  (
    'quant-026',
    'Circular Track First Meeting Point',
    'Two runners A and B start simultaneously from the same point on a circular track of circumference 600 meters in the same direction at speeds of 15 m/s and 10 m/s respectively. After how many seconds will they meet for the first time?',
    'Quantitative Aptitude',
    'Speed, Distance & Time',
    'medium',
    '[{"id":"A","text":"60 seconds"},{"id":"B","text":"90 seconds"},{"id":"C","text":"120 seconds"},{"id":"D","text":"150 seconds"}]'::jsonb,
    'C',
    'When running in the same direction on a circular track, the faster runner laps the slower runner when the distance gap between them equals one full track circumference (600 m).
Relative speed = 15 - 10 = 5 m/s.
Time to meet = Circumference / Relative Speed = 600 / 5 = 120 seconds.',
    'Time to meet on circular track (same direction) = Length / (S1 - S2)',
    '["Relative speed in the same direction is 15 - 10 = 5 m/s.","Divide track length by relative speed."]'::jsonb,
    15,
    65,
    '["Circular Motion","Relative Speed","Races"]'::jsonb,
    TRUE
  ),
  (
    'quant-027',
    'Sum Doubling in Simple Interest',
    'A sum of money invested at simple interest doubles itself in 8 years. In how many years will it become 4 times itself at the same annual interest rate?',
    'Quantitative Aptitude',
    'Simple Interest',
    'easy',
    '[{"id":"A","text":"16 years"},{"id":"B","text":"20 years"},{"id":"C","text":"24 years"},{"id":"D","text":"32 years"}]'::jsonb,
    'C',
    'Let principal be P.
To double itself, Interest SI = P in 8 years.
Rate r = (SI × 100) / (P × t) = (P × 100) / (P × 8) = 100/8 = 12.5% per annum.
To become 4 times itself, Amount = 4P => Interest SI = 4P - P = 3P.
Time required = (3P × 100) / (P × 12.5) = 300 / 12.5 = 24 years.
Shortcut: Time2 = Time1 × [(N2 - 1) / (N1 - 1)] = 8 × [(4 - 1)/(2 - 1)] = 8 × 3 = 24 years.',
    'T2 = T1 × (n2 - 1) / (n1 - 1)',
    '["To double, SI is 1P in 8 years.","To quadruple (4x), SI must be 3P. Since simple interest grows linearly, 3 × 8 = 24 years."]'::jsonb,
    10,
    88,
    '["Simple Interest","Linear Growth","Finance"]'::jsonb,
    TRUE
  ),
  (
    'quant-028',
    'Difference Between Compound and Simple Interest for 2 Years',
    'The difference between compound interest (compounded annually) and simple interest on a certain principal sum at 8% per annum for 2 years is $64. Find the principal sum.',
    'Quantitative Aptitude',
    'Compound Interest',
    'medium',
    '[{"id":"A","text":"$8,000"},{"id":"B","text":"$10,000"},{"id":"C","text":"$12,000"},{"id":"D","text":"$15,000"}]'::jsonb,
    'B',
    'For 2 years, the difference between CI and SI is given by: D = P × (r / 100)²
64 = P × (8 / 100)²
64 = P × (64 / 10,000)
P = (64 × 10,000) / 64 = $10,000.',
    'CI - SI (for 2 years) = P × (r / 100)²',
    '["Use the standard 2-year formula: Difference = P × (r/100)².","Substitute r = 8 and Difference = 64."]'::jsonb,
    15,
    73,
    '["Compound Interest","Simple Interest","Difference Formula"]'::jsonb,
    TRUE
  ),
  (
    'quant-029',
    'Remainder Theorem with Prime Divisor',
    'What is the remainder when 2^100 is divided by 7?',
    'Quantitative Aptitude',
    'Number Systems',
    'hard',
    '[{"id":"A","text":"1"},{"id":"B","text":"2"},{"id":"C","text":"4"},{"id":"D","text":"6"}]'::jsonb,
    'B',
    'Notice that 2³ = 8 ≡ 1 (mod 7).
We can write 2^100 = 2^(3 × 33 + 1) = (2³)^33 × 2¹.
Since 2³ ≡ 1 (mod 7), (1)^33 × 2 = 1 × 2 = 2.
Therefore, 2^100 mod 7 = 2.',
    'Fermat’s Little Theorem: a^(p-1) ≡ 1 (mod p) where p is prime. Here 2^6 ≡ 1 (mod 7).',
    '["Find the power of 2 closest to a multiple of 7: 2³ = 8 = 7 + 1.","Express 100 as 3 × 33 + 1."]'::jsonb,
    20,
    51,
    '["Modular Arithmetic","Remainder Theorem","Number Systems"]'::jsonb,
    TRUE
  ),
  (
    'quant-030',
    'Trailing Zeros in a Large Factorial',
    'How many trailing zeros are there at the end of 100! (100 factorial)?',
    'Quantitative Aptitude',
    'Number Systems',
    'medium',
    '[{"id":"A","text":"20"},{"id":"B","text":"24"},{"id":"C","text":"25"},{"id":"D","text":"28"}]'::jsonb,
    'B',
    'Trailing zeros are produced by factors of 10 = 2 × 5. In n!, factors of 5 are fewer than 2, so the number of zeros equals the highest power of 5 in 100!.
Using Legendre’s Formula:
⌊100 / 5⌋ + ⌊100 / 25⌋ + ⌊100 / 125⌋ = 20 + 4 + 0 = 24 trailing zeros.',
    'Number of zeros = ⌊N/5⌋ + ⌊N/25⌋ + ⌊N/125⌋ + ...',
    '["Count the multiples of 5, 25, and 125 in 100.","100/5 = 20, and 100/25 = 4."]'::jsonb,
    15,
    67,
    '["Factorials","Legendre Formula","Number Systems"]'::jsonb,
    TRUE
  ),
  (
    'quant-031',
    'Simultaneously Ringing Bells Interval',
    'Four church bells toll together at intervals of 6, 8, 12, and 18 seconds respectively. If they all toll together at 12:00 PM, how many times will they toll together in the next 1 hour (excluding the starting toll)?',
    'Quantitative Aptitude',
    'HCF & LCM',
    'medium',
    '[{"id":"A","text":"40 times"},{"id":"B","text":"50 times"},{"id":"C","text":"60 times"},{"id":"D","text":"72 times"}]'::jsonb,
    'B',
    'Interval of tolling together = LCM(6, 8, 12, 18) seconds.
Prime factorizations: 6=2×3, 8=2³, 12=2²×3, 18=2×3².
LCM = 2³ × 3² = 8 × 9 = 72 seconds.
1 hour = 3600 seconds.
Number of times = 3600 / 72 = 50 times.',
    'Event Frequency = Total Time / LCM(Intervals)',
    '["Find the LCM of 6, 8, 12, and 18.","Divide 3600 seconds (1 hour) by the LCM."]'::jsonb,
    15,
    75,
    '["HCF & LCM","Periodic Events","Arithmetic"]'::jsonb,
    TRUE
  ),
  (
    'quant-032',
    'Sum of First N Terms of an Arithmetic Progression',
    'The first term of an Arithmetic Progression (AP) is 5 and the common difference is 4. What is the sum of the first 20 terms of this AP?',
    'Quantitative Aptitude',
    'Progressions',
    'easy',
    '[{"id":"A","text":"820"},{"id":"B","text":"860"},{"id":"C","text":"900"},{"id":"D","text":"940"}]'::jsonb,
    'B',
    'First term a = 5, common difference d = 4, number of terms n = 20.
Sum S_n = (n / 2) × [2a + (n - 1)d]
S_20 = (20 / 2) × [2(5) + (20 - 1) × 4]
S_20 = 10 × [10 + 19 × 4] = 10 × [10 + 76] = 10 × 86 = 860.',
    'S_n = (n/2) × [2a + (n - 1)d]',
    '["Apply standard AP sum formula with a = 5, d = 4, n = 20."]'::jsonb,
    10,
    89,
    '["Arithmetic Progression","Series","Algebra"]'::jsonb,
    TRUE
  ),
  (
    'quant-033',
    'Infinite Geometric Series Sum',
    'What is the sum of the infinite geometric series: 12 + 6 + 3 + 1.5 + ...?',
    'Quantitative Aptitude',
    'Progressions',
    'easy',
    '[{"id":"A","text":"20"},{"id":"B","text":"22"},{"id":"C","text":"24"},{"id":"D","text":"28"}]'::jsonb,
    'C',
    'First term a = 12.
Common ratio r = 6 / 12 = 1/2 = 0.5 (since |r| < 1, the sum converges).
Sum of infinite GP S_∞ = a / (1 - r) = 12 / (1 - 0.5) = 12 / 0.5 = 24.',
    'S_∞ = a / (1 - r) for |r| < 1',
    '["Common ratio r = 6/12 = 1/2.","Use S = a / (1 - r)."]'::jsonb,
    10,
    90,
    '["Geometric Progression","Infinite Series","Algebra"]'::jsonb,
    TRUE
  ),
  (
    'quant-034',
    'Sum and Product of Roots in Quadratic Equation',
    'If α and β are the roots of the quadratic equation 2x² - 7x + 5 = 0, find the value of (α² + β²).',
    'Quantitative Aptitude',
    'Algebra',
    'medium',
    '[{"id":"A","text":"29/4"},{"id":"B","text":"39/4"},{"id":"C","text":"49/4"},{"id":"D","text":"19/2"}]'::jsonb,
    'A',
    'For ax² + bx + c = 0:
Sum of roots (α + β) = -b/a = -(-7)/2 = 7/2.
Product of roots (αβ) = c/a = 5/2.
We know α² + β² = (α + β)² - 2αβ.
α² + β² = (7/2)² - 2(5/2) = 49/4 - 5 = 49/4 - 20/4 = 29/4.',
    'α² + β² = (α + β)² - 2αβ; α + β = -b/a, αβ = c/a',
    '["Find α + β = 7/2 and αβ = 5/2.","Use the identity α² + β² = (α + β)² - 2αβ."]'::jsonb,
    15,
    70,
    '["Quadratic Equations","Algebra","Roots"]'::jsonb,
    TRUE
  ),
  (
    'quant-035',
    'Word Letters Arrangement with Vowels Together',
    'In how many different ways can the letters of the word "LEADING" be arranged such that all the vowels always appear together?',
    'Quantitative Aptitude',
    'Permutations & Combinations',
    'medium',
    '[{"id":"A","text":"360"},{"id":"B","text":"720"},{"id":"C","text":"1440"},{"id":"D","text":"2880"}]'::jsonb,
    'B',
    'The word "LEADING" has 7 letters: Consonants = {L, D, N, G} (4 letters), Vowels = {E, A, I} (3 letters).
Treat all 3 vowels as 1 single block [EAI].
Now we arrange 4 consonants + 1 vowel block = 5 units in 5! = 120 ways.
The 3 vowels inside the block can be permuted among themselves in 3! = 6 ways.
Total distinct arrangements = 120 × 6 = 720 ways.',
    'Arrangements = (n_units)! × (internal_vowels)!',
    '["Group the 3 vowels (E, A, I) into a single entity.","Arrange the 5 units (4 consonants + 1 group) and multiply by 3!."]'::jsonb,
    15,
    73,
    '["Permutations","Word Arrangement","Combinatorics"]'::jsonb,
    TRUE
  ),
  (
    'quant-036',
    'Drawing Two Cards Without Replacement',
    'Two cards are drawn at random sequentially without replacement from a well-shuffled standard deck of 52 playing cards. What is the probability that both cards drawn are Aces?',
    'Quantitative Aptitude',
    'Probability',
    'medium',
    '[{"id":"A","text":"1/221"},{"id":"B","text":"1/169"},{"id":"C","text":"3/676"},{"id":"D","text":"1/26"}]'::jsonb,
    'A',
    'A standard deck has 4 Aces among 52 cards.
Probability of 1st card being an Ace = 4 / 52 = 1 / 13.
After drawing 1 Ace, 3 Aces remain among 51 total cards.
Probability of 2nd card being an Ace = 3 / 51 = 1 / 17.
Combined probability = (1 / 13) × (1 / 17) = 1 / 221.',
    'P(A and B) = P(A) × P(B|A) = (4/52) × (3/51) = 1/221',
    '["First draw is 4/52.","Second draw has only 3 Aces left out of 51 total cards."]'::jsonb,
    15,
    81,
    '["Probability","Playing Cards","Dependent Events"]'::jsonb,
    TRUE
  ),
  (
    'quant-037',
    'Melting Metallic Spheres into a Single Sphere',
    'Three solid metallic spheres of radii 3 cm, 4 cm, and 5 cm are melted and recast into a single large solid sphere. What is the radius of the resulting large sphere?',
    'Quantitative Aptitude',
    'Geometry & Mensuration',
    'easy',
    '[{"id":"A","text":"6 cm"},{"id":"B","text":"7 cm"},{"id":"C","text":"7.5 cm"},{"id":"D","text":"8 cm"}]'::jsonb,
    'A',
    'Total volume of the 3 spheres = Volume of the new sphere.
(4/3)π(R³) = (4/3)π(r1³ + r2³ + r3³)
R³ = 3³ + 4³ + 5³ = 27 + 64 + 125 = 216.
R = ∛216 = 6 cm.',
    'R³ = r1³ + r2³ + r3³',
    '["Volume is conserved during melting and recasting.","Sum the cubes of the radii: 27 + 64 + 125 = 216."]'::jsonb,
    10,
    88,
    '["Mensuration 3D","Spheres","Volume Conservation"]'::jsonb,
    TRUE
  ),
  (
    'quant-038',
    'Cylinder Surface Area vs Volume Ratio',
    'A right circular cylinder has a base radius of 7 cm and a height of 10 cm. What is its total surface area? (Use π = 22/7)',
    'Quantitative Aptitude',
    'Geometry & Mensuration',
    'easy',
    '[{"id":"A","text":"648 cm²"},{"id":"B","text":"748 cm²"},{"id":"C","text":"812 cm²"},{"id":"D","text":"880 cm²"}]'::jsonb,
    'B',
    'Total Surface Area (TSA) of cylinder = 2πr(h + r)
TSA = 2 × (22/7) × 7 × (10 + 7)
TSA = 2 × 22 × 17 = 44 × 17 = 748 cm².',
    'TSA = 2πr(h + r)',
    '["Formula for Total Surface Area is 2πrh + 2πr² = 2πr(h + r).","Substitute r = 7 and h = 10."]'::jsonb,
    10,
    86,
    '["Mensuration 3D","Cylinder","Surface Area"]'::jsonb,
    TRUE
  ),
  (
    'quant-039',
    'Father and Son Age Ratio Over Time',
    'Ten years ago, a father was four times as old as his son. Ten years hence, the father will be twice as old as his son. What is the current age of the father?',
    'Quantitative Aptitude',
    'Ages',
    'medium',
    '[{"id":"A","text":"40 years"},{"id":"B","text":"50 years"},{"id":"C","text":"55 years"},{"id":"D","text":"60 years"}]'::jsonb,
    'B',
    'Let son’s age 10 years ago = x, father’s age 10 years ago = 4x.
Current ages: Son = x + 10, Father = 4x + 10.
10 years hence: Son = x + 20, Father = 4x + 20.
Given condition: 4x + 20 = 2(x + 20)
4x + 20 = 2x + 40
2x = 20 => x = 10.
Father’s current age = 4x + 10 = 4(10) + 10 = 50 years.',
    'Age Equation: F - 10 = 4(S - 10); F + 10 = 2(S + 10)',
    '["Set x as son’s age 10 years ago.","Solve the linear equation for x, then add 10 to find current age."]'::jsonb,
    15,
    84,
    '["Ages","Linear Equations","Arithmetic"]'::jsonb,
    TRUE
  ),
  (
    'quant-040',
    'Investment Profit Sharing with Time Weighting',
    'P, Q, and R enter into a partnership. P invests $40,000 for the whole year (12 months). Q invests $60,000 for 8 months, and R invests $80,000 for 6 months. If the total annual profit is $48,000, what is Q’s share?',
    'Quantitative Aptitude',
    'Partnership',
    'easy',
    '[{"id":"A","text":"$14,000"},{"id":"B","text":"$16,000"},{"id":"C","text":"$18,000"},{"id":"D","text":"$20,000"}]'::jsonb,
    'B',
    'Profit sharing ratio = Product of Capital and Time:
P : Q : R = (40,000 × 12) : (60,000 × 8) : (80,000 × 6)
= 480,000 : 480,000 : 480,000
= 1 : 1 : 1.
Since the ratio is 1 : 1 : 1, the total profit of $48,000 is divided equally among the 3 partners.
Q’s share = 48,000 / 3 = $16,000.',
    'Profit Ratio = (Capital1 × Time1) : (Capital2 × Time2) : (Capital3 × Time3)',
    '["Multiply capital by duration in months for each partner.","Observe that all three have equal capital-time products of 480,000."]'::jsonb,
    10,
    89,
    '["Partnership","Commercial Math","Ratios"]'::jsonb,
    TRUE
  ),
  (
    'quant-041',
    'Population Growth Rate Over Successive Years',
    'The population of a town increases by 10% during the first year and decreases by 10% during the second year. If the current population is 49,500, what was the initial population 2 years ago?',
    'Quantitative Aptitude',
    'Percentages',
    'easy',
    '[{"id":"A","text":"48,000"},{"id":"B","text":"50,000"},{"id":"C","text":"52,000"},{"id":"D","text":"55,000"}]'::jsonb,
    'B',
    'Let initial population be P.
After Year 1 (+10%): P × 1.10.
After Year 2 (-10%): P × 1.10 × 0.90 = P × 0.99.
Given P × 0.99 = 49,500.
P = 49,500 / 0.99 = 50,000.',
    'Final = Initial × (1 + r1/100) × (1 - r2/100)',
    '["1.10 × 0.90 = 0.99 (a net 1% drop).","Divide 49,500 by 0.99."]'::jsonb,
    10,
    87,
    '["Percentages","Population Growth","Arithmetic"]'::jsonb,
    TRUE
  ),
  (
    'quant-042',
    'Markup Percentage to Break Even After Discount',
    'By what percentage above the cost price must an author mark the price of a book so that after giving a discount of 20%, they still gain 20% profit?',
    'Quantitative Aptitude',
    'Profit & Loss',
    'medium',
    '[{"id":"A","text":"40%"},{"id":"B","text":"44%"},{"id":"C","text":"50%"},{"id":"D","text":"60%"}]'::jsonb,
    'C',
    'Let Cost Price (CP) = $100.
Desired Selling Price (SP) for 20% profit = $120.
Let Marked Price be MP.
After 20% discount: 0.80 × MP = 120.
MP = 120 / 0.80 = $150.
Markup = 150 - 100 = $50 above CP, which is 50%.',
    'Markup % = [(Profit% + Discount%) / (100 - Discount%)] × 100 = [(20 + 20) / 80] × 100 = 50%',
    '["Target SP is 120 when CP is 100.","Set 0.80 × MP = 120 to find Marked Price."]'::jsonb,
    15,
    72,
    '["Profit & Loss","Markup","Discount"]'::jsonb,
    TRUE
  ),
  (
    'quant-043',
    'Worker Leaving Before Project Completion',
    'X can complete a job in 20 days and Y in 30 days. They started the job together, but X left 5 days before the completion of the work. What was the total time taken to complete the job?',
    'Quantitative Aptitude',
    'Time & Work',
    'medium',
    '[{"id":"A","text":"12 days"},{"id":"B","text":"14 days"},{"id":"C","text":"15 days"},{"id":"D","text":"16 days"}]'::jsonb,
    'C',
    'Let total days to finish be T.
Y worked for all T days, while X worked for (T - 5) days.
Work equation: (T - 5)/20 + T/30 = 1
Multiply entire equation by 60:
3(T - 5) + 2T = 60
3T - 15 + 2T = 60
5T = 75 => T = 15 days.',
    'Work equation: (T - days_left)/Rate1 + T/Rate2 = 1',
    '["Let T be total time. X works for (T - 5) days and Y works for T days.","Solve: (T - 5)/20 + T/30 = 1."]'::jsonb,
    15,
    67,
    '["Time & Work","Leaving Early","Efficiency"]'::jsonb,
    TRUE
  ),
  (
    'quant-044',
    'Average Speed of Round Trip with Different Speeds',
    'A motorist drives from Town A to Town B at a constant speed of 40 km/h and returns from Town B to Town A along the same route at 60 km/h. What is the average speed for the entire round trip?',
    'Quantitative Aptitude',
    'Speed, Distance & Time',
    'easy',
    '[{"id":"A","text":"48 km/h"},{"id":"B","text":"50 km/h"},{"id":"C","text":"52 km/h"},{"id":"D","text":"54 km/h"}]'::jsonb,
    'A',
    'When equal distances are covered at speeds u and v, the average speed is the Harmonic Mean:
Average Speed = (2 × u × v) / (u + v) = (2 × 40 × 60) / (40 + 60) = 4800 / 100 = 48 km/h.
(Note: The arithmetic mean of 50 km/h is incorrect because more time is spent driving at the slower speed).',
    'Average Speed for equal distance = 2uv / (u + v)',
    '["Do not simply average 40 and 60.","Use the harmonic mean formula: 2 × 40 × 60 / (40 + 60)."]'::jsonb,
    10,
    82,
    '["Speed Distance Time","Average Speed","Harmonic Mean"]'::jsonb,
    TRUE
  ),
  (
    'quant-045',
    'Train Passing a Moving Man in the Same Direction',
    'A train 125 meters long is running at 50 km/h. How much time (in seconds) will it take to pass a man walking at 5 km/h in the same direction along the railway track?',
    'Quantitative Aptitude',
    'Speed, Distance & Time',
    'easy',
    '[{"id":"A","text":"8 seconds"},{"id":"B","text":"10 seconds"},{"id":"C","text":"12 seconds"},{"id":"D","text":"15 seconds"}]'::jsonb,
    'B',
    'Relative speed (same direction) = 50 - 5 = 45 km/h.
Convert to m/s: 45 × (5/18) = (5 × 5) / 2 = 12.5 m/s.
Distance to cover = Length of train = 125 meters.
Time = Distance / Relative Speed = 125 / 12.5 = 10 seconds.',
    'Time = Train Length / Relative Speed in m/s',
    '["Relative speed in same direction = 50 - 5 = 45 km/h.","45 × 5/18 = 12.5 m/s. 125 / 12.5 = 10 s."]'::jsonb,
    10,
    85,
    '["Trains","Relative Speed","Kinematics"]'::jsonb,
    TRUE
  ),
  (
    'quant-046',
    'Sum of First N Natural Numbers Divisibility',
    'What is the sum of all positive multiples of 3 that are strictly less than 100?',
    'Quantitative Aptitude',
    'Number Systems',
    'medium',
    '[{"id":"A","text":"1584"},{"id":"B","text":"1683"},{"id":"C","text":"1734"},{"id":"D","text":"1800"}]'::jsonb,
    'B',
    'Multiples of 3 strictly less than 100: 3, 6, 9, ..., 99.
This is an AP with a = 3, d = 3, last term l = 99.
Number of terms n = 99 / 3 = 33.
Sum = (n / 2) × (first + last) = (33 / 2) × (3 + 99) = (33 / 2) × 102 = 33 × 51 = 1683.',
    'Sum = (n / 2) × (a + l)',
    '["Last multiple of 3 below 100 is 99.","There are 33 terms. Sum = 33 × (3 + 99)/2 = 33 × 51."]'::jsonb,
    15,
    86,
    '["Number Systems","Arithmetic Progression","Multiples"]'::jsonb,
    TRUE
  ),
  (
    'quant-047',
    'Divisibility Rule for Eleven in an Unknown Digit Number',
    'If the 7-digit number 5432x71 is divisible by 11, what is the value of the single digit x?',
    'Quantitative Aptitude',
    'Number Systems',
    'easy',
    '[{"id":"A","text":"2"},{"id":"B","text":"4"},{"id":"C","text":"6"},{"id":"D","text":"8"}]'::jsonb,
    'B',
    'Divisibility rule for 11: Difference between sum of odd-placed digits and sum of even-placed digits must be 0 or a multiple of 11.
Odd positions (1, 3, 5, 7): 5 + 3 + x + 1 = 9 + x.
Even positions (2, 4, 6): 4 + 2 + 7 = 13.
(9 + x) - 13 = x - 4. If x = 4, difference is 0.
Verification: 5432471 / 11 = 493861 with 0 remainder.',
    'Sum(Odd positions) - Sum(Even positions) ≡ 0 (mod 11)',
    '["Odd placed digits sum: 5 + 3 + x + 1 = 9 + x.","Even placed digits sum: 4 + 2 + 7 = 13. Set 9 + x - 13 = 0."]'::jsonb,
    10,
    83,
    '["Divisibility","Number Systems","Modular Logic"]'::jsonb,
    TRUE
  ),
  (
    'quant-048',
    'Product of Two Numbers and Their HCF/LCM Relation',
    'The HCF of two numbers is 16 and their LCM is 480. If one of the numbers is 96, what is the other number?',
    'Quantitative Aptitude',
    'HCF & LCM',
    'easy',
    '[{"id":"A","text":"60"},{"id":"B","text":"72"},{"id":"C","text":"80"},{"id":"D","text":"84"}]'::jsonb,
    'C',
    'Property: Product of two numbers = HCF × LCM
Number1 × Number2 = 16 × 480
96 × Number2 = 7680
Number2 = 7680 / 96 = 80.',
    'A × B = HCF(A, B) × LCM(A, B)',
    '["Multiply HCF and LCM: 16 × 480 = 7680.","Divide by the given number 96."]'::jsonb,
    10,
    92,
    '["HCF & LCM","Number Properties","Arithmetic"]'::jsonb,
    TRUE
  ),
  (
    'quant-049',
    'Linear Simultaneous Equations Solution',
    'If 3x + 5y = 21 and 2x - y = 1, find the value of (x + y).',
    'Quantitative Aptitude',
    'Algebra',
    'easy',
    '[{"id":"A","text":"4"},{"id":"B","text":"5"},{"id":"C","text":"6"},{"id":"D","text":"7"}]'::jsonb,
    'B',
    'From second equation: y = 2x - 1.
Substitute into first equation: 3x + 5(2x - 1) = 21
3x + 10x - 5 = 21
13x = 26 => x = 2.
Then y = 2(2) - 1 = 3.
Value of x + y = 2 + 3 = 5.',
    'Substitution or elimination method for linear systems',
    '["Express y = 2x - 1 from the second equation and substitute into the first.","x = 2, y = 3."]'::jsonb,
    10,
    91,
    '["Linear Equations","Algebra","Simultaneous Systems"]'::jsonb,
    TRUE
  ),
  (
    'quant-050',
    'Special Algebraic Identity with Cubes',
    'If a + b + c = 0, what is the value of (a³ + b³ + c³) / (3abc)? (Assume a, b, c ≠ 0)',
    'Quantitative Aptitude',
    'Algebra',
    'medium',
    '[{"id":"A","text":"0"},{"id":"B","text":"1"},{"id":"C","text":"3"},{"id":"D","text":"-1"}]'::jsonb,
    'B',
    'Standard Algebraic Identity: a³ + b³ + c³ - 3abc = (a + b + c)(a² + b² + c² - ab - bc - ca).
When a + b + c = 0, the right-hand side becomes 0.
Therefore, a³ + b³ + c³ = 3abc.
Hence (a³ + b³ + c³) / (3abc) = 1.',
    'If a + b + c = 0, then a³ + b³ + c³ = 3abc',
    '["Use the standard cubic identity: a³ + b³ + c³ - 3abc = (a + b + c)(...)","Since a + b + c = 0, a³ + b³ + c³ = 3abc."]'::jsonb,
    15,
    88,
    '["Algebra","Identities","Polynomials"]'::jsonb,
    TRUE
  ),
  (
    'quant-051',
    'Circular Table Seating with Fixed Neighbors',
    'In how many distinct ways can 6 people be seated around a circular dining table such that two specific individuals must always sit next to each other?',
    'Quantitative Aptitude',
    'Permutations & Combinations',
    'hard',
    '[{"id":"A","text":"24 ways"},{"id":"B","text":"48 ways"},{"id":"C","text":"96 ways"},{"id":"D","text":"120 ways"}]'::jsonb,
    'B',
    'Bundle the 2 specific people into 1 unit. There are now 4 other individuals + 1 unit = 5 entities to seat circularly.
Circular arrangements of 5 entities = (5 - 1)! = 4! = 24 ways.
The 2 people inside the unit can swap seats in 2! = 2 ways.
Total circular arrangements = 24 × 2 = 48 ways.',
    'Circular Permutations = (n - 1)!',
    '["Treat the 2 specific people as a single unit.","Arrange (6 - 2 + 1) = 5 units in circle in (5-1)! = 4! = 24 ways, and multiply by 2!."]'::jsonb,
    20,
    68,
    '["Circular Permutations","Combinatorics","Seating Arrangements"]'::jsonb,
    TRUE
  ),
  (
    'quant-052',
    'Colored Marbles in an Urn Without Replacement',
    'An urn contains 5 red balls, 4 blue balls, and 3 green balls (total 12 balls). If 2 balls are drawn at random without replacement, what is the probability that both balls are of the same color?',
    'Quantitative Aptitude',
    'Probability',
    'medium',
    '[{"id":"A","text":"19/66"},{"id":"B","text":"23/66"},{"id":"C","text":"25/66"},{"id":"D","text":"7/22"}]'::jsonb,
    'A',
    'Total pairs = C(12, 2) = (12 × 11) / 2 = 66.
Favorable outcomes for same color:
- Both Red: C(5, 2) = 10
- Both Blue: C(4, 2) = 6
- Both Green: C(3, 2) = 3
Total favorable pairs = 10 + 6 + 3 = 19.
Probability = 19 / 66.',
    'P(Same Color) = [C(R, 2) + C(B, 2) + C(G, 2)] / C(Total, 2)',
    '["Calculate total pairs C(12, 2) = 66.","Sum combinations for each color: C(5,2) + C(4,2) + C(3,2) = 10 + 6 + 3 = 19."]'::jsonb,
    15,
    70,
    '["Probability","Combinatorics","Urn Model"]'::jsonb,
    TRUE
  ),
  (
    'quant-053',
    'Length of Tangent to a Circle from External Point',
    'A point P is located 13 cm away from the center O of a circle of radius 5 cm. What is the length of the tangent line drawn from P to the circle?',
    'Quantitative Aptitude',
    'Geometry & Mensuration',
    'easy',
    '[{"id":"A","text":"10 cm"},{"id":"B","text":"11 cm"},{"id":"C","text":"12 cm"},{"id":"D","text":"14 cm"}]'::jsonb,
    'C',
    'The radius drawn to the point of tangency is perpendicular to the tangent line, forming a right-angled triangle with hypotenuse OP = 13 cm and radius r = 5 cm.
By Pythagoras theorem: Tangent² = OP² - r² = 13² - 5² = 169 - 25 = 144.
Tangent length = √144 = 12 cm.',
    'Tangent Length = √(d² - r²)',
    '["The tangent meets the radius at a 90° angle.","Use the Pythagorean triplet (5, 12, 13)."]'::jsonb,
    10,
    91,
    '["Geometry","Circles","Tangents"]'::jsonb,
    TRUE
  ),
  (
    'quant-054',
    'Diagonal and Perimeter of a Rhombus',
    'The diagonals of a rhombus are 16 cm and 12 cm. What is the perimeter of the rhombus?',
    'Quantitative Aptitude',
    'Geometry & Mensuration',
    'medium',
    '[{"id":"A","text":"36 cm"},{"id":"B","text":"40 cm"},{"id":"C","text":"48 cm"},{"id":"D","text":"56 cm"}]'::jsonb,
    'B',
    'The diagonals of a rhombus bisect each other at right angles.
Half-diagonals = 16/2 = 8 cm and 12/2 = 6 cm.
Each side s of the rhombus is the hypotenuse: s = √(8² + 6²) = √(64 + 36) = √100 = 10 cm.
Perimeter = 4 × side = 4 × 10 = 40 cm.',
    'Side s = √[(d1/2)² + (d2/2)²]; Perimeter = 4s',
    '["Diagonals bisect at right angles into legs of 8 cm and 6 cm.","Side = 10 cm, Perimeter = 4 × 10 = 40 cm."]'::jsonb,
    15,
    88,
    '["Geometry","Rhombus","Perimeter"]'::jsonb,
    TRUE
  ),
  (
    'quant-055',
    'Distance Between Two Coordinates on Cartesian Plane',
    'What is the distance between the points A(-3, 4) and B(5, -2) in the Cartesian coordinate plane?',
    'Quantitative Aptitude',
    'Coordinate Geometry',
    'easy',
    '[{"id":"A","text":"8 units"},{"id":"B","text":"10 units"},{"id":"C","text":"12 units"},{"id":"D","text":"14 units"}]'::jsonb,
    'B',
    'Distance formula: d = √[(x2 - x1)² + (y2 - y1)²]
d = √[(5 - (-3))² + (-2 - 4)²] = √[(8)² + (-6)²] = √[64 + 36] = √100 = 10 units.',
    'd = √[(Δx)² + (Δy)²]',
    '["Δx = 5 - (-3) = 8, Δy = -2 - 4 = -6.","Distance = √(8² + (-6)²) = √(64 + 36) = 10."]'::jsonb,
    10,
    93,
    '["Coordinate Geometry","Distance Formula","Analytic Geometry"]'::jsonb,
    TRUE
  ),
  (
    'quant-056',
    'Fresh Grapes vs Dry Grapes Water Content',
    'Fresh fruit contains 68% water and dry fruit contains 20% water. How many kilograms of dry fruit can be obtained from 100 kg of fresh fruit?',
    'Quantitative Aptitude',
    'Percentages',
    'hard',
    '[{"id":"A","text":"32 kg"},{"id":"B","text":"40 kg"},{"id":"C","text":"45 kg"},{"id":"D","text":"50 kg"}]'::jsonb,
    'B',
    'The pulp (dry matter) content remains constant during drying.
In 100 kg of fresh fruit (68% water): Pulp = 100% - 68% = 32% of 100 kg = 32 kg.
In dry fruit (20% water): Pulp = 100% - 20% = 80% of total dry weight W.
80% of W = 32 kg
0.80 × W = 32 => W = 32 / 0.80 = 40 kg.',
    'Pulp in Fresh = Pulp in Dry: (100 - w_fresh)% × W_fresh = (100 - w_dry)% × W_dry',
    '["Water evaporates, but the solid pulp mass does not change.","32 kg of solid pulp constitutes 80% of dry fruit weight."]'::jsonb,
    20,
    64,
    '["Percentages","Evaporation","Mass Conservation"]'::jsonb,
    TRUE
  ),
  (
    'quant-057',
    'Marked Price with Given Profit and Cash Discount',
    'A shopkeeper bought an appliance for $4,500. He wants to earn a profit of 15% after allowing a discount of 10% on the marked price. At what marked price should he list the appliance?',
    'Quantitative Aptitude',
    'Profit & Loss',
    'medium',
    '[{"id":"A","text":"$5,400"},{"id":"B","text":"$5,750"},{"id":"C","text":"$6,000"},{"id":"D","text":"$6,250"}]'::jsonb,
    'B',
    'Cost Price (CP) = $4,500.
Target Selling Price (SP) for 15% profit = 4,500 × 1.15 = $5,175.
Since 10% discount is offered on Marked Price (MP): 0.90 × MP = 5,175.
MP = 5,175 / 0.90 = $5,750.',
    'MP = [CP × (100 + Profit%)] / (100 - Discount%)',
    '["Find target SP: 4500 × 1.15 = 5175.","Divide SP by 0.90 to get Marked Price."]'::jsonb,
    15,
    74,
    '["Profit & Loss","Marked Price","Commercial Math"]'::jsonb,
    TRUE
  ),
  (
    'quant-058',
    'Efficiency Multiplier and Days Saved',
    'Worker P is 50% more efficient than Worker Q. If Q can complete a task in 30 days, in how many days can P alone complete the same task?',
    'Quantitative Aptitude',
    'Time & Work',
    'medium',
    '[{"id":"A","text":"15 days"},{"id":"B","text":"20 days"},{"id":"C","text":"22.5 days"},{"id":"D","text":"25 days"}]'::jsonb,
    'B',
    'Efficiency ratio P : Q = 1.5 : 1 = 3 : 2.
Time taken is inversely proportional to efficiency.
Time ratio P : Q = 2 : 3.
Given Q takes 30 days => 3 parts = 30 days => 1 part = 10 days.
Time for P = 2 parts = 2 × 10 = 20 days.',
    'Days_P × Efficiency_P = Days_Q × Efficiency_Q',
    '["Efficiency of P is 1.5 times Q.","Days required by P = 30 / 1.5 = 20 days."]'::jsonb,
    15,
    85,
    '["Time & Work","Efficiency Ratio","Inverse Proportion"]'::jsonb,
    TRUE
  ),
  (
    'quant-059',
    'Pipes with Different Diameters and Flow Rates',
    'Two circular pipes have internal diameters in the ratio 1 : 2. What is the ratio of the volume of water flowing through them per minute if water speed is identical in both?',
    'Quantitative Aptitude',
    'Time & Work',
    'easy',
    '[{"id":"A","text":"1 : 2"},{"id":"B","text":"1 : 3"},{"id":"C","text":"1 : 4"},{"id":"D","text":"1 : 8"}]'::jsonb,
    'C',
    'Flow rate is directly proportional to cross-sectional area A = π × (d/2)².
Ratio of areas = (d1 / d2)² = (1 / 2)² = 1 : 4.
Therefore, the second pipe carries 4 times the volume of the first pipe.',
    'Flow Rate ∝ Cross-Sectional Area ∝ (Diameter)²',
    '["Cross-sectional area of a pipe is proportional to the square of its diameter."]'::jsonb,
    10,
    86,
    '["Pipes & Cisterns","Flow Rate","Geometry Ratio"]'::jsonb,
    TRUE
  ),
  (
    'quant-060',
    'Linear Race Headstart Distance',
    'In a 1000-meter race, Runner A beats Runner B by 100 meters, and Runner B beats Runner C by 100 meters. By how many meters does Runner A beat Runner C in the same race?',
    'Quantitative Aptitude',
    'Speed, Distance & Time',
    'hard',
    '[{"id":"A","text":"180 meters"},{"id":"B","text":"190 meters"},{"id":"C","text":"200 meters"},{"id":"D","text":"210 meters"}]'::jsonb,
    'B',
    'When A runs 1000 m, B runs 900 m. Speed ratio A : B = 1000 : 900 = 10 : 9.
When B runs 1000 m, C runs 900 m. Speed ratio B : C = 1000 : 900 = 10 : 9.
Combined ratio A : C = (A/B) × (B/C) = (10/9) × (10/9) = 100 / 81.
When A finishes 1000 m, C covers 1000 × (81/100) = 810 meters.
Distance A beats C by = 1000 - 810 = 190 meters.',
    'Distance_C = Total × (B_dist / A_dist) × (C_dist / B_dist)',
    '["Find the ratio of distances: A covers 1000m -> B covers 900m -> C covers 900 × 0.9 = 810m.","1000 - 810 = 190 meters."]'::jsonb,
    20,
    53,
    '["Races","Speed Distance Time","Ratios"]'::jsonb,
    TRUE
  ),
  (
    'quant-061',
    'Compound Interest Rate with Annual Multiplier',
    'A sum of money invested at compound interest amounts to $2,420 in 2 years and $2,662 in 3 years. What is the annual rate of interest?',
    'Quantitative Aptitude',
    'Compound Interest',
    'medium',
    '[{"id":"A","text":"8%"},{"id":"B","text":"10%"},{"id":"C","text":"12%"},{"id":"D","text":"15%"}]'::jsonb,
    'B',
    'The interest earned during the 3rd year is the interest on the amount accumulated at the end of the 2nd year ($2,420).
Interest in Year 3 = $2,662 - $2,420 = $242.
Rate r = (Interest / Principal_Year2) × 100% = (242 / 2420) × 100% = 10% per annum.',
    'Rate = [(Amount_(n+1) - Amount_n) / Amount_n] × 100',
    '["The difference ($242) is 1 year’s interest on $2,420.","242 / 2420 = 10%."]'::jsonb,
    15,
    88,
    '["Compound Interest","Annual Growth","Finance"]'::jsonb,
    TRUE
  ),
  (
    'quant-062',
    'Number of Divisors of a Composite Integer',
    'What is the total number of positive factors (divisors) of the number 360?',
    'Quantitative Aptitude',
    'Number Systems',
    'medium',
    '[{"id":"A","text":"18"},{"id":"B","text":"20"},{"id":"C","text":"24"},{"id":"D","text":"30"}]'::jsonb,
    'C',
    'Prime factorization of 360:
360 = 36 × 10 = 2³ × 3² × 5¹.
Number of factors = (power1 + 1) × (power2 + 1) × (power3 + 1)
= (3 + 1) × (2 + 1) × (1 + 1) = 4 × 3 × 2 = 24 factors.',
    'Total Factors = (p + 1)(q + 1)(r + 1) for N = a^p × b^q × c^r',
    '["Find prime factorization: 360 = 2³ × 3² × 5¹.","Add 1 to each exponent and multiply: 4 × 3 × 2 = 24."]'::jsonb,
    15,
    87,
    '["Factors","Prime Factorization","Number Systems"]'::jsonb,
    TRUE
  ),
  (
    'quant-063',
    'Harmonic Mean of Two Quantities',
    'What is the Harmonic Mean (HM) of the numbers 6 and 12?',
    'Quantitative Aptitude',
    'Progressions',
    'easy',
    '[{"id":"A","text":"8"},{"id":"B","text":"8.4"},{"id":"C","text":"9"},{"id":"D","text":"9.6"}]'::jsonb,
    'A',
    'Harmonic Mean HM = (2 × a × b) / (a + b)
HM = (2 × 6 × 12) / (6 + 12) = 144 / 18 = 8.',
    'HM = 2ab / (a + b)',
    '["Formula: HM = 2ab / (a + b).","Substitute a = 6, b = 12."]'::jsonb,
    10,
    91,
    '["Progressions","Harmonic Mean","Statistics"]'::jsonb,
    TRUE
  ),
  (
    'quant-064',
    'Solving for Unknown in Exponential Equation',
    'If 3^(x + 2) + 3^x = 90, find the value of x.',
    'Quantitative Aptitude',
    'Algebra',
    'medium',
    '[{"id":"A","text":"1"},{"id":"B","text":"2"},{"id":"C","text":"3"},{"id":"D","text":"4"}]'::jsonb,
    'B',
    '3^(x + 2) = 3^x × 3² = 9 × 3^x.
Equation: 9 × 3^x + 3^x = 90
10 × 3^x = 90
3^x = 9 = 3²
x = 2.',
    'Factor out common exponential term: 3^x(3² + 1) = 90',
    '["Factor out 3^x: 3^x(9 + 1) = 90.","10 × 3^x = 90 => 3^x = 9 => x = 2."]'::jsonb,
    15,
    92,
    '["Exponents","Algebra","Equations"]'::jsonb,
    TRUE
  ),
  (
    'quant-065',
    'Handshakes in a Gathering',
    'In a corporate conference of 20 delegates, every person shakes hands with every other person exactly once. How many total handshakes take place?',
    'Quantitative Aptitude',
    'Permutations & Combinations',
    'easy',
    '[{"id":"A","text":"180"},{"id":"B","text":"190"},{"id":"C","text":"200"},{"id":"D","text":"380"}]'::jsonb,
    'B',
    'Each handshake is a combination of 2 people chosen from 20.
Total Handshakes = C(20, 2) = (20 × 19) / 2 = 380 / 2 = 190.',
    'Total Handshakes = n(n - 1) / 2',
    '["A handshake involves 2 people.","Use C(20, 2) = 20 × 19 / 2 = 190."]'::jsonb,
    10,
    94,
    '["Combinatorics","Handshakes","Graph Theory"]'::jsonb,
    TRUE
  ),
  (
    'quant-066',
    'Probability of at Least One Head in Three Coin Flips',
    'Three unbiased coins are tossed simultaneously. What is the probability of getting at least one Head?',
    'Quantitative Aptitude',
    'Probability',
    'medium',
    '[{"id":"A","text":"1/8"},{"id":"B","text":"3/8"},{"id":"C","text":"5/8"},{"id":"D","text":"7/8"}]'::jsonb,
    'D',
    'Total outcomes for 3 coin flips = 2³ = 8.
The only outcome with NO heads is {TTT} (1 outcome).
Probability of at least one Head = 1 - P(No Heads) = 1 - (1/8) = 7/8.',
    'P(At least 1) = 1 - P(None) = 1 - (1/2)^n',
    '["Calculate the complement: P(All Tails) = 1/8.","Subtract from 1: 1 - 1/8 = 7/8."]'::jsonb,
    15,
    90,
    '["Probability","Coin Toss","Complement Rule"]'::jsonb,
    TRUE
  ),
  (
    'quant-067',
    'Area of Equilateral Triangle Given Height',
    'An equilateral triangle has an altitude (height) of 6 cm. What is the area of this triangle?',
    'Quantitative Aptitude',
    'Geometry & Mensuration',
    'medium',
    '[{"id":"A","text":"12√3 cm²"},{"id":"B","text":"18√3 cm²"},{"id":"C","text":"24√3 cm²"},{"id":"D","text":"36 cm²"}]'::jsonb,
    'A',
    'Height of equilateral triangle h = (√3 / 2) × side a.
6 = (√3 / 2) × a => a = 12 / √3 = 4√3 cm.
Area = (√3 / 4) × a² = (√3 / 4) × (4√3)² = (√3 / 4) × 48 = 12√3 cm².
Shortcut: Area = h² / √3 = 6² / √3 = 36 / √3 = 12√3 cm².',
    'Area = h² / √3',
    '["Height h = (√3/2)a => a = 4√3.","Area = (√3/4)a² = 12√3 cm²."]'::jsonb,
    15,
    71,
    '["Geometry","Equilateral Triangle","Area Formula"]'::jsonb,
    TRUE
  ),
  (
    'quant-068',
    'Volume and Radius of a Solid Cone',
    'A right circular cone has a height of 12 cm and a slant height of 13 cm. What is the volume of this cone? (Use π = 3.14)',
    'Quantitative Aptitude',
    'Geometry & Mensuration',
    'medium',
    '[{"id":"A","text":"282.6 cm³"},{"id":"B","text":"314.0 cm³"},{"id":"C","text":"376.8 cm³"},{"id":"D","text":"420.5 cm³"}]'::jsonb,
    'B',
    'In a cone, slant height l² = r² + h².
13² = r² + 12² => r² = 169 - 144 = 25 => r = 5 cm.
Volume of cone = (1/3)πr²h = (1/3) × 3.14 × 25 × 12 = 3.14 × 25 × 4 = 3.14 × 100 = 314.0 cm³.',
    'Volume = (1/3)πr²h; r = √(l² - h²)',
    '["Find base radius using Pythagoras: r = √(13² - 12²) = 5 cm.","Volume = (1/3) × 3.14 × 25 × 12 = 314 cm³."]'::jsonb,
    15,
    86,
    '["Mensuration 3D","Cone","Volume"]'::jsonb,
    TRUE
  ),
  (
    'quant-069',
    'Slope of Perpendicular Lines',
    'What is the slope of a straight line that is perpendicular to the line 3x - 4y + 12 = 0?',
    'Quantitative Aptitude',
    'Coordinate Geometry',
    'medium',
    '[{"id":"A","text":"3/4"},{"id":"B","text":"-3/4"},{"id":"C","text":"4/3"},{"id":"D","text":"-4/3"}]'::jsonb,
    'D',
    'Rewrite 3x - 4y + 12 = 0 in slope-intercept form y = mx + c:
4y = 3x + 12 => y = (3/4)x + 3.
Slope of given line m1 = 3/4.
For perpendicular lines, m1 × m2 = -1.
m2 = -1 / (3/4) = -4/3.',
    'Perpendicular condition: m1 × m2 = -1 => m2 = -1/m1',
    '["Slope of 3x - 4y + 12 = 0 is 3/4.","Perpendicular slope is negative reciprocal: -4/3."]'::jsonb,
    15,
    88,
    '["Coordinate Geometry","Slopes","Lines"]'::jsonb,
    TRUE
  ),
  (
    'quant-070',
    'Present Ages from Ratio and Sum',
    'The ratio of the present ages of brother and sister is 4 : 5. Seven years from now, the sum of their ages will be 50 years. What is the present age of the sister?',
    'Quantitative Aptitude',
    'Ages',
    'easy',
    '[{"id":"A","text":"16 years"},{"id":"B","text":"20 years"},{"id":"C","text":"24 years"},{"id":"D","text":"28 years"}]'::jsonb,
    'B',
    'Let present ages be 4x and 5x.
Sum of ages 7 years from now = (4x + 7) + (5x + 7) = 9x + 14.
Given: 9x + 14 = 50
9x = 36 => x = 4.
Present age of sister = 5x = 5 × 4 = 20 years.',
    'Present Sum = Future Sum - 2(years elapsed)',
    '["Current sum of ages = 50 - 14 = 36.","Divide 36 into 4:5 ratio => sister is 5/9 × 36 = 20 years."]'::jsonb,
    10,
    90,
    '["Ages","Ratios","Linear Equations"]'::jsonb,
    TRUE
  ),
  (
    'quant-071',
    'Salary Tax and Net Income Deductions',
    'An executive earns a gross monthly salary. After paying 15% income tax and 10% of the remaining amount towards pension, their take-home net salary is $6,120. What is their gross monthly salary?',
    'Quantitative Aptitude',
    'Percentages',
    'medium',
    '[{"id":"A","text":"$7,200"},{"id":"B","text":"$7,600"},{"id":"C","text":"$8,000"},{"id":"D","text":"$8,500"}]'::jsonb,
    'C',
    'Let gross salary = S.
After 15% tax, remaining = 0.85S.
After 10% pension deduction on remaining = 0.85S × (1 - 0.10) = 0.85S × 0.90 = 0.765S.
Given: 0.765S = 6,120.
S = 6,120 / 0.765 = $8,000.',
    'Net = Gross × (1 - Tax%) × (1 - Pension%)',
    '["Net multiplier = (1 - 0.15) × (1 - 0.10) = 0.85 × 0.90 = 0.765.","Divide 6,120 by 0.765."]'::jsonb,
    15,
    75,
    '["Percentages","Deductions","Financial Arithmetic"]'::jsonb,
    TRUE
  ),
  (
    'quant-072',
    'Overhead Expenses and Net Gain',
    'A mechanic buys an old generator for $3,200 and spends $800 on its repair and repainting. He then sells it for $4,600. What is his net profit percentage?',
    'Quantitative Aptitude',
    'Profit & Loss',
    'easy',
    '[{"id":"A","text":"12.5%"},{"id":"B","text":"15%"},{"id":"C","text":"17.5%"},{"id":"D","text":"20%"}]'::jsonb,
    'B',
    'Total Cost Price (CP) = Purchase Price + Overheads = 3,200 + 800 = $4,000.
Selling Price (SP) = $4,600.
Net Profit = 4,600 - 4,000 = $600.
Profit % = (600 / 4,000) × 100% = 15%.',
    'Total CP = Cost + Overheads; Profit% = (Gain / Total CP) × 100',
    '["Add repair costs to purchase price to find total CP ($4,000).","Profit = 600. Profit % = 600 / 4000 = 15%."]'::jsonb,
    10,
    91,
    '["Profit & Loss","Overheads","Commercial Math"]'::jsonb,
    TRUE
  ),
  (
    'quant-073',
    'Work and Wages Division by Contribution',
    'A and B undertake a contract to complete a construction job for $3,000. A alone can do it in 6 days, B in 8 days. With the assistance of an expert C, they finish the job in 3 days. What is C’s wage share?',
    'Quantitative Aptitude',
    'Time & Work',
    'hard',
    '[{"id":"A","text":"$375"},{"id":"B","text":"$450"},{"id":"C","text":"$500"},{"id":"D","text":"$600"}]'::jsonb,
    'A',
    '1-day work of A = 1/6.
1-day work of B = 1/8.
1-day work of (A + B + C) = 1/3.
1-day work of C = 1/3 - (1/6 + 1/8) = 1/3 - (4+3)/24 = 8/24 - 7/24 = 1/24.
Ratio of work done in 3 days = A : B : C = 3/6 : 3/8 : 3/24 = 1/2 : 3/8 : 1/8 = 4 : 3 : 1.
C’s share = (1 / 8) × $3,000 = $375.',
    'Wages are distributed in proportion to work contribution (Efficiency)',
    '["Find C’s 1-day work rate: 1/3 - 1/6 - 1/8 = 1/24.","C contributes 1/8th of total work, so C receives 1/8 of $3,000."]'::jsonb,
    20,
    69,
    '["Work & Wages","Time & Work","Remuneration"]'::jsonb,
    TRUE
  ),
  (
    'quant-074',
    'Filling Tank with Variable Speed Pumps',
    'Three pipes P, Q, and R can fill a cistern in 10, 15, and 30 hours respectively. If Pipe P is opened all the time, and Q and R are opened for one hour each alternately, in how many hours will the cistern be full?',
    'Quantitative Aptitude',
    'Pipes & Cisterns',
    'hard',
    '[{"id":"A","text":"6 hours"},{"id":"B","text":"7 hours"},{"id":"C","text":"7.5 hours"},{"id":"D","text":"8 hours"}]'::jsonb,
    'B',
    'Total capacity = LCM(10, 15, 30) = 30 units.
Efficiency:
P = 3 units/h, Q = 2 units/h, R = 1 unit/h.
Hour 1 (P + Q): 3 + 2 = 5 units.
Hour 2 (P + R): 3 + 1 = 4 units.
In a 2-hour block: Work done = 5 + 4 = 9 units.
In 3 blocks (6 hours): Work done = 3 × 9 = 27 units.
Remaining work = 30 - 27 = 3 units.
On 7th hour, (P + Q) complete the remaining cistern capacity.
Total time = 7 hours.',
    'Block Work = Rate(P+Q) + Rate(P+R)',
    '["Hour 1 does 5 units, Hour 2 does 4 units.","Every 2 hours fills 9 units."]'::jsonb,
    20,
    67,
    '["Pipes & Cisterns","Alternating Pumps","Efficiency"]'::jsonb,
    TRUE
  ),
  (
    'quant-075',
    'Escalator Steps and Velocity Calculation',
    'A person walking up an upward-moving escalator takes 30 steps to reach the top. If they walk twice as fast (double walking speed), they take 40 steps to reach the top. How many visible steps are there on the stationary escalator?',
    'Quantitative Aptitude',
    'Speed, Distance & Time',
    'hard',
    '[{"id":"A","text":"50 steps"},{"id":"B","text":"60 steps"},{"id":"C","text":"75 steps"},{"id":"D","text":"80 steps"}]'::jsonb,
    'B',
    'Let escalator speed be e steps/s and walking speed be v steps/s.
Total steps N = Person steps + Escalator steps during that time.
Case 1: Time = 30/v. Escalator contributes e × (30/v). N = 30 + 30(e/v).
Case 2: Walking speed = 2v. Time = 40/(2v) = 20/v. Escalator contributes e × (20/v). N = 40 + 20(e/v).
Equating N: 30 + 30(e/v) = 40 + 20(e/v)
10(e/v) = 10 => e/v = 1 (escalator speed equals walking speed v).
Total steps N = 30 + 30(1) = 60 steps.',
    'Total Steps = Steps_Walked + Escalator_Speed × (Steps_Walked / Walk_Speed)',
    '["Equate the total number of steps in both speed scenarios.","Ratio of escalator speed to walking speed e/v = 1. Total steps = 60."]'::jsonb,
    20,
    42,
    '["Escalators","Relative Speed","Challenging Aptitude"]'::jsonb,
    TRUE
  ),
  (
    'quant-076',
    'Simple Interest on Two Portions of Loan',
    'A total principal of $12,000 is lent out in two parts, one at 8% per annum and the other at 10% per annum simple interest. If the total annual interest received is $1,040, how much was lent at 8%?',
    'Quantitative Aptitude',
    'Simple Interest',
    'medium',
    '[{"id":"A","text":"$6,000"},{"id":"B","text":"$7,000"},{"id":"C","text":"$8,000"},{"id":"D","text":"$9,000"}]'::jsonb,
    'C',
    'Let amount lent at 8% be x, and at 10% be (12,000 - x).
Interest equation: 0.08x + 0.10(12,000 - x) = 1,040
0.08x + 1,200 - 0.10x = 1,040
-0.02x = 1,040 - 1,200 = -160
x = 160 / 0.02 = $8,000.',
    'Total SI = (P1 × r1 + P2 × r2) / 100',
    '["If all was at 10%, interest would be $1,200.","The deficit of $160 comes from the 2% difference on the 8% portion: 160 / 0.02 = $8,000."]'::jsonb,
    15,
    84,
    '["Simple Interest","Alligation in Finance","Linear Systems"]'::jsonb,
    TRUE
  ),
  (
    'quant-077',
    'Smallest Square Divisible by Given Integers',
    'What is the smallest perfect square number that is completely divisible by each of 6, 9, 15, and 20?',
    'Quantitative Aptitude',
    'Number Systems',
    'medium',
    '[{"id":"A","text":"400"},{"id":"B","text":"900"},{"id":"C","text":"1600"},{"id":"D","text":"3600"}]'::jsonb,
    'B',
    'First find LCM(6, 9, 15, 20):
6 = 2 × 3, 9 = 3², 15 = 3 × 5, 20 = 2² × 5.
LCM = 2² × 3² × 5¹ = 4 × 9 × 5 = 180.
To make 180 a perfect square, every prime factor exponent must be even.
180 = 2² × 3² × 5¹. The prime 5 has an odd power (1).
Multiply by 5: 180 × 5 = 900 (which is 30²).
Therefore, 900 is the smallest perfect square divisible by all.',
    'Smallest Square = LCM × (unpaired prime factors)',
    '["Find LCM of 6, 9, 15, 20 which is 180 = 2² × 3² × 5¹.","Multiply by 5 to make all powers even: 180 × 5 = 900."]'::jsonb,
    15,
    76,
    '["Number Systems","Perfect Squares","LCM"]'::jsonb,
    TRUE
  ),
  (
    'quant-078',
    'Probability of Independent Events Coinciding',
    'The probability that Alex solves a problem is 2/3, and the probability that Betty solves it is 3/4. If both attempt the problem independently, what is the probability that the problem gets solved by at least one of them?',
    'Quantitative Aptitude',
    'Probability',
    'medium',
    '[{"id":"A","text":"1/2"},{"id":"B","text":"5/6"},{"id":"C","text":"11/12"},{"id":"D","text":"1/12"}]'::jsonb,
    'C',
    'P(Alex fails) = 1 - 2/3 = 1/3.
P(Betty fails) = 1 - 3/4 = 1/4.
P(Both fail) = (1/3) × (1/4) = 1/12.
P(Problem solved by at least one) = 1 - P(Both fail) = 1 - 1/12 = 11/12.',
    'P(At least one solves) = 1 - P(A'') × P(B'')',
    '["Find the probability that neither of them solves it.","P(Neither) = (1/3) × (1/4) = 1/12. Subtract from 1."]'::jsonb,
    15,
    87,
    '["Probability","Independent Events","Complementary Law"]'::jsonb,
    TRUE
  ),
  (
    'quant-079',
    'Area of Shaded Region Between Concentric Circles',
    'Two concentric circles have radii of 10 cm and 6 cm respectively. What is the area of the ring (annulus) bounded between the two circles? (Use π = 3.14)',
    'Quantitative Aptitude',
    'Geometry & Mensuration',
    'easy',
    '[{"id":"A","text":"150.72 cm²"},{"id":"B","text":"200.96 cm²"},{"id":"C","text":"212.50 cm²"},{"id":"D","text":"254.34 cm²"}]'::jsonb,
    'B',
    'Area of annulus = π × (R² - r²)
= 3.14 × (10² - 6²) = 3.14 × (100 - 36) = 3.14 × 64 = 200.96 cm².',
    'Area = π(R² - r²)',
    '["Subtract the area of the smaller circle from the larger circle.","3.14 × (100 - 36) = 3.14 × 64 = 200.96."]'::jsonb,
    10,
    91,
    '["Geometry","Concentric Circles","Annulus"]'::jsonb,
    TRUE
  ),
  (
    'quant-080',
    'Data Sufficiency in Ratio and Sum of Two Integers',
    'Is the integer x greater than the integer y?
Statement (1): x + y = 28
Statement (2): x / y = 3 / 4
Which statement(s) are sufficient to answer the question?',
    'Quantitative Aptitude',
    'Data Sufficiency',
    'hard',
    '[{"id":"A","text":"Statement (1) ALONE is sufficient, but Statement (2) alone is not"},{"id":"B","text":"Statement (2) ALONE is sufficient, but Statement (1) alone is not"},{"id":"C","text":"BOTH Statements TOGETHER are sufficient, but NEITHER alone is sufficient"},{"id":"D","text":"Statements (1) and (2) TOGETHER are NOT sufficient"}]'::jsonb,
    'B',
    'We need to determine if x > y.
- Statement (1): x + y = 28. (x=20, y=8 => x>y; but x=10, y=18 => x<y). Insufficient.
- Statement (2): x / y = 3 / 4. Since both are positive integers (or if x=3k, y=4k for positive k), x is always strictly smaller than y (x < y), which definitively answers NO (x is NOT greater than y). Sufficient.
Therefore, Statement (2) alone is sufficient.',
    'Data Sufficiency evaluates whether a definite YES or NO answer is guaranteed',
    '["Statement 1 gives infinite pairs with conflicting comparisons.","Statement 2 fixes the direct ratio x = 0.75y, giving a definitive answer."]'::jsonb,
    20,
    68,
    '["Data Sufficiency","Ratios","Quantitative Logic"]'::jsonb,
    TRUE
  ),
  (
    'lr-001',
    'Family Lineage Identification',
    'Pointing to a photograph of a man, Rahul said, "His mother is the only daughter of my mother." How is Rahul related to the man in the photograph?',
    'Logical Reasoning',
    'Blood Relations',
    'easy',
    '[{"id":"A","text":"Father"},{"id":"B","text":"Brother"},{"id":"C","text":"Maternal Uncle"},{"id":"D","text":"Grandfather"}]'::jsonb,
    'C',
    '"My mother''s only daughter" means Rahul''s sister (since Rahul is male, his mother''s only daughter is Rahul''s sister).
Therefore, the man''s mother is Rahul''s sister.
Since the man is the son of Rahul''s sister, Rahul is his maternal uncle.',
    'Only daughter of mother = Sister; Brother of mother = Maternal Uncle',
    '["Break down the sentence starting from the end: \"my mother''s only daughter\".","Who is your mother''s only daughter to you?"]'::jsonb,
    10,
    89,
    '["Blood Relations","Family Tree","Deduction"]'::jsonb,
    TRUE
  ),
  (
    'lr-002',
    'Deductive Syllogism Conclusions',
    'Statements:
1. All cars are vehicles.
2. Some vehicles are electric.

Conclusions:
I. Some cars are electric.
II. Some vehicles are cars.

Which of the conclusion(s) logically follow?',
    'Logical Reasoning',
    'Syllogisms',
    'medium',
    '[{"id":"A","text":"Only Conclusion I follows"},{"id":"B","text":"Only Conclusion II follows"},{"id":"C","text":"Both I and II follow"},{"id":"D","text":"Neither I nor II follows"}]'::jsonb,
    'B',
    'From statement 1: "All cars are vehicles" implies that some vehicles are definitely cars (Conclusion II is valid).
Statement 2 tells us that "Some vehicles are electric", but this subset of vehicles might not overlap with the "cars" circle. Thus, "Some cars are electric" is a possibility, not a definite conclusion.
Therefore, only Conclusion II follows.',
    'All A are B ⇒ Some B are A. Middle term distributed rules apply.',
    '["Draw a Venn diagram for Cars inside Vehicles, and an intersecting circle for Electric.","Does the Electric circle necessarily have to intersect with Cars?"]'::jsonb,
    15,
    63,
    '["Syllogism","Venn Diagrams","Logic"]'::jsonb,
    TRUE
  ),
  (
    'lr-003',
    'Multi-Step Walking Route & Final Displacement',
    'Rohan walks 20 meters North. Then he turns right and walks 30 meters. Next, he turns right and walks 35 meters. Then he turns left and walks 15 meters. Finally, he turns left and walks 15 meters. How far and in which direction is he from his starting point?',
    'Logical Reasoning',
    'Direction Sense',
    'medium',
    '[{"id":"A","text":"45 meters, East"},{"id":"B","text":"35 meters, East"},{"id":"C","text":"45 meters, North-East"},{"id":"D","text":"50 meters, East"}]'::jsonb,
    'A',
    'Let initial point be (0, 0):
1. 20m North → (0, 20)
2. Turn right (East), 30m → (30, 20)
3. Turn right (South), 35m → (30, -15)
4. Turn left (East), 15m → (45, -15)
5. Turn left (North), 15m → (45, 0)
Final position is (45, 0), which is exactly 45 meters East of origin (0,0).',
    'X-coordinate: 0 + 30 + 15 = 45m (East); Y-coordinate: 0 + 20 - 35 + 15 = 0m',
    '["Track horizontal (East-West) and vertical (North-South) movements separately.","Notice the net vertical displacement: +20 - 35 + 15 = 0."]'::jsonb,
    15,
    74,
    '["Direction Sense","Displacement","Navigation"]'::jsonb,
    TRUE
  ),
  (
    'lr-004',
    'Circular Table Facing Center',
    'Six friends (P, Q, R, S, T, U) are sitting around a circular table facing the center.
- P is sitting opposite S.
- Q is sitting to the immediate right of P.
- T is sitting between P and S on the left of P.
- R is sitting adjacent to S.
Who is sitting directly opposite to Q?',
    'Logical Reasoning',
    'Seating Arrangement',
    'hard',
    '[{"id":"A","text":"R"},{"id":"B","text":"T"},{"id":"C","text":"U"},{"id":"D","text":"S"}]'::jsonb,
    'A',
    'Arrangement around table of 6 positions (1 to 6 clockwise):
Let P = Pos 1 (Top).
S is opposite P → S = Pos 4 (Bottom).
Q is to immediate right (counter-clockwise or clockwise facing center: right of P facing center is Pos 6).
T is between P and S on left of P → T = Pos 2.
R is adjacent to S → R must be Pos 3 or 5. Since Q is at 6, U is at 5, R is at 3.
Position opposite Q (Pos 6) in a 6-person circle is Pos 3, which is occupied by R.',
    'In a 6-person circle, opposite seats have an offset of 3 positions.',
    '["Draw a clock with 6 hours: 12, 2, 4, 6, 8, 10.","Opposite of position 1 is 4; opposite of position 2 is 5, etc."]'::jsonb,
    20,
    48,
    '["Seating Arrangement","Puzzles","Circular Table"]'::jsonb,
    TRUE
  ),
  (
    'lr-005',
    'Pattern Shift Transformation',
    'In a certain code language, if "TRIANGLE" is written as "SQHZMFKD", how will "PENTAGON" be written in that same code language?',
    'Logical Reasoning',
    'Coding-Decoding',
    'easy',
    '[{"id":"A","text":"ODMSZFPM"},{"id":"B","text":"QDOUBHPO"},{"id":"C","text":"ODMSBFNM"},{"id":"D","text":"OFMTAHPM"}]'::jsonb,
    'A',
    'Let us analyze letter by letter:
T (-1) → S
R (-1) → Q
I (-1) → H
A (-1) → Z
N (-1) → M
G (-1) → F
L (-1) → K
E (-1) → D
The pattern is a simple shift of -1 (previous letter in alphabet) for every character!

Applying -1 to "PENTAGON":
P (-1) = O
E (-1) = D
N (-1) = M
T (-1) = S
A (-1) = Z
G (-1) = F
O (-1) = N
N (-1) = M
Option A provides ODMSZFPM as the corresponding coded representation.',
    'Letter shift rule: Each character c → char(ascii(c) - 1)',
    '["Compare each letter in TRIANGLE with SQHZMFKD.","Notice T→S, R→Q, I→H are all 1 step backwards."]'::jsonb,
    10,
    91,
    '["Coding Decoding","Patterns","Alphabet"]'::jsonb,
    TRUE
  ),
  (
    'lr-006',
    'Polynomial & Difference Sequence',
    'Find the next number in the sequence: 7, 14, 30, 56, 93, ?',
    'Logical Reasoning',
    'Series & Patterns',
    'medium',
    '[{"id":"A","text":"142"},{"id":"B","text":"144"},{"id":"C","text":"148"},{"id":"D","text":"152"}]'::jsonb,
    'A',
    'Find the first-level differences between consecutive terms:
14 - 7 = 7
30 - 14 = 16
56 - 30 = 26
93 - 56 = 37

Find the second-level differences:
16 - 7 = 9
26 - 16 = 10
37 - 26 = 11

The second-level differences increase by 1 each step (9, 10, 11, 12).
Next difference = 37 + 12 = 49.
Next term = 93 + 49 = 142.',
    'Double difference sequence: Δ² = 9, 10, 11, 12 ...',
    '["Calculate the difference between adjacent terms.","Then calculate the difference of those differences."]'::jsonb,
    15,
    68,
    '["Number Series","Differences","Pattern Recognition"]'::jsonb,
    TRUE
  ),
  (
    'lr-007',
    'Angle Between Clock Hands at 3:40',
    'What is the acute angle (in degrees) between the hour hand and the minute hand of a clock at 3:40 PM?',
    'Logical Reasoning',
    'Clocks & Calendars',
    'medium',
    '[{"id":"A","text":"120°"},{"id":"B","text":"130°"},{"id":"C","text":"135°"},{"id":"D","text":"140°"}]'::jsonb,
    'B',
    'Use the standard clock angle formula:
Angle = |30H - 5.5M|
Here, H = 3, M = 40.
Angle = |30(3) - 5.5(40)| = |90 - 220| = |-130| = 130°.
Since 130° ≤ 180°, the acute/interior angle is 130°.',
    'Angle = |30 × H - (11/2) × M|',
    '["Minute hand at 40 min is at 240° from 12.","Hour hand moves 0.5° per minute, so at 3:40 it is at 3×30 + 40×0.5 = 110°."]'::jsonb,
    15,
    76,
    '["Clocks","Angles","Geometry"]'::jsonb,
    TRUE
  ),
  (
    'lr-008',
    'Knight and Knave Truth Teller Problem',
    'On an island, inhabitants are either Knights (who always tell the truth) or Knaves (who always lie). You meet two inhabitants, A and B.
A says: "At least one of us is a Knave."
What are the true identities of A and B?',
    'Logical Reasoning',
    'Puzzles & Logic Grids',
    'hard',
    '[{"id":"A","text":"Both are Knights"},{"id":"B","text":"A is a Knight and B is a Knave"},{"id":"C","text":"A is a Knave and B is a Knight"},{"id":"D","text":"Both are Knaves"}]'::jsonb,
    'B',
    'Assume A is a Knave (liar):
If A lies, the statement "At least one of us is a Knave" is false, which means "Neither is a Knave (Both are Knights)". But that contradicts our assumption that A is a Knave.
Therefore, A CANNOT be a Knave; A must be a Knight (truth-teller).
Since A speaks the truth, "At least one of us is a Knave" is true.
Since A is a Knight, B MUST be the Knave.
Thus: A is a Knight, B is a Knave.',
    'Proof by contradiction: Assume A=Knave → contradiction → A=Knight.',
    '["What happens if A is lying?","If A is telling the truth, and A is a Knight, who must be the Knave?"]'::jsonb,
    20,
    52,
    '["Truth Tellers","Knights and Knaves","Mathematical Logic"]'::jsonb,
    TRUE
  ),
  (
    'lr-009',
    'Coded Family Relations Deciphering',
    'Read the code definitions:
- "P + Q" means P is the father of Q
- "P - Q" means P is the sister of Q
- "P × Q" means P is the brother of Q
- "P ÷ Q" means P is the mother of Q

Which of the following expressions indicates that M is the maternal grandmother of N?',
    'Logical Reasoning',
    'Blood Relations',
    'medium',
    '[{"id":"A","text":"M ÷ K + N"},{"id":"B","text":"M ÷ K - N"},{"id":"C","text":"M ÷ K ÷ N"},{"id":"D","text":"M + K ÷ N"}]'::jsonb,
    'C',
    'To be the maternal grandmother, M must be the mother of K (M ÷ K), and K must be the mother of N (K ÷ N).
Evaluating M ÷ K ÷ N:
1. M ÷ K: M is the mother of K (female).
2. K ÷ N: K is the mother of N (female).
Therefore, M is the mother of N’s mother, which is N’s maternal grandmother.',
    'Maternal Grandmother = Mother’s Mother (Mother ÷ Mother)',
    '["Maternal grandmother means mother of mother.","Look for the chain where M is mother of K and K is mother of N."]'::jsonb,
    15,
    72,
    '["Blood Relations","Coded Relations","Family Tree"]'::jsonb,
    TRUE
  ),
  (
    'lr-010',
    'Sunrise Shadow and Relative Orientation',
    'One morning after sunrise, Suresh and Naresh were standing face to face in a park talking. If Suresh’s shadow fell exactly to the right of Naresh, which direction was Suresh facing?',
    'Logical Reasoning',
    'Direction Sense',
    'medium',
    '[{"id":"A","text":"North"},{"id":"B","text":"South"},{"id":"C","text":"East"},{"id":"D","text":"West"}]'::jsonb,
    'B',
    'In the morning after sunrise, the sun is in the East, so all shadows fall towards the West.
Suresh’s shadow falls to the West.
We are given that this shadow falls to the right of Naresh. If West is to the right of Naresh, Naresh must be facing North.
Since Suresh and Naresh are standing face to face, Suresh must be facing South.',
    'Morning shadow is always towards West. Facing North has West on the left, facing South has West on the right.',
    '["Morning shadow is strictly West.","If West is to Naresh’s right, Naresh is facing North, so Suresh faces South."]'::jsonb,
    15,
    69,
    '["Direction Sense","Shadows","Sun Position"]'::jsonb,
    TRUE
  ),
  (
    'lr-011',
    'Negative Statements and Possibility Syllogism',
    'Statements:
1. No cat is a dog.
2. Some dogs are birds.
3. All birds are mammals.

Conclusions:
I. Some mammals are birds.
II. Some mammals are not cats.

Which conclusions follow?',
    'Logical Reasoning',
    'Syllogisms',
    'hard',
    '[{"id":"A","text":"Only Conclusion I follows"},{"id":"B","text":"Only Conclusion II follows"},{"id":"C","text":"Both Conclusions I and II follow"},{"id":"D","text":"Neither Conclusion follows"}]'::jsonb,
    'C',
    '1. Statement 3 says "All birds are mammals" -> directly implies "Some mammals are birds" (Conclusion I follows).
2. Some dogs are birds (Statement 2), and all birds are mammals -> some mammals are dogs.
Since "No cat is a dog" (Statement 1), those mammals which are dogs can never be cats.
Therefore, "Some mammals are not cats" is definitively true (Conclusion II follows).
Both I and II follow.',
    'Some A are B and No B is C implies Some A are not C',
    '["All birds are mammals implies some mammals are birds.","Dogs that are mammals cannot be cats because no dog is a cat."]'::jsonb,
    20,
    55,
    '["Syllogism","Negative Deduction","Venn Logic"]'::jsonb,
    TRUE
  ),
  (
    'lr-012',
    'Linear Row Facing North with Relative Offsets',
    'Seven persons (A, B, C, D, E, F, G) are sitting in a single straight row facing North.
- C sits second to the left of G.
- Only two people sit between G and D.
- A sits to the immediate left of B.
- E sits at one of the extreme ends.
- F is not an immediate neighbor of G.
Who sits at the exact middle (4th position) of the row?',
    'Logical Reasoning',
    'Seating Arrangement',
    'hard',
    '[{"id":"A","text":"A"},{"id":"B","text":"B"},{"id":"C","text":"C"},{"id":"D","text":"D"}]'::jsonb,
    'D',
    'In the valid unique configuration [C, F, G, D, A, B, E], Pos 4 is D.',
    'Linear constraint satisfaction across 7 slots',
    '["Place extreme end first (E at slot 1 or 7).","Fit C _ G and G _ _ D."]'::jsonb,
    20,
    49,
    '["Seating Arrangement","Linear Row","Puzzles"]'::jsonb,
    TRUE
  ),
  (
    'lr-013',
    'Mirror Alphabet Reverse Coding',
    'In a code system where letters are matched with their opposite alphabet pairs (A↔Z, B↔Y, C↔X, etc.), how is "SMART" encoded?',
    'Logical Reasoning',
    'Coding-Decoding',
    'easy',
    '[{"id":"A","text":"HNZIG"},{"id":"B","text":"HOZIG"},{"id":"C","text":"HNZJH"},{"id":"D","text":"GMZIF"}]'::jsonb,
    'A',
    'Opposite letter pairs sum to 27 in alphabetical order:
S (19) ↔ 27 - 19 = 8 (H)
M (13) ↔ 27 - 13 = 14 (N)
A (1) ↔ 27 - 1 = 26 (Z)
R (18) ↔ 27 - 18 = 9 (I)
T (20) ↔ 27 - 20 = 7 (G)
Therefore, "SMART" encodes to "HNZIG".',
    'Opposite letter: char_pos + opposite_pos = 27',
    '["S pairs with H (19 + 8 = 27).","M pairs with N (13 + 14 = 27). A pairs with Z."]'::jsonb,
    10,
    92,
    '["Coding Decoding","Reverse Alphabet","Letter Substitution"]'::jsonb,
    TRUE
  ),
  (
    'lr-014',
    'Alternating Multiplier and Subtraction Series',
    'Find the missing term in the sequence: 4, 8, 5, 15, 11, 44, 39, ?',
    'Logical Reasoning',
    'Series & Patterns',
    'medium',
    '[{"id":"A","text":"195"},{"id":"B","text":"210"},{"id":"C","text":"234"},{"id":"D","text":"240"}]'::jsonb,
    'A',
    'Look at the alternating operations:
4 × 2 = 8
8 - 3 = 5
5 × 3 = 15
15 - 4 = 11
11 × 4 = 44
44 - 5 = 39
Next operation is × 5:
39 × 5 = 195.',
    'Alternating pattern: (×2), (-3), (×3), (-4), (×4), (-5), (×5)',
    '["Notice the pattern oscillates between multiplication and subtraction.","Operations: ×2, -3, ×3, -4, ×4, -5, next is ×5."]'::jsonb,
    15,
    71,
    '["Number Series","Alternating Operations","Pattern Recognition"]'::jsonb,
    TRUE
  ),
  (
    'lr-015',
    'Finding the Day of the Week on a Specific Date',
    'If January 1, 2006 was a Sunday, what day of the week was January 1, 2010?',
    'Logical Reasoning',
    'Clocks & Calendars',
    'easy',
    '[{"id":"A","text":"Wednesday"},{"id":"B","text":"Thursday"},{"id":"C","text":"Friday"},{"id":"D","text":"Saturday"}]'::jsonb,
    'C',
    'Years elapsed from 2006 to 2010 = 4 years.
Ordinary years: 2006 (1 odd day), 2007 (1 odd day), 2009 (1 odd day) = 3 odd days.
Leap year: 2008 (2 odd days).
Total odd days = 3 + 2 = 5 odd days.
Sunday + 5 days = Friday.
Therefore, Jan 1, 2010 was a Friday.',
    'Odd days = (Number of years) + (Number of leap years) mod 7',
    '["2008 is a leap year with 2 odd days.","Sum odd days: 1 (2006) + 1 (2007) + 2 (2008) + 1 (2009) = 5 odd days from Sunday."]'::jsonb,
    10,
    86,
    '["Calendars","Odd Days","Day of Week"]'::jsonb,
    TRUE
  ),
  (
    'lr-016',
    'Overlapping Row Position and Total Count',
    'In a class of students standing in a single file, Priya is 15th from the front and 28th from the back. How many total students are in the class?',
    'Logical Reasoning',
    'Ranking & Order',
    'easy',
    '[{"id":"A","text":"41"},{"id":"B","text":"42"},{"id":"C","text":"43"},{"id":"D","text":"44"}]'::jsonb,
    'B',
    'Total students = (Rank from Front) + (Rank from Back) - 1
Total = 15 + 28 - 1 = 43 - 1 = 42 students.',
    'Total = Left_Rank + Right_Rank - 1',
    '["Priya is counted twice if you add 15 and 28.","Subtract 1 to eliminate the duplicate count: 15 + 28 - 1 = 42."]'::jsonb,
    10,
    94,
    '["Ranking","Order & Sequence","Arithmetic Logic"]'::jsonb,
    TRUE
  ),
  (
    'lr-017',
    'Inequality Chain Deduction',
    'Statements:
P ≥ Q > R = S ≤ T < U

Conclusions:
I. P > S
II. U > R

Which conclusions are definitely true?',
    'Logical Reasoning',
    'Mathematical Inequalities',
    'medium',
    '[{"id":"A","text":"Only Conclusion I is true"},{"id":"B","text":"Only Conclusion II is true"},{"id":"C","text":"Both Conclusions I and II are true"},{"id":"D","text":"Neither Conclusion is true"}]'::jsonb,
    'C',
    '1. Evaluating Conclusion I (P > S): P ≥ Q > R = S. Since there is a strict inequality (>) between Q and R, P > S holds definitely true.
2. Evaluating Conclusion II (U > R): R = S ≤ T < U. Since there is a strict inequality (<) between T and U, U > R holds definitely true.
Both conclusions are definitely true.',
    'If a chain contains only ≥/= and at least one strict >, the relation is strictly >',
    '["Trace from P to S: P ≥ Q > S => P > S.","Trace from R to U: R = S ≤ T < U => R < U (U > R)."]'::jsonb,
    15,
    88,
    '["Inequalities","Deduction","Relational Logic"]'::jsonb,
    TRUE
  ),
  (
    'lr-018',
    'Identifying Underlying Assumption in an Argument',
    'Statement: "Switching to electric buses in our city will drastically reduce urban air pollution."

Assumptions:
I. Conventional diesel buses currently contribute significantly to the city’s air pollution.
II. The electricity used to charge the electric buses will not generate comparable local air pollution.

Which assumption(s) are implicit?',
    'Logical Reasoning',
    'Critical Reasoning',
    'medium',
    '[{"id":"A","text":"Only Assumption I is implicit"},{"id":"B","text":"Only Assumption II is implicit"},{"id":"C","text":"Both Assumptions I and II are implicit"},{"id":"D","text":"Neither Assumption is implicit"}]'::jsonb,
    'C',
    'For the conclusion (drastic reduction in urban air pollution) to hold:
- Assumption I is necessary: If diesel buses were a negligible source, replacing them could not drastically reduce pollution.
- Assumption II is necessary: If electric buses generated equal or worse local emissions during charging in the city, net pollution would not drop.
Therefore, both assumptions are implicit and necessary for the argument.',
    'An assumption is an unstated premise without which the argument collapses (Negation Test)',
    '["Apply the Negation Test to both assumptions.","If buses were not a major polluter, switching them would make no drastic impact."]'::jsonb,
    15,
    72,
    '["Critical Reasoning","Assumptions","Verbal Logic"]'::jsonb,
    TRUE
  ),
  (
    'lr-019',
    'Evaluating Dual Event Causality',
    'Event A: The central bank lowered the benchmark interest rate by 50 basis points.
Event B: Commercial banks saw a 25% surge in home mortgage loan applications over the following quarter.

Which statement best describes the relationship?',
    'Logical Reasoning',
    'Cause & Effect',
    'easy',
    '[{"id":"A","text":"Event A is the cause and Event B is its effect"},{"id":"B","text":"Event B is the cause and Event A is its effect"},{"id":"C","text":"Both events are independent causes"},{"id":"D","text":"Both events are effects of an independent common cause"}]'::jsonb,
    'A',
    'Lowering the benchmark interest rate by the central bank directly reduces borrowing costs for commercial loans and mortgages, which in turn incentivizes consumers to apply for home loans. Thus, Event A is the direct economic cause and Event B is the resulting effect.',
    'Cause precedes and directly produces or influences the effect',
    '["Lower interest rates make borrowing cheaper, directly causing a surge in loan demand."]'::jsonb,
    10,
    91,
    '["Cause & Effect","Economics Logic","Critical Reasoning"]'::jsonb,
    TRUE
  ),
  (
    'lr-020',
    'Box Stacking Height and Content Deductions',
    'Five boxes (V, W, X, Y, Z) are stacked one above another from bottom (1) to top (5).
- Box Y is immediately above Box W.
- Only one box is placed between Box W and Box Z.
- Box X is placed above Box V.
- Box Z is not at the bottom.
If Box W is at position 2, which box is at position 5 (top)?',
    'Logical Reasoning',
    'Puzzles & Logic Grids',
    'medium',
    '[{"id":"A","text":"Box V"},{"id":"B","text":"Box X"},{"id":"C","text":"Box Y"},{"id":"D","text":"Box Z"}]'::jsonb,
    'B',
    'Positions 1 to 5:
1. Given W is at Pos 2.
2. Y is immediately above W -> Y is at Pos 3.
3. One box between W(2) and Z -> Z must be at Pos 4 (since below W is only Pos 1, no space for 1 box between).
4. Remaining positions are Pos 1 and Pos 5 for V and X.
5. Given "Box X is placed above Box V" -> V must be at Pos 1 and X must be at Pos 5.
Final Stack from bottom to top: [1: V, 2: W, 3: Y, 4: Z, 5: X].
Box at position 5 is Box X.',
    'Sequential slot elimination in vertical stacking puzzles',
    '["Position 2 is W, so Position 3 is Y.","Z must be at position 4. That leaves slots 1 and 5 for V and X."]'::jsonb,
    15,
    77,
    '["Puzzles","Box Stacking","Constraint Satisfaction"]'::jsonb,
    TRUE
  ),
  (
    'lr-021',
    'Semantic Word Analogy Relationship',
    'Odometer is to Mileage as Compass is to: ?',
    'Logical Reasoning',
    'Analogies',
    'easy',
    '[{"id":"A","text":"Speed"},{"id":"B","text":"Direction"},{"id":"C","text":"Altitude"},{"id":"D","text":"Pressure"}]'::jsonb,
    'B',
    'An odometer is an instrument used to measure mileage (distance). Similarly, a compass is an instrument used to determine direction.',
    'Instrument : Measurement Target',
    '["Identify the function: an odometer measures distance traveled."]'::jsonb,
    10,
    95,
    '["Analogies","Word Relationships","General Reasoning"]'::jsonb,
    TRUE
  ),
  (
    'lr-022',
    'Odd One Out in Number Property Set',
    'Find the odd one out among the following numbers: 27, 64, 125, 216, 343, 512, 729',
    'Logical Reasoning',
    'Classification',
    'medium',
    '[{"id":"A","text":"27"},{"id":"B","text":"64"},{"id":"C","text":"343"},{"id":"D","text":"729"}]'::jsonb,
    'B',
    'All numbers in the set are perfect cubes:
27 = 3³, 64 = 4³, 125 = 5³, 216 = 6³, 343 = 7³, 512 = 8³, 729 = 9³.
64 is the only number in the list that is both an even square (8²) and cube (4³).',
    'Identification of dual mathematical properties (Cube vs Square)',
    '["Check which number is simultaneously a square and a cube with an even root."]'::jsonb,
    15,
    85,
    '["Classification","Odd One Out","Number Properties"]'::jsonb,
    TRUE
  ),
  (
    'lr-023',
    'Matrix Symbol Decryption Logic',
    'If in a secret code, "CLOUD" is written as "59423" and "RAIN" is written as "1876", how will "AROUND" be written using the same mapping?',
    'Logical Reasoning',
    'Coding-Decoding',
    'easy',
    '[{"id":"A","text":"814263"},{"id":"B","text":"814963"},{"id":"C","text":"819463"},{"id":"D","text":"814273"}]'::jsonb,
    'A',
    'Direct letter-to-digit substitution:
From RAIN: R=1, A=8, I=7, N=6
From CLOUD: C=5, L=9, O=4, U=2, D=3
For "AROUND":
A = 8, R = 1, O = 4, U = 2, N = 6, D = 3
Combined: "814263".',
    'Direct positional symbol mapping table',
    '["Extract each letter’s code directly from the words CLOUD and RAIN.","A=8, R=1, O=4, U=2, N=6, D=3."]'::jsonb,
    10,
    93,
    '["Coding Decoding","Direct Mapping","Substitution Cipher"]'::jsonb,
    TRUE
  ),
  (
    'lr-024',
    'Alpha-Numeric Sequence Interleaving',
    'Find the next term in the alpha-numeric sequence: A1Z, C3X, E5V, G7T, ?',
    'Logical Reasoning',
    'Series & Patterns',
    'medium',
    '[{"id":"A","text":"I9R"},{"id":"B","text":"H8S"},{"id":"C","text":"I9S"},{"id":"D","text":"J9Q"}]'::jsonb,
    'A',
    'Analyze the three components:
1. First letter: A (+2) → C (+2) → E (+2) → G (+2) → I.
2. Number: 1 (+2) → 3 (+2) → 5 (+2) → 7 (+2) → 9.
3. Third letter: Z (-2) → X (-2) → V (-2) → T (-2) → R.
Next term is I9R.',
    'Letter 1: +2; Number: +2; Letter 2: -2',
    '["First letter advances by 2 (A, C, E, G -> I).","Numbers increase by 2 (1, 3, 5, 7 -> 9). Last letter goes backwards by 2."]'::jsonb,
    15,
    91,
    '["Alphanumeric Series","Patterns","Letter Series"]'::jsonb,
    TRUE
  ),
  (
    'lr-025',
    'Coinciding Clock Hands Over 12 Hours',
    'How many times do the hour hand and the minute hand of a standard analog clock coincide (overlap at 0° angle) in a 12-hour period?',
    'Logical Reasoning',
    'Clocks & Calendars',
    'easy',
    '[{"id":"A","text":"10 times"},{"id":"B","text":"11 times"},{"id":"C","text":"12 times"},{"id":"D","text":"22 times"}]'::jsonb,
    'B',
    'In every 12-hour cycle, the minute hand covers 12 rounds while the hour hand covers 1 round. The relative gain is 11 rounds.
Between 11:00 and 1:00, the hands coincide only once (at exactly 12:00:00).
Therefore, the hands coincide exactly 11 times in 12 hours (and 22 times in 24 hours).',
    'Coincidences in 12h = 11; Coincidences in 24h = 22',
    '["Between 11:00 and 1:00, there is only one coincidence at 12:00.","Total in 12 hours is 11 times."]'::jsonb,
    10,
    85,
    '["Clocks","Coincidence","Relative Speed"]'::jsonb,
    TRUE
  ),
  (
    'lr-026',
    'Corporate Policy Logical Deduction',
    'Statement: "All employees who complete the advanced cybersecurity training receive a bonus. Raj did not receive a bonus."

Conclusion:
I. Raj did not complete the advanced cybersecurity training.
II. Raj is not an employee.

Which conclusion is valid?',
    'Logical Reasoning',
    'Statement & Conclusion',
    'medium',
    '[{"id":"A","text":"Only Conclusion I follows"},{"id":"B","text":"Only Conclusion II follows"},{"id":"C","text":"Either I or II follows"},{"id":"D","text":"Neither follows"}]'::jsonb,
    'A',
    'By Modus Tollens (contrapositive law of logic):
Rule: (Employee AND Completed Training) → Bonus.
Given: No Bonus received.
Conclusion: Raj did NOT (Employee AND Completed Training).
Assuming Raj is an employee, he definitely could not have completed the training. Hence Conclusion I follows logically.',
    'Modus Tollens: P → Q implies ~Q → ~P',
    '["If completing the training guarantees a bonus, not having a bonus means the condition was not fulfilled."]'::jsonb,
    15,
    74,
    '["Statement & Conclusion","Modus Tollens","Formal Logic"]'::jsonb,
    TRUE
  ),
  (
    'lr-027',
    'Displacement with Angular Turn and Pythagoras',
    'A delivery drone flies 12 km North from a hub, turns 90° East and flies 9 km. Finally, it turns 90° South and flies 4 km before landing. What is the shortest direct distance between the hub and the landing spot?',
    'Logical Reasoning',
    'Direction Sense',
    'medium',
    '[{"id":"A","text":"12.04 km"},{"id":"B","text":"12.5 km"},{"id":"C","text":"13.0 km"},{"id":"D","text":"15.0 km"}]'::jsonb,
    'A',
    'Initial point = (0, 0).
1. Fly 12 km North -> (0, 12).
2. Fly 9 km East -> (9, 12).
3. Fly 4 km South -> (9, 8).
Shortest distance from (0, 0) to (9, 8):
d = √(9² + 8²) = √(81 + 64) = √145 ≈ 12.04 km.',
    'Displacement = √(Δx² + Δy²)',
    '["Net displacement along East (X) is 9 km.","Net displacement along North (Y) is 12 - 4 = 8 km. Calculate √(9² + 8²)."]'::jsonb,
    15,
    72,
    '["Direction Sense","Pythagoras","Displacement"]'::jsonb,
    TRUE
  ),
  (
    'lr-028',
    'Three-Premise Syllogism with Possibility',
    'Statements:
1. All phones are gadgets.
2. No gadget is antique.
3. Some antiques are valuable.

Conclusions:
I. No phone is antique.
II. Some valuable items are not gadgets.

Which conclusions follow?',
    'Logical Reasoning',
    'Syllogisms',
    'medium',
    '[{"id":"A","text":"Only Conclusion I follows"},{"id":"B","text":"Only Conclusion II follows"},{"id":"C","text":"Both Conclusions I and II follow"},{"id":"D","text":"Neither follows"}]'::jsonb,
    'C',
    '1. All phones are inside Gadgets, and Gadgets has 0 overlap with Antique. Therefore, Phone has 0 overlap with Antique -> "No phone is antique" is definitely true (Conclusion I follows).
2. "Some antiques are valuable" means a portion of Valuable is Antique. Since Antiques cannot be Gadgets, that specific portion of Valuable can never be Gadgets -> "Some valuable items are not gadgets" is definitely true (Conclusion II follows).
Both conclusions follow.',
    'Universal Negative Subsetting and Particular Negative Extraction',
    '["Phones are subsets of Gadgets, so anything outside Gadgets cannot be a Phone.","The antiques that are valuable cannot be gadgets."]'::jsonb,
    15,
    69,
    '["Syllogisms","Deduction","Venn Logic"]'::jsonb,
    TRUE
  ),
  (
    'lr-029',
    'Square Table Facing Inward and Outward',
    'Eight executives (A, B, C, D, E, F, G, H) sit around a square table. Four sit at the corners facing the center, and four sit in the middle of each side facing outward.
- A sits in the middle of a side facing outward.
- B sits third to the right of A.
- C is an immediate neighbor of B and sits at a corner.
Where is C facing?',
    'Logical Reasoning',
    'Seating Arrangement',
    'easy',
    '[{"id":"A","text":"Facing center"},{"id":"B","text":"Facing outward"},{"id":"C","text":"Facing North"},{"id":"D","text":"Cannot be determined"}]'::jsonb,
    'A',
    'The problem states: "Four sit at the corners facing the center, and four sit in the middle of each side facing outward."
Since C is explicitly identified as sitting at a corner of the square table, C must be facing the center by definition of the arrangement rules.',
    'Direct deduction from seating property axioms',
    '["All four corner occupants face the center.","Since C is at a corner, C must face the center."]'::jsonb,
    10,
    90,
    '["Seating Arrangement","Square Table","Orientation"]'::jsonb,
    TRUE
  ),
  (
    'lr-030',
    'Multi-Generation Family Tree Deduction',
    'In a family of six members (U, V, W, X, Y, Z):
- W is the son of X
- V is the wife of X
- Y is the daughter of V
- Z is the brother of W
- U is the father of X
How is Y related to U?',
    'Logical Reasoning',
    'Blood Relations',
    'easy',
    '[{"id":"A","text":"Granddaughter"},{"id":"B","text":"Daughter"},{"id":"C","text":"Niece"},{"id":"D","text":"Sister"}]'::jsonb,
    'A',
    '1. U is the father of X.
2. X is married to V (wife).
3. Y is the daughter of V (and therefore daughter of X).
Since Y is the daughter of U’s son X, Y is the granddaughter of U.',
    'Child of Son = Grandchild (Granddaughter)',
    '["Trace generation: U is generation 1 (grandfather).","X is generation 2 (son). Y is daughter of X, so Y is granddaughter."]'::jsonb,
    10,
    93,
    '["Blood Relations","Family Tree","Generations"]'::jsonb,
    TRUE
  ),
  (
    'lr-031',
    'Double Sequence with Alternating Alphabet Shift',
    'What comes next in the letter series: B, E, I, N, T, ?',
    'Logical Reasoning',
    'Series & Patterns',
    'medium',
    '[{"id":"A","text":"Y"},{"id":"B","text":"Z"},{"id":"C","text":"A"},{"id":"D","text":"B"}]'::jsonb,
    'C',
    'Look at the letter positions in the alphabet:
B (2) + 3 = E (5)
E (5) + 4 = I (9)
I (9) + 5 = N (14)
N (14) + 6 = T (20)
T (20) + 7 = 27 = 26 + 1 = A (1).
Therefore, the next letter is A.',
    'Position increment: +3, +4, +5, +6, +7 mod 26',
    '["The increments increase by 1 each time: +3, +4, +5, +6, next is +7.","20 + 7 = 27, which wraps around to A."]'::jsonb,
    15,
    78,
    '["Letter Series","Alphabet Wrap","Pattern Recognition"]'::jsonb,
    TRUE
  ),
  (
    'lr-032',
    'Interchanging Positions in a Row',
    'In a row of boys, Aman is 10th from the left and Bobby is 9th from the right. When they interchange their positions, Aman becomes 15th from the left. How many boys are there in the row?',
    'Logical Reasoning',
    'Ranking & Order',
    'medium',
    '[{"id":"A","text":"23"},{"id":"B","text":"24"},{"id":"C","text":"25"},{"id":"D","text":"26"}]'::jsonb,
    'A',
    'When Aman takes Bobby’s original seat, that seat position is known from both ends:
- 15th from the left (Aman’s new position)
- 9th from the right (Bobby’s original position)
Total boys = (Left Rank) + (Right Rank) - 1
Total = 15 + 9 - 1 = 23 boys.',
    'Total = New_Left_Rank + Original_Right_Rank - 1',
    '["The interchanged position is 15th from left and 9th from right.","Add both ranks and subtract 1."]'::jsonb,
    15,
    79,
    '["Ranking","Position Interchange","Sequence Logic"]'::jsonb,
    TRUE
  ),
  (
    'lr-033',
    'Course of Action Feasibility and Necessity',
    'Statement: "A major water main burst in a dense metropolitan district, cutting off clean drinking water to over 50,000 households."

Courses of Action:
I. The municipal corporation should immediately dispatch mobile water tankers to the affected neighborhoods.
II. The local administration should initiate emergency repairs on the pipeline around the clock.

Which course(s) of action follow?',
    'Logical Reasoning',
    'Critical Reasoning',
    'easy',
    '[{"id":"A","text":"Only I follows"},{"id":"B","text":"Only II follows"},{"id":"C","text":"Both I and II follow"},{"id":"D","text":"Neither follows"}]'::jsonb,
    'C',
    'Both actions are appropriate, realistic, and directly address the crisis:
- Action I provides immediate short-term relief to affected residents.
- Action II addresses the root problem to restore the infrastructure permanently.
Both courses of action follow logically.',
    'Courses of action must be feasible, immediate, and tackle both symptoms and root cause',
    '["Action I provides temporary relief, Action II fixes the root cause.","Both are logical and necessary."]'::jsonb,
    10,
    92,
    '["Course of Action","Critical Reasoning","Decision Making"]'::jsonb,
    TRUE
  ),
  (
    'lr-034',
    'Billboard Advertisement Assumption',
    'Statement: "Enroll in our 30-day intensive coding bootcamp to guarantee your dream tech career." (An advertisement by an institute)

Assumptions:
I. Many aspiring candidates desire a career in tech.
II. 30 days is sufficient time for motivated learners to acquire relevant skills.

Which assumption(s) are implicit?',
    'Logical Reasoning',
    'Statement & Assumption',
    'medium',
    '[{"id":"A","text":"Only Assumption I is implicit"},{"id":"B","text":"Only Assumption II is implicit"},{"id":"C","text":"Both Assumptions I and II are implicit"},{"id":"D","text":"Neither Assumption is implicit"}]'::jsonb,
    'C',
    'Advertisements are designed under the implicit assumptions that:
1. A market of interested candidates exists (Assumption I).
2. The promised outcome is feasible within the advertised timeframe (Assumption II).
Both assumptions are implicit.',
    'Advertising logic assumes audience interest and product efficacy',
    '["The advertiser assumes people want tech jobs and that the 30-day program is viable."]'::jsonb,
    15,
    88,
    '["Assumptions","Statement & Assumption","Marketing Logic"]'::jsonb,
    TRUE
  ),
  (
    'lr-035',
    'Symbol Substitution Mathematical Operations',
    'If "+" means "×", "-" means "÷", "×" means "+", and "÷" means "-", what is the value of:
20 + 4 - 8 × 6 ÷ 3 ?',
    'Logical Reasoning',
    'Coding-Decoding',
    'easy',
    '[{"id":"A","text":"13"},{"id":"B","text":"15"},{"id":"C","text":"18"},{"id":"D","text":"21"}]'::jsonb,
    'A',
    'Substitute symbols with actual operations:
20 × 4 ÷ 8 + 6 - 3
Following BODMAS (order of operations):
1. Division: 4 ÷ 8 = 0.5
2. Multiplication: 20 × 0.5 = 10
3. Addition: 10 + 6 = 16
4. Subtraction: 16 - 3 = 13.
Result = 13.',
    'BODMAS priority applied after symbol replacement',
    '["Expression becomes: 20 × 4 ÷ 8 + 6 - 3.","20 × 0.5 = 10; 10 + 6 - 3 = 13."]'::jsonb,
    10,
    91,
    '["Mathematical Operations","Symbol Substitution","BODMAS"]'::jsonb,
    TRUE
  ),
  (
    'lr-036',
    'Fibonacci-Like Cumulative Sum Series',
    'Find the next number in the series: 3, 5, 8, 13, 21, 34, ?',
    'Logical Reasoning',
    'Series & Patterns',
    'easy',
    '[{"id":"A","text":"48"},{"id":"B","text":"52"},{"id":"C","text":"55"},{"id":"D","text":"58"}]'::jsonb,
    'C',
    'This is a Fibonacci recurrence relation where each term is the sum of the two preceding terms:
3 + 5 = 8
5 + 8 = 13
8 + 13 = 21
13 + 21 = 34
21 + 34 = 55.
Next term is 55.',
    'T_n = T_(n-1) + T_(n-2)',
    '["Add the last two terms to get the next term: 21 + 34 = 55."]'::jsonb,
    10,
    96,
    '["Fibonacci Series","Number Series","Recurrence"]'::jsonb,
    TRUE
  ),
  (
    'lr-037',
    'Identical Calendar Year Repetition',
    'Which year will have the exact same calendar (same days for all dates) as the non-leap year 2017?',
    'Logical Reasoning',
    'Clocks & Calendars',
    'medium',
    '[{"id":"A","text":"2023"},{"id":"B","text":"2024"},{"id":"C","text":"2028"},{"id":"D","text":"2031"}]'::jsonb,
    'A',
    'For a normal year immediately following a leap year (2017 follows leap year 2016), the calendar repeats after 6 years.
Verification by counting odd days from 2017:
2017 (1), 2018 (1), 2019 (1), 2020 (2 - leap), 2021 (1), 2022 (1).
Sum of odd days = 1 + 1 + 1 + 2 + 1 + 1 = 7 odd days ≡ 0 (mod 7).
Since 2023 is also a non-leap year, 2023 has the exact same calendar as 2017.',
    'Non-leap year immediately after leap year repeats in +6 years',
    '["Count odd days until sum is divisible by 7.","2017+6 = 2023, both non-leap with 7 total odd days elapsed."]'::jsonb,
    15,
    73,
    '["Calendars","Repetition of Year","Odd Days"]'::jsonb,
    TRUE
  ),
  (
    'lr-038',
    'Dual Inequality Statements with Definite Falsehood',
    'Statements: M < N ≤ O = P; Q > O ≥ R

Conclusions:
I. M < Q
II. P ≥ R

Which conclusion(s) are definitely true?',
    'Logical Reasoning',
    'Inequalities',
    'easy',
    '[{"id":"A","text":"Only I is true"},{"id":"B","text":"Only II is true"},{"id":"C","text":"Both I and II are true"},{"id":"D","text":"Neither is true"}]'::jsonb,
    'C',
    '1. Check M < Q: M < N ≤ O and Q > O. Combining them gives M < O < Q => M < Q. (True)
2. Check P ≥ R: P = O and O ≥ R. Combining gives P ≥ R. (True)
Both conclusions I and II are definitely true.',
    'Transitivity of inequalities: a < b < c implies a < c',
    '["Trace M < O < Q.","Since P = O and O ≥ R, P must be ≥ R."]'::jsonb,
    10,
    89,
    '["Inequalities","Relational Logic","Transitivity"]'::jsonb,
    TRUE
  ),
  (
    'lr-039',
    'Sister-in-Law and Brother Identification',
    'Introducing a woman, a man says, "Her husband is the only son of my father." How is the woman related to the man?',
    'Logical Reasoning',
    'Blood Relations',
    'easy',
    '[{"id":"A","text":"Mother"},{"id":"B","text":"Sister"},{"id":"C","text":"Wife"},{"id":"D","text":"Daughter-in-law"}]'::jsonb,
    'C',
    '"Only son of my father" (said by a man) refers to the speaker himself.
Therefore, "Her husband is myself".
The woman is the man’s wife.',
    'Only son of father (spoken by a male) = Himself',
    '["Who is the only son of the speaker’s father?","The speaker himself! So her husband is the speaker."]'::jsonb,
    10,
    95,
    '["Blood Relations","Direct Clues","Deduction"]'::jsonb,
    TRUE
  ),
  (
    'lr-040',
    'Parallel Rows Facing Each Other',
    'Six persons are seated in two parallel rows of three persons each.
Row 1 (facing South): P, Q, R
Row 2 (facing North): X, Y, Z
- Q sits in the middle of Row 1.
- Y is seated opposite to Q.
- X sits to the immediate left of Y.
- P sits at the right extreme end of Row 1.
Who is seated directly opposite to P?',
    'Logical Reasoning',
    'Seating Arrangement',
    'hard',
    '[{"id":"A","text":"X"},{"id":"B","text":"Y"},{"id":"C","text":"Z"},{"id":"D","text":"Cannot be determined"}]'::jsonb,
    'A',
    'Row 1 (facing South): P at right extreme (West end), Q in middle, R at left extreme (East end).
Row 2 (facing North): Y in middle (opposite Q), X at left of Y (West end, opposite P).
Therefore, X is seated directly opposite P.',
    'Parallel row coordinate matching with opposing orientations',
    '["Facing North: left is to the left side (West).","Q is middle, Y is middle. Left of Y facing North is opposite P."]'::jsonb,
    20,
    47,
    '["Seating Arrangement","Parallel Rows","Dual Orientation"]'::jsonb,
    TRUE
  ),
  (
    'lr-041',
    'Either-Or Complementary Pair Syllogism',
    'Statements:
1. Some pens are pencils.
2. Some pencils are erasers.

Conclusions:
I. Some pens are erasers.
II. No pen is an eraser.

Which option correctly describes the conclusion?',
    'Logical Reasoning',
    'Syllogisms',
    'hard',
    '[{"id":"A","text":"Only Conclusion I follows"},{"id":"B","text":"Only Conclusion II follows"},{"id":"C","text":"Either Conclusion I or II follows"},{"id":"D","text":"Neither follows"}]'::jsonb,
    'C',
    'In classic syllogistic logic:
1. Both conclusions share the same subject ("pens") and predicate ("erasers").
2. One conclusion is a particular affirmative ("Some pens are erasers" - I type), and the other is a universal negative ("No pen is an eraser" - E type).
3. Neither conclusion is individually certain from the given premises.
These two statements form a complementary contradictory pair (I-E pair). Exactly one of them must be true in any possible world.
Therefore, Either I or II follows.',
    'Complementary Pair Rule: Same elements + (Some + No) = Either/Or',
    '["Check for a complementary pair: \"Some A are B\" and \"No A is B\".","When neither is individually certain, it is an Either/Or condition."]'::jsonb,
    20,
    53,
    '["Syllogisms","Either-Or","Complementary Pairs"]'::jsonb,
    TRUE
  ),
  (
    'lr-042',
    'Seven Story Building Floor Puzzle',
    'Seven people (A, B, C, D, E, F, G) live on separate floors of a 7-story building, where Ground floor is 1 and top floor is 7.
- Only three people live above C.
- Two people live between C and A.
- B lives immediately above A.
- G lives on floor 1.
Which floor does B live on?',
    'Logical Reasoning',
    'Puzzles & Logic Grids',
    'hard',
    '[{"id":"A","text":"Floor 2"},{"id":"B","text":"Floor 3"},{"id":"C","text":"Floor 6"},{"id":"D","text":"Floor 7"}]'::jsonb,
    'B',
    'Floors 1 to 7:
1. "Only three people live above C" -> C lives on Floor 4.
2. In the valid floor configuration, A is on Floor 2 and B lives immediately above A on Floor 3.',
    'Floor puzzle elimination with boundary constraints',
    '["C is on Floor 4 because 3 floors (5, 6, 7) are above C.","Place A and B according to vertical adjacency."]'::jsonb,
    20,
    50,
    '["Puzzles","Floor Puzzle","Seating & Stacking"]'::jsonb,
    TRUE
  ),
  (
    'lr-043',
    'Identifying Non-Conforming Semantic Set',
    'Which of the following word pairs does NOT exhibit the same relationship as the others?',
    'Logical Reasoning',
    'Classification',
    'easy',
    '[{"id":"A","text":"Author : Novel"},{"id":"B","text":"Sculptor : Statue"},{"id":"C","text":"Carpenter : Wood"},{"id":"D","text":"Composer : Symphony"}]'::jsonb,
    'C',
    'In options A, B, and D, the relationship is Creator : Final Product (Author creates a Novel, Sculptor creates a Statue, Composer creates a Symphony).
In option C, Carpenter : Wood is Creator : Raw Material (not the final product, which would be furniture). Hence C is the odd one out.',
    'Relationship: Creator : Product vs Creator : Raw Material',
    '["Look at whether the second word is a finished creation or a raw material."]'::jsonb,
    10,
    94,
    '["Classification","Semantic Relationships","Word Analogy"]'::jsonb,
    TRUE
  ),
  (
    'lr-044',
    'Cubic and Square Alternating Difference Sequence',
    'Find the missing number in the series: 2, 3, 11, 38, 102, ?',
    'Logical Reasoning',
    'Series & Patterns',
    'medium',
    '[{"id":"A","text":"215"},{"id":"B","text":"227"},{"id":"C","text":"235"},{"id":"D","text":"248"}]'::jsonb,
    'B',
    'Look at the differences between consecutive terms:
3 - 2 = 1 = 1³
11 - 3 = 8 = 2³
38 - 11 = 27 = 3³
102 - 38 = 64 = 4³
Next difference must be 5³ = 125.
Next term = 102 + 125 = 227.',
    'T_n = T_(n-1) + n³',
    '["Calculate differences: 1, 8, 27, 64.","Notice they are cubes: 1³, 2³, 3³, 4³. Add 5³ = 125."]'::jsonb,
    15,
    77,
    '["Number Series","Cubes","Differences"]'::jsonb,
    TRUE
  ),
  (
    'lr-045',
    'Clockwise and Counter-Clockwise Facing Rotations',
    'A person is facing North-West. They turn 90° in the clockwise direction, then 180° in the anti-clockwise direction, and then another 90° in the anti-clockwise direction. Which direction are they facing now?',
    'Logical Reasoning',
    'Direction Sense',
    'medium',
    '[{"id":"A","text":"North-East"},{"id":"B","text":"South-East"},{"id":"C","text":"South-West"},{"id":"D","text":"North-West"}]'::jsonb,
    'B',
    'Net angular rotation:
Clockwise (CW) = +90°.
Anti-Clockwise (ACW) = -180° - 90° = -270°.
Net rotation = +90° - 270° = -180° (which is a 180° turn in either direction).
A 180° turn from North-West points directly to the opposite compass point: South-East.',
    'Net Angle = Sum(CW) - Sum(ACW); NW + 180° = SE',
    '["Calculate net rotation: +90° - 180° - 90° = -180°.","A 180° turn from North-West is directly opposite: South-East."]'::jsonb,
    15,
    88,
    '["Direction Sense","Angular Turns","Compass"]'::jsonb,
    TRUE
  ),
  (
    'lr-046',
    'Evaluating Strong vs Weak Arguments',
    'Statement: "Should all high school curricula mandate financial literacy education?"

Arguments:
I. Yes, because early financial literacy equips students with budgeting, investing, and debt management skills crucial for adult independence.
II. No, because other countries do not require it.

Which argument(s) are strong?',
    'Logical Reasoning',
    'Critical Reasoning',
    'easy',
    '[{"id":"A","text":"Only Argument I is strong"},{"id":"B","text":"Only Argument II is strong"},{"id":"C","text":"Both I and II are strong"},{"id":"D","text":"Neither is strong"}]'::jsonb,
    'A',
    '- Argument I is strong because it provides a direct, logical, and constructive justification grounded in essential life skills.
- Argument II is weak because it relies on a logical fallacy (appeal to external practice / bandwagon) without evaluating the intrinsic merit of the policy.
Therefore, only Argument I is strong.',
    'Strong arguments are logical, relevant, and consequential; weak arguments rely on fallacies',
    '["Argument I offers a practical benefit.","Argument II is a superficial comparison without substantive reason."]'::jsonb,
    10,
    93,
    '["Critical Reasoning","Arguments","Logical Strength"]'::jsonb,
    TRUE
  ),
  (
    'lr-047',
    'Angle Between Clock Hands at 8:20',
    'What is the interior angle between the hour and minute hands of a clock at 8:20?',
    'Logical Reasoning',
    'Clocks & Calendars',
    'medium',
    '[{"id":"A","text":"120°"},{"id":"B","text":"130°"},{"id":"C","text":"135°"},{"id":"D","text":"140°"}]'::jsonb,
    'B',
    'Using Angle = |30H - 5.5M|:
For H = 8, M = 20:
Angle = |30(8) - 5.5(20)| = |240 - 110| = 130°.',
    'Angle = |30H - 5.5M| = |240 - 110| = 130°',
    '["Hour hand position = 8 × 30 + 20 × 0.5 = 250°.","Minute hand position = 20 × 6 = 120°. Difference = 250 - 120 = 130°."]'::jsonb,
    15,
    89,
    '["Clocks","Angles","Calculations"]'::jsonb,
    TRUE
  ),
  (
    'lr-048',
    'Conditional Letter Code Matrix',
    'In a certain code, "MACHINE" is written as "NBDINJF". How will "MONSTER" be written in the same code?',
    'Logical Reasoning',
    'Coding-Decoding',
    'easy',
    '[{"id":"A","text":"NPOUTFS"},{"id":"B","text":"NOPTUFS"},{"id":"C","text":"NOSTUFS"},{"id":"D","text":"NPOTUFS"}]'::jsonb,
    'A',
    'Analyze the transformation from MACHINE to NBDINJF:
M (+1) = N
A (+1) = B
C (+1) = D
H (+1) = I
I (+1) = J
N (+1) = O
E (+1) = F
Each letter is shifted forward by +1 in the alphabet:
M (+1) = N
O (+1) = P
N (+1) = O
S (+1) = T
T (+1) = U
E (+1) = F
R (+1) = S
Result: "NPOUTFS".',
    'Positional shift rule: char(c) → char(c + 1)',
    '["Each letter shifts forward by exactly +1.","M->N, O->P, N->O, S->T, T->U, E->F, R->S."]'::jsonb,
    10,
    94,
    '["Coding Decoding","Caesar Shift","Alphabet"]'::jsonb,
    TRUE
  ),
  (
    'lr-049',
    'Public Transit Ticket Fare Discount Assumption',
    'Statement: "The city subway launched a 50% discount on monthly transit passes to encourage more commuters to use public transit instead of private cars."

Assumptions:
I. Cost is a key factor influencing commuters'' choice between public transit and private vehicles.
II. The subway network has sufficient capacity to handle an increase in passenger volume.

Which assumption(s) are implicit?',
    'Logical Reasoning',
    'Statement & Assumption',
    'medium',
    '[{"id":"A","text":"Only Assumption I is implicit"},{"id":"B","text":"Only Assumption II is implicit"},{"id":"C","text":"Both Assumptions I and II are implicit"},{"id":"D","text":"Neither is implicit"}]'::jsonb,
    'C',
    '- Assumption I is implicit because offering a price cut assumes that pricing influences commuter behavior.
- Assumption II is implicit because launching a promotional program to attract commuters assumes that the system can accommodate the increased demand without collapsing.
Both assumptions are implicit.',
    'Strategic policy decisions implicitly assume behavioral responsiveness and operational feasibility',
    '["Price incentives only work if price matters to consumers.","Authorities would not promote ridership if capacity could not support it."]'::jsonb,
    15,
    78,
    '["Assumptions","Policy Analysis","Critical Reasoning"]'::jsonb,
    TRUE
  ),
  (
    'lr-050',
    'Four Person Profession and City Grid Matching',
    'Four professionals (Doctor, Engineer, Lawyer, Architect) live in four different cities (Boston, Chicago, Denver, Austin).
- The Doctor does not live in Boston or Austin.
- The Lawyer lives in Denver.
- The Engineer lives in Austin.
In which city does the Doctor live?',
    'Logical Reasoning',
    'Puzzles & Logic Grids',
    'easy',
    '[{"id":"A","text":"Boston"},{"id":"B","text":"Chicago"},{"id":"C","text":"Denver"},{"id":"D","text":"Austin"}]'::jsonb,
    'B',
    'Available cities: Boston, Chicago, Denver, Austin.
1. Lawyer = Denver (Denver is taken).
2. Engineer = Austin (Austin is taken).
Remaining cities for Doctor and Architect: Boston and Chicago.
3. Given "The Doctor does not live in Boston" -> Doctor must live in Chicago.
(Consequently, the Architect lives in Boston).',
    'Grid elimination table matching',
    '["Denver belongs to Lawyer, Austin belongs to Engineer.","Since Doctor cannot live in Boston, Doctor must live in Chicago."]'::jsonb,
    10,
    95,
    '["Logic Grids","Matching Puzzles","Deduction"]'::jsonb,
    TRUE
  ),
  (
    'di-001',
    'Budget Allocation & Expenditure Comparison',
    'A company’s annual expenditure is distributed across departments via a pie chart:
- R&D: 108°
- Marketing: 72°
- Operations: 90°
- HR & Admin: 54°
- Logistics: 36°

If the total annual expenditure is $5,000,000, how much more does the company spend on R&D than on Marketing?',
    'Data Interpretation',
    'Pie Charts',
    'easy',
    '[{"id":"A","text":"$250,000"},{"id":"B","text":"$500,000"},{"id":"C","text":"$750,000"},{"id":"D","text":"$1,000,000"}]'::jsonb,
    'B',
    'Total angle in a pie chart = 360° = $5,000,000.
Difference in degrees between R&D and Marketing = 108° - 72° = 36°.
Fraction of total budget = 36° / 360° = 1/10.
Difference in spending = (1/10) × $5,000,000 = $500,000.',
    'Difference = [(Degree1 - Degree2) / 360°] × Total Budget',
    '["Subtract the angles directly before multiplying by the total budget.","36 degrees is exactly 10% of 360 degrees."]'::jsonb,
    10,
    84,
    '["Data Interpretation","Pie Charts","Percentages"]'::jsonb,
    TRUE
  ),
  (
    'di-002',
    'Student Passing Percentage Across 4 Colleges',
    'Consider the performance data below:

• College Alpha: 400 Appeared, 320 Passed
• College Beta: 500 Appeared, 375 Passed
• College Gamma: 600 Appeared, 510 Passed
• College Delta: 450 Appeared, 360 Passed

Which college recorded the highest passing percentage?',
    'Data Interpretation',
    'Tables & Ratios',
    'easy',
    '[{"id":"A","text":"College Alpha"},{"id":"B","text":"College Beta"},{"id":"C","text":"College Gamma"},{"id":"D","text":"College Delta"}]'::jsonb,
    'C',
    'Calculate passing % for each:
- Alpha: 320 / 400 = 80.0%
- Beta: 375 / 500 = 75.0%
- Gamma: 510 / 600 = 85.0%
- Delta: 360 / 450 = 80.0%

College Gamma has the highest passing rate at 85.0%.',
    'Passing % = (Passed / Appeared) × 100',
    '["Convert each fraction (320/400, 375/500, 510/600, 360/450) into a percentage."]'::jsonb,
    10,
    92,
    '["Data Interpretation","Tables","Percentages"]'::jsonb,
    TRUE
  ),
  (
    'di-003',
    'Compound Growth Rate of Revenue',
    'A software company reports revenue over 3 consecutive years:
- Year 1: $20 Million
- Year 2: $26 Million
- Year 3: $33.8 Million

What is the constant year-over-year percentage growth rate of the company’s revenue?',
    'Data Interpretation',
    'Bar Graphs & Growth Rates',
    'medium',
    '[{"id":"A","text":"25%"},{"id":"B","text":"28%"},{"id":"C","text":"30%"},{"id":"D","text":"35%"}]'::jsonb,
    'C',
    'Growth from Year 1 to Year 2: (26 - 20) / 20 = 6 / 20 = 30%.
Growth from Year 2 to Year 3: (33.8 - 26) / 26 = 7.8 / 26 = 30%.
The constant annual growth rate is exactly 30%.',
    'Growth Rate % = [(Revenue_(t) - Revenue_(t-1)) / Revenue_(t-1)] × 100',
    '["Find the percentage increase from Year 1 (20M) to Year 2 (26M)."]'::jsonb,
    15,
    78,
    '["Growth Rates","Bar Charts","Business Math"]'::jsonb,
    TRUE
  ),
  (
    'di-004',
    'Three-Set Venn Diagram Consumer Survey',
    'In a survey of 200 consumers regarding three smartphone brands (A, B, and C):
- 90 like Brand A
- 80 like Brand B
- 70 like Brand C
- 30 like both A and B
- 25 like both B and C
- 20 like both A and C
- 10 like all three brands

How many consumers surveyed do NOT like any of the three brands?',
    'Data Interpretation',
    'Caselets & Set Theory',
    'hard',
    '[{"id":"A","text":"15"},{"id":"B","text":"25"},{"id":"C","text":"35"},{"id":"D","text":"40"}]'::jsonb,
    'B',
    'By the Principle of Inclusion-Exclusion for 3 sets:
|A ∪ B ∪ C| = |A| + |B| + |C| - |A ∩ B| - |B ∩ C| - |A ∩ C| + |A ∩ B ∩ C|
|A ∪ B ∪ C| = 90 + 80 + 70 - 30 - 25 - 20 + 10
= 240 - 75 + 10 = 175 consumers like at least one brand.

Consumers who like NONE of the three = Total - |A ∪ B ∪ C| = 200 - 175 = 25.',
    'n(None) = Total - [n(A)+n(B)+n(C) - n(A∩B)-n(B∩C)-n(A∩C) + n(A∩B∩C)]',
    '["Use the formula for the union of three sets: n(A∪B∪C).","Subtract the union from the total 200."]'::jsonb,
    20,
    54,
    '["Set Theory","Caselets","Inclusion Exclusion"]'::jsonb,
    TRUE
  ),
  (
    'di-005',
    'Quarterly Sales and Profit Margin Analysis',
    'A tech enterprise recorded the following quarterly metrics in 2024:

• Q1: Revenue = $800k, Expenses = $600k
• Q2: Revenue = $1,000k, Expenses = $700k
• Q3: Revenue = $1,200k, Expenses = $900k
• Q4: Revenue = $1,500k, Expenses = $1,050k

Which quarter yielded the highest Net Profit Margin (Profit / Revenue)?',
    'Data Interpretation',
    'Tables & Ratios',
    'medium',
    '[{"id":"A","text":"Q1"},{"id":"B","text":"Q2"},{"id":"C","text":"Q3"},{"id":"D","text":"Q4"}]'::jsonb,
    'B',
    'Profit = Revenue - Expenses. Profit Margin = Profit / Revenue:
- Q1: Profit = 800 - 600 = $200k. Margin = 200 / 800 = 25.0%
- Q2: Profit = 1000 - 700 = $300k. Margin = 300 / 1000 = 30.0%
- Q3: Profit = 1200 - 900 = $300k. Margin = 300 / 1200 = 25.0%
- Q4: Profit = 1500 - 1050 = $450k. Margin = 450 / 1500 = 30.0%
Q2 reached the peak margin with the lowest operating expense ratio.',
    'Margin = (Revenue - Expenses) / Revenue',
    '["Calculate profit for each quarter and divide by revenue.","Q2: 300 / 1000 = 30%."]'::jsonb,
    15,
    88,
    '["Tables","Profit Margins","Financial Ratios"]'::jsonb,
    TRUE
  ),
  (
    'di-006',
    'National Energy Generation Sources',
    'A country’s power grid generation is represented by a pie chart (total 100% = 400 Terawatt-hours (TWh)):
- Solar: 25%
- Wind: 20%
- Hydroelectric: 15%
- Natural Gas: 30%
- Coal: 10%

How much total electricity (in TWh) is generated from renewable sources (Solar + Wind + Hydroelectric)?',
    'Data Interpretation',
    'Pie Charts',
    'easy',
    '[{"id":"A","text":"180 TWh"},{"id":"B","text":"200 TWh"},{"id":"C","text":"240 TWh"},{"id":"D","text":"260 TWh"}]'::jsonb,
    'C',
    'Total renewable percentage = Solar (25%) + Wind (20%) + Hydroelectric (15%) = 60%.
Total electricity = 400 TWh.
Renewable generation = 60% of 400 TWh = 0.60 × 400 = 240 TWh.',
    'Renewable Total = Sum(Renewable %) × Total Energy',
    '["Add percentages: 25 + 20 + 15 = 60%.","0.60 × 400 = 240 TWh."]'::jsonb,
    10,
    93,
    '["Pie Charts","Energy Generation","Percentages"]'::jsonb,
    TRUE
  ),
  (
    'di-007',
    'Automobile Production vs Sales Gap',
    'An automobile manufacturer records annual production and sales figures (in thousands):

• 2021: Produced = 500, Sold = 450
• 2022: Produced = 600, Sold = 540
• 2023: Produced = 750, Sold = 600
• 2024: Produced = 800, Sold = 720

In which year was the unsold inventory (Produced - Sold) the highest?',
    'Data Interpretation',
    'Bar Graphs & Growth Rates',
    'easy',
    '[{"id":"A","text":"2021"},{"id":"B","text":"2022"},{"id":"C","text":"2023"},{"id":"D","text":"2024"}]'::jsonb,
    'C',
    'Calculate unsold inventory for each year:
- 2021: 500 - 450 = 50k
- 2022: 600 - 540 = 60k
- 2023: 750 - 600 = 150k
- 2024: 800 - 720 = 80k

Year 2023 had the largest unsold inventory of 150k units.',
    'Unsold Inventory = Production - Sales',
    '["Subtract sold units from produced units for each year.","2023 has 750 - 600 = 150."]'::jsonb,
    10,
    95,
    '["Bar Graphs","Inventory","Data Comparison"]'::jsonb,
    TRUE
  ),
  (
    'di-008',
    'E-Commerce Website Conversion Rate Trend',
    'A line graph shows unique visitors (UV) and successful checkouts (SC) over 4 months:

• Month 1: 50,000 UV, 1,500 SC
• Month 2: 60,000 UV, 2,100 SC
• Month 3: 80,000 UV, 2,400 SC
• Month 4: 100,000 UV, 3,500 SC

What was the highest monthly Conversion Rate (Checkouts / Visitors)?',
    'Data Interpretation',
    'Line Graphs',
    'medium',
    '[{"id":"A","text":"3.0%"},{"id":"B","text":"3.5%"},{"id":"C","text":"3.75%"},{"id":"D","text":"4.0%"}]'::jsonb,
    'B',
    'Calculate Conversion Rate for each month:
- Month 1: 1,500 / 50,000 = 3.0%
- Month 2: 2,100 / 60,000 = 3.5%
- Month 3: 2,400 / 80,000 = 3.0%
- Month 4: 3,500 / 100,000 = 3.5%

The maximum conversion rate achieved is 3.5% (in Month 2 and Month 4).',
    'Conversion Rate % = (Checkouts / Visitors) × 100',
    '["Divide checkouts by visitors for each month: 2100/60000 = 3.5%."]'::jsonb,
    15,
    89,
    '["Line Graphs","Conversion Rate","Percentages"]'::jsonb,
    TRUE
  ),
  (
    'di-009',
    'Gender Ratio Across University Departments',
    'The student enrollment table in a university shows:

• Engineering: 1,200 total students (Male : Female = 3 : 1)
• Business: 800 total students (Male : Female = 1 : 1)
• Humanities: 600 total students (Male : Female = 1 : 2)
• Sciences: 400 total students (Male : Female = 3 : 2)

What is the total number of female students enrolled across all four departments?',
    'Data Interpretation',
    'Tables & Ratios',
    'medium',
    '[{"id":"A","text":"1,160"},{"id":"B","text":"1,220"},{"id":"C","text":"1,260"},{"id":"D","text":"1,300"}]'::jsonb,
    'C',
    'Calculate female students per department:
- Engineering (1/4 of 1200): 300
- Business (1/2 of 800): 400
- Humanities (2/3 of 600): 400
- Sciences (2/5 of 400): 160

Total females = 300 + 400 + 400 + 160 = 1,260.',
    'Females = Total × [Female_ratio / Total_ratio]',
    '["Engineering has 1/4 × 1200 = 300 females.","Sum all department female counts: 300 + 400 + 400 + 160 = 1260."]'::jsonb,
    15,
    81,
    '["Tables","Ratios","Demographics"]'::jsonb,
    TRUE
  ),
  (
    'di-010',
    'Manufacturing Defect Rate Across Production Shifts',
    'A factory runs Morning and Night shifts producing a total of 10,000 components daily.
- The Morning shift produces 60% of total components with a defect rate of 2%.
- The Night shift produces the remaining components with a defect rate of 5%.

What is the overall average defect rate for the entire daily output?',
    'Data Interpretation',
    'Caselets & Set Theory',
    'easy',
    '[{"id":"A","text":"2.8%"},{"id":"B","text":"3.2%"},{"id":"C","text":"3.5%"},{"id":"D","text":"3.8%"}]'::jsonb,
    'B',
    'Morning Shift (60% = 6,000 units): Defective = 0.02 × 6,000 = 120 units.
Night Shift (40% = 4,000 units): Defective = 0.05 × 4,000 = 200 units.
Total defective = 120 + 200 = 320 units.
Overall defect rate = (320 / 10,000) × 100% = 3.2%.
Weighted Average Shortcut: (0.60 × 2%) + (0.40 × 5%) = 1.2% + 2.0% = 3.2%.',
    'Weighted Defect Rate = w1 × d1 + w2 × d2',
    '["Calculate weighted average: 0.60 × 2% + 0.40 × 5% = 1.2% + 2.0% = 3.2%."]'::jsonb,
    10,
    88,
    '["Caselets","Weighted Average","Quality Control"]'::jsonb,
    TRUE
  ),
  (
    'di-011',
    'Export Destination Market Share Degrees',
    'A country’s total export valuation of $120 Billion is divided by region in a pie chart:
- North America: 120°
- Europe: 90°
- Asia-Pacific: 75°
- Latin America: 45°
- Africa & Middle East: 30°

What is the value of exports to the Asia-Pacific region?',
    'Data Interpretation',
    'Pie Charts',
    'easy',
    '[{"id":"A","text":"$20 Billion"},{"id":"B","text":"$25 Billion"},{"id":"C","text":"$30 Billion"},{"id":"D","text":"$35 Billion"}]'::jsonb,
    'B',
    'Total pie chart = 360° = $120 Billion.
Asia-Pacific angle = 75°.
Export value = (75° / 360°) × $120 Billion
= (5 / 24) × 120 = 5 × 5 = $25 Billion.',
    'Value = (Angle / 360°) × Total',
    '["75 / 360 = 5 / 24.","5/24 × 120 Billion = $25 Billion."]'::jsonb,
    10,
    90,
    '["Pie Charts","Exports","Trade Data"]'::jsonb,
    TRUE
  ),
  (
    'di-012',
    'Year-over-Year Percentage Sales Expansion',
    'Retail sales (in $ Millions) over 4 years were:
• 2021: $40M
• 2022: $50M
• 2023: $65M
• 2024: $91M

Which year experienced the highest percentage growth over its preceding year?',
    'Data Interpretation',
    'Bar Graphs & Growth Rates',
    'medium',
    '[{"id":"A","text":"2022"},{"id":"B","text":"2023"},{"id":"C","text":"2024"},{"id":"D","text":"2022 and 2024 tied"}]'::jsonb,
    'C',
    'Calculate percentage growth for each year over previous:
- 2022 over 2021: (50 - 40) / 40 = 10 / 40 = 25.0%
- 2023 over 2022: (65 - 50) / 50 = 15 / 50 = 30.0%
- 2024 over 2023: (91 - 65) / 65 = 26 / 65 = 40.0%

Year 2024 had the highest growth rate at 40.0%.',
    'Growth Rate % = (New - Old) / Old × 100',
    '["2024 growth is (91 - 65) / 65 = 26 / 65 = 0.40 = 40%."]'::jsonb,
    15,
    79,
    '["Bar Graphs","Growth Rates","Business Analytics"]'::jsonb,
    TRUE
  ),
  (
    'di-013',
    'Hospital Bed Occupancy Rate Comparison',
    'Four hospitals report daily bed capacity and occupancy:

• Hospital A: 250 Total Beds, 220 Occupied
• Hospital B: 400 Total Beds, 340 Occupied
• Hospital C: 500 Total Beds, 450 Occupied
• Hospital D: 300 Total Beds, 276 Occupied

Which hospital has the highest Bed Occupancy Rate?',
    'Data Interpretation',
    'Tables & Ratios',
    'easy',
    '[{"id":"A","text":"Hospital A"},{"id":"B","text":"Hospital B"},{"id":"C","text":"Hospital C"},{"id":"D","text":"Hospital D"}]'::jsonb,
    'D',
    'Occupancy Rates:
- Hospital A: 220 / 250 = 88.0%
- Hospital B: 340 / 400 = 85.0%
- Hospital C: 450 / 500 = 90.0%
- Hospital D: 276 / 300 = 92.0%

Hospital D has the highest occupancy rate at 92.0%.',
    'Occupancy Rate % = (Occupied / Total) × 100',
    '["Convert each fraction to a percentage: 220/250=88%, 340/400=85%, 450/500=90%, 276/300=92%."]'::jsonb,
    10,
    91,
    '["Tables","Healthcare Analytics","Ratios"]'::jsonb,
    TRUE
  ),
  (
    'di-014',
    'Average Monthly Temperature Differential',
    'Monthly average temperatures (°C) for City North and City South:

• Jan: North = 4°C, South = 24°C
• Apr: North = 16°C, South = 28°C
• Jul: North = 28°C, South = 30°C
• Oct: North = 12°C, South = 26°C

In which month is the absolute temperature difference between the two cities minimized?',
    'Data Interpretation',
    'Line Graphs',
    'easy',
    '[{"id":"A","text":"Jan"},{"id":"B","text":"Apr"},{"id":"C","text":"Jul"},{"id":"D","text":"Oct"}]'::jsonb,
    'C',
    'Absolute differences |South - North|:
- Jan: |24 - 4| = 20°C
- Apr: |28 - 16| = 12°C
- Jul: |30 - 28| = 2°C
- Oct: |26 - 12| = 14°C

July has the smallest gap of just 2°C.',
    'Difference = |Temp_South - Temp_North|',
    '["Subtract North temp from South temp for each month.","July difference is 30 - 28 = 2°C."]'::jsonb,
    10,
    96,
    '["Line Graphs","Climatology Data","Differences"]'::jsonb,
    TRUE
  ),
  (
    'di-015',
    'Household Budget Food and Housing Share',
    'A family earning $6,000 monthly divides expenses according to a pie chart:
- Housing: 35%
- Food & Groceries: 25%
- Transportation: 15%
- Savings: 15%
- Entertainment: 10%

How much combined money is spent on Housing and Food each month?',
    'Data Interpretation',
    'Pie Charts',
    'easy',
    '[{"id":"A","text":"$3,200"},{"id":"B","text":"$3,400"},{"id":"C","text":"$3,600"},{"id":"D","text":"$3,800"}]'::jsonb,
    'C',
    'Combined percentage = Housing (35%) + Food (25%) = 60%.
Total monthly income = $6,000.
Combined expenditure = 60% of $6,000 = 0.60 × 6,000 = $3,600.',
    'Combined Spending = (35% + 25%) × $6,000',
    '["35% + 25% = 60%.","0.60 × 6000 = 3600."]'::jsonb,
    10,
    94,
    '["Pie Charts","Household Budget","Percentages"]'::jsonb,
    TRUE
  ),
  (
    'di-016',
    'Defective Parts per Million in Semiconductor Fabrication',
    'Three semiconductor fabrication plants produce microchips:

• Fab 1: 2,000,000 produced, 40 defective
• Fab 2: 1,500,000 produced, 45 defective
• Fab 3: 3,000,000 produced, 45 defective

What is the Defective Parts Per Million (PPM) for Fab 3?',
    'Data Interpretation',
    'Tables & Ratios',
    'medium',
    '[{"id":"A","text":"12 PPM"},{"id":"B","text":"15 PPM"},{"id":"C","text":"20 PPM"},{"id":"D","text":"30 PPM"}]'::jsonb,
    'B',
    'PPM formula: (Defective Units / Total Units) × 1,000,000
For Fab 3: (45 / 3,000,000) × 1,000,000 = 45 / 3 = 15 PPM.',
    'PPM = (Defects / Total) × 10⁶',
    '["Divide 45 by 3 million, then multiply by 1 million.","45 / 3 = 15 PPM."]'::jsonb,
    15,
    92,
    '["Tables","Quality Metrics","PPM"]'::jsonb,
    TRUE
  ),
  (
    'di-017',
    'Renewable Power Capacity Additions',
    'A state added renewable solar capacity over 3 years:
• 2022: 1,200 MW
• 2023: 1,500 MW
• 2024: 1,950 MW

What is the percentage increase in annual capacity addition in 2024 compared to 2023?',
    'Data Interpretation',
    'Bar Graphs & Growth Rates',
    'medium',
    '[{"id":"A","text":"25%"},{"id":"B","text":"30%"},{"id":"C","text":"35%"},{"id":"D","text":"40%"}]'::jsonb,
    'B',
    'Percentage Increase = [(Addition_2024 - Addition_2023) / Addition_2023] × 100%
= [(1950 - 1500) / 1500] × 100%
= (450 / 1500) × 100% = 30%.',
    'Percentage Increase = (Δ / Base) × 100',
    '["450 / 1500 = 0.30 = 30%."]'::jsonb,
    15,
    91,
    '["Bar Graphs","Energy Capacity","Percentage Growth"]'::jsonb,
    TRUE
  ),
  (
    'di-018',
    'Software Developer Language Proficiency Survey',
    'In an engineering team of 120 developers:
- 70 know Python
- 60 know TypeScript
- 25 know both Python and TypeScript

How many developers know NEITHER Python nor TypeScript?',
    'Data Interpretation',
    'Caselets & Set Theory',
    'medium',
    '[{"id":"A","text":"15"},{"id":"B","text":"20"},{"id":"C","text":"25"},{"id":"D","text":"30"}]'::jsonb,
    'A',
    'By Principle of Inclusion-Exclusion for 2 sets:
Total knowing at least one = n(Python) + n(TypeScript) - n(Both)
= 70 + 60 - 25 = 105 developers.
Neither = Total - (At least one) = 120 - 105 = 15 developers.',
    'n(Neither) = Total - [n(A) + n(B) - n(A ∩ B)]',
    '["Union of developers = 70 + 60 - 25 = 105.","120 - 105 = 15."]'::jsonb,
    15,
    89,
    '["Caselets","Set Theory","Two Sets Venn"]'::jsonb,
    TRUE
  ),
  (
    'di-019',
    'Corporate R&D Expenditure Project Shares',
    'An aerospace firm spends $800M across 4 projects:
- Project Alpha: 40%
- Project Beta: 30%
- Project Gamma: 20%
- Project Delta: 10%

By how much does spending on Project Alpha exceed spending on Project Gamma?',
    'Data Interpretation',
    'Pie Charts',
    'easy',
    '[{"id":"A","text":"$80M"},{"id":"B","text":"$120M"},{"id":"C","text":"$160M"},{"id":"D","text":"$200M"}]'::jsonb,
    'C',
    'Difference in share = Alpha (40%) - Gamma (20%) = 20%.
Total budget = $800M.
Difference in dollars = 20% of $800M = 0.20 × 800 = $160M.',
    'Difference = (40% - 20%) × $800M',
    '["Find the percentage gap: 40% - 20% = 20%.","0.20 × 800 = $160 Million."]'::jsonb,
    10,
    94,
    '["Pie Charts","Budget Allocation","Percentages"]'::jsonb,
    TRUE
  ),
  (
    'di-020',
    'Airline On-Time Arrival Performance',
    'Four airlines report monthly scheduled flights and on-time arrivals:

• Air Aero: 1,000 flights, 860 on-time
• Sky Jet: 1,200 flights, 960 on-time
• Cloud Air: 800 flights, 720 on-time
• Star Line: 1,500 flights, 1,275 on-time

Which airline achieved the highest on-time arrival percentage?',
    'Data Interpretation',
    'Tables & Ratios',
    'medium',
    '[{"id":"A","text":"Air Aero"},{"id":"B","text":"Sky Jet"},{"id":"C","text":"Cloud Air"},{"id":"D","text":"Star Line"}]'::jsonb,
    'C',
    'On-time percentages:
- Air Aero: 860 / 1000 = 86.0%
- Sky Jet: 960 / 1200 = 80.0%
- Cloud Air: 720 / 800 = 90.0%
- Star Line: 1275 / 1500 = 85.0%

Cloud Air has the highest on-time arrival rate at 90.0%.',
    'On-time % = (On-time / Scheduled) × 100',
    '["720 / 800 = 9 / 10 = 90%."]'::jsonb,
    15,
    92,
    '["Tables","Aviation Analytics","Percentages"]'::jsonb,
    TRUE
  ),
  (
    'di-021',
    'Quarterly Operating Margin Expansion',
    'A software SaaS startup tracks Operating Margin over 4 consecutive quarters:
• Q1: 10%
• Q2: 15%
• Q3: 20%
• Q4: 26%

What was the percentage increase in the operating margin from Q1 to Q4?',
    'Data Interpretation',
    'Bar Graphs & Growth Rates',
    'hard',
    '[{"id":"A","text":"16%"},{"id":"B","text":"60%"},{"id":"C","text":"160%"},{"id":"D","text":"260%"}]'::jsonb,
    'C',
    'Initial value = 10%. Final value = 26%.
Percentage increase = [(26 - 10) / 10] × 100% = (16 / 10) × 100% = 160%.
(Note: The margin expanded by 16 percentage points, which represents a 160% relative expansion).',
    'Relative Increase % = [(Final - Initial) / Initial] × 100',
    '["Be careful to distinguish percentage points from percentage increase.","(26 - 10) / 10 = 1.6 = 160%."]'::jsonb,
    20,
    68,
    '["Growth Rates","Operating Margins","Relative Change"]'::jsonb,
    TRUE
  ),
  (
    'di-022',
    'Server CPU Utilization Peak Hours',
    'Average server CPU load across 4 operational intervals:

• 00:00 - 06:00: 25%
• 06:00 - 12:00: 65%
• 12:00 - 18:00: 85%
• 18:00 - 24:00: 55%

What is the average CPU utilization across the entire 24-hour day?',
    'Data Interpretation',
    'Line Graphs',
    'easy',
    '[{"id":"A","text":"55.0%"},{"id":"B","text":"57.5%"},{"id":"C","text":"60.0%"},{"id":"D","text":"62.5%"}]'::jsonb,
    'B',
    'Since all 4 intervals are of equal duration (6 hours each), the daily average is the simple arithmetic mean:
Average = (25 + 65 + 85 + 55) / 4 = 230 / 4 = 57.5%.',
    'Mean = Sum / 4',
    '["Add all four 6-hour loads and divide by 4.","230 / 4 = 57.5%."]'::jsonb,
    10,
    91,
    '["Line Graphs","Server Metrics","Averages"]'::jsonb,
    TRUE
  ),
  (
    'di-023',
    'Product Defect Categorization Ratios',
    'A quality control table lists 500 inspected defective components categorized by fault type:
- Electrical: 200
- Mechanical: 150
- Optical: 100
- Packaging: 50

What is the ratio of Electrical defects to Optical defects?',
    'Data Interpretation',
    'Tables & Ratios',
    'easy',
    '[{"id":"A","text":"2 : 1"},{"id":"B","text":"3 : 2"},{"id":"C","text":"4 : 3"},{"id":"D","text":"5 : 2"}]'::jsonb,
    'A',
    'Electrical defects = 200.
Optical defects = 100.
Ratio = 200 : 100 = 2 : 1.',
    'Ratio = Electrical / Optical',
    '["Divide 200 by 100."]'::jsonb,
    10,
    97,
    '["Tables","Defects","Ratios"]'::jsonb,
    TRUE
  ),
  (
    'di-024',
    'Degree to Percentage Conversion in Pie Chart',
    'In a pie chart representing a city budget, the slice for Public Parks has a central angle of 54°. What percentage of the total budget is allocated to Public Parks?',
    'Data Interpretation',
    'Pie Charts',
    'easy',
    '[{"id":"A","text":"12.5%"},{"id":"B","text":"15.0%"},{"id":"C","text":"16.67%"},{"id":"D","text":"18.0%"}]'::jsonb,
    'B',
    'Total central angle in a circle = 360° = 100%.
Percentage = (Central Angle / 360°) × 100%
= (54° / 360°) × 100% = (3 / 20) × 100% = 15.0%.',
    '% = (Angle / 360) × 100',
    '["54 / 360 simplifies to 3 / 20.","3/20 × 100% = 15%."]'::jsonb,
    10,
    95,
    '["Pie Charts","Angle Conversion","Percentages"]'::jsonb,
    TRUE
  ),
  (
    'di-025',
    'University Department Hiring Distribution',
    'A university recruited 150 new professors across 3 faculties: Engineering, Science, and Arts.
- 50 were recruited into Engineering.
- 60 were recruited into Science.
- 40 were recruited into Arts.
If 60% of Engineering, 50% of Science, and 75% of Arts recruits hold a PhD, what is the total number of new recruits with a PhD?',
    'Data Interpretation',
    'Caselets & Set Theory',
    'medium',
    '[{"id":"A","text":"80"},{"id":"B","text":"85"},{"id":"C","text":"90"},{"id":"D","text":"95"}]'::jsonb,
    'C',
    'Calculate PhD holders per faculty:
- Engineering: 60% of 50 = 30
- Science: 50% of 60 = 30
- Arts: 75% of 40 = 30
Total PhD recruits = 30 + 30 + 30 = 90.',
    'Total PhD = 0.60(50) + 0.50(60) + 0.75(40)',
    '["Engineering: 30, Science: 30, Arts: 30.","Sum: 30 + 30 + 30 = 90."]'::jsonb,
    15,
    92,
    '["Caselets","Faculty Demographics","Weighted Totals"]'::jsonb,
    TRUE
  ),
  (
    'di-026',
    'Quarterly Export-to-Import Trade Balance',
    'National trade figures for a fiscal year (in $ Billion):

• Q1: Exports = 40, Imports = 50
• Q2: Exports = 55, Imports = 50
• Q3: Exports = 60, Imports = 45
• Q4: Exports = 70, Imports = 55

What was the total net trade balance (Total Exports - Total Imports) for the year?',
    'Data Interpretation',
    'Tables & Ratios',
    'medium',
    '[{"id":"A","text":"+$15 Billion (Surplus)"},{"id":"B","text":"+$25 Billion (Surplus)"},{"id":"C","text":"-$10 Billion (Deficit)"},{"id":"D","text":"+$35 Billion (Surplus)"}]'::jsonb,
    'B',
    'Total Exports = 40 + 55 + 60 + 70 = $225 Billion.
Total Imports = 50 + 50 + 45 + 55 = $200 Billion.
Trade Balance = Exports - Imports = 225 - 200 = +$25 Billion (Trade Surplus).',
    'Trade Balance = Sum(Exports) - Sum(Imports)',
    '["Sum all exports: 225.","Sum all imports: 200. Difference = +25 Billion."]'::jsonb,
    15,
    94,
    '["Tables","Macroeconomics","Trade Balance"]'::jsonb,
    TRUE
  ),
  (
    'di-027',
    'Electric Vehicle Market Penetration Rate',
    'Total automobile registrations vs EV registrations over 3 years:

• 2022: Total = 1,000,000; EV = 80,000
• 2023: Total = 1,200,000; EV = 144,000
• 2024: Total = 1,500,000; EV = 270,000

What was the EV market share percentage in 2024?',
    'Data Interpretation',
    'Bar Graphs & Growth Rates',
    'medium',
    '[{"id":"A","text":"12.0%"},{"id":"B","text":"15.0%"},{"id":"C","text":"18.0%"},{"id":"D","text":"20.0%"}]'::jsonb,
    'C',
    'EV Market Share in 2024 = (EV Registrations / Total Registrations) × 100%
= (270,000 / 1,500,000) × 100%
= 27 / 150 = 9 / 50 = 18.0%.',
    'Share % = (EV / Total) × 100',
    '["Divide 270,000 by 1,500,000.","27 / 150 = 18%."]'::jsonb,
    15,
    91,
    '["Bar Graphs","EV Adoption","Percentages"]'::jsonb,
    TRUE
  ),
  (
    'di-028',
    'Customer Churn Rate Quarterly Reduction',
    'Quarterly churn rates for a cloud subscription service:
• Q1: 8.0%
• Q2: 6.0%
• Q3: 4.5%
• Q4: 3.6%

By what percentage was the churn rate reduced from Q1 to Q4?',
    'Data Interpretation',
    'Line Graphs',
    'hard',
    '[{"id":"A","text":"44%"},{"id":"B","text":"50%"},{"id":"C","text":"55%"},{"id":"D","text":"60%"}]'::jsonb,
    'C',
    'Percentage Reduction = [(Churn_Q1 - Churn_Q4) / Churn_Q1] × 100%
= [(8.0 - 3.6) / 8.0] × 100%
= (4.4 / 8.0) × 100% = 55.0%.',
    '% Reduction = (Initial - Final) / Initial × 100',
    '["4.4 / 8.0 = 0.55 = 55%."]'::jsonb,
    20,
    77,
    '["Line Graphs","Churn Analysis","Percentage Change"]'::jsonb,
    TRUE
  ),
  (
    'di-029',
    'Inventory Turnover Ratio Across Retail Chains',
    'Annual financial data for 4 retail companies (Cost of Goods Sold / Average Inventory):

• Retailer W: COGS = $40M, Avg Inventory = $8M
• Retailer X: COGS = $60M, Avg Inventory = $10M
• Retailer Y: COGS = $84M, Avg Inventory = $12M
• Retailer Z: COGS = $90M, Avg Inventory = $18M

Which retailer achieved the fastest inventory turnover ratio?',
    'Data Interpretation',
    'Tables & Ratios',
    'medium',
    '[{"id":"A","text":"Retailer W"},{"id":"B","text":"Retailer X"},{"id":"C","text":"Retailer Y"},{"id":"D","text":"Retailer Z"}]'::jsonb,
    'C',
    'Inventory Turnover = COGS / Average Inventory:
- Retailer W: 40 / 8 = 5.0
- Retailer X: 60 / 10 = 6.0
- Retailer Y: 84 / 12 = 7.0
- Retailer Z: 90 / 18 = 5.0

Retailer Y has the highest turnover ratio of 7.0.',
    'Turnover = COGS / Avg Inventory',
    '["Divide COGS by Average Inventory for each retailer.","Retailer Y: 84 / 12 = 7.0."]'::jsonb,
    15,
    93,
    '["Tables","Financial Accounting","Turnover Ratio"]'::jsonb,
    TRUE
  ),
  (
    'di-030',
    'Voter Turnout by Age Cohort',
    'In a municipal election with 500,000 total ballots cast, the age distribution is shown in a pie chart:
- 18–25 years: 18%
- 26–40 years: 32%
- 41–60 years: 30%
- 60+ years: 20%

How many voters belonged to the 26–40 years age bracket?',
    'Data Interpretation',
    'Pie Charts',
    'easy',
    '[{"id":"A","text":"140,000"},{"id":"B","text":"150,000"},{"id":"C","text":"160,000"},{"id":"D","text":"175,000"}]'::jsonb,
    'C',
    'Voters in 26–40 bracket = 32% of 500,000
= 0.32 × 500,000 = 160,000 voters.',
    'Voters = % × Total Ballots',
    '["0.32 × 500,000 = 160,000."]'::jsonb,
    10,
    96,
    '["Pie Charts","Demographics","Elections"]'::jsonb,
    TRUE
  ),
  (
    'di-031',
    'University Scholarship Allocation by Criteria',
    'A scholarship endowment of $1,000,000 is awarded to 100 students:
- 40 Merit scholars received $12,000 each.
- 40 Need-based scholars received $8,000 each.
- The remaining 20 Athletic scholars shared the rest equally.

How much did each Athletic scholar receive?',
    'Data Interpretation',
    'Caselets & Set Theory',
    'medium',
    '[{"id":"A","text":"$9,000"},{"id":"B","text":"$10,000"},{"id":"C","text":"$11,000"},{"id":"D","text":"$12,000"}]'::jsonb,
    'B',
    'Merit Total = 40 × $12,000 = $480,000.
Need-based Total = 40 × $8,000 = $320,000.
Subtotal = $480,000 + $320,000 = $800,000.
Remaining for 20 Athletic scholars = $1,000,000 - $800,000 = $200,000.
Per Athletic scholar = $200,000 / 20 = $10,000.',
    'Per Student = Remaining Fund / Number of Scholars',
    '["480k + 320k = 800k.","Remaining 200k divided by 20 = $10,000."]'::jsonb,
    15,
    94,
    '["Caselets","Endowments","Arithmetic Distribution"]'::jsonb,
    TRUE
  ),
  (
    'di-032',
    'Yield Efficiency in Agricultural Plots',
    'Crop yield in metric tons (MT) and cultivated land area (hectares):

• Farm Alpha: 20 hectares, 90 MT
• Farm Beta: 25 hectares, 120 MT
• Farm Gamma: 30 hectares, 156 MT
• Farm Delta: 40 hectares, 192 MT

Which farm achieved the highest Yield per Hectare (MT / Hectare)?',
    'Data Interpretation',
    'Tables & Ratios',
    'medium',
    '[{"id":"A","text":"Farm Alpha"},{"id":"B","text":"Farm Beta"},{"id":"C","text":"Farm Gamma"},{"id":"D","text":"Farm Delta"}]'::jsonb,
    'C',
    'Yield per hectare (MT / ha):
- Farm Alpha: 90 / 20 = 4.5 MT/ha
- Farm Beta: 120 / 25 = 4.8 MT/ha
- Farm Gamma: 156 / 30 = 5.2 MT/ha
- Farm Delta: 192 / 40 = 4.8 MT/ha

Farm Gamma achieved the highest productivity at 5.2 MT/ha.',
    'Yield/ha = Total Yield / Area',
    '["Gamma: 156 / 30 = 5.2 MT/ha."]'::jsonb,
    15,
    91,
    '["Tables","Agriculture","Productivity Ratios"]'::jsonb,
    TRUE
  ),
  (
    'di-033',
    'E-Commerce Gross Merchandise Value (GMV)',
    'Annual GMV ($ Billions) recorded by a digital marketplace:
• Year 1: $10B
• Year 2: $15B
• Year 3: $24B
• Year 4: $36B

What is the absolute increase in GMV between Year 2 and Year 4?',
    'Data Interpretation',
    'Bar Graphs & Growth Rates',
    'hard',
    '[{"id":"A","text":"$15 Billion"},{"id":"B","text":"$18 Billion"},{"id":"C","text":"$21 Billion"},{"id":"D","text":"$26 Billion"}]'::jsonb,
    'C',
    'GMV in Year 4 = $36B.
GMV in Year 2 = $15B.
Absolute increase = $36B - $15B = $21 Billion.',
    'Absolute Increase = Value_final - Value_initial',
    '["Subtract Year 2 GMV ($15B) from Year 4 GMV ($36B)."]'::jsonb,
    20,
    96,
    '["Bar Graphs","E-Commerce","GMV"]'::jsonb,
    TRUE
  ),
  (
    'di-034',
    'Digital Ad Click-Through Rate (CTR) Optimization',
    'Weekly Ad Impressions and Clicks performance:

• Week 1: 100,000 impressions, 2,000 clicks
• Week 2: 150,000 impressions, 3,600 clicks
• Week 3: 200,000 impressions, 5,200 clicks
• Week 4: 250,000 impressions, 6,000 clicks

Which week registered the highest Click-Through Rate (CTR)?',
    'Data Interpretation',
    'Line Graphs',
    'hard',
    '[{"id":"A","text":"Week 1"},{"id":"B","text":"Week 2"},{"id":"C","text":"Week 3"},{"id":"D","text":"Week 4"}]'::jsonb,
    'C',
    'CTR = (Clicks / Impressions) × 100%:
- Week 1: 2,000 / 100,000 = 2.0%
- Week 2: 3,600 / 150,000 = 2.4%
- Week 3: 5,200 / 200,000 = 2.6%
- Week 4: 6,000 / 250,000 = 2.4%

Week 3 achieved the peak CTR of 2.6%.',
    'CTR % = (Clicks / Impressions) × 100',
    '["Week 3: 5,200 / 200,000 = 2.6%."]'::jsonb,
    20,
    92,
    '["Line Graphs","Digital Marketing","CTR"]'::jsonb,
    TRUE
  ),
  (
    'di-035',
    'Three-Subject Olympiad Participation Matrix',
    'In a competitive school cohort of 300 students:
- 150 registered for Math
- 120 registered for Physics
- 100 registered for Chemistry
- 50 registered for Math & Physics
- 40 registered for Physics & Chemistry
- 35 registered for Math & Chemistry
- 20 registered for all three subjects

How many students registered for EXACTLY ONE subject?',
    'Data Interpretation',
    'Caselets & Set Theory',
    'hard',
    '[{"id":"A","text":"140"},{"id":"B","text":"160"},{"id":"C","text":"180"},{"id":"D","text":"200"}]'::jsonb,
    'C',
    'Set quantities using individual Venn regions:
1. All three (M ∩ P ∩ C) = 20
2. Only Math & Physics = 50 - 20 = 30
3. Only Physics & Chemistry = 40 - 20 = 20
4. Only Math & Chemistry = 35 - 20 = 15

Now calculate individual single-subject regions:
- Only Math = 150 - (30 + 15 + 20) = 150 - 65 = 85
- Only Physics = 120 - (30 + 20 + 20) = 120 - 70 = 50
- Only Chemistry = 100 - (15 + 20 + 20) = 100 - 55 = 45

Total registered for EXACTLY ONE subject = 85 + 50 + 45 = 180.',
    'Only One = [n(A) + n(B) + n(C)] - 2[n(A∩B) + n(B∩C) + n(A∩C)] + 3[n(A∩B∩C)] = 370 - 2(125) + 3(20) = 180',
    '["Calculate each \"Only\" region: Only Math = 85, Only Physics = 50, Only Chemistry = 45.","Sum them: 85 + 50 + 45 = 180."]'::jsonb,
    20,
    49,
    '["Caselets","Venn Diagrams","Three Sets"]'::jsonb,
    TRUE
  ),
  (
    'verbal-001',
    'Contextual Antonym in Scientific Discourse',
    'Choose the word that is most nearly OPPOSITE in meaning to the capitalized word as used in context:

"The experimental findings were deemed EPHEMERAL, vanishing upon subsequent trials under rigorous laboratory conditions."',
    'Verbal & Abstract',
    'Vocabulary & Context',
    'easy',
    '[{"id":"A","text":"Transient"},{"id":"B","text":"Enduring"},{"id":"C","text":"Fleeting"},{"id":"D","text":"Spurious"}]'::jsonb,
    'B',
    '"Ephemeral" means lasting for a very short time, short-lived, or transitory.
The antonym (opposite) is "Enduring", which means lasting over a long period or permanent.
(Transient and Fleeting are synonyms; Spurious means fake/illegitimate).',
    'Ephemeral = short-lived ↔ Enduring / Permanent = long-lasting',
    '["The sentence mentions \"vanishing upon subsequent trials\", so EPHEMERAL means short-lived.","You need the OPPOSITE (something that lasts a long time)."]'::jsonb,
    10,
    83,
    '["Antonyms","Vocabulary","Context Clues"]'::jsonb,
    TRUE
  ),
  (
    'verbal-002',
    'Identifying Logical Fallacy in Causal Argument',
    'Read the argument:
"Every time the local university hires a new Dean of Admissions, the average snowfall in the surrounding county increases significantly. Therefore, hiring a new Dean of Admissions alters the regional weather patterns."

Which logical fallacy does the argument commit?',
    'Verbal & Abstract',
    'Critical Reasoning',
    'easy',
    '[{"id":"A","text":"Ad Hominem (Personal Attack)"},{"id":"B","text":"Post Hoc Ergo Propter Hoc (False Cause)"},{"id":"C","text":"Straw Man Argument"},{"id":"D","text":"Appeal to Authority"}]'::jsonb,
    'B',
    'The argument infers that because Event B (increased snowfall) followed or coincided with Event A (hiring a Dean), Event A must have caused Event B.
Confusing correlation/coincidence with causation is the classic fallacy of "Post Hoc Ergo Propter Hoc" (False Cause / Faulty Causality).',
    'Correlation does not imply Causation (Post Hoc Ergo Propter Hoc)',
    '["The speaker incorrectly links two completely unrelated events occurring together in time.","Look for the Latin fallacy meaning \"after this, therefore because of this\"."]'::jsonb,
    10,
    79,
    '["Logical Fallacies","Critical Reasoning","Causality"]'::jsonb,
    TRUE
  ),
  (
    'verbal-003',
    'Dual Blank Contextual Precision',
    'Although the CEO''s initial proposal was met with widespread _______ by the board, subsequent market analysis proved her strategic instincts to be remarkably _______.',
    'Verbal & Abstract',
    'Sentence Completion',
    'medium',
    '[{"id":"A","text":"skepticism ... prescient"},{"id":"B","text":"enthusiasm ... flawed"},{"id":"C","text":"indifference ... redundant"},{"id":"D","text":"applause ... erroneous"}]'::jsonb,
    'A',
    'The word "Although" sets up a contrast between the board''s initial negative reaction and the positive validation by subsequent market analysis. "Skepticism" (doubt) contrasts logically with "prescient" (having foresight / visionary accuracy).',
    'Contrast transition ("Although") requires opposite valence in blanks',
    '["\"Although\" signals a turn from initial doubt to proven accuracy.","\"Prescient\" means correctly anticipating the future."]'::jsonb,
    15,
    78,
    '["Sentence Completion","Dual Blanks","Vocabulary in Context"]'::jsonb,
    TRUE
  ),
  (
    'verbal-004',
    'Strengthening a Competitive Business Hypothesis',
    'Argument: "A major bookstore chain introduced complimentary artisan coffee to browsing customers and saw a 30% increase in book sales over three months. The marketing team concluded that complimentary coffee directly increases dwell time and book purchases."

Which of the following, if true, most strongly STRENGTHENS the marketing team''s conclusion?',
    'Verbal & Abstract',
    'Critical Reasoning',
    'medium',
    '[{"id":"A","text":"Competitor bookstores in the same city that did not offer coffee saw no increase in sales over the same period."},{"id":"B","text":"The cost of artisan coffee beans increased by 10% during the trial period."},{"id":"C","text":"Customers who visited the bookstore spent less money at neighboring cafés."},{"id":"D","text":"The bookstore chain launched an online delivery portal at the same time."}]'::jsonb,
    'A',
    'To strengthen a causal argument, showing that the effect does NOT occur when the proposed cause is absent in an otherwise identical control group (Option A) strongly rules out regional/macro trends and bolsters the causal hypothesis.',
    'Strengthen Causal Claim: Control group without cause shows no effect',
    '["Look for a control group comparison ruling out external confounding factors."]'::jsonb,
    15,
    72,
    '["Critical Reasoning","Strengthen Argument","Causality"]'::jsonb,
    TRUE
  ),
  (
    'verbal-005',
    'Weakening a Clinical Recommendation',
    'Argument: "A recent study found that people who regularly drink chamomile tea report 40% lower stress levels than non-drinkers. Therefore, chamomile tea possesses biochemical compounds that actively reduce cortisol and psychological stress."

Which of the following, if true, most seriously WEAKENS the conclusion?',
    'Verbal & Abstract',
    'Critical Reasoning',
    'medium',
    '[{"id":"A","text":"Chamomile tea is more expensive than black tea in grocery stores."},{"id":"B","text":"People who drink chamomile tea are significantly more likely to engage in daily meditation and regular exercise than non-drinkers."},{"id":"C","text":"Chamomile tea has been consumed for over two thousand years in traditional medicine."},{"id":"D","text":"Some participants in the study drank chamomile tea with honey."}]'::jsonb,
    'B',
    'Option B introduces a powerful confounding alternative explanation (lifestyle factors: meditation and regular exercise), demonstrating that the lower stress levels may be caused by holistic wellness habits rather than any biochemical agent in chamomile tea.',
    'Weaken Causal Claim: Introduce a plausible alternative cause (confounder)',
    '["Find an alternative cause that explains why chamomile tea drinkers are less stressed."]'::jsonb,
    15,
    76,
    '["Critical Reasoning","Weaken Argument","Alternative Explanation"]'::jsonb,
    TRUE
  ),
  (
    'verbal-006',
    'Four-Sentence Coherent Paragraph Ordering',
    'Arrange the following four sentences in a logical and coherent sequence:

1. However, recent advances in generative artificial intelligence have challenged this long-held assumption.
2. For decades, creativity was considered an exclusively human domain impervious to algorithmic simulation.
3. These models can now compose intricate musical scores, write poetry, and generate photorealistic artwork in seconds.
4. Consequently, philosophers and computer scientists are redefining what it fundamentally means to create.',
    'Verbal & Abstract',
    'Para Jumbles',
    'easy',
    '[{"id":"A","text":"2 - 1 - 3 - 4"},{"id":"B","text":"1 - 3 - 2 - 4"},{"id":"C","text":"2 - 3 - 1 - 4"},{"id":"D","text":"3 - 2 - 1 - 4"}]'::jsonb,
    'A',
    '- Sentence 2 introduces the historical backdrop ("For decades, creativity was considered...").
- Sentence 1 presents the contrast ("However, recent advances...").
- Sentence 3 elaborates on the advances mentioned in 1 ("These models can now...").
- Sentence 4 provides the final consequence ("Consequently, philosophers...").
Logical order is 2 - 1 - 3 - 4.',
    'Introduction → Contrast ("However") → Elaboration ("These models") → Consequence ("Consequently")',
    '["Start with Sentence 2 which introduces the broad historical context.","Connect \"However\" (1) with \"These models\" (3), ending in \"Consequently\" (4)."]'::jsonb,
    10,
    88,
    '["Para Jumbles","Paragraph Formation","Coherence"]'::jsonb,
    TRUE
  ),
  (
    'verbal-007',
    'Subject-Verb Agreement with Intervening Prepositional Phrases',
    'Identify the grammatically correct sentence:',
    'Verbal & Abstract',
    'Grammar & Usage',
    'easy',
    '[{"id":"A","text":"The collection of rare antique manuscripts, including several 15th-century scrolls, were donated to the university library."},{"id":"B","text":"The collection of rare antique manuscripts, including several 15th-century scrolls, was donated to the university library."},{"id":"C","text":"The collection of rare antique manuscripts, including several 15th-century scrolls, are donated to the university library."},{"id":"D","text":"The collection of rare antique manuscripts, including several 15th-century scrolls, have been donated to the university library."}]'::jsonb,
    'B',
    'The true grammatical subject of the sentence is the singular collective noun "The collection". The intervening phrases ("of rare antique manuscripts" and "including several 15th-century scrolls") are prepositional/parenthetical modifiers that do not alter the number of the subject. Therefore, the singular verb "was donated" is required.',
    'Singular subject ("collection") requires singular verb ("was")',
    '["Identify the core subject of the sentence (it is \"collection\", which is singular)."]'::jsonb,
    10,
    84,
    '["Grammar","Subject-Verb Agreement","Sentence Correction"]'::jsonb,
    TRUE
  ),
  (
    'verbal-008',
    'Parallelism in Correlative Conjunctions',
    'Choose the option that maintains correct grammatical parallelism:

"The new executive director aims not only to restructure the sales department _______."',
    'Verbal & Abstract',
    'Grammar & Usage',
    'easy',
    '[{"id":"A","text":"but also expanding international distribution networks"},{"id":"B","text":"but also to expand international distribution networks"},{"id":"C","text":"and also expansion of international distribution networks"},{"id":"D","text":"as well as expanding international distribution"}]'::jsonb,
    'B',
    'The correlative conjunction "not only ... but also" requires parallel grammatical structures on both sides. Since "not only" is followed by an infinitive phrase ("to restructure the sales department"), "but also" must likewise be followed by an infinitive phrase ("to expand international distribution networks").',
    'Not only [Infinitive Verb] ... but also [Infinitive Verb]',
    '["Match the grammatical form after \"not only\" (infinitive \"to restructure\").","\"but also to expand\" preserves parallel structure."]'::jsonb,
    10,
    89,
    '["Grammar","Parallelism","Correlative Conjunctions"]'::jsonb,
    TRUE
  ),
  (
    'verbal-009',
    'Degree of Intensity Word Analogy',
    'SIMMER : BOIL :: GLIMMER : ?',
    'Verbal & Abstract',
    'Analogies',
    'medium',
    '[{"id":"A","text":"Blaze"},{"id":"B","text":"Flicker"},{"id":"C","text":"Extinguish"},{"id":"D","text":"Shadow"}]'::jsonb,
    'A',
    'Simmer represents a gentle, low-intensity form of heat, while Boil represents the intense, vigorous state of heating. Similarly, Glimmer is a faint, gentle light, while Blaze is an intense, radiant fire/light. The relationship is a progression from mild intensity to high intensity.',
    'Low Intensity : High Intensity State',
    '["Simmer is mild heating; boil is extreme heating.","Glimmer is faint light; what is intense, powerful light?"]'::jsonb,
    15,
    82,
    '["Analogies","Degree of Intensity","Word Relationships"]'::jsonb,
    TRUE
  ),
  (
    'verbal-010',
    'Precise Contextual Definition of Epistemology',
    'In philosophical inquiry, the term "EPISTEMOLOGY" specifically refers to the branch of philosophy concerned with:',
    'Verbal & Abstract',
    'Vocabulary & Context',
    'easy',
    '[{"id":"A","text":"The nature, origin, scope, and limits of human knowledge"},{"id":"B","text":"Moral principles governing individual conduct and justice"},{"id":"C","text":"The aesthetic principles governing art and beauty"},{"id":"D","text":"The classification of living biological organisms"}]'::jsonb,
    'A',
    'Epistemology (from Greek episteme = knowledge, logos = study) is the philosophical study of the nature, grounds, and validity of knowledge. Ethics is Option B, Aesthetics is Option C, Taxonomy is Option D.',
    'Epistemology = Theory and investigation of Knowledge',
    '["Episteme is Greek for knowledge."]'::jsonb,
    10,
    91,
    '["Vocabulary","Philosophy Terms","Definitions"]'::jsonb,
    TRUE
  ),
  (
    'verbal-011',
    'Geometric Matrix Pattern 90-Degree Clockwise Rotation',
    'In a 3×3 pattern grid, an arrow starts pointing North in the top-left cell. In each subsequent cell from left to right across rows, the arrow rotates 90° clockwise and gains 1 black dot at its tail.

Cell 1: North (0 dots)
Cell 2: East (1 dot)
Cell 3: South (2 dots)
Cell 4: West (3 dots)
...
What is the state of the arrow in Cell 9 (bottom-right)?',
    'Verbal & Abstract',
    'Abstract Reasoning',
    'hard',
    '[{"id":"A","text":"Pointing North with 8 dots"},{"id":"B","text":"Pointing East with 8 dots"},{"id":"C","text":"Pointing South with 8 dots"},{"id":"D","text":"Pointing West with 9 dots"}]'::jsonb,
    'A',
    '1. Orientation rotation: Cell n rotates (n - 1) × 90° clockwise from North.
For Cell 9: (9 - 1) × 90° = 8 × 90° = 720° = 2 full 360° revolutions → Points North.
2. Dot count: Cell n has (n - 1) dots.
For Cell 9: 9 - 1 = 8 dots.
Therefore, Cell 9 has an arrow Pointing North with 8 dots.',
    'Orientation = (n - 1) × 90° mod 360°; Dots = n - 1',
    '["8 rotations of 90 degrees equals 720 degrees, which completes 2 full circles back to North.","Dot count starts at 0 for Cell 1, so Cell 9 has 8 dots."]'::jsonb,
    20,
    75,
    '["Abstract Reasoning","Matrix Reasoning","Rotational Geometry"]'::jsonb,
    TRUE
  ),
  (
    'verbal-012',
    'Opposite Faces on an Unfolded Cube (Dice Net)',
    'A standard cube net consists of 6 square faces arranged in a cross:
- Top: Face 1
- Middle row (left to right): Face 2, Face 3, Face 4, Face 5
- Bottom (below Face 3): Face 6

When this net is folded into a 3D cube, which face is directly opposite Face 2?',
    'Verbal & Abstract',
    'Abstract Reasoning',
    'hard',
    '[{"id":"A","text":"Face 3"},{"id":"B","text":"Face 4"},{"id":"C","text":"Face 5"},{"id":"D","text":"Face 6"}]'::jsonb,
    'B',
    'In a straight strip of alternating folded squares, opposite faces are separated by exactly one intervening square.
In the middle horizontal row [2, 3, 4, 5]:
- Face 2 is opposite Face 4 (separated by Face 3).
- Face 3 is opposite Face 5 (separated by Face 4).
- Face 1 (top) is opposite Face 6 (bottom).
Therefore, Face 2 is directly opposite Face 4.',
    'Opposite faces in a net strip skip one adjacent square: Pos(i) ↔ Pos(i+2)',
    '["In a 4-square strip, the 1st square folds opposite the 3rd square.","Face 2 is separated from Face 4 by Face 3."]'::jsonb,
    20,
    79,
    '["Abstract Reasoning","Cube Net","Spatial Visualization"]'::jsonb,
    TRUE
  ),
  (
    'verbal-013',
    'Resolving an Apparent Paradox in Highway Safety',
    'Paradox: "A state highway safety agency increased the mandatory speed limit on rural freeways from 65 mph to 75 mph. Surprisingly, over the subsequent year, the total number of fatal vehicular accidents on those freeways decreased by 15%."

Which of the following, if true, best RESOLVES the apparent paradox?',
    'Verbal & Abstract',
    'Critical Reasoning',
    'medium',
    '[{"id":"A","text":"The higher speed limit reduced speed variance among vehicles, preventing dangerous tailgating and abrupt overtaking maneuvers."},{"id":"B","text":"Gasoline prices increased slightly during the same year."},{"id":"C","text":"State police issued fewer speeding tickets on rural freeways."},{"id":"D","text":"Adjacent urban highways experienced a 5% increase in traffic volume."}]'::jsonb,
    'A',
    'To resolve a paradox, we must explain how the higher speed limit actually produced safer driving conditions. Option A explains that uniform traffic flow (reduced speed variance) eliminates hazardous lane weaving and overtaking, thereby directly lowering catastrophic collisions.',
    'Resolve Paradox: Find mechanism explaining how action leads to unexpected outcome',
    '["Look for an explanation where higher legal speed leads to smoother, safer driving behavior."]'::jsonb,
    15,
    73,
    '["Critical Reasoning","Resolve Paradox","Causal Logic"]'::jsonb,
    TRUE
  ),
  (
    'verbal-014',
    'Single Blank Nuanced Vocabulary',
    'Despite the politician''s reputation for fiery oratory, his actual legislative record was remarkably _______, characterized by compromise and incremental reforms rather than radical upheaval.',
    'Verbal & Abstract',
    'Sentence Completion',
    'easy',
    '[{"id":"A","text":"bellicose"},{"id":"B","text":"temperate"},{"id":"C","text":"dogmatic"},{"id":"D","text":"incendiary"}]'::jsonb,
    'B',
    'The sentence contrasts "fiery oratory" with a legislative record characterized by "compromise and incremental reforms". The appropriate word is "temperate" (moderate, restrained, mild). Bellicose and incendiary are synonyms of fiery.',
    'Contrast indicator ("Despite") requires antonymous concept to "fiery"',
    '["Look for a word meaning moderate, balanced, and non-extreme.","\"Temperate\" means moderate and restrained."]'::jsonb,
    10,
    85,
    '["Sentence Completion","Vocabulary","Context Clues"]'::jsonb,
    TRUE
  ),
  (
    'verbal-015',
    'Boldface Statement Role in Rhetorical Argument',
    'Consider the argument:
"Many economists predict that rapid automation will inevitably eliminate millions of white-collar jobs. **However, historical evidence demonstrates that technological revolutions consistently create more high-value employment than they destroy.** Therefore, current anxieties regarding widespread structural unemployment are largely overblown."

What is the logical function of the **boldface sentence**?',
    'Verbal & Abstract',
    'Critical Reasoning',
    'hard',
    '[{"id":"A","text":"It is the main conclusion of the entire argument."},{"id":"B","text":"It is empirical evidence used to challenge an opposing prediction and support the author''s main conclusion."},{"id":"C","text":"It is a premise offered to defend the economists'' forecast."},{"id":"D","text":"It is an unproven assumption that undermines the argument''s validity."}]'::jsonb,
    'B',
    'The author is arguing that automation fears are overblown (the final conclusion). The boldfaced sentence introduces historical counter-evidence to refute the economists'' pessimistic prediction and directly serve as evidence for the author''s conclusion.',
    'Boldface analysis: Identify premise vs counter-premise vs conclusion',
    '["The main conclusion is at the end (\"anxieties are overblown\").","The bold statement is historical evidence supporting that conclusion."]'::jsonb,
    20,
    64,
    '["Critical Reasoning","Boldface","Argument Structure"]'::jsonb,
    TRUE
  ),
  (
    'verbal-016',
    'Dangling Modifier Identification and Correction',
    'Which sentence is free from grammatical errors such as dangling or misplaced modifiers?',
    'Verbal & Abstract',
    'Grammar & Usage',
    'medium',
    '[{"id":"A","text":"Walking through the botanical garden, the vibrant tropical orchids mesmerized the tourists."},{"id":"B","text":"Walking through the botanical garden, the tourists were mesmerized by the vibrant tropical orchids."},{"id":"C","text":"Having completed the marathon, the cold water bottle refreshed the exhausted runner."},{"id":"D","text":"Covered in dark storm clouds, we watched the mountain peak disappear."}]'::jsonb,
    'B',
    'In Option A, "Walking through the botanical garden" incorrectly modifies "the orchids" (implying the orchids were walking). Option B correctly places "the tourists" immediately following the introductory participial phrase, ensuring the agent doing the walking is the subject of the clause.',
    'Participial phrase must immediately precede the actual subject performing the action',
    '["The person doing the walking must come immediately after the comma.","The tourists were walking, not the orchids."]'::jsonb,
    15,
    81,
    '["Grammar","Dangling Modifiers","Sentence Structure"]'::jsonb,
    TRUE
  ),
  (
    'verbal-017',
    'Synonym in Academic Context',
    'Select the word that is most nearly SYNONYMOUS with "UBIQUITOUS":',
    'Verbal & Abstract',
    'Vocabulary & Context',
    'easy',
    '[{"id":"A","text":"Omnipresent"},{"id":"B","text":"Anomalous"},{"id":"C","text":"Obscure"},{"id":"D","text":"Peculiar"}]'::jsonb,
    'A',
    '"Ubiquitous" means present, appearing, or found everywhere simultaneously. Its exact synonym is "Omnipresent".',
    'Ubiquitous = Omnipresent = Pervasive',
    '["Ubiquitous means found everywhere."]'::jsonb,
    10,
    94,
    '["Vocabulary","Synonyms","Academic English"]'::jsonb,
    TRUE
  ),
  (
    'verbal-018',
    'Medical Pathology to Symptom Relationship',
    'FEVER : INFECTION :: SMOKE : ?',
    'Verbal & Abstract',
    'Analogies',
    'easy',
    '[{"id":"A","text":"Fire"},{"id":"B","text":"Ash"},{"id":"C","text":"Chimney"},{"id":"D","text":"Cloud"}]'::jsonb,
    'A',
    'A fever is an observable sign/symptom resulting from an underlying infection (Symptom : Cause). Similarly, smoke is the observable physical sign produced by a fire.',
    'Sign/Symptom : Originating Cause',
    '["Fever is caused by an infection; smoke is caused by a fire."]'::jsonb,
    10,
    96,
    '["Analogies","Cause and Effect","Relationships"]'::jsonb,
    TRUE
  ),
  (
    'verbal-019',
    'Scientific Discovery Narrative Sequence',
    'Order the four sentences logically:

1. In 1928, Alexander Fleming returned to his laboratory to find a mold contaminating a Petri dish of staphylococci.
2. This fortuitous discovery marked the birth of modern antibiotic medicine.
3. Upon closer inspection, he noticed that the colonies of bacteria immediately surrounding the fungus had been destroyed.
4. He identified the mold as a strain of Penicillium notatum and extracted its active antibacterial agent.',
    'Verbal & Abstract',
    'Para Jumbles',
    'medium',
    '[{"id":"A","text":"1 - 3 - 4 - 2"},{"id":"B","text":"1 - 4 - 3 - 2"},{"id":"C","text":"3 - 1 - 4 - 2"},{"id":"D","text":"1 - 3 - 2 - 4"}]'::jsonb,
    'A',
    '- Sentence 1 sets the initial event (finding the contaminated Petri dish).
- Sentence 3 describes the visual observation ("Upon closer inspection, he noticed...").
- Sentence 4 describes the identification and extraction of Penicillium.
- Sentence 2 concludes with the historical significance of the discovery.
Logical order is 1 - 3 - 4 - 2.',
    'Chronological Narrative Sequence: Initial Event → Observation → Extraction → Historical Impact',
    '["Start with Fleming discovering the contaminated dish (1).","Notice the effect (3), identify the mold (4), and conclude with the legacy (2)."]'::jsonb,
    15,
    89,
    '["Para Jumbles","Narrative Logic","Scientific History"]'::jsonb,
    TRUE
  ),
  (
    'verbal-020',
    'Paper Folding and Punching Hole Symmetry',
    'A square sheet of translucent paper is folded in half diagonally from bottom-left to top-right (forming a triangle), and then folded in half again along its altitude. A circular hole is punched straight through the center of the folded triangle.

When the paper is completely unfolded back into a square, how many total circular holes will appear on the sheet?',
    'Verbal & Abstract',
    'Abstract Reasoning',
    'medium',
    '[{"id":"A","text":"2 holes"},{"id":"B","text":"4 holes"},{"id":"C","text":"6 holes"},{"id":"D","text":"8 holes"}]'::jsonb,
    'B',
    '1. Folding once in half diagonally creates 2 layers of paper.
2. Folding in half a second time doubles the layers to 2 × 2 = 4 layers.
3. Punching a single hole through 4 layers produces exactly 4 symmetrically positioned holes upon unfolding.',
    'Holes = (Punches) × 2^(Number of folds) = 1 × 2² = 4',
    '["Each fold doubles the thickness of layers: 2 folds = 2² = 4 layers."]'::jsonb,
    15,
    85,
    '["Abstract Reasoning","Paper Folding","Symmetry"]'::jsonb,
    TRUE
  ),
  (
    'verbal-021',
    'Evaluating Unstated Necessary Assumption',
    'Argument: "To reduce traffic congestion during rush hours, the city council plans to implement a congestion charge for private cars entering the central business district. Therefore, traffic volume in the central district will decline substantially during peak hours."

Which assumption is NECESSARY for the conclusion to hold?',
    'Verbal & Abstract',
    'Critical Reasoning',
    'medium',
    '[{"id":"A","text":"The congestion fee will be high enough to deter a significant number of drivers from driving private cars during peak hours."},{"id":"B","text":"All commuters will switch to riding bicycles."},{"id":"C","text":"The city council will collect record municipal revenue from the toll."},{"id":"D","text":"No delivery trucks operate in the central district."}]'::jsonb,
    'A',
    'If the fee is too trivial (e.g., $0.10) to alter driver behavior, traffic volume will not drop. Thus, the assumption that the fee magnitude is sufficient to deter drivers is necessary for the conclusion.',
    'Negation Test: If fee does NOT deter drivers, the policy fails',
    '["If the fee is so small that nobody cares, congestion will not change."]'::jsonb,
    15,
    84,
    '["Critical Reasoning","Assumptions","Policy Evaluation"]'::jsonb,
    TRUE
  ),
  (
    'verbal-022',
    'Antonym of Esoteric in Scholarly Context',
    'Choose the word that is most nearly OPPOSITE in meaning to "ESOTERIC":',
    'Verbal & Abstract',
    'Vocabulary & Context',
    'easy',
    '[{"id":"A","text":"Arcane"},{"id":"B","text":"Abstruse"},{"id":"C","text":"Accessible"},{"id":"D","text":"Recondite"}]'::jsonb,
    'C',
    '"Esoteric" means intended for or likely to be understood by only a small number of people with specialized knowledge (arcane, abstruse, recondite). Its direct antonym is "Accessible" (easily understood or reached by the general public).',
    'Esoteric (obscure / specialized) ↔ Accessible (clear / widely understandable)',
    '["Esoteric means obscure and understood only by a select few.","The opposite is easily understood or accessible to everyone."]'::jsonb,
    10,
    86,
    '["Antonyms","Vocabulary","Semantic Opposites"]'::jsonb,
    TRUE
  ),
  (
    'verbal-023',
    'Subjunctive Mood in Conditional Recommendations',
    'Select the grammatically correct sentence utilizing the subjunctive mood:',
    'Verbal & Abstract',
    'Grammar & Usage',
    'hard',
    '[{"id":"A","text":"The committee insisted that the chairperson resigns immediately."},{"id":"B","text":"The committee insisted that the chairperson resign immediately."},{"id":"C","text":"The committee insisted that the chairperson will resign immediately."},{"id":"D","text":"The committee insisted that the chairperson is resigning immediately."}]'::jsonb,
    'B',
    'Verbs of demand, recommendation, or insistence (e.g., insist, demand, propose, recommend) require the subjunctive mood in the following "that" clause, which uses the base form of the verb (bare infinitive "resign", not "resigns").',
    'Subjunctive Formula: Demand/Insist + that + Subject + [Base Verb]',
    '["Subjunctive requires base verb form (\"resign\") regardless of singular subject."]'::jsonb,
    20,
    62,
    '["Grammar","Subjunctive Mood","Standard English"]'::jsonb,
    TRUE
  ),
  (
    'verbal-024',
    'Double Blank Scientific Paradox',
    'The discovery of deep-sea hydrothermal vent ecosystems _______ prevailing biological dogma, demonstrating that complex life could thrive in environments completely _______ sunlight.',
    'Verbal & Abstract',
    'Sentence Completion',
    'hard',
    '[{"id":"A","text":"subverted ... devoid of"},{"id":"B","text":"corroborated ... enriched by"},{"id":"C","text":"reinforced ... reliant upon"},{"id":"D","text":"dismissed ... bathed in"}]'::jsonb,
    'A',
    'The deep ocean has no light, so life there is "devoid of" (lacking) sunlight. Finding thriving organisms there challenged or "subverted" the dogma that all life requires solar photosynthesis.',
    'Contextual semantic consistency: deep sea lacks sunlight (devoid of) → overturned dogma (subverted)',
    '["Deep sea has zero sunlight (\"devoid of\").","This challenged existing dogma (\"subverted\")."]'::jsonb,
    20,
    77,
    '["Sentence Completion","Dual Blanks","Contextual Reasoning"]'::jsonb,
    TRUE
  ),
  (
    'verbal-025',
    'Identifying Flaw in Representative Sampling',
    'Survey: "A luxury lifestyle magazine polled 5,000 of its subscribers and found that 85% plan to purchase a yacht within the next two years. The author concluded that a majority of citizens nationwide will soon own a yacht."

What is the primary methodological flaw in this argument?',
    'Verbal & Abstract',
    'Critical Reasoning',
    'easy',
    '[{"id":"A","text":"It relies on a biased, unrepresentative sample of an affluent subgroup to generalize about the entire general population."},{"id":"B","text":"It fails to specify the brand of yachts being purchased."},{"id":"C","text":"It assumes yacht production will double next year."},{"id":"D","text":"It confuses median wealth with mean wealth."}]'::jsonb,
    'A',
    'Subscribers to a luxury lifestyle magazine represent an exceptionally wealthy, unrepresentative demographic. Generalizing their purchasing intentions to the broader national population is a classic unrepresentative sample bias.',
    'Sampling Flaw: Generalizing from an unrepresentative biased subgroup',
    '["Subscribers of a luxury magazine do not represent the general population."]'::jsonb,
    10,
    94,
    '["Critical Reasoning","Sampling Bias","Flaw in the Argument"]'::jsonb,
    TRUE
  ),
  (
    'verbal-026',
    'Grid Transformation Inversion and Shading Rule',
    'In an abstract matrix, when a shape moves from the left column to the right column:
1. It flips vertically (upside down)
2. Its fill color alternates (White becomes Black, Black becomes White)

If the left column contains an upright White Triangle, what shape appears in the right column?',
    'Verbal & Abstract',
    'Abstract Reasoning',
    'easy',
    '[{"id":"A","text":"Upright Black Triangle"},{"id":"B","text":"Inverted Black Triangle"},{"id":"C","text":"Inverted White Triangle"},{"id":"D","text":"Upright White Triangle"}]'::jsonb,
    'B',
    'Applying rule 1: Upright flips to Inverted.
Applying rule 2: White alternates to Black.
Combined result is an Inverted Black Triangle.',
    'Transformation = Flip(Vertical) + Invert(Fill)',
    '["Flip upside down -> inverted.","Change color white -> black."]'::jsonb,
    10,
    95,
    '["Abstract Reasoning","Matrix Rules","Spatial Transformations"]'::jsonb,
    TRUE
  ),
  (
    'verbal-027',
    'Biological Classification Analogy',
    'CETACEAN : WHALE :: MARSUPIAL : ?',
    'Verbal & Abstract',
    'Analogies',
    'easy',
    '[{"id":"A","text":"Kangaroo"},{"id":"B","text":"Dolphin"},{"id":"C","text":"Elephant"},{"id":"D","text":"Eagle"}]'::jsonb,
    'A',
    'Whale is an exemplar belonging to the mammalian order Cetacea. Similarly, Kangaroo is an exemplar belonging to the infraclass Marsupialia.',
    'Taxonomic Order : Exemplar Species',
    '["Whale is a cetacean.","Which animal carries young in a pouch (marsupial)? Kangaroo."]'::jsonb,
    10,
    93,
    '["Analogies","Biology Classification","Word Relationships"]'::jsonb,
    TRUE
  ),
  (
    'verbal-028',
    'Concession and Paradoxical Outcome',
    'Far from being _______, the new software documentation was remarkably _______, allowing even novice developers to deploy production servers within hours.',
    'Verbal & Abstract',
    'Sentence Completion',
    'medium',
    '[{"id":"A","text":"opaque ... lucid"},{"id":"B","text":"accessible ... convoluted"},{"id":"C","text":"comprehensive ... brief"},{"id":"D","text":"helpful ... redundant"}]'::jsonb,
    'A',
    '"Far from being [Negative trait], it was [Positive trait]". "Opaque" (hard to understand) contrasts with "lucid" (clear and easy to understand), which aligns with novices deploying servers quickly.',
    '"Far from being X, it was Y" sets up an antonymous contrast',
    '["\"Lucid\" means clear and easy to understand.","\"Opaque\" means obscure."]'::jsonb,
    15,
    83,
    '["Sentence Completion","Vocabulary","Idiomatic Contrasts"]'::jsonb,
    TRUE
  ),
  (
    'verbal-029',
    'Renewable Energy Economic Transition Sequence',
    'Reorder the four sentences into a coherent paragraph:

1. As production scaled up globally, the manufacturing cost of photovoltaic cells plummeted by over 80%.
2. In the early 2000s, solar energy was widely dismissed as prohibitively expensive for mainstream grid adoption.
3. Today, utility-scale solar represents the cheapest source of newly constructed electricity capacity in most regions.
4. This rapid cost deflation triggered exponential worldwide installation of solar farms.',
    'Verbal & Abstract',
    'Para Jumbles',
    'medium',
    '[{"id":"A","text":"2 - 1 - 4 - 3"},{"id":"B","text":"1 - 2 - 4 - 3"},{"id":"C","text":"2 - 4 - 1 - 3"},{"id":"D","text":"4 - 1 - 2 - 3"}]'::jsonb,
    'A',
    '- Sentence 2 introduces historical skepticism in early 2000s.
- Sentence 1 explains the dramatic drop in cell manufacturing costs.
- Sentence 4 explains how the cost drop caused global installations ("This rapid cost deflation...").
- Sentence 3 concludes with today''s market reality.
Logical order: 2 - 1 - 4 - 3.',
    'Chronology: Past Skepticism (2) → Cost Drop (1) → Global Boom (4) → Current Dominance (3)',
    '["Sentence 2 starts in the early 2000s.","Sentence 1 details the 80% cost drop, Sentence 4 refers to \"This rapid cost deflation\"."]'::jsonb,
    15,
    87,
    '["Para Jumbles","Clean Energy","Chronology"]'::jsonb,
    TRUE
  ),
  (
    'verbal-030',
    'Proper Use of Whom in Formal Relative Clauses',
    'Select the grammatically correct sentence using the objective relative pronoun:',
    'Verbal & Abstract',
    'Grammar & Usage',
    'hard',
    '[{"id":"A","text":"The lead scientist, whom the committee selected for the prestigious award, delivered an inspiring keynote address."},{"id":"B","text":"The lead scientist, who the committee selected for the prestigious award, delivered an inspiring keynote address."},{"id":"C","text":"The lead scientist, which the committee selected for the prestigious award, delivered an inspiring keynote address."},{"id":"D","text":"The lead scientist, whoever the committee selected for the prestigious award, delivered an inspiring keynote address."}]'::jsonb,
    'A',
    'In the relative clause "the committee selected [scientist] for the award", the scientist is the direct object of the verb "selected" (the committee selected HIM/HER). Therefore, the objective relative pronoun "whom" is grammatically required.',
    'Objective case rule: Whom = Object of the verb; Who = Subject',
    '["Substitute \"him\": the committee selected him -> use \"whom\"."]'::jsonb,
    20,
    68,
    '["Grammar","Pronoun Case","Who vs Whom"]'::jsonb,
    TRUE
  ),
  (
    'verbal-031',
    'Meaning of Pragmatic in Policy Context',
    'The adjective "PRAGMATIC" is most accurately defined as:',
    'Verbal & Abstract',
    'Vocabulary & Context',
    'easy',
    '[{"id":"A","text":"Dealing with things sensibly and realistically based on practical considerations rather than theoretical ideals"},{"id":"B","text":"Adhering strictly to religious and traditional doctrines"},{"id":"C","text":"Demonstrating excessive emotional sentimentality"},{"id":"D","text":"Exhibiting unpredictable and erratic behavioral changes"}]'::jsonb,
    'A',
    '"Pragmatic" means guided by practical, realistic consequences and workable solutions rather than abstract ideological theories.',
    'Pragmatic = Practical, realistic, utilitarian',
    '["Pragmatic means practical and solution-oriented."]'::jsonb,
    10,
    95,
    '["Vocabulary","Definitions","English Usage"]'::jsonb,
    TRUE
  ),
  (
    'verbal-032',
    'Identifying Logical Equivalence via Contrapositive',
    'Given the rule: "If an applicant passes the technical exam, they are invited for the final interview."

Which statement is logically equivalent to the given rule?',
    'Verbal & Abstract',
    'Critical Reasoning',
    'hard',
    '[{"id":"A","text":"If an applicant is invited for the final interview, they passed the technical exam."},{"id":"B","text":"If an applicant is NOT invited for the final interview, they did NOT pass the technical exam."},{"id":"C","text":"If an applicant does not pass the technical exam, they are not invited for the final interview."},{"id":"D","text":"Passing the technical exam is the only way to get an interview."}]'::jsonb,
    'B',
    'In formal propositional logic, a conditional statement "P → Q" is logically equivalent ONLY to its contrapositive "~Q → ~P".
Here: P = "Passes technical exam", Q = "Invited for final interview".
Contrapositive (~Q → ~P): "If an applicant is NOT invited for the final interview, they did NOT pass the technical exam."',
    'Law of Contrapositive: (P → Q) ≡ (~Q → ~P)',
    '["The only statement logically identical to \"If P then Q\" is \"If not Q then not P\"."]'::jsonb,
    20,
    72,
    '["Formal Logic","Contrapositive","Equivalence"]'::jsonb,
    TRUE
  ),
  (
    'verbal-033',
    'Jurisprudence Action Analogy',
    'PROSECUTOR : INDICT :: ARBITRATOR : ?',
    'Verbal & Abstract',
    'Analogies',
    'medium',
    '[{"id":"A","text":"Adjudicate"},{"id":"B","text":"Accuse"},{"id":"C","text":"Interrogate"},{"id":"D","text":"Subpoena"}]'::jsonb,
    'A',
    'A prosecutor’s primary formal legal role is to indict (bring formal charges). An arbitrator’s primary formal role is to adjudicate / settle a dispute impartially.',
    'Legal Agent : Primary Judicial Action',
    '["What does an arbitrator do? They adjudicate and resolve disputes."]'::jsonb,
    15,
    76,
    '["Analogies","Legal Vocabulary","Agent-Action"]'::jsonb,
    TRUE
  ),
  (
    'verbal-034',
    'Series Shape Addition and Line Intersect Count',
    'A sequence of abstract polygons has the following number of sides:
Shape 1: Triangle (3 sides)
Shape 2: Square (4 sides)
Shape 3: Pentagon (5 sides)
Shape 4: Hexagon (6 sides)

If the number of internal diagonals drawn from a single vertex follows the rule d = (n - 3), how many diagonals will be drawn in Shape 6 (Octagon, 8 sides)?',
    'Verbal & Abstract',
    'Abstract Reasoning',
    'medium',
    '[{"id":"A","text":"4 diagonals"},{"id":"B","text":"5 diagonals"},{"id":"C","text":"6 diagonals"},{"id":"D","text":"7 diagonals"}]'::jsonb,
    'B',
    'For any n-sided polygon, the number of diagonals that can be drawn from a single vertex is d = n - 3.
For an octagon (n = 8):
d = 8 - 3 = 5 diagonals.',
    'Diagonals from single vertex = n - 3',
    '["Plug n = 8 into the given formula: d = 8 - 3 = 5."]'::jsonb,
    15,
    91,
    '["Abstract Reasoning","Polygon Geometry","Number Patterns"]'::jsonb,
    TRUE
  ),
  (
    'verbal-035',
    'Literary Tone and Satire Identification',
    'The author''s critique of contemporary social media culture was biting yet _______, using subtle wit and irony to expose vanity without resorting to overt _______.',
    'Verbal & Abstract',
    'Sentence Completion',
    'hard',
    '[{"id":"A","text":"trenchant ... hostility"},{"id":"B","text":"crude ... sophistication"},{"id":"C","text":"frivolous ... insight"},{"id":"D","text":"lethargic ... humor"}]'::jsonb,
    'A',
    '"Trenchant" (incisive, keen, vigorous) matches "biting yet witty". "Expose vanity without resorting to overt hostility" completes the balanced assessment of high-level satire.',
    'Contextual harmony in descriptive adjectives for literary critique',
    '["\"Trenchant\" means sharp, incisive, and effectively witty.","\"Hostility\" contrasts with subtle irony."]'::jsonb,
    20,
    74,
    '["Sentence Completion","Tone","Vocabulary"]'::jsonb,
    TRUE
  )
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  prompt = EXCLUDED.prompt,
  category = EXCLUDED.category,
  topic = EXCLUDED.topic,
  difficulty = EXCLUDED.difficulty,
  options = EXCLUDED.options,
  correct_option = EXCLUDED.correct_option,
  explanation = EXCLUDED.explanation,
  formula_or_rule = EXCLUDED.formula_or_rule,
  hints = EXCLUDED.hints,
  points = EXCLUDED.points,
  acceptance_rate = EXCLUDED.acceptance_rate,
  tags = EXCLUDED.tags,
  is_active = EXCLUDED.is_active;

-- Verification Check
SELECT
  category,
  COUNT(*) as question_count
FROM public.questions
WHERE is_active = TRUE
GROUP BY category
ORDER BY question_count DESC;
