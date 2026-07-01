/**
 * hand-controls-local — локальные GLB рук (без cdn.aframe.io).
 * Поза по умолчанию: Fist (магнит на кулаке).
 * grip / trigger → события magnetcharge / magnetdischarge (VFX, physx-grab).
 */
(function () {
  'use strict';

  var MODEL_URLS = {
    toonLeft: 'assets/models/leftHandLow.glb',
    toonRight: 'assets/models/rightHandLow.glb',
    lowPolyLeft: 'assets/models/leftHandLow.glb',
    lowPolyRight: 'assets/models/rightHandLow.glb',
    highPolyLeft: 'assets/models/leftHandLow.glb',
    highPolyRight: 'assets/models/rightHandLow.glb'
  };

  var FIST_CLIP = 'Fist';

  AFRAME.registerComponent('hand-controls-local', {
    schema: {
      color: { default: 'white', type: 'color' },
      hand: { default: 'left' },
      handModelStyle: { default: 'lowPoly', oneOf: ['lowPoly', 'highPoly', 'toon'] }
    },

    after: ['tracked-controls'],

    init: function () {
      var self = this;
      this.pressedButtons = {};
      this.touchedButtons = {};
      this._magnetActive = false;
      this.loader = new THREE.GLTFLoader();
      this.loader.setCrossOrigin('anonymous');

      this.onGripDown = function () { self.handleButton('grip', 'down'); };
      this.onGripUp = function () { self.handleButton('grip', 'up'); };
      this.onTrackpadDown = function () { self.handleButton('trackpad', 'down'); };
      this.onTrackpadUp = function () { self.handleButton('trackpad', 'up'); };
      this.onTrackpadTouchStart = function () { self.handleButton('trackpad', 'touchstart'); };
      this.onTrackpadTouchEnd = function () { self.handleButton('trackpad', 'touchend'); };
      this.onTriggerDown = function () { self.handleButton('trigger', 'down'); };
      this.onTriggerUp = function () { self.handleButton('trigger', 'up'); };
      this.onTriggerTouchStart = function () { self.handleButton('trigger', 'touchstart'); };
      this.onTriggerTouchEnd = function () { self.handleButton('trigger', 'touchend'); };
      this.onGripTouchStart = function () { self.handleButton('grip', 'touchstart'); };
      this.onGripTouchEnd = function () { self.handleButton('grip', 'touchend'); };
      this.onThumbstickDown = function () { self.handleButton('thumbstick', 'down'); };
      this.onThumbstickUp = function () { self.handleButton('thumbstick', 'up'); };
      this.onAorXTouchStart = function () { self.handleButton('AorX', 'touchstart'); };
      this.onAorXTouchEnd = function () { self.handleButton('AorX', 'touchend'); };
      this.onBorYTouchStart = function () { self.handleButton('BorY', 'touchstart'); };
      this.onBorYTouchEnd = function () { self.handleButton('BorY', 'touchend'); };
      this.onSurfaceTouchStart = function () { self.handleButton('surface', 'touchstart'); };
      this.onSurfaceTouchEnd = function () { self.handleButton('surface', 'touchend'); };
      this.onControllerConnected = this.onControllerConnected.bind(this);
      this.onControllerDisconnected = this.onControllerDisconnected.bind(this);

      this.el.addEventListener('controllerconnected', this.onControllerConnected);
      this.el.addEventListener('controllerdisconnected', this.onControllerDisconnected);
      this.el.object3D.visible = false;
    },

    play: function () {
      this.addEventListeners();
    },

    pause: function () {
      this.removeEventListeners();
    },

    tick: function (time, delta) {
      var mesh = this.el.getObject3D('mesh');
      if (!mesh || !mesh.mixer) { return; }
      mesh.mixer.update(delta / 1000);
    },

    onControllerConnected: function (evt) {
      var el = this.el;
      var hand = this.data.hand;
      var mesh = el.getObject3D('mesh');
      el.object3D.visible = true;

      var handModelOrientationZ = hand === 'left' ? Math.PI / 2 : -Math.PI / 2;
      var handModelOrientationX = el.sceneEl.hasWebXR ? -Math.PI / 2 : 0;
      if (evt.detail.name === 'pico-controls') {
        handModelOrientationX += Math.PI / 4;
      }

      mesh.position.set(0, 0, 0);
      mesh.rotation.set(handModelOrientationX, 0, handModelOrientationZ);
    },

    onControllerDisconnected: function () {
      this.el.object3D.visible = false;
      this._setMagnetActive(false);
    },

    addEventListeners: function () {
      var el = this.el;
      el.addEventListener('gripdown', this.onGripDown);
      el.addEventListener('gripup', this.onGripUp);
      el.addEventListener('trackpaddown', this.onTrackpadDown);
      el.addEventListener('trackpadup', this.onTrackpadUp);
      el.addEventListener('trackpadtouchstart', this.onTrackpadTouchStart);
      el.addEventListener('trackpadtouchend', this.onTrackpadTouchEnd);
      el.addEventListener('triggerdown', this.onTriggerDown);
      el.addEventListener('triggerup', this.onTriggerUp);
      el.addEventListener('triggertouchstart', this.onTriggerTouchStart);
      el.addEventListener('triggertouchend', this.onTriggerTouchEnd);
      el.addEventListener('griptouchstart', this.onGripTouchStart);
      el.addEventListener('griptouchend', this.onGripTouchEnd);
      el.addEventListener('thumbstickdown', this.onThumbstickDown);
      el.addEventListener('thumbstickup', this.onThumbstickUp);
      el.addEventListener('abuttontouchstart', this.onAorXTouchStart);
      el.addEventListener('abuttontouchend', this.onAorXTouchEnd);
      el.addEventListener('bbuttontouchstart', this.onBorYTouchStart);
      el.addEventListener('bbuttontouchend', this.onBorYTouchEnd);
      el.addEventListener('xbuttontouchstart', this.onAorXTouchStart);
      el.addEventListener('xbuttontouchend', this.onAorXTouchEnd);
      el.addEventListener('ybuttontouchstart', this.onBorYTouchStart);
      el.addEventListener('ybuttontouchend', this.onBorYTouchEnd);
      el.addEventListener('surfacetouchstart', this.onSurfaceTouchStart);
      el.addEventListener('surfacetouchend', this.onSurfaceTouchEnd);
    },

    removeEventListeners: function () {
      var el = this.el;
      el.removeEventListener('gripdown', this.onGripDown);
      el.removeEventListener('gripup', this.onGripUp);
      el.removeEventListener('trackpaddown', this.onTrackpadDown);
      el.removeEventListener('trackpadup', this.onTrackpadUp);
      el.removeEventListener('trackpadtouchstart', this.onTrackpadTouchStart);
      el.removeEventListener('trackpadtouchend', this.onTrackpadTouchEnd);
      el.removeEventListener('triggerdown', this.onTriggerDown);
      el.removeEventListener('triggerup', this.onTriggerUp);
      el.removeEventListener('triggertouchstart', this.onTriggerTouchStart);
      el.removeEventListener('triggertouchend', this.onTriggerTouchEnd);
      el.removeEventListener('griptouchstart', this.onGripTouchStart);
      el.removeEventListener('griptouchend', this.onGripTouchEnd);
      el.removeEventListener('thumbstickdown', this.onThumbstickDown);
      el.removeEventListener('thumbstickup', this.onThumbstickUp);
      el.removeEventListener('abuttontouchstart', this.onAorXTouchStart);
      el.removeEventListener('abuttontouchend', this.onAorXTouchEnd);
      el.removeEventListener('bbuttontouchstart', this.onBorYTouchStart);
      el.removeEventListener('bbuttontouchend', this.onBorYTouchEnd);
      el.removeEventListener('xbuttontouchstart', this.onAorXTouchStart);
      el.removeEventListener('xbuttontouchend', this.onAorXTouchEnd);
      el.removeEventListener('ybuttontouchstart', this.onBorYTouchStart);
      el.removeEventListener('ybuttontouchend', this.onBorYTouchEnd);
      el.removeEventListener('surfacetouchstart', this.onSurfaceTouchStart);
      el.removeEventListener('surfacetouchend', this.onSurfaceTouchEnd);
    },

    update: function (oldData) {
      var el = this.el;
      var hand = this.data.hand;
      var handModelStyle = this.data.handModelStyle;
      var handColor = this.data.color;
      var self = this;
      var controlConfiguration = { hand: hand, model: false };

      if (oldData.hand && oldData.hand === hand &&
          oldData.handModelStyle === handModelStyle) {
        return;
      }

      var key = handModelStyle + hand.charAt(0).toUpperCase() + hand.slice(1);
      var handmodelUrl = MODEL_URLS[key];
      if (!handmodelUrl) { return; }

      this.loader.load(handmodelUrl, function (gltf) {
        var mesh = gltf.scene.children[0];
        mesh.mixer = new THREE.AnimationMixer(mesh);
        self.clips = gltf.animations;
        el.setObject3D('mesh', mesh);
        mesh.traverse(function (object) {
          if (!object.isMesh) { return; }
          object.material.color = new THREE.Color(handColor);
        });
        self._applyDefaultFistPose(mesh);
        el.setAttribute('magicleap-controls', controlConfiguration);
        el.setAttribute('vive-controls', controlConfiguration);
        el.setAttribute('meta-touch-controls', controlConfiguration);
        el.setAttribute('pico-controls', controlConfiguration);
        el.setAttribute('windows-motion-controls', controlConfiguration);
        el.setAttribute('hp-mixed-reality-controls', controlConfiguration);
      });
    },

    remove: function () {
      this.el.removeObject3D('mesh');
    },

    handleButton: function (button, evt) {
      var isPressed = evt === 'down';
      var isTouched = evt === 'touchstart';

      if (evt.indexOf('touch') === 0) {
        if (isTouched === this.touchedButtons[button]) { return; }
        this.touchedButtons[button] = isTouched;
      } else {
        if (isPressed === this.pressedButtons[button]) { return; }
        this.pressedButtons[button] = isPressed;
      }

      if (button === 'grip' || button === 'trigger') {
        this._syncMagnetCharge();
      }
    },

    _syncMagnetCharge: function () {
      var active = !!(this.pressedButtons.grip ||
        this.pressedButtons.trigger ||
        this.touchedButtons.trigger);
      this._setMagnetActive(active);
    },

    _setMagnetActive: function (active) {
      if (active === this._magnetActive) { return; }
      this._magnetActive = active;
      this.el.emit(active ? 'magnetcharge' : 'magnetdischarge');
    },

    _applyDefaultFistPose: function (mesh) {
      var clip;
      var action;
      var i;

      if (!mesh || !mesh.mixer || !this.clips) { return; }

      clip = null;
      for (i = 0; i < this.clips.length; i++) {
        if (this.clips[i].name === FIST_CLIP) {
          clip = this.clips[i];
          break;
        }
      }
      if (!clip) { return; }

      mesh.mixer.stopAllAction();
      action = mesh.mixer.clipAction(clip);
      action.clampWhenFinished = true;
      action.loop = THREE.LoopOnce;
      action.repetitions = 1;
      action.play();
      action.time = clip.duration;
      action.paused = true;
    }
  });
})();
