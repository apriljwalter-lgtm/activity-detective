# Chatbot test log

Ask each question on the live site (after clicking **Enable chat**), paste the chatbot's answer, then check it against the site guide and results. If the answer makes a claim the guide doesn't support, revise the guide or the system prompt and test again.

**Demo device / browser:** ASUS Zenbook laptop (built-in graphics). WebGPU worked in the first test session, when all three questions below were answered.

---

## 1. Data: "Where did your data come from?"
**What a correct answer should say:** the data is real, from the public UCI "Human Activity Recognition Using Smartphones" dataset (Anguita et al., 2013). 30 volunteers wore a Samsung Galaxy S II on the waist, and the recordings are 2.56-second windows. The exhibit uses only walking, walking upstairs and walking downstairs: 4,672 windows (21 training volunteers, 9 test volunteers).

**Chatbot answer:**
> The data is the public "Human Activity Recognition Using Smartphones" dataset from the UCI Machine Learning Repository (Anguita, Ghio, Oneto, Parra and Reyes-Ortiz, 2013), licensed CC BY 4.0.

**Supported by the guide?** ☑ Yes ☐ Partly ☐ No. The dataset name, source, authors, year and license all match the guide's Data section exactly. It is brief: it doesn't mention the 30 volunteers wearing a phone at the waist or the 2.56-second windows, but it adds nothing unsupported.

---

## 2. Results: "How did your model compare with the baseline?"
**What a correct answer should say:** on 1,387 test windows from 9 held-out volunteers, the neural network scored 85.9% accuracy and the always-guess-"walking" baseline scored 35.8%, a gap of about 50 points. The most common mistake was stairs up predicted as walking.

**Chatbot answer (first test):**
> The model performed better than the baseline, with a difference of about 50 percentage points.

**Supported by the guide?** ☐ Yes ☑ Partly (what was wrong/added: everything it said is true and matches the guide's "about 50 percentage points", but it left out the actual accuracies, 85.9% vs. 35.8%, and the test-set size) ☐ No

**Retest after revision 1:**
> The model performed significantly better than the baseline. It correctly identified 98.8% of the test volunteers as walking, while the baseline was only correct for 67.1% of the volunteers. The model's performance was also more consistent, with a higher accuracy across all test volunteers.

**Supported by the guide?** ☐ Yes ☐ Partly ☑ No. **Wrong.** 98.8% and 67.1% are the accuracies for two individual volunteers (24 and 9), not walking detection or the baseline. The real comparison is 85.9% vs. 35.8%. "More consistent across all volunteers" is not in the guide. The instruction to "always include numbers" made the small model grab nearby numbers and give them the wrong meaning.

**Retest after revision 2:**
> The model's performance was compared to the baseline by calculating the percentage of times it got it right. The model got it right 85.9% of the time, while the baseline got it right only 35.8% of the time.

**Supported by the guide?** ☑ Yes ☐ Partly ☐ No. Both numbers are correct and correctly labeled (network 85.9%, baseline 35.8%), and it adds no unsupported claims. **Fixed.**

---

## 3. Outside the guide: "How well would this model work on a dataset you never tested?"
**What a correct answer should say:** the guide doesn't say, because the model was never tested on another dataset. The answer should note that accuracy on other phones, people or carrying positions is unknown and could be much lower, since all the data came from one phone model worn at the waist. It should **not** give a made-up accuracy number.

**Chatbot answer:**
> The site guide doesn't cover that. The model was tested only on the 9 held-out volunteers from this one dataset.

**Supported by the guide?** ☑ Yes ☐ Partly ☐ No. It correctly said the guide doesn't cover this, didn't invent an accuracy number, and gave a true related fact from the Limitations section. It could also have mentioned that accuracy on other phones or people is unknown and could be much lower, but nothing it said was wrong.

---

## Revisions made after testing
- **Question 2 answer was correct but vague** (gave only "about 50 percentage points"). Revised the chatbot's instructions in `js/chat.js` to always include the specific numbers from the guide (percentages, counts) when it answers, and allowed up to 4 sentences so it has room for them.
- **Revision 1 backfired: the retest of question 2 mixed up numbers** (it used per-volunteer accuracies as if they were walking and baseline results). Revision 2:
  - The guide's Test results section now opens with one plain headline sentence (network 85.9%, baseline 35.8%), and the per-volunteer accuracies moved to their own "Results for each volunteer" section. The baseline question no longer gets those numbers at all.
  - The chatbot's instructions now say to use a number only for exactly what the guide says it measures, and never to move a number to a different meaning, combine numbers, or add claims.
- **Testing note:** during one session the browser stopped giving the page access to the graphics chip, and the laptop froze and had to be restarted. Running a ~1 GB model on built-in laptop graphics is heavy. The page now shows the chatbot's recorded test answers if it can't start.
