-- ==============================================================================
-- MODULE 2: DYNAMIC QUESTION ENGINE & USER PROGRESS TRACKING
-- Database-driven question pool, indexes, RLS policies, and 24 question seeding
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
  acceptance_rate INT DEFAULT 0,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create performance indexes for scalable filtering
CREATE INDEX IF NOT EXISTS idx_questions_category ON public.questions(category);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON public.questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON public.questions(topic);
CREATE INDEX IF NOT EXISTS idx_questions_is_active ON public.questions(is_active);
CREATE INDEX IF NOT EXISTS idx_questions_category_difficulty ON public.questions(category, difficulty);

-- 3. Enable RLS on questions
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- 4. Questions RLS: Everyone (anon and authenticated) can view active questions
DROP POLICY IF EXISTS "Active questions are viewable by everyone" ON public.questions;
CREATE POLICY "Active questions are viewable by everyone"
  ON public.questions FOR SELECT
  USING (is_active = TRUE);

-- 5. Create / Ensure user_question_progress table
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

-- 6. Indexes on user_question_progress
CREATE INDEX IF NOT EXISTS idx_user_question_progress_user ON public.user_question_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_question_progress_bookmarked ON public.user_question_progress(user_id, is_bookmarked);
CREATE INDEX IF NOT EXISTS idx_user_question_progress_solved ON public.user_question_progress(user_id, is_solved);

-- 7. Enable RLS on user_question_progress
ALTER TABLE public.user_question_progress ENABLE ROW LEVEL SECURITY;

-- 8. Progress RLS: Users can only select, insert, update, or delete their own progress
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

-- ==============================================================================
-- SEED INITIAL 24 QUESTIONS INTO DATABASE (IDEMPOTENT UPSERT)
-- ==============================================================================

INSERT INTO public.questions (
  id, title, prompt, category, topic, difficulty, options, correct_option, explanation, formula_or_rule, hints, points, acceptance_rate, tags, is_active
) VALUES
-- 1. quant-001
(
  'quant-001',
  'Successive Percentage Changes in Price',
  'The price of an item is first increased by 20% and then subsequently decreased by 20%. What is the net change in the price of the item compared to its original price?',
  'Quantitative Aptitude',
  'Percentages',
  'easy',
  '[{"id":"A","text":"0% (No change)"},{"id":"B","text":"4% decrease"},{"id":"C","text":"4% increase"},{"id":"D","text":"2.5% decrease"}]'::jsonb,
  'B',
  'Let original price = $100.\nAfter 20% increase: $100 + $20 = $120.\nAfter 20% decrease on $120: $120 - (0.20 × 120) = $120 - $24 = $96.\nNet change = ($96 - $100) / $100 × 100% = -4% (a 4% decrease).',
  'Net Change = a + b + (a × b)/100 = 20 - 20 + (20 × -20)/100 = -400/100 = -4%',
  '["Assume original price is 100.","The second percentage change applies to the new increased value, not the original 100."]'::jsonb,
  10,
  88,
  '["Percentages","Arithmetic","Successive Change"]'::jsonb,
  TRUE
),
-- 2. quant-002
(
  'quant-002',
  'Combined Work Rate of Two Individuals',
  'Alice can complete a task in 12 days, and Bob can complete the same task in 18 days. If they work together, in how many days will the entire task be completed?',
  'Quantitative Aptitude',
  'Time & Work',
  'easy',
  '[{"id":"A","text":"6.5 days"},{"id":"B","text":"7.2 days"},{"id":"C","text":"8.0 days"},{"id":"D","text":"15.0 days"}]'::jsonb,
  'B',
  'Work done by Alice in 1 day = 1/12.\nWork done by Bob in 1 day = 1/18.\nCombined 1-day work = 1/12 + 1/18 = (3 + 2)/36 = 5/36.\nTotal days required = 36/5 = 7.2 days.',
  'Total Days = (A × B) / (A + B) = (12 × 18) / (12 + 18) = 216 / 30 = 7.2 days',
  '["Find the fraction of work each person finishes in one day.","Add their 1-day work rates together."]'::jsonb,
  10,
  82,
  '["Time & Work","Arithmetic","Efficiency"]'::jsonb,
  TRUE
),
-- 3. quant-003
(
  'quant-003',
  'Relative Speed of Trains Crossing in Opposite Directions',
  'Two trains 140 m and 160 m long are running towards each other on parallel tracks at speeds of 60 km/h and 48 km/h respectively. In how much time (in seconds) will they completely cross each other from the moment they meet?',
  'Quantitative Aptitude',
  'Speed, Distance & Time',
  'medium',
  '[{"id":"A","text":"8 seconds"},{"id":"B","text":"10 seconds"},{"id":"C","text":"12 seconds"},{"id":"D","text":"14 seconds"}]'::jsonb,
  'B',
  'Total distance to cover = Sum of train lengths = 140 m + 160 m = 300 m.\nRelative speed (opposite direction) = 60 + 48 = 108 km/h.\nConvert relative speed to m/s: 108 × (5/18) = 6 × 5 = 30 m/s.\nTime taken = Distance / Relative Speed = 300 / 30 = 10 seconds.',
  'Time = (Length1 + Length2) / (Speed1 + Speed2 in m/s)',
  '["Add their lengths to get total distance.","When moving in opposite directions, relative speed is the sum of their speeds."]'::jsonb,
  15,
  64,
  '["Trains","Relative Speed","Distance"]'::jsonb,
  TRUE
),
-- 4. quant-004
(
  'quant-004',
  'Selling Price with Desired Profit Percentage',
  'A shopkeeper sells an article at $840 after offering a discount of 20% on the marked price. If the cost price was $600, what is the profit percentage earned by the shopkeeper?',
  'Quantitative Aptitude',
  'Profit & Loss',
  'easy',
  '[{"id":"A","text":"35%"},{"id":"B","text":"40%"},{"id":"C","text":"42.5%"},{"id":"D","text":"50%"}]'::jsonb,
  'B',
  'Cost Price (CP) = $600.\nSelling Price (SP) = $840.\nProfit = SP - CP = $840 - $600 = $240.\nProfit Percentage = (Profit / CP) × 100% = (240 / 600) × 100% = 40%.\n(Note: The discount value is already reflected in the given Selling Price).',
  'Profit % = [(SP - CP) / CP] × 100',
  '["Calculate profit directly from SP and CP.","Profit % is always calculated with respect to Cost Price (CP)."]'::jsonb,
  10,
  79,
  '["Profit & Loss","Discount","Commercial Math"]'::jsonb,
  TRUE
),
-- 5. quant-005
(
  'quant-005',
  'Forming Committees with Constraints',
  'In how many ways can a committee of 4 people be chosen from a group of 5 men and 4 women such that the committee contains at least 2 women?',
  'Quantitative Aptitude',
  'Permutations & Combinations',
  'hard',
  '[{"id":"A","text":"65 ways"},{"id":"B","text":"75 ways"},{"id":"C","text":"81 ways"},{"id":"D","text":"105 ways"}]'::jsonb,
  'C',
  'Possible combinations with at least 2 women in a committee of 4:\n1. 2 Women & 2 Men: ⁴C₂ × ⁵C₂ = 6 × 10 = 60\n2. 3 Women & 1 Man: ⁴C₃ × ⁵C₁ = 4 × 5 = 20\n3. 4 Women & 0 Men: ⁴C₄ × ⁵C₀ = 1 × 1 = 1\nTotal Ways = 60 + 20 + 1 = 81 ways.',
  'Total = C(4,2)×C(5,2) + C(4,3)×C(5,1) + C(4,4)×C(5,0) = 60 + 20 + 1 = 81',
  '["Break down into mutually exclusive cases: 2 women, 3 women, and 4 women.","Use combination formula nCr = n! / (r!(n-r)!)."]'::jsonb,
  20,
  46,
  '["Combinatorics","Probability","Counting"]'::jsonb,
  TRUE
),
-- 6. quant-006
(
  'quant-006',
  'Two Dice Sum Divisible by 4 or 5',
  'When two standard 6-sided fair dice are rolled simultaneously, what is the probability that the sum of the numbers appearing on top is divisible by either 4 or 5?',
  'Quantitative Aptitude',
  'Probability',
  'medium',
  '[{"id":"A","text":"7/18"},{"id":"B","text":"4/9"},{"id":"C","text":"1/2"},{"id":"D","text":"17/36"}]'::jsonb,
  'B',
  'Total outcomes when rolling 2 dice = 6 × 6 = 36.\nPossible sums: 2 to 12.\nSums divisible by 4: {4, 8, 12}\n- Sum = 4: (1,3), (2,2), (3,1) → 3 pairs\n- Sum = 8: (2,6), (3,5), (4,4), (5,3), (6,2) → 5 pairs\n- Sum = 12: (6,6) → 1 pair\nTotal for div by 4 = 9 pairs.\n\nSums divisible by 5: {5, 10}\n- Sum = 5: (1,4), (2,3), (3,2), (4,1) → 4 pairs\n- Sum = 10: (4,6), (5,5), (6,4) → 3 pairs\nTotal for div by 5 = 7 pairs.\n\nNo sum between 2 and 12 is divisible by both 4 and 5 (would need to be 20).\nTotal favorable outcomes = 9 + 7 = 16 pairs = 16/36 = 4/9.',
  'P(A ∪ B) = P(A) + P(B) - P(A ∩ B) = 9/36 + 7/36 - 0 = 16/36 = 4/9',
  '["List all pairs giving sums 4, 8, 12 and sums 5, 10.","Check if any sum between 2 and 12 is divisible by both 4 and 5."]'::jsonb,
  15,
  59,
  '["Probability","Dice","Number Theory"]'::jsonb,
  TRUE
),
-- 7. quant-007
(
  'quant-007',
  'Difference Between Compound and Simple Interest for 2 Years',
  'The difference between the Compound Interest (compounded annually) and Simple Interest on a certain sum of money for 2 years at 8% per annum is $48. Find the principal sum.',
  'Quantitative Aptitude',
  'Compound Interest',
  'medium',
  '[{"id":"A","text":"$6,500"},{"id":"B","text":"$7,200"},{"id":"C","text":"$7,500"},{"id":"D","text":"$8,000"}]'::jsonb,
  'C',
  'For 2 years, the difference between CI and SI is given by: Diff = P × (R/100)².\nHere, Diff = $48, R = 8%.\n48 = P × (8/100)²\n48 = P × (64 / 10000)\nP = (48 × 10000) / 64 = (3 × 10000) / 4 = $7,500.',
  'Difference (2 years) = P × (R/100)²',
  '["Use the direct 2-year shortcut formula: Difference = P(R/100)²","Substitute R = 8 and Difference = 48."]'::jsonb,
  15,
  67,
  '["Interest","Banking Math","Formula Shortcuts"]'::jsonb,
  TRUE
),
-- 8. quant-008
(
  'quant-008',
  'Remainder of High Powers',
  'What is the remainder when 3²⁰²⁴ is divided by 7?',
  'Quantitative Aptitude',
  'Number Systems',
  'hard',
  '[{"id":"A","text":"1"},{"id":"B","text":"2"},{"id":"C","text":"4"},{"id":"D","text":"6"}]'::jsonb,
  'B',
  'We find the cyclicity of powers of 3 modulo 7:\n3¹ ≡ 3 (mod 7)\n3² ≡ 9 ≡ 2 (mod 7)\n3³ ≡ 6 ≡ -1 (mod 7)\n3⁶ ≡ 1 (mod 7) [Fermat’s Little Theorem: 3⁶ ≡ 1 mod 7]\n\nNow divide 2024 by 6:\n2024 = 6 × 337 + 2 (remainder is 2).\nTherefore, 3²⁰²⁴ ≡ (3⁶)³³⁷ × 3² ≡ (1)³³⁷ × 9 ≡ 1 × 2 = 2 (mod 7).',
  'By Fermat’s Little Theorem, a^(p-1) ≡ 1 (mod p) for prime p.',
  '["Notice that 3⁶ ≡ 1 (mod 7).","Divide the exponent 2024 by 6 to find the remaining power."]'::jsonb,
  20,
  41,
  '["Number Systems","Modular Arithmetic","Remainders"]'::jsonb,
  TRUE
),
-- 9. quant-009
(
  'quant-009',
  'Alloy Mixture Ratio Replacement',
  'An alloy contains copper and zinc in the ratio 7 : 3. If 6 kg of zinc is added to 40 kg of this alloy, what will be the new ratio of copper to zinc in the resulting alloy?',
  'Quantitative Aptitude',
  'Ratio & Proportion',
  'easy',
  '[{"id":"A","text":"7 : 4"},{"id":"B","text":"7 : 5"},{"id":"C","text":"14 : 9"},{"id":"D","text":"3 : 2"}]'::jsonb,
  'C',
  'Total weight of initial alloy = 40 kg.\nInitial ratio = 7 : 3 (Total parts = 10).\nWeight of copper = (7/10) × 40 = 28 kg.\nWeight of zinc = (3/10) × 40 = 12 kg.\nWhen 6 kg of zinc is added: New zinc = 12 + 6 = 18 kg. Copper remains 28 kg.\nNew ratio (Copper : Zinc) = 28 : 18 = 14 : 9.',
  'Copper = (7/10)×40 = 28kg; New Zinc = 12+6 = 18kg; Ratio = 28:18 = 14:9',
  '["Calculate the exact kg of copper and zinc in 40 kg.","Add 6 kg only to the zinc portion."]'::jsonb,
  10,
  85,
  '["Ratios","Mixtures","Alloys"]'::jsonb,
  TRUE
),
-- 10. quant-010
(
  'quant-010',
  'Inscribed Circle in Right-Angled Triangle',
  'A right-angled triangle has sides of length 6 cm, 8 cm, and 10 cm. What is the radius of the incircle (inscribed circle) of this triangle?',
  'Quantitative Aptitude',
  'Geometry & Mensuration',
  'medium',
  '[{"id":"A","text":"1.5 cm"},{"id":"B","text":"2.0 cm"},{"id":"C","text":"2.5 cm"},{"id":"D","text":"3.0 cm"}]'::jsonb,
  'B',
  'For a right triangle with legs a and b and hypotenuse c, the inradius r = (a + b - c) / 2.\nHere, a = 6 cm, b = 8 cm, c = 10 cm.\nr = (6 + 8 - 10) / 2 = 4 / 2 = 2 cm.\nAlternatively, r = Area / Semi-perimeter = (0.5 × 6 × 8) / ((6 + 8 + 10)/2) = 24 / 12 = 2 cm.',
  'Inradius of Right Triangle r = (Perpendicular + Base - Hypotenuse) / 2',
  '["You can use r = Area / Semi-perimeter, or the right triangle inradius formula."]'::jsonb,
  15,
  71,
  '["Geometry","Triangles","Incircle"]'::jsonb,
  TRUE
),
-- 11. lr-001
(
  'lr-001',
  'Family Lineage Identification',
  'Pointing to a photograph of a man, Rahul said, "His mother is the only daughter of my mother." How is Rahul related to the man in the photograph?',
  'Logical Reasoning',
  'Blood Relations',
  'easy',
  '[{"id":"A","text":"Father"},{"id":"B","text":"Brother"},{"id":"C","text":"Maternal Uncle"},{"id":"D","text":"Grandfather"}]'::jsonb,
  'C',
  '\"My mother''s only daughter\" means Rahul''s sister (since Rahul is male, his mother''s only daughter is Rahul''s sister).\nTherefore, the man''s mother is Rahul''s sister.\nSince the man is the son of Rahul''s sister, Rahul is his maternal uncle.',
  'Only daughter of mother = Sister; Brother of mother = Maternal Uncle',
  '["Break down the sentence starting from the end: \"my mother''s only daughter\".","Who is your mother''s only daughter to you?"]'::jsonb,
  10,
  89,
  '["Blood Relations","Family Tree","Deduction"]'::jsonb,
  TRUE
),
-- 12. lr-002
(
  'lr-002',
  'Deductive Syllogism Conclusions',
  'Statements:\n1. All cars are vehicles.\n2. Some vehicles are electric.\n\nConclusions:\nI. Some cars are electric.\nII. Some vehicles are cars.\n\nWhich of the conclusion(s) logically follow?',
  'Logical Reasoning',
  'Syllogisms',
  'medium',
  '[{"id":"A","text":"Only Conclusion I follows"},{"id":"B","text":"Only Conclusion II follows"},{"id":"C","text":"Both I and II follow"},{"id":"D","text":"Neither I nor II follows"}]'::jsonb,
  'B',
  'From statement 1: "All cars are vehicles" implies that some vehicles are definitely cars (Conclusion II is valid).\nStatement 2 tells us that "Some vehicles are electric", but this subset of vehicles might not overlap with the "cars" circle. Thus, "Some cars are electric" is a possibility, not a definite conclusion.\nTherefore, only Conclusion II follows.',
  'All A are B ⇒ Some B are A. Middle term distributed rules apply.',
  '["Draw a Venn diagram for Cars inside Vehicles, and an intersecting circle for Electric.","Does the Electric circle necessarily have to intersect with Cars?"]'::jsonb,
  15,
  63,
  '["Syllogism","Venn Diagrams","Logic"]'::jsonb,
  TRUE
),
-- 13. lr-003
(
  'lr-003',
  'Multi-Step Walking Route & Final Displacement',
  'Rohan walks 20 meters North. Then he turns right and walks 30 meters. Next, he turns right and walks 35 meters. Then he turns left and walks 15 meters. Finally, he turns left and walks 15 meters. How far and in which direction is he from his starting point?',
  'Logical Reasoning',
  'Direction Sense',
  'medium',
  '[{"id":"A","text":"45 meters, East"},{"id":"B","text":"35 meters, East"},{"id":"C","text":"45 meters, North-East"},{"id":"D","text":"50 meters, East"}]'::jsonb,
  'A',
  'Let initial point be (0, 0):\n1. 20m North → (0, 20)\n2. Turn right (East), 30m → (30, 20)\n3. Turn right (South), 35m → (30, -15)\n4. Turn left (East), 15m → (45, -15)\n5. Turn left (North), 15m → (45, 0)\nFinal position is (45, 0), which is exactly 45 meters East of origin (0,0).',
  'X-coordinate: 0 + 30 + 15 = 45m (East); Y-coordinate: 0 + 20 - 35 + 15 = 0m',
  '["Track horizontal (East-West) and vertical (North-South) movements separately.","Notice the net vertical displacement: +20 - 35 + 15 = 0."]'::jsonb,
  15,
  74,
  '["Direction Sense","Displacement","Navigation"]'::jsonb,
  TRUE
),
-- 14. lr-004
(
  'lr-004',
  'Circular Table Facing Center',
  'Six friends (P, Q, R, S, T, U) are sitting around a circular table facing the center.\n- P is sitting opposite S.\n- Q is sitting to the immediate right of P.\n- T is sitting between P and S on the left of P.\n- R is sitting adjacent to S.\nWho is sitting directly opposite to Q?',
  'Logical Reasoning',
  'Seating Arrangement',
  'hard',
  '[{"id":"A","text":"R"},{"id":"B","text":"T"},{"id":"C","text":"U"},{"id":"D","text":"S"}]'::jsonb,
  'A',
  'Arrangement around table of 6 positions (1 to 6 clockwise):\nLet P = Pos 1 (Top).\nS is opposite P → S = Pos 4 (Bottom).\nQ is to immediate right (counter-clockwise or clockwise facing center: right of P facing center is Pos 6).\nT is between P and S on left of P → T = Pos 2.\nR is adjacent to S → R must be Pos 3 or 5. Since Q is at 6, U is at 5, R is at 3.\nPosition opposite Q (Pos 6) in a 6-person circle is Pos 3, which is occupied by R.',
  'In a 6-person circle, opposite seats have an offset of 3 positions.',
  '["Draw a clock with 6 hours: 12, 2, 4, 6, 8, 10.","Opposite of position 1 is 4; opposite of position 2 is 5, etc."]'::jsonb,
  20,
  48,
  '["Seating Arrangement","Puzzles","Circular Table"]'::jsonb,
  TRUE
),
-- 15. lr-005
(
  'lr-005',
  'Pattern Shift Transformation',
  'In a certain code language, if "TRIANGLE" is written as "SQHZMFKD", how will "PENTAGON" be written in that same code language?',
  'Logical Reasoning',
  'Coding-Decoding',
  'easy',
  '[{"id":"A","text":"ODMSZFPM"},{"id":"B","text":"QDOUBHPO"},{"id":"C","text":"ODMSBFNM"},{"id":"D","text":"OFMTAHPM"}]'::jsonb,
  'A',
  'Let us analyze letter by letter:\nT (-1) → S\nR (-1) → Q\nI (-1) → H\nA (-1) → Z\nN (-1) → M\nG (-1) → F\nL (-1) → K\nE (-1) → D\nThe pattern is a simple shift of -1 (previous letter in alphabet) for every character!\n\nApplying -1 to "PENTAGON":\nP (-1) = O\nE (-1) = D\nN (-1) = M\nT (-1) = S\nA (-1) = Z\nG (-1) = F\nO (-1) = N\nN (-1) = M',
  'Letter shift rule: Each character c → char(ascii(c) - 1)',
  '["Compare each letter in TRIANGLE with SQHZMFKD.","Notice T→S, R→Q, I→H are all 1 step backwards."]'::jsonb,
  10,
  91,
  '["Coding Decoding","Patterns","Alphabet"]'::jsonb,
  TRUE
),
-- 16. lr-006
(
  'lr-006',
  'Polynomial & Difference Sequence',
  'Find the next number in the sequence: 7, 14, 30, 56, 93, ?',
  'Logical Reasoning',
  'Series & Patterns',
  'medium',
  '[{"id":"A","text":"142"},{"id":"B","text":"144"},{"id":"C","text":"148"},{"id":"D","text":"152"}]'::jsonb,
  'A',
  'Find the first-level differences between consecutive terms:\n14 - 7 = 7\n30 - 14 = 16\n56 - 30 = 26\n93 - 56 = 37\n\nFind the second-level differences:\n16 - 7 = 9\n26 - 16 = 10\n37 - 26 = 11\n\nThe second-level differences increase by 1 each step (9, 10, 11, 12).\nNext difference = 37 + 12 = 49.\nNext term = 93 + 49 = 142.',
  'Double difference sequence: Δ² = 9, 10, 11, 12 ...',
  '["Calculate the difference between adjacent terms.","Then calculate the difference of those differences."]'::jsonb,
  15,
  68,
  '["Number Series","Differences","Pattern Recognition"]'::jsonb,
  TRUE
),
-- 17. lr-007
(
  'lr-007',
  'Angle Between Clock Hands at 3:40',
  'What is the acute angle (in degrees) between the hour hand and the minute hand of a clock at 3:40 PM?',
  'Logical Reasoning',
  'Clocks & Calendars',
  'medium',
  '[{"id":"A","text":"120°"},{"id":"B","text":"130°"},{"id":"C","text":"135°"},{"id":"D","text":"140°"}]'::jsonb,
  'B',
  'Use the standard clock angle formula:\nAngle = |30H - 5.5M|\nHere, H = 3, M = 40.\nAngle = |30(3) - 5.5(40)| = |90 - 220| = |-130| = 130°.\nSince 130° ≤ 180°, the acute/interior angle is 130°.',
  'Angle = |30 × H - (11/2) × M|',
  '["Minute hand at 40 min is at 240° from 12.","Hour hand moves 0.5° per minute, so at 3:40 it is at 3×30 + 40×0.5 = 110°."]'::jsonb,
  15,
  76,
  '["Clocks","Angles","Geometry"]'::jsonb,
  TRUE
),
-- 18. lr-008
(
  'lr-008',
  'Knight and Knave Truth Teller Problem',
  'On an island, inhabitants are either Knights (who always tell the truth) or Knaves (who always lie). You meet two inhabitants, A and B.\nA says: "At least one of us is a Knave."\nWhat are the true identities of A and B?',
  'Logical Reasoning',
  'Puzzles & Logic Grids',
  'hard',
  '[{"id":"A","text":"Both are Knights"},{"id":"B","text":"A is a Knight and B is a Knave"},{"id":"C","text":"A is a Knave and B is a Knight"},{"id":"D","text":"Both are Knaves"}]'::jsonb,
  'B',
  'Assume A is a Knave (liar):\nIf A lies, the statement "At least one of us is a Knave" is false, which means "Neither is a Knave (Both are Knights)". But that contradicts our assumption that A is a Knave.\nTherefore, A CANNOT be a Knave; A must be a Knight (truth-teller).\nSince A speaks the truth, "At least one of us is a Knave" is true.\nSince A is a Knight, B MUST be the Knave.\nThus: A is a Knight, B is a Knave.',
  'Proof by contradiction: Assume A=Knave → contradiction → A=Knight.',
  '["What happens if A is lying?","If A is telling the truth, and A is a Knight, who must be the Knave?"]'::jsonb,
  20,
  52,
  '["Truth Tellers","Knights and Knaves","Mathematical Logic"]'::jsonb,
  TRUE
),
-- 19. di-001
(
  'di-001',
  'Budget Allocation & Expenditure Comparison',
  'A company’s annual expenditure is distributed across departments via a pie chart:\n- R&D: 108°\n- Marketing: 72°\n- Operations: 90°\n- HR & Admin: 54°\n- Logistics: 36°\n\nIf the total annual expenditure is $5,000,000, how much more does the company spend on R&D than on Marketing?',
  'Data Interpretation',
  'Pie Charts',
  'easy',
  '[{"id":"A","text":"$250,000"},{"id":"B","text":"$500,000"},{"id":"C","text":"$750,000"},{"id":"D","text":"$1,000,000"}]'::jsonb,
  'B',
  'Total angle in a pie chart = 360° = $5,000,000.\nDifference in degrees between R&D and Marketing = 108° - 72° = 36°.\nFraction of total budget = 36° / 360° = 1/10.\nDifference in spending = (1/10) × $5,000,000 = $500,000.',
  'Difference = [(Degree1 - Degree2) / 360°] × Total Budget',
  '["Subtract the angles directly before multiplying by the total budget.","36 degrees is exactly 10% of 360 degrees."]'::jsonb,
  10,
  84,
  '["Data Interpretation","Pie Charts","Percentages"]'::jsonb,
  TRUE
),
-- 20. di-002
(
  'di-002',
  'Student Passing Percentage Across 4 Colleges',
  'Consider the performance data below:\n\n• College Alpha: 400 Appeared, 320 Passed\n• College Beta: 500 Appeared, 375 Passed\n• College Gamma: 600 Appeared, 510 Passed\n• College Delta: 450 Appeared, 360 Passed\n\nWhich college recorded the highest passing percentage?',
  'Data Interpretation',
  'Tables & Ratios',
  'easy',
  '[{"id":"A","text":"College Alpha"},{"id":"B","text":"College Beta"},{"id":"C","text":"College Gamma"},{"id":"D","text":"College Delta"}]'::jsonb,
  'C',
  'Calculate passing % for each:\n- Alpha: 320 / 400 = 80.0%\n- Beta: 375 / 500 = 75.0%\n- Gamma: 510 / 600 = 85.0%\n- Delta: 360 / 450 = 80.0%\n\nCollege Gamma has the highest passing rate at 85.0%.',
  'Passing % = (Passed / Appeared) × 100',
  '["Convert each fraction (320/400, 375/500, 510/600, 360/450) into a percentage."]'::jsonb,
  10,
  92,
  '["Data Interpretation","Tables","Percentages"]'::jsonb,
  TRUE
),
-- 21. di-003
(
  'di-003',
  'Compound Growth Rate of Revenue',
  'A software company reports revenue over 3 consecutive years:\n- Year 1: $20 Million\n- Year 2: $26 Million\n- Year 3: $33.8 Million\n\nWhat is the constant year-over-year percentage growth rate of the company’s revenue?',
  'Data Interpretation',
  'Bar Graphs & Growth Rates',
  'medium',
  '[{"id":"A","text":"25%"},{"id":"B","text":"28%"},{"id":"C","text":"30%"},{"id":"D","text":"35%"}]'::jsonb,
  'C',
  'Growth from Year 1 to Year 2: (26 - 20) / 20 = 6 / 20 = 30%.\nGrowth from Year 2 to Year 3: (33.8 - 26) / 26 = 7.8 / 26 = 30%.\nThe constant annual growth rate is exactly 30%.',
  'Growth Rate % = [(Revenue_(t) - Revenue_(t-1)) / Revenue_(t-1)] × 100',
  '["Find the percentage increase from Year 1 (20M) to Year 2 (26M)."]'::jsonb,
  15,
  78,
  '["Growth Rates","Bar Charts","Business Math"]'::jsonb,
  TRUE
),
-- 22. di-004
(
  'di-004',
  'Three-Set Venn Diagram Consumer Survey',
  'In a survey of 200 consumers regarding three smartphone brands (A, B, and C):\n- 90 like Brand A\n- 80 like Brand B\n- 70 like Brand C\n- 30 like both A and B\n- 25 like both B and C\n- 20 like both A and C\n- 10 like all three brands\n\nHow many consumers surveyed do NOT like any of the three brands?',
  'Data Interpretation',
  'Caselets & Set Theory',
  'hard',
  '[{"id":"A","text":"15"},{"id":"B","text":"25"},{"id":"C","text":"35"},{"id":"D","text":"40"}]'::jsonb,
  'B',
  'By the Principle of Inclusion-Exclusion for 3 sets:\n|A ∪ B ∪ C| = |A| + |B| + |C| - |A ∩ B| - |B ∩ C| - |A ∩ C| + |A ∩ B ∩ C|\n|A ∪ B ∪ C| = 90 + 80 + 70 - 30 - 25 - 20 + 10\n= 240 - 75 + 10 = 175 consumers like at least one brand.\n\nConsumers who like NONE of the three = Total - |A ∪ B ∪ C| = 200 - 175 = 25.',
  'n(None) = Total - [n(A)+n(B)+n(C) - n(A∩B)-n(B∩C)-n(A∩C) + n(A∩B∩C)]',
  '["Use the formula for the union of three sets: n(A∪B∪C).","Subtract the union from the total 200."]'::jsonb,
  20,
  54,
  '["Set Theory","Caselets","Inclusion Exclusion"]'::jsonb,
  TRUE
),
-- 23. verbal-001
(
  'verbal-001',
  'Identifying the Underlying Assumption',
  'Statement: "The city council must construct a high-speed metro line to significantly reduce daily traffic congestion during rush hours."\n\nWhich of the following is an underlying ASSUMPTION made by the statement?',
  'Verbal & Abstract',
  'Critical Reasoning',
  'medium',
  '[{"id":"A","text":"A significant portion of car commuters will switch to using the metro line if built."},{"id":"B","text":"Metro lines are always cheaper to maintain than highways."},{"id":"C","text":"Current bus services are running at full capacity."},{"id":"D","text":"All citizens in the city commute only during rush hours."}]'::jsonb,
  'A',
  'For a metro line to "significantly reduce traffic congestion", commuters who currently drive cars/vehicles must actually choose to ride the metro instead. If nobody switches from driving, traffic will not decrease. Hence, (A) is the necessary unstated assumption.',
  'Negation Test: If commuters will NOT switch to metro, the argument collapses.',
  '["Use the Negation Test: If you negate an option and the argument fails, that option is the necessary assumption."]'::jsonb,
  15,
  69,
  '["Critical Reasoning","Assumptions","Logic"]'::jsonb,
  TRUE
),
-- 24. verbal-002
(
  'verbal-002',
  'Word Relationship Matching',
  'EPHEMERAL : PERMANENT :: CANDID : ?',
  'Verbal & Abstract',
  'Analogies',
  'easy',
  '[{"id":"A","text":"Frank"},{"id":"B","text":"Deceitful"},{"id":"C","text":"Blunt"},{"id":"D","text":"Luminous"}]'::jsonb,
  'B',
  'EPHEMERAL (short-lived) is an antonym of PERMANENT (lasting).\nCANDID (truthful, open, honest) has the antonym DECEITFUL (dishonest, misleading).\nTherefore, the correct pair relation is antonymous.',
  'Antonym pair relationship: Word1 ↔ Opposite(Word1)',
  '["Look at the relationship between EPHEMERAL and PERMANENT.","They are opposites (antonyms). What is the opposite of CANDID?"]'::jsonb,
  10,
  87,
  '["Analogies","Vocabulary","Verbal Reasoning"]'::jsonb,
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
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
