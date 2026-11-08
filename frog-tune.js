/* Frog's Farm Tune: an original Appalachian-style reel (G major, 132 BPM),
   synthesized in the browser with Karplus-Strong plucked strings (banjo,
   guitar, bass) and a vibrato fiddle line. No audio files: the tune is
   rendered once into a buffer on first play, then looped.
   Binds to the toggle button #farm-tune-toggle on the preorder section. */
(function () {
  'use strict';

  var BPM = 132;
  var BEAT = 60 / BPM;
  var BAR = 4 * BEAT;
  var NBARS = 16;

  // Chords: [root midi, chord-tone midis]
  var G = [43, [43, 47, 50, 55, 59, 62, 67]];
  var C = [48, [48, 52, 55, 60, 64, 67, 72]];
  var D = [50, [50, 54, 57, 62, 66, 69, 74]];
  var CHORDS = [G, G, C, G, G, G, D, G, G, G, C, G, G, D, G, G];

  // Fiddle melody: per bar, [midi, beats] pairs (0 = rest). Original line.
  var M = [
    [[71,.5],[74,.5],[79,.5],[79,.5],[81,.5],[79,.5],[76,.5],[74,.5]],
    [[71,.5],[74,.5],[71,.5],[69,.5],[67,.5],[69,.5],[71,.5],[74,.5]],
    [[76,.5],[79,.5],[81,.5],[79,.5],[76,.5],[72,.5],[76,.5],[79,.5]],
    [[81,.5],[79,.5],[76,.5],[74,.5],[71,.5],[74,.5],[79,1]],
    [[79,.5],[81,.5],[83,.5],[81,.5],[79,.5],[76,.5],[79,.5],[81,.5]],
    [[74,.5],[76,.5],[79,.5],[76,.5],[74,.5],[71,.5],[74,.5],[71,.5]],
    [[69,.5],[74,.5],[78,.5],[74,.5],[81,.5],[78,.5],[74,.5],[69,.5]],
    [[71,.5],[74,.5],[79,.5],[74,.5],[67,1.5],[0,.5]],
    [[71,.5],[74,.5],[79,.5],[79,.5],[81,.5],[79,.5],[76,.5],[74,.5]],
    [[71,.5],[74,.5],[71,.5],[69,.5],[67,.5],[69,.5],[71,.5],[74,.5]],
    [[76,.5],[79,.5],[84,.5],[79,.5],[76,.5],[72,.5],[76,.5],[79,.5]],
    [[81,.5],[79,.5],[76,.5],[74,.5],[71,.5],[74,.5],[79,1]],
    [[83,.5],[81,.5],[79,.5],[81,.5],[83,.5],[86,.5],[83,.5],[81,.5]],
    [[79,.5],[76,.5],[74,.5],[78,.5],[81,.5],[78,.5],[74,.5],[71,.5]],
    [[69,.5],[71,.5],[74,.5],[78,.5],[81,1],[78,.5],[74,.5]],
    [[71,.5],[74,.5],[79,.5],[74,.5],[67,1.5],[0,.5]]
  ];

  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function noiseBurst(ctx, seconds) {
    var len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /* One Karplus-Strong pluck: noise burst into a feedback delay loop. */
  function pluck(ctx, dest, noise, freq, start, dur, gainVal, dampFreq) {
    var src = ctx.createBufferSource();
    src.buffer = noise;
    var delay = ctx.createDelay(0.1);
    delay.delayTime.value = 1 / freq;
    var fb = ctx.createGain();
    fb.gain.value = Math.pow(0.001, (1 / freq) / (dur * 2.2)); // ring time
    var damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = dampFreq;
    var out = ctx.createGain();
    out.gain.value = gainVal;
    src.connect(delay);
    delay.connect(damp);
    damp.connect(fb);
    fb.connect(delay);
    delay.connect(out);
    out.connect(dest);
    src.start(start);
    src.stop(start + 0.03);
    // Silence the loop at the end of the note's ring.
    out.gain.setValueAtTime(gainVal, start + dur);
    out.gain.linearRampToValueAtTime(0, start + dur + 0.05);
  }

  function fiddle(ctx, dest, freq, start, dur, gainVal) {
    var osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    var vib = ctx.createOscillator();
    vib.frequency.value = 5.4;
    var vibGain = ctx.createGain();
    vibGain.gain.value = freq * 0.006;
    vib.connect(vibGain);
    vibGain.connect(osc.frequency);
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2100;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(gainVal, start + 0.03);
    g.gain.setValueAtTime(gainVal, start + Math.max(0.03, dur - 0.05));
    g.gain.linearRampToValueAtTime(0, start + dur);
    osc.connect(lp);
    lp.connect(g);
    g.connect(dest);
    osc.start(start); vib.start(start);
    osc.stop(start + dur + 0.02); vib.stop(start + dur + 0.02);
  }

  var audioCtx = null;
  var sourceNode = null;
  var playing = false;
  var rendering = false;

  function setButton(btn, state) {
    var label = btn.querySelector('[data-tune-label]');
    if (state === 'playing') {
      btn.classList.add('is-playing');
      btn.setAttribute('aria-pressed', 'true');
      if (label) label.textContent = 'Pause the farm tune';
    } else if (state === 'loading') {
      if (label) label.textContent = 'Tuning the banjo...';
    } else {
      btn.classList.remove('is-playing');
      btn.setAttribute('aria-pressed', 'false');
      if (label) label.textContent = 'Play the farm tune';
    }
  }

  function init() {
    var btn = document.getElementById('farm-tune-toggle');
    if (!btn) return;
    btn.addEventListener('click', function () {
      if (playing) {
        if (audioCtx) audioCtx.suspend();
        playing = false;
        setButton(btn, 'stopped');
        return;
      }
      if (audioCtx && sourceNode) {
        audioCtx.resume();
        playing = true;
        setButton(btn, 'playing');
        return;
      }
      if (rendering) return;
      rendering = true;
      setButton(btn, 'loading');
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { setButton(btn, 'stopped'); rendering = false; return; }
      audioCtx = new AC();
      var total = NBARS * BAR;
      var offline = new OfflineAudioContext(2, Math.ceil(total * audioCtx.sampleRate), audioCtx.sampleRate);
      // Render the arrangement into the offline context by replaying the
      // same builder against it: temporarily render with the offline ctx.
      renderInto(offline, total, function (buffer) {
        sourceNode = audioCtx.createBufferSource();
        sourceNode.buffer = buffer;
        sourceNode.loop = true;
        sourceNode.connect(audioCtx.destination);
        sourceNode.start();
        playing = true;
        rendering = false;
        setButton(btn, 'playing');
      });
    });
  }

  /* The arrangement builder targets an OfflineAudioContext here so the
     tune is baked into one seamlessly looping buffer. */
  function renderInto(offline, total, done) {
    var master = offline.createGain();
    master.gain.value = 0.9;
    master.connect(offline.destination);
    var noise = noiseBurst(offline, 0.03);
    var roll = [2, 3, 4, 5, 4, 3, 4, 5];
    for (var b = 0; b < NBARS; b++) {
      var root = CHORDS[b][0];
      var tones = CHORDS[b][1];
      var t0 = b * BAR;
      var e, k, tone;
      for (e = 0; e < 8; e++) {
        tone = tones[roll[e] % tones.length] + 12;
        pluck(offline, master, noise, hz(tone), t0 + e * BEAT / 2, BEAT * 0.55, 0.20, 5200);
      }
      for (k = 0; k < 4; k++) {
        if (k % 2 === 0) {
          pluck(offline, master, noise, hz(root + (k === 0 ? 0 : 7)), t0 + k * BEAT, BEAT * 0.8, 0.24, 2600);
        } else {
          for (var s = 0; s < 3; s++) {
            pluck(offline, master, noise, hz(tones[2 + s] + 12), t0 + k * BEAT + s * 0.012, BEAT * 0.5, 0.11, 3200);
          }
        }
      }
      pluck(offline, master, noise, hz(root), t0, BEAT * 1.7, 0.30, 1200);
      pluck(offline, master, noise, hz(root + 7), t0 + 2 * BEAT, BEAT * 1.7, 0.27, 1200);
      var t = t0;
      for (var n = 0; n < M[b].length; n++) {
        var midi = M[b][n][0];
        var beats = M[b][n][1];
        if (midi) fiddle(offline, master, hz(midi), t, beats * BEAT * 0.96, 0.16);
        t += beats * BEAT;
      }
    }
    offline.startRendering().then(done);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
