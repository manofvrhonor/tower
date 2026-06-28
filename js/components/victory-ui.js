/* global AFRAME, CONFIG, THREE */

/**
 * victory-ui — плашка победы в VR (Этап 5, шаг 3).
 *
 * «Заново» — поднести руку к кнопке + grip/trigger.
 * Рестарт без reload (VR-сессия не прерывается).
 */
AFRAME.registerComponent('victory-ui', {
  schema: {},

  init: function () {
    this.cfg = (typeof CONFIG !== 'undefined' && CONFIG.victory && CONFIG.victory.ui) || {};
    this._shown = false;
    this._handNear = false;
    this._nearHintLogged = false;
    this._onVictory = this._onVictory.bind(this);
    this._onHandPress = this._onHandPress.bind(this);
    this._onTick = this._onTick.bind(this);

    this.el.sceneEl.addEventListener('victory', this._onVictory);
    this._buildUI();
    this._bindHands();
  },

  play: function () {
    this.el.sceneEl.addEventListener('tick', this._onTick);
  },

  pause: function () {
    this.el.sceneEl.removeEventListener('tick', this._onTick);
  },

  remove: function () {
    this.el.sceneEl.removeEventListener('victory', this._onVictory);
    this.el.sceneEl.removeEventListener('tick', this._onTick);
    this._unbindHands();
  },

  _bindHands: function () {
    var ids = ['leftHand', 'rightHand'];
    this._handEls = [];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (!el) continue;
      this._handEls.push(el);
      el.addEventListener('gripdown', this._onHandPress);
      el.addEventListener('triggerdown', this._onHandPress);
    }
  },

  _unbindHands: function () {
    if (!this._handEls) return;
    for (var i = 0; i < this._handEls.length; i++) {
      this._handEls[i].removeEventListener('gripdown', this._onHandPress);
      this._handEls[i].removeEventListener('triggerdown', this._onHandPress);
    }
  },

  _makeTextPlane: function (text, planeW, planeH, options) {
    var opts = options || {};
    var canvasW = opts.canvasW || 512;
    var canvasH = opts.canvasH || 256;
    var canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    var ctx = canvas.getContext('2d');

    if (opts.bg) {
      ctx.fillStyle = opts.bg;
      ctx.fillRect(0, 0, canvasW, canvasH);
    } else {
      ctx.clearRect(0, 0, canvasW, canvasH);
    }

    ctx.fillStyle = opts.color || '#ffffff';
    ctx.font = 'bold ' + (opts.fontSize || 72) + 'px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvasW / 2, canvasH / 2);

    var plane = document.createElement('a-plane');
    plane.setAttribute('width', planeW);
    plane.setAttribute('height', planeH);

    var self = this;
    var apply = function () {
      self._applyCanvasTexture(plane, canvas);
    };
    plane.addEventListener('loaded', apply);
    if (plane.hasLoaded) apply();

    return { el: plane, canvas: canvas, ctx: ctx };
  },

  _applyCanvasTexture: function (el, canvas) {
    var mesh = el.getObject3D('mesh');
    if (!mesh) return;
    var tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    mesh.material = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      side: THREE.FrontSide,
    });
  },

  _redrawButton: function (btnData, bgColor) {
    var ctx = btnData.ctx;
    var canvas = btnData.canvas;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 56px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(btnData.label, canvas.width / 2, canvas.height / 2);
    var mesh = btnData.el.getObject3D('mesh');
    if (mesh && mesh.material && mesh.material.map) {
      mesh.material.map.needsUpdate = true;
    }
  },

  _buildUI: function () {
    var ui = this.cfg;
    var pos = ui.worldPosition || { x: 0, y: 1.48, z: 0.28 };
    var title = ui.titleText || 'ПОБЕДА';
    var hint = ui.hintText || 'Поднеси руку + grip';
    var btnText = ui.buttonText || 'Заново';
    this._btnNormal = '#3d9a56';
    this._btnHover = '#4ecf7a';
    this._btnNear = '#6dff9a';
    this._pressRadius = ui.handPressRadius !== undefined ? ui.handPressRadius : 0.22;

    this._root = document.createElement('a-entity');
    this._root.setAttribute('id', 'victory-ui-root');
    this._root.setAttribute('position', pos.x + ' ' + pos.y + ' ' + pos.z);
    this._root.setAttribute('visible', false);

    var panel = document.createElement('a-plane');
    panel.setAttribute('width', 0.62);
    panel.setAttribute('height', 0.46);
    panel.setAttribute('color', '#1e1e28');
    panel.setAttribute('material', 'shader: flat; opacity: 0.96; transparent: true; side: front');
    panel.setAttribute('position', '0 0 0');

    var titleData = this._makeTextPlane(title, 0.52, 0.13, {
      canvasW: 512, canvasH: 128, fontSize: 80, color: '#ffffff', bg: null,
    });
    titleData.el.setAttribute('position', '0 0.15 0.006');

    var hintData = this._makeTextPlane(hint, 0.52, 0.08, {
      canvasW: 512, canvasH: 96, fontSize: 36, color: '#cccccc', bg: null,
    });
    hintData.el.setAttribute('position', '0 0.04 0.007');

    this._btnData = this._makeTextPlane(btnText, 0.5, 0.14, {
      canvasW: 512, canvasH: 128, fontSize: 56, color: '#ffffff', bg: this._btnNormal,
    });
    this._btnData.label = btnText;
    var btn = this._btnData.el;
    btn.setAttribute('id', 'victory-restart-btn');
    btn.setAttribute('class', 'victory-ui-clickable');
    btn.setAttribute('position', '0 -0.13 0.01');

    var self = this;
    btn.addEventListener('click', function () {
      self._doRestart();
    });
    btn.addEventListener('mouseenter', function () {
      if (!self._handNear) self._redrawButton(self._btnData, self._btnHover);
    });
    btn.addEventListener('mouseleave', function () {
      if (!self._handNear) self._redrawButton(self._btnData, self._btnNormal);
    });

    this._root.appendChild(panel);
    this._root.appendChild(titleData.el);
    this._root.appendChild(hintData.el);
    this._root.appendChild(btn);
    this.el.sceneEl.appendChild(this._root);

    this._btnPos = new THREE.Vector3();
    this._handPos = new THREE.Vector3();
  },

  _facePlayer: function () {
    var cam = document.querySelector('#player a-camera');
    if (!cam || !this._root) return;

    var camPos = new THREE.Vector3();
    var rootPos = new THREE.Vector3();
    cam.object3D.getWorldPosition(camPos);
    this._root.object3D.getWorldPosition(rootPos);

    var dx = camPos.x - rootPos.x;
    var dz = camPos.z - rootPos.z;
    var rotY = Math.atan2(dx, dz) * (180 / Math.PI);
    this._root.setAttribute('rotation', '0 ' + rotY + ' 0');
  },

  _getHandWorldPos: function (handEl) {
    var collider = handEl.querySelector('[id$="HandCollider"]');
    var src = collider || handEl;
    src.object3D.getWorldPosition(this._handPos);
    return this._handPos;
  },

  _isAnyHandNearButton: function () {
    if (!this._btnData) return false;
    this._btnData.el.object3D.getWorldPosition(this._btnPos);
    for (var i = 0; i < this._handEls.length; i++) {
      this._getHandWorldPos(this._handEls[i]);
      if (this._handPos.distanceTo(this._btnPos) <= this._pressRadius) {
        return true;
      }
    }
    return false;
  },

  _onTick: function () {
    if (!this._shown || !this._btnData) return;
    var near = this._isAnyHandNearButton();
    if (near !== this._handNear) {
      this._handNear = near;
      this._redrawButton(this._btnData, near ? this._btnNear : this._btnNormal);
      if (near && !this._nearHintLogged) {
        this._nearHintLogged = true;
        console.log('[victory-ui] рука у кнопки — нажми grip или trigger');
      }
      if (!near) {
        this._nearHintLogged = false;
      }
    }
    var scale = near ? '1.1 1.1 1' : '1 1 1';
    this._btnData.el.setAttribute('scale', scale);
  },

  _onHandPress: function () {
    if (!this._shown) return;
    if (!this._isAnyHandNearButton()) return;
    this._doRestart();
  },

  _releaseAllGrabs: function () {
    var ids = ['leftHand', 'rightHand'];
    for (var i = 0; i < ids.length; i++) {
      var grab = document.getElementById(ids[i]);
      grab = grab && grab.components['physx-grab'];
      if (!grab) continue;
      if (grab.joint) grab.removeJoint();
      grab.grabbing = false;
      grab.hitEl = undefined;
    }
  },

  _doRestart: function () {
    if (this._restarting) return;
    this._restarting = true;

    console.log('[victory-ui] возврат в меню');

    this._shown = false;
    this._handNear = false;
    this._nearHintLogged = false;
    this._root.setAttribute('visible', false);
    if (this._btnData) this._btnData.el.setAttribute('scale', '1 1 1');

    if (typeof window.returnToMenu === 'function') {
      window.returnToMenu();
    }

    this._restarting = false;
  },

  _enableDesktopCursor: function () {
    if (typeof window.enableDesktopUiCursor === 'function') {
      window.enableDesktopUiCursor();
    }
  },

  _onVictory: function () {
    if (!this._root) return;
    this._shown = true;
    this._nearHintLogged = false;
    this._root.setAttribute('visible', true);
    this._facePlayer();
    this._enableDesktopCursor();

    console.log('[victory-ui] ПОБЕДА — поднеси руку к «Заново», кнопка засветится, нажми grip');
  },
});
