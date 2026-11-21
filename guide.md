# Site Guide: Wearable Activity Detective

## Purpose
This exhibit asks: can a small neural network tell **walking** from **climbing stairs up** and **going down stairs** using only the motion sensor (accelerometer) in a phone? Visitors look at a short motion trace, guess the activity, and then see what the model predicted. The main discovery is that the model is excellent at recognizing walking but often mistakes stair climbing for walking, because gentle stair steps can shake a phone a lot like steps on flat ground.

## Data
- The data is **real**: the public "Human Activity Recognition Using Smartphones" dataset from the UCI Machine Learning Repository (Anguita, Ghio, Oneto, Parra and Reyes-Ortiz, 2013), licensed CC BY 4.0. Link: https://archive.ics.uci.edu/dataset/240/human+activity+recognition+using+smartphones
- 30 volunteers aged 19 to 48 wore a Samsung Galaxy S II smartphone on the waist while doing everyday activities. The dataset authors labeled the activities from video recordings.
- The recordings are cut into 2.56-second windows (128 readings at 50 readings per second). Neighboring windows overlap by half.
- This exhibit uses only the three moving activities: walking, walking upstairs, and walking downstairs. Sitting, standing, and lying down were left out.
- Each window has body acceleration (with gravity already removed by the dataset authors) in three directions, measured in g: up-down, side-to-side, and forward-back. The direction names are approximate, because they depend on how the phone sat on each volunteer's waist.
- In total, this exhibit uses 4,672 windows: 3,285 from 21 training volunteers and 1,387 from 9 test volunteers.

## Model inputs and outputs
- **Inputs:** 16 summary numbers calculated from each 2.56-second window. They describe how much each direction moves (standard deviation and range), the overall shaking (magnitude mean, standard deviation, and maximum), how spiky and lopsided the up-down signal is (kurtosis and skew), the step rhythm (dominant frequency from a Fourier transform, in steps per second), how energy is spread across low, middle, and high frequencies, and how often the up-down signal crosses its average.
- **Output:** one of three activities (walking, climbing stairs up, going down stairs), plus the model's confidence in each.
- **Model:** a small neural network (scikit-learn `MLPClassifier`) with two hidden layers of 32 and 16 neurons and regularization strength alpha = 1.0. The inputs are standardized before they reach the network.
- **Tuning:** network size and regularization were chosen with 4-fold cross-validation grouped by volunteer, using only the 21 training volunteers.

## Test results
- **Test set:** the dataset's own split by person. 9 volunteers (1,387 windows) were kept out of training and tuning, so the test shows how well the model works on new people. No volunteer appears in both the training and test sets.
- **Neural network accuracy on the test set: 85.9%.**
- **Baseline accuracy: 35.8%.** The baseline always guesses "walking", the most common activity in the training data. It is right only for the 496 test windows where the volunteer really was walking.
- The network beat the baseline by about 50 percentage points.
- Per-activity recall (the share of each true activity the model got right): walking 98.4%, climbing stairs up 75.6%, going down stairs 82.6%.
- Confusion matrix (rows are the true activity, columns are the prediction, in the order walking / up / down):
  - True walking: 488 walking, 6 up, 2 down
  - True stairs up: 105 walking, 356 up, 10 down
  - True stairs down: 22 walking, 51 up, 347 down
- The most common mistake was climbing stairs up predicted as walking (105 of the 196 mistakes). The model leans toward answering "walking".
- Accuracy differed a lot between test volunteers: from 67.1% for volunteer 9 to 98.8% for volunteer 24.

## Highlighted mistake
Test window #377 comes from volunteer 9, who was truly **climbing stairs up**. The model predicted **walking** with 100% confidence. This volunteer climbed with quick, light steps. The window had a step rhythm of 1.86 steps per second (typical walking: 1.76; typical stair climbing: 1.61), an up-down bounce of 0.150 g (typical walking: 0.220 g; typical stair climbing: 0.249 g), and a strongest jolt of 0.45 g (typical walking: 0.69 g; typical stair climbing: 0.75 g). All three numbers look more like walking than stair climbing in the training data. An accelerometer can't feel height change directly, so walking and stairs can look alike. Things that might have helped include a barometer (air-pressure) reading to detect going up or down, longer windows so the model sees more steps, the gyroscope signals that the dataset also includes, and more training volunteers with different walking styles.

## How to use the exhibit
- **Guess the activity:** look at the motion trace, pick an activity, and then reveal the model's prediction and the true answer. The exhibit keeps score for you and for the model.
- **Animated workout buddy:** a cartoon figure steps in time with each trace, and its footsteps line up with peaks of the up-down line while a yellow playhead sweeps across the trace. Before you guess, the figure's legs are hidden in fog so the stairs don't give the answer away. After you guess, one scene shows what really happened and another shows what the model pictured. The animation is an illustration made for the exhibit. It is not part of the data or the model.
- **Slow-mo:** slows the animation and playhead down.
- **Music and Sounds:** optional, original 80s-style synth music and sound effects. Footsteps are silent until you guess. After that, the same note means walking, rising notes mean stairs up, and falling notes mean stairs down. There is also a jingle when you guess right, a "wah-wah" when you miss, and a coach voice. All sounds are generated live in the browser with the Web Audio API, with no audio files. The music starts on your first click or key press on the page (browsers don't allow sound before that) and can be turned off with the Workout music button in the banner. Footstep sounds stay off until you turn them on.
- **Peek inside the neural network:** a panel that shows the real trained network working on the trace on screen. The 16 clues (inputs) are on the left, the 32 and 16 hidden neurons glow brighter when they are more active, and lines show how strongly each neuron pushes the next one up or down. The 3 answers stay hidden until you guess. After you guess, it lists the clues that mattered most, found by resetting one clue at a time to an average value and seeing how much the network's confidence drops.
- **Show only mistakes:** this filter lets you study the windows the model got wrong.
- **Mistake spotlight:** compares the highlighted mistake with a correctly predicted stair-climbing window from another volunteer.
- All windows shown in the exhibit come from the 9 test volunteers.

## Limitations
- The model was tested only on the 9 held-out volunteers from this one dataset. It has **not** been tested on any other dataset, so its accuracy on other phones, other people, or other ways of carrying a phone is unknown and could be much lower.
- All recordings come from one phone model worn at the waist, in one lab setting. Phones in a pocket, a hand, a bag, or a smartwatch on a wrist move differently.
- 30 volunteers aged 19 to 48 is a small group. Older adults, children, and people who use walking aids are not represented.
- Only three activities are included. Running, standing still, sitting, elevators, and ramps are not covered, and the model would force any of these into one of its three answers.
- 2.56-second windows contain only about four or five steps, which leaves little information about rhythm.
- This is a classroom demonstration. It is not a medical or fall-detection device.

## About the chatbot
The chatbot is a small language model that runs entirely in your browser with WebLLM (WebGPU). Visitors can choose Llama 3.2 1B (smarter) or Qwen 2.5 0.5B (faster). It answers only from this guide: for each question, the site picks the one or two guide sections that best match the question's words and gives them to the model. If this guide doesn't contain the answer, it should say so.
