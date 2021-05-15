/* eslint-disable no-console */
/* eslint-disable no-plusplus */
// uuid to identify the recording session
const uuid = Math.floor(Math.random() * 1_000_000);
let mode = 0;
let counter = 0;

const modeDescriptions = [
  "Capture a <span class='good'>good</span> sitting posture. ",
  "Capture a <span class='bad'>bad</span> sitting posture, by leaning forward.",
  "Capture a <span class='bad'>bad</span> sitting posture, by leaning back.",
];

const motivationalQuotes = [
  "Keep 'em coming 💪",
  'Nice, looking good 🤩',
  "You're on a roll 🙏",
  'Keep on capturing 📸',
  'Pretend to be working 👩‍💻👨‍💻',
  "Perfect, don't stop now 🥰",
];

function takePhoto() {
  return new Promise((resolve) => {
    const video = document.querySelector('video');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const { videoWidth, videoHeight } = video;
    canvas.width = videoWidth;
    canvas.height = videoHeight;
    context.drawImage(video, 0, 0, videoWidth, videoHeight);
    canvas.toBlob(resolve, 'image/png');
  });
}

function updateMode(newMode) {
  mode = newMode % 3;
  for (let i = 0; i < modeDescriptions.length; i++) {
    $(`#mode-${i}`).removeClass('active');
    if (i === mode) {
      $(`#mode-${i}`).addClass('active');
      $('#header-text').html(modeDescriptions[i]);
    }
  }
  if (counter > 0) {
    $('#header-sub-text').html(motivationalQuotes[counter % (motivationalQuotes.length)]);
  }
  counter++;
}

// Send data to the back-end
function sendData(score, image) {
  const fd = new FormData();
  fd.append('uuid', uuid);
  fd.append('score', score);
  fd.append('image', image);
  fd.append('image_index', score);
  fd.append('mode', 'default');
  $.ajax({
    type: 'POST',
    url: '/store',
    data: fd,
    processData: false,
    contentType: false,
  }).done(() => {
    console.log('Sent data');
  });
}

/**
 * Record a new example
 */
// eslint-disable-next-line no-unused-vars
function record() {
  takePhoto().then((blob) => {
    updateMode(mode + 1);
    sendData(mode, blob);
  }).catch((error) => console.error('takePhoto() error:', error));
}

function unsupportedBrowser() {
  $('#unsupported-overlay').removeClass('hidden');
}

$(() => {
  updateMode(0);
  if (navigator.mediaDevices.getUserMedia) {
    const constraints = {
      video: true,
    };
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
      const video = document.querySelector('video');
      video.srcObject = stream;
    }).catch(() => {
      unsupportedBrowser();
    });
  } else {
    unsupportedBrowser();
  }
});
