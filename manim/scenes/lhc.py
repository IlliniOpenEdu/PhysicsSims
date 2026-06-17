from manim import *
import numpy as np


class LHCCollegeExplainer(Scene):
    def construct(self):
        self.camera.background_color = "#050914"
        self.intro()
        self.geometry()
        self.lorentzForce()
        self.rfAcceleration()
        self.relativisticEnergy()
        self.collisionAndLuminosity()
        self.detectorPhysics()
        self.eventReconstruction()
        self.outro()

    def intro(self):
        title = Text("The Large Hadron Collider", font_size=48, weight=BOLD)
        subtitle = Text("not a microscope — a relativistic scattering experiment", font_size=26, color=YELLOW)
        subtitle.next_to(title, DOWN, buff=0.3)

        eq = MathTex(r"E^2=(pc)^2+(mc^2)^2", font_size=46, color=BLUE_B)
        eq.next_to(subtitle, DOWN, buff=0.55)

        self.play(FadeIn(title, shift=DOWN), FadeIn(subtitle, shift=DOWN))
        self.play(Write(eq))
        self.wait(1.5)
        self.play(FadeOut(title), FadeOut(subtitle), FadeOut(eq))

    def geometry(self):
        heading = Text("1. Geometry of the machine", font_size=34).to_edge(UP)
        ring = Circle(radius=2.7, stroke_width=8, color=GRAY_B)
        beamPipe = Circle(radius=2.45, stroke_width=2, color=YELLOW).set_opacity(0.55)

        labels = VGroup(
            MathTex(r"C\approx 26.7\,\text{km}", font_size=34),
            MathTex(r"R\approx 4.25\,\text{km}", font_size=34),
            Text("two counter-rotating proton beams", font_size=24, color=GRAY_A),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.25).to_corner(DR)

        magnets = VGroup()
        for i in range(32):
            a = i * TAU / 32
            block = RoundedRectangle(width=0.38, height=0.16, corner_radius=0.03)
            block.set_stroke(YELLOW, 1).set_fill(YELLOW, 0.35)
            block.move_to(3.08 * np.array([np.cos(a), np.sin(a), 0]))
            block.rotate(a)
            magnets.add(block)

        self.play(FadeIn(heading), Create(ring), Create(beamPipe))
        self.play(LaggedStartMap(FadeIn, magnets, lag_ratio=0.025), Write(labels))
        self.wait(1.5)
        self.play(FadeOut(heading), FadeOut(labels))
        self.ring = VGroup(ring, beamPipe, magnets)

    def lorentzForce(self):
        heading = Text("2. Bending protons requires magnetic rigidity", font_size=32).to_edge(UP)
        eq1 = MathTex(r"\vec F=q\vec v\times \vec B", font_size=42)
        eq2 = MathTex(r"p=qBR", font_size=42, color=YELLOW)
        eq3 = MathTex(r"B\approx 8.3\,\text{T}\quad \Rightarrow\quad p\approx 7\,\text{TeV}/c", font_size=34)
        equations = VGroup(eq1, eq2, eq3).arrange(DOWN, buff=0.35).to_edge(RIGHT)

        proton = Dot(color=BLUE, radius=0.08).move_to(RIGHT * 2.45)
        path = Circle(radius=2.45)

        bField = VGroup()
        for x in np.linspace(-2.1, 2.1, 5):
            for y in np.linspace(-2.1, 2.1, 5):
                dot = Dot([x, y, 0], radius=0.025, color=BLUE_B).set_opacity(0.55)
                circ = Circle(radius=0.08, color=BLUE_B, stroke_width=1).move_to(dot)
                bField.add(VGroup(dot, circ))

        self.play(FadeIn(heading), FadeIn(bField), Write(eq1))
        self.play(MoveAlongPath(proton, path), run_time=2.5, rate_func=linear)
        self.play(TransformMatchingTex(eq1.copy(), eq2))
        self.play(Write(eq3))
        self.wait(1.2)
        self.play(FadeOut(heading), FadeOut(equations), FadeOut(bField), FadeOut(proton))

    def rfAcceleration(self):
        heading = Text("3. RF cavities restore longitudinal energy", font_size=32).to_edge(UP)
        pipe = Line(LEFT * 5, RIGHT * 5, stroke_width=8, color=GRAY_B)
        wave = FunctionGraph(lambda x: 0.45 * np.sin(3.5 * x), x_range=[-5, 5], color=YELLOW)
        cavity = RoundedRectangle(width=1.3, height=1.7, corner_radius=0.18, color=YELLOW)
        cavity.set_fill(YELLOW, 0.12)

        eq = MathTex(r"\Delta E=q\int \vec E\cdot d\vec \ell", font_size=44).to_edge(DOWN)
        note = Text("transverse magnets steer; longitudinal electric fields accelerate", font_size=24, color=GRAY_A)
        note.next_to(heading, DOWN, buff=0.3)

        bunches = VGroup(*[Dot(LEFT * (4.5 + i * 0.18), color=BLUE, radius=0.055) for i in range(5)])

        self.play(FadeIn(heading), FadeIn(note), Create(pipe), FadeIn(cavity), Create(wave))
        self.play(Write(eq))
        self.play(bunches.animate.shift(RIGHT * 9), run_time=3.0, rate_func=linear)
        self.wait(0.8)
        self.play(FadeOut(heading), FadeOut(note), FadeOut(pipe), FadeOut(wave), FadeOut(cavity), FadeOut(eq), FadeOut(bunches))

    def relativisticEnergy(self):
        heading = Text("4. The protons are not moving much faster — gamma is exploding", font_size=30).to_edge(UP)
        equations = VGroup(
            MathTex(r"\gamma=\frac{1}{\sqrt{1-v^2/c^2}}", font_size=42),
            MathTex(r"E=\gamma mc^2", font_size=42, color=YELLOW),
            MathTex(r"7\,\text{TeV}\gg 0.938\,\text{GeV}", font_size=40),
            MathTex(r"v\approx c\quad \text{but}\quad p,E\ \text{keep increasing}", font_size=34, color=GRAY_A),
        ).arrange(DOWN, buff=0.35)

        axis = Axes(
            x_range=[0, 0.999, 0.2],
            y_range=[1, 25, 5],
            x_length=5.5,
            y_length=3.2,
            tips=False,
        ).to_edge(LEFT).shift(DOWN * 0.25)
        curve = axis.plot(lambda x: 1 / np.sqrt(1 - x * x), x_range=[0, 0.999], color=YELLOW)
        xlab = MathTex(r"v/c", font_size=28).next_to(axis.x_axis, DOWN)
        ylab = MathTex(r"\gamma", font_size=28).next_to(axis.y_axis, LEFT)

        equations.to_edge(RIGHT)

        self.play(FadeIn(heading), Create(axis), FadeIn(xlab), FadeIn(ylab))
        self.play(Create(curve), LaggedStartMap(Write, equations, lag_ratio=0.2))
        self.wait(2)
        self.play(FadeOut(heading), FadeOut(axis), FadeOut(curve), FadeOut(xlab), FadeOut(ylab), FadeOut(equations))

    def collisionAndLuminosity(self):
        heading = Text("5. The physics happens in parton-parton collisions", font_size=31).to_edge(UP)
        proton1 = Circle(radius=0.55, color=BLUE, stroke_width=3).shift(LEFT * 3)
        proton2 = Circle(radius=0.55, color=RED, stroke_width=3).shift(RIGHT * 3)

        quarks1 = VGroup(*[Dot(proton1.get_center() + 0.32 * np.array([np.cos(a), np.sin(a), 0]), color=BLUE_B) for a in [0.5, 2.5, 4.3]])
        quarks2 = VGroup(*[Dot(proton2.get_center() + 0.32 * np.array([np.cos(a), np.sin(a), 0]), color=RED_B) for a in [1.2, 3.3, 5.1]])

        eqs = VGroup(
            MathTex(r"pp\rightarrow X", font_size=42),
            MathTex(r"\hat{s}=x_1x_2s", font_size=42, color=YELLOW),
            MathTex(r"N=\mathcal{L}\sigma", font_size=42),
        ).arrange(DOWN, buff=0.35).to_edge(DOWN)

        self.play(FadeIn(heading), FadeIn(proton1), FadeIn(proton2), FadeIn(quarks1), FadeIn(quarks2))
        self.play(Write(eqs[0]))
        self.play(proton1.animate.move_to(ORIGIN), proton2.animate.move_to(ORIGIN), run_time=1.3, rate_func=rush_into)

        burst = self.makeBurst(34, 2.5)
        self.play(FadeOut(proton1), FadeOut(proton2), FadeOut(quarks1), FadeOut(quarks2), Create(burst), Write(eqs[1]))
        self.play(Write(eqs[2]))
        self.wait(1.5)
        self.play(FadeOut(heading), FadeOut(burst), FadeOut(eqs))

    def detectorPhysics(self):
        heading = Text("6. Detectors infer particles from curvature and deposits", font_size=30).to_edge(UP)
        detector = VGroup(
            Circle(radius=0.75, color=GRAY_A, stroke_width=2),
            Circle(radius=1.25, color=BLUE_B, stroke_width=3),
            Circle(radius=1.8, color=YELLOW, stroke_width=3),
            Circle(radius=2.35, color=RED_B, stroke_width=3),
            Circle(radius=2.9, color=GRAY_B, stroke_width=3),
        )

        labels = VGroup(
            Text("tracker", font_size=22, color=BLUE_B),
            Text("ECAL", font_size=22, color=YELLOW),
            Text("HCAL", font_size=22, color=RED_B),
            Text("muon chambers", font_size=22, color=GRAY_A),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.15).to_edge(RIGHT)

        eq = MathTex(r"r=\frac{p_T}{qB}", font_size=44).to_edge(DOWN)

        tracks = VGroup()
        for i in range(18):
            angle = i * TAU / 18
            radius = 0.6 + 0.06 * i
            arc = Arc(
                radius=radius,
                start_angle=angle,
                angle=(0.7 + 0.35 * np.sin(i)) * PI,
                color=[BLUE_B, YELLOW, RED_B, GREEN_B][i % 4],
                stroke_width=3,
            )
            tracks.add(arc)

        self.play(FadeIn(heading), LaggedStartMap(Create, detector, lag_ratio=0.12), FadeIn(labels))
        self.play(Write(eq), LaggedStartMap(Create, tracks, lag_ratio=0.04), run_time=2.2)
        self.wait(2)
        self.play(FadeOut(heading), FadeOut(detector), FadeOut(labels), FadeOut(eq), FadeOut(tracks))

    def eventReconstruction(self):
        heading = Text("7. Reconstruction is an inverse problem", font_size=32).to_edge(UP)
        left = VGroup(
            Text("raw detector hits", font_size=25, color=GRAY_A),
            MathTex(r"\{x_i,t_i,E_i\}", font_size=42),
        ).arrange(DOWN, buff=0.3).shift(LEFT * 4)

        middle = VGroup(
            Text("fit tracks + clusters", font_size=25, color=GRAY_A),
            MathTex(r"\chi^2=\sum_i\frac{(y_i-f_i(\theta))^2}{\sigma_i^2}", font_size=38, color=YELLOW),
        ).arrange(DOWN, buff=0.3)

        right = VGroup(
            Text("physics objects", font_size=25, color=GRAY_A),
            MathTex(r"e,\mu,\gamma,jets,E_T^{miss}", font_size=40),
        ).arrange(DOWN, buff=0.3).shift(RIGHT * 4)

        arrow1 = Arrow(left.get_right(), middle.get_left(), buff=0.3)
        arrow2 = Arrow(middle.get_right(), right.get_left(), buff=0.3)

        higgs = MathTex(r"H\rightarrow ZZ^*\rightarrow 4\ell", font_size=48, color=YELLOW).to_edge(DOWN)
        mass = MathTex(r"m_{4\ell}^2=\left(\sum_{k=1}^4 p_k^\mu\right)^2", font_size=40).next_to(higgs, UP, buff=0.35)

        self.play(FadeIn(heading), FadeIn(left))
        self.play(GrowArrow(arrow1), FadeIn(middle))
        self.play(GrowArrow(arrow2), FadeIn(right))
        self.play(Write(mass), Write(higgs))
        self.wait(2.3)
        self.play(FadeOut(heading), FadeOut(left), FadeOut(middle), FadeOut(right), FadeOut(arrow1), FadeOut(arrow2), FadeOut(mass), FadeOut(higgs))

    def outro(self):
        final = VGroup(
            Text("The LHC does not directly 'see' particles.", font_size=34),
            Text("It statistically reconstructs quantum events from detector signatures.", font_size=28, color=GRAY_A),
            MathTex(r"\text{theory}\rightarrow\text{collision}\rightarrow\text{detector}\rightarrow\text{likelihood}\rightarrow\text{discovery}", font_size=34, color=YELLOW),
        ).arrange(DOWN, buff=0.45)

        self.play(LaggedStartMap(FadeIn, final, lag_ratio=0.2))
        self.wait(3)
        self.play(FadeOut(final), FadeOut(self.ring))

    def makeBurst(self, count, length):
        burst = VGroup()
        for i in range(count):
            angle = i * TAU / count
            mag = length * (0.55 + 0.45 * np.sin(i * 1.7) ** 2)
            ray = Line(
                ORIGIN,
                mag * np.array([np.cos(angle), np.sin(angle), 0]),
                color=[YELLOW, BLUE_B, RED_B, GREEN_B][i % 4],
                stroke_width=3,
            )
            burst.add(ray)
        return burst
