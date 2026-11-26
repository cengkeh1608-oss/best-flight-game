// Island Air Rally — tuning constants and world layout.
// One job: every number the flight model, world and renderer share.
export const CONFIG = {
  // World: metres, x east, z south, y up. Sea level is y = 0.
  worldSize: 2400,
  seed: 1337,
  // Terrain mesh drawn around the camera.
  meshCell: 40,
  meshRadius: 620,
  // Flight model.
  maxSpeed: 92, // m/s at full throttle, level flight
  minFlySpeed: 26, // below this the wing stops flying
  accel: 14, // m/s^2 toward throttle speed
  drag: 0.12,
  climbRate: 26, // m/s at full pitch up and full speed
  sinkRate: 9, // m/s sinking when slow or throttle idle
  pitchRate: 0.85, // rad/s at full stick
  rollRate: 1.7, // rad/s at full stick
  maxPitch: 0.55,
  maxRoll: 1.1,
  turnRate: 0.55, // heading rad/s at full bank and full speed
  gravitySink: 6,
  // Fuel and damage: a sortie is a decision.
  fuelMax: 100,
  fuelBurn: 0.55, // per second at full throttle
  fuelBurnIdle: 0.12,
  damageMax: 100,
  crashDamage: 100,
  hardLandingDamage: 34,
  // Rings: the rally course.
  ringCount: 8,
  ringRadius: 18,
  ringScore: 250,
  landingScore: 150,
  timeBonusPerSecond: 5,
  // Runway on the main island, pointing north-south.
  runway: { x: 0, z: -40, length: 320, width: 26, heading: 0, y: 2 },
  // Camera.
  cameraDistance: 13,
  cameraHeight: 5.2,
  cameraFov: 72, // degrees, vertical
  // Rendering.
  fogNear: 420,
  fogFar: 1150,
  skyTop: '#2f6fd0',
  skyMid: '#7fb2e8',
  skyLow: '#cfe6f7',
  seaDeep: '#14608f',
  seaShallow: '#2fa08f',
  sand: '#e8d29a',
  grass: '#5da24a',
  forest: '#2f7a33',
  rock: '#8a7f74',
  snow: '#eef2f5',
};

export const RING_COURSE = [
  // x, z, altitude — a loop around the main island, climbing as it goes.
  { x: 260, z: -420, y: 90 },
  { x: 560, z: -120, y: 110 },
  { x: 480, z: 320, y: 130 },
  { x: 120, z: 560, y: 110 },
  { x: -320, z: 420, y: 140 },
  { x: -580, z: 60, y: 160 },
  { x: -420, z: -380, y: 150 },
  { x: -80, z: -560, y: 120 },
];
