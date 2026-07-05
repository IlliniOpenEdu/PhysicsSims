// ─────────────────────────────────────────────
//  constants.ts
//  Universal physics constants for PhysicsSims
// 
//  Effective now, import this file in every module that needs these constants, instead of hardcoding them.
// ─────────────────────────────────────────────

// ── Mechanics ────────────────────────────────
export const G_ACCEL = 9.81;          // m/s²  standard gravity
export const G_MOON  = 1.62;          // m/s²  lunar gravity
export const G_MARS  = 3.72;          // m/s²  martian gravity
export const BIG_G   = 6.674e-11;     // N·m²/kg²  gravitational constant

// ── Thermodynamics ────────────────────────────
export const K_BOLTZMANN  = 1.380649e-23;  // J/K   Boltzmann constant
export const R_GAS        = 8.314462;      // J/(mol·K)  ideal gas constant
export const N_AVOGADRO   = 6.02214076e23; // mol⁻¹  Avogadro's number
export const AMU          = 1.66053906660e-27; // kg  atomic mass unit
export const STEFAN_BOLTZMANN = 5.670374e-8; // W/(m²·K⁴)  Stefan-Boltzmann

// Common specific heats (J/kg·K)
export const C_WATER     = 4186;
export const C_ALUMINUM  = 900;
export const C_IRON      = 449;
export const C_COPPER    = 385;

// Thermal conductivity (W/m·K)
export const K_COPPER = 401;
export const K_STEEL  = 50;
export const K_WOOD   = 0.12;
export const K_AIR    = 0.026;
export const K_GLASS  = 1.0;

// ── Structural materials ─────────────────────
// Young's modulus (Pa)
export const E_STEEL    = 200e9; // structural steel (A36)
export const E_ALUMINUM = 69e9;  // aluminum 6061-T6

// Yield strength (Pa)
export const SIGMA_YIELD_STEEL    = 250e6; // A36 structural steel
export const SIGMA_YIELD_ALUMINUM = 240e6; // aluminum 6061-T6

// ── E&M ──────────────────────────────────────
export const K_COULOMB   = 8.9875517923e9; // N·m²/C²  Coulomb's constant
export const EPSILON_0   = 8.854187817e-12; // F/m  permittivity of free space
export const MU_0        = 1.25663706212e-6; // H/m  permeability of free space
export const E_CHARGE    = 1.602176634e-19; // C  elementary charge
export const E_MASS      = 9.1093837015e-31; // kg  electron mass
export const PROTON_MASS = 1.67262192369e-27; // kg

// ── Waves & Optics ────────────────────────────
export const C_LIGHT   = 299792458;   // m/s  speed of light
export const C_SOUND   = 343;         // m/s  speed of sound in air at 20°C
export const PLANCK_H  = 6.62607015e-34; // J·s  Planck's constant
export const PLANCK_HBAR = 1.054571817e-34; // J·s  reduced Planck's constant

// Visible light wavelength range (m)
export const LAMBDA_VISIBLE_MIN = 380e-9;
export const LAMBDA_VISIBLE_MAX = 700e-9;

// ── Fluids ────────────────────────────────────
export const RHO_WATER   = 1000;   // kg/m³
export const RHO_AIR     = 1.225;  // kg/m³ at sea level, 15°C
export const RHO_MERCURY = 13534;  // kg/m³
export const RHO_OIL     = 900;    // kg/m³ approx
export const ATM_PRESSURE = 101325; // Pa  standard atmosphere
export const VISCOSITY_WATER = 1e-3; // Pa·s at 20°C

// ── Math ─────────────────────────────────────
export const TWO_PI = 2 * Math.PI;
export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;
export const EULER = Math.E;
export const PI = Math.PI;
export const SQRT2 = Math.SQRT2;