# Site Guide: Wearable Activity Detective

## Purpose
This exhibit asks: can a small neural network tell **walking** from **climbing stairs up** and **going down stairs** using only the motion sensor (accelerometer) in a phone? Visitors look at a short motion trace, guess the activity, and then see what the model predicted. The main discovery is that walking and climbing stairs up are often confused, because a slow walker's steps can look very much like stair climbing.

## Data
- The data is **synthetic** (computer-generated), not recorded from real people. It was created by the training notebook in this project's GitHub repository (`notebook/train_activity_model.py`).
- The simulation was loosely modeled on the setup of the public UCI "Human Activity Recognition Using Smartphones" dataset (Anguita et al., 2013): 2.56-second windows recorded at 50 readings per second. No UCI data was used.
- 30 simulated people each have their own walking pace, movement strength, phone tilt, and sensor noise. Each person contributed 40 windows of each activity, for 3,600 windows in total (1,200 per activity).
- Each window has three axes of acceleration, measured in g: x (forward and back), y (side to side), and z (up and down).
- Because the data is simulated, the patterns are simpler than real sensor data. Real phones, pockets, shoes, and staircases add variation that this simulation does not include.

## Model inputs and outputs
- **Inputs:** 16 summary numbers calculated from each 2.56-second window. They describe how much each axis moves (standard deviation and range), the overall shaking (magnitude mean, standard deviation, and maximum), how spiky and lopsided the up-down signal is (kurtosis and skew), the step rhythm (dominant frequency from a Fourier transform), how energy is spread across low, middle, and high frequencies, and how often the up-down signal crosses its average.
- **Output:** one of three activities (walking, climbing stairs up, going down stairs), plus the model's confidence in each.
- **Model:** a small neural network (scikit-learn `MLPClassifier`) with one hidden layer of 16 neurons and regularization strength alpha = 0.1. The inputs are standardized before they reach the network.
- **Tuning:** network size and regularization were chosen with 4-fold cross-validation grouped by person, using only the training people.

## Test results
- **Test set:** 6 whole people (720 windows) were held out. The model never saw them during training or tuning, so the test shows how well it works on new people.
- **Neural network accuracy on the test set: 89.4%.**
- **Baseline accuracy: 33.3%.** The baseline always guesses the same activity ("going down stairs"). The three activities are equally common, so any always-the-same guess is right one-third of the time.
- The network beat the baseline by about 56 percentage points.
- Per-activity recall (the share of each true activity the model got right): walking 85.8%, climbing stairs up 86.3%, going down stairs 96.3%.
- Confusion matrix (rows are the true activity, columns are the prediction, in the order walking / up / down):
  - True walking: 206 walking, 27 up, 7 down
  - True stairs up: 31 walking, 207 up, 2 down
  - True stairs down: 9 walking, 0 up, 231 down
- The biggest source of mistakes was walking and climbing stairs up being mixed up with each other (58 of the 76 mistakes).

## Highlighted mistake
Test window #1832 comes from simulated person 16, who was truly **walking**. The model predicted **climbing stairs up** with 99% confidence. This person is a naturally slow walker. Their step rhythm in this window was 1.56 steps per second, which matches the typical stair-climbing pace in the training data (1.56) better than the typical walking pace (1.95). Up-and-down bounce alone can't show whether someone is gaining height. Things that might have helped include a barometer (air-pressure) reading to detect height change, longer windows so the model sees more steps, and more training examples of unusually slow and fast walkers.

## How to use the exhibit
- **Guess the activity:** look at the motion trace, pick an activity, and then reveal the model's prediction and the true answer. The exhibit keeps score for you and for the model.
- **Animated workout buddy:** a cartoon figure steps in time with each trace, and its footsteps land on the peaks of the up-and-down line while a yellow playhead sweeps across the trace. Before you guess, the figure's legs are hidden in fog so the stairs don't give the answer away. After you guess, one scene shows what really happened and another shows what the model pictured. The animation is an illustration made for the exhibit. It is not part of the data or the model.
- **Slow-mo:** slows the animation and playhead down.
- **Music and Sounds:** optional, original 80s-style synth music and sound effects (footstep sounds (before you guess every step is the same tap; after you guess, the same note means walking, rising notes mean stairs up, and falling notes mean stairs down), a jingle when you guess right, a "wah-wah" when you miss, and a coach voice). They are generated live in the browser with the Web Audio API, with no audio files, and stay off until you turn them on.
- **Show only mistakes:** this filter lets you study the windows the model got wrong.
- **Mistake spotlight:** compares the highlighted mistake with a correctly predicted walking window from another person.
- All windows shown in the exhibit come from the held-out test people.

## Limitations
- The data is simulated, so this accuracy should **not** be expected on real phone or smartwatch data. The model has not been tested on any real dataset or any other dataset.
- Only three activities are included. Running, standing, sitting, elevators, and ramps are not covered, and the model would force any of these into one of its three answers.
- Every simulated phone sits in a similar pocket position. Real phones in hands, bags, or on wrists move differently.
- 2.56-second windows contain only about four or five steps, which leaves little information about rhythm.
- This is a classroom demonstration. It is not a medical or fall-detection device.

## About the chatbot
The chatbot is a small language model that runs entirely in your browser with WebLLM (WebGPU). It answers only from this guide. If this guide doesn't contain the answer, it should say so.
