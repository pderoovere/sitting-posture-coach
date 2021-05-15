/* eslint-disable no-mixed-operators */
/* eslint-disable no-bitwise */
/* global tf, blazeface */

// Initialize fields
let score = null;

// Linear interpolation for hexadecimal colors, code from https://gist.github.com/rosszurowski/67f04465c424a9bc0dae
function lerpColor(a, b, amount) {
  const ah = parseInt(a.replace(/#/g, ''), 16);
  const ar = ah >> 16; const ag = ah >> 8 & 0xff; const ab = ah & 0xff;
  const bh = parseInt(b.replace(/#/g, ''), 16);
  const br = bh >> 16; const bg = bh >> 8 & 0xff; const bb = bh & 0xff;
  const rr = ar + amount * (br - ar);
  const rg = ag + amount * (bg - ag);
  const rb = ab + amount * (bb - ab);
  return `#${((1 << 24) + (rr << 16) + (rg << 8) + rb | 0).toString(16).slice(1)}`;
}

// Change color representation
function hexToRGB(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (alpha) {
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgb(${r}, ${g}, ${b})`;
}

function hasNoScore() {
  // Show loading overlay
  $('#loading-overlay').removeClass('hidden');
}

function hasScore() {
  // Hide loading overlay
  $('#loading-overlay').addClass('hidden');
}

// Update ui based on score value
function updateUi() {
  const minRange = $('#range-slider').slider('values', 0);
  const maxRange = $('#range-slider').slider('values', 1);
  const lastScore = score;
  if (lastScore != null) {
    let lastScoreRelToRange = (lastScore - minRange) / (maxRange - minRange);
    lastScoreRelToRange = Math.max(0, Math.min(1, lastScoreRelToRange));
    const color = lerpColor('#ff3b30', '#34c759', lastScoreRelToRange);
    $('#camera-feed').css('border-color', color);
    $('#wrapper').css('background-color', hexToRGB(color, 0.3));
    $('#value-slider').slider('value', lastScore);
    hasScore();
  } else {
    $('#wrapper').css('background-color', hexToRGB('#eeeeee', 0.3));
    hasNoScore();
  }
}

function setupSliders() {
  $('#value-slider').slider({
    min: 0,
    max: 1,
    step: 0.01,
    value: 0.5,
    disable: true,
    animate: true,
  });
  $('#range-slider').slider({
    range: true,
    min: 0,
    max: 1,
    step: 0.01,
    values: [0.0, 0.9],
    slide() {
      updateUi();
    },
  });
}

function unsupportedBrowser() {
  // Show unupported browser overlay
  $('#unsupported-overlay').removeClass('hidden');
}

function drawCroppedVideo(context, video, videoWidth, videoHeight, cx, cy, r) {
// safari draw image fix: https://gist.github.com/Kaiido/ca9c837382d89b9d0061e96181d1d862
  const sx = cx - r;
  const sy = cy - r;
  const sw = 2 * r;
  const sh = 2 * r;
  const dx = 0;
  const dy = 0;
  const dw = 128;
  const dh = 128;
  const x1 = Math.max(sx, 0);
  const x2 = Math.min(sx + sw, videoWidth);
  const y1 = Math.max(sy, 0);
  const y2 = Math.min(sy + sh, videoHeight);
  const wRatio = dw / sw;
  const hRatio = dh / sh;
  context.fillStyle = 'black';
  context.fillRect(0, 0, 128, 128);
  context.drawImage(video,
    x1,
    y1,
    x2 - x1,
    y2 - y1,
    sx < 0 ? dx - (sx * wRatio) : dx,
    sy < 0 ? dy - (sy * hRatio) : dy,
    (x2 - x1) * wRatio,
    (y2 - y1) * hRatio);
}

function updateScore(newScore) {
  if (score == null || newScore == null) {
    score = newScore;
  } else {
    score = 0.5 * score + 0.5 * newScore;
  }
  updateUi();
}

/**
 * Preprocess the current video frame, predict the posture score and update the ui
 */
async function processStream() {
  const faceModel = await blazeface.load();
  const model = await tf.loadLayersModel('tfjs_model/model.json');
  const video = document.querySelector('video');
  const facePredictions = await faceModel.estimateFaces(video);
  if (facePredictions.length > 0) {
    const face = facePredictions[0];
    const { videoWidth } = video;
    const { videoHeight } = video;
    const x = face.topLeft[0];
    const y = face.topLeft[1];
    const w = face.bottomRight[0] - x;
    const h = face.bottomRight[1] - y;
    const r = Math.sqrt(w * h) * 2;
    const cx = x + w / 2;
    const cy = y + h;
    const canvas = document.getElementById('canvas');
    const context = canvas.getContext('2d');
    drawCroppedVideo(context, video, videoWidth, videoHeight, cx, cy, r);
    const preprocessed = tf.browser.fromPixels(canvas).div(255).expandDims(0);
    const posturePrediction = await model.predict(preprocessed);
    if (posturePrediction) {
      // eslint-disable-next-line prefer-destructuring
      updateScore(posturePrediction.dataSync()[0]);
    } else {
      updateScore(null);
    }
  }
  // Keep on doing this
  requestAnimationFrame(processStream);
}

$(() => {
  setupSliders();
  updateUi();
  if (navigator.mediaDevices.getUserMedia) {
    const constraints = {
      video: true,
    };
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
      const video = document.querySelector('video');
      video.srcObject = stream;
      video.addEventListener('loadeddata', () => {
        processStream();
      });
    }).catch(() => {
      unsupportedBrowser();
    });
  } else {
    unsupportedBrowser();
  }
});
