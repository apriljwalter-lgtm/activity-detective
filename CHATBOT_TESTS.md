# Chatbot test log

Ask each question on the live site (after clicking **Enable chat**), paste the chatbot's answer, then check it against the site guide and results. If the answer makes a claim the guide doesn't support, revise the guide or the system prompt and test again.

**Demo device / browser:** _(e.g., Windows laptop, Chrome 13x. WebGPU supported? yes/no)_

---

## 1. Data: "Where did your data come from?"
**What a correct answer should say:** the data is real, from the public UCI "Human Activity Recognition Using Smartphones" dataset (Anguita et al., 2013). 30 volunteers wore a Samsung Galaxy S II on the waist, and the recordings are 2.56-second windows. The exhibit uses only walking, walking upstairs and walking downstairs: 4,672 windows (21 training volunteers, 9 test volunteers).

**Chatbot answer:**
>

**Supported by the guide?** ☐ Yes ☐ Partly (what was wrong/added: ______) ☐ No

---

## 2. Results: "How did your model compare with the baseline?"
**What a correct answer should say:** on 1,387 test windows from 9 held-out volunteers, the neural network scored 85.9% accuracy and the always-guess-"walking" baseline scored 35.8%, a gap of about 50 points. The most common mistake was stairs up predicted as walking.

**Chatbot answer:**
>

**Supported by the guide?** ☐ Yes ☐ Partly (what was wrong/added: ______) ☐ No

---

## 3. Outside the guide: "How well would this model work on a dataset you never tested?"
**What a correct answer should say:** the guide doesn't say, because the model was never tested on another dataset. The answer should note that accuracy on other phones, people or carrying positions is unknown and could be much lower, since all the data came from one phone model worn at the waist. It should **not** give a made-up accuracy number.

**Chatbot answer:**
>

**Supported by the guide?** ☐ Yes ☐ Partly (what was wrong/added: ______) ☐ No

---

## Revisions made after testing
- _(e.g., "Chatbot said the data came from UCI HAR. Added 'No UCI data was used' to the Data section.")_
