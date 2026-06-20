import { Link } from 'react-router-dom';

const LAST_UPDATED = 'June 17, 2026';

export function Privacy() {
	return (
		<div className="min-h-screen bg-[#05080d] text-white">
			<main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
				<header className="border-b border-white/10 pb-6">
					<p className="text-xs uppercase tracking-[0.2em] text-sky-300/70">Legal</p>
					<h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Privacy Policy</h1>
					<p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">
						This Privacy Notice explains what information PhysicsSims processes, why we process it, and the choices you have.
					</p>
					<div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-slate-400">
						<span>Last updated: {LAST_UPDATED}</span>
						<Link to="/" className="text-sky-300 transition hover:text-sky-200">
							Back to Home
						</Link>
					</div>
				</header>

				<section className="mt-8 space-y-8 text-sm leading-relaxed text-slate-300">
					<p>
						This Privacy Notice for IlliniOpenEdu ("we," "us," or "our") describes how and why we might access, collect, store, use, and/or share your personal information when you use our services, including when you visit our website, engage with the site in other related ways, or contact us.
					</p>

					<div>
						<h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-200">Summary of Key Points</h2>
						<ul className="mt-3 list-disc space-y-2 pl-5">
							<li>We do not intentionally collect personal information from visitors through normal use of the site.</li>
							<li>We do not process sensitive personal information.</li>
							<li>We do not collect information from third parties.</li>
							<li>We process information to provide, improve, and administer the Services, communicate with you, and maintain security.</li>
							<li>We may use cookies and similar technologies for basic site operation and analytics after consent.</li>
					</ul>
					</div>

					<div>
						<h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-200">Table of Contents</h2>
						<ul className="mt-3 space-y-2">
							<li><a href="#infocollect" className="text-sky-300 transition hover:text-sky-200">1. What Information Do We Collect?</a></li>
							<li><a href="#infouse" className="text-sky-300 transition hover:text-sky-200">2. How Do We Process Your Information?</a></li>
							<li><a href="#whoshare" className="text-sky-300 transition hover:text-sky-200">3. When And With Whom Do We Share Your Personal Information?</a></li>
							<li><a href="#cookies" className="text-sky-300 transition hover:text-sky-200">4. Do We Use Cookies And Other Tracking Technologies?</a></li>
							<li><a href="#inforetain" className="text-sky-300 transition hover:text-sky-200">5. How Long Do We Keep Your Information?</a></li>
							<li><a href="#infosafe" className="text-sky-300 transition hover:text-sky-200">6. How Do We Keep Your Information Safe?</a></li>
							<li><a href="#infominors" className="text-sky-300 transition hover:text-sky-200">7. Do We Collect Information From Minors?</a></li>
							<li><a href="#privacyrights" className="text-sky-300 transition hover:text-sky-200">8. What Are Your Privacy Rights?</a></li>
							<li><a href="#DNT" className="text-sky-300 transition hover:text-sky-200">9. Controls For Do-Not-Track Features</a></li>
							<li><a href="#uslaws" className="text-sky-300 transition hover:text-sky-200">10. Do United States Residents Have Specific Privacy Rights?</a></li>
							<li><a href="#policyupdates" className="text-sky-300 transition hover:text-sky-200">11. Do We Make Updates To This Notice?</a></li>
							<li><a href="#contact" className="text-sky-300 transition hover:text-sky-200">12. How Can You Contact Us About This Notice?</a></li>
							<li><a href="#request" className="text-sky-300 transition hover:text-sky-200">13. How Can You Review, Update, Or Delete The Data We Collect From You?</a></li>
						</ul>
					</div>

					<article id="infocollect" className="scroll-mt-24">
						<h2 className="text-xl font-semibold text-slate-100">1. What Information Do We Collect?</h2>
						<p className="mt-3">
							We collect personal information that you voluntarily provide to us when you express interest in obtaining information about us or our Services, when you participate in activities on the Services, or otherwise when you contact us.
						</p>
						<p className="mt-3">
							We also automatically collect certain technical and usage data when you visit or use the Services. This may include your IP address, browser and device characteristics, operating system, language preferences, referring URLs, and other interaction data needed to maintain and improve the site.
						</p>
						<p className="mt-3">
							We may also collect information through cookies and similar technologies.
						</p>
					</article>

					<article id="infouse" className="scroll-mt-24">
						<h2 className="text-xl font-semibold text-slate-100">2. How Do We Process Your Information?</h2>
						<p className="mt-3">
							We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law. We may also process information for other purposes with your consent.
						</p>
						<ul className="mt-3 list-disc space-y-2 pl-5">
							<li>To provide and maintain our Services.</li>
							<li>To improve and evaluate our Services and user experience.</li>
							<li>To identify usage trends and monitor performance.</li>
						</ul>
					</article>

					<article id="whoshare" className="scroll-mt-24">
						<h2 className="text-xl font-semibold text-slate-100">3. When And With Whom Do We Share Your Personal Information?</h2>
						<p className="mt-3">
							We may share information in specific situations described in this section and with service providers that help us operate the Services.
						</p>
						<p className="mt-3">
							We may disclose information in connection with business transfers, legal compliance, security, and service operation.
						</p>
					</article>

					<article id="cookies" className="scroll-mt-24">
						<h2 className="text-xl font-semibold text-slate-100">4. Do We Use Cookies And Other Tracking Technologies?</h2>
						<p className="mt-3">
							We may use cookies and similar tracking technologies to gather information when you interact with our Services. Some of these technologies help us maintain security, prevent crashes, fix bugs, save preferences, and support basic site functions.
						</p>
						<p className="mt-3">
							We may also permit third parties and service providers to use tracking technologies for analytics. If those technologies are treated as a sale or sharing under applicable law, you may be able to opt out as described in the privacy rights section below.
						</p>
					</article>

					<article id="inforetain" className="scroll-mt-24">
						<h2 className="text-xl font-semibold text-slate-100">5. How Long Do We Keep Your Information?</h2>
						<p className="mt-3">
							We keep your personal information for as long as necessary to fulfill the purposes outlined in this Privacy Notice unless a longer retention period is required or permitted by law.
						</p>
					</article>

					<article id="infosafe" className="scroll-mt-24">
						<h2 className="text-xl font-semibold text-slate-100">6. How Do We Keep Your Information Safe?</h2>
						<p className="mt-3">
							We aim to protect your personal information through a system of organizational and technical security measures. However, no electronic transmission over the Internet can be guaranteed to be 100% secure.
						</p>
					</article>

					<article id="infominors" className="scroll-mt-24">
						<h2 className="text-xl font-semibold text-slate-100">7. Do We Collect Information From Minors?</h2>
						<p className="mt-3">
							We do not knowingly collect data from or market to children under 18 years of age. If we learn that personal information from a child under 18 has been collected, we will take reasonable steps to delete it.
						</p>
					</article>

					<article id="privacyrights" className="scroll-mt-24">
						<h2 className="text-xl font-semibold text-slate-100">8. What Are Your Privacy Rights?</h2>
						<p className="mt-3">
							Depending on where you live, you may have certain rights regarding your personal information, including rights to know, access, correct, delete, obtain a copy of, or opt out of certain processing activities.
						</p>
						<p className="mt-3">
							You may also have the right to withdraw consent where processing is based on consent. Some rights may be limited in certain circumstances by applicable law.
						</p>
					</article>

					<article id="DNT" className="scroll-mt-24">
						<h2 className="text-xl font-semibold text-slate-100">9. Controls For Do-Not-Track Features</h2>
						<p className="mt-3">
							Most web browsers and some mobile operating systems include a Do-Not-Track feature or setting. Because no uniform standard for recognizing and implementing DNT signals has been finalized, we do not currently respond to DNT browser signals.
						</p>
					</article>

					<article id="uslaws" className="scroll-mt-24">
						<h2 className="text-xl font-semibold text-slate-100">10. Do United States Residents Have Specific Privacy Rights?</h2>
						<p className="mt-3">
							If you are a resident of certain U.S. states, you may have rights to request access to personal information we maintain about you, details about how it has been processed, corrections, deletion, or a copy of your information. You may also have the right to withdraw consent in some cases.
						</p>
						<p className="mt-3">
							To exercise your rights, contact us using the methods below. We may need to verify your identity before responding.
						</p>
					</article>

					<article id="policyupdates" className="scroll-mt-24">
						<h2 className="text-xl font-semibold text-slate-100">11. Do We Make Updates To This Notice?</h2>
						<p className="mt-3">
							Yes, we will update this notice as necessary to stay compliant with relevant laws. The updated version will be indicated by a revised date at the top of this Privacy Policy.
						</p>
					</article>

					<article id="contact" className="scroll-mt-24">
						<h2 className="text-xl font-semibold text-slate-100">12. How Can You Contact Us About This Notice?</h2>
						<p className="mt-3">
							If you have questions or comments about this notice, you may contact us by post using the contact details provided by the site.
						</p>
					</article>

					<article id="request" className="scroll-mt-24">
						<h2 className="text-xl font-semibold text-slate-100">13. How Can You Review, Update, Or Delete The Data We Collect From You?</h2>
						<p className="mt-3">
							Based on applicable laws, you may have the right to request access, correction, or deletion of the personal information we collect from you. To make such a request, contact us using the contact details above.
						</p>
					</article>
				</section>
			</main>
		</div>
	);
}