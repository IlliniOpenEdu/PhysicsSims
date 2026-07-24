// ─────────────────────────────────────────────
//  constants.ts
//  Universal physics constants for PhysicsSims
// 
//  Effective now, import this file in every module that needs these constants, instead of hardcoding them. (pls)
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

// ── Phase thermodynamics (molar, representative teaching values) ──────────────
// Per-phase enthalpies H (J/mol, solid of each substance as the zero reference),
// entropies S (J/(mol·K)) with the essential ordering S_gas > S_liquid > S_solid,
// and condensed-phase molar volumes V (m³/mol). H and S are treated as
// T-independent so G = H − TS is linear in T; values are anchored to reproduce
// the real melting/boiling/sublimation points and Clausius–Clapeyron slopes.

// Water (H₂O) — anomalous: V_liquid < V_solid ⇒ negative fusion slope
export const WATER_L_FUS  = 6010;     // J/mol latent heat of fusion (273 K)
export const WATER_L_VAP  = 40650;    // J/mol latent heat of vaporization (373 K)
export const WATER_L_SUB  = WATER_L_FUS + WATER_L_VAP; // J/mol — L_sub = L_fus + L_vap
export const WATER_H_SOLID  = 0;                        // J/mol (reference)
export const WATER_H_LIQUID = WATER_H_SOLID + WATER_L_FUS; // J/mol
export const WATER_H_GAS    = WATER_H_LIQUID + WATER_L_VAP; // J/mol
export const WATER_S_SOLID  = 41;       // J/(mol·K) ice near 273 K
export const WATER_S_LIQUID = 63;       // J/(mol·K) liquid near 273 K
export const WATER_S_GAS    = 171.9;    // J/(mol·K) anchored so boiling sits at 373 K, 1 atm
export const WATER_V_SOLID  = 1.965e-5; // m³/mol ice (19.65 cm³/mol)
export const WATER_V_LIQUID = 1.80e-5;  // m³/mol (18.0 cm³/mol) — smaller than ice!
export const WATER_T_CRIT   = 647;      // K critical temperature

// Carbon dioxide (CO₂) — "normal": V_liquid > V_solid ⇒ positive fusion slope,
// triple point above 1 atm so it sublimates at ambient pressure
export const CO2_L_FUS  = 9020;     // J/mol latent heat of fusion (217 K)
export const CO2_L_VAP  = 16700;    // J/mol latent heat of vaporization near the triple point
export const CO2_L_SUB  = CO2_L_FUS + CO2_L_VAP; // J/mol — L_sub = L_fus + L_vap
export const CO2_H_SOLID  = 0;                      // J/mol (reference)
export const CO2_H_LIQUID = CO2_H_SOLID + CO2_L_FUS;   // J/mol
export const CO2_H_GAS    = CO2_H_LIQUID + CO2_L_VAP;  // J/mol
export const CO2_S_SOLID  = 70;       // J/(mol·K)
export const CO2_S_LIQUID = 111.6;    // J/(mol·K) anchored to the 217 K triple point
export const CO2_S_GAS    = 202.3;    // J/(mol·K) anchored to the 5.2 bar triple pressure
export const CO2_V_SOLID  = 2.82e-5;  // m³/mol dry ice
export const CO2_V_LIQUID = 3.74e-5;  // m³/mol at the triple point
export const CO2_T_CRIT   = 304.1;    // K critical temperature

// ── Structural materials ── For Truss Modules ───────────────────
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
