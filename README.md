# Wearable Activity Detective

An interactive health-data exhibit: a small neural network tries to tell **walking**, **climbing stairs up**, and **going down stairs** apart using only phone accelerometer traces. Visitors guess first, then see the model's prediction, explore its biggest mistake, and can ask an in-browser chatbot (WebLLM) about the project.

- **Live exhibit:** https://apriljwalter-lgtm.github.io/activity-detective/
- **Training & evaluation notebook:** [`notebook/train_activity_model.ipynb`](notebook/train_activity_model.ipynb) (same code as the script [`notebook/train_activity_model.py`](notebook/train_activity_model.py))
- **Site guide (chatbot context):** [`guide.md`](guide.md)

## Results (9 held-out volunteers, 1,387 windows)
| Model | Test accuracy |
|---|---|
| Neural network (MLP, hidden layers 32 → 16) | **85.9%** |
| Baseline (always guess "walking") | 35.8% |

Walking is recognized 98.4% of the time, but stairs up is often mistaken for walking (105 of 196 mistakes). The highlighted mistake is volunteer 9, who climbed stairs with quick, light steps that look like walking.

## Data
[Human Activity Recognition Using Smartphones](https://archive.ics.uci.edu/dataset/240/human+activity+recognition+using+smartphones), UCI Machine Learning Repository: D. Anguita, A. Ghio, L. Oneto, X. Parra and J. L. Reyes-Ortiz (2013), licensed **CC BY 4.0**. 30 volunteers wore a Samsung Galaxy S II on the waist. We use the raw body-acceleration windows (2.56 s at 50 Hz) for walking, walking upstairs and walking downstairs, and keep the dataset's own split by person (21 training volunteers, 9 test volunteers).

The dataset itself is not stored in this repo. The notebook downloads it from UCI if the `UCI HAR Dataset` folder isn't found.

*An earlier version of this project used synthetic (simulated) data. See the git history.*

## Project files
```
index.html, style.css      the exhibit page
js/app.js                  guess game, mistake spotlight, results
js/chat.js                 WebLLM chatbot (loads only after "Enable chat")
data/exhibit.json          held-out predictions + summary numbers exported by the notebook
guide.md                   site guide, shown on the page and given to the chatbot
notebook/                  training & evaluation (script + executed notebook)
tools/make_notebook.py     rebuilds the executed .ipynb from the .py script
CHATBOT_TESTS.md           the three required chatbot test questions and how to check them
```

## Re-running the model
```bash
cd notebook
python train_activity_model.py        # retrains and rewrites ../data/exhibit.json
python ../tools/make_notebook.py      # optional: rebuild the executed notebook
```
Needs numpy, pandas, scipy, scikit-learn, and matplotlib. The results are reproducible (seed 42). In Google Colab, upload the `.ipynb` and run all cells. It downloads the dataset automatically, then writes `exhibit.json` next to itself.

## Chatbot notes
- Runs through WebLLM. Visitors choose `Llama-3.2-1B-Instruct` (smarter, about 0.9 GB) or `Qwen2.5-0.5B-Instruct` (faster, about 0.4 GB). It needs WebGPU, which works in recent Chrome or Edge on desktop.
- **Speed:** small in-browser models are slowest at reading the prompt. So for each question, `js/chat.js` sends only the one or two most relevant sections of `guide.md` (simple keyword matching) instead of the whole guide, and caps answers at 2–3 sentences.
- The page checks for WebGPU, shows loading progress, and keeps the exhibit working if chat can't load.
- The system prompt tells the model to answer only from the guide excerpt and to say "The site guide doesn't cover that" otherwise. If no section matches, it gets the Purpose and Limitations sections so it can say what the guide does and doesn't cover.

## Viewing locally
Opening `index.html` directly from disk won't load the data, so start a small web server first:
`python -m http.server` then visit http://localhost:8000.
