import {
  CodeProblem as CodeProblemCard,
  type CodeProblem as CodeProblemItem,
} from '../components/CodeProblem';

type CodeProblemEntry = {
  problem: CodeProblemItem;
  answerCode: string;
  answerTitle?: string;
  explanation?: string;
  lightMode?: boolean;
};

const base = import.meta.env.BASE_URL;

const unit1Problems: CodeProblemEntry[] = [
  {
    problem: {
      title: 'Equilibrium with Springs',
      imageUrl: 'https://us.prairielearn.com/pl/course_instance/206302/instance_question/630400629/clientFilesQuestion/particleEquilibrium02.png',
      description:
        'Jane is using two springs to keep a tent upright and still. Jane is applying a force Fb at B to keep the tent and springs in equilibrium as shown. Determine the horizontal component of Fb (parallel to x-axis).',
      code: `import numpy as np

k_AB = 9.0 # N/cm
k_CB = 8.0 # N/cm
d_AB = 3.0 # cm
d_CB = 5.0 # cm
alpha = 25.0 # degrees
beta = 17.0 # degrees`,
    },
    answerTitle: 'Python Solution',
    explanation: 'Use the spring force in each member, resolve both forces into the horizontal direction, and add the x-components to get the net force.',
    answerCode: `import numpy as np

k_AB = 9.0 # N/cm
k_CB = 8.0 # N/cm
d_AB = 3.0 # cm
d_CB = 5.0 # cm
alpha = 25.0 # degrees
beta = 17.0 # degrees

alpha = np.deg2rad(alpha)
beta  = np.deg2rad(beta)

F_AB = k_AB * d_AB
F_CB = k_CB * d_CB

Fx = (F_AB*np.cos(alpha) + F_CB*np.cos(beta))
print(Fx)
`,
  },
];
const unit2Problems: CodeProblemEntry[] = [
  {
    problem: {
      title: 'Equilibrium of pulley',
      imageUrl: `${base}tam/951.png`,
      description:
        'A cable runs along a pulley: one side of the cable is perpendicular to the base holding the pulley. The other side of the cable is pulled at an angle with tension.',
      code: `import numpy as np

T = 378 # N
theta = 39 # degrees`,
    },
    explanation:
      'The resultant comes from adding the two tension vectors in x and y, then taking the vector magnitude.',
    answerCode: `import numpy as np

T = 376
theta = np.deg2rad(39)

F1 = T*np.array([np.cos(np.deg2rad(135)),
                 np.sin(np.deg2rad(135))])

F2 = T*np.array([np.cos(theta),
                 -np.sin(theta)])

R = F1 + F2
mag = np.linalg.norm(R)

print(R, mag)
`,
    lightMode: true,
  },
];
const unit3Problems: CodeProblemEntry[] = [];
const unit4Problems: CodeProblemEntry[] = [
  {
    problem: {
      title: 'Method Joints',
      imageUrl: 'https://us.prairielearn.com/pl/course_instance/206302/instance_question/663088205/clientFilesQuestion/trussMethodJoints.png',
      description:
        'Consider the truss system below. Given that P = 93 kN, d = 100cm, h = 75 cm. Using the method of joints, determine the forces in members DG, CD, FG, and CG.',
      code: `import numpy as np

F = 93.0 # kN
d = 100.0 # cm
h = 75.0 # cm`,
    },
    answerTitle: 'Python Solution',
    answerCode: `import numpy as np

F = 93.0 # kN
d = 100.0 # cm
h = 75.0 # cm
L = np.hypot(d, h)

sin = h/L
cos = d/L

FDG = -F/sin
FCD = -FDG*cos
FFG = -FCD
FCG = F

print(FDG, FCD, FFG, FCG)`,
  },
  {
    problem: {
      title: 'Vertical truss - Method of joints',
      imageUrl: 'https://us.prairielearn.com/pl/course_instance/206302/instance_question/663088200/clientFilesQuestion/Truss.png',
      description:
        'Use the method of joints to solve for the reaction forces at a and c from the force F applied at point g in the negative x-direction. Assume that joint c is pinned and that joint a is a roller joint such that it offers a reaction force parallel to the x-axis. Assume points d, e, and f to make up a vertical line. Find Fa and Fc.',
      code: `import numpy as np

F = 107.0 # kN
L = 13.4 # m`,
    },
    answerTitle: 'Python Solution',
    answerCode: `import numpy as np
F = 107.0 # kN
L = 13.4 # m

Fa, Fc = F / 2
print(Fa, Fc)`,
  },
  {
    problem: {
      title: 'A Machine Problem',
      imageUrl: 'https://us.prairielearn.com/pl/course_instance/206302/instance_question/670774544/clientFilesQuestion/Presentation1.png',
      description:
        'Can crushers help us recycle in a space efficient way which is good for saving the earth and for giving you more room in your apartment. Let us model the illustrated crusher as a planar mechanism that is subjected to the pushing force P on the lower "L-shaped" handle, i.e. link CDE. Note that link CDE is one solid piece, pinned at D and E. Knowing that the orange horizontal member AB has a square peg at A that slides vertically in the slot on the blue frame, that the can is centered under the pin at B, determine the force magnitude F in N exerted on the can from the mechanism.',
      code: `import numpy as np

P = 60.0 # N
theta = 5.0 # deg
phi = 5.0 # deg
a = 60.0 # mm
b = 245.0 # mm
c = 80.0 # mm
d = 20.0 # mm`,
    },
    answerTitle: 'Python Solution',
    answerCode: `import numpy as np

P = 60.0 # N
theta = 5.0 # deg
phi = 5.0 # deg
a = 60.0 # mm
b = 245.0 # mm
c = 80.0 # mm
d = 20.0 # mm

theta = np.deg2rad(theta)
phi = np.deg2rad(phi)

F = P * ((a+b)*np.cos(theta) + (c+d)*np.sin(theta)) / (a - c*np.tan(phi))`,
  },
  {
    problem: {
      title: 'Force on the cork',
      imageUrl: 'https://us.prairielearn.com/pl/course_instance/206302/instance_question/670774545/clientFilesQuestion/frame10.png',
      description:
        'The diameter of the bottle seal (the widest part of the neck, pictured in red) is 0.022 m. How much vertical force will be applied to the cork for pulling it out? Assume points a, b, and c are horizontal with each other.',
      code: `import numpy as np

L1 = 0.140 # m
L2 = 0.070 # m
L3 = 0.070 # m
L4 = 0.008 # m
L5 = 0.006 # m
F = 249.000 # N
theta = 72.000 # deg`,
  },
  answerTitle: 'Python Solution',
  answerCode: `import numpy as np

L1 = 0.140 # m
L2 = 0.070 # m
L3 = 0.070 # m
L4 = 0.008 # m
L5 = 0.006 # m
F = 249.000 # N
theta = 72.000 # deg

theta = np.deg2rad(theta)
F = ((L1+L2)*F*np.sin(theta)) / L2`,
  },
  {
    problem: {
      title: 'Basic Frame Problem',
      imageUrl: `${base}tam/4B5.png`,
      description:
        'Beams ac, bd, df, and cg are pinned together at all intersections to make a frame. Forces F1 and F2 act perpendicularly to members ac and df, respectively. Assuming that the frame is pinned to the ground at points a and g, and neglecting the weight of the frame, calculate the magnitude of the force acting in member bd. Note that b and e are horizontal and that the beams at joint d form a right angle.',
      code: `import numpy as np

F1 = 40 # N
F2 = 35 # N
ag = 9 # m
ab = 6 # m
bc = 6 # m
de = 3 # m
ef = 3 # m`,
    },
    answerTitle: 'Solution',
    answerCode: `Fbd = F2 * ef / de`,
    explanation:
      'This member force follows from the moment arm ratio between the applied force and the geometry of the frame.',
    lightMode: true,
  },
];
const unit5Problems: CodeProblemEntry[] = [];

export function Simulations() {
  return (
    <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
        <div className="absolute -left-40 top-0 h-72 w-72 rounded-full bg-sky-700/30 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-blue-500/25 blur-3xl" />
      </div>

      <header className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">Code practice</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
          TAM 211: Statics
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
          This page contains code problems for TAM211 homeworks. Each problem has a
          "Show Answer" button that reveals a sample solution in Python. The problems
          are organized by unit. Please note that the problem data might not be the same as the actual homework problems, but they are meant to be similar in style and content for practice purposes.
        </p>
      </header>

      <div className="flex flex-col gap-12">
        <section>
          <h2 className="border-b border-slate-800 pb-2 text-sm font-semibold uppercase tracking-[0.15em] text-sky-300">
            Unit 1
          </h2>
          {unit1Problems.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-700/80 bg-slate-900/50 p-6 text-left">
              <p className="text-sm text-slate-300">Add Unit 1 problems to the unit1Problems array.</p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4">
              {unit1Problems.map((entry, index) => (
                <CodeProblemCard
                  key={`unit1-${entry.problem.title}-${index}`}
                  problem={entry.problem}
                  answerCode={entry.answerCode}
                  answerTitle={entry.answerTitle}
                  explanation={entry.explanation}
                  lightMode={entry.lightMode}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="border-b border-slate-800 pb-2 text-sm font-semibold uppercase tracking-[0.15em] text-emerald-300/90">
            Unit 2
          </h2>
          {unit2Problems.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-700/80 bg-slate-900/50 p-6 text-left">
              <p className="text-sm text-slate-300">Add Unit 2 problems to the unit2Problems array.</p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4">
              {unit2Problems.map((entry, index) => (
                <CodeProblemCard
                  key={`unit2-${entry.problem.title}-${index}`}
                  problem={entry.problem}
                  answerCode={entry.answerCode}
                  answerTitle={entry.answerTitle}
                  explanation={entry.explanation}
                  lightMode={entry.lightMode}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="border-b border-slate-800 pb-2 text-sm font-semibold uppercase tracking-[0.15em] text-fuchsia-300/90">
            Unit 3
          </h2>
          {unit3Problems.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-700/80 bg-slate-900/50 p-6 text-left">
              <p className="text-sm text-slate-300">Add Unit 3 problems to the unit3Problems array.</p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4">
              {unit3Problems.map((entry, index) => (
                <CodeProblemCard
                  key={`unit3-${entry.problem.title}-${index}`}
                  problem={entry.problem}
                  answerCode={entry.answerCode}
                  answerTitle={entry.answerTitle}
                  explanation={entry.explanation}
                  lightMode={entry.lightMode}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="border-b border-slate-800 pb-2 text-sm font-semibold uppercase tracking-[0.15em] text-amber-300/90">
            Unit 4
          </h2>
          {unit4Problems.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-700/80 bg-slate-900/50 p-6 text-left">
              <p className="text-sm text-slate-300">Add Unit 4 problems to the unit4Problems array.</p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4">
              {unit4Problems.map((entry, index) => (
                <CodeProblemCard
                  key={`unit4-${entry.problem.title}-${index}`}
                  problem={entry.problem}
                  answerCode={entry.answerCode}
                  answerTitle={entry.answerTitle}
                  explanation={entry.explanation}
                  lightMode={entry.lightMode}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="border-b border-slate-800 pb-2 text-sm font-semibold uppercase tracking-[0.15em] text-violet-300/90">
            Unit 5
          </h2>
          {unit5Problems.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-700/80 bg-slate-900/50 p-6 text-left">
              <p className="text-sm text-slate-300">Coming soon!</p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4">
              {unit5Problems.map((entry, index) => (
                <CodeProblemCard
                  key={`unit5-${entry.problem.title}-${index}`}
                  problem={entry.problem}
                  answerCode={entry.answerCode}
                  answerTitle={entry.answerTitle}
                  explanation={entry.explanation}
                  lightMode={entry.lightMode}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
