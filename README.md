# Wearable Activity Detective

An interactive health-data exhibit: a small neural network tries to tell **walking**, **climbing stairs up**, and **going down stairs** apart using only phone accelerometer traces. Visitors guess first, then see the model's prediction, explore its biggest mistake, and can ask an in-browser chatbot (WebLLM) about the project.

- **Live exhibit:** https://apriljwalter-lgtm.github.io/activity-detective/
- **Training & evaluation notebook:** [`notebook/train_activity_model.ipynb`](notebook/train_activity_model.ipynb) (same code as the script [`notebook/train_activity_model.py`](notebook/train_activity_model.py))
- **Site guide (chatbot context):** [`guide.md`](guide.md)

## Results (6 held-out people, 720 windows)
| Model | Test accuracy |
|---|---|
| Neural network (MLP, 1 hidden layer × 16) | **89.4%** |
| Baseline (always guess one activity) | 33.3% |

Most mistakes are walking ⇄ stairs up. The highlighted mistake is a naturally slow walker whose 1.56 steps/s pace matches typical stair climbing.

## Data
Synthetic accelerometer traces generated in the notebook (30 simulated people, 3,600 windows of 2.56 s at 50 Hz). The design is loosely modeled on the UCI HAR smartphone dataset (Anguita et al., 2013), but no UCI data is used.

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
Needs numpy, pandas, scipy, scikit-learn, and matplotlib. The results are reproducible (seed 42). In Google Colab, upload the `.ipynb` and run all cells. The notebook then writes `exhibit.json` next to itself.

## Chatbot notes
- Uses `Llama-3.2-1B-Instruct` through WebLLM, about a 0.9 GB download the first time it loads. It needs WebGPU, which works in recent Chrome or Edge on desktop.
- The page checks for WebGPU, shows loading progress, and keeps the exhibit working if chat can't load.
- The system prompt tells the model to answer only from `guide.md` and to say "The site guide doesn't cover that" otherwise.

## Viewing locally
Opening `index.html` directly from disk won't load the data, so start a small web server first:
`python -m http.server` then visit http://localhost:8000.
