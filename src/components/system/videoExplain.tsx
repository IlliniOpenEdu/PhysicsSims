import { useEffect, useId, useState } from 'react';

type VideoExplainProps = {
	videoSrc: string;
	posterSrc?: string;
	title?: string;
	description?: string;
	buttonLabel?: string;
	className?: string;
};

export function VideoExplain({
	videoSrc,
	posterSrc,
	title = 'Need a quick walkthrough?',
	description = 'Watch a short explainer to understand this simulation faster.',
	buttonLabel = 'Show Help Video',
	className = '',
}: VideoExplainProps) {
	const [isOpen, setIsOpen] = useState(false);
	const titleId = useId();
	const descriptionId = useId();

	useEffect(() => {
		if (!isOpen) return;

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				setIsOpen(false);
			}
		};

		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [isOpen]);

	return (
		<>
			<button
				type="button"
				onClick={() => setIsOpen(true)}
				className={`group inline-flex items-center gap-2 rounded-full border border-sky-300/35 bg-sky-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-sky-100 transition hover:border-sky-200 hover:bg-sky-300/15 hover:text-white ${className}`}
				aria-haspopup="dialog"
				aria-expanded={isOpen}
			>
				<span className="relative inline-flex h-6 w-6 items-center justify-center rounded-full border border-sky-300/50 bg-[#071824] text-[0.8rem] font-bold text-sky-200">
					?
					<span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-sky-300/40 transition group-hover:ring-sky-200/70" />
				</span>
				{buttonLabel}
			</button>

			{isOpen ? (
				<div
					className="fixed inset-0 z-50 grid place-items-center bg-[#02050b]/85 p-4"
					onClick={() => setIsOpen(false)}
					role="dialog"
					aria-modal="true"
					aria-labelledby={titleId}
					aria-describedby={descriptionId}
				>
					<div
						className="w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-[#0a0f18] shadow-2xl shadow-black/60"
						onClick={(event) => event.stopPropagation()}
					>
						<div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
							<div>
								<h2 id={titleId} className="text-lg font-semibold text-slate-100">
									{title}
								</h2>
								<p id={descriptionId} className="mt-1 text-sm text-slate-300">
									{description}
								</p>
							</div>
							<button
								type="button"
								onClick={() => setIsOpen(false)}
								className="rounded-lg border border-white/15 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-slate-300 transition hover:border-sky-300/70 hover:text-sky-200"
							>
								Close
							</button>
						</div>

						<div className="p-4">
							{videoSrc ? (
								<video
									className="w-full rounded-xl border border-white/10 bg-black"
									controls
									preload="metadata"
									poster={posterSrc}
								>
									<source src={videoSrc} type="video/mp4" />
									Your browser does not support the video tag.
								</video>
							) : (
								<div className="rounded-xl border border-amber-300/30 bg-amber-400/10 p-4 text-sm text-amber-100">
									No video source configured yet. Pass a Manim mp4 path to <code>videoSrc</code>.
								</div>
							)}
						</div>
					</div>
				</div>
			) : null}
		</>
	);
}

export default VideoExplain;
