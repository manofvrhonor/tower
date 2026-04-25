import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';

// === Сцена, камера, рендерер ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff); // белый фон

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 1.6, 3); // высота глаз ~1.6м

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.xr.enabled = true; // включаем поддержку VR
document.body.appendChild(renderer.domElement);

// Кнопка "Enter VR" появится внизу экрана
document.body.appendChild(VRButton.createButton(renderer));

// === Белая комната ===
const roomSize = 6;
const roomGeometry = new THREE.BoxGeometry(roomSize, roomSize, roomSize);
const roomMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  side: THREE.BackSide, // рендерим стены изнутри
});
const room = new THREE.Mesh(roomGeometry, roomMaterial);
room.position.y = roomSize / 2; // пол на уровне 0
scene.add(room);

// === Свет ===
const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);

const directional = new THREE.DirectionalLight(0xffffff, 0.8);
directional.position.set(2, 4, 2);
scene.add(directional);

// === Тестовый куб (чтобы видеть что 3D работает) ===
const cubeGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0xff4444 });
const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
cube.position.set(0, 1.2, 0);
scene.add(cube);

// === Цикл рендера ===
renderer.setAnimationLoop(() => {
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;
  renderer.render(scene, camera);
});

// === Реакция на изменение размера окна ===
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});