import { Link } from 'react-router-dom';

const LAST_UPDATED = 'June 17, 2026';

type Section = {
	id: string;
	title: string;
	body: string[];
};

const SECTIONS: Section[] = [
	{
		id: 'agreement',
		title: 'Agreement to Our Legal Terms',
		body: [
			'By accessing or using PhysicsSims, you agree to be bound by these Legal Terms and any incorporated policies.',
			'If you do not agree with all of these Legal Terms, you are expressly prohibited from using the Services and must discontinue use immediately.',
			'We may update these Legal Terms at any time, and your continued use after updates means you accept the revised terms.',
		],
	},
	{
		id: 'services',
		title: '1. Our Services',
		body: [
			'PhysicsSims provides browser-based educational simulations and related services.',
			'The Services are intended for use in jurisdictions where such access is lawful, and they are not tailored to specific industry compliance regimes.',
		],
	},
	{
		id: 'ip',
		title: '2. Intellectual Property Rights',
		body: [
			'We own or license the intellectual property in the Services, including source code, software, design, text, and graphics.',
			'The Services and Content are provided for personal, non-commercial use or internal business purpose only unless we grant additional permission.',
			'You may not copy, reproduce, distribute, sell, or otherwise exploit the Services or Content outside the permissions granted in these Terms.',
		],
	},
	{
		id: 'userreps',
		title: '3. User Representations',
		body: [
			'By using the Services, you confirm that you have the legal capacity to agree to these Terms and that your use complies with applicable law.',
			'If you are a minor in your jurisdiction, you must have parental permission to use the Services.',
			'You agree not to access the Services through automated or non-human means, and you will not use the Services for illegal or unauthorized purposes.',
		],
	},
	{
		id: 'prohibited',
		title: '4. Prohibited Activities',
		body: [
			'You may not systematically retrieve data, circumvent security features, disparage or harm the Services, or use the Services to harass or deceive others.',
			'You may not interfere with the Services, upload malicious material, scrape the site, impersonate others, or use the Services for revenue-generating activity without permission.',
		],
	},
	{
		id: 'ugc',
		title: '5. User Generated Contributions',
		body: [
			'If the Services allow Contributions, you are responsible for ensuring they do not infringe third-party rights or violate applicable law.',
			'Your Contributions must be lawful, not misleading, not harmful, and not used for spam, solicitation, impersonation, or other abusive conduct.',
		],
	},
	{
		id: 'license',
		title: '6. Contribution License',
		body: [
			'By sending suggestions or feedback, you allow us to use that feedback without compensation to you for any lawful purpose.',
			'You retain ownership of your Contributions, but you are responsible for what you submit and for ensuring you have the rights to do so.',
		],
	},
	{
		id: 'thirdparty',
		title: '7. Third-Party Websites And Content',
		body: [
			'The Services may include links to third-party websites or content.',
			'We do not monitor or endorse third-party sites or content and are not responsible for their accuracy, policies, or practices.',
		],
	},
	{
		id: 'sitemanage',
		title: '8. Services Management',
		body: [
			'We reserve the right to monitor the Services for violations of these Terms and to take appropriate action when necessary.',
			'We may remove content, restrict access, or otherwise manage the Services to protect our rights and ensure proper operation.',
		],
	},
	{
		id: 'ppyes',
		title: '9. Privacy Policy',
		body: [
			'We care about data privacy and security. Please review our Privacy Policy at /privacy.',
			'By using the Services, you agree to the Privacy Policy, which is incorporated into these Legal Terms.',
			'The Services are hosted in the United States, and by using them from another region you consent to transfer and processing of your data in the United States.',
		],
	},
	{
		id: 'terms',
		title: '10. Term And Termination',
		body: [
			'These Terms remain in full force while you use the Services.',
			'We may deny access, block IP addresses, suspend use, or terminate use at any time for any reason, including violations of these Terms or applicable law.',
		],
	},
	{
		id: 'modifications',
		title: '11. Modifications And Interruptions',
		body: [
			'We may change, modify, suspend, or discontinue the Services at any time without notice.',
			'We are not liable for any interruption, downtime, or service modification, and we do not guarantee the Services will always be available.',
		],
	},
	{
		id: 'law',
		title: '12. Governing Law',
		body: [
			'These Legal Terms are governed by the laws of the State of Illinois, without regard to conflict-of-law principles.',
		],
	},
	{
		id: 'disputes',
		title: '13. Dispute Resolution',
		body: [
			'If a dispute arises, the parties should first attempt informal negotiation for a reasonable period before pursuing formal action.',
			'If arbitration or court proceedings become necessary, the dispute will be handled in the applicable courts and venue described by these Terms.',
		],
	},
	{
		id: 'corrections',
		title: '14. Corrections',
		body: [
			'We reserve the right to correct errors, inaccuracies, or omissions in the Services at any time without prior notice.',
		],
	},
	{
		id: 'disclaimer',
		title: '15. Disclaimer',
		body: [
			'The Services are provided on an as-is and as-available basis.',
			'We disclaim warranties to the fullest extent permitted by law and do not guarantee the accuracy, completeness, or availability of the Services or linked third-party content.',
		],
	},
	{
		id: 'liability',
		title: '16. Limitations Of Liability',
		body: [
			'To the fullest extent permitted by law, we will not be liable for indirect, incidental, consequential, special, or punitive damages arising from your use of the Services.',
			'Our total liability for claims related to the Services will be limited as described in these Terms and applicable law.',
		],
	},
	{
		id: 'indemnification',
		title: '17. Indemnification',
		body: [
			'You agree to defend, indemnify, and hold us harmless from claims, liabilities, damages, and expenses arising from your misuse of the Services or violation of these Terms.',
		],
	},
	{
		id: 'userdata',
		title: '18. User Data',
		body: [
			'We may maintain certain data that you transmit to the Services for operational purposes.',
			'Although we may perform routine backups, you are solely responsible for your transmitted data and waive claims arising from its loss or corruption.',
		],
	},
	{
		id: 'electronic',
		title: '19. Electronic Communications, Transactions, And Signatures',
		body: [
			'By using the Services, you consent to receive electronic communications and agree that electronic notices, records, and signatures satisfy legal writing requirements.',
		],
	},
	{
		id: 'california',
		title: '20. California Users And Residents',
		body: [
			'California residents may have specific complaint rights under applicable law.',
			'If you need to raise a complaint, use the contact information below or the site footer contact channel.',
		],
	},
	{
		id: 'misc',
		title: '21. Miscellaneous',
		body: [
			'These Terms and any posted policies form the entire agreement between you and us.',
			'If any part of these Terms is unenforceable, the remainder stays in effect, and our failure to enforce a right does not waive that right.',
		],
	},
	{
		id: 'contact',
		title: '22. Contact Us',
		body: [
			'If you have questions or comments about these Legal Terms, contact us using the site footer contact channel.',
		],
	},
];

export function TOS() {
	return (
		<div className="min-h-screen bg-[#05080d] text-white">
			<main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
				<header className="border-b border-white/10 pb-6">
					<p className="text-xs uppercase tracking-[0.2em] text-sky-300/70">Legal</p>
					<h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Terms of Service</h1>
					<p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">
						These Legal Terms govern your access to and use of PhysicsSims. Please read them carefully before using the platform.
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
						These Legal Terms constitute a binding agreement between you and IlliniOpenEdu concerning your access to and use of the Services. By accessing the Services, you agree to be bound by these Terms.
					</p>

					<div>
						<h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-200">Table of Contents</h2>
						<ul className="mt-3 space-y-2">
							{SECTIONS.map((section) => (
								<li key={section.id}>
									<a href={`#${section.id}`} className="text-sky-300 transition hover:text-sky-200">
										{section.title}
									</a>
								</li>
							))}
						</ul>
					</div>

					{SECTIONS.map((section) => (
						<article key={section.id} id={section.id} className="scroll-mt-24">
							<h2 className="text-xl font-semibold text-slate-100">{section.title}</h2>
							<div className="mt-3 space-y-3">
								{section.body.map((paragraph) => (
									<p key={paragraph}>{paragraph}</p>
								))}
							</div>
						</article>
					))}
				</section>
			</main>
		</div>
	);
}

